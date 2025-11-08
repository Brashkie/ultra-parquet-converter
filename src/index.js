const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Convierte un archivo a formato Parquet
 * @param {string} inputFile - Ruta del archivo de entrada
 * @param {Object} options - Opciones de conversión
 * @param {string} options.output - Ruta del archivo de salida (opcional)
 * @param {boolean} options.verbose - Modo verbose (opcional)
 * @returns {Promise<Object>} - Resultado de la conversión
 */
async function convertToParquet(inputFile, options = {}) {
  return new Promise((resolve, reject) => {
    // Valida que el archivo exista
    if (!fs.existsSync(inputFile)) {
      return reject(new Error(`Archivo no encontrado: ${inputFile}`));
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
    const pythonProcess = spawn('python3', args, {
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
      reject(new Error(`Error al ejecutar Python: ${err.message}. Asegúrate de tener Python 3 instalado.`));
    });
  });
}

/**
 * Verifica que Python y las dependencias estén instaladas
 * @returns {Promise<Object>} - Estado de la instalación
 */
async function checkPythonSetup() {
  return new Promise((resolve) => {
    const pythonProcess = spawn('python', ['--version']);

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        resolve({
          installed: false,
          message: 'Python no está instalado o no está en el PATH'
        });
      } else {
        resolve({
          installed: true,
          message: 'Python 3 está instalado'
        });
      }
    });

    pythonProcess.on('error', () => {
      resolve({
        installed: false,
        message: 'Python 3 no está instalado o no está en el PATH'
      });
    });
  });
}

module.exports = {
  convertToParquet,
  checkPythonSetup
};
