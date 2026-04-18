/**
 * Pyodide Backend v1.3.0
 * Python en WebAssembly — sin instalación, funciona en navegador y Node.js
 *
 * Arquitectura:
 *  - Dependency injection: loader + logger → 100% testeable sin hacks
 *  - initPromise con reset en fallo → permite reintentos si loadPyodide falla
 *  - Python usa _result_json = json.dumps(_result) + _result_json como
 *    última expresión → robusto ante código agregado después
 *  - JSON.parse defensivo → error descriptivo si Pyodide retorna algo raro
 *  - JSON.stringify para escapar datos → seguro con cualquier string
 */

import { ConversionOptions, ConversionResult } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Loader inyectable — permite tests limpios sin hackear Module._load */
export type PyodideLoader = () => Promise<{
  loadPyodide: (opts: PyodideLoadOptions) => Promise<PyodideInstance>;
}>;

/** Logger inyectable — en producción usa console, en tests se puede silenciar */
export interface PyodideLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

interface PyodideLoadOptions {
  indexURL: string;
}

interface PyodideInstance {
  loadPackage(packages: readonly string[]): Promise<void>;
  runPythonAsync(code: string): Promise<string>;
}

interface PyodideConversionResult {
  success: boolean;
  rows: number;
  columns: number;
  input_size: number;
  output_size: number;
  compression_ratio: number;
  file_type: string;
  parquet_bytes: number[];
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PYODIDE_CDN       = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/';
const REQUIRED_PACKAGES = ['pandas', 'pyarrow', 'numpy'] as const;
const LIMITATIONS       = [
  'Pyodide es 10-50x más lento que Python nativo',
  'No puede leer archivos del filesystem',
  'Funciona solo en navegador/Node.js con WebAssembly',
] as const;

const defaultLoader: PyodideLoader = () => import('pyodide') as any;

const defaultLogger: PyodideLogger = {
  info:  (msg) => console.log(msg),
  warn:  (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
};

// ─── PyodideBackend ───────────────────────────────────────────────────────────

export class PyodideBackend {
  private pyodide: PyodideInstance | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private readonly loader: PyodideLoader;
  private readonly logger: PyodideLogger;

  /**
   * @param loader - Loader inyectable. Por defecto usa `import('pyodide')`.
   * @param logger - Logger inyectable. Por defecto usa `console`.
   */
  constructor(loader?: PyodideLoader, logger?: PyodideLogger) {
    this.loader = loader ?? defaultLoader;
    this.logger = logger ?? defaultLogger;
  }

  // ── Initialize ──────────────────────────────────────────────────────────────

  /**
   * Inicializa Pyodide una sola vez.
   * Thread-safe: múltiples llamadas concurrentes comparten la misma promesa.
   * Si la inicialización falla, resetea initPromise para permitir reintentos.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Asigna ANTES del await — llamadas concurrentes esperan la misma promesa
    if (!this.initPromise) {
      this.initPromise = this._doInitialize().catch((err) => {
        // FIX: resetea initPromise en fallo → permite reintento en próxima llamada
        this.initPromise = null;
        throw err;
      });
    }

    await this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    this.logger.info('🌐 Cargando Pyodide... (~100MB, puede tardar)');

    const { loadPyodide } = await this.loader();
    this.pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });

    this.logger.info('📦 Instalando paquetes Python...');
    await this.pyodide.loadPackage(REQUIRED_PACKAGES);

    this.isInitialized = true;
    this.logger.info('✅ Pyodide listo');
  }

  // ── Convert ─────────────────────────────────────────────────────────────────

  /**
   * Convierte datos a Parquet usando Python/WebAssembly.
   *
   * @param inputData - String (CSV/JSON/TSV/PSV) o ArrayBuffer (Excel/Parquet binario)
   * @param options   - Opciones de conversión
   */
  async convert(
    inputData: string | ArrayBuffer,
    options?: ConversionOptions
  ): Promise<ConversionResult> {
    await this.initialize();

    if (!this.pyodide) {
      throw new Error('Pyodide no inicializado correctamente');
    }

    const startTime = Date.now();

    try {
      const pythonCode = inputData instanceof ArrayBuffer
        ? this.generateBinaryConversionCode(inputData)
        : this.generateTextConversionCode(inputData as string, options);

      const raw = await this.pyodide.runPythonAsync(pythonCode);

      // Defensive JSON parse — error descriptivo si Pyodide retorna algo inesperado
      let parsed: PyodideConversionResult;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`Pyodide returned invalid JSON: ${raw}`);
      }

      // Verifica éxito ANTES del spread — no silencia errores retornados por Python
      if (!parsed.success) {
        throw new Error(parsed.error ?? 'Error desconocido en Pyodide');
      }

      return {
        ...parsed,
        success:      true,
        backend:      'pyodide',
        elapsed_time: (Date.now() - startTime) / 1000,
        limitations:  [...LIMITATIONS],
      } as ConversionResult;

    } catch (error: any) {
      // Evita double-wrap si el error ya tiene el prefijo
      if (error.message?.startsWith('Pyodide conversion failed:')) throw error;
      throw new Error(`Pyodide conversion failed: ${error.message}`);
    }
  }

