# 🚀 Ultra Parquet Converter v1.3.0

[![npm version](https://img.shields.io/npm/v/ultra-parquet-converter.svg)](https://www.npmjs.com/package/ultra-parquet-converter)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-yellow.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Python Version](https://img.shields.io/badge/python-3.11-blue)](https://python.org)
[![Downloads](https://img.shields.io/npm/dm/ultra-parquet-converter.svg)](https://www.npmjs.com/package/ultra-parquet-converter)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org)

**Conversor Parquet híbrido profesional** con streaming, auto-reparación y soporte para **19+ formatos**.

Combina la velocidad de Node.js con el poder de Python + Apache Arrow para conversiones ultra-rápidas, procesamiento de archivos masivos sin explotar memoria, y reparación automática de datos corruptos — con **4 backends** que no requieren configuración.

> 📖 [English version](README.md)

---

## ✨ Características Principales

### 🎯 Core
- 🔍 **Auto-detección inteligente** — por extensión Y contenido del archivo
- ⚡ **Ultra-rápido** — Apache Arrow + Pandas optimizado
- 🌊 **Modo streaming** — procesa archivos de 1GB, 5GB, 20GB+ sin explotar la memoria
- 🔧 **Auto-reparación** — corrige CSVs corruptos, elimina columnas vacías
- 📊 **Auto-normalización** — normaliza nombres, detecta tipos automáticamente
- 🌐 **Multiplataforma** — Windows, Linux, macOS
- 🐍 **Python flexible** — detecta `py`, `python`, `python3` automáticamente

### 🚀 Avanzado (v1.3.0)
- 🏗️ **4 backends** con selección automática: Python Nativo, Python Portable, Pyodide (WebAssembly), Cython
- ⚡ **Procesamiento paralelo** — `ProcessPoolExecutor` + `ThreadPoolExecutor`
- 🧠 **Compresión adaptativa** — selecciona automáticamente snappy / zstd / lz4 / gzip / brotli
- 🌐 **Soporte navegador** — el backend Pyodide funciona en el navegador vía WebAssembly (sin Python)
- 📦 **Python auto-descarga** — el backend Portable Python descarga Python 3.11 automáticamente si no está instalado
- 🔄 **Procesamiento batch** — convierte cientos de archivos
- 📈 **Benchmarking integrado** — velocidad, throughput, memoria
- 🎨 **CLI hermoso** — colores, spinners, barra de progreso, estadísticas detalladas

---

## 📋 Formatos Soportados (19+)

### Archivos Delimitados
| Formato | Extensiones | Auto-detección |
|---------|------------|----------------|
| CSV | `.csv` | ✅ |
| TSV | `.tsv` | ✅ |
| PSV | `.psv` | ✅ |
| DSV | `.dsv`, `.txt`, `.log` | ✅ |

### Hojas de Cálculo
| Formato | Extensiones | Auto-detección |
|---------|------------|----------------|
| Excel | `.xlsx`, `.xls` | ✅ |

### Formatos Estructurados
| Formato | Extensiones | Auto-detección |
|---------|------------|----------------|
| JSON | `.json` | ✅ |
| NDJSON / JSON Lines | `.ndjson`, `.jsonl` | ✅ |
| XML | `.xml` | ✅ |
| YAML | `.yaml`, `.yml` | ✅ |
| HTML | `.html` | ✅ |

### Formatos Big Data
| Formato | Extensiones | Auto-detección |
|---------|------------|----------------|
| Feather / Arrow | `.feather`, `.arrow` | ✅ Magic bytes |
| ORC | `.orc` | ✅ Magic bytes |
| Avro | `.avro` | ✅ Magic bytes |

### Bases de Datos
| Formato | Extensiones | Auto-detección |
|---------|------------|----------------|
| SQLite | `.sqlite`, `.db` | ✅ Magic bytes |

### Formatos Estadísticos
| Formato | Extensiones | Auto-detección |
|---------|------------|----------------|
| SPSS | `.sav` | Por extensión |
| SAS | `.sas7bdat` | Por extensión |
| Stata | `.dta` | Por extensión |

---

## 🏗️ Backends

| Backend | Velocidad | Requiere | Ideal para |
|---------|-----------|----------|------------|
| **Cython** | 🚀🚀🚀🚀🚀 | Python 3.11 + módulos compilados | Archivos grandes (>50MB) |
| **Python Nativo** | ⚡⚡⚡⚡⚡ | Python 3.11 | Uso general |
| **Python Portable** | ⚡⚡⚡⚡ | Node.js (auto-descarga Python 3.11) | Sin Python instalado |
| **Pyodide** | ⚡⚡ | Ninguno (WebAssembly) | Navegador / sin Python |

**Prioridad de selección automática**: Cython (archivos grandes) → Python Nativo → Python Portable → Pyodide.

> **¿Sin Python instalado?** Sin problema — el backend **Python Portable** descarga Python 3.11 automáticamente en el primer uso (~30MB en Windows, ~50MB en Linux/macOS). El backend **Pyodide** funciona sin ninguna instalación vía WebAssembly, incluso en el navegador.

---

## 🔧 Instalación

### Requisitos Previos

```bash
# Node.js ≥ 18.0.0
node --version
```

**Se recomienda Python 3.11** para los backends Python Nativo y Cython. Otras versiones no garantizan compatibilidad con todas las dependencias.

```bash
# Verificar versión Python (debe ser 3.11.x)
py --version        # Windows
python --version    # Windows/Linux
python3 --version   # Linux/macOS

# Si no tienes Python 3.11:
# → Windows:  https://www.python.org/downloads/release/python-3119/
# → macOS:    brew install python@3.11
# → Ubuntu:   sudo apt install python3.11 python3.11-pip
```

> **¿Sin Python?** Instala solo el paquete npm — los backends Portable Python y Pyodide funcionan sin ninguna instalación de Python.

### Instalar Paquete NPM

```bash
# Global (recomendado para uso CLI)
npm install -g ultra-parquet-converter

# O local
npm install ultra-parquet-converter
```

### Instalar Dependencias Python 3.11

#### Opción 1: Automático (recomendado)

```bash
ultra-parquet-converter setup
```

#### Opción 2: pip (estándar)

```bash
pip install pandas pyarrow numpy openpyxl lxml pyyaml fastavro pyreadstat
```

#### Opción 3: .whl (entornos offline / sin internet)

Si no tienes acceso a internet o quieres archivos wheel pre-compilados exactos para Python 3.11:

```bash
# Descarga los wheels para tu plataforma desde PyPI (https://pypi.org)
# Ejemplo para Windows amd64 + Python 3.11:
pip install pandas-2.1.4-cp311-cp311-win_amd64.whl
pip install pyarrow-14.0.1-cp311-cp311-win_amd64.whl
pip install numpy-1.26.2-cp311-cp311-win_amd64.whl

# O instala todos a la vez desde una carpeta local de wheels:
pip install --no-index --find-links=./wheels pandas pyarrow numpy openpyxl lxml pyyaml fastavro pyreadstat
```

Descarga los wheels para tu plataforma desde [https://pypi.org](https://pypi.org) — busca el nombre del paquete y filtra por `cp311` (CPython 3.11) y tu SO (`win_amd64`, `linux_x86_64`, `macosx`).

---

## 🚀 Inicio Rápido

### CLI

```bash
# Conversión simple
ultra-parquet-converter convert datos.csv

# Con opciones
ultra-parquet-converter convert datos.json -o salida.parquet --streaming -v

# Múltiples archivos
ultra-parquet-converter batch "*.csv" -o convertidos/

# Ayuda
ultra-parquet-converter --help
```

### API JavaScript / TypeScript

```typescript
import { convertToParquet } from 'ultra-parquet-converter';

// Selección automática de backend
const result = await convertToParquet('datos.csv');
console.log(`${result.rows} filas → ${result.compression_ratio}% compresión`);
console.log(`Backend: ${result.backend}`);

// Con todas las opciones
const result = await convertToParquet('archivo_grande.csv', {
  output: 'salida.parquet',
  compression: 'zstd',        // snappy | zstd | lz4 | gzip | brotli | adaptive
  streaming: true,
  autoRepair: true,
  autoNormalize: true,
  parallelWorkers: 4,
  verbose: true,
  forceBackend: 'cython',     // Forzar un backend específico
});
```

---

## 📚 Referencia Completa CLI

### `convert` — Conversión Individual

```bash
ultra-parquet-converter convert <archivo> [opciones]
# Alias: upc c <archivo>
```

**Opciones:**
- `-o, --output <archivo>` — ruta de salida personalizada
- `-v, --verbose` — logs detallados
- `--streaming` — modo streaming para archivos >100MB
- `--no-repair` — desactivar auto-reparación
- `--no-normalize` — desactivar auto-normalización
- `--compression <tipo>` — snappy, zstd, lz4, gzip, brotli, adaptive
- `--workers <n>` — número de workers paralelos
- `--benchmark` — mostrar métricas de performance
- `--force-backend <n>` — native-python | portable-python | pyodide | cython

**Ejemplos:**

```bash
ultra-parquet-converter convert ventas.csv
ultra-parquet-converter convert datos.json -o analytics/datos.parquet
ultra-parquet-converter convert logs_grandes.csv --streaming --compression zstd -v
ultra-parquet-converter convert datos_crudos.csv --no-repair --no-normalize
ultra-parquet-converter convert archivo_grande.csv --force-backend cython --workers 4
```

**Salida de ejemplo:**
```
🔄 Ultra Parquet Converter v1.3.0

✓ Python 3.11 instalado (comando: py)
✓ ¡Conversión exitosa!

📊 Resultados:

   Archivo origen:  ventas.csv
   Archivo destino: ventas.parquet
   Tipo detectado:  CSV
   Backend:         native-python
   Compresión:      snappy
   Filas:           125,430
   Columnas:        18
   Tamaño original: 25.4 MB
   Tamaño Parquet:  4.2 MB
   Compresión:      83.5%
   Tiempo:          2.34s
   Workers:         4
```

---

### `batch` — Conversión Masiva

```bash
ultra-parquet-converter batch <patrón> [opciones]
# Alias: upc b <patrón>
```

**Opciones:**
- `-o, --output-dir <dir>` — directorio de salida (default: `./output`)
- `-v, --verbose` — modo verbose
- `--streaming` — streaming para todos los archivos
- `--workers <n>` — workers paralelos

**Ejemplos:**

```bash
ultra-parquet-converter batch "*.csv"
ultra-parquet-converter batch "data/*.json" -o convertidos/
ultra-parquet-converter batch "logs/*.log" --streaming -v
```

---

### `watch` — Modo Watch

```bash
ultra-parquet-converter watch <directorio> [opciones]
```

Convierte automáticamente archivos nuevos o modificados. Usa debounce para evitar conversiones duplicadas.

```bash
ultra-parquet-converter watch ./datos/
ultra-parquet-converter watch ./entrante/ -o ./procesado/ --streaming
```

---

### `analyze` — Analizar Archivo

```bash
ultra-parquet-converter analyze <archivo>
# Alias: upc a <archivo>
```

Inspecciona la estructura de un archivo sin convertirlo.

---

### `benchmark` — Prueba de Performance

```bash
ultra-parquet-converter benchmark <archivo> [opciones]
```

**Opciones:**
- `--iterations <n>` — número de iteraciones (default: 3)
- `--streaming` — probar con streaming activado

---

### `validate` — Validar Parquet

```bash
ultra-parquet-converter validate <archivo.parquet>
```

Verifica la integridad de un archivo Parquet.

---

### `backends` — Listar Backends

```bash
ultra-parquet-converter backends
```

Muestra todos los backends y su disponibilidad en el entorno actual.

---

### `setup` — Instalar Dependencias Python

```bash
ultra-parquet-converter setup
```

---

## 💻 API JavaScript Completa

### `convertToParquet(inputFile, options?)`

```typescript
const result = await convertToParquet('datos.csv', {
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

**Retorna:**

```typescript
{
  success: boolean,
  backend: string,
  rows: number,
  columns: number,
  input_size: number,        // bytes
  output_size: number,       // bytes
  compression_ratio: number, // porcentaje
  compression_used: string,
  elapsed_time: number,      // segundos
  streaming_mode: boolean,
  parallel_workers: number,
  errors_fixed: number,
  columns_removed: number,
  chunks_processed: number,
  limitations?: string[],    // Solo Pyodide
}
```

### `backendSelector` — Control Manual de Backend

```typescript
import { backendSelector } from 'ultra-parquet-converter';

// Forzar un backend específico
backendSelector.setBackend('cython');

// Ver backend actual
console.log(backendSelector.getCurrentBackend());

// Listar todos los backends
const info = await backendSelector.getAvailableBackends();
```

### Todas las exportaciones

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

## 🔥 Casos de Uso Reales

### 1. Pipeline ETL

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
    console.log(`✓ ${file}: ${result.compression_ratio}% compresión, ${result.errors_fixed} errores corregidos`);
  }
}
```

### 2. Preparación de Datasets ML

```typescript
for (const dataset of ['train.csv', 'test.csv', 'validation.csv']) {
  const result = await convertToParquet(`data/${dataset}`, {
    output: `data/parquet/${dataset.replace('.csv', '.parquet')}`,
    autoRepair: true,
    parallelWorkers: 4,
  });
  console.log(`${dataset}: ${result.rows} filas, ${result.columns_removed} columnas eliminadas`);
}
```

### 3. Procesamiento Masivo de Logs (Streaming)

```typescript
const result = await convertToParquet('server-logs-2025.log', {
  output: 'logs/2025.parquet',
  streaming: true,      // CRÍTICO para archivos grandes
  autoRepair: true,
  compression: 'lz4',   // Compresión rápida para logs
});
console.log(`${result.chunks_processed} chunks procesados, <300MB RAM usados`);
```

### 4. Uso en Navegador (Sin Python)

```typescript
import { PyodideBackend } from 'ultra-parquet-converter';

const backend = new PyodideBackend();
const result = await backend.convert('id,nombre\n1,Alice\n2,Bob');
console.log(`${result.rows} filas convertidas en el navegador vía WebAssembly`);
```

### 5. Migración SQLite → Parquet

```typescript
const result = await convertToParquet('produccion.sqlite', {
  output: 'backup/produccion.parquet',
  forceBackend: 'native-python',
});
console.log(`${result.rows} filas migradas, ${result.compression_ratio}% más pequeño`);
```

---

## 📊 Benchmarks de Performance

### Archivos Pequeños (<100MB)
| Tamaño | Filas | Formato | Tiempo | Velocidad | Compresión |
|--------|-------|---------|--------|-----------|------------|
| 10 MB | 100K | CSV | 0.8s | 125K filas/s | 82% |
| 25 MB | 250K | JSON | 1.2s | 208K filas/s | 75% |
| 50 MB | 500K | XLSX | 3.5s | 143K filas/s | 88% |

### Archivos Grandes (Streaming)
| Tamaño | Filas | Formato | Tiempo | Velocidad | RAM Usada |
|--------|-------|---------|--------|-----------|-----------|
| 5 GB | 50M | CSV | 4m 30s | 185K filas/s | 280 MB |
| 10 GB | 100M | LOG | 8m 15s | 202K filas/s | 290 MB |
| 20 GB | 200M | TSV | 16m 40s | 200K filas/s | 300 MB |

**Sin streaming, archivos de más de 1GB causan Out of Memory.**

---

## 🛠️ Características Avanzadas

### Auto-reparación

Detecta y corrige automáticamente:

- **Columnas vacías** — eliminadas automáticamente
- **Tipos incorrectos** — `"123"` (string) → `123` (int64)
- **Filas duplicadas** — eliminadas
- **Líneas CSV corruptas** — saltadas sin fallar

```bash
# Desactivar auto-reparación
ultra-parquet-converter convert datos.csv --no-repair
```

### Auto-normalización

- **Nombres de columnas**: `"Cliente ID"` → `"cliente_id"`
- **Columnas constantes** → eliminadas (ahorra espacio)

```bash
# Desactivar auto-normalización
ultra-parquet-converter convert datos.csv --no-normalize
```

### Detección Inteligente de Formato

Por **extensión** (rápido) + **contenido** (inteligente):

```
archivo.txt con comas      → CSV
archivo.dat con tabuladores → TSV
archivo.data (magic "PAR1") → Parquet
archivo.db (magic "SQLite") → SQLite
```

---

## 🎯 ¿Por qué Parquet?

| Característica | CSV | JSON | Excel | Parquet |
|----------------|-----|------|-------|---------|
| **Tamaño** | 100% | 120% | 80% | **15-30%** ⚡ |
| **Velocidad lectura** | 1x | 0.8x | 0.5x | **10-100x** ⚡ |
| **Compresión** | ❌ | ❌ | ✅ | **✅✅✅** |
| **Schema** | ❌ | Parcial | ✅ | **✅ Fuerte** |
| **Columnar** | ❌ | ❌ | ❌ | **✅** |
| **Big Data** | Lento | Lento | ❌ | **✅ Optimizado** |

---

## 🐛 Solución de Problemas

### "Python no encontrado"

```bash
# Instala Python 3.11 desde https://www.python.org/downloads/release/python-3119/
# Marca "Add Python to PATH" durante la instalación

# macOS:
brew install python@3.11

# Ubuntu/Debian:
sudo apt install python3.11 python3.11-pip

# Verificar:
py --version      # Windows → debe mostrar Python 3.11.x
python3 --version # Linux/macOS → debe mostrar Python 3.11.x
```

### "Dependencias Python faltantes"

```bash
# Automático:
ultra-parquet-converter setup

# Manual con pip:
pip install pandas pyarrow numpy openpyxl lxml pyyaml fastavro pyreadstat

# Offline con archivos .whl (entornos sin internet):
pip install --no-index --find-links=./wheels pandas pyarrow numpy openpyxl lxml pyyaml fastavro pyreadstat
# Descarga los wheels cp311 desde https://pypi.org para tu plataforma
```

### "Versiones de librerías incompatibles"

Usa siempre **Python 3.11** para garantizar que todas las dependencias compilen y se enlacen correctamente contra el mismo ABI. Mezclar versiones de Python (ej: pandas de 3.10 con pyarrow de 3.11) puede causar errores sutiles de importación.

```bash
# Verificar tu versión de Python:
py --version    # Debe ser 3.11.x

# Si tienes múltiples versiones de Python instaladas, especifica explícitamente:
py -3.11 -m pip install pandas pyarrow numpy
```

### Out of Memory

```bash
ultra-parquet-converter convert archivo_grande.csv --streaming
# O aumentar memoria de Node.js:
NODE_OPTIONS="--max-old-space-size=4096" ultra-parquet-converter convert archivo.csv
```

---

## 🏗️ Arquitectura

```
ultra-parquet-converter/
├── src/
│   ├── backends/
│   │   ├── native-python.ts      # Backend Python del sistema
│   │   ├── portable-python.ts    # Backend Python 3.11 auto-descarga
│   │   ├── pyodide-backend.ts    # Backend WebAssembly (DI loader+logger)
│   │   ├── cython-backend.ts     # Backend módulos Cython compilados
│   │   └── selector.ts           # Selector automático de backend
│   ├── utils/
│   │   ├── detect.ts             # Detección de entorno con caché
│   │   └── download.ts           # Descargador de Python 3.11 Portable
│   ├── cli.ts                    # CLI (barra de progreso + modo watch)
│   └── index.ts                  # API pública
├── python/
│   └── converter_advanced.py     # Motor Python (paralelo + compresión adaptativa)
├── cython/
│   ├── fast_csv.pyx              # Parser CSV Cython
│   ├── fast_parser.pyx           # Parser de datos Cython
│   └── setup.py
└── web/
    └── worker.js                 # Web Worker para uso en navegador
```

---

## 🔨 Compilar Módulos Cython

Para máximo rendimiento en archivos grandes (requiere Python 3.11):

```bash
pip install cython pandas pyarrow numpy
npm run build:cython
```

---

## 🛠️ Desarrollo

```bash
npm run build          # Compilar TypeScript
npm test               # Ejecutar tests
npm run coverage       # Tests con reporte de cobertura
npm run coverage:open  # Cobertura + abrir en navegador
npm run dev            # Modo watch
npm run lint           # Solo verificar tipos
```

---

## 📈 Roadmap

### v1.4.0
- [ ] Modo servidor REST API
- [ ] Integración cloud (S3, GCS, Azure Blob)
- [ ] TypeScript SDK con Hono.js + tRPC (ApexVision-Core)
- [ ] Salida Delta Lake

### v2.0.0
- [ ] Plugins de formatos personalizados
- [ ] Soporte Apache Iceberg
- [ ] Consultas SQL en streaming
- [ ] Interfaz web GUI

---

## 🤝 Contribuir

1. Haz fork del repositorio
2. Crea una rama: `git checkout -b feature/MiFeature`
3. Commit: `git commit -m 'feat: añadir MiFeature'`
4. Push: `git push origin feature/MiFeature`
5. Abre un Pull Request

**Reportar bugs:** incluye versión, OS, versión exacta de Python (`py --version`), versión de Node.js, comando exacto y error completo.

---

## 📝 Licencia

Apache-2.0 — ver [LICENSE](LICENSE)

---

## 🙏 Agradecimientos

- **Apache Arrow** + **PyArrow** — motor de almacenamiento columnar
- **Pandas** — manipulación de datos en Python
- **NumPy** — computación numérica
- **Commander.js** — framework CLI
- **Chalk** + **Ora** + **cli-progress** — UX de terminal
- **openpyxl**, **lxml**, **PyYAML**, **fastavro**, **pyreadstat** — parsers de formatos

---

**Hecho con ❤️ para la comunidad de Data Engineering**

**Autor: Hepein Oficial × Brashkie** — [github.com/Brashkie](https://github.com/Brashkie)

⭐ Si te resulta útil, [dale una estrella en GitHub](https://github.com/Brashkie/ultra-parquet-converter)!

---

**Versión**: 1.3.0 | **Python**: 3.11 | **Licencia**: Apache-2.0 | **NPM**: [ultra-parquet-converter](https://www.npmjs.com/package/ultra-parquet-converter)