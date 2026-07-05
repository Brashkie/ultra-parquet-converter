/**
 * Runtime helpers for the Pyodide backend.
 *
 * Aislados aquí (en vez de inline en el backend) para que las ramas de entorno
 * —Node vs navegador, CDN vs node_modules, fs vs fetch— sean testeables sin
 * tener que falsear `process` global. Cada función acepta dependencias
 * inyectables con defaults reales.
 */

export const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/';

/** ¿Estamos en Node? (determina indexURL local y lectura de la fuente .py) */
export function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node;
}

export interface IndexURLDeps {
  node?: boolean;
  requireResolve?: (id: string) => string;
  cdn?: string;
}

/** indexURL por defecto: node_modules local en Node, CDN en navegador. */
export function defaultIndexURL(deps: IndexURLDeps = {}): string {
  const cdn = deps.cdn ?? PYODIDE_CDN;
  const node = deps.node ?? isNodeRuntime();
  if (!node) return cdn;
  try {
    const path = require('path');
    const resolve = deps.requireResolve ?? require.resolve;
    const entry = resolve('pyodide');
    return path.dirname(entry) + path.sep;
  } catch {
    return cdn;
  }
}

export interface SourceDeps {
  node?: boolean;
  readSource?: () => string;
  fetchFn?: (url: string) => Promise<{ text: () => Promise<string> }>;
  url?: string;
}

/** Carga el código Python compartido: fs en Node, fetch en navegador. */
export async function loadPyodideSource(deps: SourceDeps = {}): Promise<string> {
  const node = deps.node ?? isNodeRuntime();
  if (node) {
    if (deps.readSource) return deps.readSource();
    const fs = require('fs');
    const path = require('path');
    return fs.readFileSync(
      path.join(__dirname, '..', '..', 'python', 'pyodide_convert.py'),
      'utf8',
    );
  }
  const doFetch = deps.fetchFn ?? (fetch as unknown as SourceDeps['fetchFn']);
  const res = await doFetch!(deps.url ?? './python/pyodide_convert.py');
  return res.text();
}
