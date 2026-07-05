# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2025-07-05

### 🧱 Refactor — WASM correcto, sin duplicación, más estructurado

Release enfocado en robustez y limpieza. El objetivo central: que el camino
WebAssembly (Pyodide) funcione de forma consistente y que desaparezca la
duplicación de código entre Node y el navegador.

### 🐛 Fixed

- **Pyodide roto a través del selector.** Los backends exponen `convert(inputFile)`
  (ruta de archivo), pero el backend Pyodide esperaba datos crudos. Al enrutar a
  WASM en Node se le pasaba la ruta como si fuera el CSV. Ahora `convert(path)`
  lee el archivo, convierte y **escribe el `.parquet` a disco**, con
  `input_file`/`output_file` reales.
- **El CLI bloqueaba WASM.** `convert` exigía Python del sistema y hacía `exit(1)`
  antes de cualquier conversión, impidiendo `--backend pyodide`. Ahora Pyodide se
  salta esa verificación (no requiere instalación).
- **Transferencia binaria frágil.** Se eliminó el `bytes([...])` gigante inyectado
  como código Python; los bytes se pasan por `toPy`/globals.

### ✨ Added

- **`PyodideBackend.convertData(data, options)`** — API en memoria para el
  navegador/uso programático (devuelve `parquet_bytes`, sin filesystem).
- **`python/pyodide_convert.py`** — fuente única del código de conversión WASM.

### ♻️ Changed

- **Sin duplicación de código Python.** El generador Python estaba copiado en
  `pyodide-backend.ts` y `web/worker.js`; ahora ambos cargan el mismo
  `python/pyodide_convert.py` e inyectan los datos por globals (sin escaping por
  interpolación de string).
- **Runner Python compartido** (`src/utils/python-runner.ts`): `findPython` y el
  patrón spawn→JSON, antes triplicados en native/portable/cython, viven en un solo
  lugar.
- **`Environment`** deja de estar duplicado: fuente única en `src/types`.
- Portable y Cython ahora respetan `compression`/`workers` como Native (consistencia).
- Tests de integración con Python real se saltan limpiamente si no hay
  `pandas`/`pyarrow` (verde en CI) en vez de fallar.
- **Cobertura de tests al 100%** (statements, branches, functions y lines). Se
  extrajo la detección de runtime a `src/utils/runtime.ts` (Node vs navegador,
  CDN vs node_modules, fs vs fetch) para hacer testeables esas ramas, y se
  eliminó una rama muerta en el runner Python.
- Limpieza de archivos vacíos (docs/ y examples/ placeholders).



### 🎉 Release — TypeScript Hybrid Architecture + Full Test Coverage

This release completes the TypeScript migration started in v1.3.0-dev, adding 4 intelligent backends, parallel processing, adaptive compression, and a fully tested codebase with 148+ passing tests.

---

### ✨ Added

#### 4-Backend Architecture with Auto-Selection
- **Native Python** (`native-python`) — system Python, fastest for general use
- **Portable Python** (`portable-python`) — auto-downloads Python 3.11 (~30MB on Windows, ~50MB on Linux/macOS) on first run; no manual install required
- **Pyodide** (`pyodide`) — WebAssembly backend, zero Python required, works in browser
- **Cython** (`cython`) — compiled `.pyd`/`.so` modules, ultra-fast for large files (>50MB)

Auto-selection priority: Cython (large files >50MB) → Native Python → Portable Python → Pyodide.

#### Python Engine Improvements (`python/converter_advanced.py`)
- `ProcessPoolExecutor` for parallel CSV processing by row ranges
- `ThreadPoolExecutor` for concurrent chunk processing
- `AdaptiveCompressor` — selects best algorithm (snappy/zstd/lz4/gzip/brotli) based on data type and file size
- `--workers <n>` argparse argument (passed from TypeScript)
- `--compression <type>` argparse argument with validation
- `multiprocessing.freeze_support()` for Windows compatibility

#### Cython Modules (`cython/`)
- `fast_csv.pyx` — C-level CSV parser with `-O3 -march=native`
- `fast_parser.pyx` — C-level data parser
- `setup.py` — Cython build with `boundscheck=False`, `wraparound=False`
- Build: `npm run build:cython`
- Detection of `.pyd` (Windows) and `.so` (Linux/macOS) compiled modules

