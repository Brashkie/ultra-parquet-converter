//#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const { convertToParquet, checkPythonSetup } = require('./index');

program
  .name('ultra-parquet-converter')
  .description('🚀 Convierte archivos CSV, XLSX, JSON, XML, TXT, LOG a formato Parquet')
  .version('1.0.0')
  .argument('<input>', 'Archivo de entrada')
  .option('-o, --output <file>', 'Archivo de salida (opcional)')
  .option('-v, --verbose', 'Modo verbose con información detallada')
  .action(async (input, options) => {
    console.log(chalk.bold.cyan('\n🔄 Ultra Parquet Converter\n'));

    // Verifica Python
    const spinner = ora('Verificando Python...').start();
    const pythonCheck = await checkPythonSetup();

    if (!pythonCheck.installed) {
      spinner.fail(chalk.red('Python 3 no encontrado'));
      console.log(chalk.yellow('\n⚠️  Instala Python 3 y ejecuta:'));
      console.log(chalk.white('   pip install pandas pyarrow openpyxl lxml\n'));
      process.exit(1);
    }

    spinner.succeed(chalk.green('Python 3 detectado'));

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

// Comando para instalar dependencias Python
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

program.parse();

/**
 * Formatea bytes a tamaño legible
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
