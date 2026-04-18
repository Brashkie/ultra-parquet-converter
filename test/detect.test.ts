/**
 * detect.ts Tests — EnvironmentDetector con mocks completos
 */

// ─── Mocks (hoisting-safe: factories sin variables externas) ──────────────────

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
}));

// ─── Imports después del hoisting ─────────────────────────────────────────────

import { detectEnvironment, clearEnvironmentCache } from '../src/utils/detect';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';

const mockSpawn      = cp.spawn as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;
const mockReaddir    = fsp.readdir as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVersionSpawn(version: string, useStderr = false) {
  return {
    stdout: {
      on: jest.fn((ev: string, cb: Function) => {
        if (ev === 'data' && !useStderr) cb(Buffer.from(`Python ${version}`));
      }),
    },
    stderr: {
      on: jest.fn((ev: string, cb: Function) => {
        if (ev === 'data' && useStderr) cb(Buffer.from(`Python ${version}`));
      }),
    },
    on: jest.fn((ev: string, cb: Function) => {
      if (ev === 'close') cb(0);
    }),
  };
}

function makeFailVersionSpawn(code = 1) {
  return {
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((ev: string, cb: Function) => {
      if (ev === 'close') cb(code);
    }),
  };
}

function makeErrorVersionSpawn() {
  return {
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((ev: string, cb: Function) => {
      if (ev === 'error') cb(new Error('ENOENT'));
    }),
  };
}

// ──────────────────────────────────────────────────────────────────────────────

