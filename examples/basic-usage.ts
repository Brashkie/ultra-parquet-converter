/**
 * Basic Usage Example
 * Muestra cómo usar ultra-parquet-converter
 */

import { convertToParquet, checkPythonSetup } from '../src/index';

async function basicExample() {
  console.log('🚀 Ultra Parquet Converter - Basic Usage\n');

  // 1. Verificar Python
  const pythonCheck = await checkPythonSetup();
  console.log('Python Status:', pythonCheck.message);

  if (!pythonCheck.installed) {
    console.log('⚠️  Por favor instala Python 3.8+');
    return;
  }

  // 2. Conversión simple
  console.log('\n📄 Convirtiendo archivo CSV...');
  const result = await convertToParquet('data.csv');

  console.log('\n✅ Resultado:');
  console.log(`   Filas: ${result.rows}`);
  console.log(`   Columnas: ${result.columns}`);
  console.log(`   Compresión: ${result.compression_ratio}%`);
  console.log(`   Backend usado: ${result.backend}`);
  console.log(`   Tiempo: ${result.elapsed_time}s`);
}

// Ejecutar ejemplo
if (require.main === module) {
  basicExample().catch(console.error);
}

export { basicExample };