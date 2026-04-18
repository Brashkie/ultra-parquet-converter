/**
 * Portable Python Backend
 * Descarga Python portable automáticamente si no existe
 */
// src/backends/portable-python.ts

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { ConversionOptions, ConversionResult, BackendInterface } from '../types';
import { ensurePortablePython, getDownloader } from '../utils/download';

export class PortablePythonBackend implements BackendInterface {
  private pythonPath: string | null = null;

  async convert(
    inputFile: string,
    options?: ConversionOptions
  ): Promise<ConversionResult> {
    
    // Asegura que Python portable esté instalado
    if (!this.pythonPath) {
      console.log('🔄 Configurando Python portable por primera vez...');
      this.pythonPath = await ensurePortablePython();
    }

    if (!existsSync(inputFile)) {
      throw new Error(`Archivo no encontrado: ${inputFile}`);
    }

    const pythonScript = join(__dirname, '..', '..', 'python', 'converter_advanced.py');
    const args = [pythonScript, inputFile];

    if (options?.output) args.push('-o', options.output);
    if (options?.verbose) args.push('-v');
    if (options?.streaming) args.push('--streaming');
    if (options?.autoRepair === false) args.push('--no-repair');
    if (options?.autoNormalize === false) args.push('--no-normalize');

    return this.executePython(args);
  }

  private executePython(args: string[]): Promise<ConversionResult> {
    return new Promise((resolve, reject) => {
      if (!this.pythonPath) {
        return reject(new Error('Portable Python not initialized'));
      }

      const proc = spawn(this.pythonPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

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
          result.backend = 'portable-python';
          resolve(result);
        } catch (e: any) {
          reject(new Error(`Error al parsear: ${e.message}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Error Python: ${err.message}`));
      });
    });
  }

  static async isAvailable(): Promise<boolean> {
    const downloader = getDownloader();
    return downloader.isInstalled();
  }

  static async getInfo() {
    const downloader = getDownloader();
    return downloader.getInfo();
  }
}