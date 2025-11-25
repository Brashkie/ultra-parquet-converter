#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const { convertToParquet, checkPythonSetup, analyzeFile, benchmarkConversion, validateParquet } = require('./index');

// Función auxiliar para formatear bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Función para formatear tiempo
function formatTime(seconds) {
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(0);
  return `${minutes}m ${secs}s`;
}

// Función para encontrar archivos por patrón
function findFiles(pattern) {
  const dir = path.dirname(pattern) || '.';
  const filePattern = path.basename(pattern);
  
  try {
    const files = fs.readdirSync(dir);
    const regex = new RegExp(filePattern.replace(/\*/g, '.*'));
    
    return files
      .filter(file => regex.test(file))
      .map(file => path.join(dir, file));
  } catch (error) {
    return [];
  }
}

program
  .name('ultra-parquet-converter')
  .description('🚀 Conversor profesional de archivos a Parquet v1.1.0')
  .version('1.1.0');

// ========================================
// Comando: convert - Conversión individual
// ========================================
program
  .command('convert <input>')
  .alias('c')
  .description('Convierte un archivo a Parquet')
  .option('-o, --output <file>', 'Archivo de salida')
  .option('-v, --verbose', 'Modo verbose con información detallada')
  .option('--compression <type>', 'Tipo de compresión: snappy, gzip, brotli, none', 'snappy')
  .option('--streaming', 'Modo streaming para archivos grandes (>100MB)')
  .option('--no-repair', 'Desactivar auto-reparación de datos')
  .option('--no-normalize', 'Desactivar auto-normalización')
  .option('--benchmark', 'Mostrar benchmark detallado')
  .action(async (input, options) => {
    console.log(chalk.bold.cyan('\n🔄 Ultra Parquet Converter v1.1.0\n'));

    // Verifica Python
    const spinner = ora('Verificando Python...').start();
    const pythonCheck = await checkPythonSetup();

    if (!pythonCheck.installed) {
      spinner.fail(chalk.red('Python no encontrado'));
      console.log(chalk.yellow('\n⚠️  Instala Python 3.8+ y ejecuta:'));
      console.log(chalk.white('   pip install -r python/requirements.txt\n'));
      process.exit(1);
    }

    spinner.succeed(chalk.green(pythonCheck.message));

    // Convierte el archivo
    const convertSpinner = ora('Convirtiendo archivo...').start();

    try {
      const startTime = Date.now();
      const result = await convertToParquet(input, {
        ...options,
        streaming: options.streaming || false,
        autoRepair: options.repair !== false,
        autoNormalize: options.normalize !== false
      });

      const elapsed = (Date.now() - startTime) / 1000;

      convertSpinner.succeed(chalk.green('✅ Conversión exitosa!'));

      // Muestra resultados
      console.log(chalk.bold('\n📊 Resultados:\n'));
      console.log(chalk.white(`   Archivo origen:  ${chalk.cyan(path.basename(result.input_file))}`));
      console.log(chalk.white(`   Archivo destino: ${chalk.cyan(path.basename(result.output_file))}`));
      console.log(chalk.white(`   Tipo detectado:  ${chalk.blue(result.file_type.toUpperCase())}`));
      console.log(chalk.white(`   Filas:           ${chalk.yellow(result.rows.toLocaleString())}`));
      console.log(chalk.white(`   Columnas:        ${chalk.yellow(result.columns)}`));
      console.log(chalk.white(`   Tamaño original: ${chalk.magenta(formatBytes(result.input_size))}`));
      console.log(chalk.white(`   Tamaño Parquet:  ${chalk.magenta(formatBytes(result.output_size))}`));
      console.log(chalk.white(`   Compresión:      ${chalk.green(result.compression_ratio + '%')}`));
      console.log(chalk.white(`   Tiempo:          ${chalk.cyan(formatTime(result.elapsed_time || elapsed))}`));

      // Estadísticas avanzadas (si están disponibles)
      if (result.streaming_mode) {
        console.log(chalk.white(`   Modo:            ${chalk.magenta('STREAMING')}`));
        console.log(chalk.white(`   Chunks:          ${chalk.yellow(result.chunks_processed)}`));
      }

      if (result.errors_fixed > 0) {
        console.log(chalk.white(`   Errores corregidos: ${chalk.green(result.errors_fixed)}`));
      }

      if (result.columns_removed > 0) {
        console.log(chalk.white(`   Columnas eliminadas: ${chalk.yellow(result.columns_removed)}`));
      }

      // Benchmark si se solicita
      if (options.benchmark && result.rows > 0) {
        const speed = Math.round(result.rows / (result.elapsed_time || elapsed));
        console.log(chalk.bold('\n⚡ Benchmark:\n'));
        console.log(chalk.white(`   Velocidad:       ${chalk.cyan(speed.toLocaleString())} filas/s`));
        console.log(chalk.white(`   Throughput:      ${chalk.cyan(formatBytes(result.input_size / (result.elapsed_time || elapsed)))}/s`));
      }

      console.log();

    } catch (error) {
      convertSpinner.fail(chalk.red('Error en conversión'));
      console.error(chalk.red(`\n❌ ${error.message}\n`));
      process.exit(1);
    }
  });