describe('detectEnvironment', () => {

  beforeEach(() => {
    clearEnvironmentCache();
    jest.clearAllMocks();
    // Por defecto: nada existe
    mockExistsSync.mockReturnValue(false);
    mockReaddir.mockResolvedValue([]);
  });

  // ── Platform detection ───────────────────────────────────────────────────────

  describe('platform detection', () => {

    it('should detect current platform', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      const env = await detectEnvironment();
      expect(env.platform).toBe(process.platform);
    });

    it('should set isWindows correctly', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      const env = await detectEnvironment();
      expect(env.isWindows).toBe(process.platform === 'win32');
    });

    it('should set isNode=true in Node.js', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      const env = await detectEnvironment();
      expect(env.isNode).toBe(true);
    });

    it('should set isBrowser=false in Node.js', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      const env = await detectEnvironment();
      expect(env.isBrowser).toBe(false);
    });

    it('should set isLinux correctly on linux platform', async () => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      clearEnvironmentCache();

      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      const env = await detectEnvironment();
      expect(env.isLinux).toBe(true);
      expect(env.isMac).toBe(false);

      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });

    it('should set isMac correctly on darwin platform', async () => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      clearEnvironmentCache();

      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      const env = await detectEnvironment();
      expect(env.isMac).toBe(true);
      expect(env.isLinux).toBe(false);

      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });
  });

  // ── Python detection ─────────────────────────────────────────────────────────

  describe('Python detection', () => {

    it('should detect Python when available', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      const env = await detectEnvironment();
      expect(env.hasPython).toBe(true);
      expect(env.pythonVersion).toBe('3.11.0');
      expect(env.pythonCommand).toBeTruthy();
    });

    it('should detect Python version from stderr (some versions write there)', async () => {
      // Simula Python que escribe en stderr
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.5', true));
      const env = await detectEnvironment();
      expect(env.hasPython).toBe(true);
      expect(env.pythonVersion).toBe('3.11.5');
    });

    // Cubre línea 130: code !== 0 → resolve(null)
    it('should set hasPython=false when all commands return non-zero exit', async () => {
      mockSpawn.mockReturnValue(makeFailVersionSpawn(1));
      const env = await detectEnvironment();
      expect(env.hasPython).toBe(false);
      expect(env.pythonCommand).toBeUndefined();
    });

    // Cubre línea 135: proc.on('error') → resolve(null)
    it('should set hasPython=false when spawn emits error', async () => {
      mockSpawn.mockReturnValue(makeErrorVersionSpawn());
      const env = await detectEnvironment();
      expect(env.hasPython).toBe(false);
    });

    // Cubre línea 103: catch { continue } — getPythonVersion lanza (no debería pero por robustez)
    it('should continue to next command when getPythonVersion throws', async () => {
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('Unexpected error');
        return makeVersionSpawn('3.11.0');
      });

      const env = await detectEnvironment();
      // Debe continuar con el siguiente comando y encontrar Python
      expect(env.hasPython).toBe(true);
    });

    // Cubre línea 91: linux branch ['python3', 'python']
    it('should try python3 first on linux', async () => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      clearEnvironmentCache();

      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      const env = await detectEnvironment();

      // En linux el primer comando es python3
      const firstCall = mockSpawn.mock.calls[0];
      expect(firstCall[0]).toBe('python3');

      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });

    // Cubre línea 91: win32 branch ['py', 'python', 'python3']
    it('should try py first on win32', async () => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      clearEnvironmentCache();

      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      const env = await detectEnvironment();

      const firstCall = mockSpawn.mock.calls[0];
      expect(firstCall[0]).toBe('py');

      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });

    // Cubre: version=null cuando output no matchea el patrón
    it('should set hasPython=false when output does not match version pattern', async () => {
      const noVersionSpawn = {
        stdout: { on: jest.fn((ev: string, cb: Function) => { if (ev === 'data') cb(Buffer.from('some output no version')); }) },
        stderr: { on: jest.fn() },
        on: jest.fn((ev: string, cb: Function) => { if (ev === 'close') cb(0); }),
      };
      mockSpawn.mockReturnValue(noVersionSpawn);
      const env = await detectEnvironment();
      expect(env.hasPython).toBe(false);
    });
  });

  // ── Cython detection ─────────────────────────────────────────────────────────

  describe('Cython detection', () => {

    // Cubre línea 147: cythonDir no existe → return early
    it('should set hasCython=false when cython dir does not exist', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      mockExistsSync.mockReturnValue(false);

      const env = await detectEnvironment();
      expect(env.hasCython).toBe(false);
      expect(env.cythonModules).toEqual([]);
    });

    // Cubre: cythonDir existe, archivos .pyd en win32
    it('should detect cython modules (.pyd) on win32', async () => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      clearEnvironmentCache();

      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        'fast_csv.cp311-win_amd64.pyd',
        'fast_parser.cp311-win_amd64.pyd',
        'README.md',
      ] as any);

      const env = await detectEnvironment();
      expect(env.hasCython).toBe(true);
      expect(env.cythonModules).toHaveLength(2);

      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });

    // Cubre línea 150: ['.so'] branch en linux
    it('should detect cython modules (.so) on linux', async () => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      clearEnvironmentCache();

      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue([
        'fast_csv.cpython-311-x86_64-linux-gnu.so',
        'fast_parser.cpython-311-x86_64-linux-gnu.so',
      ] as any);

      const env = await detectEnvironment();
      expect(env.hasCython).toBe(true);
      expect(env.cythonModules).toHaveLength(2);

      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });

    it('should set hasCython=false when no matching modules found', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockResolvedValue(['README.md', 'setup.py'] as any);

      const env = await detectEnvironment();
      expect(env.hasCython).toBe(false);
    });

    // Cubre: catch silently fail en detectCython
    it('should silently fail when readdir throws', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      mockExistsSync.mockReturnValue(true);
      mockReaddir.mockRejectedValue(new Error('Permission denied'));

      const env = await detectEnvironment();
      expect(env.hasCython).toBe(false);
    });
  });

  // ── Portable Python detection ─────────────────────────────────────────────────

  describe('Portable Python detection', () => {

    // Cubre líneas 181-182: hasPortablePython=true cuando existe el path
    it('should detect portable python when executable exists', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      // existsSync: primero false para cythonDir, luego true para portablePython
      mockExistsSync
        .mockReturnValueOnce(false) // cythonDir no existe
        .mockReturnValueOnce(true); // portablePython existe

      const env = await detectEnvironment();
      expect(env.hasPortablePython).toBe(true);
      expect(env.portablePythonPath).toBeTruthy();
    });

    it('should set hasPortablePython=false when executable does not exist', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      mockExistsSync.mockReturnValue(false);

      const env = await detectEnvironment();
      expect(env.hasPortablePython).toBe(false);
      expect(env.portablePythonPath).toBeUndefined();
    });

    // Cubre línea 177: 'bin/python3' en linux
    it('should use bin/python3 path for portable python on linux', async () => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      clearEnvironmentCache();

      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      mockExistsSync
        .mockReturnValueOnce(false) // cythonDir
        .mockReturnValueOnce(true); // portablePython

      const env = await detectEnvironment();
      expect(env.portablePythonPath).toContain('python3');
      expect(env.portablePythonPath).not.toContain('python.exe');

      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });

    // Cubre: 'python.exe' path en win32
    it('should use python.exe path for portable python on win32', async () => {
      const orig = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      clearEnvironmentCache();

      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      mockExistsSync
        .mockReturnValueOnce(false) // cythonDir
        .mockReturnValueOnce(true); // portablePython

      const env = await detectEnvironment();
      expect(env.portablePythonPath).toContain('python.exe');

      Object.defineProperty(process, 'platform', { value: orig, configurable: true });
    });
  });

  // ── WebAssembly detection ─────────────────────────────────────────────────────

  describe('WebAssembly detection', () => {

    it('should detect WebAssembly in Node.js environment', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));
      const env = await detectEnvironment();
      expect(typeof env.hasWebAssembly).toBe('boolean');
    });
  });

  // ── Cache ─────────────────────────────────────────────────────────────────────

  describe('cache', () => {

    it('should cache result and not re-detect on second call', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));

      await detectEnvironment();
      await detectEnvironment(); // segunda llamada — usa cache

      // spawn solo se llama en la primera detección
      const spawnCallCount = mockSpawn.mock.calls.length;
      expect(spawnCallCount).toBeGreaterThan(0);

      const firstCallCount = spawnCallCount;
      await detectEnvironment(); // tercera — sigue usando cache
      expect(mockSpawn.mock.calls.length).toBe(firstCallCount); // no más llamadas
    });

    // Cubre línea 190: clearCache → cachedEnv = null
    it('should re-detect after clearEnvironmentCache', async () => {
      mockSpawn.mockReturnValue(makeVersionSpawn('3.11.0'));

      await detectEnvironment();
      const firstCallCount = mockSpawn.mock.calls.length;

      clearEnvironmentCache();
      await detectEnvironment(); // debe re-detectar

      expect(mockSpawn.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });
});