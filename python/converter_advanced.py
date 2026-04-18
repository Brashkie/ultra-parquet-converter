#!/usr/bin/env python3
"""
Ultra Parquet Converter v1.3.0 - Advanced Edition
Conversor profesional con streaming, parallel processing y compresión adaptativa
"""

import sys
import os
import json
from pathlib import Path
import argparse
import time
from typing import Optional, Dict, Any, List, Generator, Tuple
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import multiprocessing
import warnings
import io
warnings.filterwarnings('ignore')

try:
    import pandas as pd
    import pyarrow as pa
    import pyarrow.parquet as pq
    import numpy as np
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "Dependencias básicas faltantes: pip install pandas pyarrow numpy"
    }))
    sys.exit(1)


# ========== ADAPTIVE COMPRESSION ENGINE ==========

class AdaptiveCompressor:
    """
    Elige el mejor algoritmo de compresión según las características del dataset.
    
    Lógica:
    - Muchas columnas string/categoría → zstd (mejor ratio para texto)
    - Muchas columnas numéricas       → lz4  (ultra-rápido para números)
    - Archivo pequeño (<50MB)         → zstd (no importa velocidad)
    - Archivo enorme (>500MB)         → lz4  (velocidad > ratio)
    - Streaming mode                  → snappy (balance estable)
    - Default balance                 → snappy
    """

    # Compresiones disponibles en PyArrow (en orden de preferencia)
    AVAILABLE = ['zstd', 'lz4', 'snappy', 'gzip', 'brotli', 'none']

    # Características por algoritmo
    PROFILES = {
        'zstd':   {'speed': 3, 'ratio': 5, 'best_for': 'text/mixed'},
        'lz4':    {'speed': 5, 'ratio': 3, 'best_for': 'numeric/large'},
        'snappy': {'speed': 4, 'ratio': 3, 'best_for': 'balanced/streaming'},
        'gzip':   {'speed': 2, 'ratio': 4, 'best_for': 'archival/small'},
        'brotli': {'speed': 1, 'ratio': 5, 'best_for': 'archival/text'},
        'none':   {'speed': 5, 'ratio': 1, 'best_for': 'already_compressed'},
    }

    @classmethod
    def _check_available(cls, algo: str) -> bool:
        """Verifica si un algoritmo está disponible en esta instalación de PyArrow"""
        try:
            # Intenta comprimir un table mínimo con el algoritmo
            test_table = pa.table({'x': pa.array([1, 2, 3])})
            buf = io.BytesIO()
            pq.write_table(test_table, buf, compression=algo)
            return True
        except Exception:
            return False

    @classmethod
    def analyze(cls, df: pd.DataFrame, file_size: int, streaming: bool) -> Dict[str, Any]:
        """
        Analiza el DataFrame y elige el mejor algoritmo de compresión.
        
        Returns:
            dict con recommended, reason, estimated_ratio, speed_score, size_score
        """
        total_cols = len(df.columns)
        if total_cols == 0:
            return cls._build_result('snappy', 'Sin columnas, usando default', 3, 4, 3)

        # Cuenta tipos de columnas
        string_cols  = len(df.select_dtypes(include=['object', 'category', 'string']).columns)
        numeric_cols = len(df.select_dtypes(include=['number']).columns)
        bool_cols    = len(df.select_dtypes(include=['bool']).columns)
        date_cols    = len(df.select_dtypes(include=['datetime']).columns)

        string_ratio  = string_cols  / total_cols
        numeric_ratio = numeric_cols / total_cols

        # Tamaño en MB
        size_mb = file_size / (1024 * 1024)

        # ── Reglas de decisión ──────────────────────────────────────────
        # 1. Streaming → snappy (estabilidad y velocidad constante)
        if streaming:
            return cls._build_result(
                'snappy',
                'Streaming mode: snappy garantiza velocidad constante',
                55, 4, 3
            )

        # 2. Mayoría texto/strings → zstd (mejor ratio para texto)
        if string_ratio >= 0.6:
            algo = 'zstd' if cls._check_available('zstd') else 'gzip'
            return cls._build_result(
                algo,
                f'{string_ratio:.0%} columnas texto → {algo} maximiza compresión',
                70, 3, 5
            )

        # 3. Mayoría numérica + archivo grande → lz4 (velocidad)
        if numeric_ratio >= 0.7 and size_mb > 100:
            algo = 'lz4' if cls._check_available('lz4') else 'snappy'
            return cls._build_result(
                algo,
                f'{numeric_ratio:.0%} numérico + {size_mb:.0f}MB → {algo} prioriza velocidad',
                45, 5, 3
            )

        # 4. Archivo pequeño (<50MB) → zstd (ratio > velocidad)
        if size_mb < 50:
            algo = 'zstd' if cls._check_available('zstd') else 'snappy'
            return cls._build_result(
                algo,
                f'Archivo pequeño ({size_mb:.1f}MB) → {algo} maximiza ratio',
                65, 3, 5
            )

        # 5. Archivo enorme (>500MB) → lz4 (no bloquear por mucho tiempo)
        if size_mb > 500:
            algo = 'lz4' if cls._check_available('lz4') else 'snappy'
            return cls._build_result(
                algo,
                f'Archivo grande ({size_mb:.0f}MB) → {algo} prioriza throughput',
                40, 5, 3
            )

        # 6. Mixto / balance → snappy (siempre disponible, buen balance)
        return cls._build_result(
            'snappy',
            'Dataset mixto → snappy: balance óptimo velocidad/ratio',
            55, 4, 3
        )

    @classmethod
    def _build_result(
        cls, algo: str, reason: str,
        estimated_ratio: int, speed_score: int, size_score: int
    ) -> Dict[str, Any]:
        return {
            'recommended': algo,
            'reason': reason,
            'estimated_ratio': estimated_ratio,
            'speed_score': speed_score,
            'size_score': size_score,
        }

    @classmethod
    def resolve(cls, compression: str, df: pd.DataFrame,
                file_size: int, streaming: bool) -> Tuple[str, Optional[Dict]]:
        """
        Resuelve el algoritmo final.
        
        Returns:
            (algo_string, analysis_dict_or_None)
        """
        if compression == 'adaptive':
            analysis = cls.analyze(df, file_size, streaming)
            return analysis['recommended'], analysis

        # Compresión manual — valida que esté disponible
        if compression in ('lz4', 'zstd'):
            if not cls._check_available(compression):
                # Fallback gracioso
                return 'snappy', None

        return compression, None


