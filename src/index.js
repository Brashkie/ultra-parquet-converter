const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Obtiene el comando de Python disponible en el sistema
 * Prueba en orden: py, python3, python
 * @returns {Promise<string>} - Comando de Python que funciona
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
      return cmd; // Si funciona, retorna este comando
    } catch {
      continue; // Si falla, prueba el siguiente
    }
  }
  
  throw new Error('No se encontró Python instalado (intentado: py, python3, python)');
}

/**
 * Convierte un archivo a formato Parquet
 * @param {string} inputFile - Ruta del archivo de entrada
 * @param {Object} options - Opciones de conversión
 * @param {string} options.output - Ruta del archivo de salida (opcional)
 * @param {boolean} options.verbose - Modo verbose (opcional)
 * @returns {Promise<Object>} - Resultado de la conversión
 */
async function convertToParquet(inputFile, options = {}) {
  return new Promise(async (resolve, reject) => {
    // Valida que el archivo exista
    if (!fs.existsSync(inputFile)) {
      return reject(new Error(`Archivo no encontrado: ${inputFile}`));
    }

    // Obtiene el comando de Python disponible
    let pythonCmd;
    try {
      pythonCmd = await getPythonCommand();
    } catch (error) {
      return reject(error);
    }

    // Construye los argumentos para Python
    const pythonScript = path.join(__dirname, '..', 'python', 'converter.py');
    const args = [pythonScript, inputFile];

    if (options.output) {
      args.push('-o', options.output);
    }

    if (options.verbose) {
      args.push('-v');
    }

    // Ejecuta el script Python
    const pythonProcess = spawn(pythonCmd, args, {
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
        // Intenta parsear el error como JSON
        try {
          const errorData = JSON.parse(stdout || '{}');
          return reject(new Error(errorData.error || `Error en conversión (código ${code})`));
        } catch (e) {
          return reject(new Error(`Error en conversión: ${stderr || stdout || 'Error desconocido'}`));
        }
      }

      // Parsea el resultado
      try {
        const result = JSON.parse(stdout);
        
        if (!result.success) {
          return reject(new Error(result.error || 'Error desconocido en conversión'));
        }

        resolve(result);
      } catch (e) {
        reject(new Error(`Error al parsear resultado: ${e.message}`));
      }
    });

    pythonProcess.on('error', (err) => {
      reject(new Error(`Error al ejecutar Python: ${err.message}. Asegúrate de tener Python instalado.`));
    });
  });
}

/**
 * Verifica que Python y las dependencias estén instaladas
 * @returns {Promise<Object>} - Estado de la instalación
 */
async function checkPythonSetup() {
  try {
    const pythonCmd = await getPythonCommand();
    return {
      installed: true,
      message: `Python está instalado (comando: ${pythonCmd})`
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
  checkPythonSetup
};
