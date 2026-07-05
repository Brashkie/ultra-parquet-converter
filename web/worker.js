/**
 * Ultra Parquet Converter — Web Worker
 * Runs Pyodide conversion in a background thread to avoid blocking the UI.
 *
 * The Python conversion code is NOT duplicated here: it is fetched from the
 * single source of truth at ../python/pyodide_convert.py and loaded into
 * Pyodide once. Data is passed via globals (text) and a typed array (binary),
 * never interpolated into source strings.
 *
 * Messages received:  { type: 'init' } | { type: 'convert', data, options }
 * Messages sent:      { type: 'ready' | 'progress' | 'result' | 'error', ... }
 */

'use strict';

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/';
const PY_SOURCE_URL = '../python/pyodide_convert.py';

const LIMITATIONS = [
  'Pyodide is 10-50x slower than native Python',
  'No native filesystem (data is loaded in memory)',
  'Runs in the browser / Node.js with WebAssembly',
];

let pyodide = null;
let initPromise = null;
let sourceLoaded = false;

// ─── Initialization ───────────────────────────────────────────────────────────

async function initPyodide() {
  if (pyodide) return pyodide;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    postMessage({ type: 'progress', stage: '🌐 Loading Pyodide (~100MB)...', percent: 5 });
    importScripts(`${PYODIDE_CDN}pyodide.js`);
    pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });

    postMessage({ type: 'progress', stage: '📦 Installing packages (pandas, pyarrow, numpy)...', percent: 40 });
    await pyodide.loadPackage(['pandas', 'pyarrow', 'numpy']);

    postMessage({ type: 'progress', stage: '✅ Pyodide ready', percent: 100 });
    postMessage({ type: 'ready' });
    return pyodide;
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

/** Fetches and defines upc_convert() in the interpreter once. */
async function ensureSource() {
  if (sourceLoaded) return;
  const res = await fetch(PY_SOURCE_URL);
  if (!res.ok) throw new Error(`Cannot fetch ${PY_SOURCE_URL}: ${res.status}`);
  const source = await res.text();
  await pyodide.runPythonAsync(source);
  sourceLoaded = true;
}

// ─── Conversion ───────────────────────────────────────────────────────────────

async function convert(inputData, options = {}) {
  const startTime = Date.now();

  postMessage({ type: 'progress', stage: '⚙️ Initializing Python engine...', percent: 10 });
  await initPyodide();
  await ensureSource();

  postMessage({ type: 'progress', stage: '🐍 Running Python conversion...', percent: 60 });

  const autoRepair  = options.autoRepair !== false;
  const compression = options.compression || 'snappy';

  let mode;
  if (inputData instanceof ArrayBuffer) {
    mode = 'binary';
    pyodide.globals.set('_upc_bytes', pyodide.toPy(new Uint8Array(inputData)));
  } else {
    mode = 'text';
    pyodide.globals.set('_upc_text', inputData);
  }

  const call = `upc_convert(${JSON.stringify(mode)}, ${autoRepair ? 'True' : 'False'}, ${JSON.stringify(compression)})`;
  const raw = await pyodide.runPythonAsync(call);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Pyodide returned invalid JSON: ${raw}`);
  }

  if (!parsed.success) {
    throw new Error(parsed.error || 'Conversion failed in Python');
  }

  postMessage({ type: 'progress', stage: '✅ Done!', percent: 100 });

  return {
    ...parsed,
    success:      true,
    backend:      'pyodide',
    elapsed_time: (Date.now() - startTime) / 1000,
    limitations:  LIMITATIONS,
  };
}

// ─── Message Handler ──────────────────────────────────────────────────────────

self.onmessage = async (event) => {
  const { type, data, options } = event.data;
  try {
    switch (type) {
      case 'init':
        await initPyodide();
        break;
      case 'convert': {
        const result = await convert(data, options || {});
        postMessage({ type: 'result', result });
        break;
      }
      default:
        postMessage({ type: 'error', message: `Unknown message type: ${type}` });
    }
  } catch (err) {
    postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
