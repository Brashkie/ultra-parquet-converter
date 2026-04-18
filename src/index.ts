import { backendSelector } from './backends/selector';
import { detectEnvironment } from './utils/detect';
import { ConversionOptions, ConversionResult, BackendType } from './types';

export { backendSelector } from './backends/selector';
export { detectEnvironment, clearEnvironmentCache } from './utils/detect';
export * from './types/index';

export { NativePythonBackend } from './backends/native-python';
export { PortablePythonBackend } from './backends/portable-python';
export { PyodideBackend } from './backends/pyodide-backend';
export { CythonBackend } from './backends/cython-backend';

export async function convertToParquet(
  inputFile: string,
  options?: ConversionOptions
): Promise<ConversionResult> {
  return backendSelector.convert(inputFile, options);
}

export async function getAvailableBackends() {
  return backendSelector.getAvailableBackends();
}

export function setBackend(backend: BackendType) {
  backendSelector.setBackend(backend);
}

export function getCurrentBackend(): BackendType | null {
  return backendSelector.getCurrentBackend();
}

export async function checkPythonSetup() {
  const env = await detectEnvironment();
  
  return {
    installed: env.hasPython,
    message: env.hasPython 
      ? `Python instalado (comando: ${env.pythonCommand})` 
      : 'Python no encontrado'
  };
}