# ========== WORKER FUNCTIONS (top-level para multiprocessing) ==========

def _repair_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.dropna(axis=1, how='all')
    for col in df.columns:
        if df[col].dtype == 'object':
            try:
                df[col] = df[col].astype(str).str.strip()
                numeric = pd.to_numeric(df[col], errors='coerce')
                if numeric.notna().sum() / max(len(df[col]), 1) > 0.8:
                    df[col] = numeric
            except Exception:
                pass
    return df.drop_duplicates()


def _normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [str(c).strip().lower().replace(' ', '_') for c in df.columns]
    for col in list(df.columns):
        if df[col].nunique() == 1:
            df = df.drop(columns=[col])
    return df


def _process_chunk_worker(args: tuple) -> dict:
    chunk_data, auto_repair, auto_normalize, chunk_index = args
    try:
        df = pd.read_json(io.StringIO(chunk_data), orient='records')
        if auto_repair:   df = _repair_df(df)
        if auto_normalize: df = _normalize_df(df)
        return {
            'success': True, 'chunk_index': chunk_index,
            'data': df.to_json(orient='records'), 'rows': len(df),
            'columns': list(df.columns)
        }
    except Exception as e:
        return {'success': False, 'chunk_index': chunk_index, 'error': str(e), 'rows': 0, 'columns': []}


