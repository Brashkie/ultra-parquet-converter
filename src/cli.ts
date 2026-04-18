#!/usr/bin/env node

/**
 * Ultra Parquet Converter CLI v1.3.0
 * TypeScript Edition — Progress Bar + Watch Mode
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { watch, FSWatcher } from 'fs';
import { basename, extname, join, dirname, resolve } from 'path';
import { existsSync, statSync, readdirSync, mkdirSync } from 'fs';
import { convertToParquet, checkPythonSetup, getAvailableBackends, setBackend } from './index';
import { BackendType, CompressionType } from './types';

// ========== UTILIDADES ==========

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(0);
  return `${minutes}m ${secs}s`;
}

function findFiles(pattern: string): string[] {
  const dir = dirname(pattern) || '.';
  const filePattern = basename(pattern);
  try {
    const files = readdirSync(dir);
    const regex = new RegExp(filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*'));
    return files
      .filter(file => regex.test(file))
      .map(file => join(dir, file));
  } catch {
    return [];
  }
}

// Extensiones soportadas para watch
const SUPPORTED_EXTENSIONS = new Set([
  '.csv', '.tsv', '.psv', '.dsv', '.txt', '.log',
  '.xlsx', '.xls', '.json', '.ndjson', '.jsonl',
  '.xml', '.yaml', '.yml', '.html',
  '.feather', '.arrow', '.orc', '.avro',
  '.sqlite', '.db', '.sav', '.sas7bdat', '.dta'
]);

// ========== PROGRESS BAR HELPER ==========

/**
 * Crea y gestiona una progress bar para conversiones largas.
 * Simula progreso basado en tiempo estimado (Python no reporta % en tiempo real).
 */
function createProgressBar(label: string = 'Convirtiendo') {
  const bar = new cliProgress.SingleBar({
    format: `${chalk.cyan(label)} |${chalk.cyan('{bar}')}| {percentage}% | {status}`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
    clearOnComplete: false,
  }, cliProgress.Presets.shades_classic);

  return bar;
}

/**
 * Ejecuta conversión con progress bar animada.
 * Incrementa progreso cada 200ms hasta 90%, luego espera resultado real.
 */
async function convertWithProgress(
  input: string,
  options: any,
  fileSizeMB: number
): Promise<any> {
  const bar = createProgressBar('Convirtiendo');

  // Estima tiempo según tamaño (aprox 50MB/s)
  const estimatedSeconds = Math.max(2, fileSizeMB / 50);
  const totalSteps = 100;
  const intervalMs = (estimatedSeconds * 1000 * 0.9) / totalSteps; // 90% del tiempo estimado

  bar.start(totalSteps, 0, { status: 'Iniciando...' });

  let currentStep = 0;
  const statuses = [
    'Detectando formato...',
    'Leyendo datos...',
    'Procesando chunks...',
    'Aplicando reparación...',
    'Normalizando columnas...',
    'Convirtiendo a Arrow...',
    'Escribiendo Parquet...',
    'Optimizando compresión...',
    'Finalizando...',
  ];

  // Avanza la barra mientras Python trabaja
  const interval = setInterval(() => {
    if (currentStep < 90) {
      currentStep += 1;
      const statusIndex = Math.floor((currentStep / 90) * (statuses.length - 1));
      bar.update(currentStep, { status: statuses[statusIndex] ?? 'Procesando...' });
    }
  }, intervalMs);

  try {
    const result = await convertToParquet(input, options);

    clearInterval(interval);
    bar.update(totalSteps, { status: chalk.green('¡Completado!') });
    bar.stop();

    return result;
  } catch (err) {
    clearInterval(interval);
    bar.update(currentStep, { status: chalk.red('Error') });
    bar.stop();
    throw err;
  }
}

// ========== PRINT RESULTS ==========