// ========================================
// Comando: batch - Conversión masiva
// ========================================
program
  .command('batch <pattern>')
  .alias('b')
  .description('Convierte múltiples archivos usando un patrón')
  .option('-o, --output-dir <dir>', 'Directorio de salida', './output')
  .option('-v, --verbose', 'Modo verbose')
  .option('--streaming', 'Modo streaming para archivos grandes')
  .option('--parallel <n>', 'Conversiones paralelas (experimental)', '1')
  .action(async (pattern, options) => {
    console.log(chalk.bold.cyan('\n📦 Ultra Parquet Converter - Modo Batch v1.1.0\n'));

    // Encuentra archivos
    const files = findFiles(pattern);
    
    if (files.length === 0) {
      console.log(chalk.yellow(`⚠️  No se encontraron archivos: ${pattern}\n`));
      process.exit(0);
    }

    console.log(chalk.white(`Archivos encontrados: ${chalk.cyan(files.length)}\n`));

    // Verifica Python
    const pythonCheck = await checkPythonSetup();
    if (!pythonCheck.installed) {
      console.log(chalk.red('❌ Python no encontrado\n'));
      process.exit(1);
    }

    // Crea directorio de salida
    if (!fs.existsSync(options.outputDir)) {
      fs.mkdirSync(options.outputDir, { recursive: true });
    }

    // Procesa archivos
    const results = {
      success: 0,
      failed: 0,
      totalRows: 0,
      totalSaved: 0,
      totalTime: 0
    };

    const startTime = Date.now();

    for (const file of files) {
      const fileName = path.basename(file);
      const outputFile = path.join(
        options.outputDir,
        path.basename(file, path.extname(file)) + '.parquet'
      );

      const spinner = ora(`Convirtiendo: ${fileName}`).start();

      try {
        const result = await convertToParquet(file, {
          output: outputFile,
          verbose: options.verbose,
          streaming: options.streaming
        });

        results.success++;
        results.totalRows += result.rows;
        results.totalSaved += (result.input_size - result.output_size);
        results.totalTime += (result.elapsed_time || 0);

        spinner.succeed(chalk.green(`${fileName} → ${result.compression_ratio}% compresión`));

      } catch (error) {
        results.failed++;
        spinner.fail(chalk.red(`${fileName}: ${error.message}`));
      }
    }

    const totalElapsed = (Date.now() - startTime) / 1000;

    // Muestra resumen
    console.log(chalk.bold('\n📊 Resumen del Batch:\n'));
    console.log(chalk.white(`   ✅ Exitosos:         ${chalk.green(results.success)}`));
    console.log(chalk.white(`   ❌ Fallidos:         ${chalk.red(results.failed)}`));
    console.log(chalk.white(`   📁 Total filas:      ${chalk.yellow(results.totalRows.toLocaleString())}`));
    console.log(chalk.white(`   💾 Espacio ahorrado: ${chalk.cyan(formatBytes(results.totalSaved))}`));
    console.log(chalk.white(`   ⏱️  Tiempo total:     ${chalk.magenta(formatTime(totalElapsed))}`));
    
    if (results.success > 0) {
      const avgSpeed = Math.round(results.totalRows / totalElapsed);
      console.log(chalk.white(`   ⚡ Velocidad media:  ${chalk.cyan(avgSpeed.toLocaleString())} filas/s`));
    }
    
    console.log();
  });