def _read_csv_chunk_worker(args: tuple) -> dict:
    filepath, start_line, end_line, delimiter, headers, chunk_index = args
    try:
        rows = []
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            for i, line in enumerate(f):
                if i < start_line: continue
                if i >= end_line:  break
                line = line.rstrip('\n\r')
                if not line: continue
                fields = line.split(delimiter)
                while len(fields) < len(headers):
                    fields.append('')
                rows.append(fields[:len(headers)])
        df = pd.DataFrame(rows, columns=headers)
        df = _repair_df(df)
        df = _normalize_df(df)
        return {
            'success': True, 'chunk_index': chunk_index,
            'data': df.to_json(orient='records'), 'rows': len(df),
            'columns': list(df.columns)
        }
    except Exception as e:
        return {'success': False, 'chunk_index': chunk_index, 'error': str(e), 'rows': 0, 'columns': []}


# ========== MAIN CONVERTER ==========

class AdvancedParquetConverter:
    """Conversor avanzado con streaming, parallel processing y compresión adaptativa"""

    SUPPORTED_FORMATS = {
        'csv', 'tsv', 'psv', 'dsv', 'txt', 'log',
        'xlsx', 'xls',
        'json', 'ndjson', 'jsonl', 'xml', 'yaml', 'yml', 'html',
        'feather', 'arrow', 'orc', 'avro',
        'sqlite', 'db',
        'sav', 'sas7bdat', 'dta'
    }

    CHUNK_SIZE_BYTES = 100 * 1024 * 1024
    CHUNK_ROWS = 100_000

    def __init__(self, input_file: str, output_file: Optional[str] = None,
                 verbose: bool = False, streaming: bool = False,
                 auto_repair: bool = True, auto_normalize: bool = True,
                 parallel_workers: int = 0, compression: str = 'adaptive'):
        self.input_file       = Path(input_file)
        self.output_file      = Path(output_file) if output_file else self._generate_output_path()
        self.verbose          = verbose
        self.streaming        = streaming
        self.auto_repair      = auto_repair
        self.auto_normalize   = auto_normalize
        self.parallel_workers = parallel_workers or max(1, multiprocessing.cpu_count() - 1)
        self.compression      = compression  # 'adaptive' | 'snappy' | 'zstd' | ...
        self.file_type        = None
        self._compression_analysis: Optional[Dict] = None
        self.stats = {
            'start_time':       time.time(),
            'chunks_processed': 0,
            'rows_processed':   0,
            'errors_fixed':     0,
            'columns_removed':  0,
            'workers_used':     self.parallel_workers,
        }

    def _log(self, message: str, level: str = "INFO"):
        if self.verbose:
            print(f"[{time.strftime('%H:%M:%S')}] [{level}] {message}", file=sys.stderr)

    def _generate_output_path(self) -> Path:
        return self.input_file.with_suffix('.parquet')

    # ── Detección de formato ────────────────────────────────────────────

    def _detect_file_type_by_extension(self) -> Optional[str]:
        ext = self.input_file.suffix.lower().lstrip('.')
        return ext if ext in self.SUPPORTED_FORMATS else None

    def _detect_file_type_by_content(self) -> str:
        self._log("Detectando formato por contenido...")
        try:
            with open(self.input_file, 'rb') as f:
                header = f.read(8192)
                if header.startswith(b'SQLite format 3'): return 'sqlite'
                if b'PAR1' in header:                     return 'parquet'
                if header.startswith(b'ARROW1'):          return 'feather'
                if header.startswith(b'ORC'):             return 'orc'
                if header.startswith(b'Obj\x01'):         return 'avro'

            with open(self.input_file, 'r', encoding='utf-8', errors='ignore') as f:
                first_lines = [f.readline() for _ in range(10)]
                content = ''.join(first_lines)
                if '<html' in content.lower() or '<table' in content.lower(): return 'html'
                if content.strip().startswith('<?xml') or content.strip().startswith('<'): return 'xml'
                if content.strip().startswith('{') or content.strip().startswith('['): return 'json'
                if all(l.strip().startswith('{') for l in first_lines if l.strip()): return 'ndjson'
                if content.strip().startswith('---') or (': ' in content and ',' not in content): return 'yaml'
                first_line = first_lines[0] if first_lines else ""
                delimiters = {',': 'csv', '\t': 'tsv', '|': 'psv', ';': 'dsv'}
                max_count, detected = 0, 'txt'
                for delim, ftype in delimiters.items():
                    count = first_line.count(delim)
                    if count > max_count and count > 2:
                        max_count, detected = count, ftype
                return detected
        except Exception as e:
            self._log(f"Error en auto-detección: {e}", "WARNING")
            return 'txt'

    def detect_format(self) -> str:
        file_type = self._detect_file_type_by_extension()
        if file_type:
            self._log(f"Formato por extensión: {file_type.upper()}")
            self.file_type = file_type
            return file_type
        file_type = self._detect_file_type_by_content()
        self._log(f"Formato por contenido: {file_type.upper()}")
        self.file_type = file_type
        return file_type

    # ── Reparación y normalización ──────────────────────────────────────

    def _auto_repair_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        if not self.auto_repair:
            return df
        self._log("Aplicando auto-reparación...")
        original_cols = len(df.columns)
        df = df.dropna(axis=1, how='all')
        removed = original_cols - len(df.columns)
        if removed > 0:
            self.stats['columns_removed'] += removed
        for col in df.columns:
            if df[col].dtype == 'object':
                try:
                    df[col] = df[col].astype(str).str.strip()
                    numeric = pd.to_numeric(df[col], errors='coerce')
                    if numeric.notna().sum() / max(len(df[col]), 1) > 0.8:
                        df[col] = numeric
                        self.stats['errors_fixed'] += 1
                except Exception:
                    pass
        before = len(df)
        df = df.drop_duplicates()
        if len(df) < before:
            self._log(f"Eliminadas {before - len(df)} filas duplicadas")
        return df

    def _auto_normalize_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        if not self.auto_normalize:
            return df
        self._log("Aplicando auto-normalización...")
        df.columns = [str(c).strip().lower().replace(' ', '_') for c in df.columns]
        for col in list(df.columns):
            if df[col].nunique() == 1:
                df = df.drop(columns=[col])
                self._log(f"Eliminada columna constante: {col}")
        return df

    # ── Parallel processing ─────────────────────────────────────────────

    def _count_lines(self) -> int:
        count = 0
        with open(self.input_file, 'rb') as f:
            for _ in f:
                count += 1
        return count

    def _read_headers(self, delimiter: str) -> List[str]:
        with open(self.input_file, 'r', encoding='utf-8', errors='ignore') as f:
            return f.readline().rstrip('\n\r').split(delimiter)

    def _read_csv_parallel(self, delimiter: str) -> Optional[pd.DataFrame]:
        file_size = self.input_file.stat().st_size
        if file_size < 10 * 1024 * 1024 or self.parallel_workers <= 1:
            return None

        self._log(f"🔀 Parallel CSV ({self.parallel_workers} workers)")
        total_lines = self._count_lines()
        headers = self._read_headers(delimiter)
        data_lines = total_lines - 1

        if data_lines <= 0:
            return pd.DataFrame(columns=headers)

        lines_per_worker = max(1, data_lines // self.parallel_workers)
        ranges = []
        for i in range(self.parallel_workers):
            start = 1 + i * lines_per_worker
            end = start + lines_per_worker
            if i == self.parallel_workers - 1:
                end = total_lines
            ranges.append((str(self.input_file), start, end, delimiter, headers, i))

        results = [None] * self.parallel_workers
        with ProcessPoolExecutor(max_workers=self.parallel_workers) as executor:
            futures = {executor.submit(_read_csv_chunk_worker, r): r[5] for r in ranges}
            for future in as_completed(futures):
                result = future.result()
                if result['success']:
                    results[result['chunk_index']] = result
                    self.stats['chunks_processed'] += 1
                    self.stats['rows_processed'] += result['rows']
                else:
                    self._log(f"Worker {result['chunk_index']} falló: {result['error']}", "WARNING")

        dfs = []
        for r in results:
            if r and r['success'] and r['rows'] > 0:
                dfs.append(pd.read_json(io.StringIO(r['data']), orient='records'))

        if not dfs:
            return pd.DataFrame(columns=headers)

        self._log(f"✅ Parallel completado: {self.stats['rows_processed']:,} filas")
        return pd.concat(dfs, ignore_index=True)

    def _process_chunks_parallel(self, chunks: List[pd.DataFrame]) -> List[pd.DataFrame]:
        if len(chunks) <= 1 or self.parallel_workers <= 1:
            return [self._auto_normalize_dataframe(self._auto_repair_dataframe(c)) for c in chunks]

        worker_args = [
            (chunk.to_json(orient='records'), self.auto_repair, self.auto_normalize, i)
            for i, chunk in enumerate(chunks)
        ]
        results = [None] * len(chunks)
        with ThreadPoolExecutor(max_workers=self.parallel_workers) as executor:
            futures = {executor.submit(_process_chunk_worker, a): a[3] for a in worker_args}
            for future in as_completed(futures):
                result = future.result()
                if result['success']:
                    results[result['chunk_index']] = pd.read_json(
                        io.StringIO(result['data']), orient='records'
                    )
        return [r for r in results if r is not None]

    # ── Lectores ────────────────────────────────────────────────────────

    def _read_with_chunks(self, reader_func, **kwargs) -> Generator:
        self._log(f"Streaming activado (chunks de {self.CHUNK_ROWS:,} filas)")
        for chunk in reader_func(chunksize=self.CHUNK_ROWS, **kwargs):
            chunk = self._auto_repair_dataframe(chunk)
            chunk = self._auto_normalize_dataframe(chunk)
            self.stats['chunks_processed'] += 1
            self.stats['rows_processed'] += len(chunk)
            yield chunk

    def _read_csv_variants(self, delimiter=',') -> pd.DataFrame:
        self._log(f"Leyendo CSV (delimitador: '{delimiter}')")
        if self.streaming or self.input_file.stat().st_size > self.CHUNK_SIZE_BYTES:
            return self._read_with_chunks(
                pd.read_csv, filepath_or_buffer=self.input_file,
                sep=delimiter, encoding='utf-8', on_bad_lines='skip', low_memory=False
            )
        parallel_result = self._read_csv_parallel(delimiter or ',')
        if parallel_result is not None:
            return parallel_result
        try:
            return pd.read_csv(self.input_file, sep=delimiter, encoding='utf-8',
                               on_bad_lines='skip', engine='c', low_memory=False)
        except Exception:
            return pd.read_csv(self.input_file, sep=None, encoding='utf-8',
                               engine='python', on_bad_lines='skip')

    def _read_excel(self) -> pd.DataFrame:
        self._log("Leyendo Excel")
        try:
            return pd.read_excel(self.input_file, engine='openpyxl')
        except Exception:
            return pd.read_excel(self.input_file)

    def _read_json(self) -> pd.DataFrame:
        self._log("Leyendo JSON")
        try:
            return pd.read_json(self.input_file, orient='records')
        except Exception:
            try:
                return pd.read_json(self.input_file, orient='index')
            except Exception:
                with open(self.input_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return pd.DataFrame(data if isinstance(data, list) else [data])

    def _read_ndjson(self) -> pd.DataFrame:
        return pd.read_json(self.input_file, lines=True)

    def _read_xml(self) -> pd.DataFrame:
        try:
            return pd.read_xml(self.input_file)
        except Exception:
            import xml.etree.ElementTree as ET
            root = ET.parse(self.input_file).getroot()
            return pd.DataFrame([{c.tag: c.text for c in elem} for elem in root])

    def _read_yaml(self) -> pd.DataFrame:
        try:
            import yaml
            with open(self.input_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            return pd.DataFrame(data if isinstance(data, list) else [data])
        except ImportError:
            raise ImportError("PyYAML no instalado: pip install pyyaml")

    def _read_html(self) -> pd.DataFrame:
        tables = pd.read_html(self.input_file)
        if not tables:
            raise ValueError("No se encontraron tablas en el HTML")
        return max(tables, key=len)

    def _read_feather(self) -> pd.DataFrame:
        try:
            import pyarrow.feather as feather
            return feather.read_feather(self.input_file)
        except Exception:
            return pd.read_feather(self.input_file)

    def _read_orc(self) -> pd.DataFrame:
        import pyarrow.orc as orc
        return orc.read_table(self.input_file).to_pandas()

    def _read_avro(self) -> pd.DataFrame:
        try:
            from fastavro import reader
            with open(self.input_file, 'rb') as f:
                return pd.DataFrame(list(reader(f)))
        except ImportError:
            raise ImportError("fastavro no instalado: pip install fastavro")

    def _read_sqlite(self) -> pd.DataFrame:
        import sqlite3
        conn = sqlite3.connect(self.input_file)
        tables = pd.read_sql_query(
            "SELECT name FROM sqlite_master WHERE type='table'", conn
        )
        if len(tables) == 0:
            raise ValueError("No hay tablas en la base de datos")
        df = pd.read_sql_query(f"SELECT * FROM {tables['name'].iloc[0]}", conn)
        conn.close()
        return df

    def _read_spss(self) -> pd.DataFrame:
        try:
            import pyreadstat
            df, _ = pyreadstat.read_sav(self.input_file)
            return df
        except ImportError:
            raise ImportError("pyreadstat no instalado: pip install pyreadstat")

    def _read_sas(self) -> pd.DataFrame:
        return pd.read_sas(self.input_file)

    def _read_stata(self) -> pd.DataFrame:
        return pd.read_stata(self.input_file)

    def read_file(self):
        if not self.file_type:
            self.detect_format()
        readers = {
            'csv': lambda: self._read_csv_variants(','),
            'tsv': lambda: self._read_csv_variants('\t'),
            'psv': lambda: self._read_csv_variants('|'),
            'dsv': lambda: self._read_csv_variants(None),
            'txt': lambda: self._read_csv_variants(None),
            'log': lambda: self._read_csv_variants(None),
            'xlsx': self._read_excel, 'xls': self._read_excel,
            'json': self._read_json, 'ndjson': self._read_ndjson, 'jsonl': self._read_ndjson,
            'xml': self._read_xml, 'yaml': self._read_yaml, 'yml': self._read_yaml,
            'html': self._read_html, 'feather': self._read_feather, 'arrow': self._read_feather,
            'orc': self._read_orc, 'avro': self._read_avro,
            'sqlite': self._read_sqlite, 'db': self._read_sqlite,
            'sav': self._read_spss, 'sas7bdat': self._read_sas, 'dta': self._read_stata,
        }
        reader = readers.get(self.file_type)
        if not reader:
            raise ValueError(f"Formato no soportado: {self.file_type}")
        df = reader()
        if not hasattr(df, '__iter__') or isinstance(df, pd.DataFrame):
            df = self._auto_repair_dataframe(df)
            df = self._auto_normalize_dataframe(df)
            self.stats['rows_processed'] = len(df)
        return df

    # ── Conversión principal ────────────────────────────────────────────

    def _write_parquet(self, table: pa.Table, writer=None, algo: str = 'snappy'):
        """Escribe tabla Parquet con el algoritmo dado"""
        if writer is not None:
            writer.write_table(table)
            return writer
        pq.write_table(
            table, self.output_file,
            compression=algo,
            use_dictionary=True,
            write_statistics=True,
            row_group_size=1_000_000
        )
        return None

    def convert(self) -> int:
        try:
            if not self.input_file.exists():
                raise FileNotFoundError(f"Archivo no encontrado: {self.input_file}")

            self._log(f"Iniciando conversión: {self.input_file} → {self.output_file}")
            self._log(f"Compresión solicitada: {self.compression}")

            df_or_gen = self.read_file()
            file_size = self.input_file.stat().st_size

            # ── Resuelve compresión ────────────────────────────────────
            if hasattr(df_or_gen, '__iter__') and not isinstance(df_or_gen, pd.DataFrame):
                # Streaming: usa snappy para análisis rápido (no tenemos df completo)
                # Si es adaptive, fuerza snappy en streaming
                algo = 'snappy' if self.compression == 'adaptive' else self.compression
                analysis = AdaptiveCompressor.analyze(pd.DataFrame(), file_size, True) \
                    if self.compression == 'adaptive' else None
            else:
                algo, analysis = AdaptiveCompressor.resolve(
                    self.compression, df_or_gen, file_size, self.streaming
                )

            self._compression_analysis = analysis
            self._log(f"✅ Compresión seleccionada: {algo.upper()}" +
                      (f" — {analysis['reason']}" if analysis else ""))

            # ── Escritura ──────────────────────────────────────────────
            if hasattr(df_or_gen, '__iter__') and not isinstance(df_or_gen, pd.DataFrame):
                self._log("Modo streaming + parallel...")
                writer = None
                chunk = None
                buffer = []
                BUFFER_SIZE = self.parallel_workers * 2

                for chunk in df_or_gen:
                    buffer.append(chunk)
                    if len(buffer) >= BUFFER_SIZE:
                        for proc_chunk in self._process_chunks_parallel(buffer):
                            table = pa.Table.from_pandas(proc_chunk, preserve_index=False)
                            if writer is None:
                                writer = pq.ParquetWriter(
                                    self.output_file, table.schema, compression=algo
                                )
                            writer.write_table(table)
                        buffer = []

                if buffer:
                    for proc_chunk in self._process_chunks_parallel(buffer):
                        table = pa.Table.from_pandas(proc_chunk, preserve_index=False)
                        if writer is None:
                            writer = pq.ParquetWriter(
                                self.output_file, table.schema, compression=algo
                            )
                        writer.write_table(table)

                if writer:
                    writer.close()

                total_rows = self.stats['rows_processed']
                total_cols = len(chunk.columns) if chunk is not None else 0

            else:
                df = df_or_gen
                total_rows = len(df)
                total_cols = len(df.columns)

                for col in df.select_dtypes(include=['object']).columns:
                    if df[col].nunique() / max(len(df[col]), 1) < 0.5:
                        df[col] = df[col].astype('category')

                table = pa.Table.from_pandas(df, preserve_index=False)
                pq.write_table(
                    table, self.output_file,
                    compression=algo,
                    use_dictionary=True,
                    write_statistics=True,
                    row_group_size=1_000_000
                )

            # ── Stats finales ──────────────────────────────────────────
            elapsed      = time.time() - self.stats['start_time']
            input_size   = self.input_file.stat().st_size
            output_size  = self.output_file.stat().st_size
            comp_ratio   = (1 - output_size / input_size) * 100 if input_size > 0 else 0

            result: Dict[str, Any] = {
                "success":              True,
                "input_file":           str(self.input_file),
                "output_file":          str(self.output_file),
                "rows":                 total_rows,
                "columns":              total_cols,
                "input_size":           input_size,
                "output_size":          output_size,
                "compression_ratio":    round(comp_ratio, 2),
                "compression_used":     algo,
                "file_type":            self.file_type,
                "elapsed_time":         round(elapsed, 2),
                "chunks_processed":     self.stats['chunks_processed'],
                "errors_fixed":         self.stats['errors_fixed'],
                "columns_removed":      self.stats['columns_removed'],
                "streaming_mode":       self.streaming,
                "parallel_workers":     self.stats['workers_used'],
            }

            if analysis:
                result["compression_analysis"] = analysis

            print(json.dumps(result))
            return 0

        except Exception as e:
            print(json.dumps({
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__
            }))
            return 1


def main():
    parser = argparse.ArgumentParser(
        description='Ultra Parquet Converter v1.3.0'
    )
    parser.add_argument('input')
    parser.add_argument('-o', '--output')
    parser.add_argument('-v', '--verbose',       action='store_true')
    parser.add_argument('--streaming',           action='store_true')
    parser.add_argument('--no-repair',           action='store_true')
    parser.add_argument('--no-normalize',        action='store_true')
    parser.add_argument('--workers',  type=int,  default=0)
    parser.add_argument('--compression', default='adaptive',
                        choices=['adaptive', 'snappy', 'gzip', 'brotli', 'zstd', 'lz4', 'none'])

    args = parser.parse_args()

    converter = AdvancedParquetConverter(
        input_file=args.input,
        output_file=args.output,
        verbose=args.verbose,
        streaming=args.streaming,
        auto_repair=not args.no_repair,
        auto_normalize=not args.no_normalize,
        parallel_workers=args.workers,
        compression=args.compression,
    )

    return converter.convert()


if __name__ == '__main__':
    multiprocessing.freeze_support()
    sys.exit(main())