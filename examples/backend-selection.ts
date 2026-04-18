/**
 * Backend Selection Example
 * Muestra cómo seleccionar y usar diferentes backends
 */

import {
  convertToParquet,
  getAvailableBackends,
  setBackend,
  getCurrentBackend
} from '../src/index';

async function backendSelectionExample() {
  console.log('🔧 Ultra Parquet Converter - Backend Selection\n');

  // 1. Ver backends disponibles
  console.log('📋 Backends Disponibles:\n');
  const backends = await getAvailableBackends();

  for (const [name, info] of Object.entries(backends)) {
    const status = info.available ? '✅' : '❌';
    console.log(`${status} ${name}`);
    console.log(`   Velocidad: ${info.speed}`);
    console.log(`   ${info.description}`);
    console.log(`   Limitaciones: ${info.limitations}\n`);
  }

  // 2. Selección automática (recomendado)
  console.log('\n🤖 Selección Automática (Default):');
  const result1 = await convertToParquet('data.csv');
  console.log(`   Backend usado: ${result1.backend}`);

  // 3. Forzar Native Python
  console.log('\n⚡ Forzando Native Python:');
  setBackend('native-python');
  console.log(`   Backend actual: ${getCurrentBackend()}`);
  
  const result2 = await convertToParquet('data.csv');
  console.log(`   Backend usado: ${result2.backend}`);

  // 4. Forzar Portable Python
  console.log('\n📦 Forzando Portable Python:');
  setBackend('portable-python');
  
  const result3 = await convertToParquet('data.csv');
  console.log(`   Backend usado: ${result3.backend}`);

  // 5. Comparación de velocidad
  console.log('\n⚡ Benchmark de Backends:\n');
  const backends_to_test = ['native-python', 'portable-python'];

  for (const backend of backends_to_test) {
    setBackend(backend as any);
    
    const start = Date.now();
    await convertToParquet('data.csv');
    const elapsed = Date.now() - start;

    console.log(`   ${backend}: ${elapsed}ms`);
  }
}

// Ejecutar ejemplo
if (require.main === module) {
  backendSelectionExample().catch(console.error);
}

export { backendSelectionExample };