#### CLI Improvements (`src/cli.ts`)
- Progress bar via `cli-progress` for files >1MB
- `watch <directory>` command — auto-converts on file change with debounce + SIGINT handler + periodic stats
- `backends` command — lists all backends and their availability in the current environment
- `--force-backend <type>` option — `native-python | portable-python | pyodide | cython`
- `--workers <n>` option
- `--compression <type>` option — `snappy | zstd | lz4 | gzip | brotli | adaptive`

#### PyodideBackend Improvements (`src/backends/pyodide-backend.ts`)
- Dependency injection via constructor: `new PyodideBackend(loader?, logger?)`
- `PyodideLoader` type — injectable loader for clean tests without module hacks
- `PyodideLogger` interface — injectable logger (`info`, `warn`, `error`); default uses `console`
- Thread-safe `initPromise` — prevents race conditions on concurrent `initialize()` calls
- `initPromise` reset on failure — allows retries after transient errors
- Defensive `JSON.parse` with descriptive error: `Pyodide returned invalid JSON: ...`
- `success=false` check before spread — no longer silences Python-side errors
- No double-wrap protection on `catch` block
- Python pattern: `_result_json = json.dumps(_result)` + `_result_json` as final expression — robust regardless of future code additions
- `JSON.stringify().slice(1,-1)` for data escaping — handles Unicode, backslashes, control characters safely
- `buffer.seek(0)` before Parquet fallback in binary conversion
- `max(len(...), 1)` to prevent `ZeroDivisionError` on empty inputs
- Typed interfaces: `PyodideLoader`, `PyodideLoadOptions`, `PyodideInstance`, `PyodideConversionResult`

#### CythonBackend (`src/backends/cython-backend.ts`)
- `safeParseJSON(str)` helper — distinguishes empty string (returns `{}`) from invalid JSON (throws)
- All error paths: `'Python no encontrado'`, `'Módulos Cython no compilados'`, `'Script Python no encontrado'`, `'Respuesta inválida'`, `'No se pudo ejecutar Python'`
- Detects compiled modules at `.pyd` (Windows) and `.so` (Linux/macOS)

#### NativePythonBackend (`src/backends/native-python.ts`)
- `VALID_COMPRESSIONS` array with validation + fallback warning to `adaptive`
- `--workers` and `--compression` arguments passed to Python script

#### BackendSelector (`src/backends/selector.ts`)
- `forceBackend` as priority 0 in `selectBackend()` — always respected
- `reset()` method for test isolation

#### Test Suite (148+ tests, 7 suites)
- `test/backends.test.ts` — PortablePython, Pyodide, Cython with full mocks (~80 tests)
- `test/native-python.test.ts` — real Python execution (11 tests)
- `test/native-python-mocked.test.ts` — all internal branches mocked (18 tests)
- `test/selector.test.ts` — all 8 `selectBackend` branches, mocked `detectEnvironment` (18 tests)
- `test/integration.test.ts` — end-to-end real conversion (21 tests)
- `test/download.test.ts` — full mock coverage: fs, child_process, node-fetch, extract-zip, cli-progress (~25 tests)
- `test/detect.test.ts` — all platform/cython/portable branches mocked (~20 tests)

#### Package Scripts
- `npm run test:coverage` / `npm run coverage` — jest with coverage report
- `npm run coverage:open` — coverage + opens browser
- `npm run test:watch` — jest watch mode
- `npm run lint` — TypeScript type-check only (`tsc --noEmit`)
- `npm run clean:all` — removes `dist/`, `coverage/`, `node_modules/`

#### Documentation
- `README.md` rewritten in English — full API docs, backend table, architecture, benchmarks
- `README.es.md` — Spanish version
- `IMPLEMENTATION_STATUS.md` — updated to reflect 100% completion
- `.gitignore` — comprehensive: Node, Python, Cython, OS, IDE, coverage
- `.npmignore` — excludes `src/`, `test/`, `coverage/`, `tsconfig.json`, `.venv/`

