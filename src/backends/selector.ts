/**
 * Smart Backend Selector v1.3.0
 * Elige automáticamente el mejor backend disponible
 */

import { BackendType, ConversionOptions, ConversionResult } from '../types';
import { detectEnvironment } from '../utils/detect';
import { NativePythonBackend } from './native-python';
import { PortablePythonBackend } from './portable-python';
import { PyodideBackend } from './pyodide-backend';
import { CythonBackend } from './cython-backend';

export class BackendSelector {
  private static instance: BackendSelector;
  private currentBackend: BackendType | null = null;
  private backends: Map<BackendType, any> = new Map();

  private constructor() {
    this.initializeBackends();
  }

  static getInstance(): BackendSelector {
    if (!BackendSelector.instance) {
      BackendSelector.instance = new BackendSelector();
    }
    return BackendSelector.instance;
  }

  /**
   * Resetea el estado del selector (útil para tests)
   */
  reset(): void {
    this.currentBackend = null;
  }

  private initializeBackends() {
    this.backends.set('native-python', new NativePythonBackend());
    this.backends.set('portable-python', new PortablePythonBackend());
    this.backends.set('pyodide', new PyodideBackend());
    this.backends.set('cython', new CythonBackend());
  }

  /**
   * Selecciona el mejor backend según el entorno y opciones.
   * forceBackend tiene prioridad absoluta sobre todo lo demás.
   */
  async selectBackend(options?: ConversionOptions): Promise<BackendType> {
    // Prioridad 0: forceBackend — respeta siempre la elección manual
    if (options?.forceBackend) {
      if (!this.backends.has(options.forceBackend)) {
        throw new Error(`Backend '${options.forceBackend}' no existe`);
      }
      return options.forceBackend;
    }

    const env = await detectEnvironment();

    // Prioridad 1: Cython (si disponible y archivos grandes)
    if (env.hasCython && options?.fileSize && options.fileSize > 50_000_000) {
      console.log('🚀 Usando Cython (ultra-rápido para archivos grandes)');
      return 'cython';
    }

    // Prioridad 2: Python Nativo (el más rápido)
    if (env.hasPython) {
      console.log('⚡ Usando Python nativo (rápido)');
      return 'native-python';
    }

    // Prioridad 3: Portable Python (auto-descarga si no existe)
    if (env.isNode) {
      console.log('📦 Usando Portable Python (descarga automática)');
      return 'portable-python';
    }

    // Prioridad 4: Pyodide (navegador o WASM)
    if (env.isBrowser || env.hasWebAssembly) {
      console.log('🌐 Usando Pyodide (WebAssembly)');
      return 'pyodide';
    }

    throw new Error('No hay backend disponible en este entorno');
  }

  /**
   * Ejecuta conversión con el backend seleccionado
   */
  async convert(
    inputFile: string,
    options?: ConversionOptions
  ): Promise<ConversionResult> {
    // forceBackend siempre reemplaza el backend actual
    if (options?.forceBackend) {
      this.currentBackend = options.forceBackend;
    } else if (!this.currentBackend) {
      this.currentBackend = await this.selectBackend(options);
    }

    const backend = this.backends.get(this.currentBackend);

    if (!backend) {
      throw new Error(`Backend ${this.currentBackend} no disponible`);
    }

    const result = await backend.convert(inputFile, options);
    result.backend = this.currentBackend;

    return result;
  }

  /**
   * Obtiene info de todos los backends disponibles
   */
  async getAvailableBackends() {
    const env = await detectEnvironment();

    return {
      'native-python': {
        available: env.hasPython,
        speed: '⚡⚡⚡⚡⚡',
        description: 'Python nativo del sistema (más rápido)',
        limitations: 'Requiere Python instalado'
      },
      'cython': {
        available: env.hasCython,
        speed: '🚀🚀🚀🚀🚀',
        description: 'Módulos Cython compilados (ultra-rápido)',
        limitations: 'Solo para archivos grandes'
      },
      'portable-python': {
        available: env.isNode,
        speed: '⚡⚡⚡⚡',
        description: 'Python portable (descarga automática)',
        limitations: 'Primera descarga ~30MB'
      },
      'pyodide': {
        available: env.isBrowser || env.hasWebAssembly,
        speed: '⚡⚡',
        description: 'Python en WebAssembly (sin instalación)',
        limitations: 'Más lento, sin filesystem nativo'
      }
    };
  }

  /**
   * Cambia manualmente el backend
   */
  setBackend(backend: BackendType): void {
    if (!this.backends.has(backend)) {
      throw new Error(`Backend '${backend}' no existe`);
    }
    this.currentBackend = backend;
  }

  /**
   * Obtiene el backend actual
   */
  getCurrentBackend(): BackendType | null {
    return this.currentBackend;
  }
}

export const backendSelector = BackendSelector.getInstance();