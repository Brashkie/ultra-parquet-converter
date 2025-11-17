# 🚀 Ultra Parquet Converter

[![npm version](https://img.shields.io/npm/v/ultra-parquet-converter.svg)](https://www.npmjs.com/package/ultra-parquet-converter)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-yellow.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue)](https://python.org)

**Conversor universal de archivos a formato Parquet** con detección automática de tipo de archivo. Soporta CSV, TSV, PSV, DSV, XLSX, JSON, XML, TXT y LOG.

Combina la velocidad de Node.js con el poder de Python + Apache Arrow para conversiones ultra-rápidas y eficientes.

---

## ✨ Características

- 🎯 **Detección automática** de tipo de archivo por extensión
- ⚡ **Ultra-rápido** gracias a Apache Arrow y Pandas
- 📦 **Compresión Snappy** para archivos más pequeños (50-90% reducción)
- 🔧 **Dual mode**: CLI y librería JavaScript
- 🌐 **Multiplataforma**: Windows, Linux y macOS
- 🔄 **Auto-detección de Python**: Funciona con `py`, `python` o `python3`
- 🌈 **Interfaz amigable** con colores y spinners
- 📊 **Estadísticas detalladas** de conversión
- 🛡️ **Manejo robusto de errores**

## 📋 Formatos Soportados

| Formato | Extensión | Delimitador | Uso común |
|---------|-----------|-------------|-----------|
| **CSV** | `.csv` | `,` (coma) | Archivos estándar |
| **TSV** | `.tsv` | `\t` (tab) | Datos tabulares, Excel exports |
| **PSV** | `.psv` | `\|` (pipe) | Bases de datos, sistemas Unix |
| **DSV** | `.dsv` | Auto-detect | Delimitador desconocido |
| **Excel** | `.xlsx`, `.xls` | N/A | Hojas de cálculo |
| **JSON** | `.json` | N/A | APIs, configuraciones |
| **XML** | `.xml` | N/A | Datos estructurados |
| **Texto** | `.txt` | Auto-detect | Archivos de texto plano |
| **Logs** | `.log` | Auto-detect | Archivos de registro |

> 🆕 **Novedad v1.0.3**: Soporte para TSV, PSV y DSV con auto-detección mejorada de delimitadores

---

## 🔧 Instalación

### Requisitos previos

- **Node.js** 18 o superior
- **Python 3.8+** instalado en el sistema
  - Windows: `py`, `python` o `python3` 
  - Linux/macOS: `python3` o `python`
- **pip** para instalar dependencias Python

### Verificar requisitos
```bash
# Verificar Node.js
node --version

# Verificar Python (prueba estos comandos)
py --version       # Windows (Python Launcher)
python --version   # Windows/Linux
python3 --version  # Linux/macOS
```

### Instalar el paquete
```bash
npm install ultra-parquet-converter
```

### Instalar dependencias Python
```bash
# Opción 1: Automático (recomendado)
npx ultra-parquet-converter setup

# Opción 2: Manual
pip install pandas pyarrow openpyxl lxml

# En algunos sistemas puede ser pip3
pip3 install pandas pyarrow openpyxl lxml
```

---

## 🚀 Uso

### Como CLI (Línea de comandos)

#### Conversión simple
```bash
ultra-parquet-converter convert archivo.csv
# o usar el alias corto
ultra-parquet-converter c archivo.tsv
```

#### Conversión con opciones avanzadas
```bash
# Con archivo de salida personalizado
ultra-parquet-converter convert datos.json -o salida.parquet

# Modo verbose (muestra logs detallados)
ultra-parquet-converter convert logs.log -v

# Con compresión personalizada
ultra-parquet-converter convert data.psv --compression gzip
```

**Opciones de compresión disponibles:**
- `snappy` (por defecto) - Más rápida, buena compresión
- `gzip` - Mayor compresión, más lenta
- `brotli` - Máxima compresión
- `none` - Sin compresión

#### Conversión batch (múltiples archivos) 🆕
```bash
# Convierte todos los CSV en el directorio actual
ultra-parquet-converter batch "*.csv"

# Convierte todos los JSON en carpeta data/
ultra-parquet-converter batch "data/*.json" -o output/

# Modo verbose con directorio de salida personalizado
ultra-parquet-converter batch "*.tsv" -o converted/ -v

# Procesar logs diarios
ultra-parquet-converter batch "logs/2024-*.log" -o parquet/
```

#### Ver información de archivo 🆕
```bash
# Ver detalles sin convertir
ultra-parquet-converter info archivo.csv
```

#### Todos los comandos disponibles
```bash
ultra-parquet-converter --help

# Comandos disponibles:
#   convert (c)  - Convierte un archivo
#   batch (b)    - Convierte múltiples archivos
#   info (i)     - Muestra información del archivo
#   setup        - Instala dependencias Python
```

### Como librería en tu código
```javascript
const { convertToParquet } = require('ultra-parquet-converter');

// Conversión simple
async function convert() {
  try {
    const result = await convertToParquet('datos.csv');
    console.log('✅ Conversión exitosa:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Con opciones
async function convertWithOptions() {
  const result = await convertToParquet('ventas.xlsx', {
    output: 'output/ventas.parquet',
    verbose: true
  });
  
  console.log(`Convertidos ${result.rows} registros`);
  console.log(`Compresión: ${result.compression_ratio}%`);
}
```

### Ejemplo completo
```javascript
const { convertToParquet, checkPythonSetup } = require('ultra-parquet-converter');

async function main() {
  // Verificar Python (detecta automáticamente py/python/python3)
  const pythonStatus = await checkPythonSetup();
  
  if (!pythonStatus.installed) {
    console.error('❌ Python no encontrado!');
    console.log('Instala Python 3.8+ desde https://python.org');
    return;
  }
  
  console.log(`✅ ${pythonStatus.message}`);
  
  // Convertir archivo
  try {
    const result = await convertToParquet('data/productos.json', {
      output: 'data/productos.parquet'
    });
    
    console.log('\n📊 Resultados:');
    console.log(`   Filas: ${result.rows.toLocaleString()}`);
    console.log(`   Columnas: ${result.columns}`);
    console.log(`   Tamaño original: ${formatBytes(result.input_size)}`);
    console.log(`   Tamaño Parquet: ${formatBytes(result.output_size)}`);
    console.log(`   Compresión: ${result.compression_ratio}%`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

main();
```

---

## 📊 Resultado de la conversión

El resultado incluye información detallada:

```javascript
{
  success: true,
  input_file: "/ruta/archivo.csv",
  output_file: "/ruta/archivo.parquet",
  rows: 10000,
  columns: 15,
  input_size: 2500000,      // bytes
  output_size: 450000,      // bytes
  compression_ratio: 82.0,  // porcentaje
  file_type: "csv"
}
```

---

## 🎯 Ventajas de Parquet

| Aspecto | Beneficio |
|---------|-----------|
| **Compresión** | 50-90% menos espacio que CSV/JSON |
| **Velocidad** | 10-100x más rápido para queries |
| **Columnar** | Lee solo columnas necesarias |
| **Schema** | Tipos de datos preservados |
| **Big Data** | Compatible con Spark, Pandas, Arrow |

---

## 🔍 Casos de uso

### 1. Data Engineering - Pipeline ETL
```bash
# Convierte logs diarios a Parquet
ultra-parquet-converter batch "logs/2024-11-*.log" -o parquet/logs/

# Procesa múltiples fuentes
ultra-parquet-converter batch "raw-data/*.csv" -o processed/
```

### 2. Data Science - Preparación de datasets
```javascript
// Preprocesa datasets para Machine Learning
const datasets = ['train.csv', 'test.csv', 'validation.csv'];

for (const dataset of datasets) {
  await convertToParquet(`data/${dataset}`, {
    output: `data/parquet/${dataset.replace('.csv', '.parquet')}`
  });
}
```

### 3. Analytics - Optimización de reportes
```bash
# Convierte reportes Excel pesados
ultra-parquet-converter batch "reports/*.xlsx" -o analytics/

# Resultado: Consultas 100x más rápidas
```

### 4. Archivado - Reducción de almacenamiento
```bash
# Comprime archivos históricos
ultra-parquet-converter batch "archive/*.csv" --compression brotli -o compressed/

# Ahorro típico: 80-90% de espacio
```

---

## ⚙️ API Detallada

### `convertToParquet(inputFile, options)`

Convierte un archivo a formato Parquet.

**Parámetros:**
- `inputFile` (string): Ruta del archivo a convertir
- `options` (object, opcional):
  - `output` (string): Ruta del archivo de salida
  - `verbose` (boolean): Modo verbose con logs detallados

**Retorna:** `Promise<Object>` con información de la conversión

**Lanza:** `Error` si el archivo no existe, formato no soportado, o error en conversión

### `checkPythonSetup()`

Verifica que Python esté instalado correctamente.

**Retorna:** `Promise<Object>` con estado de la instalación
```javascript
{
  installed: true,
  message: "Python está instalado (comando: py)"
}
```

> 💡 **Nota**: Esta función detecta automáticamente si el sistema usa `py`, `python` o `python3`

---

## 🐛 Solución de problemas

### Python no encontrado
```bash
# Verifica la instalación
py --version       # Windows
python --version   # Linux/Windows
python3 --version  # Linux/macOS

# Si no está instalado:
# Windows: https://python.org (marca "Add to PATH")
# macOS: brew install python
# Ubuntu: sudo apt install python3 python3-pip
```

### Dependencias Python faltantes
```bash
# Reinstalar dependencias (automático)
ultra-parquet-converter setup

# O manualmente
pip install --upgrade pandas pyarrow openpyxl lxml

# En Linux/macOS puede ser:
pip3 install --upgrade pandas pyarrow openpyxl lxml
```

### Error "MODULE_NOT_FOUND"
```bash
# Instalar dependencias de Node.js
npm install

# Si usas el paquete globalmente
npm install -g ultra-parquet-converter
```

### Error de memoria con archivos grandes
```bash
# Aumentar memoria de Node.js
NODE_OPTIONS="--max-old-space-size=4096" ultra-parquet-converter convert huge_file.csv
```

---

## 🏗️ Estructura del proyecto
```
ultra-parquet-converter/
├── src/
│   ├── index.js          # API JavaScript (auto-detecta Python)
│   ├── cli.js            # CLI con comandos avanzados
│   └── setup.js          # Script post-instalación
├── python/
│   ├── converter.py      # Motor de conversión (Pandas + PyArrow)
│   └── requirements.txt  # Dependencias Python
├── test/
│   └── test.js           # Tests automatizados
├── package.json
├── LICENSE
└── README.md
```

---

## 🤝 Contribuir

Las contribuciones son bienvenidas! Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Apache-2.0 License - ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 🙏 Agradecimientos

- **Apache Arrow** - Motor de conversión columnar
- **Pandas** - Manipulación de datos en Python
- **Commander.js** - CLI framework
- **Chalk** & **Ora** - Interfaz de usuario hermosa

---

## 📧 Soporte

¿Encontraste un bug? ¿Tienes una sugerencia? 

- 🐛 [Reportar un issue](https://github.com/Brashkie/ultra-parquet-converter/issues)
- 💡 [Solicitar una feature](https://github.com/Brashkie/ultra-parquet-converter/issues)
- 📧 Email: electronicatodo2006@gmail.com

---

## 📈 Changelog

### v1.1.0 (Actual)
- ✨ Soporte para TSV, PSV y DSV
- 🚀 Comando `batch` para conversión masiva
- 📋 Comando `info` para ver detalles de archivos
- 🔄 Auto-detección de Python (`py`, `python`, `python3`)
- ⚙️ Opciones de compresión personalizables

### v1.0.0
- 🎉 Lanzamiento inicial
- ✅ Soporte para CSV, XLSX, JSON, XML, TXT, LOG

Ver [CHANGELOG.md](CHANGELOG.md) completo

---

## 🗺️ Roadmap

- [ ] Soporte para múltiples hojas en Excel
- [ ] Streaming para archivos gigantes (>5GB)
- [ ] Integración con S3/Cloud Storage
- [ ] GUI web opcional
- [ ] Plugins para formatos personalizados
- [ ] Soporte para Avro y ORC

---

**Hecho con ❤️ para la comunidad de Data Engineering**

**Creador: Hepein Oficial x Brashkie**

⭐ Si te gusta este proyecto, ¡dale una estrella en [GitHub](https://github.com/Brashkie/ultra-parquet-converter)!

