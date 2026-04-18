/**
 * Ultra Parquet Converter — Pyodide Loader
 * Manages the Web Worker lifecycle and provides a clean async API
 * for the main thread to communicate with the worker.
 */

'use strict';

// ─── PyodideConverter class ────────────────────────────────────────────────────

class PyodideConverter {
  constructor() {
    this._worker   = null;
    this._ready    = false;
    this._pending  = null;   // { resolve, reject } for current conversion
    this._onProgress = null; // progress callback
  }

  /**
   * Initializes the Web Worker and waits for Pyodide to be ready.
   * @param {function} onProgress - Callback({ stage, percent })
   * @returns {Promise<void>}
   */
  async init(onProgress) {
    if (this._ready) return;
    this._onProgress = onProgress;

    return new Promise((resolve, reject) => {
      this._worker = new Worker('worker.js');

      this._worker.onmessage = (event) => {
        const { type, stage, percent, result, message } = event.data;

        switch (type) {
          case 'ready':
            this._ready = true;
            resolve();
            break;

          case 'progress':
            if (this._onProgress) {
              this._onProgress({ stage, percent });
            }
            break;

          case 'result':
            if (this._pending) {
              this._pending.resolve(result);
              this._pending = null;
            }
            break;

          case 'error':
            const err = new Error(message);
            if (this._pending) {
              this._pending.reject(err);
              this._pending = null;
            } else {
              reject(err);
            }
            break;
        }
      };

      this._worker.onerror = (error) => {
        const msg = error.message || 'Worker crashed';
        if (this._pending) {
          this._pending.reject(new Error(msg));
          this._pending = null;
        } else {
          reject(new Error(msg));
        }
        this._ready = false;
      };

      // Trigger initialization
      this._worker.postMessage({ type: 'init' });
    });
  }

  /**
   * Converts data to Parquet format.
   * @param {string|ArrayBuffer} data  - Input data (text or binary)
   * @param {object}             options - Conversion options
   * @param {function}           onProgress - Progress callback
   * @returns {Promise<ConversionResult>}
   */
  async convert(data, options = {}, onProgress) {
    if (!this._worker) {
      throw new Error('Worker not initialized. Call init() first.');
    }

    if (this._pending) {
      throw new Error('A conversion is already in progress.');
    }

    this._onProgress = onProgress || this._onProgress;

    return new Promise((resolve, reject) => {
      this._pending = { resolve, reject };

      // Transfer ArrayBuffer for zero-copy transfer
      const transferable = data instanceof ArrayBuffer ? [data] : [];

      this._worker.postMessage({ type: 'convert', data, options }, transferable);
    });
  }

  /**
   * Reads a File object as text or ArrayBuffer based on file type.
   * @param {File} file
   * @returns {Promise<{ data: string|ArrayBuffer, type: 'text'|'binary' }>}
   */
  static async readFile(file) {
    const BINARY_TYPES = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
    ];
    const BINARY_EXTS = ['.xlsx', '.xls', '.parquet', '.feather', '.arrow', '.orc', '.avro', '.sqlite', '.db', '.sav', '.sas7bdat', '.dta'];

    const ext    = '.' + file.name.split('.').pop().toLowerCase();
    const isBin  = BINARY_TYPES.includes(file.type) || BINARY_EXTS.includes(ext);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload  = (e) => resolve({
        data: e.target.result,
        type: isBin ? 'binary' : 'text',
      });
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));

      if (isBin) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file, 'utf-8');
      }
    });
  }

  /**
   * Creates a downloadable Parquet file from the result's parquet_bytes.
   * @param {ConversionResult} result
   * @param {string} originalName
   */
  static downloadParquet(result, originalName) {
    if (!result.parquet_bytes || result.parquet_bytes.length === 0) {
      throw new Error('No parquet bytes in result');
    }

    const bytes = new Uint8Array(result.parquet_bytes);
    const blob  = new Blob([bytes], { type: 'application/octet-stream' });
    const url   = URL.createObjectURL(blob);

    const baseName = originalName.replace(/\.[^/.]+$/, '');
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `${baseName}.parquet`;
    a.click();

    // Revoke after short delay to allow download to start
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /**
   * Terminates the worker. Call when the converter is no longer needed.
   */
  destroy() {
    if (this._worker) {
      this._worker.terminate();
      this._worker  = null;
      this._ready   = false;
      this._pending = null;
    }
  }
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Formats bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k     = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats elapsed time.
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  if (seconds < 1)  return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/**
 * Formats a number with locale separators.
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  return n?.toLocaleString() ?? '—';
}

// ─── Export ───────────────────────────────────────────────────────────────────

window.PyodideConverter = PyodideConverter;
window.formatBytes      = formatBytes;
window.formatTime       = formatTime;
window.formatNumber     = formatNumber;