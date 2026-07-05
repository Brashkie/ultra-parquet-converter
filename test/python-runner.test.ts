/**
 * Tests unitarios del runner Python compartido.
 * Cubre discovery (platform), findPython y todas las ramas de runPythonToJson.
 */

import { EventEmitter } from 'events';

jest.mock('child_process');
import { spawn } from 'child_process';
import {
  defaultPythonCandidates,
  preferredPythonCommand,
  findPython,
  runPythonToJson,
  RunMessages,
} from '../src/utils/python-runner';

const mockSpawn = spawn as unknown as jest.Mock;

// ── Fake child process ──────────────────────────────────────────────────────

function fakeProc(opts: {
  code?: number | null;
  stdout?: string;
  stderr?: string;
  errorEvent?: string;
}) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  process.nextTick(() => {
    if (opts.errorEvent) {
      proc.emit('error', new Error(opts.errorEvent));
      return;
    }
    if (opts.stdout) proc.stdout.emit('data', Buffer.from(opts.stdout));
    if (opts.stderr) proc.stderr.emit('data', Buffer.from(opts.stderr));
    proc.emit('close', opts.code ?? 0);
  });
  return proc;
}

const MSG: RunMessages = {
  execError:       (m) => `exec: ${m}`,
  parseError:      (e, stdout) => `parse: ${e.message} :: ${stdout}`,
  nonZeroCode:     (code) => `code ${code}`,
};

const okResult = JSON.stringify({ success: true, rows: 1 });

beforeEach(() => mockSpawn.mockReset());

// ── platform helpers ────────────────────────────────────────────────────────

describe('platform helpers', () => {
  const realPlatform = process.platform;
  const setPlatform = (p: string) =>
    Object.defineProperty(process, 'platform', { value: p, configurable: true });
  afterEach(() => setPlatform(realPlatform));

  it('defaultPythonCandidates on non-win32', () => {
    setPlatform('linux');
    expect(defaultPythonCandidates()).toEqual(['python3', 'python']);
  });

  it('defaultPythonCandidates on win32', () => {
    setPlatform('win32');
    expect(defaultPythonCandidates()).toEqual(['py', 'python', 'python3']);
  });

  it('preferredPythonCommand on non-win32', () => {
    setPlatform('linux');
    expect(preferredPythonCommand()).toBe('python3');
  });

  it('preferredPythonCommand on win32', () => {
    setPlatform('win32');
    expect(preferredPythonCommand()).toBe('py');
  });
});

// ── findPython ──────────────────────────────────────────────────────────────

describe('findPython', () => {
  it('returns the first available command (default candidates)', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 0 }));
    const cmd = await findPython();               // sin args → usa defaults
    expect(typeof cmd).toBe('string');
    expect(mockSpawn).toHaveBeenCalledWith(expect.any(String), ['--version'], { stdio: 'ignore' });
  });

  it('skips failing candidates and returns the working one', async () => {
    mockSpawn
      .mockImplementationOnce(() => fakeProc({ code: 1 }))   // py falla
      .mockImplementationOnce(() => fakeProc({ code: 0 }));  // python ok
    const cmd = await findPython(['py', 'python']);
    expect(cmd).toBe('python');
  });

  it('returns null when all candidates fail', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 1 }));
    expect(await findPython(['py', 'python3'])).toBeNull();
  });

  it('treats a spawn error as unavailable', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ errorEvent: 'ENOENT' }));
    expect(await findPython(['python3'])).toBeNull();
  });
});

// ── runPythonToJson ─────────────────────────────────────────────────────────

describe('runPythonToJson', () => {
  it('resolves and tags the backend on success', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 0, stdout: okResult }));
    const r = await runPythonToJson('python3', ['s.py'], 'native-python', MSG);
    expect(r.backend).toBe('native-python');
    expect(r.rows).toBe(1);
  });

  it('uses the default spawnOptions when none are passed', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 0, stdout: okResult }));
    await runPythonToJson('python3', ['s.py'], 'native-python', MSG);
    expect(mockSpawn).toHaveBeenCalledWith('python3', ['s.py'], { stdio: ['ignore', 'pipe', 'pipe'] });
  });

  it('rejects with result.error when success=false', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 0, stdout: JSON.stringify({ success: false, error: 'boom' }) }));
    await expect(runPythonToJson('py', [], 'cython', MSG)).rejects.toThrow('boom');
  });

  it('rejects with generic message when success=false and no error', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 0, stdout: JSON.stringify({ success: false }) }));
    await expect(runPythonToJson('py', [], 'cython', MSG)).rejects.toThrow('Error desconocido');
  });

  it('rejects via parseError when stdout is invalid JSON on exit 0', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 0, stdout: 'not json' }));
    await expect(runPythonToJson('py', [], 'cython', MSG)).rejects.toThrow('parse:');
  });

  it('rejects with JSON error field on non-zero exit', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 2, stdout: JSON.stringify({ error: 'py-side error' }) }));
    await expect(runPythonToJson('py', [], 'cython', MSG)).rejects.toThrow('py-side error');
  });

  it('rejects with nonZeroCode when JSON has no error field', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 3, stdout: '{}' }));
    await expect(runPythonToJson('py', [], 'cython', MSG)).rejects.toThrow('code 3');
  });

  it('rejects with stderr when non-zero + non-JSON stdout', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 1, stdout: 'garbage', stderr: 'the stderr' }));
    await expect(runPythonToJson('py', [], 'cython', MSG)).rejects.toThrow('the stderr');
  });

  it('rejects with stdout when non-zero + non-JSON + no stderr', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 1, stdout: '{bad json', stderr: '' }));
    await expect(runPythonToJson('py', [], 'cython', MSG)).rejects.toThrow('{bad json');
  });

  it('rejects via execError on spawn error event', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ errorEvent: 'EACCES' }));
    await expect(runPythonToJson('py', [], 'cython', MSG)).rejects.toThrow('exec: EACCES');
  });

  it('honors custom spawnOptions (env / stdio)', async () => {
    mockSpawn.mockImplementation(() => fakeProc({ code: 0, stdout: okResult }));
    await runPythonToJson('py', ['x'], 'cython', MSG, { stdio: ['pipe', 'pipe', 'pipe'], env: { A: '1' } });
    expect(mockSpawn).toHaveBeenCalledWith('py', ['x'], { stdio: ['pipe', 'pipe', 'pipe'], env: { A: '1' } });
  });
});
