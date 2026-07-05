/**
 * Cython Backend v1.4.0
 * Ejecuta converter_advanced.py con los módulos Cython compilados (.pyd/.so)
 * activados vía variables de entorno, para archivos grandes.
 * Comparte findPython y la mecánica spawn→JSON con el resto de backends.
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { ConversionOptions, ConversionResult, BackendInterface } from '../types';
import { findPython, runPythonToJson } from '../utils/python-runner';
import { buildPythonArgs } from './native-python';

// ─── findCythonModules ────────────────────────────────────────────────────────

const MODULE_PATTERNS = [
  /^fast_(csv|parser)\.cp\d+-win_amd64\.pyd$/,                 // Windows
  /^fast_(csv|parser)\.cpython-\d+-x86_64-linux-gnu\.so$/,    // Linux
  /^fast_(csv|parser)\.cpython-\d+-darwin\.so$/,              // macOS
];

export function findCythonModules(
  cythonDir: string = join(__dirname, '..', '..', 'cython'),
): string[] {
  if (!existsSync(cythonDir)) return [];

  try {
    const files: string[] = readdirSync(cythonDir);
    const found = files
      .filter((f) => MODULE_PATTERNS.some((p) => p.test(f)))
      .map((f) => f.replace(/\.(cp\d+-.*\.pyd|cpython-.*\.so)$/, ''));
    return [...new Set(found)];
  } catch {
    return [];
  }
}

// ─── CythonBackend ────────────────────────────────────────────────────────────

export class CythonBackend implements BackendInterface {
  async convert(inputFile: string, options?: ConversionOptions): Promise<ConversionResult> {
    const python = await findPython(['py', 'python', 'python3']);
    if (!python) {
      throw new Error('Python no encontrado. Instala Python 3.8+');
    }

    const modules = findCythonModules();
    if (modules.length === 0) {
      throw new Error('Módulos Cython no compilados. Ejecuta: npm run build:cython');
    }

    const script = join(__dirname, '..', '..', 'python', 'converter_advanced.py');
    if (!existsSync(script)) {
      throw new Error(`Script Python no encontrado: ${script}`);
    }

    const args = buildPythonArgs(script, inputFile, options);

    return runPythonToJson(
      python,
      args,
      'cython',
      {
        execError:       (m) => `No se pudo ejecutar Python: ${m}`,
        parseError:      (_e, stdout) => `Respuesta inválida de Python: ${stdout}`,
        nonZeroCode:     (code) => `Error código ${code}`,
      },
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CYTHON_ENABLED: '1',
          CYTHON_MODULES: modules.join(','),
        },
      },
    );
  }

  static async isAvailable(): Promise<boolean> {
    const python = await findPython(['py', 'python', 'python3']);
    if (!python) return false;
    return findCythonModules().length >= 2;
  }

  static getModulesInfo(): { available: boolean; modules: string[] } {
    const modules = findCythonModules();
    return { available: modules.length >= 2, modules };
  }
}
