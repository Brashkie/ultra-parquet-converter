/**
 * download.ts Tests — PortablePythonDownloader con mocks completos
 */

import { PortablePythonDownloader, getDownloader, ensurePortablePython } from '../src/utils/download';
import { join } from 'path';
import { homedir } from 'os';

// ─── Mock: fs ─────────────────────────────────────────────────────────────────
// Usa factory functions — jest.mock se hoistea y no puede referenciar variables externas

jest.mock('fs', () => ({
  existsSync:        jest.fn(),
  mkdirSync:         jest.fn(),
  chmodSync:         jest.fn(),
  createWriteStream: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('node-fetch', () => jest.fn());

jest.mock('extract-zip', () => jest.fn());

jest.mock('stream/promises', () => ({
  pipeline: jest.fn(),
}));

jest.mock('cli-progress', () => ({
  SingleBar: jest.fn().mockImplementation(() => ({
    start:  jest.fn(),
    update: jest.fn(),
    stop:   jest.fn(),
  })),
}));

// ─── Acceso a mocks después del hoisting ──────────────────────────────────────

import * as fs from 'fs';
import * as cp from 'child_process';
import * as streamPromises from 'stream/promises';
import fetch from 'node-fetch';
import extract from 'extract-zip';

const mockExistsSync         = fs.existsSync as jest.Mock;
const mockMkdirSync          = fs.mkdirSync as jest.Mock;
const mockChmodSync          = fs.chmodSync as jest.Mock;
const mockCreateWriteStream  = fs.createWriteStream as jest.Mock;
const mockSpawn              = cp.spawn as jest.Mock;
const mockPipeline           = streamPromises.pipeline as jest.Mock;
const mockFetch              = fetch as jest.Mock;
const mockExtract            = extract as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWriteStream() {
  return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
}

function makeSuccessSpawn() {
  return {
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((ev: string, cb: Function) => { if (ev === 'close') cb(0); }),
  };
}

function makeFailSpawn(code = 1) {
  return {
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((ev: string, cb: Function) => { if (ev === 'close') cb(code); }),
  };
}

function makeErrorSpawn(msg = 'spawn error') {
  return {
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((ev: string, cb: Function) => { if (ev === 'error') cb(new Error(msg)); }),
  };
}

function makeFetchResponse(ok = true, body: any = 'auto') {
  const mockBody = {
    on: jest.fn((ev: string, cb: Function) => { if (ev === 'data') cb(Buffer.from('chunk')); }),
  };
  return {
    ok,
    statusText: ok ? 'OK' : 'Not Found',
    body: body === 'auto' ? mockBody : body,
  };
}

// ──────────────────────────────────────────────────────────────────────────────

describe('PortablePythonDownloader', () => {

  let downloader: PortablePythonDownloader;

  beforeEach(() => {
    jest.clearAllMocks();
    downloader = new PortablePythonDownloader();
    mockCreateWriteStream.mockReturnValue(makeWriteStream());
    mockPipeline.mockResolvedValue(undefined);
    mockExtract.mockResolvedValue(undefined);
  });

  // ── isInstalled ─────────────────────────────────────────────────────────────

  describe('isInstalled', () => {

    it('returns true when python executable exists', () => {
      mockExistsSync.mockReturnValue(true);
      expect(downloader.isInstalled()).toBe(true);
    });

    it('returns false when python executable does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(downloader.isInstalled()).toBe(false);
    });
  });

  // ── getPythonExecutable ──────────────────────────────────────────────────────

  describe('getPythonExecutable', () => {

    it('returns python.exe on win32', () => {
      const origPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const dl = new PortablePythonDownloader();
      expect(dl.getPythonExecutable()).toContain('python.exe');

      Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    });

    it('returns bin/python3 on linux', () => {
      const origPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const dl = new PortablePythonDownloader();
      expect(dl.getPythonExecutable()).toContain('python3');

      Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    });
  });

  // ── download ─────────────────────────────────────────────────────────────────

  describe('download', () => {

    function withPlatform(platform: string, fn: () => Promise<void>) {
      return async () => {
        const orig = process.platform;
        Object.defineProperty(process, 'platform', { value: platform, configurable: true });
        try { await fn(); }
        finally {
          Object.defineProperty(process, 'platform', { value: orig, configurable: true });
        }
      };
    }

    it('should throw for unsupported platform', withPlatform('freebsd', async () => {
      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('no soportada');
    }));

    it('should create installDir if not exists', withPlatform('win32', async () => {
      mockExistsSync.mockReturnValue(false);
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeSuccessSpawn());

      const dl = new PortablePythonDownloader();
      await dl.download();

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('python-portable'),
        { recursive: true }
      );
    }));

    it('should NOT create installDir if already exists', withPlatform('win32', async () => {
      mockExistsSync.mockReturnValue(true);
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeSuccessSpawn());

      const dl = new PortablePythonDownloader();
      await dl.download();

      expect(mockMkdirSync).not.toHaveBeenCalled();
    }));

    it('should throw when fetch response is not ok', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(false));

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('Download failed');
    }));

    it('should throw when response body is null', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true, null));

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('Response body vacío');
    }));

    it('should use extract-zip on win32', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeSuccessSpawn());

      const dl = new PortablePythonDownloader();
      await dl.download();

      expect(mockExtract).toHaveBeenCalled();
    }));

    it('should use tar spawn on linux', withPlatform('linux', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeSuccessSpawn());

      const dl = new PortablePythonDownloader();
      await dl.download();

      const tarCall = mockSpawn.mock.calls.find(([cmd]) => cmd === 'tar');
      expect(tarCall).toBeTruthy();
    }));

    it('should throw when tar extraction fails', withPlatform('linux', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeFailSpawn(1));

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('Extracción falló');
    }));

    it('should throw when tar spawn emits error', withPlatform('linux', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeErrorSpawn('ENOENT tar'));

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('ENOENT tar');
    }));

    it('should chmod python on linux (setupPython)', withPlatform('linux', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeSuccessSpawn());

      const dl = new PortablePythonDownloader();
      await dl.download();

      expect(mockChmodSync).toHaveBeenCalledWith(expect.stringContaining('python3'), 0o755);
    }));

    it('should NOT chmod on win32', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeSuccessSpawn());

      const dl = new PortablePythonDownloader();
      await dl.download();

      expect(mockChmodSync).not.toHaveBeenCalled();
    }));

    it('should throw when setupPython spawn fails', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeFailSpawn(1));

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('Python portable no funciona');
    }));

    it('should throw when setupPython spawn emits error', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeErrorSpawn('EACCES'));

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('EACCES');
    }));

    it('should throw when get-pip.py fetch not ok', withPlatform('win32', async () => {
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(true))  // zip ok
        .mockResolvedValueOnce(makeFetchResponse(false)); // get-pip.py falla

      mockSpawn.mockReturnValue(makeSuccessSpawn());

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('No se pudo descargar get-pip.py');
    }));

    it('should throw when get-pip.py body is null', withPlatform('win32', async () => {
      mockFetch
        .mockResolvedValueOnce(makeFetchResponse(true))
        .mockResolvedValueOnce(makeFetchResponse(true, null));

      mockSpawn.mockReturnValue(makeSuccessSpawn());

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('Response body vacío para get-pip.py');
    }));

    it('should throw when pip install fails', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn()) // setupPython ok
        .mockReturnValueOnce(makeFailSpawn(1));  // installPip falla

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('pip install failed');
    }));

    it('should throw when pip spawn emits error', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn())      // setupPython ok
        .mockReturnValueOnce(makeErrorSpawn('EPERM')); // installPip error

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('EPERM');
    }));

    it('should throw when dependencies install fails', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn()) // setupPython ok
        .mockReturnValueOnce(makeSuccessSpawn()) // installPip ok
        .mockReturnValueOnce(makeFailSpawn(1));  // installDependencies falla

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('Dependencies install failed');
    }));

    it('should throw when dependencies spawn emits error', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn
        .mockReturnValueOnce(makeSuccessSpawn())       // setupPython ok
        .mockReturnValueOnce(makeSuccessSpawn())       // installPip ok
        .mockReturnValueOnce(makeErrorSpawn('ENOENT')); // installDependencies error

      const dl = new PortablePythonDownloader();
      await expect(dl.download()).rejects.toThrow('ENOENT');
    }));

    it('should return python executable path on success', withPlatform('win32', async () => {
      mockFetch.mockResolvedValue(makeFetchResponse(true));
      mockSpawn.mockReturnValue(makeSuccessSpawn());

      const dl = new PortablePythonDownloader();
      const result = await dl.download();

      expect(typeof result).toBe('string');
      expect(result).toContain('python.exe');
    }));
  });

  // ── getInfo ──────────────────────────────────────────────────────────────────

  describe('getInfo', () => {

    it('returns not-installed info when not installed', async () => {
      mockExistsSync.mockReturnValue(false);
      const info = await downloader.getInfo();
      expect(info).toEqual({ installed: false, path: null, version: null });
    });

    it('returns installed info with version from stdout', async () => {
      mockExistsSync.mockReturnValue(true);

      const mockProc = {
        stdout: { on: jest.fn((ev: string, cb: Function) => { if (ev === 'data') cb(Buffer.from('Python 3.11.7')); }) },
        stderr: { on: jest.fn() },
        on: jest.fn((ev: string, cb: Function) => { if (ev === 'close') cb(0); }),
      };
      mockSpawn.mockReturnValue(mockProc);

      const info = await downloader.getInfo();
      expect(info.installed).toBe(true);
      expect(info.version).toBe('3.11.7');
      expect(info.path).toBeTruthy();
    });

    it('captures version from stderr (Python writes --version to stderr)', async () => {
      mockExistsSync.mockReturnValue(true);

      const mockProc = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn((ev: string, cb: Function) => { if (ev === 'data') cb(Buffer.from('Python 3.11.0')); }) },
        on: jest.fn((ev: string, cb: Function) => { if (ev === 'close') cb(0); }),
      };
      mockSpawn.mockReturnValue(mockProc);

      const info = await downloader.getInfo();
      expect(info.version).toBe('3.11.0');
    });

    it('returns "unknown" version when output does not match pattern', async () => {
      mockExistsSync.mockReturnValue(true);

      const mockProc = {
        stdout: { on: jest.fn((ev: string, cb: Function) => { if (ev === 'data') cb(Buffer.from('unexpected output')); }) },
        stderr: { on: jest.fn() },
        on: jest.fn((ev: string, cb: Function) => { if (ev === 'close') cb(0); }),
      };
      mockSpawn.mockReturnValue(mockProc);

      const info = await downloader.getInfo();
      expect(info.version).toBe('unknown');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// getDownloader / ensurePortablePython
// ══════════════════════════════════════════════════════════════════════════════

describe('getDownloader', () => {

  it('returns a PortablePythonDownloader instance', () => {
    const dl = getDownloader();
    expect(dl).toBeInstanceOf(PortablePythonDownloader);
  });

  it('returns the same instance on multiple calls (singleton)', () => {
    const dl1 = getDownloader();
    const dl2 = getDownloader();
    expect(dl1).toBe(dl2);
  });
});

describe('ensurePortablePython', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateWriteStream.mockReturnValue(makeWriteStream());
    mockPipeline.mockResolvedValue(undefined);
  });

  it('returns executable path when already installed', async () => {
    mockExistsSync.mockReturnValue(true);
    const path = await ensurePortablePython();
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(0);
  });

  it('calls download when not installed', async () => {
    mockExistsSync.mockReturnValue(false);
    mockFetch.mockResolvedValue({ ok: false, statusText: 'Not Found', body: null });

    await expect(ensurePortablePython()).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalled();
  });
});