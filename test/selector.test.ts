/**
 * Backend Selector Tests
 */

import { BackendSelector } from '../src/backends/selector';
import { BackendType } from '../src/types';

// ─── Mock: detectEnvironment ───────────────────────────────────────────────────
// Se mockea a nivel de módulo para controlar los branches de selectBackend

const mockDetectEnvironment = jest.fn();

jest.mock('../src/utils/detect', () => ({
  detectEnvironment: (...args: any[]) => mockDetectEnvironment(...args),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeEnv(overrides = {}) {
  return {
    hasPython:      true,
    hasCython:      false,
    isNode:         true,
    isBrowser:      false,
    hasWebAssembly: true,
    platform:       'win32',
    pythonCommand:  'py',
    pythonVersion:  '3.11.0',
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────

describe('BackendSelector', () => {
  let selector: BackendSelector;

  beforeEach(() => {
    selector = BackendSelector.getInstance();
    selector.reset();
    // Por defecto: Python disponible, entorno Node
    mockDetectEnvironment.mockResolvedValue(makeEnv());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── selectBackend ────────────────────────────────────────────────────────────

  describe('selectBackend', () => {

    it('should select native-python when available', async () => {
      mockDetectEnvironment.mockResolvedValue(makeEnv({ hasPython: true }));
      const backend = await selector.selectBackend();
      expect(backend).toBe('native-python');
    });

    it('should respect forced backend', async () => {
      const backend = await selector.selectBackend({ forceBackend: 'pyodide' });
      expect(backend).toBe('pyodide');
    });

    it('should select cython for large files when hasCython', async () => {
      mockDetectEnvironment.mockResolvedValue(makeEnv({ hasCython: true }));
      const backend = await selector.selectBackend({ fileSize: 100_000_000 });
      expect(backend).toBe('cython');
    });

    it('should NOT select cython for small files even if hasCython', async () => {
      mockDetectEnvironment.mockResolvedValue(makeEnv({ hasCython: true, hasPython: true }));
      const backend = await selector.selectBackend({ fileSize: 1_000 });
      expect(backend).toBe('native-python');
    });

    // Cubre línea 51: forceBackend inválido → throw
    it('should throw for invalid forceBackend', async () => {
      await expect(
        selector.selectBackend({ forceBackend: 'invalid' as BackendType })
      ).rejects.toThrow("Backend 'invalid' no existe");
    });

    // Cubre líneas 71-73: isNode=true, hasPython=false → portable-python
    it('should select portable-python when no native python but isNode', async () => {
      mockDetectEnvironment.mockResolvedValue(makeEnv({
        hasPython: false, hasCython: false,
        isNode: true, isBrowser: false,
      }));
      const backend = await selector.selectBackend();
      expect(backend).toBe('portable-python');
    });

    // Cubre líneas 77-79: isBrowser=true → pyodide
    it('should select pyodide when isBrowser', async () => {
      mockDetectEnvironment.mockResolvedValue(makeEnv({
        hasPython: false, hasCython: false,
        isNode: false, isBrowser: true, hasWebAssembly: false,
      }));
      const backend = await selector.selectBackend();
      expect(backend).toBe('pyodide');
    });

    // Cubre líneas 77-79: hasWebAssembly=true → pyodide
    it('should select pyodide when hasWebAssembly and no python', async () => {
      mockDetectEnvironment.mockResolvedValue(makeEnv({
        hasPython: false, hasCython: false,
        isNode: false, isBrowser: false, hasWebAssembly: true,
      }));
      const backend = await selector.selectBackend();
      expect(backend).toBe('pyodide');
    });

    // Cubre línea 82: ningún entorno disponible → throw
    it('should throw when no backend is available', async () => {
      mockDetectEnvironment.mockResolvedValue(makeEnv({
        hasPython: false, hasCython: false,
        isNode: false, isBrowser: false, hasWebAssembly: false,
      }));
      await expect(selector.selectBackend()).rejects.toThrow(
        'No hay backend disponible en este entorno'
      );
    });
  });

  // ── getAvailableBackends ─────────────────────────────────────────────────────

  describe('getAvailableBackends', () => {

    it('should return info for all backends', async () => {
      const backends = await selector.getAvailableBackends();

      expect(backends).toHaveProperty('native-python');
      expect(backends).toHaveProperty('portable-python');
      expect(backends).toHaveProperty('pyodide');
      expect(backends).toHaveProperty('cython');
    });

    it('should include availability status', async () => {
      const backends = await selector.getAvailableBackends();

      for (const info of Object.values(backends)) {
        expect(info).toHaveProperty('available');
        expect(info).toHaveProperty('speed');
        expect(info).toHaveProperty('description');
        expect(info).toHaveProperty('limitations');
      }
    });
  });

  // ── setBackend ───────────────────────────────────────────────────────────────

  describe('setBackend', () => {

    it('should allow manual backend selection', () => {
      selector.setBackend('pyodide');
      expect(selector.getCurrentBackend()).toBe('pyodide');
    });

    it('should throw error for invalid backend', () => {
      expect(() => {
        selector.setBackend('invalid' as BackendType);
      }).toThrow("Backend 'invalid' no existe");
    });
  });

  // ── getCurrentBackend ────────────────────────────────────────────────────────

  describe('getCurrentBackend', () => {

    it('should return null initially', () => {
      expect(selector.getCurrentBackend()).toBeNull();
    });

    it('should return set backend after selection', () => {
      selector.setBackend('native-python');
      expect(selector.getCurrentBackend()).toBe('native-python');
    });
  });

  // ── convert ──────────────────────────────────────────────────────────────────

  describe('convert', () => {

    // Cubre línea 94: forceBackend en convert → sets currentBackend directamente
    it('should set currentBackend from forceBackend option in convert', async () => {
      // No ejecuta conversión real — verifica que forceBackend setea currentBackend
      // Mockea el backend subyacente para evitar llamada real
      const mockBackend = { convert: jest.fn().mockResolvedValue({ success: true, backend: 'pyodide' }) };
      (selector as any).backends.set('pyodide', mockBackend);

      await selector.convert('file.csv', { forceBackend: 'pyodide' });

      expect(selector.getCurrentBackend()).toBe('pyodide');
      expect(mockBackend.convert).toHaveBeenCalledWith('file.csv', { forceBackend: 'pyodide' });
    });

    // Cubre línea 95: !this.currentBackend → llama selectBackend
    it('should call selectBackend when no currentBackend is set', async () => {
      mockDetectEnvironment.mockResolvedValue(makeEnv({ hasPython: true }));

      const mockBackend = { convert: jest.fn().mockResolvedValue({ success: true, backend: 'native-python' }) };
      (selector as any).backends.set('native-python', mockBackend);

      await selector.convert('file.csv');

      expect(selector.getCurrentBackend()).toBe('native-python');
    });

    // Cubre líneas 101-102: !backend → throw 'no disponible'
    it('should throw when backend is not in the map', async () => {
      // Fuerza currentBackend a un valor inexistente en el Map
      (selector as any).currentBackend = 'nonexistent' as BackendType;
      (selector as any).backends.delete('nonexistent');

      await expect(selector.convert('file.csv')).rejects.toThrow('no disponible');
    });
  });
});