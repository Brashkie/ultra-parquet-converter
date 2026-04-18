# 🏗️ Architecture Documentation

## System Overview

Ultra Parquet Converter v1.3.0 uses a **hybrid TypeScript/Python architecture** with intelligent backend selection, dependency injection, and parallel processing.

```
┌──────────────────────────────────────────────────────────────┐
│                  User Interface                               │
│              CLI (cli.ts)  /  API (index.ts)                 │
└──────────────────────────────────────────────────────────────┘
                            ▼
          ┌─────────────────────────────────────┐
          │         BackendSelector              │
          │   (Singleton — auto-selects best)    │
          │                                      │
          │  Priority:                           │
          │  0. forceBackend (always respected)  │
          │  1. Cython (file >50MB + compiled)   │
          │  2. Native Python (system Python)    │
          │  3. Portable Python (auto-download)  │
          │  4. Pyodide (browser / WASM)         │
          └─────────────────────────────────────┘
                            ▼
    ┌──────────┬────────────┬────────────┬──────────────┐
    ▼          ▼            ▼            ▼              
┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  
│ Native  │ │ Portable │ │ Pyodide  │ │  Cython    │  
│ Python  │ │ Python   │ │ (WASM)   │ │  Modules   │  
│         │ │ (Auto-dl)│ │ DI-ready │ │ .pyd/.so   │  
└────┬────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  
     │           │             │              │          
     └───────────┴─────────────┴──────────────┘          
                            ▼
              ┌─────────────────────────┐
              │   Python Core Engine    │
              │  converter_advanced.py  │
              │                         │
              │  ProcessPoolExecutor    │
              │  ThreadPoolExecutor     │
              │  AdaptiveCompressor     │
              └─────────────────────────┘
```

---

## Source Tree

```
ultra-parquet-converter/
├── src/
│   ├── index.ts                  # Public API — all exports
│   ├── cli.ts                    # Commander.js CLI (progress bar + watch mode)
│   ├── types/
│   │   └── index.ts              # BackendType, ConversionOptions, ConversionResult
│   ├── backends/
│   │   ├── selector.ts           # BackendSelector singleton
│   │   ├── native-python.ts      # System Python spawn
│   │   ├── portable-python.ts    # Auto-download Python 3.11
│   │   ├── pyodide-backend.ts    # WebAssembly backend (DI loader+logger)
│   │   └── cython-backend.ts     # Compiled .pyd/.so backend
│   └── utils/
│       ├── detect.ts             # EnvironmentDetector (cached singleton)
│       └── download.ts           # PortablePythonDownloader
├── python/
│   └── converter_advanced.py     # Core Python engine
├── cython/
│   ├── fast_csv.pyx              # C-level CSV parser
│   ├── fast_parser.pyx           # C-level data parser
│   ├── setup.py                  # Cython build config
│   └── __init__.py
├── web/
│   ├── index.html                # Browser demo
│   ├── pyodide-loader.js         # Pyodide initialization
│   ├── worker.js                 # Web Worker for background conversion
│   └── styles.css
└── test/
    ├── backends.test.ts          # PortablePython, Pyodide, Cython (mocked)
    ├── native-python.test.ts     # NativePython (real Python execution)
    ├── native-python-mocked.test.ts # NativePython (all branches mocked)
    ├── selector.test.ts          # BackendSelector (mocked detectEnvironment)
    ├── integration.test.ts       # End-to-end conversion
    ├── download.test.ts          # PortablePythonDownloader (all mocked)
    └── detect.test.ts            # EnvironmentDetector (all branches mocked)
```

---

## Components

### 1. Public API (`src/index.ts`)

All public exports, backward-compatible with v1.1.0:

```typescript
export { convertToParquet }         // Main conversion function
export { analyzeFile }              // Analyze without converting
export { benchmarkConversion }      // Performance testing
export { validateParquet }          // Parquet integrity check
export { checkPythonSetup }         // Python installation check
export { clearEnvironmentCache }    // Reset environment cache
export { backendSelector }          // Singleton BackendSelector
export { NativePythonBackend }
export { PortablePythonBackend }
export { PyodideBackend }
export { CythonBackend }
export type { BackendType, ConversionOptions, ConversionResult }
```

---

### 2. CLI (`src/cli.ts`)

Commander.js-based CLI with full feature set:

| Command | Description |
|---------|-------------|
| `convert <file>` | Single file conversion |
| `batch <pattern>` | Glob-pattern bulk conversion |
| `watch <dir>` | Auto-convert on file change (debounce + SIGINT) |
| `analyze <file>` | Inspect structure without converting |
| `benchmark <file>` | Multi-iteration performance test |
| `validate <file>` | Parquet integrity verification |
| `backends` | List all backends + availability |
| `setup` | Install Python dependencies |

Notable CLI features:
- `cli-progress` bar for files >1MB
- Watch mode with periodic stats and SIGINT handler
- `--force-backend` option overrides auto-selection
- `--workers` passes to Python `ProcessPoolExecutor`
- `--compression` validated against `VALID_COMPRESSIONS` list

---

### 3. BackendSelector (`src/backends/selector.ts`)

**Singleton** — one instance for the entire process.

```typescript
class BackendSelector {
  static getInstance(): BackendSelector  // Singleton accessor
  async selectBackend(options?): Promise<BackendType>
  async convert(inputFile, options?): Promise<ConversionResult>
  async getAvailableBackends(): Promise<BackendInfo>
  setBackend(backend: BackendType): void
  getCurrentBackend(): BackendType | null
  reset(): void                          // Test isolation
}
```

**Selection algorithm:**

```
if (options.forceBackend)             → use forceBackend (priority 0)
else if (hasCython && size >50MB)     → 'cython'
else if (hasPython)                   → 'native-python'
else if (isNode)                      → 'portable-python'
else if (isBrowser || hasWebAssembly) → 'pyodide'
else throw 'No backend available'
```

---

### 4. Backends

#### NativePythonBackend (`src/backends/native-python.ts`)

Spawns system Python and executes `converter_advanced.py`.

Key features:
- Detects `py` / `python` / `python3` automatically per platform
- `VALID_COMPRESSIONS` validation with fallback + `console.warn`
- Passes `--workers` and `--compression` to Python script
- `getPythonCommand()` returns `'py'` on win32, `'python3'` on others
- `static isAvailable()` — non-blocking probe via spawn

---

#### PortablePythonBackend (`src/backends/portable-python.ts`)

Auto-downloads Python 3.11 on first run, caches path in instance.

Key features:
- `ensurePortablePython()` — downloads if not installed, returns cached path
- Python cached at `~/.ultra-parquet-converter/python-portable/`
- Second calls reuse `this.pythonPath` — `ensurePortablePython` called only once
- `static isAvailable()` via `getDownloader().isInstalled()`
- `static getInfo()` returns version + path info

---

#### PyodideBackend (`src/backends/pyodide-backend.ts`)

WebAssembly Python backend — the most architecturally complex backend.

**Dependency Injection pattern:**

```typescript
export type PyodideLoader = () => Promise<{ loadPyodide: ... }>;
export interface PyodideLogger { info, warn, error }

class PyodideBackend {
  constructor(loader?: PyodideLoader, logger?: PyodideLogger)
  // Defaults: import('pyodide') + console
}
```

This enables 100% testable code without `jest.mock('pyodide')` hacks — tests inject mock loaders directly.

**Thread-safe initialization:**

```typescript
async initialize(): Promise<void> {
  if (this.isInitialized) return;
  if (!this.initPromise) {
    // Assigned BEFORE await — concurrent calls share the same promise
    this.initPromise = this._doInitialize().catch(err => {
      this.initPromise = null; // Reset on failure → allows retry
      throw err;
    });
  }
  await this.initPromise;
}
```

**Python code pattern:**

```python
# _result assigned at module level — not inside try/except
# This ensures json.dumps(_result) is always the final expression
# returned to runPythonAsync regardless of future code additions
_result = {"success": False, "error": "Unknown error"}
try:
    # ... conversion logic ...
    _result = {"success": True, ...}
except Exception as e:
    _result = {"success": False, "error": str(e)}

_result_json = json.dumps(_result)
_result_json  # ← final expression → returned to runPythonAsync
```

**Defensive JSON parsing:**

```typescript
let parsed: PyodideConversionResult;
try {
  parsed = JSON.parse(raw);
} catch {
  throw new Error(`Pyodide returned invalid JSON: ${raw}`);
}
if (!parsed.success) {
  throw new Error(parsed.error ?? 'Error desconocido en Pyodide');
}
```

**Data escaping:**

```typescript
// JSON.stringify handles Unicode, backslashes, control chars safely
// .slice(1,-1) removes the outer quotes added by JSON.stringify
const escapedData = JSON.stringify(data).slice(1, -1);
```

---

#### CythonBackend (`src/backends/cython-backend.ts`)

