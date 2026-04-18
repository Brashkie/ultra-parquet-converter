/**
 * Ultra Parquet Converter — Web Worker
 * Runs Pyodide conversion in a background thread to avoid blocking the UI.
 *
 * Messages received from main thread:
 *   { type: 'convert', data: string | ArrayBuffer, options: ConversionOptions }
 *   { type: 'init' }
 *
 * Messages sent to main thread:
 *   { type: 'ready' }
 *   { type: 'progress', stage: string, percent: number }
 *   { type: 'result', result: ConversionResult }
 *   { type: 'error', message: string }
 */

'use strict';

// ─── Pyodide CDN ──────────────────────────────────────────────────────────────

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/';

// ─── State ────────────────────────────────────────────────────────────────────

let pyodide = null;
let isInitializing = false;
let initPromise = null;

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Loads Pyodide and required packages.
 * Thread-safe: multiple calls return the same promise.
 */
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
  })().catch(err => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

// ─── Python Code Generators ───────────────────────────────────────────────────

/**
 * Generates Python code for text-based data (CSV, JSON, TSV, PSV).
 * Uses _result_json pattern — not relying on "last expression" return value.
 */
function generateTextCode(data, options = {}) {
  const escaped    = JSON.stringify(data).slice(1, -1);
  const repairCode = options.autoRepair !== false
    ? `df = df.dropna(axis=1, how='all')\n    df = df.drop_duplicates()`
    : '';
  const compression = options.compression || 'snappy';

  return `
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from io import StringIO, BytesIO
import json

_result = {"success": False, "error": "Unknown error"}

try:
    data_str = "${escaped}"

    if data_str.strip().startswith('[') or data_str.strip().startswith('{'):
        df = pd.read_json(StringIO(data_str))
    elif '\\t' in data_str.split('\\n')[0]:
        df = pd.read_csv(StringIO(data_str), sep='\\t')
    elif '|' in data_str.split('\\n')[0]:
        df = pd.read_csv(StringIO(data_str), sep='|')
    else:
        df = pd.read_csv(StringIO(data_str))

    ${repairCode}

    table = pa.Table.from_pandas(df, preserve_index=False)
    buf = BytesIO()
    pq.write_table(table, buf, compression='${compression}')
    pb = buf.getvalue()

    _result = {
        "success": True,
        "rows": len(df),
        "columns": len(df.columns),
        "input_size": len(data_str),
        "output_size": len(pb),
        "compression_ratio": round((1 - len(pb) / max(len(data_str), 1)) * 100, 2),
        "file_type": "auto-detected",
        "parquet_bytes": list(pb)
    }

except Exception as e:
    _result = {"success": False, "error": str(e)}

_result_json = json.dumps(_result)
_result_json
`;
}

/**
 * Generates Python code for binary data (Excel, Parquet).
 */
function generateBinaryCode(bytes, options = {}) {
  const bytesList  = Array.from(bytes).join(',');
  const compression = options.compression || 'snappy';

  return `
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from io import BytesIO
import json

_result = {"success": False, "error": "Unknown error"}

try:
    raw = bytes([${bytesList}])
    buf = BytesIO(raw)

    try:
        df = pd.read_excel(buf)
    except Exception:
        buf.seek(0)
        try:
            df = pd.read_parquet(buf)
        except Exception:
            raise Exception("Binary format not supported in Pyodide (Excel/Parquet only)")

    table = pa.Table.from_pandas(df, preserve_index=False)
    out = BytesIO()
    pq.write_table(table, out, compression='${compression}')
    pb = out.getvalue()

    _result = {
        "success": True,
        "rows": len(df),
        "columns": len(df.columns),
        "input_size": len(raw),
        "output_size": len(pb),
        "compression_ratio": round((1 - len(pb) / max(len(raw), 1)) * 100, 2),
        "file_type": "binary",
        "parquet_bytes": list(pb)
    }

except Exception as e:
    _result = {"success": False, "error": str(e)}

_result_json = json.dumps(_result)
_result_json
`;
}

// ─── Conversion ───────────────────────────────────────────────────────────────

async function convert(inputData, options = {}) {
  const startTime = Date.now();

  postMessage({ type: 'progress', stage: '⚙️ Initializing Python engine...', percent: 10 });

  await initPyodide();

  postMessage({ type: 'progress', stage: '🔄 Generating conversion code...', percent: 50 });

  const isBuffer  = inputData instanceof ArrayBuffer;
  const pythonCode = isBuffer
    ? generateBinaryCode(new Uint8Array(inputData), options)
    : generateTextCode(inputData, options);

  postMessage({ type: 'progress', stage: '🐍 Running Python conversion...', percent: 65 });

  // Run Python
  const raw = await pyodide.runPythonAsync(pythonCode);

  // Parse result
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
    limitations: [
      'Pyodide is 10-50x slower than native Python',
      'Cannot read files from the filesystem directly',
      'Only works in browser / Node.js with WebAssembly',
    ],
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

      case 'convert':
        const result = await convert(data, options || {});
        postMessage({ type: 'result', result });
        break;

      default:
        postMessage({ type: 'error', message: `Unknown message type: ${type}` });
    }
  } catch (err) {
    postMessage({
      type:    'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};