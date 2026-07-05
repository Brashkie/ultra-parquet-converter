/**
 * Backend Tests — PortablePython, Pyodide, Cython con mocks completos
 */

import { PortablePythonBackend } from '../src/backends/portable-python';
import { PyodideBackend } from '../src/backends/pyodide-backend';
import { CythonBackend } from '../src/backends/cython-backend';
import { detectEnvironment } from '../src/utils/detect';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import * as fs from 'fs';
import * as runtime from '../src/utils/runtime';
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

  // Mock de instancia Pyodide (incluye globals.set y toPy del nuevo diseño)
  function makeMockPyodide(resultJson: string) {
    return {
      loadPackage: jest.fn().mockResolvedValue(undefined),
      runPythonAsync: jest.fn().mockResolvedValue(resultJson),
      runPython: jest.fn(),
      toPy: jest.fn((x: unknown) => x),
      globals: { set: jest.fn() },
    };
  }

  function makeLoader(pyodide: ReturnType<typeof makeMockPyodide>) {
    return jest.fn().mockResolvedValue({ loadPyodide: jest.fn().mockResolvedValue(pyodide) });
  }

  function makePyResult(overrides = {}) {
    return JSON.stringify({
      success: true, rows: 2, columns: 2,
      input_size: 20, output_size: 10,
      compression_ratio: 50, compression_used: 'snappy',
      file_type: 'csv', parquet_bytes: [1, 2, 3],
      ...overrides,
    });
  }

  function makeSilentLogger() {
    return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  }

  // Construye un backend con dependencias inyectadas (loader/logger/sourceLoader)
  function makeBackend(
    pyodide: ReturnType<typeof makeMockPyodide>,
    logger = makeSilentLogger(),
  ) {
    return new PyodideBackend({
      loader: makeLoader(pyodide),
      logger,
      sourceLoader: async () => 'PY_SOURCE',
      indexURL: 'test://local/',
    });
  }

  // La primera llamada a runPythonAsync es la fuente .py; la segunda es upc_convert
  const convertCall = (pyodide: ReturnType<typeof makeMockPyodide>) =>
    pyodide.runPythonAsync.mock.calls[1][0] as string;

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

    it('instance isAvailable delegates to static', async () => {
      const backend = makeBackend(makeMockPyodide('{}'));
      expect(typeof await backend.isAvailable()).toBe('boolean');
    });
  });

  // ── initialize ──────────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('should initialize only once (idempotent)', async () => {
      const pyodide = makeMockPyodide('{}');
      const loader = makeLoader(pyodide);
      const backend = new PyodideBackend({ loader, logger: makeSilentLogger(), sourceLoader: async () => 'S' });
      await backend.initialize();
      await backend.initialize();
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent initialize calls (race condition)', async () => {
      const pyodide = makeMockPyodide('{}');
      const loader = makeLoader(pyodide);
      const backend = new PyodideBackend({ loader, logger: makeSilentLogger(), sourceLoader: async () => 'S' });
      await Promise.all([backend.initialize(), backend.initialize(), backend.initialize()]);
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('should load pandas, pyarrow, numpy', async () => {
      const pyodide = makeMockPyodide('{}');
      const backend = makeBackend(pyodide);
      await backend.initialize();
      expect(pyodide.loadPackage).toHaveBeenCalledWith(['pandas', 'pyarrow', 'numpy']);
    });

    it('should throw when loader fails', async () => {
      const backend = new PyodideBackend({
        loader: jest.fn().mockRejectedValue(new Error('Cannot load')),
        logger: makeSilentLogger(),
      });
      await expect(backend.initialize()).rejects.toThrow('Cannot load');
    });

    it('should allow retry after failed initialization', async () => {
      const pyodide = makeMockPyodide('{}');
      const loadPyodide = jest.fn()
        .mockRejectedValueOnce(new Error('Transient failure'))
        .mockResolvedValueOnce(pyodide);
      const loader = jest.fn().mockResolvedValue({ loadPyodide });
      const backend = new PyodideBackend({ loader, logger: makeSilentLogger(), sourceLoader: async () => 'S' });

      await expect(backend.initialize()).rejects.toThrow('Transient failure');
      await expect(backend.initialize()).resolves.toBeUndefined();
    });

    it('should call logger during initialization', async () => {
      const logger = makeSilentLogger();
      const backend = makeBackend(makeMockPyodide('{}'), logger);
      await backend.initialize();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Cargando Pyodide'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Instalando paquetes'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Pyodide listo'));
    });

    it('should not call logger on second initialize (already initialized)', async () => {
      const logger = makeSilentLogger();
      const backend = makeBackend(makeMockPyodide('{}'), logger);
      await backend.initialize();
      (logger.info as jest.Mock).mockClear();
      await backend.initialize();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  // ── convertData — texto ─────────────────────────────────────────────────────

  describe('convertData — string input', () => {
    it('should convert CSV string successfully', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = makeBackend(pyodide);
      const result = await backend.convertData('id,name\n1,Juan\n2,Maria');
      expect(result.success).toBe(true);
      expect(result.backend).toBe('pyodide');
      expect(result.rows).toBe(2);
      expect(Array.isArray(result.limitations)).toBe(true);
    });

    it('should include all limitations', async () => {
      const pyodide = makeMockPyodide(makePyResult({ rows: 1, columns: 1 }));
      const backend = makeBackend(pyodide);
      const result = await backend.convertData('a\n1');
      expect(result.limitations).toHaveLength(3);
    });

    it('should set text global (not interpolate data into source)', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = makeBackend(pyodide);
      await backend.convertData('id,name\n1,Juan');
      expect(pyodide.globals.set).toHaveBeenCalledWith('_upc_text', 'id,name\n1,Juan');
    });

    it('should pass autoRepair=False when disabled', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = makeBackend(pyodide);
      await backend.convertData('id,name\n1,Juan', { autoRepair: false });
      expect(convertCall(pyodide)).toContain('False');
    });

    it('should pass autoRepair=True by default', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = makeBackend(pyodide);
      await backend.convertData('id,name\n1,Juan');
      expect(convertCall(pyodide)).toContain('True');
    });

    it('should call upc_convert with text mode and compression', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = makeBackend(pyodide);
      await backend.convertData('id,name\n1,Juan', { compression: 'gzip' });
      const call = convertCall(pyodide);
      expect(call).toContain('upc_convert');
      expect(call).toContain('"text"');
      expect(call).toContain('gzip');
    });

    it('should throw when Python result has success=false', async () => {
      const pyodide = makeMockPyodide(JSON.stringify({ success: false, error: 'Python falló internamente' }));
      const backend = makeBackend(pyodide);
      await expect(backend.convertData('data')).rejects.toThrow('Python falló internamente');
    });

    it('should throw with generic message when success=false and no error field', async () => {
      const pyodide = makeMockPyodide(JSON.stringify({ success: false }));
      const backend = makeBackend(pyodide);
      await expect(backend.convertData('data')).rejects.toThrow('Error desconocido en Pyodide');
    });

    it('should throw descriptive error when Pyodide returns invalid JSON', async () => {
      const pyodide = makeMockPyodide('not json at all');
      const backend = makeBackend(pyodide);
      await expect(backend.convertData('data')).rejects.toThrow('Pyodide returned invalid JSON');
    });

    it('should wrap error when runPythonAsync throws', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      pyodide.runPythonAsync = jest.fn()
        .mockResolvedValueOnce('PY_SOURCE')
        .mockRejectedValueOnce(new Error('boom'));
      const backend = makeBackend(pyodide);
      await expect(backend.convertData('data')).rejects.toThrow('Pyodide conversion failed: boom');
    });

    it('should not double-wrap error message', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      pyodide.runPythonAsync = jest.fn()
        .mockResolvedValueOnce('PY_SOURCE')
        .mockRejectedValueOnce(new Error('Pyodide conversion failed: original'));
      const backend = makeBackend(pyodide);
      await expect(backend.convertData('data')).rejects.toThrow('Pyodide conversion failed: original');
    });

    it('should throw "Pyodide no inicializado" when pyodide is null after init', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = makeBackend(pyodide);
      await backend.initialize();
      (backend as any).pyodide = null;
      await expect(backend.convertData('data')).rejects.toThrow('Pyodide no inicializado');
    });
  });

  // ── convertData — binario ───────────────────────────────────────────────────

  describe('convertData — ArrayBuffer input', () => {
    it('should convert ArrayBuffer successfully', async () => {
      const pyodide = makeMockPyodide(makePyResult({ file_type: 'binary', rows: 5 }));
      const backend = makeBackend(pyodide);
      const result = await backend.convertData(new ArrayBuffer(16));
      expect(result.success).toBe(true);
      expect(result.backend).toBe('pyodide');
      expect(result.rows).toBe(5);
    });

    it('should set binary global via toPy (no giant bytes string)', async () => {
      const pyodide = makeMockPyodide(makePyResult({ file_type: 'binary' }));
      const backend = makeBackend(pyodide);
      await backend.convertData(new ArrayBuffer(4));
      expect(pyodide.toPy).toHaveBeenCalled();
      expect(pyodide.globals.set).toHaveBeenCalledWith('_upc_bytes', expect.anything());
      expect(convertCall(pyodide)).toContain('"binary"');
    });
  });

  // ── convert — API de archivo (Node) ─────────────────────────────────────────

  describe('convert — file API (Node)', () => {
    const TMP_CSV = join(FIXTURES_DIR, 'pyodide-input.csv');
    const TMP_OUT = join(FIXTURES_DIR, 'pyodide-input.parquet');

    beforeEach(() => writeFileSync(TMP_CSV, 'id,name\n1,Juan\n2,Maria'));
    afterEach(() => {
      if (existsSync(TMP_CSV)) unlinkSync(TMP_CSV);
      if (existsSync(TMP_OUT)) unlinkSync(TMP_OUT);
    });

    it('should read a file, write the parquet and set input/output paths', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = makeBackend(pyodide);
      const result = await backend.convert(TMP_CSV);

      expect(result.success).toBe(true);
      expect(result.backend).toBe('pyodide');
      expect(result.input_file).toBe(TMP_CSV);
      expect(result.output_file).toBe(TMP_OUT);
      expect(existsSync(TMP_OUT)).toBe(true);
      // parquet_bytes se descarta en la ruta de archivo (coincide con native)
      expect((result as any).parquet_bytes).toBeUndefined();
    });

    it('should honor a custom output path', async () => {
      const customOut = join(FIXTURES_DIR, 'custom.parquet');
      const pyodide = makeMockPyodide(makePyResult());
      const backend = makeBackend(pyodide);
      const result = await backend.convert(TMP_CSV, { output: customOut });
      expect(result.output_file).toBe(customOut);
      expect(existsSync(customOut)).toBe(true);
      unlinkSync(customOut);
    });

    it('should throw when input file does not exist', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const backend = makeBackend(pyodide);
      await expect(backend.convert('no-existe.csv')).rejects.toThrow('Archivo no encontrado');
    });

    it('should read a binary file (.parquet) as ArrayBuffer', async () => {
      const binIn = join(FIXTURES_DIR, 'pyodide-input.parquet');
      writeFileSync(binIn, Buffer.from([80, 65, 82, 49])); // "PAR1"
      const pyodide = makeMockPyodide(makePyResult({ file_type: 'parquet' }));
      const backend = makeBackend(pyodide);
      const result = await backend.convert(binIn, { output: join(FIXTURES_DIR, 'bin-out.parquet') });
      expect(result.success).toBe(true);
      expect(convertCall(pyodide)).toContain('"binary"');
      unlinkSync(binIn);
      unlinkSync(join(FIXTURES_DIR, 'bin-out.parquet'));
    });

    it('should write an empty parquet when result has no parquet_bytes', async () => {
      const noBytes = JSON.stringify({
        success: true, rows: 0, columns: 0, input_size: 0, output_size: 0,
        compression_ratio: 0, compression_used: 'snappy', file_type: 'csv',
      });
      const pyodide = makeMockPyodide(noBytes);
      const backend = makeBackend(pyodide);
      const result = await backend.convert(TMP_CSV);
      expect(existsSync(result.output_file!)).toBe(true);
    });

    it('should reject convert() outside Node', async () => {
      const spy = jest.spyOn(runtime, 'isNodeRuntime').mockReturnValue(false);
      const backend = makeBackend(makeMockPyodide(makePyResult()));
      await expect(backend.convert(TMP_CSV)).rejects.toThrow('requiere Node.js');
      spy.mockRestore();
    });
  });

  // ── comportamiento interno ────────────────────────────────────────────────

  describe('internal behavior', () => {
    it('should load the Python source only once across conversions', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      const sourceLoader = jest.fn().mockResolvedValue('PY_SOURCE');
      const backend = new PyodideBackend({
        loader: makeLoader(pyodide),
        logger: makeSilentLogger(),
        sourceLoader,
      });
      await backend.convertData('a\n1');
      await backend.convertData('b\n2');
      expect(sourceLoader).toHaveBeenCalledTimes(1);
    });

    it('should use console as the default logger', async () => {
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      // sin logger inyectado → usa `console`
      const backend = new PyodideBackend({
        loader: makeLoader(makeMockPyodide('{}')),
        sourceLoader: async () => 'S',
        indexURL: 'test://local/',
      });
      await backend.initialize();
      expect(infoSpy).toHaveBeenCalled();
      infoSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  // ── rutas por defecto (sin DI) ───────────────────────────────────────────────

  describe('default providers (Node)', () => {
    it('should use the real .py source loader and node_modules indexURL', async () => {
      const pyodide = makeMockPyodide(makePyResult());
      // Sin sourceLoader ni indexURL: se ejercitan defaultSourceLoader (fs) y
      // defaultIndexURL (require.resolve('pyodide')).
      const backend = new PyodideBackend({
        loader: makeLoader(pyodide),
        logger: makeSilentLogger(),
      });
      const result = await backend.convertData('id,name\n1,Juan');
      expect(result.success).toBe(true);
      // La fuente cargada fue el .py real (contiene la firma de upc_convert)
      const loadedSource = pyodide.runPythonAsync.mock.calls[0][0] as string;
      expect(loadedSource).toContain('def upc_convert');
    });
  });

  // ── logger DI ────────────────────────────────────────────────────────────────

  describe('logger injection', () => {
    it('should use custom logger instead of console', async () => {
      const logger = makeSilentLogger();
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const backend = makeBackend(makeMockPyodide('{}'), logger);
      await backend.initialize();
      expect(logger.info).toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });
});


// ══════════════════════════════════════════════════════════════════════════════
// CythonBackend
// ══════════════════════════════════════════════════════════════════════════════

describe('CythonBackend', () => {

  it('findCythonModules returns empty when readdir throws (catch branch)', () => {
    // Pasar la ruta de un ARCHIVO (no dir) hace que readdirSync lance ENOTDIR
    // de verdad → ejercita el catch sin mocks. __filename siempre existe.
    const { findCythonModules } = require('../src/backends/cython-backend');
    expect(findCythonModules(__filename)).toEqual([]);
  });

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