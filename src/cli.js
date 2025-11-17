#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
const { convertToParquet, checkPythonSetup } = require('./index');

// Función auxiliar para formatear bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Función para encontrar archivos por patrón
function findFiles(pattern) {
  const dir = path.dirname(pattern) || '.';
  const filePattern = path.basename(pattern);
  
  try {
    const files = fs.readdirSync(dir);
    const regex = new RegExp(filePattern.replace('*', '.*'));
    
    return files
      .filter(file => regex.test(file))
      .map(file => path.join(dir, file));
  } catch (error) {
    return [];
  }
}

program
  .name('ultra-parquet-converter')
  .description('🚀 Convierte archivos CSV, TSV, PSV, DSV, XLSX, JSON, XML, TXT, LOG a formato Parquet')
  .version('1.0.3');

// Comando principal: conversión simple
program
  .command('convert <input>')
  .alias('c')
  .description('Convierte un archivo a Parquet')
  .option('-o, --output <file>', 'Archivo de salida')
  .option('-v, --verbose', 'Modo verbose con información detallada')
  .option('--compression <type>', 'Tipo de compresión: snappy, gzip, brotli, none', 'snappy')
  .action(async (input, options) => {
    console.log(chalk.bold.cyan('\n🔄 Ultra Parquet Converter\n'));

    // Verifica Python
    const spinner = ora('Verificando Python...').start();
    const pythonCheck = await checkPythonSetup();

    if (!pythonCheck.installed) {
      spinner.fail(chalk.red('Python no encontrado'));
      console.log(chalk.yellow('\n⚠️  Instala Python y ejecuta:'));
      console.log(chalk.white('   pip install pandas pyarrow openpyxl lxml\n'));
      process.exit(1);
    }

    spinner.succeed(chalk.green('Python detectado'));

    // Convierte el archivo
    const convertSpinner = ora('Convirtiendo archivo...').start();

    try {
      const result = await convertToParquet(input, options);

      convertSpinner.succeed(chalk.green('✅ Conversión exitosa!'));

      // Muestra resultados
      console.log(chalk.bold('\n📊 Resultados:\n'));
      console.log(chalk.white(`   Archivo origen:  ${chalk.cyan(path.basename(result.input_file))}`));
      console.log(chalk.white(`   Archivo destino: ${chalk.cyan(path.basename(result.output_file))}`));
      console.log(chalk.white(`   Filas:           ${chalk.yellow(result.rows.toLocaleString())}`));
      console.log(chalk.white(`   Columnas:        ${chalk.yellow(result.columns)}`));
      console.log(chalk.white(`   Tamaño original: ${chalk.magenta(formatBytes(result.input_size))}`));
      console.log(chalk.white(`   Tamaño Parquet:  ${chalk.magenta(formatBytes(result.output_size))}`));
      console.log(chalk.white(`   Compresión:      ${chalk.green(result.compression_ratio + '%')}`));
      console.log(chalk.white(`   Tipo detectado:  ${chalk.blue(result.file_type.toUpperCase())}\n`));

    } catch (error) {
      convertSpinner.fail(chalk.red('Error en conversión'));
      console.error(chalk.red(`\n❌ ${error.message}\n`));
      process.exit(1);
    }
  });

// Comando batch: convierte múltiples archivos
program
  .command('batch <pattern>')
  .alias('b')
  .description('Convierte múltiples archivos usando un patrón (ej: *.csv, data/*.json)')
  .option('-o, --output-dir <dir>', 'Directorio de salida', './output')
  .option('-v, --verbose', 'Modo verbose')
  .option('--parallel <n>', 'Número de conversiones paralelas', '3')
  .action(async (pattern, options) => {
    console.log(chalk.bold.cyan('\n📦 Ultra Parquet Converter - Modo Batch\n'));

    // Encuentra archivos
    const files = findFiles(pattern);
    
    if (files.length === 0) {
      console.log(chalk.yellow(`⚠️  No se encontraron archivos con el patrón: ${pattern}\n`));
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
      totalSaved: 0
    };

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
          verbose: options.verbose
        });

        results.success++;
        results.totalRows += result.rows;
        results.totalSaved += (result.input_size - result.output_size);

        spinner.succeed(chalk.green(`${fileName} → ${result.compression_ratio}% compresión`));

      } catch (error) {
        results.failed++;
        spinner.fail(chalk.red(`${fileName}: ${error.message}`));
      }
    }

    // Muestra resumen
    console.log(chalk.bold('\n📊 Resumen del Batch:\n'));
    console.log(chalk.white(`   ✅ Exitosos:        ${chalk.green(results.success)}`));
    console.log(chalk.white(`   ❌ Fallidos:        ${chalk.red(results.failed)}`));
    console.log(chalk.white(`   📁 Total filas:     ${chalk.yellow(results.totalRows.toLocaleString())}`));
    console.log(chalk.white(`   💾 Espacio ahorrado: ${chalk.cyan(formatBytes(results.totalSaved))}\n`));
  });

// Comando info: muestra información del archivo sin convertir
program
  .command('info <file>')
  .alias('i')
  .description('Muestra información del archivo sin convertirlo')
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
    console.log(chalk.white(`   Tipo:        ${chalk.blue(ext)}`));
    console.log(chalk.white(`   Tamaño:      ${chalk.magenta(formatBytes(stats.size))}`));
    console.log(chalk.white(`   Modificado:  ${chalk.yellow(stats.mtime.toLocaleString())}\n`));
  });

// Comando setup: instala dependencias Python
program
  .command('setup')
  .description('Instala las dependencias Python necesarias')
  .action(async () => {
    console.log(chalk.bold.cyan('\n🔧 Instalando dependencias Python...\n'));

    const spinner = ora('Instalando paquetes...').start();

    const { spawn } = require('child_process');
    const requirementsPath = path.join(__dirname, '..', 'python', 'requirements.txt');

    const installProcess = spawn('pip3', ['install', '-r', requirementsPath], {
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
