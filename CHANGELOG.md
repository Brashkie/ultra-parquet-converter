# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.0.3] - 2025-11-16

### ✨ Añadido

#### Nuevos Formatos
- **TSV (Tab-Separated Values)**: Soporte completo para archivos `.tsv` con delimitador de tabulación
- **PSV (Pipe-Separated Values)**: Soporte para archivos `.psv` con delimitador `|`
- **DSV (Delimiter-Separated Values)**: Auto-detección inteligente de delimitadores (`,`, `\t`, `;`, `|`, `:`)

#### Nuevos Comandos CLI
- 🚀 Comando `convert` (alias `c`) para conversión explícita de archivos individuales
- 📦 Comando `batch` (alias `b`) para conversión masiva con patrones glob (`*.csv`, `data/*.json`)
- 📋 Comando `info` (alias `i`) para ver información de archivos sin convertir
- ⚙️ Opción `--compression <type>` para personalizar compresión (snappy, gzip, brotli, none)
- 📁 Opción `-o, --output-dir <dir>` para especificar directorio de salida en batch
- 🔢 Opción `--parallel <n>` para conversiones paralelas (preparado para futuro)

#### Funcionalidades
- 🔍 Auto-detección multiplataforma de Python (`py`, `python`, `python3`)
- 📊 Resumen estadístico completo en modo batch (archivos procesados, filas totales, espacio ahorrado)
- 🎨 Progress individual por archivo en conversiones batch
- 🛡️ Manejo de errores mejorado con continuación en batch

### 🚀 Mejorado

#### CLI
- Interfaz completamente renovada con comandos específicos
- Mensajes más claros y concisos
- Mejor organización de la ayuda (`--help`)
- Spinners y colores mejorados

#### Performance
- Optimización en detección de delimitadores (prueba múltiples delimitadores comunes)
- Engine C preferido para lectura de CSV (5x más rápido)
- Categorización automática de columnas con valores repetidos (mejor compresión)

#### Compatibilidad
- ✅ Compatibilidad completa Windows/Linux/macOS
- ✅ Auto-detección del comando Python correcto según el sistema operativo
- ✅ Manejo de rutas relativas y absolutas mejorado

### 🐛 Corregido

- **Windows**: Solucionado error 9009 al no encontrar `python3` (ahora detecta `py` automáticamente)
- **CLI**: Corregida inconsistencia entre comandos `python3` y `python`
- **Paths**: Mejorado manejo de rutas con espacios en nombres de archivo
- **Batch**: Corregido error al procesar directorios vacíos

### 🔄 Cambios que rompen compatibilidad

⚠️ **IMPORTANTE**: El comando directo sin `convert` ya no funciona en v1.0.3

**Antes (v1.0.0):**
```bash
ultra-parquet-converter archivo.csv
```

**Ahora (v1.0.3):**
```bash
ultra-parquet-converter convert archivo.csv
# o usar alias
ultra-parquet-converter c archivo.csv
```

**Migración**: Actualiza tus scripts agregando `convert` o `c` antes del nombre del archivo.

---

## [1.0.0] - 2025-11-06

### 🎉 Lanzamiento Inicial

#### Formatos Soportados
- ✅ CSV (Comma-Separated Values)
- ✅ XLSX/XLS (Microsoft Excel)
- ✅ JSON (múltiples orientaciones: records, index, columns)
- ✅ XML (parsing automático)
- ✅ TXT (detección de estructura)
- ✅ LOG (parsing línea por línea)

#### Funcionalidades Principales
- 🎯 Detección automática de tipo de archivo por extensión
- ⚡ Conversión ultra-rápida con Apache Arrow y Pandas
- 📦 Compresión Snappy automática (50-90% reducción de tamaño)
- 🔧 Modo dual: CLI y librería JavaScript
- 🌈 Interfaz CLI colorida con spinners animados (Chalk + Ora)
- 📊 Estadísticas detalladas de conversión
- 🛡️ Manejo robusto de errores con mensajes claros

#### CLI
- Comando básico: `ultra-parquet-converter <archivo>`
- Opción `-o, --output`: Especificar archivo de salida
- Opción `-v, --verbose`: Modo verbose con logs detallados
- Comando `setup`: Instalación automática de dependencias Python

