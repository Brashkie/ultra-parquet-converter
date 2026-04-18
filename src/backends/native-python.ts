/**
 * Native Python Backend v1.3.0
 * Usa Python del sistema con soporte para parallel processing
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { ConversionOptions, ConversionResult, BackendInterface } from '../types';

const VALID_COMPRESSIONS = ['adaptive', 'snappy', 'zstd', 'lz4', 'gzip', 'brotli', 'none'];

export class NativePythonBackend implements BackendInterface {

  async convert(
    inputFile: string,
    options?: ConversionOptions
  ): Promise<ConversionResult> {

    if (!existsSync(inputFile)) {
      throw new Error(`Archivo no encontrado: ${inputFile}`);
    }

    const pythonScript = join(__dirname, '..', '..', 'python', 'converter_advanced.py');
    const args = [pythonScript, inputFile];

    if (options?.output)                  args.push('-o', options.output);
    if (options?.verbose)                 args.push('-v');
    if (options?.streaming)              args.push('--streaming');
    if (options?.autoRepair === false)   args.push('--no-repair');
    if (options?.autoNormalize === false) args.push('--no-normalize');

    // Parallel workers
    const workers = options?.parallelWorkers ?? 0;
    args.push('--workers', String(workers));

    // Compresión con validación + fallback + warning
    const requested = options?.compression ?? 'adaptive';
    const compression = VALID_COMPRESSIONS.includes(requested) ? requested : 'adaptive';

    if (!VALID_COMPRESSIONS.includes(requested)) {
      console.warn(
        `⚠️  Compresión '${requested}' no válida — usando 'adaptive' como fallback`
      );
    }

    args.push('--compression', compression);

    return this.executePython(args);
  }

  private executePython(args: string[]): Promise<ConversionResult> {
    return new Promise((resolve, reject) => {
      const pythonCmd = this.getPythonCommand();
      const proc = spawn(pythonCmd, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          try {
            const errorData = JSON.parse(stdout || '{}');
            return reject(new Error(errorData.error || `Error (código ${code})`));
          } catch {
            return reject(new Error(stderr || stdout || 'Error desconocido'));
          }
        }

        try {
          const result = JSON.parse(stdout);
          if (result.success === false) {
            return reject(new Error(result.error || 'Error desconocido'));
          }
          result.backend = 'native-python';
          resolve(result);
        } catch (e: any) {
          reject(new Error(`Error al parsear respuesta: ${e.message}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Error ejecutando Python: ${err.message}`));
      });
    });
  }

  private getPythonCommand(): string {
    return process.platform === 'win32' ? 'py' : 'python3';
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