Finds compiled `.pyd` (Windows) or `.so` (Linux/macOS) modules and executes `converter_advanced.py` with `CYTHON_ENABLED=1`.

**`safeParseJSON` helper:**

```typescript
function safeParseJSON(str: string): any {
  if (!str || !str.trim()) return {};  // Empty → no throw, return {}
  return JSON.parse(str);              // Invalid JSON → throws SyntaxError
}
```

This allows the catch block to distinguish between "no output" and "invalid output" for proper error messages.

Module detection:
```typescript
const patterns = [
  /^fast_(csv|parser)\.cp\d+-win_amd64\.pyd$/,            // Windows
  /^fast_(csv|parser)\.cpython-\d+-x86_64-linux-gnu\.so$/, // Linux
  /^fast_(csv|parser)\.cpython-\d+-darwin\.so$/,           // macOS
];
```

---

### 5. Utilities

#### EnvironmentDetector (`src/utils/detect.ts`)

Singleton with cached result — detects environment once per process.

```typescript
interface Environment {
  platform: NodeJS.Platform;
  isWindows, isLinux, isMac: boolean;
  isNode, isBrowser: boolean;
  hasPython: boolean;
  pythonCommand?: string;
  pythonVersion?: string;
  hasCython: boolean;
  cythonModules?: string[];
  hasPortablePython: boolean;
  portablePythonPath?: string;
  hasWebAssembly: boolean;
}
```

Python detection tries candidates in order (`py`, `python3`, `python` depending on platform) via spawn, catching any error gracefully. Result is cached — `clearEnvironmentCache()` resets.

---

#### PortablePythonDownloader (`src/utils/download.ts`)

Downloads Python 3.11 for the current platform:

| Platform | Source | Size |
|----------|--------|------|
| Windows | python.org embed zip | ~10MB |
| Linux | indygreg/python-build-standalone | ~50MB |
| macOS | indygreg/python-build-standalone | ~45MB |

Flow:
1. Download zip/tar.gz with `cli-progress` bar
2. Extract (zip on Windows, `tar -xzf` on Linux/macOS)
3. `chmod 755` on Linux/macOS
4. Verify with `python --version`
5. Download and run `get-pip.py`
6. Install `requirements.txt`

---

### 6. Python Core Engine (`python/converter_advanced.py`)

The actual conversion engine, shared by all Python-based backends.

**Parallel processing architecture:**

```python
# ProcessPoolExecutor: splits CSV into row ranges, each worker processes a chunk
with ProcessPoolExecutor(max_workers=workers) as executor:
    futures = [executor.submit(process_chunk, file, start, end) for start, end in ranges]

# ThreadPoolExecutor: concurrent chunk I/O
with ThreadPoolExecutor() as executor:
    futures = [executor.submit(write_chunk, chunk) for chunk in chunks]
```

**AdaptiveCompressor:**

```python
class AdaptiveCompressor:
    def analyze(self, df: pd.DataFrame) -> str:
        # Selects based on:
        # - Data type distribution (numeric-heavy → lz4, text-heavy → zstd)
        # - File size (small → snappy, large → zstd)
        # - Column cardinality
```

---

### 7. Cython Modules (`cython/`)

Optional compiled extensions for maximum performance:

```
fast_csv.pyx     # C-level CSV parsing with FILE* and fgets()
fast_parser.pyx  # C-level data type inference and normalization
setup.py         # -O3 -march=native, boundscheck=False, wraparound=False
```

Build:
```bash
npm run build:cython
# Windows: .venv/Scripts/python.exe setup.py build_ext --inplace
# Outputs: fast_csv.cp311-win_amd64.pyd, fast_parser.cp311-win_amd64.pyd
```

---

## Design Patterns

### Singleton
`BackendSelector` and `EnvironmentDetector` — one instance per process ensures consistent state and avoids redundant environment detection.

### Strategy
Each backend implements `BackendInterface` — interchangeable at runtime with identical API surface.

### Dependency Injection
`PyodideBackend(loader?, logger?)` — injects loader and logger. Enables 100% testable code without global mocks. Default behavior is preserved via `??` fallback.

### Factory
`getDownloader()` returns the `PortablePythonDownloader` singleton. `BackendSelector.getInstance()` returns the selector singleton.

---

## Data Flow

### Conversion

```
1. User: convertToParquet('file.csv', options)
2. BackendSelector.convert() → selectBackend() → 'native-python'
3. NativePythonBackend.convert() → spawn('py', ['converter_advanced.py', 'file.csv', ...])
4. Python: detect format → read (streaming?) → repair → normalize → write Parquet
5. Python: print JSON result to stdout
6. TypeScript: JSON.parse(stdout) → return ConversionResult
```

