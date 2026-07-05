/**
 * Tests del módulo runtime: detección Node/navegador y proveedores por defecto
 * (indexURL y carga de la fuente Python) con dependencias inyectadas.
 */

import {
  PYODIDE_CDN,
  isNodeRuntime,
  defaultIndexURL,
  loadPyodideSource,
} from '../src/utils/runtime';

describe('isNodeRuntime', () => {
  it('is true under Node (jest)', () => {
    expect(isNodeRuntime()).toBe(true);
  });
});

describe('defaultIndexURL', () => {
  it('returns a local path under Node (resolves pyodide)', () => {
    const url = defaultIndexURL();
    expect(url).not.toBe(PYODIDE_CDN);
    expect(url.endsWith('/') || url.endsWith('\\')).toBe(true);
  });

  it('returns the CDN when not in Node', () => {
    expect(defaultIndexURL({ node: false })).toBe(PYODIDE_CDN);
  });

  it('falls back to the CDN when require.resolve throws', () => {
    const url = defaultIndexURL({
      node: true,
      requireResolve: () => { throw new Error('cannot resolve'); },
    });
    expect(url).toBe(PYODIDE_CDN);
  });

  it('honors a custom CDN', () => {
    expect(defaultIndexURL({ node: false, cdn: 'https://x/' })).toBe('https://x/');
  });
});

describe('loadPyodideSource', () => {
  it('reads the real .py file under Node (default)', async () => {
    const src = await loadPyodideSource();
    expect(src).toContain('def upc_convert');
  });

  it('uses an injected readSource under Node', async () => {
    const src = await loadPyodideSource({ node: true, readSource: () => 'FAKE_PY' });
    expect(src).toBe('FAKE_PY');
  });

  it('fetches the source in the browser branch', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ text: async () => 'FETCHED_PY' });
    const src = await loadPyodideSource({ node: false, fetchFn, url: './x.py' });
    expect(fetchFn).toHaveBeenCalledWith('./x.py');
    expect(src).toBe('FETCHED_PY');
  });

  it('uses the default url in the browser branch', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ text: async () => 'D' });
    await loadPyodideSource({ node: false, fetchFn });
    expect(fetchFn).toHaveBeenCalledWith('./python/pyodide_convert.py');
  });

  it('falls back to global fetch when no fetchFn is injected (browser)', async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn().mockResolvedValue({ text: async () => 'GLOBAL_PY' });
    const src = await loadPyodideSource({ node: false });
    expect(src).toBe('GLOBAL_PY');
    (globalThis as any).fetch = original;
  });
});