function printResults(result: any, input: string, elapsed: number, showBenchmark: boolean) {
  console.log(chalk.bold('\n📊 Resultados:\n'));
  console.log(chalk.white(`   Backend usado:      ${chalk.magenta(result.backend || 'auto')}`));
  console.log(chalk.white(`   Archivo origen:     ${chalk.cyan(basename(result.input_file || input))}`));
  console.log(chalk.white(`   Archivo destino:    ${chalk.cyan(basename(result.output_file || 'output.parquet'))}`));
  console.log(chalk.white(`   Tipo detectado:     ${chalk.blue((result.file_type || '?').toUpperCase())}`));
  console.log(chalk.white(`   Filas:              ${chalk.yellow(result.rows.toLocaleString())}`));
  console.log(chalk.white(`   Columnas:           ${chalk.yellow(result.columns)}`));
  console.log(chalk.white(`   Tamaño original:    ${chalk.magenta(formatBytes(result.input_size))}`));
  console.log(chalk.white(`   Tamaño Parquet:     ${chalk.magenta(formatBytes(result.output_size))}`));
  console.log(chalk.white(`   Compresión:         ${chalk.green(result.compression_ratio + '%')}`));

  // Muestra algoritmo de compresión usado
  if (result.compression_used) {
    const algo = result.compression_used.toUpperCase();
    const wasAdaptive = result.compression_analysis != null;
    console.log(chalk.white(`   Algoritmo:          ${chalk.cyan(algo)}${wasAdaptive ? chalk.gray(' (adaptativo)') : ''}`));
  }

  // Detalle de compresión adaptativa
  if (result.compression_analysis) {
    const a = result.compression_analysis;
    console.log(chalk.white(`   Razón elección:     ${chalk.gray(a.reason)}`));
    console.log(chalk.white(`   Velocidad:          ${chalk.yellow('⚡'.repeat(a.speed_score))} (${a.speed_score}/5)`));
    console.log(chalk.white(`   Ratio estimado:     ${chalk.green('~' + a.estimated_ratio + '%')}`));
  }

  console.log(chalk.white(`   Tiempo:             ${chalk.cyan(formatTime(result.elapsed_time || elapsed))}`));

  if (result.parallel_workers && result.parallel_workers > 1) {
    console.log(chalk.white(`   Workers paralelos:  ${chalk.yellow(result.parallel_workers)}`));
  }

  if (result.streaming_mode) {
    console.log(chalk.white(`   Modo:               ${chalk.magenta('STREAMING')}`));
    console.log(chalk.white(`   Chunks:             ${chalk.yellow(result.chunks_processed)}`));
  }

  if (result.errors_fixed && result.errors_fixed > 0) {
    console.log(chalk.white(`   Errores corregidos: ${chalk.green(result.errors_fixed)}`));
  }

  if (result.columns_removed && result.columns_removed > 0) {
    console.log(chalk.white(`   Cols eliminadas:    ${chalk.yellow(result.columns_removed)}`));
  }

  if (showBenchmark && result.rows > 0) {
    const t = result.elapsed_time || elapsed;
    const speed = Math.round(result.rows / t);
    console.log(chalk.bold('\n⚡ Benchmark:\n'));
    console.log(chalk.white(`   Velocidad:          ${chalk.cyan(speed.toLocaleString())} filas/s`));
    console.log(chalk.white(`   Throughput:         ${chalk.cyan(formatBytes(result.input_size / t))}/s`));
  }

  console.log();
}

// ========== PROGRAMA ==========

program
  .name('ultra-parquet-converter')
  .description('🚀 Conversor profesional híbrido a Parquet v1.3.0')
  .version('1.3.0');

// ── Comando: convert ────────────────────────────────────────────────────

