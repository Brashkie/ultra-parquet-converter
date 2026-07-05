/**
 * Portable Python Backend v1.4.0
 * Descarga Python portable automáticamente si no existe y convierte con él.
 * Comparte la mecánica spawn→JSON y la construcción de args con native.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { ConversionOptions, ConversionResult, BackendInterface } from '../types';
import { ensurePortablePython, getDownloader } from '../utils/download';
import { buildPythonArgs } from './native-python';
import { runPythonToJson } from '../utils/python-runner';

export class PortablePythonBackend implements BackendInterface {
  private pythonPath: string | null = null;

  async convert(inputFile: string, options?: ConversionOptions): Promise<ConversionResult> {
    if (!this.pythonPath) {
      console.log('🔄 Configurando Python portable por primera vez...');
      this.pythonPath = await ensurePortablePython();
    }

    if (!existsSync(inputFile)) {
      throw new Error(`Archivo no encontrado: ${inputFile}`);
    }

    if (!this.pythonPath) {
      throw new Error('Portable Python not initialized');
    }

    const script = join(__dirname, '..', '..', 'python', 'converter_advanced.py');
    const args = buildPythonArgs(script, inputFile, options);

    return runPythonToJson(this.pythonPath, args, 'portable-python', {
      execError:       (m) => `Error Python: ${m}`,
      parseError:      (e) => `Error al parsear: ${e.message}`,
      nonZeroCode:     (code) => `Error (código ${code})`,
    });
  }

  static async isAvailable(): Promise<boolean> {
    return getDownloader().isInstalled();
  }

  static async getInfo() {
    return getDownloader().getInfo();
  }
}
