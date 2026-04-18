# 🚀 Ultra Parquet Converter v1.3.0

[![npm version](https://img.shields.io/npm/v/ultra-parquet-converter.svg)](https://www.npmjs.com/package/ultra-parquet-converter)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-yellow.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Python Version](https://img.shields.io/badge/python-3.11-blue)](https://python.org)
[![Downloads](https://img.shields.io/npm/dm/ultra-parquet-converter.svg)](https://www.npmjs.com/package/ultra-parquet-converter)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org)

**Professional hybrid Parquet converter** with streaming, auto-repair and support for **19+ formats**.

Combines the speed of Node.js with the power of Python + Apache Arrow for ultra-fast conversions, processing of massive files without memory overflow, and automatic repair of corrupted data — with **4 backends** that require zero configuration.

> 📖 [Versión en Español](README.es.md)

---

## ✨ Key Features

### 🎯 Core
- 🔍 **Smart auto-detection** — by extension AND file content
- ⚡ **Ultra-fast** — Apache Arrow + optimized Pandas
- 🌊 **Streaming mode** — process 1GB, 5GB, 20GB+ files without memory overflow
- 🔧 **Auto-repair** — fixes corrupt CSVs, removes empty columns
- 📊 **Auto-normalize** — normalizes names, detects types automatically
- 🌐 **Cross-platform** — Windows, Linux, macOS
- 🐍 **Flexible Python detection** — detects `py`, `python`, `python3` automatically

### 🚀 Advanced (v1.3.0)
- 🏗️ **4 backends** with automatic selection: Native Python, Portable Python, Pyodide (WebAssembly), Cython
- ⚡ **Parallel processing** — `ProcessPoolExecutor` + `ThreadPoolExecutor`
- 🧠 **Adaptive compression** — automatically selects snappy / zstd / lz4 / gzip / brotli
- 🌐 **Browser support** — Pyodide backend runs in the browser via WebAssembly (no Python needed)
- 📦 **Auto-download Python** — Portable Python backend downloads Python 3.11 automatically if not installed
- 🔄 **Batch processing** — convert hundreds of files
- 📈 **Built-in benchmarking** — speed, throughput, memory
- 🎨 **Beautiful CLI** — colors, spinners, progress bar, detailed stats

---

## 📋 Supported Formats (19+)

### Delimited Files
| Format | Extensions | Auto-detect |
|--------|-----------|-------------|
| CSV | `.csv` | ✅ |
| TSV | `.tsv` | ✅ |
| PSV | `.psv` | ✅ |
| DSV | `.dsv`, `.txt`, `.log` | ✅ |

### Spreadsheets
| Format | Extensions | Auto-detect |
|--------|-----------|-------------|
| Excel | `.xlsx`, `.xls` | ✅ |

### Structured Formats
| Format | Extensions | Auto-detect |
|--------|-----------|-------------|
| JSON | `.json` | ✅ |
| NDJSON / JSON Lines | `.ndjson`, `.jsonl` | ✅ |
| XML | `.xml` | ✅ |
| YAML | `.yaml`, `.yml` | ✅ |
| HTML | `.html` | ✅ |

### Big Data Formats
| Format | Extensions | Auto-detect |
|--------|-----------|-------------|
| Feather / Arrow | `.feather`, `.arrow` | ✅ Magic bytes |
| ORC | `.orc` | ✅ Magic bytes |
| Avro | `.avro` | ✅ Magic bytes |

### Databases
| Format | Extensions | Auto-detect |
|--------|-----------|-------------|
| SQLite | `.sqlite`, `.db` | ✅ Magic bytes |

### Statistical Formats
| Format | Extensions | Auto-detect |
|--------|-----------|-------------|
| SPSS | `.sav` | By extension |
| SAS | `.sas7bdat` | By extension |
| Stata | `.dta` | By extension |

---

## 🏗️ Backends

| Backend | Speed | Requires | Best for |
|---------|-------|----------|----------|
| **Cython** | 🚀🚀🚀🚀🚀 | Python 3.11 + compiled modules | Large files (>50MB) |
| **Native Python** | ⚡⚡⚡⚡⚡ | Python 3.11 | General purpose |
| **Portable Python** | ⚡⚡⚡⚡ | Node.js (auto-downloads Python 3.11) | No Python installed |
| **Pyodide** | ⚡⚡ | None (WebAssembly) | Browser / no Python |

**Auto-selection priority**: Cython (large files) → Native Python → Portable Python → Pyodide.

> **No Python installed?** No problem — the **Portable Python** backend downloads Python 3.11 automatically on first run (~30MB on Windows, ~50MB on Linux/macOS). The **Pyodide** backend works with zero installation via WebAssembly, even in the browser.

---

## 🔧 Installation

### Prerequisites

```bash
# Node.js ≥ 18.0.0
node --version
```

**Python 3.11 is recommended** for Native Python and Cython backends. Other versions are not guaranteed to be compatible with all dependencies.

```bash
# Verify Python version (must be 3.11.x)
py --version        # Windows
python --version    # Windows/Linux
python3 --version   # Linux/macOS

# If you don't have Python 3.11:
# → Windows:  https://www.python.org/downloads/release/python-3119/
# → macOS:    brew install python@3.11
# → Ubuntu:   sudo apt install python3.11 python3.11-pip
```

> **No Python? No problem.** Just install the npm package — the Portable Python and Pyodide backends work without any Python installation.

### Install NPM Package

```bash
# Global (recommended for CLI use)
npm install -g ultra-parquet-converter

# Or local
npm install ultra-parquet-converter
```

### Install Python 3.11 Dependencies

#### Option 1: Automatic (recommended)

```bash
ultra-parquet-converter setup
```

#### Option 2: pip (standard)

```bash
pip install pandas pyarrow numpy openpyxl lxml pyyaml fastavro pyreadstat
```

#### Option 3: .whl (offline / air-gapped environments)

If you don't have internet access or want exact pre-compiled wheel files for Python 3.11:

```bash
# Download wheels for your platform from PyPI (https://pypi.org)
# Example for Windows amd64 + Python 3.11:
pip install pandas-2.1.4-cp311-cp311-win_amd64.whl
pip install pyarrow-14.0.1-cp311-cp311-win_amd64.whl
pip install numpy-1.26.2-cp311-cp311-win_amd64.whl

# Or install all at once from a local wheels folder:
pip install --no-index --find-links=./wheels pandas pyarrow numpy openpyxl lxml pyyaml fastavro pyreadstat
```

Download wheels for your platform from [https://pypi.org](https://pypi.org) — search for the package name and filter by `cp311` (CPython 3.11) and your OS (`win_amd64`, `linux_x86_64`, `macosx`).

---

## 🚀 Quick Start

### CLI

```bash
# Simple conversion
ultra-parquet-converter convert data.csv

# With options
ultra-parquet-converter convert data.json -o output.parquet --streaming -v

# Multiple files
ultra-parquet-converter batch "*.csv" -o converted/

# Help
ultra-parquet-converter --help
```

### JavaScript / TypeScript API

```typescript
import { convertToParquet } from 'ultra-parquet-converter';

// Auto backend selection
const result = await convertToParquet('data.csv');
console.log(`${result.rows} rows → ${result.compression_ratio}% compression`);
console.log(`Backend: ${result.backend}`);

// With full options
const result = await convertToParquet('huge_file.csv', {
  output: 'output.parquet',
  compression: 'zstd',        // snappy | zstd | lz4 | gzip | brotli | adaptive
  streaming: true,
  autoRepair: true,
  autoNormalize: true,
  parallelWorkers: 4,
  verbose: true,
  forceBackend: 'cython',     // Force a specific backend
});
```

---

## 📚 Full CLI Reference

### `convert` — Single File Conversion

```bash
ultra-parquet-converter convert <file> [options]
# Alias: upc c <file>
```

**Options:**
- `-o, --output <file>` — custom output path
- `-v, --verbose` — detailed logs
- `--streaming` — streaming mode for files >100MB
- `--no-repair` — disable auto-repair
- `--no-normalize` — disable auto-normalize
- `--compression <type>` — snappy, zstd, lz4, gzip, brotli, adaptive
- `--workers <n>` — number of parallel workers
- `--benchmark` — show performance metrics
- `--force-backend <name>` — native-python | portable-python | pyodide | cython

**Examples:**

```bash
ultra-parquet-converter convert sales.csv
ultra-parquet-converter convert data.json -o analytics/data.parquet
ultra-parquet-converter convert huge_log.csv --streaming --compression zstd -v
ultra-parquet-converter convert raw_data.csv --no-repair --no-normalize
ultra-parquet-converter convert big_file.csv --force-backend cython --workers 4
```

**Sample output:**
```
🔄 Ultra Parquet Converter v1.3.0

✓ Python 3.11 installed (command: py)
✓ Conversion successful!

📊 Results:

   Source file:     sales.csv
   Output file:     sales.parquet
   Detected type:   CSV
   Backend:         native-python
   Compression:     snappy
   Rows:            125,430
   Columns:         18
   Original size:   25.4 MB
   Parquet size:    4.2 MB
   Compression:     83.5%
   Time:            2.34s
   Workers:         4
```

---

### `batch` — Bulk Conversion

```bash
ultra-parquet-converter batch <pattern> [options]
# Alias: upc b <pattern>
```

**Options:**
- `-o, --output-dir <dir>` — output directory (default: `./output`)
- `-v, --verbose` — verbose mode
- `--streaming` — enable streaming for all files
- `--workers <n>` — parallel workers

**Examples:**

```bash
ultra-parquet-converter batch "*.csv"
ultra-parquet-converter batch "data/*.json" -o converted/
ultra-parquet-converter batch "logs/*.log" --streaming -v
```

---

### `watch` — Watch Mode

```bash
ultra-parquet-converter watch <directory> [options]
```

Automatically converts new or modified files. Uses debounce to avoid duplicate conversions.

```bash
ultra-parquet-converter watch ./data/
ultra-parquet-converter watch ./incoming/ -o ./processed/ --streaming
```

---

### `analyze` — File Analysis

```bash
ultra-parquet-converter analyze <file>
# Alias: upc a <file>
```

Inspects file structure without converting.

---

### `benchmark` — Performance Test

```bash
ultra-parquet-converter benchmark <file> [options]
```

**Options:**
- `--iterations <n>` — number of iterations (default: 3)
- `--streaming` — test with streaming enabled

---

### `validate` — Validate Parquet

```bash
ultra-parquet-converter validate <file.parquet>
```

Verifies the integrity of a Parquet file.

---

### `backends` — List Available Backends

```bash
ultra-parquet-converter backends
```

Shows all backends and their availability in the current environment.

---

### `setup` — Install Python Dependencies

```bash
ultra-parquet-converter setup
```

---

## 💻 Full JavaScript API

### `convertToParquet(inputFile, options?)`

```typescript
const result = await convertToParquet('data.csv', {
  output?: string,
  compression?: 'snappy' | 'zstd' | 'lz4' | 'gzip' | 'brotli' | 'adaptive',
  streaming?: boolean,
  autoRepair?: boolean,
  autoNormalize?: boolean,
  parallelWorkers?: number,
  verbose?: boolean,
  forceBackend?: 'native-python' | 'portable-python' | 'pyodide' | 'cython',
  fileSize?: number,
});
```

**Returns:**

```typescript
{
  success: boolean,
  backend: string,
  rows: number,
  columns: number,
  input_size: number,        // bytes
  output_size: number,       // bytes
  compression_ratio: number, // percentage
  compression_used: string,
  elapsed_time: number,      // seconds
  streaming_mode: boolean,
  parallel_workers: number,
  errors_fixed: number,
  columns_removed: number,
  chunks_processed: number,
  limitations?: string[],    // Pyodide only
}
```

### `backendSelector` — Manual Backend Control

```typescript
import { backendSelector } from 'ultra-parquet-converter';

// Force a specific backend
backendSelector.setBackend('cython');

// Check current backend
console.log(backendSelector.getCurrentBackend());

// List all backends
const info = await backendSelector.getAvailableBackends();
```

### Other exports

```typescript
import {
  convertToParquet,
  analyzeFile,
  benchmarkConversion,
  validateParquet,
  checkPythonSetup,
  clearEnvironmentCache,
  backendSelector,
  NativePythonBackend,
  PortablePythonBackend,
  PyodideBackend,
  CythonBackend,
} from 'ultra-parquet-converter';
```

---

## 🔥 Real Use Cases

### 1. ETL Pipeline

```typescript
async function etlPipeline(inputDir: string, outputDir: string) {
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv'));

  for (const file of files) {
    const result = await convertToParquet(path.join(inputDir, file), {
      output: path.join(outputDir, file.replace('.csv', '.parquet')),
      streaming: true,
      autoRepair: true,
      autoNormalize: true,
      compression: 'zstd',
    });
    console.log(`✓ ${file}: ${result.compression_ratio}% compression, ${result.errors_fixed} errors fixed`);
  }
}
```

### 2. ML Dataset Preparation

```typescript
for (const dataset of ['train.csv', 'test.csv', 'validation.csv']) {
  const result = await convertToParquet(`data/${dataset}`, {
    output: `data/parquet/${dataset.replace('.csv', '.parquet')}`,
    autoRepair: true,
    parallelWorkers: 4,
  });
  console.log(`${dataset}: ${result.rows} rows, ${result.columns_removed} columns removed`);
}
```

### 3. Massive Log Processing (Streaming)

```typescript
const result = await convertToParquet('server-logs-2025.log', {
  output: 'logs/2025.parquet',
  streaming: true,      // CRITICAL for large files
  autoRepair: true,
  compression: 'lz4',   // Fast compression for logs
});
console.log(`${result.chunks_processed} chunks processed, <300MB RAM used`);
```

### 4. Browser Use (No Python Required)

```typescript
import { PyodideBackend } from 'ultra-parquet-converter';

const backend = new PyodideBackend();
const result = await backend.convert('id,name\n1,Alice\n2,Bob');
console.log(`Converted ${result.rows} rows in browser via WebAssembly`);
```

### 5. SQLite → Parquet Migration

```typescript
const result = await convertToParquet('production.sqlite', {
  output: 'backup/production.parquet',
  forceBackend: 'native-python',
});
console.log(`${result.rows} rows migrated, ${result.compression_ratio}% smaller`);
```

---

## 📊 Performance Benchmarks

### Small Files (<100MB)
| Size | Rows | Format | Time | Speed | Compression |
|------|------|--------|------|-------|-------------|
| 10 MB | 100K | CSV | 0.8s | 125K rows/s | 82% |
| 25 MB | 250K | JSON | 1.2s | 208K rows/s | 75% |
| 50 MB | 500K | XLSX | 3.5s | 143K rows/s | 88% |

### Large Files (Streaming)
| Size | Rows | Format | Time | Speed | RAM Used |
|------|------|--------|------|-------|----------|
| 5 GB | 50M | CSV | 4m 30s | 185K rows/s | 280 MB |
| 10 GB | 100M | LOG | 8m 15s | 202K rows/s | 290 MB |
| 20 GB | 200M | TSV | 16m 40s | 200K rows/s | 300 MB |

**Without streaming, files above 1GB cause Out of Memory.**

---

## 🛠️ Advanced Features

### Auto-repair

Automatically detects and fixes:

- **Empty columns** — removed automatically
- **Wrong types** — `"123"` (string) → `123` (int64)
- **Duplicate rows** — removed
- **Corrupt CSV lines** — skipped gracefully

```bash
# Disable auto-repair
ultra-parquet-converter convert data.csv --no-repair
```

### Auto-normalize

- **Column names**: `"Customer ID"` → `"customer_id"`
- **Constant columns** → removed (saves space)

```bash
# Disable auto-normalize
ultra-parquet-converter convert data.csv --no-normalize
```

### Smart Format Detection

By **extension** (fast) + **content** (smart):

```
file.txt with commas    → CSV
file.dat with tabs      → TSV
file.data (magic "PAR1") → Parquet
file.db (magic "SQLite") → SQLite
```

---

## 🎯 Why Parquet?

| Feature | CSV | JSON | Excel | Parquet |
|---------|-----|------|-------|---------|
| **Size** | 100% | 120% | 80% | **15–30%** ⚡ |
| **Read speed** | 1x | 0.8x | 0.5x | **10–100x** ⚡ |
| **Compression** | ❌ | ❌ | ✅ | **✅✅✅** |
| **Schema** | ❌ | Partial | ✅ | **✅ Strong** |
| **Columnar** | ❌ | ❌ | ❌ | **✅** |
| **Big Data** | Slow | Slow | ❌ | **✅ Optimized** |

---

## 🐛 Troubleshooting

### "Python not found"

```bash
# Install Python 3.11 from https://www.python.org/downloads/release/python-3119/
# Check "Add Python to PATH" during installation

# macOS:
brew install python@3.11

# Ubuntu/Debian:
sudo apt install python3.11 python3.11-pip

# Verify:
py --version      # Windows → should show Python 3.11.x
python3 --version # Linux/macOS → should show Python 3.11.x
```

### "Missing Python dependencies"

```bash
# Automatic:
ultra-parquet-converter setup

# Manual with pip:
pip install pandas pyarrow numpy openpyxl lxml pyyaml fastavro pyreadstat

# Offline with .whl files (air-gapped environments):
pip install --no-index --find-links=./wheels pandas pyarrow numpy openpyxl lxml pyyaml fastavro pyreadstat
# Download cp311 wheels from https://pypi.org for your platform
```

### "Incompatible library versions"

Always use **Python 3.11** to ensure all dependencies compile and link correctly against the same ABI. Mixing Python versions (e.g. 3.10 pandas with 3.11 pyarrow) can cause subtle import errors.

```bash
# Check your Python version:
py --version    # Should be 3.11.x

# If multiple Python versions are installed, pin explicitly:
py -3.11 -m pip install pandas pyarrow numpy
```

### Out of Memory

```bash
ultra-parquet-converter convert huge_file.csv --streaming
# Or increase Node.js memory:
NODE_OPTIONS="--max-old-space-size=4096" ultra-parquet-converter convert file.csv
```

---

## 🏗️ Architecture

```
ultra-parquet-converter/
├── src/
│   ├── backends/
│   │   ├── native-python.ts      # System Python backend
│   │   ├── portable-python.ts    # Auto-download Python 3.11 backend
│   │   ├── pyodide-backend.ts    # WebAssembly backend (DI loader+logger)
│   │   ├── cython-backend.ts     # Compiled Cython modules backend
│   │   └── selector.ts           # Automatic backend selector
│   ├── utils/
│   │   ├── detect.ts             # Environment detection with caching
│   │   └── download.ts           # Portable Python 3.11 downloader
│   ├── cli.ts                    # CLI (progress bar + watch mode)
│   └── index.ts                  # Public API
├── python/
│   └── converter_advanced.py     # Python engine (parallel + adaptive compression)
├── cython/
│   ├── fast_csv.pyx              # Cython CSV parser
│   ├── fast_parser.pyx           # Cython data parser
│   └── setup.py
└── web/
    └── worker.js                 # Web Worker for browser use
```

---

## 🔨 Building Cython Modules

For maximum performance on large files (requires Python 3.11):

```bash
pip install cython pandas pyarrow numpy
npm run build:cython
```

---

## 🛠️ Development

```bash
npm run build          # Compile TypeScript
npm test               # Run tests
npm run coverage       # Tests with coverage report
npm run coverage:open  # Coverage + open in browser
npm run dev            # Watch mode
npm run lint           # Type check only
```

---

## 📈 Roadmap

### v1.4.0
- [ ] REST API server mode
- [ ] Cloud integration (S3, GCS, Azure Blob)
- [ ] TypeScript SDK with Hono.js + tRPC (ApexVision-Core)
- [ ] Delta Lake output

### v2.0.0
- [ ] Custom format plugins
- [ ] Apache Iceberg support
- [ ] Streaming SQL queries
- [ ] GUI web interface

---

## 🤝 Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/MyFeature`
3. Commit: `git commit -m 'feat: add MyFeature'`
4. Push: `git push origin feature/MyFeature`
5. Open a Pull Request

**Bug reports:** include version, OS, exact Python version (`py --version`), Node.js version, exact command, and full error output.

---

## 📝 License

Apache-2.0 — see [LICENSE](LICENSE)

---

## 🙏 Acknowledgements

- **Apache Arrow** + **PyArrow** — columnar storage engine
- **Pandas** — Python data manipulation
- **NumPy** — numerical computing
- **Commander.js** — CLI framework
- **Chalk** + **Ora** + **cli-progress** — terminal UX
- **openpyxl**, **lxml**, **PyYAML**, **fastavro**, **pyreadstat** — format parsers

---

**Made with ❤️ for the Data Engineering community**

**Author: Hepein Oficial × Brashkie** — [github.com/Brashkie](https://github.com/Brashkie)

⭐ If you find this useful, [star it on GitHub](https://github.com/Brashkie/ultra-parquet-converter)!

---

**Version**: 1.3.0 | **Python**: 3.11 | **License**: Apache-2.0 | **NPM**: [ultra-parquet-converter](https://www.npmjs.com/package/ultra-parquet-converter)