program
  .command('convert <input>')
  .alias('c')
  .description('Convierte un archivo a Parquet')
  .option('-o, --output <file>',        'Archivo de salida')
  .option('-v, --verbose',              'Modo verbose')
  .option('--streaming',                'Modo streaming para archivos grandes')
  .option('--no-repair',                'Desactivar auto-reparación')
  .option('--no-normalize',             'Desactivar auto-normalización')
  .option('--backend <type>',           'Forzar backend (native-python, pyodide, cython)')
  .option('--compression <type>',       'Algoritmo de compresión (adaptive, snappy, zstd, lz4, gzip, brotli, none)', 'adaptive')
  .option('--workers <n>',              'Workers paralelos (0=auto)', '0')
  .option('--benchmark',                'Mostrar benchmark de velocidad')
  .option('--no-progress',              'Desactivar progress bar')
  .action(async (input: string, options: any) => {
    console.log(chalk.bold.cyan('\n🔄 Ultra Parquet Converter v1.3.0\n'));

    // Verifica Python
    const spinner = ora('Verificando Python...').start();
    const pythonCheck = await checkPythonSetup();

    if (!pythonCheck.installed) {
      spinner.fail(chalk.red('Python no encontrado'));
      console.log(chalk.yellow('\n⚠️  Instala Python 3.8+\n'));
      process.exit(1);
    }
    spinner.succeed(chalk.green(pythonCheck.message));

    if (!existsSync(input)) {
      console.log(chalk.red(`\n❌ Archivo no encontrado: ${input}\n`));
      process.exit(1);
    }

    if (options.backend) {
      setBackend(options.backend as BackendType);
      console.log(chalk.blue(`🔧 Backend forzado: ${options.backend}`));
    }

    const fileSizeMB = statSync(input).size / (1024 * 1024);
    const useProgress = options.progress !== false && fileSizeMB > 1; // solo si >1MB

    const conversionOptions = {
      output:          options.output,
      verbose:         options.verbose,
      streaming:       options.streaming || false,
      autoRepair:      options.repair !== false,
      autoNormalize:   options.normalize !== false,
      compression:     options.compression as CompressionType,
      parallelWorkers: parseInt(options.workers, 10) || 0,
    };

    try {
      const startTime = Date.now();
      let result: any;

      if (useProgress) {
        result = await convertWithProgress(input, conversionOptions, fileSizeMB);
      } else {
        const convertSpinner = ora('Convirtiendo archivo...').start();
        result = await convertToParquet(input, conversionOptions);
        convertSpinner.succeed(chalk.green('✅ Conversión exitosa!'));
      }

      const elapsed = (Date.now() - startTime) / 1000;
      if (useProgress) {
        console.log(chalk.green('\n✅ Conversión exitosa!'));
      }

      printResults(result, input, elapsed, options.benchmark);

    } catch (error: any) {
      console.error(chalk.red(`\n❌ ${error.message}\n`));
      process.exit(1);
    }
  });

// ── Comando: batch ──────────────────────────────────────────────────────

program
  .command('batch <pattern>')
  .alias('b')
  .description('Convierte múltiples archivos usando patrones glob')
  .option('-o, --output-dir <dir>',   'Directorio de salida', './output')
  .option('-v, --verbose',            'Modo verbose')
  .option('--streaming',              'Activar streaming para todos los archivos')
  .option('--compression <type>',     'Algoritmo de compresión', 'adaptive')
  .option('--workers <n>',            'Workers paralelos (0=auto)', '0')
  .action(async (pattern: string, options: any) => {
    console.log(chalk.bold.cyan('\n📦 Ultra Parquet Converter — Modo Batch v1.3.0\n'));

    const files = findFiles(pattern);
    if (files.length === 0) {
      console.log(chalk.red(`❌ No se encontraron archivos con el patrón: ${pattern}\n`));
      process.exit(1);
    }

    console.log(chalk.white(`Archivos encontrados: ${chalk.yellow(files.length)}\n`));

    if (!existsSync(options.outputDir)) {
      mkdirSync(options.outputDir, { recursive: true });
    }

    // Progress bar de batch
    const batchBar = new cliProgress.SingleBar({
      format: `Batch |${chalk.cyan('{bar}')}| {value}/{total} archivos | {filename}`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
    }, cliProgress.Presets.shades_classic);

    batchBar.start(files.length, 0, { filename: '...' });

    let success = 0, failed = 0;
    let totalRows = 0, totalSaved = 0;
    const startTime = Date.now();

    for (const file of files) {
      const outputFile = join(
        options.outputDir,
        basename(file, extname(file)) + '.parquet'
      );

      try {
        const result = await convertToParquet(file, {
          output: outputFile,
          verbose: options.verbose,
          streaming: options.streaming || false,
          compression: options.compression as CompressionType,
          parallelWorkers: parseInt(options.workers, 10) || 0,
        });

        totalRows += result.rows;
        totalSaved += (result.input_size - result.output_size);
        success++;
      } catch {
        failed++;
      }

      batchBar.increment({ filename: basename(file) });
    }

    batchBar.stop();

    const elapsed = (Date.now() - startTime) / 1000;

    console.log(chalk.bold('\n📊 Resumen del Batch:\n'));
    console.log(chalk.white(`   ✅ Exitosos:          ${chalk.green(success)}`));
    console.log(chalk.white(`   ❌ Fallidos:          ${chalk.red(failed)}`));
    console.log(chalk.white(`   📁 Total filas:       ${chalk.yellow(totalRows.toLocaleString())}`));
    console.log(chalk.white(`   💾 Espacio ahorrado:  ${chalk.cyan(formatBytes(totalSaved))}`));
    console.log(chalk.white(`   ⏱️  Tiempo total:      ${chalk.cyan(formatTime(elapsed))}`));
    if (elapsed > 0 && totalRows > 0) {
      console.log(chalk.white(`   ⚡ Velocidad media:   ${chalk.cyan(Math.round(totalRows / elapsed).toLocaleString())} filas/s`));
    }
    console.log();
  });

