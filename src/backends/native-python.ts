/**
 * Native Python Backend v1.4.0
 * Usa el Python del sistema. Soporta parallel processing y compresión adaptativa.
 * La mecánica spawn→JSON vive en utils/python-runner (dedup con portable/cython).
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { ConversionOptions, ConversionResult, BackendInterface } from '../types';
import { preferredPythonCommand, runPythonToJson } from '../utils/python-runner';

const VALID_COMPRESSIONS = ['adaptive', 'snappy', 'zstd', 'lz4', 'gzip', 'brotli', 'none'];

/** Construye los args de converter_advanced.py a partir de las opciones. */
export function buildPythonArgs(
  scriptPath: string,
  inputFile: string,
  options?: ConversionOptions,
): string[] {
  const args = [scriptPath, inputFile];

  if (options?.output)                  args.push('-o', options.output);
  if (options?.verbose)                 args.push('-v');
  if (options?.streaming)               args.push('--streaming');
  if (options?.autoRepair === false)    args.push('--no-repair');
  if (options?.autoNormalize === false) args.push('--no-normalize');

  args.push('--workers', String(options?.parallelWorkers ?? 0));

  const requested = options?.compression ?? 'adaptive';
  const compression = VALID_COMPRESSIONS.includes(requested) ? requested : 'adaptive';
  if (!VALID_COMPRESSIONS.includes(requested)) {
    console.warn(`⚠️  Compresión '${requested}' no válida — usando 'adaptive' como fallback`);
  }
  args.push('--compression', compression);

  return args;
}

export class NativePythonBackend implements BackendInterface {
  async convert(inputFile: string, options?: ConversionOptions): Promise<ConversionResult> {
    if (!existsSync(inputFile)) {
      throw new Error(`Archivo no encontrado: ${inputFile}`);
    }

    const script = join(__dirname, '..', '..', 'python', 'converter_advanced.py');
    const args = buildPythonArgs(script, inputFile, options);

    return runPythonToJson(this.getPythonCommand(), args, 'native-python', {
      execError:       (m) => `Error ejecutando Python: ${m}`,
      parseError:      (e) => `Error al parsear respuesta: ${e.message}`,
      nonZeroCode:     (code) => `Error (código ${code})`,
    });
  }

  private getPythonCommand(): string {
    return preferredPythonCommand();
  }

  static async isAvailable(): Promise<boolean> {
    const cmd = process.platform === 'win32' ? 'py' : 'python3';
    return new Promise((resolve) => {
      const proc = spawn(cmd, ['--version'], { stdio: 'ignore' });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }
}
