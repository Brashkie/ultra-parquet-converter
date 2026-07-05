/**
 * Pyodide Backend v1.4.0 — Python en WebAssembly.
 *
 * Diseño:
 *  - convert(inputFile, options)   → API de archivo (Node): lee el archivo,
 *    convierte y ESCRIBE el .parquet a disco. Cumple BackendInterface, así que
 *    el selector puede enrutar a WASM sin romperse.
 *  - convertData(data, options)    → API de datos (browser/programático): sin
 *    filesystem; devuelve parquet_bytes.
 *  - El código Python vive en python/pyodide_convert.py (fuente ÚNICA, sin
 *    duplicación con web/worker.js). Se carga una vez y se define upc_convert.
 *  - Los datos se inyectan por globals de Pyodide (texto) y toPy/bytes (binario),
 *    NO por interpolación de string → sin escaping frágil ni bytes([...]) gigante.
 *  - loader / logger / sourceLoader / indexURL inyectables → 100% testeable.
 */

import { ConversionOptions, ConversionResult } from '../types';
import {
  isNodeRuntime,
  defaultIndexURL,
  loadPyodideSource,
} from '../utils/runtime';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PyodideLoader = () => Promise<{
  loadPyodide: (opts: { indexURL: string }) => Promise<PyodideInstance>;
}>;

export interface PyodideLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

interface PyodideInstance {
  loadPackage(packages: readonly string[]): Promise<void>;
  runPythonAsync(code: string): Promise<string>;
  runPython(code: string): unknown;
  toPy(obj: unknown): unknown;
  globals: { set(name: string, value: unknown): void };
}

interface PyodideRawResult {
  success: boolean;
  rows: number;
  columns: number;
  input_size: number;
  output_size: number;
  compression_ratio: number;
  compression_used: string;
  file_type: string;
  parquet_bytes: number[];
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUIRED_PACKAGES = ['pandas', 'pyarrow', 'numpy'] as const;
const LIMITATIONS       = [
  'Pyodide es 10-50x más lento que Python nativo',
  'Sin filesystem nativo (los datos se cargan en memoria)',
  'Funciona en navegador o Node.js con WebAssembly',
] as const;

/** Extensiones que deben leerse como binario (Excel/Parquet). */
const BINARY_EXTENSIONS = new Set(['.xlsx', '.xls', '.parquet', '.feather', '.arrow', '.orc']);

const defaultLoader: PyodideLoader = () => import('pyodide') as any;

// console satisface {info,warn,error}; evita un objeto wrapper sin cubrir.
const defaultLogger: PyodideLogger = console;

const defaultSourceLoader = (): Promise<string> => loadPyodideSource();

// ─── PyodideBackend ───────────────────────────────────────────────────────────

export class PyodideBackend {
  private pyodide: PyodideInstance | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private sourceLoaded = false;

  private readonly loader: PyodideLoader;
  private readonly logger: PyodideLogger;
  private readonly indexURL: string;
  private readonly sourceLoader: () => Promise<string>;

  constructor(opts?: {
    loader?: PyodideLoader;
    logger?: PyodideLogger;
    indexURL?: string;
    sourceLoader?: () => Promise<string>;
  }) {
    this.loader       = opts?.loader ?? defaultLoader;
    this.logger       = opts?.logger ?? defaultLogger;
    this.indexURL     = opts?.indexURL ?? defaultIndexURL();
    this.sourceLoader = opts?.sourceLoader ?? defaultSourceLoader;
  }

  // ── Initialize ────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!this.initPromise) {
      this.initPromise = this._doInitialize().catch((err) => {
        this.initPromise = null; // permite reintento tras fallo
        throw err;
      });
    }
    await this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    this.logger.info('🌐 Cargando Pyodide...');
    const { loadPyodide } = await this.loader();
    this.pyodide = await loadPyodide({ indexURL: this.indexURL });

