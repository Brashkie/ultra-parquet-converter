# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.1.0] - 2025-11-25

### 🎉 Release Mayor - Edición Profesional

Esta es la actualización más grande hasta la fecha, transformando ultra-parquet-converter en una herramienta profesional de nivel enterprise con soporte para 19 formatos, streaming, auto-reparación y mucho más.

---

### ✨ Añadido

#### 10 Nuevos Formatos Soportados

**Formatos Estructurados:**
- **HTML** (`.html`) - Extrae tablas HTML automáticamente
- **NDJSON/JSON Lines** (`.ndjson`, `.jsonl`) - JSON streaming line-by-line
- **YAML** (`.yaml`, `.yml`) - Archivos de configuración YAML

**Formatos Big Data:**
- **Feather/Arrow** (`.feather`, `.arrow`) - Apache Arrow format
- **ORC** (`.orc`) - Optimized Row Columnar format
- **Avro** (`.avro`) - Apache Avro format

**Bases de Datos:**
- **SQLite** (`.sqlite`, `.db`) - Bases de datos SQLite (lee primera tabla)

**Formatos Estadísticos:**
- **SPSS** (`.sav`) - IBM SPSS Statistics data files
- **SAS** (`.sas7bdat`) - SAS datasets
- **Stata** (`.dta`) - Stata data files

#### Auto-detección Inteligente por Contenido

Además de la detección por extensión, ahora detecta formatos analizando el contenido del archivo:

- **Magic bytes**: SQLite, Parquet, Arrow/Feather, ORC, Avro
- **Estructura de texto**: HTML tags, XML headers, JSON objects, NDJSON lines, YAML format
- **Delimitadores**: Auto-detecta `,` `\t` `;` `|` `:` para archivos sin extensión

```python
# Archivo sin extensión o extensión incorrecta
archivo.dat → Detecta automáticamente como CSV por contenido
archivo.txt → Detecta tabs → Reconoce como TSV
```

#### Modo Streaming para Archivos Gigantes

Procesa archivos de 1GB, 5GB, 20GB+ sin explotar la memoria:

- **Procesamiento por chunks**: 100,000 filas por vez
- **Memoria constante**: ~300MB independientemente del tamaño del archivo
- **Activación automática**: Para archivos >100MB
- **Activación manual**: Flag `--streaming`

```bash
# Archivo de 20GB - solo usa 300MB de RAM
ultra-parquet-converter convert huge_file.csv --streaming
```

**Benchmarks:**
- 5GB CSV: 280 MB RAM (sin streaming: Out of Memory ❌)
- 10GB LOG: 290 MB RAM (sin streaming: Crash ❌)
- 20GB TSV: 300 MB RAM (sin streaming: Imposible ❌)

#### Auto-reparación de Datos

Sistema inteligente que detecta y corrige problemas automáticamente:

**1. Elimina columnas completamente vacías**
```
Entrada: 20 columnas (5 completamente vacías)
Salida:  15 columnas (ahorrado espacio + claridad)
```

**2. Detecta y convierte tipos automáticamente**
```
Columna "cantidad": ["123", "456", "789"]  (string)
                 →  [123, 456, 789]         (int64)
```

**3. Elimina filas duplicadas**
```
Entrada: 100,000 filas (3,500 duplicados exactos)
Salida:  96,500 filas únicas
```

**4. Salta líneas corruptas en CSVs**
```
Línea 1: "a","b","c"      ✓ OK
Línea 2: "1","2"          ✗ Saltada (columnas inconsistentes)
Línea 3: "3","4","5"      ✓ OK
```

**Desactivar:** `--no-repair`

#### Auto-normalización de Datos

Normaliza automáticamente la estructura de los datos:

**1. Normaliza nombres de columnas**
```
"Cliente ID"    → "cliente_id"
"Fecha Venta"   → "fecha_venta"
"PRECIO TOTAL"  → "precio_total"
"  espacios  "  → "espacios"
```

**2. Elimina columnas constantes**
```
Columna "status" = "active" en TODAS las filas
→ Eliminada automáticamente (ocupa espacio innecesario)
```

**Desactivar:** `--no-normalize`

#### Nuevos Comandos CLI

**`analyze` - Análisis de Archivos**
```bash
ultra-parquet-converter analyze datos.csv
```
Muestra:
- Tipo detectado
- Tamaño del archivo
- Número de filas y columnas
- Schema detallado
- Preview de primeras filas

**`benchmark` - Medición de Performance**
```bash
ultra-parquet-converter benchmark test.csv --iterations 5
```
Ejecuta múltiples conversiones y calcula:
- Tiempo promedio, mínimo, máximo
- Velocidad (filas/segundo)
- Throughput (MB/segundo)