---

### 🚀 Improved

- **Python version**: standardized to **Python 3.11** for all backends — ensures ABI compatibility across pandas, pyarrow, numpy, and Cython modules
- **Installation**: added `.whl` (wheel) offline install option for air-gapped environments
- **TypeScript types**: all `any` replaced with explicit typed interfaces across all backends
- **Error messages**: descriptive errors throughout — no more generic `"Error"` without context
- **Constants extracted**: `PYODIDE_CDN`, `REQUIRED_PACKAGES`, `LIMITATIONS` as typed `as const` arrays

---

### 🐛 Fixed

- `PyodideBackend`: `json.dumps()` inside `try/except` blocks does not return a value to `runPythonAsync` — fixed by assigning `_result` at module level and using `_result_json` as the final expression
- `PyodideBackend`: race condition where concurrent `initialize()` calls triggered `loadPyodide` multiple times simultaneously
- `PyodideBackend`: `initPromise` leaked as a permanently rejected promise after failure — now resets to `null` in `.catch()`
- `download.ts`: `Readable.fromWeb()` removed — `node-fetch@2` returns a Node.js Readable directly, no conversion needed
- `jest.config.cjs`: renamed from `.json` — required JS syntax for `moduleNameMapper`
- TypeScript downgraded to 5.4.5 for `ts-jest` compatibility

---

### 🔄 Breaking Changes

None. The JavaScript/TypeScript API is 100% backward compatible with v1.1.0.

---

### 📦 Dependencies

#### New
```json
"node-fetch": "^2.7.0",
"extract-zip": "^2.0.1",
"cli-progress": "^3.12.0",
"pyodide": "^0.24.1"
```

#### Dev
```json
"ts-jest": "^29.1.1",
"typescript": "^5.4.5"
```

---

### 📊 Development Stats

- **Test suites**: 7
- **Tests**: 148+
- **Lines added**: ~5,000
- **New files**: 15+
- **Build**: ✅ zero TypeScript errors
- **Coverage**: ~91% statements across `src/backends/`

---

## [1.1.0] - 2025-11-25

### 🎉 Release Mayor — Professional Edition

Biggest update to date, transforming ultra-parquet-converter into a professional enterprise-grade tool with support for 19 formats, streaming, auto-repair, and more.

---

### ✨ Added

#### 10 New Supported Formats

**Structured:**
- HTML (`.html`) — extracts HTML tables automatically
- NDJSON/JSON Lines (`.ndjson`, `.jsonl`) — streaming JSON line-by-line
- YAML (`.yaml`, `.yml`) — configuration files

**Big Data:**
- Feather/Arrow (`.feather`, `.arrow`) — Apache Arrow format
- ORC (`.orc`) — Optimized Row Columnar
- Avro (`.avro`) — Apache Avro

**Databases:**
- SQLite (`.sqlite`, `.db`) — reads first table

**Statistical:**
- SPSS (`.sav`) — IBM SPSS Statistics
- SAS (`.sas7bdat`) — SAS datasets
- Stata (`.dta`) — Stata data files

#### Smart Content-Based Auto-detection
- Magic bytes: SQLite, Parquet, Arrow/Feather, ORC, Avro
- Structure: HTML tags, XML headers, JSON objects, NDJSON, YAML
- Delimiters: auto-detects `,` `\t` `;` `|` `:` for extensionless files

#### Streaming Mode for Giant Files
- Chunk processing: 100,000 rows per chunk
- Constant memory: ~300MB regardless of file size
- Auto-activation for files >100MB

#### Auto-repair
- Removes empty columns
- Auto-converts types (`"123"` string → `123` int64)
- Removes duplicate rows
- Skips corrupt CSV lines gracefully

#### Auto-normalize
- Normalizes column names (`"Customer ID"` → `"customer_id"`)
- Removes constant columns

#### New CLI Commands
- `analyze` — file structure inspection without converting
- `benchmark` — multi-iteration performance measurement
- `validate` — Parquet integrity verification

#### Advanced Result Statistics
```javascript
{
  elapsed_time: 2.34,
  chunks_processed: 15,
  errors_fixed: 23,
  columns_removed: 5,
  streaming_mode: true,
  file_type: "csv"
}
```

