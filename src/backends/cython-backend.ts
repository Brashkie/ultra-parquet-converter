/**
 * Cython Backend v1.3.0
 * Usa módulos Cython compilados para ultra-performance.
 * Spawnea Python con los .pyd/.so para conversiones de archivos grandes.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { ConversionOptions, ConversionResult, BackendInterface } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parsea JSON solo si el string tiene contenido real.
 * Lanza SyntaxError si el contenido existe pero es JSON inválido.
 * Retorna {} si el string es vacío o solo espacios.
 */
function safeParseJSON(str: string): any {
  if (!str || !str.trim()) return {};
  return JSON.parse(str); // lanza SyntaxError si es inválido
}

// ─── findPython ───────────────────────────────────────────────────────────────

async function findPython(): Promise<string | null> {
  const candidates = ['py', 'python', 'python3'];

  for (const cmd of candidates) {
    const found = await new Promise<boolean>((resolve) => {
      const proc = spawn(cmd, ['--version'], { stdio: 'pipe' });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
    if (found) return cmd;
  }
  return null;
}

// ─── findCythonModules ────────────────────────────────────────────────────────

function findCythonModules(): string[] {
  const cythonDir = join(__dirname, '..', '..', 'cython');
  const found: string[] = [];

  if (!existsSync(cythonDir)) return found;

  const patterns = [
    // Windows
    /^fast_(csv|parser)\.cp\d+-win_amd64\.pyd$/,
    // Linux
    /^fast_(csv|parser)\.cpython-\d+-x86_64-linux-gnu\.so$/,
    // macOS
    /^fast_(csv|parser)\.cpython-\d+-darwin\.so$/,
  ];

  try {
    const { readdirSync } = require('fs');
    const files: string[] = readdirSync(cythonDir);

    for (const file of files) {
      if (patterns.some((p) => p.test(file))) {
        found.push(file.replace(/\.(cp\d+-.*\.pyd|cpython-.*\.so)$/, ''));
      }
    }
  } catch {
    // Directorio no accesible
  }

  return [...new Set(found)];
}

// ─── CythonBackend ────────────────────────────────────────────────────────────

export class CythonBackend implements BackendInterface {

  /**
   * Convierte archivo usando módulos Cython via Python
   */
  async convert(
    inputFile: string,
    options?: ConversionOptions
  ): Promise<ConversionResult> {
    const python = await findPython();
    if (!python) {
      throw new Error('Python no encontrado. Instala Python 3.8+');
    }

    const modules = findCythonModules();
    if (modules.length === 0) {
      throw new Error(
        'Módulos Cython no compilados. Ejecuta: npm run build:cython'
      );
    }

    const scriptPath = join(__dirname, '..', '..', 'python', 'converter_advanced.py');
    if (!existsSync(scriptPath)) {
      throw new Error(`Script Python no encontrado: ${scriptPath}`);
    }

    const args = [scriptPath, inputFile];

    if (options?.output)                  args.push('-o', options.output);
    if (options?.verbose)                 args.push('-v');
    if (options?.streaming)              args.push('--streaming');
    if (options?.autoRepair === false)   args.push('--no-repair');
    if (options?.autoNormalize === false) args.push('--no-normalize');

    const env = {
      ...process.env,
      CYTHON_ENABLED: '1',
      CYTHON_MODULES: modules.join(','),
    };

    return new Promise((resolve, reject) => {
      const proc = spawn(python, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve({ ...result, backend: 'cython' });
          } catch {
            reject(new Error(`Respuesta inválida de Python: ${stdout}`));
          }
        } else {
          // Intenta parsear stdout como JSON para extraer el error
          let errorData: any = {};
          try {
            errorData = safeParseJSON(stdout);
          } catch {
            // stdout tiene contenido pero no es JSON válido
            // → usa stderr si existe, si no stdout, si no mensaje genérico
            reject(new Error(stderr || stdout || 'Error desconocido en Cython backend'));
            return;
          }
          reject(new Error(errorData.error || `Error código ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`No se pudo ejecutar Python: ${err.message}`));
      });
    });
  }

  /**
   * Verifica si Cython está disponible (módulos compilados + Python presente)
   */
  static async isAvailable(): Promise<boolean> {
    const python = await findPython();
    if (!python) return false;

    const modules = findCythonModules();
    return modules.length >= 2;
  }

  /**
   * Obtiene info de los módulos compilados
   */
  static getModulesInfo(): { available: boolean; modules: string[] } {
    const modules = findCythonModules();
    return {
      available: modules.length >= 2,
      modules,
    };
  }
}