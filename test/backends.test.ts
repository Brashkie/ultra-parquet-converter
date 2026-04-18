/**
 * Backend Tests — PortablePython, Pyodide, Cython con mocks completos
 */

import { PortablePythonBackend } from '../src/backends/portable-python';
import { PyodideBackend } from '../src/backends/pyodide-backend';
import { CythonBackend } from '../src/backends/cython-backend';
import { detectEnvironment } from '../src/utils/detect';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const TEST_CSV     = join(FIXTURES_DIR, 'test.csv');

// ─── Mock: child_process ───────────────────────────────────────────────────────

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

// ─── Mock: ../src/utils/download ──────────────────────────────────────────────

const mockEnsurePortablePython = jest.fn();
const mockGetDownloader        = jest.fn();

jest.mock('../src/utils/download', () => ({
  ensurePortablePython: (...args: any[]) => mockEnsurePortablePython(...args),
  getDownloader:        (...args: any[]) => mockGetDownloader(...args),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeSuccessSpawn(stdout: string) {
  return {
    stdout: { on: jest.fn((ev, cb) => { if (ev === 'data') cb(Buffer.from(stdout)); }) },
    stderr: { on: jest.fn() },
    on: jest.fn((ev, cb) => { if (ev === 'close') cb(0); }),
  };
}

function makeFailSpawn(code: number, stdout = '', stderr = 'error') {
  return {
    stdout: { on: jest.fn((ev, cb) => { if (ev === 'data') cb(Buffer.from(stdout)); }) },
    stderr: { on: jest.fn((ev, cb) => { if (ev === 'data') cb(Buffer.from(stderr)); }) },
    on: jest.fn((ev, cb) => { if (ev === 'close') cb(code); }),
  };
}

function makeErrorSpawn(msg = 'spawn error') {
  return {
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((ev, cb) => { if (ev === 'error') cb(new Error(msg)); }),
  };
}

const MOCK_RESULT = JSON.stringify({
  success: true, rows: 3, columns: 4,
  input_size: 100, output_size: 50,
  compression_ratio: 50, file_type: 'csv',
  elapsed_time: 0.5, chunks_processed: 0,
  errors_fixed: 0, columns_removed: 0,
  streaming_mode: false, parallel_workers: 1,
  compression_used: 'snappy',
});

// ─── setup/teardown ────────────────────────────────────────────────────────────

beforeAll(() => {
  if (!existsSync(FIXTURES_DIR)) mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(TEST_CSV, `id,name,age,city\n1,Juan,25,Lima\n2,Maria,30,Cusco\n3,Pedro,35,Arequipa`);
});

afterAll(() => {
  if (existsSync(TEST_CSV)) unlinkSync(TEST_CSV);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSpawn.mockReturnValue(makeSuccessSpawn('Python 3.11.0'));
});

// ══════════════════════════════════════════════════════════════════════════════
// PortablePythonBackend
// ══════════════════════════════════════════════════════════════════════════════

describe('PortablePythonBackend', () => {

  describe('static methods', () => {
    it('isAvailable: returns true when installed', async () => {
      mockGetDownloader.mockReturnValue({ isInstalled: () => true });
      expect(await PortablePythonBackend.isAvailable()).toBe(true);
    });

    it('isAvailable: returns false when not installed', async () => {
      mockGetDownloader.mockReturnValue({ isInstalled: () => false });
      expect(await PortablePythonBackend.isAvailable()).toBe(false);
    });

    it('getInfo: returns info from downloader', async () => {
      const mockInfo = { installed: true, path: '/fake/python', version: '3.11.0' };
      mockGetDownloader.mockReturnValue({ isInstalled: () => true, getInfo: async () => mockInfo });
      expect(await PortablePythonBackend.getInfo()).toEqual(mockInfo);
    });

    it('getInfo: returns not-installed info', async () => {
      const mockInfo = { installed: false, path: null, version: null };
      mockGetDownloader.mockReturnValue({ isInstalled: () => false, getInfo: async () => mockInfo });
      const info = await PortablePythonBackend.getInfo();
      expect(info.installed).toBe(false);
    });
  });

  describe('convert — archivo no existe', () => {
    it('should throw if input file does not exist', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python');
      const backend = new PortablePythonBackend();
      await expect(backend.convert('no-existe.csv')).rejects.toThrow('no-existe.csv');
    });
  });

  describe('convert — Python portable disponible (mock)', () => {
    it('should convert successfully', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));

      const backend = new PortablePythonBackend();
      const result = await backend.convert(TEST_CSV);
      expect(result.success).toBe(true);
      expect(result.backend).toBe('portable-python');
    });

    it('should convert with output option', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));
      const backend = new PortablePythonBackend();
      expect((await backend.convert(TEST_CSV, { output: 'out.parquet' })).success).toBe(true);
    });

    it('should convert with verbose option', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));
      const backend = new PortablePythonBackend();
      expect((await backend.convert(TEST_CSV, { verbose: true })).success).toBe(true);
    });

    it('should convert with streaming option', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));
      const backend = new PortablePythonBackend();
      expect((await backend.convert(TEST_CSV, { streaming: true })).success).toBe(true);
    });

    it('should convert with autoRepair=false', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));
      const backend = new PortablePythonBackend();
      expect((await backend.convert(TEST_CSV, { autoRepair: false })).success).toBe(true);
    });

    it('should convert with autoNormalize=false', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));
      const backend = new PortablePythonBackend();
      expect((await backend.convert(TEST_CSV, { autoNormalize: false })).success).toBe(true);
    });

    it('should reuse pythonPath on second call (cache)', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));
      const backend = new PortablePythonBackend();
      await backend.convert(TEST_CSV);
      await backend.convert(TEST_CSV);
      expect(mockEnsurePortablePython).toHaveBeenCalledTimes(1);
    });
  });

  describe('convert — errores del proceso', () => {
    it('should reject on non-zero exit code', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeFailSpawn(1, '', 'some error'));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow();
    });

    it('should reject with JSON error message', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      const errorJson = JSON.stringify({ success: false, error: 'Python falló' });
      mockSpawn.mockReturnValue(makeFailSpawn(1, errorJson));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow();
    });

    it('should reject on spawn error event', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeErrorSpawn('ENOENT'));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('ENOENT');
    });

    it('should reject when result has success=false', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn(
        JSON.stringify({ success: false, error: 'Conversión falló' })
      ));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Conversión falló');
    });

    it('should reject on invalid JSON stdout', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn('not valid json {{'));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow();
    });

    it('should reject if ensurePortablePython throws', async () => {
      mockEnsurePortablePython.mockRejectedValue(new Error('Descarga falló'));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Descarga falló');
    });
  });

  describe('convert — branches internos', () => {

    it('should reject "Portable Python not initialized" when pythonPath is null after ensure', async () => {
      mockEnsurePortablePython.mockResolvedValue(null as any);
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Portable Python not initialized');
    });

    it('should use stderr when stdout is not JSON on non-zero exit', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeFailSpawn(1, 'basura no json', 'stderr msg'));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('stderr msg');
    });

    it('should use stdout as fallback when stderr is empty and stdout not JSON on fail', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeFailSpawn(1, 'stdout fallback msg', ''));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('stdout fallback msg');
    });

    it('should reject on non-zero exit with non-JSON stdout and empty stderr', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeFailSpawn(1, '{bad json', ''));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('{bad json');
    });

    it('should use "Error desconocido" when success=false and no error field', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn(JSON.stringify({ success: false })));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Error desconocido');
    });

    it('should reject with "Error al parsear" when stdout is invalid JSON on success code', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeSuccessSpawn('invalid {{ json'));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Error al parsear');
    });

    it('should reject with "Error Python" on spawn process error event', async () => {
      mockEnsurePortablePython.mockResolvedValue('/fake/python.exe');
      mockSpawn.mockReturnValue(makeErrorSpawn('EACCES permission denied'));
      const backend = new PortablePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Error Python: EACCES permission denied');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PyodideBackend
// ══════════════════════════════════════════════════════════════════════════════

describe('PyodideBackend', () => {

  // Helper: crea mock de instancia Pyodide
  function makeMockPyodide(resultJson: string) {
    return {
      loadPackage: jest.fn().mockResolvedValue(undefined),
      runPythonAsync: jest.fn().mockResolvedValue(resultJson),
    };
  }

  // Helper: crea loader mock que resuelve con una instancia Pyodide
  function makeLoader(pyodide: ReturnType<typeof makeMockPyodide>) {
    return jest.fn().mockResolvedValue({ loadPyodide: jest.fn().mockResolvedValue(pyodide) });
  }

  // Helper: resultado exitoso de Python
  function makePyResult(overrides = {}) {
    return JSON.stringify({
      success: true, rows: 2, columns: 2,
      input_size: 20, output_size: 10,
      compression_ratio: 50, file_type: 'auto-detected',
      parquet_bytes: [1, 2, 3],
      ...overrides,
    });
  }

  // Helper: logger silencioso para tests
  function makeSilentLogger() {
    return {
      info:  jest.fn(),
      warn:  jest.fn(),
      error: jest.fn(),
    };
  }

  // ── isAvailable ─────────────────────────────────────────────────────────────

  describe('isAvailable', () => {

    it('returns boolean without loader', async () => {
      expect(typeof await PyodideBackend.isAvailable()).toBe('boolean');
    });

    it('returns true when loader resolves', async () => {
      const loader = jest.fn().mockResolvedValue({});
      expect(await PyodideBackend.isAvailable(loader)).toBe(true);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('returns false when loader throws', async () => {
      const failingLoader = jest.fn().mockRejectedValue(new Error('Not found'));
      expect(await PyodideBackend.isAvailable(failingLoader)).toBe(false);
    });

    it('returns false when WebAssembly is not available', async () => {
      const origWA = (globalThis as any).WebAssembly;
      delete (globalThis as any).WebAssembly;
      expect(await PyodideBackend.isAvailable()).toBe(false);
      (globalThis as any).WebAssembly = origWA;
    });
  });

  // ── initialize ──────────────────────────────────────────────────────────────

  describe('initialize', () => {

    it('should initialize only once (idempotent)', async () => {
      const pyodide = makeMockPyodide('{}');
      const loader  = makeLoader(pyodide);

      const backend = new PyodideBackend(loader);
      await backend.initialize();
      await backend.initialize();

      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent initialize calls (race condition)', async () => {
      const pyodide = makeMockPyodide('{}');
      const loader  = makeLoader(pyodide);

      const backend = new PyodideBackend(loader);

      await Promise.all([
        backend.initialize(),
        backend.initialize(),
        backend.initialize(),
      ]);

      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should load pandas, pyarrow, numpy', async () => {
      const pyodide = makeMockPyodide('{}');
      const loader  = makeLoader(pyodide);

      const backend = new PyodideBackend(loader);
      await backend.initialize();

      expect(pyodide.loadPackage).toHaveBeenCalledWith(['pandas', 'pyarrow', 'numpy']);
    });

    it('should throw when loader fails', async () => {
      const failingLoader = jest.fn().mockRejectedValue(new Error('Cannot load'));
      const backend = new PyodideBackend(failingLoader);
      await expect(backend.initialize()).rejects.toThrow('Cannot load');
    });

    // Cubre: initPromise reset en fallo → permite reintento
    it('should allow retry after failed initialization', async () => {
      let callCount = 0;
      const flakyLoader = jest.fn().mockImplementation(() => {
        callCount++;
        const pyodide = makeMockPyodide('{}');
        if (callCount === 1) {
          return Promise.resolve({
            loadPyodide: jest.fn().mockRejectedValue(new Error('Transient failure')),
          });
        }
        return Promise.resolve({
          loadPyodide: jest.fn().mockResolvedValue(pyodide),
        });
      });

      const backend = new PyodideBackend(flakyLoader);

      await expect(backend.initialize()).rejects.toThrow('Transient failure');
      await expect(backend.initialize()).resolves.toBeUndefined();

      expect(flakyLoader).toHaveBeenCalledTimes(2);
    });

    // Cubre: logger.info en las 3 fases de _doInitialize
    it('should call logger during initialization', async () => {
      const pyodide = makeMockPyodide('{}');
      const loader  = makeLoader(pyodide);
      const logger  = makeSilentLogger();

      const backend = new PyodideBackend(loader, logger);
      await backend.initialize();

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Cargando Pyodide'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Instalando paquetes'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Pyodide listo'));
    });

    it('should not call logger on second initialize (already initialized)', async () => {
      const pyodide = makeMockPyodide('{}');
      const loader  = makeLoader(pyodide);
      const logger  = makeSilentLogger();

      const backend = new PyodideBackend(loader, logger);
      await backend.initialize();

      logger.info.mockClear();
      await backend.initialize();

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  // ── convert — string input ──────────────────────────────────────────────────

  describe('convert — string input', () => {

    it('should convert CSV string successfully', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = new PyodideBackend(makeLoader(pyodide));

      const result = await backend.convert('id,name\n1,Juan\n2,Maria');

      expect(result.success).toBe(true);
      expect(result.backend).toBe('pyodide');
      expect(result.rows).toBe(2);
      expect(Array.isArray(result.limitations)).toBe(true);
    });

    it('should include all limitations', async () => {
      const pyodide = makeMockPyodide(makePyResult({ rows: 1, columns: 1 }));
      const backend = new PyodideBackend(makeLoader(pyodide));

      const result = await backend.convert('a\n1');

      expect(result.limitations).toContain('Pyodide es 10-50x más lento que Python nativo');
      expect(result.limitations).toContain('No puede leer archivos del filesystem');
      expect(result.limitations).toContain('Funciona solo en navegador/Node.js con WebAssembly');
    });

    it('should NOT include repair code when autoRepair=false', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = new PyodideBackend(makeLoader(pyodide));

      await backend.convert('id,name\n1,Juan', { autoRepair: false });

      const code = pyodide.runPythonAsync.mock.calls[0][0] as string;
      expect(code).not.toContain('dropna');
      expect(code).not.toContain('drop_duplicates');
    });

    it('should include repair code when autoRepair=true (default)', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = new PyodideBackend(makeLoader(pyodide));

      await backend.convert('id,name\n1,Juan', { autoRepair: true });

      const code = pyodide.runPythonAsync.mock.calls[0][0] as string;
      expect(code).toContain('dropna');
      expect(code).toContain('drop_duplicates');
    });

    it('should include repair code by default (autoRepair undefined)', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = new PyodideBackend(makeLoader(pyodide));

      await backend.convert('id,name\n1,Juan');

      const code = pyodide.runPythonAsync.mock.calls[0][0] as string;
      expect(code).toContain('dropna');
    });

    it('should correctly escape special characters via JSON.stringify', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = new PyodideBackend(makeLoader(pyodide));

      const specialData = 'col1,col2\n"quoted",back\\slash\nUnicode:,\u00f1\u00e9\u00e0';
      await backend.convert(specialData);

      const code = pyodide.runPythonAsync.mock.calls[0][0] as string;
      expect(code).toContain('data_str');
      expect(() => {
        new Function('"use strict"; return `' + code.replace(/`/g, '\\`') + '`');
      }).not.toThrow();
    });

    it('should throw when Python result has success=false', async () => {
      const pyodide = makeMockPyodide(
        JSON.stringify({ success: false, error: 'Python falló internamente' })
      );
      const backend = new PyodideBackend(makeLoader(pyodide));

      await expect(backend.convert('data')).rejects.toThrow('Python falló internamente');
    });

    it('should throw with generic message when success=false and no error field', async () => {
      const pyodide = makeMockPyodide(JSON.stringify({ success: false }));
      const backend = new PyodideBackend(makeLoader(pyodide));

      await expect(backend.convert('data')).rejects.toThrow('Error desconocido en Pyodide');
    });

    // Cubre: _result_json pattern en el código Python generado
    it('should generate Python code with _result_json pattern', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = new PyodideBackend(makeLoader(pyodide));

      await backend.convert('id,name\n1,Juan');

      const code = pyodide.runPythonAsync.mock.calls[0][0] as string;
      expect(code).toContain('_result');
      expect(code).toContain('json.dumps');
      expect(
        code.includes('_result_json = json.dumps(_result)') ||
        code.includes('json.dumps(_result)')
      ).toBe(true);
    });
  });

  // ── convert — ArrayBuffer input ─────────────────────────────────────────────

  describe('convert — ArrayBuffer input', () => {

    it('should convert ArrayBuffer successfully', async () => {
      const pyodide = makeMockPyodide(makePyResult({ file_type: 'binary', rows: 5 }));
      const backend = new PyodideBackend(makeLoader(pyodide));

      const result = await backend.convert(new ArrayBuffer(16));

      expect(result.success).toBe(true);
      expect(result.backend).toBe('pyodide');
      expect(result.rows).toBe(5);
    });

    // Cubre: generateBinaryConversionCode — buf.seek(0) + json.dumps pattern
    it('should generate binary code with buf.seek(0) for fallback', async () => {
      const pyodide = makeMockPyodide(makePyResult({ file_type: 'binary' }));
      const backend = new PyodideBackend(makeLoader(pyodide));

      await backend.convert(new ArrayBuffer(8));

      const code = pyodide.runPythonAsync.mock.calls[0][0] as string;
      expect(code).toContain('input_bytes');
      expect(code).toContain('read_excel');
      expect(code).toContain('buffer.seek(0)');
      expect(code).toContain('read_parquet');
      expect(code).toContain('json.dumps');
    });
  });

  // ── convert — errores ───────────────────────────────────────────────────────

  describe('convert — errores', () => {

    it('should wrap error when runPythonAsync throws', async () => {
      const pyodide = {
        loadPackage: jest.fn().mockResolvedValue(undefined),
        runPythonAsync: jest.fn().mockRejectedValue(new Error('Python error')),
      };
      const backend = new PyodideBackend(makeLoader(pyodide));

      await expect(backend.convert('data')).rejects.toThrow('Pyodide conversion failed: Python error');
    });

    it('should not double-wrap error message', async () => {
      const pyodide = {
        loadPackage: jest.fn().mockResolvedValue(undefined),
        runPythonAsync: jest.fn().mockRejectedValue(
          new Error('Pyodide conversion failed: already wrapped')
        ),
      };
      const backend = new PyodideBackend(makeLoader(pyodide));

      const err = await backend.convert('data').catch(e => e);
      expect(err.message).toBe('Pyodide conversion failed: already wrapped');
    });

    // Cubre línea 154: catch del JSON.parse defensivo → 'Pyodide returned invalid JSON'
    it('should throw descriptive error when Pyodide returns invalid JSON', async () => {
      const pyodide = {
        loadPackage: jest.fn().mockResolvedValue(undefined),
        runPythonAsync: jest.fn().mockResolvedValue('not valid json at all <<<>>>'),
      };
      const backend = new PyodideBackend(makeLoader(pyodide));

      const err = await backend.convert('data').catch(e => e);
      expect(err.message).toContain('invalid JSON');
    });

    it('should throw when loader fails during convert', async () => {
      const failingLoader = jest.fn().mockRejectedValue(new Error('Failed to load'));
      const backend = new PyodideBackend(failingLoader);

      await expect(backend.convert('data')).rejects.toThrow();
    });

    // Cubre línea 136-137: !this.pyodide → 'Pyodide no inicializado correctamente'
    it('should throw "Pyodide no inicializado" when pyodide is null after init', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = new PyodideBackend(makeLoader(pyodide));

      await backend.initialize();
      // Fuerza pyodide a null después de init exitoso (edge case defensivo)
      (backend as any).pyodide = null;

      await expect(backend.convert('data')).rejects.toThrow('Pyodide no inicializado correctamente');
    });
  });

  // ── logger inyectable ────────────────────────────────────────────────────────

  describe('logger inyectable', () => {

    it('should use custom logger instead of console', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const logger  = makeSilentLogger();
      const backend = new PyodideBackend(makeLoader(pyodide), logger);

      await backend.convert('id,name\n1,Juan');

      expect(logger.info).toHaveBeenCalled();
    });

    it('should not call console.log when custom logger is provided', async () => {
      const pyodide    = makeMockPyodide(makePyResult());
      const logger     = makeSilentLogger();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const backend = new PyodideBackend(makeLoader(pyodide), logger);
      await backend.convert('id,name\n1,Juan');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    // Cubre líneas 65-66: console.warn y console.error del defaultLogger
    it('should expose warn and error on defaultLogger', () => {
      const backend = new PyodideBackend(); // usa defaultLogger
      const logger  = (backend as any).logger;

      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');

      // Verifica que llaman a console.warn/error respectivamente
      const warnSpy  = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      logger.warn('test warn');
      logger.error('test error');

      expect(warnSpy).toHaveBeenCalledWith('test warn');
      expect(errorSpy).toHaveBeenCalledWith('test error');

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CythonBackend
// ══════════════════════════════════════════════════════════════════════════════

describe('CythonBackend', () => {

  describe('getModulesInfo', () => {
    it('returns valid structure', () => {
      const info = CythonBackend.getModulesInfo();
      expect(info).toHaveProperty('available');
      expect(info).toHaveProperty('modules');
      expect(Array.isArray(info.modules)).toBe(true);
      expect(info.available).toBe(info.modules.length >= 2);
    });
  });

  describe('isAvailable', () => {
    it('returns boolean', async () => {
      expect(typeof await CythonBackend.isAvailable()).toBe('boolean');
    });

    it('returns false when all Python spawns fail', async () => {
      mockSpawn.mockReturnValue(makeFailSpawn(1));
      expect(await CythonBackend.isAvailable()).toBe(false);
    });
  });

  describe('convert — sin módulos compilados', () => {
    it('should throw when Python not found', async () => {
      mockSpawn.mockReturnValue(makeFailSpawn(1));
      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Python no encontrado');
    });

    it('should throw when Python found but no compiled modules', async () => {
      mockSpawn.mockReturnValue(makeSuccessSpawn('Python 3.11.0'));
      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow(
        /Módulos Cython no compilados|Respuesta inválida|Script Python no encontrado/
      );
    });

    it('should throw "Módulos Cython no compilados" when dir exists but empty', async () => {
      const fsMod = require('fs');
      jest.spyOn(fsMod, 'existsSync').mockReturnValue(true);
      jest.spyOn(fsMod, 'readdirSync').mockReturnValue([]);
      mockSpawn.mockReturnValue(makeSuccessSpawn('Python 3.11.0'));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Módulos Cython no compilados');
      jest.restoreAllMocks();
    });

    it('should throw "Script Python no encontrado" when script missing', async () => {
      const fsMod = require('fs');
      const origExists = fsMod.existsSync.bind(fsMod);

      jest.spyOn(fsMod, 'existsSync').mockImplementation((p: unknown) => {
        const s = String(p);
        if (s.includes('cython') && !s.includes('.py')) return true;
        if (s.includes('converter_advanced.py')) return false;
        return origExists(p);
      });
      jest.spyOn(fsMod, 'readdirSync').mockReturnValue([
        'fast_csv.cp311-win_amd64.pyd',
        'fast_parser.cp311-win_amd64.pyd',
      ]);
      mockSpawn.mockReturnValue(makeSuccessSpawn('Python 3.11.0'));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Script Python no encontrado');
      jest.restoreAllMocks();
    });

    it('should return empty modules when cython dir does not exist', () => {
      const fsMod = require('fs');
      jest.spyOn(fsMod, 'existsSync').mockReturnValue(false);
      const info = CythonBackend.getModulesInfo();
      expect(info.available).toBe(false);
      expect(info.modules).toHaveLength(0);
      jest.restoreAllMocks();
    });

    it('should throw "Python no encontrado" when spawn errors on all candidates', async () => {
      mockSpawn.mockReturnValue(makeErrorSpawn('ENOENT'));
      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Python no encontrado');
    });
  });

  describe('convert — con módulos compilados (mock fs)', () => {

    function mockCythonDir() {
      const fsMod = require('fs');
      const origExists  = fsMod.existsSync.bind(fsMod);
      const origReaddir = fsMod.readdirSync.bind(fsMod);

      jest.spyOn(fsMod, 'existsSync').mockImplementation((p: unknown) => {
        const s = String(p);
        if (s.includes('cython') && !s.includes('.py')) return true;
        return origExists(p);
      });

      jest.spyOn(fsMod, 'readdirSync').mockImplementation((p: unknown) => {
        const s = String(p);
        if (s.includes('cython')) {
          return ['fast_csv.cp311-win_amd64.pyd', 'fast_parser.cp311-win_amd64.pyd'];
        }
        return origReaddir(p);
      });
    }

    afterEach(() => jest.restoreAllMocks());

    it('should convert successfully', async () => {
      mockCythonDir();
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeSuccessSpawn(MOCK_RESULT));

      const backend = new CythonBackend();
      const result = await backend.convert(TEST_CSV);
      expect(result.success).toBe(true);
      expect(result.backend).toBe('cython');
    });

    it('should pass all options to Python args', async () => {
      mockCythonDir();
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeSuccessSpawn(MOCK_RESULT));

      const backend = new CythonBackend();
      await backend.convert(TEST_CSV, {
        verbose: true, streaming: true,
        autoRepair: false, autoNormalize: false,
        output: 'out.parquet',
      });

      const spawnArgs = mockSpawn.mock.calls[1][1] as string[];
      expect(spawnArgs).toContain('-v');
      expect(spawnArgs).toContain('--streaming');
      expect(spawnArgs).toContain('--no-repair');
      expect(spawnArgs).toContain('--no-normalize');
      expect(spawnArgs).toContain('-o');
    });

    it('should reject on spawn error event', async () => {
      mockCythonDir();
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeErrorSpawn('ENOENT'));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('ENOENT');
    });

    it('should reject on non-zero exit with JSON error field', async () => {
      mockCythonDir();
      const errorJson = JSON.stringify({ error: 'Script falló' });
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeFailSpawn(1, errorJson));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Script falló');
    });

    it('should use "Error código" fallback when JSON has no error field', async () => {
      mockCythonDir();
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeFailSpawn(1, JSON.stringify({ noError: true })));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow(/Error código/);
    });

    it('should use "Error código" when stdout is empty', async () => {
      mockCythonDir();
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeFailSpawn(1, '', 'some stderr'));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow(/Error código/);
    });

    it('should use stderr fallback when stdout is not valid JSON on fail', async () => {
      mockCythonDir();
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeFailSpawn(1, 'not json at all', 'stderr fallback msg'));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('stderr fallback msg');
    });

    it('should use stdout as fallback when stderr is empty and stdout invalid JSON', async () => {
      mockCythonDir();
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeFailSpawn(1, '{invalid json', ''));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('{invalid json');
    });

    it('should use "Error desconocido" when stdout is whitespace-only and stderr is empty', async () => {
      mockCythonDir();
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeFailSpawn(1, '   ', ''));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow(/Error código/);
    });

    it('should reject on invalid JSON response with code 0', async () => {
      mockCythonDir();
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeSuccessSpawn('invalid {{ json'));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Respuesta inválida');
    });

    it('should reject with "No se pudo ejecutar Python" on process error', async () => {
      mockCythonDir();
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn('Python 3.11.0'))
        .mockReturnValueOnce(makeErrorSpawn('spawn EACCES'));

      const backend = new CythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('No se pudo ejecutar Python');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Environment Detection
// ══════════════════════════════════════════════════════════════════════════════

describe('Environment Detection', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('should detect environment correctly', async () => {
    const env = await detectEnvironment();
    expect(env).toHaveProperty('platform');
    expect(env).toHaveProperty('isNode');
    expect(env).toHaveProperty('isBrowser');
    expect(env).toHaveProperty('hasPython');
    expect(env).toHaveProperty('hasCython');
    expect(env).toHaveProperty('hasWebAssembly');
  });

  it('should identify Node.js environment', async () => {
    const env = await detectEnvironment();
    expect(env.isNode).toBe(true);
    expect(env.isBrowser).toBe(false);
  });

  it('should detect valid platform', async () => {
    const env = await detectEnvironment();
    const valid = ['win32', 'linux', 'darwin', 'freebsd', 'openbsd', 'sunos', 'aix'];
    expect(valid).toContain(env.platform);
  });

  it('should detect Python if available', async () => {
    const env = await detectEnvironment();
    if (env.hasPython) {
      expect(env.pythonCommand).toBeTruthy();
      expect(env.pythonVersion).toBeTruthy();
    }
  });

  it('should detect WebAssembly', async () => {
    const env = await detectEnvironment();
    expect(typeof env.hasWebAssembly).toBe('boolean');
  });
});