#### API JavaScript
- Función `convertToParquet(inputFile, options)`: Conversión programática
- Función `checkPythonSetup()`: Verificación de Python instalado
- Promesas nativas (async/await)
- Retorno de objeto con estadísticas completas

#### Optimizaciones Técnicas
- Engine C para lectura CSV (5x más rápido que Python)
- Compresión columnar optimizada
- Dictionary encoding para datos repetitivos
- Row groups de 1M para mejor compresión
- Estadísticas de columna para queries rápidas
- INT64 timestamps (más eficiente que INT96)

#### Documentación
- README.md completo con ejemplos
- QUICKSTART.md para inicio rápido
- CONTRIBUTING.md para colaboradores
- Ejemplos de código en `examples.js`
- Tests automatizados en `test/test.js`

#### Infraestructura
- Backend: Python 3.8+ con Pandas + PyArrow
- Frontend: Node.js 18+ con Commander.js
- Licencia: MIT
- Compatibilidad: Linux, macOS, Windows
- Dependencias mínimas (3 NPM, 4 Python)

---

## [Unreleased]

### 🚧 En Desarrollo

- [ ] Streaming para archivos gigantes (>5GB)
- [ ] Soporte para múltiples hojas en Excel
- [ ] Integración con AWS S3
- [ ] Integración con Google Cloud Storage
- [ ] GUI web opcional
- [ ] Plugins para formatos personalizados
- [ ] Soporte para Apache Avro
- [ ] Soporte para Apache ORC
- [ ] Progress bar para archivos grandes
- [ ] Modo watch (monitoreo de directorios)
- [ ] Conversión incremental (solo archivos nuevos)

---

## Tipos de Cambios

- `✨ Añadido` - Nuevas funcionalidades
- `🚀 Mejorado` - Mejoras en funcionalidades existentes
- `🐛 Corregido` - Corrección de bugs
- `🔒 Seguridad` - Vulnerabilidades corregidas
- `🔄 Cambios que rompen compatibilidad` - Cambios no retrocompatibles
- `🗑️ Deprecado` - Funcionalidades que serán removidas
- `❌ Removido` - Funcionalidades removidas

---

## Enlaces

- [NPM Package](https://www.npmjs.com/package/ultra-parquet-converter)
- [GitHub Repository](https://github.com/Brashkie/ultra-parquet-converter)
- [Report Issues](https://github.com/Brashkie/ultra-parquet-converter/issues)
- [Request Features](https://github.com/Brashkie/ultra-parquet-converter/issues/new)

---

## Comparación de Versiones

### v1.0.0 vs v1.0.3

| Característica | v1.0.0 | v1.0.3 |
|----------------|--------|--------|
| Formatos soportados | 6 | 9 (+TSV, PSV, DSV) |
| Comandos CLI | 2 | 5 (+convert, batch, info) |
| Compatibilidad Python | python3 solo | py/python/python3 |
| Conversión batch | ❌ | ✅ |
| Compresión personalizable | ❌ | ✅ |
| Info de archivo | ❌ | ✅ |
| Auto-detección delimitador | Básica | Avanzada |

---

## Notas de Versiones

### v1.0.3 - Mejoras Destacadas

**🎯 Enfoque**: Conversión masiva y mejor compatibilidad

Esta versión se centra en hacer el paquete más versátil y fácil de usar en diferentes entornos:

1. **Conversión Batch**: Ahora puedes convertir cientos de archivos con un solo comando
2. **Multiplataforma**: Funciona perfectamente en Windows, Linux y macOS sin configuración
3. **Más Formatos**: TSV, PSV y DSV cubren prácticamente todos los archivos delimitados
4. **CLI Mejorado**: Comandos más intuitivos y potentes

**⚠️ Nota de Migración**: Si usas v1.0.0, actualiza tus scripts para usar el comando `convert`.

### v1.0.0 - Lanzamiento Inicial

**🎯 Enfoque**: Conversión simple y rápida

Primera versión pública del paquete con funcionalidades básicas pero sólidas:
- Conversión de 6 formatos principales
- API simple y directa
- Optimizaciones de rendimiento
- Documentación completa

---

**Mantenedor**: Brashkie (Hepein Oficial)  
**Email**: electronicatodo2006@gmail.com  
**Última actualización**: 16 de Noviembre, 2024
