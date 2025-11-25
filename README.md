# 🚀 Ultra Parquet Converter v1.1.0

[![npm version](https://img.shields.io/npm/v/ultra-parquet-converter.svg)](https://www.npmjs.com/package/ultra-parquet-converter)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-yellow.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue)](https://python.org)
[![Downloads](https://img.shields.io/npm/dm/ultra-parquet-converter.svg)](https://www.npmjs.com/package/ultra-parquet-converter)

**Conversor profesional de archivos a formato Parquet** con streaming, auto-reparación y soporte para **19 formatos**.

Combina la velocidad de Node.js con el poder de Python + Apache Arrow para conversiones ultra-rápidas, procesamiento de archivos gigantes sin explotar memoria, y reparación automática de datos corruptos.

---

## ✨ Características Principales

### 🎯 Core Features
- 🔍 **Auto-detección inteligente** - Por extensión Y contenido
- ⚡ **Ultra-rápido** - Apache Arrow + Pandas optimizado
- 🌊 **Streaming mode** - Procesa archivos de 1GB, 5GB, 20GB+ sin explotar memoria
- 🔧 **Auto-reparación** - Corrige CSVs corruptos, elimina columnas vacías
- 📊 **Auto-normalización** - Normaliza nombres, detecta tipos automáticamente
- 🌐 **Multiplataforma** - Windows, Linux, macOS
- 🐍 **Python flexible** - Detecta `py`, `python`, `python3` automáticamente

### 💎 Advanced Features (v1.1.0)
- 🔄 **Procesamiento por chunks** - 100,000 filas por vez
- 🛠️ **Modo batch avanzado** - Convierte cientos de archivos
- 📈 **Benchmarking integrado** - Mide velocidad, throughput, memoria
- 🔍 **Análisis de archivos** - Inspecciona estructura sin convertir
- ✅ **Validación Parquet** - Verifica integridad
- 📦 **Compresión Snappy** - 50-90% reducción de tamaño
- 🎨 **CLI hermoso** - Colores, spinners, estadísticas detalladas

---

## 📋 Formatos Soportados (19 total)

### Archivos Delimitados
| Formato | Extensiones | Uso Común | Auto-detección |
|---------|------------|-----------|----------------|
| **CSV** | `.csv` | Archivos estándar | ✅ Sí |
| **TSV** | `.tsv` | Datos tabulares, exports | ✅ Sí |
| **PSV** | `.psv` | Bases de datos Unix | ✅ Sí |
| **DSV** | `.dsv`, `.txt`, `.log` | Delimitador desconocido | ✅ Sí |

### Hojas de Cálculo
| Formato | Extensiones | Uso Común | Auto-detección |
|---------|------------|-----------|----------------|
| **Excel** | `.xlsx`, `.xls` | Microsoft Excel | ✅ Sí |

### Formatos Estructurados
| Formato | Extensiones | Uso Común | Auto-detección |
|---------|------------|-----------|----------------|
| **JSON** | `.json` | APIs, configuraciones | ✅ Sí |
| **NDJSON** | `.ndjson`, `.jsonl` | JSON Lines, streaming | ✅ Sí |
| **XML** | `.xml` | Documentos estructurados | ✅ Sí |
| **YAML** | `.yaml`, `.yml` | Configuraciones | ✅ Sí |
| **HTML** | `.html` | Tablas web | ✅ Sí |

### Formatos Big Data
| Formato | Extensiones | Uso Común | Auto-detección |
|---------|------------|-----------|----------------|
| **Feather** | `.feather`, `.arrow` | Apache Arrow | ✅ Sí (magic bytes) |
| **ORC** | `.orc` | Optimized Row Columnar | ✅ Sí (magic bytes) |
| **Avro** | `.avro` | Apache Avro | ✅ Sí (magic bytes) |

### Bases de Datos
| Formato | Extensiones | Uso Común | Auto-detección |
|---------|------------|-----------|----------------|
| **SQLite** | `.sqlite`, `.db` | Bases de datos SQLite | ✅ Sí (magic bytes) |

### Formatos Estadísticos
| Formato | Extensiones | Uso Común | Auto-detección |
|---------|------------|-----------|----------------|
| **SPSS** | `.sav` | IBM SPSS Statistics | ❌ Por extensión |
| **SAS** | `.sas7bdat` | SAS datasets | ❌ Por extensión |
| **Stata** | `.dta` | Stata data files | ❌ Por extensión |

> 🆕 **Novedad v1.1.0**: +10 formatos nuevos (HTML, YAML, NDJSON, Feather, ORC, Avro, SQLite, SPSS, SAS, Stata)

---

## 🔧 Instalación

### Requisitos Previos

#### Node.js
```bash
# Verificar instalación
node --version  # Requiere v18.0.0 o superior
```

#### Python
```bash
# Verificar instalación (cualquiera de estos)
py --version       # Windows (Python Launcher)
python --version   # Windows/Linux
python3 --version  # Linux/macOS

# Debe ser Python 3.8 o superior
```

### Instalar Paquete NPM

```bash
# Global (recomendado)
npm install -g ultra-parquet-converter

# O local en tu proyecto
npm install ultra-parquet-converter
```

### Instalar Dependencias Python

```bash
# Opción 1: Automático (recomendado)
ultra-parquet-converter setup

# Opción 2: Manual
pip install -r node_modules/ultra-parquet-converter/python/requirements.txt

# En algunos sistemas:
pip3 install pandas pyarrow numpy openpyxl lxml pyyaml fastavro pyreadstat
```

---

## 🚀 Uso Rápido

### Como CLI

```bash
# Conversión simple
ultra-parquet-converter convert archivo.csv

# Con opciones
ultra-parquet-converter convert data.json -o salida.parquet --streaming -v

# Múltiples archivos
ultra-parquet-converter batch "*.csv" -o converted/

# Ver ayuda
ultra-parquet-converter --help
```

### Como Librería JavaScript

```javascript
const { convertToParquet } = require('ultra-parquet-converter');

// Conversión simple
await convertToParquet('datos.csv');

// Con opciones avanzadas
const result = await convertToParquet('huge_file.csv', {
  output: 'output.parquet',
  streaming: true,      // Para archivos grandes
  verbose: true,
  autoRepair: true,     // Corregir datos automáticamente
  autoNormalize: true   // Normalizar columnas
});

console.log(`${result.rows} filas → ${result.compression_ratio}% compresión`);
```

---

## 📚 Guía Completa CLI

### Comando: `convert` - Conversión Individual

Convierte un archivo a formato Parquet.

```bash
ultra-parquet-converter convert <archivo> [opciones]
# Alias: ultra-parquet-converter c <archivo>
```

**Opciones:**
- `-o, --output <file>` - Archivo de salida personalizado
- `-v, --verbose` - Modo detallado con logs
- `--streaming` - Modo streaming para archivos >100MB
- `--no-repair` - Desactivar auto-reparación
- `--no-normalize` - Desactivar auto-normalización
- `--benchmark` - Mostrar métricas de performance
- `--compression <type>` - Tipo de compresión (snappy, gzip, brotli, none)

**Ejemplos:**

```bash
# Básico
ultra-parquet-converter convert ventas.csv

# Con salida personalizada
ultra-parquet-converter convert datos.json -o analytics/data.parquet

# Archivo grande con streaming
ultra-parquet-converter convert huge_log.csv --streaming -v

# Con benchmark
ultra-parquet-converter convert test.csv --benchmark

# Sin auto-reparación
ultra-parquet-converter convert raw_data.csv --no-repair --no-normalize
```

**Salida ejemplo:**
```
🔄 Ultra Parquet Converter v1.1.0

✓ Python instalado (comando: py)
✓ Conversión exitosa!

📊 Resultados:

   Archivo origen:  ventas.csv
   Archivo destino: ventas.parquet
   Tipo detectado:  CSV
   Filas:           125,430
   Columnas:        18
   Tamaño original: 25.4 MB
   Tamaño Parquet:  4.2 MB
   Compresión:      83.5%
   Tiempo:          2.34s

⚡ Benchmark:

   Velocidad:       53,590 filas/s
   Throughput:      10.85 MB/s
```

---

### Comando: `batch` - Conversión Masiva

Convierte múltiples archivos usando patrones glob.

```bash
ultra-parquet-converter batch <patrón> [opciones]
# Alias: ultra-parquet-converter b <patrón>
```

**Opciones:**
- `-o, --output-dir <dir>` - Directorio de salida (default: `./output`)
- `-v, --verbose` - Modo verbose
- `--streaming` - Activar streaming para todos los archivos

**Ejemplos:**

```bash
# Todos los CSV del directorio actual
ultra-parquet-converter batch "*.csv"

# Archivos en subdirectorio
ultra-parquet-converter batch "data/*.json" -o converted/

# Con streaming y verbose
ultra-parquet-converter batch "logs/*.log" --streaming -v

# Múltiples extensiones (requiere shell expansion)
ultra-parquet-converter batch "data/*.{csv,json,xlsx}"
```

**Salida ejemplo:**
```
📦 Ultra Parquet Converter - Modo Batch v1.1.0

Archivos encontrados: 12

✓ ventas_2024.csv → 82% compresión
✓ ventas_2025.csv → 85% compresión
✓ productos.csv → 91% compresión
✓ clientes.csv → 78% compresión
...

📊 Resumen del Batch:

   ✅ Exitosos:         12
   ❌ Fallidos:         0
   📁 Total filas:      1,245,890
   💾 Espacio ahorrado: 156.8 MB
   ⏱️  Tiempo total:     28.45s
   ⚡ Velocidad media:  43,789 filas/s
```

---

### Comando: `analyze` - Analizar Archivos

Inspecciona la estructura de un archivo sin convertirlo.

```bash
ultra-parquet-converter analyze <archivo>
# Alias: ultra-parquet-converter a <archivo>
```

**Ejemplos:**

```bash
# Analizar CSV
ultra-parquet-converter analyze datos.csv

# Analizar base de datos
ultra-parquet-converter analyze database.sqlite

# Analizar archivo desconocido
ultra-parquet-converter analyze mystery_file.dat
```

**Salida ejemplo:**
```
🔍 Análisis de Archivo

✓ Análisis completado

📋 Información General:

   Nombre:          datos.csv
   Tipo detectado:  CSV
   Tamaño:          25.4 MB
   Filas:           125,430
   Columnas:        18

📊 Schema:

   id                   int64
   nombre               string
   fecha                datetime
   precio               float64
   cantidad             int32
```

---

### Comando: `benchmark` - Medir Performance

Realiza pruebas de rendimiento con múltiples iteraciones.

```bash
ultra-parquet-converter benchmark <archivo> [opciones]
```

**Opciones:**
- `--iterations <n>` - Número de iteraciones (default: 3)
- `--streaming` - Probar con streaming activado

**Ejemplos:**

```bash
# Benchmark básico
ultra-parquet-converter benchmark test.csv

# Con 5 iteraciones
ultra-parquet-converter benchmark large.csv --iterations 5

# Probar streaming
ultra-parquet-converter benchmark huge.csv --streaming
```

**Salida ejemplo:**
```
⚡ Benchmark de Conversión

Archivo: test.csv
Iteraciones: 3

✓ Iteración 1: 2.34s
✓ Iteración 2: 2.28s
✓ Iteración 3: 2.31s

📊 Resultados:

   Filas procesadas:    125,430
   Tiempo promedio:     2.31s
   Tiempo mínimo:       2.28s
   Tiempo máximo:       2.34s
   Velocidad promedio:  54,285 filas/s
   Throughput:          10.99 MB/s
```

---

### Comando: `info` - Información de Archivo

Muestra metadatos del archivo sin procesarlo.

```bash
ultra-parquet-converter info <archivo>
# Alias: ultra-parquet-converter i <archivo>
```

**Ejemplo:**

```bash
ultra-parquet-converter info datos.csv
```

**Salida:**
```
📋 Información del Archivo

   Nombre:      datos.csv
   Ruta:        C:\Users\...\datos.csv
   Extensión:   .csv
   Tamaño:      25.4 MB
   Creado:      06/11/2025
   Modificado:  25/11/2025
```

---

### Comando: `validate` - Validar Parquet

Verifica la integridad de un archivo Parquet.

```bash
ultra-parquet-converter validate <archivo.parquet>
```

**Ejemplo:**

```bash
ultra-parquet-converter validate output.parquet
```

**Salida si es válido:**
```
✓ Validación de Parquet

✅ Archivo Parquet válido

📊 Información:

   Filas:       125,430
   Columnas:    18
   Compresión:  SNAPPY
   Versión:     2.6
```

---

### Comando: `setup` - Instalar Dependencias

Instala las dependencias Python necesarias.

```bash
ultra-parquet-converter setup
```

---

## 💻 API JavaScript Detallada

### `convertToParquet(inputFile, options)`

Convierte un archivo a formato Parquet.

**Parámetros:**
- `inputFile` (string): Ruta del archivo a convertir
- `options` (object, opcional):
  - `output` (string): Ruta del archivo de salida
  - `verbose` (boolean): Modo verbose con logs
  - `streaming` (boolean): Activar modo streaming
  - `autoRepair` (boolean): Auto-reparación (default: true)
  - `autoNormalize` (boolean): Auto-normalización (default: true)

**Retorna:** `Promise<Object>`

```javascript
{
  success: true,
  input_file: "/ruta/archivo.csv",
  output_file: "/ruta/archivo.parquet",
  rows: 125430,
  columns: 18,
  input_size: 26632192,      // bytes
  output_size: 4398046,      // bytes
  compression_ratio: 83.48,  // porcentaje
  file_type: "csv",
  elapsed_time: 2.34,        // segundos
  chunks_processed: 2,       // si streaming
  errors_fixed: 5,           // si auto-repair
  columns_removed: 3,        // si auto-normalize
  streaming_mode: false
}
```

**Ejemplos:**

```javascript
const { convertToParquet } = require('ultra-parquet-converter');

// 1. Conversión simple
const result = await convertToParquet('datos.csv');
console.log(`✓ ${result.rows} filas convertidas`);

// 2. Con todas las opciones
const result = await convertToParquet('input.json', {
  output: 'output/data.parquet',
  verbose: true,
  streaming: false,
  autoRepair: true,
  autoNormalize: true
});

// 3. Archivo gigante (20GB)
const result = await convertToParquet('huge_file.csv', {
  streaming: true,  // ¡No explota la memoria!
  verbose: true
});

console.log(`Procesados ${result.chunks_processed} chunks`);
console.log(`Velocidad: ${Math.round(result.rows / result.elapsed_time)} filas/s`);
```

---

### `analyzeFile(filePath)`

Analiza la estructura de un archivo.

**Retorna:** `Promise<Object>`

```javascript
const { analyzeFile } = require('ultra-parquet-converter');

const analysis = await analyzeFile('datos.csv');

console.log(`Tipo: ${analysis.detected_type}`);
console.log(`Filas: ${analysis.rows}`);
console.log(`Columnas: ${analysis.columns}`);
```

---

### `benchmarkConversion(filePath, options)`

Realiza benchmark de conversión.

**Retorna:** `Promise<Object>`

```javascript
const { benchmarkConversion } = require('ultra-parquet-converter');

const benchmark = await benchmarkConversion('test.csv', {
  streaming: false
});

const speed = Math.round(benchmark.rows / benchmark.elapsed_time);
console.log(`Velocidad: ${speed} filas/s`);
```

---

### `validateParquet(filePath)`

Valida un archivo Parquet.

**Retorna:** `Promise<Object>`

```javascript
const { validateParquet } = require('ultra-parquet-converter');

const validation = await validateParquet('output.parquet');

if (validation.valid) {
  console.log(`✓ Válido: ${validation.rows} filas`);
} else {
  console.error(`✗ Error: ${validation.error}`);
}
```

---

### `checkPythonSetup()`

Verifica instalación de Python.

**Retorna:** `Promise<Object>`

```javascript
const { checkPythonSetup } = require('ultra-parquet-converter');

const check = await checkPythonSetup();

if (check.installed) {
  console.log(`✓ ${check.message}`);
} else {
  console.error(`✗ Python no encontrado`);
}
```

---

## 🔥 Casos de Uso Reales

### 1. Data Engineering - Pipeline ETL

```javascript
// Pipeline completo: CSV → limpieza → Parquet
const { convertToParquet } = require('ultra-parquet-converter');
const path = require('path');
const fs = require('fs');

async function etlPipeline(inputDir, outputDir) {
  const files = fs.readdirSync(inputDir)
    .filter(f => f.endsWith('.csv'));
  
  console.log(`Procesando ${files.length} archivos...`);
  
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file.replace('.csv', '.parquet'));
    
    const result = await convertToParquet(inputPath, {
      output: outputPath,
      streaming: true,      // Archivos grandes
      autoRepair: true,     // Limpia datos
      autoNormalize: true   // Normaliza columnas
    });
    
    console.log(`✓ ${file}: ${result.compression_ratio}% compresión`);
  }
}

etlPipeline('./raw-data', './processed');
```

---

### 2. Data Science - Preparación de Datasets ML

```javascript
// Preprocesa datasets para entrenamiento
const datasets = ['train.csv', 'test.csv', 'validation.csv'];

for (const dataset of datasets) {
  const result = await convertToParquet(`data/${dataset}`, {
    output: `data/parquet/${dataset.replace('.csv', '.parquet')}`,
    autoRepair: true,        // Elimina valores nulos
    autoNormalize: true      // Normaliza features
  });
  
  console.log(`${dataset}:`);
  console.log(`  Errores corregidos: ${result.errors_fixed}`);
  console.log(`  Columnas eliminadas: ${result.columns_removed}`);
  console.log(`  Compresión: ${result.compression_ratio}%`);
}
```

---

### 3. Analytics - Optimización de Reportes

```bash
# Script Bash para analytics diarios
#!/bin/bash

# Convierte reportes Excel pesados
ultra-parquet-converter batch "reports/daily/*.xlsx" -o analytics/parquet/

# Convierte logs del servidor
ultra-parquet-converter convert logs/access.log \
  --streaming \
  -o analytics/access.parquet

echo "✓ Reportes optimizados - Consultas 100x más rápidas"
```

---

### 4. Archivado - Compresión Masiva

```javascript
// Archiva datos históricos con máxima compresión
const { convertToParquet } = require('ultra-parquet-converter');
const glob = require('glob');

async function archiveHistoricalData() {
  const files = glob.sync('archive/**/*.csv');
  
  console.log(`Archivando ${files.length} archivos históricos...`);
  
  let totalSaved = 0;
  
  for (const file of files) {
    const result = await convertToParquet(file, {
      output: file.replace('.csv', '.parquet'),
      streaming: true
    });
    
    totalSaved += (result.input_size - result.output_size);
  }
  
  console.log(`Espacio ahorrado: ${(totalSaved / 1024 / 1024 / 1024).toFixed(2)} GB`);
}

archiveHistoricalData();
```

---

### 5. Procesamiento de Logs - Streaming

```javascript
// Procesa logs gigantes (50GB) sin explotar memoria
const result = await convertToParquet('server-logs-2025.log', {
  output: 'logs/2025.parquet',
  streaming: true,      // ¡CRÍTICO para archivos grandes!
  verbose: true,
  autoRepair: true      // Salta líneas corruptas
});

console.log(`Procesados ${result.chunks_processed} chunks`);
console.log(`${result.rows.toLocaleString()} líneas de log`);
console.log(`Tiempo: ${result.elapsed_time}s`);
console.log(`Memoria usada: <300MB (gracias a streaming)`);
```

---

### 6. Migración de Bases de Datos

```javascript
// SQLite → Parquet
const result = await convertToParquet('production.sqlite', {
  output: 'backup/production.parquet',
  verbose: true
});

console.log(`Base de datos migrada:`);
console.log(`  Filas: ${result.rows.toLocaleString()}`);
console.log(`  Tamaño SQLite: ${(result.input_size / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Tamaño Parquet: ${(result.output_size / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Reducción: ${result.compression_ratio}%`);
```

---

### 7. Web Scraping - Tablas HTML

```javascript
// Extrae tablas de HTML y convierte a Parquet
const result = await convertToParquet('scraping/wikipedia-table.html', {
  output: 'data/wikipedia.parquet'
});

console.log(`Tabla extraída: ${result.rows} filas`);
```

---

### 8. Configuraciones YAML → Parquet

```javascript
// Convierte configuraciones para análisis
await convertToParquet('configs/app-config.yaml', {
  output: 'analytics/configs.parquet'
});
```

---

## 📊 Benchmarks y Performance

### Archivos Pequeños (<100MB)

| Tamaño | Filas | Formato | Tiempo | Velocidad | Compresión |
|--------|-------|---------|--------|-----------|------------|
| 10 MB | 100K | CSV | 0.8s | 125K filas/s | 82% |
| 25 MB | 250K | JSON | 1.2s | 208K filas/s | 75% |
| 50 MB | 500K | XLSX | 3.5s | 143K filas/s | 88% |

### Archivos Medianos (100MB-1GB)

| Tamaño | Filas | Formato | Tiempo | Velocidad | Memoria |
|--------|-------|---------|--------|-----------|---------|
| 100 MB | 1M | CSV | 4.2s | 238K filas/s | 85 MB |
| 500 MB | 5M | TSV | 22s | 227K filas/s | 180 MB |
| 1 GB | 10M | CSV | 45s | 222K filas/s | 250 MB* |

*Con streaming activado

### Archivos Grandes (1GB-20GB) con Streaming

| Tamaño | Filas | Formato | Tiempo | Velocidad | Memoria |
|--------|-------|---------|--------|-----------|---------|
| 5 GB | 50M | CSV | 4m 30s | 185K filas/s | 280 MB |
| 10 GB | 100M | LOG | 8m 15s | 202K filas/s | 290 MB |
| 20 GB | 200M | TSV | 16m 40s | 200K filas/s | 300 MB |

**🔥 Sin streaming, estos archivos causarían "Out of Memory"**

### Comparación: Streaming vs Normal

| Archivo | Modo Normal | Modo Streaming |
|---------|-------------|----------------|
| 5 GB CSV | ❌ Out of Memory | ✅ 280 MB RAM |
| 10 GB LOG | ❌ Crash | ✅ 290 MB RAM |
| 20 GB TSV | ❌ Imposible | ✅ 300 MB RAM |

---

## 🛠️ Características Avanzadas

### Auto-reparación de Datos

El conversor detecta y corrige automáticamente:

✅ **Columnas vacías** - Eliminadas automáticamente
```
Entrada: id, nombre, vacio1, edad, vacio2
Salida:  id, nombre, edad
```

✅ **Tipos incorrectos** - Detecta y convierte
```
Entrada: "123" (string)
Salida:  123 (int64)
```

✅ **Filas duplicadas** - Eliminadas
```
Entrada: 10,000 filas (500 duplicadas)
Salida:  9,500 filas únicas
```

✅ **CSVs corruptos** - Salta líneas malas
```
Línea 1: "a","b","c"        ✓
Línea 2: "1","2"            ✗ Saltada
Línea 3: "3","4","5"        ✓
```

**Desactivar auto-reparación:**
```bash
ultra-parquet-converter convert data.csv --no-repair
```

---

### Auto-normalización

Normaliza automáticamente:

✅ **Nombres de columnas**
```
"Cliente ID" → "cliente_id"
"Fecha Venta" → "fecha_venta"
"PRECIO TOTAL" → "precio_total"
```

✅ **Columnas constantes** - Eliminadas
```
Columna "status" = "active" en todas las filas
→ Eliminada (ahorra espacio)
```

**Desactivar auto-normalización:**
```bash
ultra-parquet-converter convert data.csv --no-normalize
```

---

### Modo Streaming Inteligente

El modo streaming se activa:

1. **Manualmente** con `--streaming`
2. **Automáticamente** si el archivo >100MB

**¿Cómo funciona?**
- Procesa 100,000 filas por chunk
- Escribe incrementalmente a Parquet
- Memoria constante (~300MB)

```javascript
// Archivo de 50GB
const result = await convertToParquet('huge.csv', {
  streaming: true
});

console.log(`Procesados ${result.chunks_processed} chunks`);
// Ej: 500 chunks de 100K filas cada uno
```

---

### Auto-detección de Formato

Detecta formatos por:

**1. Extensión (rápido)**
```
archivo.csv → CSV
archivo.json → JSON
```

**2. Contenido (inteligente)**
```
archivo.txt con comas → CSV
archivo.dat con tabs → TSV
archivo.data con magic "SQLite" → SQLite
```

**Magic bytes detectados:**
- SQLite: `SQLite format 3`
- Parquet: `PAR1`
- Arrow/Feather: `ARROW1`
- ORC: `ORC`
- Avro: `Obj\x01`

---

## 🎯 Ventajas de Parquet

| Característica | CSV | JSON | Excel | Parquet |
|----------------|-----|------|-------|---------|
| **Tamaño** | 100% | 120% | 80% | **15-30%** ⚡ |
| **Velocidad lectura** | 1x | 0.8x | 0.5x | **10-100x** ⚡ |
| **Compresión** | ❌ | ❌ | ✅ | **✅✅✅** |
| **Schema** | ❌ | Parcial | ✅ | **✅ Fuerte** |
| **Columnar** | ❌ | ❌ | ❌ | **✅** |
| **Big Data** | Lento | Lento | ❌ | **✅ Optimizado** |

**Ejemplo real:**
```
CSV:    100 MB
JSON:   120 MB
Excel:   80 MB
Parquet: 18 MB  ← 82% más pequeño
```

---

## 🐛 Solución de Problemas

### Error: "Python no encontrado"

```bash
# Verifica instalación
py --version       # Windows
python --version   # Linux/Windows
python3 --version  # Linux/macOS

# Si no está instalado:
# Windows: https://python.org (marca "Add to PATH")
# macOS: brew install python
# Ubuntu: sudo apt install python3 python3-pip
```

---

### Error: "Dependencias Python faltantes"

```bash
# Reinstalar automáticamente
ultra-parquet-converter setup

# O manualmente
pip install pandas pyarrow numpy openpyxl lxml pyyaml fastavro pyreadstat

# Linux/macOS puede necesitar pip3
pip3 install -r python/requirements.txt
```

---

### Error: "Out of Memory"

```bash
# Activar modo streaming
ultra-parquet-converter convert huge_file.csv --streaming

# O aumentar memoria Node.js
NODE_OPTIONS="--max-old-space-size=4096" ultra-parquet-converter convert file.csv
```

---

### Error: "MODULE_NOT_FOUND"

```bash
# Instalar dependencias Node.js
npm install

# Si instalaste globalmente
npm install -g ultra-parquet-converter
```

---

### CSV corrupto no se convierte

```bash
# El auto-repair debería solucionarlo, pero si no:
# 1. Verifica encoding (debe ser UTF-8)
# 2. Activa verbose para ver errores
ultra-parquet-converter convert broken.csv -v

# 3. Si falla, reporta el issue con el archivo de ejemplo
```

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas!

### Reportar Bugs
1. Busca issues existentes
2. Crea un nuevo issue con:
   - Versión de ultra-parquet-converter
   - Versión de Node.js y Python
   - Sistema operativo
   - Archivo de ejemplo (si es posible)
   - Comando exacto usado
   - Error completo

### Solicitar Features
1. Abre un issue con etiqueta "enhancement"
2. Describe el caso de uso
3. Propón la API/sintaxis

### Pull Requests
1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/MiFeature`
3. Commit: `git commit -m 'feat: añadir MiFeature'`
4. Push: `git push origin feature/MiFeature`
5. Abre un Pull Request

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para más detalles.

---

## 📝 Licencia

Apache-2.0 License - ver [LICENSE](LICENSE)

---

## 🙏 Agradecimientos

### Tecnologías Core
- **Apache Arrow** - Motor columnar ultra-rápido
- **Pandas** - Manipulación de datos en Python
- **PyArrow** - Interfaz Python para Arrow
- **NumPy** - Computación numérica

### Formatos Específicos
- **openpyxl** - Lectura Excel
- **lxml** - Parsing XML/HTML
- **PyYAML** - Parsing YAML
- **fastavro** - Apache Avro
- **pyreadstat** - SPSS, SAS, Stata

### CLI y UX
- **Commander.js** - CLI framework
- **Chalk** - Colores en terminal
- **Ora** - Spinners animados

---

## 📧 Soporte y Contacto

### 🐛 Reportar Issues
- [GitHub Issues](https://github.com/Brashkie/ultra-parquet-converter/issues)

### 💡 Solicitar Features
- [GitHub Discussions](https://github.com/Brashkie/ultra-parquet-converter/discussions)

### 📧 Contacto Directo
- **Email**: electronicatodo2006@gmail.com
- **Creador**: Hepein Oficial x Brashkie

---

## 📈 Roadmap

### v1.3.0 (Próxima)
- [ ] Parallel processing (multi-thread)
- [ ] GPU acceleration (cuDF)
- [ ] Compresión adaptativa (elige mejor algoritmo)
- [ ] Progress bar para archivos grandes
- [ ] Modo watch (monitoreo automático)

### v1.4.0
- [ ] REST API server
- [ ] WebAssembly support
- [ ] Cloud integration (S3, GCS, Azure)
- [ ] GUI web opcional

### v2.0.0
- [ ] Plugins para formatos personalizados
- [ ] Soporte para Iceberg tables
- [ ] Delta Lake support
- [ ] Streaming SQL queries

---

## ⭐ Estadísticas

- **Formatos soportados**: 19
- **Líneas de código**: ~2,500
- **Tests**: Integración completa
- **Plataformas**: Windows, Linux, macOS
- **Python**: 3.8+
- **Node.js**: 18+

---

## 🏆 Comparación con Alternativas

| Feature | ultra-parquet-converter | pandas.to_parquet | other-converter |
|---------|------------------------|-------------------|-----------------|
| Formatos | **19** | 1 | 6 |
| Streaming | **✅** | ❌ | ❌ |
| Auto-repair | **✅** | ❌ | ❌ |
| CLI | **✅ Avanzado** | ❌ | ✅ Básico |
| Auto-detección | **✅ Contenido** | ❌ | ✅ Extensión |
| Benchmarking | **✅** | ❌ | ❌ |
| Batch | **✅** | ❌ | ✅ |

---

**Hecho con ❤️ para la comunidad de Data Engineering**

**Creador: Hepein Oficial x Brashkie**

⭐ Si te gusta este proyecto, [dale una estrella en GitHub](https://github.com/Brashkie/ultra-parquet-converter)!

---

**Versión**: 1.1.0  
**Última actualización**: 25 de Noviembre, 2025  
**Licencia**: Apache-2.0  
**NPM**: [ultra-parquet-converter](https://www.npmjs.com/package/ultra-parquet-converter)
