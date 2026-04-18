/**
 * Type Definitions for Ultra Parquet Converter v1.3.0
 */

export type BackendType = 'native-python' | 'portable-python' | 'pyodide' | 'cython';

// 'adaptive' = elige automáticamente el mejor algoritmo
export type CompressionType = 'snappy' | 'gzip' | 'brotli' | 'zstd' | 'lz4' | 'none' | 'adaptive';

export interface ConversionOptions {
  output?: string;
  verbose?: boolean;
  streaming?: boolean;
  autoRepair?: boolean;
  autoNormalize?: boolean;
  fileSize?: number;
  forceBackend?: BackendType;
  compression?: CompressionType;
  parallelWorkers?: number;
}

export interface CompressionAnalysis {
  recommended: CompressionType;
  reason: string;
  estimated_ratio: number;       // % estimado de compresión
  speed_score: number;           // 1-5 (5=más rápido)
  size_score: number;            // 1-5 (5=más pequeño)
}

export interface ConversionResult {
  success: boolean;
  backend?: BackendType;
  input_file?: string;
  output_file?: string;
  rows: number;
  columns: number;
  input_size: number;
  output_size: number;
  compression_ratio: number;
  compression_used?: CompressionType;         // algoritmo que se usó
  compression_analysis?: CompressionAnalysis; // análisis si fue adaptativo
  file_type: string;
  elapsed_time: number;
  chunks_processed?: number;
  errors_fixed?: number;
  columns_removed?: number;
  streaming_mode?: boolean;
  parallel_workers?: number;
  limitations?: string[];
  parquet_bytes?: number[];
}

export interface Environment {
  platform: NodeJS.Platform;
  isWindows: boolean;
  isLinux: boolean;
  isMac: boolean;
  isNode: boolean;
  isBrowser: boolean;
  hasPython: boolean;
  pythonCommand?: string;
  pythonVersion?: string;
  hasCython: boolean;
  cythonModules?: string[];
  hasPortablePython: boolean;
  portablePythonPath?: string;
  hasWebAssembly: boolean;
}

export interface BackendInfo {
  available: boolean;
  speed: string;
  description: string;
  limitations: string;
}

export interface BackendInterface {
  convert(inputFile: string, options?: ConversionOptions): Promise<ConversionResult>;
  isAvailable?(): Promise<boolean>;
}