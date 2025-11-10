# 🚀 Ultra Parquet Converter

[![npm version](https://img.shields.io/npm/v/ultra-parquet-converter.svg)](https://www.npmjs.com/package/ultra-parquet-converter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

**Conversor universal de archivos a formato Parquet** con detección automática de tipo de archivo. Soporta CSV, XLSX, JSON, XML, TXT y LOG.

Combina la velocidad de Node.js con el poder de Python + Apache Arrow para conversiones ultra-rápidas y eficientes.

---

## ✨ Características

- 🎯 **Detección automática** de tipo de archivo por extensión
- ⚡ **Ultra-rápido** gracias a Apache Arrow y Pandas
- 📦 **Compresión Snappy** para archivos más pequeños
- 🔧 **Dual mode**: CLI y librería JavaScript
- 🌈 **Interfaz amigable** con colores y spinners
- 📊 **Estadísticas detalladas** de conversión
- 🛡️ **Manejo robusto de errores**

## 📋 Formatos Soportados

| Formato | Extensión | Detección |
|---------|-----------|-----------|
| CSV | `.csv` | ✅ Automática |
| Excel | `.xlsx`, `.xls` | ✅ Automática |
| JSON | `.json` | ✅ Múltiples orientaciones |
| XML | `.xml` | ✅ Parsing inteligente |
| Texto | `.txt` | ✅ Detección de delimitadores |
| Logs | `.log` | ✅ Parsing línea por línea |

---

## 🔧 Instalación

### Requisitos previos

- **Node.js** 18 o superior
- **Python 3.8+** instalado en el sistema
- **pip** para instalar dependencias Python

### Instalar el paquete

```bash
npm install ultra-parquet-converter
```

### Instalar dependencias Python

Después de instalar el paquete NPM:

```bash
npx ultra-parquet-converter setup
```

O manualmente:

```bash
pip install pandas pyarrow openpyxl lxml
```

---

## 🚀 Uso

### Como CLI (Línea de comandos)

#### Conversión básica

```bash
npx ultra-parquet-converter archivo.csv
```

Esto creará `archivo.parquet` en el mismo directorio.

#### Especificar archivo de salida

```bash
npx ultra-parquet-converter datos.json -o salida.parquet
```

#### Modo verbose

```bash
npx ultra-parquet-converter logs.log -v
```

#### Ejemplos prácticos

```bash
# Convertir CSV
npx ultra-parquet-converter ventas_2024.csv

# Convertir Excel con salida personalizada
npx ultra-parquet-converter reporte.xlsx -o data/reporte.parquet

# Convertir JSON con información detallada
npx ultra-parquet-converter api_response.json -v

# Convertir logs
npx ultra-parquet-converter app.log -o logs/app.parquet
```

### Como librería en tu código

```javascript
const { convertToParquet } = require('ultra-parquet-converter');

// Conversión simple
async function convert() {
  try {
    const result = await convertToParquet('datos.csv');
    console.log('Conversión exitosa:', result);
  } catch (error) {
    console.error('Error:', error.message);
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
  // Verificar Python
  const pythonStatus = await checkPythonSetup();
  
  if (!pythonStatus.installed) {
    console.error('Python no encontrado!');
    return;
  }
  
  // Convertir archivo
  try {
    const result = await convertToParquet('data/productos.json', {
      output: 'data/productos.parquet'
    });
    
    console.log('✅ Conversión completa');
    console.log(`📊 Filas: ${result.rows}`);
    console.log(`📁 Tamaño original: ${result.input_size} bytes`);
    console.log(`📦 Tamaño Parquet: ${result.output_size} bytes`);
    console.log(`🗜️  Compresión: ${result.compression_ratio}%`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
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

### Data Engineering
```bash
# Pipeline ETL: convierte logs diarios
for file in logs/*.log; do
  npx ultra-parquet-converter "$file" -o "parquet/${file%.log}.parquet"
done
```

### Data Science
```javascript
// Preprocesa datasets para ML
const datasets = ['train.csv', 'test.csv', 'validation.csv'];

for (const dataset of datasets) {
  await convertToParquet(`data/${dataset}`, {
    output: `data/parquet/${dataset.replace('.csv', '.parquet')}`
  });
}
```

### Analytics
```bash
# Convierte reportes Excel para análisis más rápidos
npx ultra-parquet-converter reports/monthly_sales.xlsx -o analytics/sales.parquet
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
  message: "Python está instalado"
}
```

---

## 🐛 Solución de problemas

### Python no encontrado

```bash
# Verifica la instalación
python --version

# Si no está instalado:
# macOS: brew install python
# Ubuntu: sudo apt install python python-pip
# Windows: descargar de python.org
```

### Dependencias Python faltantes

```bash
# Reinstalar dependencias
npx ultra-parquet-converter setup

# O manualmente
pip3 install --upgrade pandas pyarrow openpyxl lxml
```

### Error de memoria con archivos grandes

Para archivos muy grandes (>1GB), considera procesarlos por chunks en Python directamente o aumentar la memoria de Node.js:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx ultra-parquet-converter huge_file.csv
```

---

## 🏗️ Estructura del proyecto

```
ultra-parquet-converter/
├── src/
│   ├── index.js          # API JavaScript principal
│   ├── cli.js            # Interfaz de línea de comandos
│   └── setup.js          # Script post-instalación
├── python/
│   ├── converter.py      # Conversor Python (backend)
│   └── requirements.txt  # Dependencias Python
├── test/
│   └── test.js           # Tests de ejemplo
├── package.json
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

## 📈 Roadmap

- [ ] Soporte para múltiples hojas en Excel
- [ ] Conversión batch de directorios
- [ ] Streaming para archivos gigantes
- [ ] Integración con S3/Cloud Storage
- [ ] GUI web opcional
- [ ] Plugins para formatos personalizados

---

**Hecho con ❤️ para la comunidad de Data Engineering**
**Creador: Hepein Oficial x Brashkie**

⭐ Si te gusta este proyecto, dale una estrella en GitHub!
