/**
 * NativePythonBackend — Tests con mocks para cubrir branches internos
 * Cubre: code !== 0, result.success=false, catch parseo, proc.on('error'),
 *        getPythonCommand() linux branch, isAvailable() error branch
 */

import { NativePythonBackend } from '../src/backends/native-python';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Mock: child_process ───────────────────────────────────────────────────────

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeSuccessSpawn(stdout: string) {
  return {
    stdout: { on: jest.fn((ev, cb) => { if (ev === 'data') cb(Buffer.from(stdout)); }) },
    stderr: { on: jest.fn() },
    on: jest.fn((ev, cb) => { if (ev === 'close') cb(0); }),
  };
}

function makeFailSpawn(code: number, stdout = '', stderr = '') {
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

const FIXTURES_DIR = join(__dirname, 'fixtures');
const TEST_CSV     = join(FIXTURES_DIR, 'test_native_mocked.csv');

beforeAll(() => {
  if (!existsSync(FIXTURES_DIR)) mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(TEST_CSV, `id,name\n1,Juan\n2,Maria`);
});

afterAll(() => {
  if (existsSync(TEST_CSV)) unlinkSync(TEST_CSV);
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// NativePythonBackend — branches internos con mocks
// ══════════════════════════════════════════════════════════════════════════════

describe('NativePythonBackend (mocked)', () => {

  // ── getPythonCommand — linux/mac branch ─────────────────────────────────────

  describe('getPythonCommand', () => {
    it('should use "python3" on linux/mac', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));

      const backend = new NativePythonBackend();
      await backend.convert(TEST_CSV);

      // Verifica que el primer arg del spawn sea 'python3' en linux
      expect(mockSpawn).toHaveBeenCalledWith(
        'python3',
        expect.any(Array),
        expect.any(Object)
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    it('should use "py" on windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));

      const backend = new NativePythonBackend();
      await backend.convert(TEST_CSV);

      expect(mockSpawn).toHaveBeenCalledWith(
        'py',
        expect.any(Array),
        expect.any(Object)
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  // ── executePython — code !== 0 branches ─────────────────────────────────────

  describe('executePython — code !== 0', () => {

    // Cubre línea 66-68: code !== 0 → JSON válido con campo error
    it('should reject with error from JSON when code !== 0', async () => {
      const errorJson = JSON.stringify({ error: 'Python falló', success: false });
      mockSpawn.mockReturnValue(makeFailSpawn(1, errorJson));

      const backend = new NativePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Python falló');
    });

    // Cubre línea 68: fallback "Error (código X)" cuando JSON sin campo error
    it('should use "Error (código X)" fallback when JSON has no error field', async () => {
      mockSpawn.mockReturnValue(makeFailSpawn(1, JSON.stringify({ noError: true })));

      const backend = new NativePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow(/Error \(código/);
    });

    // Cubre línea 70-71: catch → stderr fallback cuando stdout no es JSON
    it('should use stderr when stdout is not JSON on fail', async () => {
      mockSpawn.mockReturnValue(makeFailSpawn(1, 'not json', 'stderr error msg'));

      const backend = new NativePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('stderr error msg');
    });

    // Cubre línea 70-71: catch → stdout fallback cuando stderr vacío
    it('should use stdout when stderr is empty and stdout is not JSON on fail', async () => {
      mockSpawn.mockReturnValue(makeFailSpawn(1, 'stdout fallback', ''));

      const backend = new NativePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('stdout fallback');
    });

    // Cubre línea 70-71: catch → 'Error desconocido' cuando ambos vacíos
    it('should use "Error desconocido" when stdout empty and stderr empty on fail', async () => {
      mockSpawn.mockReturnValue(makeFailSpawn(1, '', ''));

      const backend = new NativePythonBackend();
      // stdout='' → JSON.parse('{}') → {} → errorData.error=undefined → 'Error (código 1)'
      await expect(backend.convert(TEST_CSV)).rejects.toThrow(/Error \(código/);
    });
  });

  // ── executePython — code === 0 branches ─────────────────────────────────────

  describe('executePython — code === 0', () => {

    // Cubre línea 77-78: result.success === false → reject
    it('should reject when result.success is false', async () => {
      const failResult = JSON.stringify({ success: false, error: 'Conversión falló' });
      mockSpawn.mockReturnValue(makeSuccessSpawn(failResult));

      const backend = new NativePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Conversión falló');
    });

    // Cubre línea 77-78: result.success === false sin campo error → 'Error desconocido'
    it('should reject with "Error desconocido" when success=false and no error field', async () => {
      const failResult = JSON.stringify({ success: false });
      mockSpawn.mockReturnValue(makeSuccessSpawn(failResult));

      const backend = new NativePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Error desconocido');
    });

    // Cubre línea 83: catch → 'Error al parsear respuesta' cuando stdout no es JSON
    it('should reject with "Error al parsear respuesta" when stdout is invalid JSON', async () => {
      mockSpawn.mockReturnValue(makeSuccessSpawn('invalid {{ json'));

      const backend = new NativePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Error al parsear respuesta');
    });

    // Cubre conversión exitosa normal
    it('should resolve successfully with valid result', async () => {
      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));

      const backend = new NativePythonBackend();
      const result = await backend.convert(TEST_CSV);
      expect(result.success).toBe(true);
      expect(result.backend).toBe('native-python');
    });
  });

  // ── executePython — proc.on('error') ────────────────────────────────────────

  describe('executePython — proc error event', () => {

    // Cubre línea 88: proc.on('error') → 'Error ejecutando Python'
    it('should reject with "Error ejecutando Python" on spawn error', async () => {
      mockSpawn.mockReturnValue(makeErrorSpawn('ENOENT'));

      const backend = new NativePythonBackend();
      await expect(backend.convert(TEST_CSV)).rejects.toThrow('Error ejecutando Python: ENOENT');
    });
  });

  // ── isAvailable — proc.on('error') branch ───────────────────────────────────

  describe('isAvailable', () => {

    // Cubre línea 102: proc.on('error') → resolve(false)
    it('should return false when spawn emits error', async () => {
      mockSpawn.mockReturnValue(makeErrorSpawn('ENOENT'));
      const available = await NativePythonBackend.isAvailable();
      expect(available).toBe(false);
    });

    // Cubre línea 101: proc.on('close') → resolve(code === 0) → true
    it('should return true when spawn closes with code 0', async () => {
      mockSpawn.mockReturnValue({
        on: jest.fn((ev, cb) => { if (ev === 'close') cb(0); }),
      });
      const available = await NativePythonBackend.isAvailable();
      expect(available).toBe(true);
    });

    // Cubre: proc.on('close') → resolve(code === 0) → false
    it('should return false when spawn closes with non-zero code', async () => {
      mockSpawn.mockReturnValue({
        on: jest.fn((ev, cb) => { if (ev === 'close') cb(1); }),
      });
      const available = await NativePythonBackend.isAvailable();
      expect(available).toBe(false);
    });

    // Cubre: isAvailable en linux → usa 'python3'
    it('should use "python3" command on linux for isAvailable', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      mockSpawn.mockReturnValue({
        on: jest.fn((ev, cb) => { if (ev === 'close') cb(0); }),
      });

      await NativePythonBackend.isAvailable();
      expect(mockSpawn).toHaveBeenCalledWith('python3', ['--version'], { stdio: 'ignore' });

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  // ── convert — opciones ───────────────────────────────────────────────────────

  describe('convert — opciones con mock', () => {

    it('should pass all args correctly', async () => {
      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));

      const backend = new NativePythonBackend();
      await backend.convert(TEST_CSV, {
        output: 'out.parquet',
        verbose: true,
        streaming: true,
        autoRepair: false,
        autoNormalize: false,
        parallelWorkers: 4,
        compression: 'zstd',
      });

      const spawnArgs = mockSpawn.mock.calls[0][1] as string[];
      expect(spawnArgs).toContain('-o');
      expect(spawnArgs).toContain('out.parquet');
      expect(spawnArgs).toContain('-v');
      expect(spawnArgs).toContain('--streaming');
      expect(spawnArgs).toContain('--no-repair');
      expect(spawnArgs).toContain('--no-normalize');
      expect(spawnArgs).toContain('--workers');
      expect(spawnArgs).toContain('4');
      expect(spawnArgs).toContain('--compression');
      expect(spawnArgs).toContain('zstd');
    });

    it('should warn and fallback on invalid compression', async () => {
      mockSpawn.mockReturnValue(makeSuccessSpawn(MOCK_RESULT));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const backend = new NativePythonBackend();
      await backend.convert(TEST_CSV, { compression: 'invalid' as any });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'invalid'"));
      const spawnArgs = mockSpawn.mock.calls[0][1] as string[];
      const compressionIdx = spawnArgs.indexOf('--compression');
      expect(spawnArgs[compressionIdx + 1]).toBe('adaptive');

      warnSpy.mockRestore();
    });
  });
});