// ========================================
// Comando: analyze - Analiza estructura
// ========================================
program
  .command('analyze <file>')
  .alias('a')
  .description('Analiza un archivo y muestra su estructura')
  .action(async (file) => {
    console.log(chalk.bold.cyan('\n🔍 Análisis de Archivo\n'));

    if (!fs.existsSync(file)) {
      console.log(chalk.red(`❌ Archivo no encontrado: ${file}\n`));
      process.exit(1);
    }

    const spinner = ora('Analizando archivo...').start();

    try {
      const analysis = await analyzeFile(file);
      
      spinner.succeed(chalk.green('Análisis completado'));

      console.log(chalk.bold('\n📋 Información General:\n'));
      console.log(chalk.white(`   Nombre:          ${chalk.cyan(path.basename(file))}`));
      console.log(chalk.white(`   Tipo detectado:  ${chalk.blue(analysis.detected_type.toUpperCase())}`));
      console.log(chalk.white(`   Tamaño:          ${chalk.magenta(formatBytes(analysis.size))}`));
      console.log(chalk.white(`   Filas:           ${chalk.yellow(analysis.rows?.toLocaleString() || 'N/A')}`));
      console.log(chalk.white(`   Columnas:        ${chalk.yellow(analysis.columns || 'N/A')}`));

      if (analysis.schema) {
        console.log(chalk.bold('\n📊 Schema:\n'));
        analysis.schema.forEach(col => {
          console.log(chalk.white(`   ${chalk.cyan(col.name.padEnd(20))} ${chalk.gray(col.type)}`));
        });
      }

      if (analysis.preview) {
        console.log(chalk.bold('\n👁️  Preview (primeras 5 filas):\n'));
        console.log(chalk.gray(analysis.preview));
      }

      console.log();

    } catch (error) {
      spinner.fail(chalk.red('Error en análisis'));
      console.error(chalk.red(`\n❌ ${error.message}\n`));
      process.exit(1);
    }
  });

// ========================================
// Comando: benchmark - Medir performance
// ========================================
program
  .command('benchmark <file>')
  .description('Realiza benchmark de conversión')
  .option('--iterations <n>', 'Número de iteraciones', '3')
  .option('--streaming', 'Probar modo streaming')
  .action(async (file, options) => {
    console.log(chalk.bold.cyan('\n⚡ Benchmark de Conversión\n'));

    if (!fs.existsSync(file)) {
      console.log(chalk.red(`❌ Archivo no encontrado: ${file}\n`));
      process.exit(1);
    }

    const iterations = parseInt(options.iterations);
    const results = [];

    console.log(chalk.white(`Archivo: ${chalk.cyan(file)}`));
    console.log(chalk.white(`Iteraciones: ${chalk.yellow(iterations)}\n`));

    for (let i = 1; i <= iterations; i++) {
      const spinner = ora(`Iteración ${i}/${iterations}...`).start();

      try {
        const result = await benchmarkConversion(file, {
          streaming: options.streaming
        });

        results.push(result);
        spinner.succeed(chalk.green(`Iteración ${i}: ${formatTime(result.elapsed_time)}`));

      } catch (error) {
        spinner.fail(chalk.red(`Iteración ${i} falló`));
      }
    }

    if (results.length === 0) {
      console.log(chalk.red('\n❌ Todas las iteraciones fallaron\n'));
      process.exit(1);
    }

    // Calcula estadísticas
    const times = results.map(r => r.elapsed_time);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const avgRows = results[0].rows;
    const speed = Math.round(avgRows / avgTime);

    console.log(chalk.bold('\n📊 Resultados:\n'));
    console.log(chalk.white(`   Filas procesadas:    ${chalk.yellow(avgRows.toLocaleString())}`));
    console.log(chalk.white(`   Tiempo promedio:     ${chalk.cyan(formatTime(avgTime))}`));
    console.log(chalk.white(`   Tiempo mínimo:       ${chalk.green(formatTime(minTime))}`));
    console.log(chalk.white(`   Tiempo máximo:       ${chalk.red(formatTime(maxTime))}`));
    console.log(chalk.white(`   Velocidad promedio:  ${chalk.magenta(speed.toLocaleString())} filas/s`));
    console.log(chalk.white(`   Throughput:          ${chalk.cyan(formatBytes(results[0].input_size / avgTime))}/s`));
    console.log();
  });

