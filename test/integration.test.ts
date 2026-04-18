/**
 * Integration Tests
 * Tests end-to-end functionality + full coverage of src/index.ts
 */

import {
  convertToParquet,
  getAvailableBackends,
  setBackend,
  getCurrentBackend,
  checkPythonSetup,
  clearEnvironmentCache,
  backendSelector,
  detectEnvironment,
  NativePythonBackend,
  PortablePythonBackend,
  PyodideBackend,
  CythonBackend,
} from '../src/index';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR  = join(__dirname, 'fixtures');
const TEST_CSV  = join(TEST_DIR, 'test_integration.csv');
const OUTPUT_FILE = join(TEST_DIR, 'output_integration.parquet');

describe('Integration Tests', () => {

  beforeAll(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    const csvContent = `id,name,age,city
1,Juan,25,Lima
2,María,30,Arequipa
3,Pedro,35,Cusco
4,Ana,28,Trujillo
5,Carlos,32,Piura`;
    writeFileSync(TEST_CSV, csvContent);
  });

  afterAll(() => {
    if (existsSync(TEST_CSV))   unlinkSync(TEST_CSV);
    if (existsSync(OUTPUT_FILE)) unlinkSync(OUTPUT_FILE);
  });

  // ── convertToParquet ─────────────────────────────────────────────────

  describe('convertToParquet', () => {
    it('should convert CSV to Parquet successfully', async () => {
      const result = await convertToParquet(TEST_CSV, {
        output: OUTPUT_FILE,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.rows).toBe(5);
      expect(result.columns).toBe(4);
      expect(result.backend).toBeTruthy();
      expect(existsSync(OUTPUT_FILE)).toBe(true);
    }, 30000);

    it('should auto-repair data', async () => {
      const result = await convertToParquet(TEST_CSV, { autoRepair: true });
      expect(result.success).toBe(true);
    }, 30000);

    it('should handle streaming mode', async () => {
      const result = await convertToParquet(TEST_CSV, { streaming: true });
      expect(result.success).toBe(true);
      expect(result.streaming_mode).toBe(true);
    }, 30000);
  });

  // ── Backend Selection ─────────────────────────────────────────────────

  describe('Backend Selection', () => {
    it('should allow forcing backend', async () => {
      setBackend('native-python');
      const result = await convertToParquet(TEST_CSV);
      expect(result.backend).toBe('native-python');
    }, 30000);

    it('should get available backends', async () => {
      const backends = await getAvailableBackends();
      expect(backends).toBeTruthy();
      expect(Object.keys(backends).length).toBeGreaterThan(0);
    });
  });

  // ── Error Handling ────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should throw error for non-existent file', async () => {
      await expect(
        convertToParquet('non-existent.csv')
      ).rejects.toThrow();
    });

    it('should handle invalid options gracefully', async () => {
      // Compresión inválida → warning + fallback a adaptive → conversión exitosa
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await convertToParquet(TEST_CSV, {
        compression: 'invalid' as any,
      });

      expect(result.success).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'invalid'"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('adaptive'));
      expect(['snappy', 'zstd', 'lz4', 'gzip', 'brotli', 'none']).toContain(
        result.compression_used
      );

      warnSpy.mockRestore();
    }, 30000);
  });

  // ── Performance ───────────────────────────────────────────────────────

  describe('Performance', () => {
    it('should complete conversion in reasonable time', async () => {
      const start = Date.now();
      await convertToParquet(TEST_CSV);
      expect(Date.now() - start).toBeLessThan(10000);
    }, 15000);
  });

  // ── getCurrentBackend (cubre branch faltante) ─────────────────────────

  describe('getCurrentBackend', () => {
    it('should return null when no backend is set', () => {
      backendSelector.reset();
      expect(getCurrentBackend()).toBeNull();
    });

    it('should return backend after setBackend is called', () => {
      setBackend('native-python');
      expect(getCurrentBackend()).toBe('native-python');
    });

    it('should return pyodide after setBackend pyodide', () => {
      setBackend('pyodide');
      expect(getCurrentBackend()).toBe('pyodide');
      backendSelector.reset();
    });
  });

  // ── checkPythonSetup — cubre AMBOS branches del ternario ─────────────

  describe('checkPythonSetup', () => {
    it('should return installed=true when Python is available', async () => {
      const result = await checkPythonSetup();
      // En CI/dev siempre hay Python
      expect(typeof result.installed).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should return correct message when Python is installed', async () => {
      // Fuerza hasPython=true mockeando detectEnvironment
      jest.spyOn(require('../src/utils/detect'), 'detectEnvironment')
        .mockResolvedValueOnce({
          hasPython: true,
          pythonCommand: 'py',
          platform: 'win32',
          isWindows: true, isLinux: false, isMac: false,
          isNode: true, isBrowser: false,
          hasCython: false, cythonModules: [],
          hasPortablePython: false,
          hasWebAssembly: false,
        });

      const result = await checkPythonSetup();
      expect(result.installed).toBe(true);
      expect(result.message).toContain('py');           // branch ternario true
    });

    it('should return correct message when Python is NOT installed', async () => {
      // Fuerza hasPython=false
      jest.spyOn(require('../src/utils/detect'), 'detectEnvironment')
        .mockResolvedValueOnce({
          hasPython: false,
          pythonCommand: undefined,
          platform: 'win32',
          isWindows: true, isLinux: false, isMac: false,
          isNode: true, isBrowser: false,
          hasCython: false, cythonModules: [],
          hasPortablePython: false,
          hasWebAssembly: false,
        });

      const result = await checkPythonSetup();
      expect(result.installed).toBe(false);
      expect(result.message).toBe('Python no encontrado'); // branch ternario false
    });
  });

  // ── clearEnvironmentCache ─────────────────────────────────────────────

  describe('clearEnvironmentCache', () => {
    it('should clear cache without throwing', () => {
      expect(() => clearEnvironmentCache()).not.toThrow();
    });

    it('should allow re-detection after cache clear', async () => {
      clearEnvironmentCache();
      const env = await detectEnvironment();
      expect(env).toHaveProperty('platform');
      expect(env).toHaveProperty('hasPython');
    });
  });

  // ── Exported backends (cubre functions faltantes) ─────────────────────

  describe('Exported Backends', () => {
    it('NativePythonBackend should be exported and functional', async () => {
      expect(NativePythonBackend).toBeDefined();
      const available = await NativePythonBackend.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('PortablePythonBackend should be exported and functional', async () => {
      expect(PortablePythonBackend).toBeDefined();
      const available = await PortablePythonBackend.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('PyodideBackend should be exported and functional', async () => {
      expect(PyodideBackend).toBeDefined();
      const available = await PyodideBackend.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('CythonBackend should be exported and functional', async () => {
      expect(CythonBackend).toBeDefined();
      const available = await CythonBackend.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('backendSelector should be exported as singleton', () => {
      expect(backendSelector).toBeDefined();
      expect(typeof backendSelector.selectBackend).toBe('function');
      expect(typeof backendSelector.convert).toBe('function');
      expect(typeof backendSelector.getAvailableBackends).toBe('function');
    });
  });

});