// ── Comando: watch ──────────────────────────────────────────────────────

program
  .command('watch <directory>')
  .alias('w')
  .description('Monitorea un directorio y convierte automáticamente archivos nuevos')
  .option('-o, --output-dir <dir>',   'Directorio de salida (default: mismo directorio)')
  .option('-v, --verbose',            'Modo verbose')
  .option('--streaming',              'Activar streaming')
  .option('--compression <type>',     'Algoritmo de compresión', 'adaptive')
  .option('--workers <n>',            'Workers paralelos (0=auto)', '0')
  .option('--debounce <ms>',          'Espera antes de convertir (ms)', '500')
  .action(async (directory: string, options: any) => {
    console.log(chalk.bold.cyan('\n👁️  Ultra Parquet Converter — Modo Watch v1.3.0\n'));

    if (!existsSync(directory)) {
      console.log(chalk.red(`❌ Directorio no encontrado: ${directory}\n`));
      process.exit(1);
    }

    const outputDir = options.outputDir || directory;
    const debounceMs = parseInt(options.debounce, 10) || 500;

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    console.log(chalk.white(`📂 Monitoreando: ${chalk.cyan(resolve(directory))}`));
    console.log(chalk.white(`📤 Salida:        ${chalk.cyan(resolve(outputDir))}`));
    console.log(chalk.white(`⏱️  Debounce:      ${chalk.yellow(debounceMs + 'ms')}`));
    console.log(chalk.white(`🗜️  Compresión:    ${chalk.cyan(options.compression)}`));
    console.log(chalk.gray('\nEsperando archivos... (Ctrl+C para salir)\n'));

    // Mapa de debounce timers por archivo
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    // Archivos en proceso (evita convertir dos veces)
    const processing = new Set<string>();
    // Estadísticas de sesión
    let sessionConverted = 0;
    let sessionErrors = 0;

    const convertFile = async (filePath: string) => {
      if (processing.has(filePath)) return;

      const ext = extname(filePath).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) return;

      // Ignora archivos .parquet generados por el mismo converter
      if (ext === '.parquet') return;

      processing.add(filePath);

      const outputFile = join(outputDir, basename(filePath, ext) + '.parquet');
      const fileSizeMB = existsSync(filePath)
        ? statSync(filePath).size / (1024 * 1024)
        : 0;

      const timestamp = new Date().toLocaleTimeString();
      process.stdout.write(
        chalk.gray(`[${timestamp}] `) +
        chalk.white(`📄 ${basename(filePath)} `) +
        chalk.yellow(`(${fileSizeMB.toFixed(1)}MB)`) +
        chalk.gray(' → ')
      );

      try {
        const startTime = Date.now();
        const result = await convertToParquet(filePath, {
          output: outputFile,
          verbose: options.verbose,
          streaming: options.streaming || fileSizeMB > 100,
          compression: options.compression as CompressionType,
          parallelWorkers: parseInt(options.workers, 10) || 0,
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        sessionConverted++;

        console.log(
          chalk.green('✅ ') +
          chalk.cyan(basename(outputFile)) +
          chalk.gray(` | ${result.rows.toLocaleString()} filas | ${result.compression_ratio}% compresión | ${elapsed}s`)
        );

        if (result.compression_used) {
          console.log(
            chalk.gray(`         algoritmo: ${result.compression_used.toUpperCase()}`) +
            (result.compression_analysis ? chalk.gray(` — ${result.compression_analysis.reason}`) : '')
          );
        }

      } catch (error: any) {
        sessionErrors++;
        console.log(chalk.red(`❌ Error: ${error.message}`));
      } finally {
        processing.delete(filePath);
      }
    };

    // Watcher con debounce
    const watcher: FSWatcher = watch(directory, { recursive: false }, (eventType, filename) => {
      if (!filename) return;

      const filePath = join(directory, filename);

      // Cancela timer anterior del mismo archivo (debounce)
      const existing = debounceTimers.get(filePath);
      if (existing) clearTimeout(existing);

      // Solo procesa en eventos 'rename' (creación) y 'change'
      if (eventType === 'rename' || eventType === 'change') {
        const timer = setTimeout(async () => {
          debounceTimers.delete(filePath);

          // Verifica que el archivo existe (rename también se dispara al borrar)
          if (existsSync(filePath)) {
            await convertFile(filePath);
          }
        }, debounceMs);

        debounceTimers.set(filePath, timer);
      }
    });

    // Muestra estadísticas periódicas cada 30s
    const statsInterval = setInterval(() => {
      if (sessionConverted > 0 || sessionErrors > 0) {
        console.log(
          chalk.gray(`\n[Stats] `) +
          chalk.green(`${sessionConverted} convertidos`) +
          chalk.gray(' | ') +
          chalk.red(`${sessionErrors} errores`) +
          chalk.gray(' esta sesión\n')
        );
      }
    }, 30_000);

    // Manejo de cierre limpio
    const cleanup = () => {
      console.log(chalk.yellow('\n\n⏹️  Deteniendo watch mode...'));
      clearInterval(statsInterval);
      for (const timer of debounceTimers.values()) clearTimeout(timer);
      watcher.close();
      console.log(
        chalk.bold('\n📊 Sesión completada:') +
        chalk.green(` ${sessionConverted} archivos convertidos`) +
        (sessionErrors > 0 ? chalk.red(` | ${sessionErrors} errores`) : '') +
        '\n'
      );
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });

// ── Comando: backends ───────────────────────────────────────────────────

program
  .command('backends')
  .description('Muestra backends disponibles')
  .action(async () => {
    console.log(chalk.bold.cyan('\n🔧 Backends Disponibles\n'));
    const spinner = ora('Detectando backends...').start();
    const backends = await getAvailableBackends();
    spinner.stop();
    for (const [name, info] of Object.entries(backends)) {
      const status = info.available
        ? chalk.green('✅ Disponible')
        : chalk.red('❌ No disponible');
      console.log(chalk.bold(`\n${name}:`));
      console.log(`   Estado:       ${status}`);
      console.log(`   Velocidad:    ${info.speed}`);
      console.log(`   ${chalk.gray(info.description)}`);
      console.log(`   ${chalk.yellow('Limitaciones:')} ${info.limitations}`);
    }
    console.log();
  });

// ── Comando: info ───────────────────────────────────────────────────────

program
  .command('info <file>')
  .alias('i')
  .description('Muestra información del archivo')
  .action((file: string) => {
    console.log(chalk.bold.cyan('\n📋 Información del Archivo\n'));
    if (!existsSync(file)) {
      console.log(chalk.red(`❌ Archivo no encontrado: ${file}\n`));
      process.exit(1);
    }
    const stats = statSync(file);
    console.log(chalk.white(`   Nombre:      ${chalk.cyan(basename(file))}`));
    console.log(chalk.white(`   Ruta:        ${chalk.gray(resolve(file))}`));
    console.log(chalk.white(`   Extensión:   ${chalk.blue(extname(file).toLowerCase())}`));
    console.log(chalk.white(`   Tamaño:      ${chalk.magenta(formatBytes(stats.size))}`));
    console.log(chalk.white(`   Modificado:  ${chalk.yellow(stats.mtime.toLocaleString())}`));
    console.log();
  });

// ── Default ─────────────────────────────────────────────────────────────

if (process.argv.length === 2) {
  program.help();
}

program.parse();