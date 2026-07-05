"""
Ultra Parquet Converter — Pyodide (WebAssembly) conversion core.

Single source of truth for the WASM path. Loaded verbatim into Pyodide by BOTH:
  - the Node.js backend  (src/backends/pyodide-backend.ts)
  - the browser worker   (web/worker.js)

Data is injected through Pyodide globals — NOT string interpolation into source:
  - text mode   → global `_upc_text`  (str)
  - binary mode → global `_upc_bytes` (bytes-like, written via FS or globals)

The entry point `upc_convert(mode, auto_repair, compression)` returns a JSON string.
Keeping everything in one real .py file means there is no duplicated Python
codegen to drift between the two callers, and no fragile escaping.
"""

import json
from io import StringIO, BytesIO

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq


# Pyodide cannot use zstd/brotli/lz4 codecs reliably; snappy/gzip/none are safe.
_SAFE_CODECS = {"snappy", "gzip", "none"}


def _normalize_compression(compression):
    """Map requested compression to a codec Pyodide/pyarrow-wasm supports."""
    if not compression or compression == "adaptive":
        return "snappy"
    return compression if compression in _SAFE_CODECS else "snappy"


def _read_text(data_str):
    """Detect CSV / TSV / PSV / JSON from a text payload and return a DataFrame."""
    stripped = data_str.lstrip()
    if stripped[:1] in ("[", "{"):
        return pd.read_json(StringIO(data_str)), "json"

    first_line = data_str.split("\n", 1)[0]
    if "\t" in first_line:
        return pd.read_csv(StringIO(data_str), sep="\t"), "tsv"
    if "|" in first_line:
        return pd.read_csv(StringIO(data_str), sep="|"), "psv"
    return pd.read_csv(StringIO(data_str)), "csv"


def _read_binary(raw):
    """Read Excel first, fall back to Parquet, from a bytes payload."""
    buffer = BytesIO(raw)
    try:
        return pd.read_excel(buffer), "excel"
    except Exception:
        buffer.seek(0)
        try:
            return pd.read_parquet(buffer), "parquet"
        except Exception:
            raise ValueError("Binary format not supported (Excel/Parquet only)")


def upc_convert(mode, auto_repair=True, compression="snappy"):
    """
    Convert the injected payload to Parquet bytes.

    Returns a JSON string with either:
      {success: True, rows, columns, input_size, output_size,
       compression_ratio, compression_used, file_type, parquet_bytes}
    or:
      {success: False, error}
    """
    result = {"success": False, "error": "Unknown error"}
    try:
        if mode == "binary":
            raw = bytes(globals()["_upc_bytes"])
            df, file_type = _read_binary(raw)
            input_size = len(raw)
        else:
            data_str = globals()["_upc_text"]
            df, file_type = _read_text(data_str)
            input_size = len(data_str)

        if auto_repair:
            df = df.dropna(axis=1, how="all")
            df = df.drop_duplicates()

        codec = _normalize_compression(compression)
        table = pa.Table.from_pandas(df, preserve_index=False)
        out = BytesIO()
        pq.write_table(table, out, compression=codec)
        parquet_bytes = out.getvalue()

        result = {
            "success": True,
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "input_size": int(input_size),
            "output_size": int(len(parquet_bytes)),
            "compression_ratio": round((1 - len(parquet_bytes) / max(input_size, 1)) * 100, 2),
            "compression_used": codec,
            "file_type": file_type,
            "parquet_bytes": list(parquet_bytes),
        }
    except Exception as exc:  # noqa: BLE001 — surface any failure as JSON
        result = {"success": False, "error": str(exc)}

    return json.dumps(result)
