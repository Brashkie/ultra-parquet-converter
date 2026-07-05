/**
 * Detecta si hay un Python real con pandas + pyarrow disponible.
 * Los tests de integración que ejecutan una conversión real usan
 * `describeIfPython` para saltarse limpiamente en CI sin esas dependencias
 * (en vez de fallar en rojo).
 */

import { execSync } from 'child_process';

function detectPythonWithDeps(): boolean {
  const candidates = process.platform === 'win32'
    ? ['py', 'python', 'python3']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} -c "import pandas, pyarrow"`, { stdio: 'ignore' });
      return true;
    } catch {
      // prueba el siguiente candidato
    }
  }
  return false;
}

export const HAS_PYTHON_DEPS = detectPythonWithDeps();

/** describe que corre solo si hay Python+pandas; si no, se salta. */
export const describeIfPython = HAS_PYTHON_DEPS ? describe : describe.skip;

/** it que corre solo si hay Python+pandas; si no, se salta. */
export const itIfPython = HAS_PYTHON_DEPS ? it : it.skip;
