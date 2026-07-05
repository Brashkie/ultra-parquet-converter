/**
 * Shared Python Runner
 * Única fuente para: localizar Python, obtener versión y ejecutar un script
 * Python que devuelve JSON por stdout.
 *
 * Antes esta lógica estaba triplicada en native/portable/cython (spawn →
 * recolectar stdout/stderr → parsear JSON → resolve/reject). Ahora vive aquí.
 * Los mensajes de error se inyectan por backend para mantener compatibilidad
 * con los tests existentes.
 */

import { spawn, SpawnOptions } from 'child_process';
import { ConversionResult, BackendType } from '../types';

// ─── Python discovery ─────────────────────────────────────────────────────────

/** Candidatos por defecto, ordenados: Windows primero prueba `py`. */
export function defaultPythonCandidates(): string[] {
  return process.platform === 'win32'
    ? ['py', 'python', 'python3']
    : ['python3', 'python'];
}

/** El comando Python preferido para este SO (sin verificar que exista). */
export function preferredPythonCommand(): string {
  return process.platform === 'win32' ? 'py' : 'python3';
}

/** Devuelve el primer comando Python disponible, o null si no hay ninguno. */
export async function findPython(candidates = defaultPythonCandidates()): Promise<string | null> {
  for (const cmd of candidates) {
    const ok = await new Promise<boolean>((resolve) => {
      const proc = spawn(cmd, ['--version'], { stdio: 'ignore' });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
    if (ok) return cmd;
  }
  return null;
}

// ─── JSON runner ──────────────────────────────────────────────────────────────

/** Mensajes de error personalizables por backend (compat con tests). */
export interface RunMessages {
  /** Fallo al lanzar el proceso (evento 'error'). */
  execError: (msg: string) => string;
  /** Exit 0 pero stdout no es JSON válido. */
  parseError: (err: Error, stdout: string) => string;
  /** Exit != 0, JSON sin campo `.error`. */
  nonZeroCode: (code: number | null) => string;
}

/**
 * Parsea JSON solo si el string tiene contenido real; {} si está vacío.
 * Lanza SyntaxError si hay contenido pero es inválido.
 */
function safeParseJSON(str: string): any {
  if (!str || !str.trim()) return {};
  return JSON.parse(str);
}

/**
 * Ejecuta un comando Python que imprime JSON en stdout y resuelve el resultado
 * tipado, etiquetado con `backend`. Centraliza el patrón spawn→parse→resolve.
 */
export function runPythonToJson(
  command: string,
  args: string[],
  backend: BackendType,
  messages: RunMessages,
  spawnOptions: SpawnOptions = { stdio: ['ignore', 'pipe', 'pipe'] },
): Promise<ConversionResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, spawnOptions);

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        let errorData: any;
        try {
          errorData = safeParseJSON(stdout);
        } catch {
          // stdout tiene contenido no-JSON (safeParseJSON no lanza con vacío),
          // así que stderr||stdout siempre resuelve a un mensaje.
          return reject(new Error(stderr || stdout));
        }
        return reject(new Error(errorData.error || messages.nonZeroCode(code)));
      }

      let result: any;
      try {
        result = JSON.parse(stdout);
      } catch (e: any) {
        return reject(new Error(messages.parseError(e, stdout)));
      }

      if (result.success === false) {
        return reject(new Error(result.error || 'Error desconocido'));
      }

      result.backend = backend;
      resolve(result as ConversionResult);
    });

    proc.on('error', (err) => reject(new Error(messages.execError(err.message))));
  });
}