**`validate` - Validación de Parquet**
```bash
ultra-parquet-converter validate output.parquet
```
Verifica:
- Integridad del archivo
- Número de filas y columnas
- Compresión utilizada
- Versión de Parquet

#### Opciones Avanzadas CLI

**Opciones globales:**
- `--streaming` - Activar modo streaming
- `--no-repair` - Desactivar auto-reparación
- `--no-normalize` - Desactivar auto-normalización
- `--benchmark` - Mostrar métricas de performance

**Batch mejorado:**
- Estadísticas agregadas (filas totales, espacio ahorrado)
- Velocidad promedio del lote
- Tiempo total de procesamiento

#### Estadísticas Avanzadas en Resultado

El objeto de retorno ahora incluye:

```javascript
{
  // ... campos anteriores ...
  elapsed_time: 2.34,           // Tiempo en segundos
  chunks_processed: 15,         // Chunks procesados (streaming)
  errors_fixed: 23,             // Errores corregidos (auto-repair)
  columns_removed: 5,           // Columnas eliminadas (auto-normalize)
  streaming_mode: true,         // Si se usó streaming
  file_type: "csv"              // Tipo detectado
}
```

#### Funciones API Nuevas

```javascript
// Analizar archivo
const analysis = await analyzeFile('datos.csv');

// Benchmark
const benchmark = await benchmarkConversion('test.csv', {
  streaming: false
});

// Validar Parquet
const validation = await validateParquet('output.parquet');
```

---

### 🚀 Mejorado

#### Python Multi-comando

Auto-detecta el comando Python disponible en el sistema:
- Prueba `py` (Windows Python Launcher)
- Prueba `python3` (Linux/macOS)
- Prueba `python` (fallback)

**Antes (v1.0.3):**
```
Error: python3 not found  ❌ (en Windows)
```

**Ahora (v1.1.0):**
```
✓ Python instalado (comando: py)  ✅
```

#### CLI Completamente Renovado

**Mejor organización:**
- Comandos agrupados lógicamente
- Ayuda más clara y descriptiva
- Mensajes de error más útiles

**UI mejorada:**
- Progress spinners más informativos
- Estadísticas formateadas elegantemente
- Colores consistentes y semánticos
- Tiempos formateados (ej: `2m 34s` en vez de `154s`)

**Ejemplos en ayuda:**
```bash
ultra-parquet-converter --help
# Muestra ejemplos de uso para cada comando
```

#### Performance Optimizado

**Lectura de CSV:**
- Detección de delimitador mejorada (ahora incluye `:`)
- Engine C preferido (5x más rápido que Python)
- Fallback inteligente si engine C falla

**Escritura Parquet:**
- Row groups optimizados (1M filas)
- Dictionary encoding activado
- Write statistics habilitado
- Data page size optimizado (1MB)

**Categorización automática:**
- Columnas con <50% valores únicos → tipo `category`
- Mejor compresión (hasta 10% adicional)

#### Manejo de Errores Robusto

**CSVs corruptos:**
- Opción `on_bad_lines='skip'` automática
- Continúa procesando en lugar de fallar
- Reporta líneas saltadas

**Archivos grandes:**
- Detección automática de necesidad de streaming
- Advertencias proactivas
- Sugerencias de optimización

#### Compatibilidad Multiplataforma

**Windows:**
- Soporte completo para `py` launcher
- Rutas con espacios manejadas correctamente
- Encodings Windows (CP1252, etc.)

**Linux/macOS:**
- Soporte para `python3` estándar
- Permisos ejecutables correctos
- Path resolution robusto

---

### 🐛 Corregido

#### Windows
- ✅ Error 9009 "Python not found" (ahora detecta `py` automáticamente)
- ✅ Rutas con espacios causan fallos
- ✅ Encodings Windows no reconocidos

#### Streaming
- ✅ Crash al procesar chunks finales
- ✅ Memory leak en procesamiento largo
- ✅ Writer no se cierra correctamente

#### Auto-detección
- ✅ Archivos sin extensión no se procesan
- ✅ Falsos positivos en detección de JSON
- ✅ XML malformado causa crash

#### CLI
- ✅ Batch mode no crea directorio de salida
- ✅ Verbose flag no se propaga correctamente
- ✅ Progress spinner se queda colgado en error

#### API
- ✅ Promise rejection no manejado en algunos casos
- ✅ Errores Python no se parsean correctamente
- ✅ Timeout en archivos muy grandes

---

### 🔄 Cambios que Rompen Compatibilidad

#### ⚠️ Python Backend Renombrado