  // ── Code Generators ─────────────────────────────────────────────────────────

  /**
   * Genera código Python para datos de texto (CSV, JSON, TSV, PSV).
   *
   * Escape via JSON.stringify().slice(1,-1) — seguro con cualquier string,
   * incluyendo caracteres raros, Unicode, comillas anidadas, etc.
   *
   * Patrón: _result_json = json.dumps(_result) + _result_json como última
   * expresión — robusto ante código agregado después.
   */
  private generateTextConversionCode(data: string, options?: ConversionOptions): string {
    // JSON.stringify escapa correctamente cualquier string, incluyendo Unicode,
    // backslashes, comillas y caracteres de control. slice(1,-1) quita las
    // comillas externas que JSON.stringify añade.
    const escapedData = JSON.stringify(data).slice(1, -1);
    const repairCode  = options?.autoRepair !== false
      ? `df = df.dropna(axis=1, how='all')\n    df = df.drop_duplicates()`
      : '';

    return `
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from io import StringIO, BytesIO
import json

_result = {"success": False, "error": "Unknown error"}

try:
    data_str = "${escapedData}"

    if data_str.strip().startswith('[') or data_str.strip().startswith('{'):
        df = pd.read_json(StringIO(data_str))
    elif '\\t' in data_str.split('\\n')[0]:
        df = pd.read_csv(StringIO(data_str), sep='\\t')
    elif '|' in data_str.split('\\n')[0]:
        df = pd.read_csv(StringIO(data_str), sep='|')
    else:
        df = pd.read_csv(StringIO(data_str))

    ${repairCode}

    table = pa.Table.from_pandas(df, preserve_index=False)
    buffer = BytesIO()
    pq.write_table(table, buffer, compression='snappy')
    parquet_bytes = buffer.getvalue()

    _result = {
        "success": True,
        "rows": len(df),
        "columns": len(df.columns),
        "input_size": len(data_str),
        "output_size": len(parquet_bytes),
        "compression_ratio": round((1 - len(parquet_bytes) / max(len(data_str), 1)) * 100, 2),
        "file_type": "auto-detected",
        "parquet_bytes": list(parquet_bytes)
    }

except Exception as e:
    _result = {"success": False, "error": str(e)}

_result_json = json.dumps(_result)
_result_json
`;
  }

  /**
   * Genera código Python para datos binarios (Excel, Parquet).
   * Intenta Excel primero, Parquet como fallback (con buf.seek(0) para reset).
   */
  private generateBinaryConversionCode(data: ArrayBuffer): string {
    const bytesList = Array.from(new Uint8Array(data)).join(',');

    return `
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from io import BytesIO
import json

_result = {"success": False, "error": "Unknown error"}

try:
    input_bytes = bytes([${bytesList}])
    buffer = BytesIO(input_bytes)

    try:
        df = pd.read_excel(buffer)
    except Exception:
        buffer.seek(0)
        try:
            df = pd.read_parquet(buffer)
        except Exception:
            raise Exception("Formato binario no soportado en Pyodide")

    table = pa.Table.from_pandas(df, preserve_index=False)
    output_buffer = BytesIO()
    pq.write_table(table, output_buffer, compression='snappy')
    parquet_bytes = output_buffer.getvalue()

    _result = {
        "success": True,
        "rows": len(df),
        "columns": len(df.columns),
        "input_size": len(input_bytes),
        "output_size": len(parquet_bytes),
        "compression_ratio": round((1 - len(parquet_bytes) / max(len(input_bytes), 1)) * 100, 2),
        "file_type": "binary",
        "parquet_bytes": list(parquet_bytes)
    }

except Exception as e:
    _result = {"success": False, "error": str(e)}

_result_json = json.dumps(_result)
_result_json
`;
  }

  // ── Static ──────────────────────────────────────────────────────────────────

  /**
   * Verifica si Pyodide está disponible en el entorno actual.
   *
   * @param loader - Loader inyectable para tests limpios.
   */
  static async isAvailable(loader?: PyodideLoader): Promise<boolean> {
    try {
      if (typeof globalThis === 'undefined' || !('WebAssembly' in globalThis)) {
        return false;
      }
      await (loader ?? defaultLoader)();
      return true;
    } catch {
      return false;
    }
  }
}