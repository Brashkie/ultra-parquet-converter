/**
 * NativePythonBackend Tests — sin mocks, usa Python real del sistema
 */

import { NativePythonBackend } from '../src/backends/native-python';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const TEST_CSV     = join(FIXTURES_DIR, 'test_native.csv');

beforeAll(() => {
  if (!existsSync(FIXTURES_DIR)) mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(TEST_CSV, `id,name,age,city\n1,Juan,25,Lima\n2,Maria,30,Cusco\n3,Pedro,35,Arequipa`);
});

afterAll(() => {
  if (existsSync(TEST_CSV)) unlinkSync(TEST_CSV);
});

describe('NativePythonBackend', () => {
  it('should detect if Python is available', async () => {
    const available = await NativePythonBackend.isAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should fail gracefully with non-existent file', async () => {
    const backend = new NativePythonBackend();
    await expect(backend.convert('non-existent-file.csv')).rejects.toThrow();
  });

  it('should convert CSV successfully', async () => {
    const backend = new NativePythonBackend();
    const result = await backend.convert(TEST_CSV);
    expect(result.success).toBe(true);
    expect(result.rows).toBe(3);
    expect(result.backend).toBe('native-python');
  }, 30000);

  it('should convert with verbose option', async () => {
    const backend = new NativePythonBackend();
    const result = await backend.convert(TEST_CSV, { verbose: true });
    expect(result.success).toBe(true);
  }, 30000);

  it('should convert with streaming option', async () => {
    const backend = new NativePythonBackend();
    const result = await backend.convert(TEST_CSV, { streaming: true });
    expect(result.success).toBe(true);
    expect(result.streaming_mode).toBe(true);
  }, 30000);

  it('should convert with autoRepair=false', async () => {
    const backend = new NativePythonBackend();
    const result = await backend.convert(TEST_CSV, { autoRepair: false });
    expect(result.success).toBe(true);
  }, 30000);

  it('should convert with autoNormalize=false', async () => {
    const backend = new NativePythonBackend();
    const result = await backend.convert(TEST_CSV, { autoNormalize: false });
    expect(result.success).toBe(true);
  }, 30000);

  it('should convert with output option', async () => {
    const outputFile = join(FIXTURES_DIR, 'native-output.parquet');
    const backend = new NativePythonBackend();
    const result = await backend.convert(TEST_CSV, { output: outputFile });
    expect(result.success).toBe(true);
    if (existsSync(outputFile)) unlinkSync(outputFile);
  }, 30000);

  it('should convert with parallelWorkers option', async () => {
    const backend = new NativePythonBackend();
    const result = await backend.convert(TEST_CSV, { parallelWorkers: 1 });
    expect(result.success).toBe(true);
  }, 30000);

  it('should convert with snappy compression', async () => {
    const backend = new NativePythonBackend();
    const result = await backend.convert(TEST_CSV, { compression: 'snappy' });
    expect(result.success).toBe(true);
  }, 30000);

  it('should fallback to adaptive on invalid compression with warning', async () => {
    const backend = new NativePythonBackend();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await backend.convert(TEST_CSV, { compression: 'invalid' as any });
    expect(result.success).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'invalid'"));
    warnSpy.mockRestore();
  }, 30000);
});