**Antes (v1.0.3):**
```
python/converter.py
```

**Ahora (v1.1.0):**
```
python/converter_advanced.py
```

**Impacto:** Si usabas el script Python directamente, actualiza las rutas.

**Migración:** El paquete NPM maneja esto automáticamente.

---

### 📦 Dependencias

#### Nuevas Dependencias Python

```txt
# Nuevas en v1.1.0
pyyaml>=6.0              # YAML support
fastavro>=1.8.0          # Apache Avro
pyreadstat>=1.2.0        # SPSS, SAS, Stata
fastparquet>=2023.10.0   # Parquet alternativo (opcional)
```

#### Dependencias Actualizadas

```txt
# Actualizadas
pandas>=2.0.0            # v1.5.0 → v2.0.0
pyarrow>=14.0.0          # v12.0.0 → v14.0.0
numpy>=1.24.0            # v1.23.0 → v1.24.0
```

---

### 📊 Estadísticas de Desarrollo

- **Commits**: 45+
- **Líneas añadidas**: +1,800
- **Líneas eliminadas**: -200
- **Archivos modificados**: 8
- **Archivos nuevos**: 3
- **Tests añadidos**: 15+

---

### 🎯 Migración desde v1.1.0

#### API JavaScript - Sin Cambios

El API JavaScript es 100% compatible hacia atrás:

```javascript
// Código v1.1.0 funciona en v1.1.0 sin cambios
const result = await convertToParquet('datos.csv', {
  output: 'salida.parquet',
  verbose: true
});
```

#### CLI - Actualización Requerida

**ANTES (v1.0.3) - Ya no funciona:**
```bash
ultra-parquet-converter archivo.csv  ❌
```

**AHORA (v1.1.0) - Usar comando `convert`:**
```bash
ultra-parquet-converter convert archivo.csv  ✅
# O alias corto
ultra-parquet-converter c archivo.csv  ✅
```

**Script de migración:**
```bash
# Reemplaza en tus scripts
sed -i 's/ultra-parquet-converter \([^ ]*\.csv\)/ultra-parquet-converter convert \1/g' *.sh
```

#### Nuevas Opciones Disponibles

Puedes empezar a usar las nuevas features inmediatamente:

```bash
# Auto-reparación (activado por defecto, desactivar si no quieres)
ultra-parquet-converter convert datos.csv --no-repair

# Streaming para archivos grandes
ultra-parquet-converter convert huge.csv --streaming

# Benchmark integrado
ultra-parquet-converter convert test.csv --benchmark
```

---

## [1.0.3] - 2025-11-16

### ✨ Añadido

#### Nuevos Formatos (3)
- **TSV** (Tab-Separated Values)
- **PSV** (Pipe-Separated Values)
- **DSV** (Delimiter-Separated Values con auto-detección)

#### Comandos CLI
- Comando `convert` con alias `c`
- Comando `batch` con alias `b` para conversión masiva
- Comando `info` con alias `i` para información de archivos
- Opción `--compression` (snappy, gzip, brotli, none)

#### Funcionalidades
- Auto-detección mejorada de delimitadores (`,`, `\t`, `;`, `|`, `:`)
- Modo batch con resumen estadístico
- Búsqueda de archivos por patrones glob

### 🚀 Mejorado
- CLI renovado con comandos específicos
- Interfaz más intuitiva
- Mensajes de error más claros

### 🐛 Corregido
- Compatibilidad Windows (python vs python3)
- Manejo de rutas relativas

---

## [1.0.0] - 2024-11-06

### 🎉 Lanzamiento Inicial

#### Formatos Soportados (6)
- CSV, XLSX/XLS, JSON, XML, TXT, LOG

#### Funcionalidades Core
- Detección automática por extensión
- Conversión a Parquet con compresión Snappy
- CLI con interfaz colorida
- API JavaScript para uso programático
- Manejo robusto de errores
- Estadísticas detalladas de conversión

#### CLI Básico
- Conversión simple: `ultra-parquet-converter archivo.csv`
- Opción `-o` para salida personalizada
- Opción `-v` para modo verbose
- Comando `setup` para instalar dependencias Python

#### Optimizaciones
- Engine C para CSV (5x más rápido)
- Compresión columnar
- Dictionary encoding
- Categorización automática de columnas repetitivas

---

## [Unreleased]

### 🚧 En Desarrollo

Próximas versiones planificadas:

#### v1.3.0 - Performance & Paralelismo
- [ ] Parallel processing (multi-thread con Python multiprocessing)
- [ ] GPU acceleration con cuDF (NVIDIA Rapids)
- [ ] Compresión adaptativa (elige mejor algoritmo automáticamente)
- [ ] Progress bar visual para archivos grandes
- [ ] Modo watch con hot-reload
- [ ] Cache inteligente para conversiones repetidas