---

### 🚀 Improved

- Python multi-command detection: tries `py` → `python3` → `python`
- CSV engine: C engine preferred (5x faster)
- Parquet write: row groups 1M, dictionary encoding, write statistics
- Auto-categorization: columns with <50% unique values → `category` type

---

### 🐛 Fixed

- Windows: Error 9009 "Python not found" — now detects `py` launcher automatically
- Streaming: crash on final chunks, memory leak, writer not closed correctly
- CLI: batch mode not creating output directory, verbose flag not propagating

---

### 🔄 Breaking Changes

**CLI command renamed:**
```bash
# Before (v1.0.3):
ultra-parquet-converter archivo.csv

# After (v1.1.0):
ultra-parquet-converter convert archivo.csv
```

**Python script renamed:**
```
python/converter.py  →  python/converter_advanced.py
```

---

### 📦 New Python Dependencies
```txt
pyyaml>=6.0
fastavro>=1.8.0
pyreadstat>=1.2.0
```

---

## [1.0.3] - 2025-11-16

### ✨ Added

- **3 new formats**: TSV, PSV, DSV with auto-delimiter detection
- CLI command `convert` with alias `c`
- CLI command `batch` with alias `b` for bulk conversion
- CLI command `info` with alias `i`
- `--compression` option: snappy, gzip, brotli, none
- Glob pattern support in batch mode

### 🚀 Improved

- Delimiter auto-detection (`,`, `\t`, `;`, `|`, `:`)
- Batch mode with aggregate statistics
- Clearer error messages

### 🐛 Fixed

- Windows/Linux Python command compatibility
- Relative path handling

---

## [1.0.0] - 2024-11-06

### 🎉 Initial Release

#### Supported Formats (6)
CSV, XLSX/XLS, JSON, XML, TXT, LOG

#### Core Features
- Extension-based auto-detection
- Parquet output with Snappy compression
- Colorful CLI with spinners
- JavaScript API
- Detailed conversion statistics

#### Optimizations
- C engine for CSV (5x faster than Python engine)
- Columnar compression
- Dictionary encoding
- Auto-categorization of repetitive columns

---

## Version Comparison

| Feature | v1.0.0 | v1.0.3 | v1.1.0 | v1.3.0 |
|---------|:------:|:------:|:------:|:------:|
| Formats | 6 | 9 | 19 | **19+** |
| Backends | 1 | 1 | 1 | **4** |
| Auto-detection | Extension | Extension | Content | **Content** |
| Streaming | ❌ | ❌ | ✅ | **✅** |
| Auto-repair | ❌ | ❌ | ✅ | **✅** |
| Parallel processing | ❌ | ❌ | ❌ | **✅** |
| Adaptive compression | ❌ | ❌ | ❌ | **✅** |
| Cython support | ❌ | ❌ | ❌ | **✅** |
| Browser (WebAssembly) | ❌ | ❌ | ❌ | **✅** |
| TypeScript | ❌ | ❌ | ❌ | **✅** |
| Test coverage | ❌ | ❌ | Partial | **148+ tests** |
| CLI commands | 2 | 5 | 7 | **9** |
| Python version | any | any | any | **3.11** |

---

## Types of Changes

- `✨ Added` — new features
- `🚀 Improved` — improvements to existing features
- `🐛 Fixed` — bug fixes
- `🔒 Security` — vulnerability fixes
- `🔄 Breaking Changes` — breaking API changes
- `🗑️ Deprecated` — features to be removed
- `❌ Removed` — removed features

---

## Links

- **NPM**: [ultra-parquet-converter](https://www.npmjs.com/package/ultra-parquet-converter)
- **GitHub**: [Brashkie/ultra-parquet-converter](https://github.com/Brashkie/ultra-parquet-converter)
- **Issues**: [Report bugs](https://github.com/Brashkie/ultra-parquet-converter/issues)
- **Discussions**: [Request features](https://github.com/Brashkie/ultra-parquet-converter/discussions)

---

**Maintainer**: Brashkie (Hepein Oficial)
**License**: Apache-2.0