/**
 * Environment Detector
 * Detecta qué está disponible en el sistema
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

export interface Environment {
  // Platform
  platform: NodeJS.Platform;
  isWindows: boolean;
  isLinux: boolean;
  isMac: boolean;
  isNode: boolean;
  isBrowser: boolean;

  // Python
  hasPython: boolean;
  pythonCommand?: string;
  pythonVersion?: string;

  // Cython
  hasCython: boolean;
  cythonModules?: string[];

  // Portable Python
  hasPortablePython: boolean;
  portablePythonPath?: string;

  // WebAssembly
  hasWebAssembly: boolean;
}

class EnvironmentDetector {
  private cachedEnv: Environment | null = null;

  /**
   * Detecta todo el entorno
   */
  async detect(): Promise<Environment> {
    if (this.cachedEnv) {
      return this.cachedEnv;
    }

    const env: Environment = {
      // Platform detection
      platform: process.platform,
      isWindows: process.platform === 'win32',
      isLinux: process.platform === 'linux',
      isMac: process.platform === 'darwin',
      isNode: typeof process !== 'undefined' && process.versions?.node !== undefined,
      isBrowser: typeof globalThis !== 'undefined' && 'window' in globalThis,  // ← CAMBIADO

      // Python detection
      hasPython: false,
      pythonCommand: undefined,
      pythonVersion: undefined,

      // Cython detection
      hasCython: false,
      cythonModules: [],

      // Portable Python detection
      hasPortablePython: false,
      portablePythonPath: undefined,

      // WebAssembly detection
      hasWebAssembly: typeof globalThis !== 'undefined' && 'WebAssembly' in globalThis  // ← CAMBIADO
    };

    // Detecta Python
    await this.detectPython(env);

    // Detecta Cython modules
    await this.detectCython(env);

    // Detecta Portable Python
    await this.detectPortablePython(env);

    this.cachedEnv = env;
    return env;
  }

  /**
   * Detecta Python en el sistema
   */
  private async detectPython(env: Environment): Promise<void> {
    const commands = env.isWindows ? ['py', 'python', 'python3'] : ['python3', 'python'];

    for (const cmd of commands) {
      try {
        const version = await this.getPythonVersion(cmd);
        if (version) {
          env.hasPython = true;
          env.pythonCommand = cmd;
          env.pythonVersion = version;
          return;
        }
      } catch {
        continue;
      }
    }
  }

  /**
   * Obtiene versión de Python
   */
  private getPythonVersion(command: string): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn(command, ['--version'], { stdio: 'pipe' });
      
      let output = '';
      
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          const match = output.match(/Python (\d+\.\d+\.\d+)/);
          resolve(match ? match[1] : null);
        } else {
          resolve(null);
        }
      });

      proc.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Detecta módulos Cython compilados
   */
  private async detectCython(env: Environment): Promise<void> {
    const cythonDir = join(__dirname, '..', '..', 'cython');
    
    if (!existsSync(cythonDir)) {
      return;
    }

    const extensions = env.isWindows ? ['.pyd'] : ['.so'];
    const modules: string[] = [];

    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(cythonDir);

      for (const file of files) {
        if (extensions.some(ext => file.endsWith(ext))) {
          modules.push(file);
        }
      }

      if (modules.length > 0) {
        env.hasCython = true;
        env.cythonModules = modules;
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Detecta Portable Python
   */
  private async detectPortablePython(env: Environment): Promise<void> {
    const portableDir = join(os.homedir(), '.ultra-parquet-converter', 'python-portable');
    const pythonExe = env.isWindows ? 'python.exe' : 'bin/python3';
    const pythonPath = join(portableDir, pythonExe);

    if (existsSync(pythonPath)) {
      env.hasPortablePython = true;
      env.portablePythonPath = pythonPath;
    }
  }

  /**
   * Limpia cache
   */
  clearCache() {
    this.cachedEnv = null;
  }
}

// Singleton
const detector = new EnvironmentDetector();

/**
 * Exporta función principal
 */
export async function detectEnvironment(): Promise<Environment> {
  return detector.detect();
}

/**
 * Limpia cache de detección
 */
export function clearEnvironmentCache() {
  detector.clearCache();
}