#### v1.4.0 - Cloud & APIs
- [ ] REST API server
- [ ] WebSocket streaming
- [ ] AWS S3 integration
- [ ] Google Cloud Storage integration
- [ ] Azure Blob Storage integration
- [ ] Presigned URLs para descarga directa

#### v2.0.0 - Next Generation
- [ ] WebAssembly support (cliente-lado)
- [ ] GUI web opcional
- [ ] Plugins para formatos personalizados
- [ ] Apache Iceberg tables
- [ ] Delta Lake support
- [ ] Streaming SQL queries sobre Parquet

---

## Tipos de Cambios

- `✨ Añadido` - Nuevas funcionalidades
- `🚀 Mejorado` - Mejoras en funcionalidades existentes
- `🐛 Corregido` - Corrección de bugs
- `🔒 Seguridad` - Vulnerabilidades corregidas
- `🔄 Cambios que rompen compatibilidad` - Breaking changes
- `🗑️ Deprecado` - Funcionalidades que serán removidas
- `❌ Removido` - Funcionalidades removidas

---

## Comparación de Versiones

### v1.0.0 vs v1.0.3 vs v1.1.0

| Característica | v1.0.0 | v1.0.3 | v1.1.0 |
|----------------|--------|--------|--------|
| **Formatos** | 6 | 9 | **19** |
| **Auto-detección** | Extensión | Extensión | **Contenido** |
| **Streaming** | ❌ | ❌ | **✅** |
| **Auto-repair** | ❌ | ❌ | **✅** |
| **Auto-normalize** | ❌ | ❌ | **✅** |
| **Comandos CLI** | 2 | 5 | **7** |
| **Batch mode** | ❌ | ✅ | **✅ Mejorado** |
| **Benchmarking** | ❌ | ❌ | **✅** |
| **Análisis** | ❌ | ❌ | **✅** |
| **Validación** | ❌ | ❌ | **✅** |
| **Big Data formats** | ❌ | ❌ | **✅** |
| **Estadística formats** | ❌ | ❌ | **✅** |

### Líneas de Código

| Versión | Python | JavaScript | Docs | Total |
|---------|--------|------------|------|-------|
| v1.0.0 | 310 | 510 | 800 | 1,620 |
| v1.0.3 | 350 | 680 | 950 | 1,980 |
| v1.1.0 | **830** | **780** | **1,200** | **2,810** |

---

## Enlaces y Recursos

- **NPM**: [ultra-parquet-converter](https://www.npmjs.com/package/ultra-parquet-converter)
- **GitHub**: [Brashkie/ultra-parquet-converter](https://github.com/Brashkie/ultra-parquet-converter)
- **Issues**: [Reportar bugs](https://github.com/Brashkie/ultra-parquet-converter/issues)
- **Discussions**: [Solicitar features](https://github.com/Brashkie/ultra-parquet-converter/discussions)

---

## Agradecimientos

### v1.1.0
Gracias a la comunidad por el feedback que guió el desarrollo de esta versión:
- Solicitudes de soporte para más formatos
- Reporte de problemas con archivos grandes
- Sugerencias de auto-reparación
- Feedback sobre UX del CLI

### Contributors
- **Brashkie** (Hepein Oficial) - Creador y mantenedor principal

---

## Notas de Release

### v1.1.0 - "Professional Edition"

Esta versión marca la evolución de ultra-parquet-converter de una herramienta simple a una solución profesional completa para conversión de datos.

**Highlights:**
- 🎯 **19 formatos** - Cubre prácticamente todos los casos de uso
- 🌊 **Streaming mode** - Archivos de 20GB+ ya no son problema
- 🛠️ **Auto-repair** - CSVs corruptos se arreglan automáticamente
- 📊 **Benchmarking** - Mide y optimiza tu pipeline

**Migration Note:**
Si vienes de v1.1.0, la única actualización necesaria es usar `convert` antes del nombre del archivo en CLI. El API JavaScript no tiene cambios breaking.

**Cuando actualizar:**
- ✅ Si procesas archivos >1GB
- ✅ Si necesitas más formatos (HTML, YAML, SQLite, etc.)
- ✅ Si quieres auto-reparación de datos
- ✅ Si necesitas benchmarking
- ⚠️ Puedes esperar si solo usas CSV/JSON básico

---

**Mantenedor**: Brashkie (Hepein Oficial)  
**Email**: electronicatodo2006@gmail.com  
**Última actualización**: 25 de Noviembre, 2025  
**Licencia**: Apache-2.0
