const fs = require('fs');
const path = require('path');
const { convertToParquet, checkPythonSetup } = require('../src/index');

async function runTests() {
  console.log('🧪 Ejecutando tests de ultra-parquet-converter\n');

  // Test 1: Verificar Python
  console.log('Test 1: Verificando Python...');
  try {
    const pythonStatus = await checkPythonSetup();
    if (pythonStatus.installed) {
      console.log('✅ Python detectado correctamente\n');
    } else {
      console.log('⚠️  Python no detectado\n');
      return;
    }
  } catch (error) {
    console.log('❌ Error al verificar Python:', error.message);
    return;
  }

  // Test 2: Crear archivo CSV de prueba
  console.log('Test 2: Creando archivo CSV de prueba...');
  const testDir = path.join(__dirname, 'test_data');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const csvPath = path.join(testDir, 'test.csv');
  const csvContent = `id,name,age,city
1,Alice,30,New York
2,Bob,25,Los Angeles
3,Charlie,35,Chicago
4,Diana,28,Houston
5,Eve,32,Phoenix`;

  fs.writeFileSync(csvPath, csvContent);
  console.log('✅ Archivo CSV creado\n');

  // Test 3: Convertir CSV a Parquet
  console.log('Test 3: Convirtiendo CSV a Parquet...');
  try {
    const result = await convertToParquet(csvPath, {
      output: path.join(testDir, 'test_output.parquet')
    });

    console.log('✅ Conversión exitosa!');
    console.log(`   Filas: ${result.rows}`);
    console.log(`   Columnas: ${result.columns}`);
    console.log(`   Compresión: ${result.compression_ratio}%\n`);
  } catch (error) {
    console.log('❌ Error en conversión:', error.message);
    return;
  }

  // Test 4: Crear y convertir JSON
  console.log('Test 4: Convirtiendo JSON a Parquet...');
  const jsonPath = path.join(testDir, 'test.json');
  const jsonContent = JSON.stringify([
    { product: 'Laptop', price: 999, stock: 50 },
    { product: 'Mouse', price: 25, stock: 200 },
    { product: 'Keyboard', price: 75, stock: 150 }
  ], null, 2);

  fs.writeFileSync(jsonPath, jsonContent);

  try {
    const result = await convertToParquet(jsonPath);
    console.log('✅ JSON convertido exitosamente');
    console.log(`   Archivo: ${path.basename(result.output_file)}\n`);
  } catch (error) {
    console.log('❌ Error en conversión JSON:', error.message);
  }

  console.log('✨ Tests completados!\n');
  console.log('📁 Archivos generados en:', testDir);
}

runTests().catch(console.error);
