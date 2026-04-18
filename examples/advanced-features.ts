/**
 * Advanced Features Example
 * Streaming, auto-repair, auto-normalize, y más
 */

import { convertToParquet } from '../src/index';
import { existsSync, statSync } from 'fs';

async function advancedFeaturesExample() {
  console.log('💎 Ultra Parquet Converter - Advanced Features\n');

  // 1. Streaming Mode (archivos grandes)
  console.log('🌊 Streaming Mode (archivos grandes):');
  const largeFile = 'large_dataset.csv'; // 1GB+
  
  if (existsSync(largeFile)) {
    const result1 = await convertToParquet(largeFile, {
      streaming: true,
      verbose: true
    });

    console.log(`   Chunks procesados: ${result1.chunks_processed}`);
    console.log(`   Memoria constante: ~300MB\n`);
  }

  // 2. Auto-Repair (datos corruptos)
  console.log('🛠️  Auto-Repair (corrige datos automáticamente):');
  const result2 = await convertToParquet('broken_data.csv', {
    autoRepair: true
  });

  console.log(`   Errores corregidos: ${result2.errors_fixed || 0}`);
  console.log(`   Columnas eliminadas: ${result2.columns_removed || 0}\n`);

  // 3. Auto-Normalize (normaliza columnas)
  console.log('🔧 Auto-Normalize (normaliza nombres):');
  const result3 = await convertToParquet('messy_columns.csv', {
    autoNormalize: true
  });

  console.log(`   Columnas normalizadas automáticamente\n`);

  // 4. Compresión personalizada
  console.log('📦 Compresión Personalizada:');
  const compressions = ['snappy', 'gzip', 'brotli', 'none'] as const;

  for (const compression of compressions) {
    const result = await convertToParquet('data.csv', {
      output: `output_${compression}.parquet`,
      compression
    });

    console.log(`   ${compression}: ${result.compression_ratio}% reducción`);
  }

  console.log();

  // 5. Benchmark completo
  console.log('⚡ Benchmark Completo:');
  const start = Date.now();

  const result5 = await convertToParquet('data.csv', {
    verbose: false
  });

  const elapsed = (Date.now() - start) / 1000;
  const speed = Math.round(result5.rows / elapsed);

  console.log(`   Filas: ${result5.rows.toLocaleString()}`);
  console.log(`   Tiempo: ${elapsed.toFixed(2)}s`);
  console.log(`   Velocidad: ${speed.toLocaleString()} filas/s`);
  console.log(`   Backend: ${result5.backend}\n`);

  // 6. Batch processing
  console.log('📁 Batch Processing:');
  const files = ['file1.csv', 'file2.csv', 'file3.csv'];
  let totalRows = 0;
  let totalTime = 0;

  for (const file of files) {
    if (!existsSync(file)) continue;

    const fileStart = Date.now();
    const result = await convertToParquet(file);
    const fileElapsed = (Date.now() - fileStart) / 1000;

    totalRows += result.rows;
    totalTime += fileElapsed;

    console.log(`   ✓ ${file}: ${result.rows} filas en ${fileElapsed.toFixed(2)}s`);
  }

  console.log(`\n   Total: ${totalRows.toLocaleString()} filas en ${totalTime.toFixed(2)}s`);
  console.log(`   Velocidad promedio: ${Math.round(totalRows / totalTime).toLocaleString()} filas/s`);
}

// Ejecutar ejemplo
if (require.main === module) {
  advancedFeaturesExample().catch(console.error);
}

export { advancedFeaturesExample };