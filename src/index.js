const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Obtiene el comando de Python disponible en el sistema
 * @returns {Promise<string>}
 */
async function getPythonCommand() {
  const commands = ['py', 'python3', 'python'];
  
  for (const cmd of commands) {
    try {
      await new Promise((resolve, reject) => {
        const proc = spawn(cmd, ['--version'], { stdio: 'ignore' });
        proc.on('close', (code) => code === 0 ? resolve() : reject());
        proc.on('error', reject);
      });
      return cmd;
    } catch {
      continue;
    }
  }
  
  throw new Error('No se encontró Python (intentado: py, python3, python)');
}

/**
 * Ejecuta script Python y retorna resultado JSON
 */
async function executePythonScript(scriptName, args = []) {
  const pythonCmd = await getPythonCommand();
  const pythonScript = path.join(__dirname, '..', 'python', scriptName);
  
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(pythonCmd, [pythonScript, ...args], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        try {
          const errorData = JSON.parse(stdout || '{}');
          return reject(new Error(errorData.error || `Error (código ${code})`));
        } catch (e) {
          return reject(new Error(stderr || stdout || 'Error desconocido'));
        }
      }

      try {
        const result = JSON.parse(stdout);
        if (result.success === false) {
          return reject(new Error(result.error || 'Error desconocido'));
        }
        resolve(result);
      } catch (e) {
        reject(new Error(`Error al parsear: ${e.message}`));
      }
    });

    pythonProcess.on('error', (err) => {
      reject(new Error(`Error Python: ${err.message}`));
    });
  });
}

/**
 * Convierte archivo a Parquet
 */
async function convertToParquet(inputFile, options = {}) {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Archivo no encontrado: ${inputFile}`);
  }

  const args = [inputFile];
  if (options.output) args.push('-o', options.output);
  if (options.verbose) args.push('-v');
  if (options.streaming) args.push('--streaming');
  if (options.autoRepair === false) args.push('--no-repair');
  if (options.autoNormalize === false) args.push('--no-normalize');

  return executePythonScript('converter_advanced.py', args);
}

/**
 * Analiza archivo
 */
async function analyzeFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  // Fallback básico
  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase().slice(1);
  
  return {
    success: true,
    detected_type: ext || 'unknown',
    size: stats.size,
    rows: null,
    columns: null
  };
}

/**
 * Benchmark de conversión
 */
async function benchmarkConversion(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  const tempOutput = path.join(
    require('os').tmpdir(),
    `benchmark_${Date.now()}.parquet`
  );

  const startTime = Date.now();
  
  try {
    const result = await convertToParquet(filePath, {
      output: tempOutput,
      streaming: options.streaming,
      verbose: false
    });

    result.elapsed_time = (Date.now() - startTime) / 1000;

    if (fs.existsSync(tempOutput)) {
      fs.unlinkSync(tempOutput);
    }

    return result;
  } catch (error) {
    if (fs.existsSync(tempOutput)) {
      fs.unlinkSync(tempOutput);
    }
    throw error;
  }
}

/**
 * Valida Parquet
 */
async function validateParquet(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  if (!filePath.endsWith('.parquet')) {
    throw new Error('Debe ser archivo .parquet');
  }

  // Validación básica: lee magic number
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(4);
  fs.readSync(fd, buffer, 0, 4, 0);
  fs.closeSync(fd);
  
  const magic = buffer.toString('ascii');
  const isValid = magic === 'PAR1';
  
  return {
    valid: isValid,
    rows: null,
    columns: null,
    compression: 'unknown',
    version: 'unknown',
    error: isValid ? null : 'Magic number inválido'
  };
}

/**
 * Verifica Python
 */
async function checkPythonSetup() {
  try {
    const pythonCmd = await getPythonCommand();
    return {
      installed: true,
      message: `Python instalado (comando: ${pythonCmd})`
    };
  } catch (error) {
    return {
      installed: false,
      message: error.message
    };
  }
}

module.exports = {
  convertToParquet,
  checkPythonSetup,
  analyzeFile,
  benchmarkConversion,
  validateParquet
};