### Pyodide Conversion

```
1. User: backend.convert('id,name\n1,Juan')
2. initialize() → loader() → loadPyodide() [once, cached via initPromise]
3. generateTextConversionCode(data, options) → Python string
4. pyodide.runPythonAsync(code) → _result_json
5. JSON.parse(_result_json) → check success → return ConversionResult
```

---

## Error Handling Hierarchy

```
BackendSelector.convert()
  └── NativePythonBackend.convert()
        └── executePython()
              ├── proc.on('close', code !== 0) → parse JSON error or fallback
              ├── proc.on('close', code === 0) → parse result, check success=false
              └── proc.on('error') → 'Error ejecutando Python: ...'

PyodideBackend.convert()
  ├── initialize() → _doInitialize() → .catch() → initPromise = null (retry allowed)
  ├── pyodide.runPythonAsync() → raw JSON
  ├── JSON.parse(raw) → catch → 'Pyodide returned invalid JSON: ...'
  ├── parsed.success === false → throw parsed.error
  └── catch(error) → no double-wrap → 'Pyodide conversion failed: ...'
```

All errors propagate to the user with context — no silent failures.

---

## Performance Characteristics

| Backend | Relative Speed | RAM Usage | First-run Cost |
|---------|:-------------:|:---------:|:--------------:|
| Cython | 🚀🚀🚀🚀🚀 (1x baseline) | Low | Compilation required |
| Native Python | ⚡⚡⚡⚡ (2–3x slower) | Medium | Python 3.11 installed |
| Portable Python | ⚡⚡⚡ (3–4x slower) | Medium | ~30–50MB download |
| Pyodide | ⚡⚡ (10–50x slower) | High (~100MB) | ~100MB WASM load |

All backends support streaming mode (100K rows/chunk, ~300MB RAM constant) except Pyodide which operates entirely in-memory.

---

## Scalability

### Vertical (single process)
- Streaming mode: constant ~300MB RAM for any file size
- Parallel workers: `ProcessPoolExecutor` for multi-core CPU utilization
- Adaptive compression: reduces I/O bottleneck

### Horizontal (multi-process)
- Each `BackendSelector` instance is independent
- Multiple Node.js processes can run in parallel
- Pyodide backend is safe for concurrent browser tabs via Web Workers

---

## Security

- No `eval()` or arbitrary code execution from user input
- Python subprocess receives file path + validated options only
- Pyodide runs in WebAssembly sandbox (no filesystem access from browser)
- All file paths are validated via `existsSync` before processing
- Compression type validated against whitelist (`VALID_COMPRESSIONS`)

---

## Testing Architecture

**7 test suites, 148+ tests:**

| Suite | Scope | Mocks |
|-------|-------|-------|
| `backends.test.ts` | PortablePython, Pyodide, Cython | child_process, fs, pyodide, download |
| `native-python.test.ts` | NativePython | None (real Python) |
| `native-python-mocked.test.ts` | NativePython branches | child_process |
| `selector.test.ts` | BackendSelector | detectEnvironment |
| `integration.test.ts` | End-to-end | None (real conversion) |
| `download.test.ts` | PortablePythonDownloader | fs, child_process, node-fetch, extract-zip, cli-progress |
| `detect.test.ts` | EnvironmentDetector | child_process, fs, fs/promises |

**PyodideBackend testability** is achieved entirely through DI — no `jest.mock('pyodide')` needed:
```typescript
const mockLoader = jest.fn().mockResolvedValue({ loadPyodide: jest.fn().mockResolvedValue(mockPyodide) });
const backend = new PyodideBackend(mockLoader, mockLogger);
```

---

## Future Architecture

### v1.4.0
- REST API server (Express + TypeScript) with `/convert`, `/backends`, `/status` endpoints
- TypeScript SDK with Hono.js + tRPC for ApexVision-Core integration
- Cloud storage backends (S3, GCS, Azure Blob) — new `BackendInterface` implementations
- Delta Lake output format

### v2.0.0
- Plugin system — custom format parsers as npm packages
- Distributed processing — multiple worker nodes
- Apache Iceberg + Delta Lake table support
- Real-time streaming via WebSockets
- GUI web interface (React + Pyodide)

---

**Last Updated**: v1.3.0 — April 2025
**Author**: Hepein Oficial × Brashkie