// ========================================
// Comando: info - Información de archivo
// ========================================
program
  .command('info <file>')
  .alias('i')
  .description('Muestra información del archivo sin convertir')
  .action((file) => {
    console.log(chalk.bold.cyan('\n📋 Información del Archivo\n'));

    if (!fs.existsSync(file)) {
      console.log(chalk.red(`❌ Archivo no encontrado: ${file}\n`));
      process.exit(1);
    }

    const stats = fs.statSync(file);
    const ext = path.extname(file).toLowerCase();

    console.log(chalk.white(`   Nombre:      ${chalk.cyan(path.basename(file))}`));
    console.log(chalk.white(`   Ruta:        ${chalk.gray(path.resolve(file))}`));
    console.log(chalk.white(`   Extensión:   ${chalk.blue(ext)}`));
    console.log(chalk.white(`   Tamaño:      ${chalk.magenta(formatBytes(stats.size))}`));
    console.log(chalk.white(`   Creado:      ${chalk.yellow(stats.birthtime.toLocaleString())}`));
    console.log(chalk.white(`   Modificado:  ${chalk.yellow(stats.mtime.toLocaleString())}`));
    console.log();
  });

// ========================================
// Comando: validate - Valida Parquet
// ========================================
program
  .command('validate <file>')
  .description('Valida un archivo Parquet')
  .action(async (file) => {
    console.log(chalk.bold.cyan('\n✓ Validación de Parquet\n'));

    if (!fs.existsSync(file)) {
      console.log(chalk.red(`❌ Archivo no encontrado: ${file}\n`));
      process.exit(1);
    }

    const spinner = ora('Validando archivo Parquet...').start();

    try {
      const validation = await validateParquet(file);

      if (validation.valid) {
        spinner.succeed(chalk.green('✅ Archivo Parquet válido'));

        console.log(chalk.bold('\n📊 Información:\n'));
        console.log(chalk.white(`   Filas:       ${chalk.yellow(validation.rows.toLocaleString())}`));
        console.log(chalk.white(`   Columnas:    ${chalk.yellow(validation.columns)}`));
        console.log(chalk.white(`   Compresión:  ${chalk.cyan(validation.compression)}`));
        console.log(chalk.white(`   Versión:     ${chalk.gray(validation.version)}`));
        console.log();
      } else {
        spinner.fail(chalk.red('❌ Archivo Parquet inválido'));
        console.log(chalk.red(`\n   Error: ${validation.error}\n`));
        process.exit(1);
      }

    } catch (error) {
      spinner.fail(chalk.red('Error en validación'));
      console.error(chalk.red(`\n❌ ${error.message}\n`));
      process.exit(1);
    }
  });

// ========================================
// Comando: setup - Instalar dependencias
// ========================================
program
  .command('setup')
  .description('Instala las dependencias Python necesarias')
  .action(async () => {
    console.log(chalk.bold.cyan('\n🔧 Instalando dependencias Python...\n'));

    const spinner = ora('Instalando paquetes...').start();

    const { spawn } = require('child_process');
    const requirementsPath = path.join(__dirname, '..', 'python', 'requirements.txt');

    const installProcess = spawn('pip', ['install', '-r', requirementsPath], {
      stdio: 'inherit'
    });

    installProcess.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(chalk.green('✅ Dependencias instaladas correctamente'));
        console.log(chalk.white('\n✨ Ahora puedes usar ultra-parquet-converter\n'));
      } else {
        spinner.fail(chalk.red('Error al instalar dependencias'));
        process.exit(1);
      }
    });

    installProcess.on('error', (err) => {
      spinner.fail(chalk.red('Error al ejecutar pip'));
      console.error(chalk.red(`\n❌ ${err.message}\n`));
      process.exit(1);
    });
  });

// Si no hay argumentos, muestra ayuda
if (process.argv.length === 2) {
  program.help();
}

program.parse();