    this.logger.info('📦 Instalando paquetes Python (pandas, pyarrow, numpy)...');
    await this.pyodide.loadPackage(REQUIRED_PACKAGES);

    this.isInitialized = true;
    this.logger.info('✅ Pyodide listo');
  }

  /** Define upc_convert() en el intérprete una sola vez. */
  private async ensureSource(): Promise<void> {
    if (this.sourceLoaded) return;
    const source = await this.sourceLoader();
    await this.pyodide!.runPythonAsync(source);
    this.sourceLoaded = true;
  }

  // ── convertData (browser / programático) ──────────────────────────────────

  /**
   * Convierte datos en memoria a Parquet. Devuelve el resultado con
   * `parquet_bytes`. No toca el filesystem.
   */
  async convertData(
    data: string | ArrayBuffer,
    options?: ConversionOptions,
  ): Promise<ConversionResult> {
    await this.initialize();
    if (!this.pyodide) throw new Error('Pyodide no inicializado correctamente');
    await this.ensureSource();

    const startTime = Date.now();
    const autoRepair  = options?.autoRepair !== false;
    const compression = options?.compression ?? 'snappy';

    try {
      let mode: 'text' | 'binary';
      if (data instanceof ArrayBuffer) {
        mode = 'binary';
        this.pyodide.globals.set('_upc_bytes', this.pyodide.toPy(new Uint8Array(data)));
      } else {
        mode = 'text';
        this.pyodide.globals.set('_upc_text', data);
      }

      const call = `upc_convert(${JSON.stringify(mode)}, ${autoRepair ? 'True' : 'False'}, ${JSON.stringify(compression)})`;
      const raw = await this.pyodide.runPythonAsync(call);

      let parsed: PyodideRawResult;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`Pyodide returned invalid JSON: ${raw}`);
      }

      if (!parsed.success) {
        throw new Error(parsed.error ?? 'Error desconocido en Pyodide');
      }

      return {
        ...parsed,
        success:           true,
        backend:           'pyodide',
        compression_used:  parsed.compression_used as ConversionResult['compression_used'],
        elapsed_time:      (Date.now() - startTime) / 1000,
        limitations:       [...LIMITATIONS],
      } as ConversionResult;
    } catch (error: any) {
      if (error.message?.startsWith('Pyodide conversion failed:')) throw error;
      throw new Error(`Pyodide conversion failed: ${error.message}`);
    }
  }

  // ── convert (Node, API de archivo — cumple BackendInterface) ───────────────

  /**
   * Convierte un archivo a Parquet en Node: lo lee, lo convierte vía WASM y
   * escribe el .parquet a disco. Devuelve input_file / output_file reales.
   */
  async convert(inputFile: string, options?: ConversionOptions): Promise<ConversionResult> {
    if (!isNodeRuntime()) {
      throw new Error('convert(path) requiere Node.js; en navegador usa convertData()');
    }

    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(inputFile)) {
      throw new Error(`Archivo no encontrado: ${inputFile}`);
    }

    const ext = path.extname(inputFile).toLowerCase();
    const payload: string | ArrayBuffer = BINARY_EXTENSIONS.has(ext)
      ? (fs.readFileSync(inputFile).buffer as ArrayBuffer)
      : fs.readFileSync(inputFile, 'utf8');

    const result = await this.convertData(payload, options);

    const outputFile = options?.output
      ?? path.join(path.dirname(inputFile), path.basename(inputFile, ext) + '.parquet');
    fs.writeFileSync(outputFile, Buffer.from(result.parquet_bytes ?? []));

    const inputSize = fs.statSync(inputFile).size;
    const { parquet_bytes, ...rest } = result;

    return {
      ...rest,
      input_file:  inputFile,
      output_file: outputFile,
      input_size:  inputSize,
    } as ConversionResult;
  }

  // ── isAvailable ────────────────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    return PyodideBackend.isAvailable(this.loader);
  }

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
