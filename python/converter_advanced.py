#!/usr/bin/env python3
"""
Ultra Parquet Converter v1.1.0 - Advanced Edition
Conversor profesional con streaming, auto-detección y procesamiento paralelo
"""

import sys
import os
import json
from pathlib import Path
import argparse
import time
import hashlib
from typing import Optional, Dict, Any, List, Generator
import warnings
import io
warnings.filterwarnings('ignore')

# Imports básicos
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


class AdvancedParquetConverter:
    """Conversor avanzado con streaming, auto-detección y reparación"""
    
    SUPPORTED_FORMATS = {
        # Delimitados
        'csv', 'tsv', 'psv', 'dsv', 'txt', 'log',
        # Hojas de cálculo
        'xlsx', 'xls',
        # Estructurados
        'json', 'ndjson', 'jsonl', 'xml', 'yaml', 'yml', 'html',
        # Big Data formats
        'feather', 'arrow', 'orc', 'avro',
        # Bases de datos
        'sqlite', 'db',
        # Formatos estadísticos
        'sav', 'sas7bdat', 'dta'
    }
    
    # Configuración de chunks
    CHUNK_SIZE_BYTES = 100 * 1024 * 1024  # 100MB
    CHUNK_ROWS = 100000
    
    def __init__(self, input_file: str, output_file: Optional[str] = None, 
                    verbose: bool = False, streaming: bool = False,
                    auto_repair: bool = True, auto_normalize: bool = True):
        self.input_file = Path(input_file)
        self.output_file = Path(output_file) if output_file else self._generate_output_path()
        self.verbose = verbose
        self.streaming = streaming
        self.auto_repair = auto_repair
        self.auto_normalize = auto_normalize
        self.file_type = None
        self.stats = {
            'start_time': time.time(),
            'chunks_processed': 0,
            'rows_processed': 0,
            'errors_fixed': 0,
            'columns_removed': 0
        }
    
    def _log(self, message: str, level: str = "INFO"):
        """Logger con niveles"""
        if self.verbose:
            timestamp = time.strftime("%H:%M:%S")
            print(f"[{timestamp}] [{level}] {message}", file=sys.stderr)
    
    def _generate_output_path(self) -> Path:
        """Genera nombre de salida automáticamente"""
        return self.input_file.with_suffix('.parquet')
    
    def _detect_file_type_by_extension(self) -> Optional[str]:
        """Detecta tipo por extensión"""
        ext = self.input_file.suffix.lower().lstrip('.')
        if ext in self.SUPPORTED_FORMATS:
            return ext
        return None
    
    def _detect_file_type_by_content(self) -> str:
        """Auto-detección inteligente por contenido"""
        self._log("Detectando formato por contenido...")
        
        try:
            with open(self.input_file, 'rb') as f:
                # Lee primeras líneas
                header = f.read(8192)
                
                # SQLite magic number
                if header.startswith(b'SQLite format 3'):
                    return 'sqlite'
                
                # Parquet magic number
                if b'PAR1' in header:
                    return 'parquet'
                
                # Arrow/Feather magic
                if header.startswith(b'ARROW1'):
                    return 'feather'
                
                # ORC magic
                if header.startswith(b'ORC'):
                    return 'orc'
                
                # Avro magic
                if header.startswith(b'Obj\x01'):
                    return 'avro'
            
            # Intenta decodificar como texto
            with open(self.input_file, 'r', encoding='utf-8', errors='ignore') as f:
                first_lines = [f.readline() for _ in range(10)]
                content = ''.join(first_lines)
                
                # HTML
                if '<html' in content.lower() or '<table' in content.lower():
                    return 'html'
                
                # XML
                if content.strip().startswith('<?xml') or content.strip().startswith('<'):
                    return 'xml'
                
                # JSON
                if content.strip().startswith('{') or content.strip().startswith('['):
                    return 'json'
                
                # NDJSON (JSON Lines)
                if all(line.strip().startswith('{') for line in first_lines if line.strip()):
                    return 'ndjson'
                
                # YAML
                if content.strip().startswith('---') or ': ' in content and not ',' in content:
                    return 'yaml'
                
                # CSV/TSV/PSV detection
                first_line = first_lines[0] if first_lines else ""
                delimiters = {',': 'csv', '\t': 'tsv', '|': 'psv', ';': 'dsv'}
                max_count = 0
                detected_type = 'txt'
                
                for delim, file_type in delimiters.items():
                    count = first_line.count(delim)
                    if count > max_count and count > 2:  # Al menos 3 columnas
                        max_count = count
                        detected_type = file_type
                
                return detected_type
                
        except Exception as e:
            self._log(f"Error en auto-detección: {e}", "WARNING")
            return 'txt'
    
    def detect_format(self) -> str:
        """Detecta formato (extensión o contenido)"""
        # Primero intenta por extensión
        file_type = self._detect_file_type_by_extension()
        
        if file_type:
            self._log(f"Formato detectado por extensión: {file_type.upper()}")
            self.file_type = file_type
            return file_type
        
        # Si falla, analiza contenido
        file_type = self._detect_file_type_by_content()
        self._log(f"Formato detectado por contenido: {file_type.upper()}")
        self.file_type = file_type
        return file_type
    
    def _auto_repair_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Auto-reparación de datos"""
        if not self.auto_repair:
            return df
        
        self._log("Aplicando auto-reparación...")
        original_cols = len(df.columns)
        
        # 1. Eliminar columnas completamente vacías
        df = df.dropna(axis=1, how='all')
        removed_cols = original_cols - len(df.columns)
        if removed_cols > 0:
            self.stats['columns_removed'] += removed_cols
            self._log(f"Eliminadas {removed_cols} columnas vacías")
        
        # 2. Detectar y corregir tipos
        for col in df.columns:
            # Intentar convertir a numérico si es posible
            if df[col].dtype == 'object':
                try:
                    # Eliminar espacios y caracteres especiales
                    df[col] = df[col].astype(str).str.strip()
                    
                    # Intentar convertir a número
                    numeric = pd.to_numeric(df[col], errors='coerce')
                    if numeric.notna().sum() / len(df[col]) > 0.8:  # >80% son números
                        df[col] = numeric
                        self.stats['errors_fixed'] += 1
                except:
                    pass
        
        # 3. Eliminar duplicados exactos
        before = len(df)
        df = df.drop_duplicates()
        if len(df) < before:
            self._log(f"Eliminadas {before - len(df)} filas duplicadas")
        
        return df
    
    def _auto_normalize_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Auto-normalización de datos"""
        if not self.auto_normalize:
            return df
        
        self._log("Aplicando auto-normalización...")
        
        # 1. Normalizar nombres de columnas
        df.columns = [str(col).strip().lower().replace(' ', '_') for col in df.columns]
        
        # 2. Remover columnas con un solo valor
        for col in df.columns:
            if df[col].nunique() == 1:
                df = df.drop(columns=[col])
                self._log(f"Eliminada columna constante: {col}")
        
        return df
    
    def _read_with_chunks(self, reader_func, **kwargs) -> Generator:
        """Lee archivo en chunks para procesamiento streaming"""
        self._log(f"Modo streaming activado (chunks de {self.CHUNK_ROWS:,} filas)")
        
        for chunk in reader_func(chunksize=self.CHUNK_ROWS, **kwargs):
            chunk = self._auto_repair_dataframe(chunk)
            chunk = self._auto_normalize_dataframe(chunk)
            self.stats['chunks_processed'] += 1
            self.stats['rows_processed'] += len(chunk)
            yield chunk
    
    # ========== LECTORES POR FORMATO ==========
    
    def _read_csv_variants(self, delimiter=',') -> pd.DataFrame:
        """Lee CSV, TSV, PSV, DSV"""
        self._log(f"Leyendo archivo delimitado (delimitador: '{delimiter}')")
        
        if self.streaming or self.input_file.stat().st_size > self.CHUNK_SIZE_BYTES:
            return self._read_with_chunks(
                pd.read_csv,
                self.input_file,
                sep=delimiter,
                encoding='utf-8',
                on_bad_lines='skip',
                low_memory=False
            )
        
        try:
            df = pd.read_csv(
                self.input_file,
                sep=delimiter,
                encoding='utf-8',
                on_bad_lines='skip',
                engine='c',
                low_memory=False
            )
        except:
            # Fallback con detección automática
            df = pd.read_csv(
                self.input_file,
                sep=None,
                encoding='utf-8',
                engine='python',
                on_bad_lines='skip'
            )
        
        return df
    
    def _read_excel(self) -> pd.DataFrame:
        """Lee XLSX/XLS"""
        self._log(f"Leyendo Excel: {self.input_file}")
        try:
            import openpyxl
            df = pd.read_excel(self.input_file, engine='openpyxl')
        except ImportError:
            self._log("openpyxl no instalado, instalando...", "WARNING")
            df = pd.read_excel(self.input_file)
        return df
    
    def _read_json(self) -> pd.DataFrame:
        """Lee JSON (normal)"""
        self._log("Leyendo JSON")
        
        try:
            df = pd.read_json(self.input_file, orient='records')
        except:
            try:
                df = pd.read_json(self.input_file, orient='index')
            except:
                with open(self.input_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                df = pd.DataFrame(data if isinstance(data, list) else [data])
        
        return df
    
    def _read_ndjson(self) -> pd.DataFrame:
        """Lee NDJSON/JSON Lines"""
        self._log("Leyendo NDJSON (JSON Lines)")
        df = pd.read_json(self.input_file, lines=True)
        return df
    
    def _read_xml(self) -> pd.DataFrame:
        """Lee XML"""
        self._log("Leyendo XML")
        try:
            import lxml
            df = pd.read_xml(self.input_file)
        except ImportError:
            self._log("lxml no instalado", "WARNING")
            import xml.etree.ElementTree as ET
            tree = ET.parse(self.input_file)
            root = tree.getroot()
            data = [{child.tag: child.text for child in elem} for elem in root]
            df = pd.DataFrame(data)
        return df
    
    def _read_yaml(self) -> pd.DataFrame:
        """Lee YAML"""
        self._log("Leyendo YAML")
        try:
            import yaml
            with open(self.input_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            df = pd.DataFrame(data if isinstance(data, list) else [data])
        except ImportError:
            raise ImportError("PyYAML no instalado: pip install pyyaml")
        return df
    
    def _read_html(self) -> pd.DataFrame:
        """Lee HTML tables"""
        self._log("Leyendo tablas HTML")
        try:
            tables = pd.read_html(self.input_file)
            if not tables:
                raise ValueError("No se encontraron tablas en el HTML")
            # Usa la tabla más grande
            df = max(tables, key=len)
            self._log(f"Encontradas {len(tables)} tablas, usando la más grande")
        except ImportError:
            raise ImportError("lxml no instalado: pip install lxml")
        return df
    
    def _read_feather(self) -> pd.DataFrame:
        """Lee Feather/Arrow"""
        self._log("Leyendo Feather/Arrow")
        try:
            import pyarrow.feather as feather
            df = feather.read_feather(self.input_file)
        except:
            df = pd.read_feather(self.input_file)
        return df
    
    def _read_orc(self) -> pd.DataFrame:
        """Lee ORC"""
        self._log("Leyendo ORC")
        try:
            import pyarrow.orc as orc
            table = orc.read_table(self.input_file)
            df = table.to_pandas()
        except ImportError:
            raise ImportError("PyArrow ORC no disponible")
        return df
    
    def _read_avro(self) -> pd.DataFrame:
        """Lee Avro"""
        self._log("Leyendo Avro")
        try:
            from fastavro import reader
            records = []
            with open(self.input_file, 'rb') as f:
                avro_reader = reader(f)
                for record in avro_reader:
                    records.append(record)
            df = pd.DataFrame(records)
        except ImportError:
            raise ImportError("fastavro no instalado: pip install fastavro")
        return df
    
    def _read_sqlite(self) -> pd.DataFrame:
        """Lee SQLite"""
        self._log("Leyendo SQLite")
        import sqlite3
        conn = sqlite3.connect(self.input_file)
        
        # Lista todas las tablas
        tables = pd.read_sql_query(
            "SELECT name FROM sqlite_master WHERE type='table'", conn
        )
        
        if len(tables) == 0:
            raise ValueError("No se encontraron tablas en la base de datos")
        
        # Lee la primera tabla (o la más grande)
        table_name = tables['name'].iloc[0]
        self._log(f"Leyendo tabla: {table_name}")
        df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
        conn.close()
        
        return df
    
    def _read_spss(self) -> pd.DataFrame:
        """Lee SPSS (.sav)"""
        self._log("Leyendo SPSS")
        try:
            import pyreadstat
            df, meta = pyreadstat.read_sav(self.input_file)
        except ImportError:
            raise ImportError("pyreadstat no instalado: pip install pyreadstat")
        return df
    
    def _read_sas(self) -> pd.DataFrame:
        """Lee SAS"""
        self._log("Leyendo SAS")
        df = pd.read_sas(self.input_file)
        return df
    
    def _read_stata(self) -> pd.DataFrame:
        """Lee Stata"""
        self._log("Leyendo Stata")
        df = pd.read_stata(self.input_file)
        return df
    
    def read_file(self) -> pd.DataFrame:
        """Lee archivo según su tipo detectado"""
        if not self.file_type:
            self.detect_format()
        
        # Mapeo de tipos a funciones
        readers = {
            'csv': lambda: self._read_csv_variants(','),
            'tsv': lambda: self._read_csv_variants('\t'),
            'psv': lambda: self._read_csv_variants('|'),
            'dsv': lambda: self._read_csv_variants(None),
            'txt': lambda: self._read_csv_variants(None),
            'log': lambda: self._read_csv_variants(None),
            'xlsx': self._read_excel,
            'xls': self._read_excel,
            'json': self._read_json,
            'ndjson': self._read_ndjson,
            'jsonl': self._read_ndjson,
            'xml': self._read_xml,
            'yaml': self._read_yaml,
            'yml': self._read_yaml,
            'html': self._read_html,
            'feather': self._read_feather,
            'arrow': self._read_feather,
            'orc': self._read_orc,
            'avro': self._read_avro,
            'sqlite': self._read_sqlite,
            'db': self._read_sqlite,
            'sav': self._read_spss,
            'sas7bdat': self._read_sas,
            'dta': self._read_stata
        }
        
        reader = readers.get(self.file_type)
        if not reader:
            raise ValueError(f"Formato no soportado: {self.file_type}")
        
        df = reader()
        
        # Si no es generador (streaming), aplicar reparación/normalización
        if not hasattr(df, '__iter__') or isinstance(df, pd.DataFrame):
            df = self._auto_repair_dataframe(df)
            df = self._auto_normalize_dataframe(df)
            self.stats['rows_processed'] = len(df)
        
        return df
    
    def convert(self) -> Dict[str, Any]:
        """Convierte archivo a Parquet"""
        try:
            if not self.input_file.exists():
                raise FileNotFoundError(f"Archivo no encontrado: {self.input_file}")
            
            self._log(f"Iniciando conversión: {self.input_file} -> {self.output_file}")
            
            # Lee archivo
            df_or_gen = self.read_file()
            
            # Convierte a Parquet
            if hasattr(df_or_gen, '__iter__') and not isinstance(df_or_gen, pd.DataFrame):
                # Modo streaming
                self._log("Escribiendo en modo streaming...")
                writer = None
                
                for chunk in df_or_gen:
                    table = pa.Table.from_pandas(chunk, preserve_index=False)
                    
                    if writer is None:
                        writer = pq.ParquetWriter(
                            self.output_file,
                            table.schema,
                            compression='snappy'
                        )
                    
                    writer.write_table(table)
                
                if writer:
                    writer.close()
                
                # Stats finales
                total_rows = self.stats['rows_processed']
                total_cols = len(chunk.columns) if 'chunk' in locals() else 0
                
            else:
                # Modo normal
                df = df_or_gen
                total_rows = len(df)
                total_cols = len(df.columns)
                
                # Optimiza tipos
                for col in df.select_dtypes(include=['object']).columns:
                    if df[col].nunique() / len(df[col]) < 0.5:
                        df[col] = df[col].astype('category')
                
                # Convierte a Arrow
                table = pa.Table.from_pandas(df, preserve_index=False)
                
                # Escribe Parquet
                pq.write_table(
                    table,
                    self.output_file,
                    compression='snappy',
                    use_dictionary=True,
                    write_statistics=True,
                    row_group_size=1000000
                )
            
            # Calcula stats
            elapsed = time.time() - self.stats['start_time']
            input_size = self.input_file.stat().st_size
            output_size = self.output_file.stat().st_size
            compression_ratio = (1 - output_size / input_size) * 100 if input_size > 0 else 0
            
            result = {
                "success": True,
                "input_file": str(self.input_file),
                "output_file": str(self.output_file),
                "rows": total_rows,
                "columns": total_cols,
                "input_size": input_size,
                "output_size": output_size,
                "compression_ratio": round(compression_ratio, 2),
                "file_type": self.file_type,
                "elapsed_time": round(elapsed, 2),
                "chunks_processed": self.stats['chunks_processed'],
                "errors_fixed": self.stats['errors_fixed'],
                "columns_removed": self.stats['columns_removed'],
                "streaming_mode": self.streaming
            }
            
            print(json.dumps(result))
            return 0
            
        except Exception as e:
            error_result = {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__
            }
            print(json.dumps(error_result))
            return 1


def main():
    parser = argparse.ArgumentParser(
        description='Ultra Parquet Converter v1.1.0 - Conversor profesional avanzado'
    )
    parser.add_argument('input', help='Archivo de entrada')
    parser.add_argument('-o', '--output', help='Archivo de salida')
    parser.add_argument('-v', '--verbose', action='store_true', help='Modo verbose')
    parser.add_argument('--streaming', action='store_true', help='Modo streaming (archivos grandes)')
    parser.add_argument('--no-repair', action='store_true', help='Desactivar auto-reparación')
    parser.add_argument('--no-normalize', action='store_true', help='Desactivar auto-normalización')
    
    args = parser.parse_args()
    
    converter = AdvancedParquetConverter(
        input_file=args.input,
        output_file=args.output,
        verbose=args.verbose,
        streaming=args.streaming,
        auto_repair=not args.no_repair,
        auto_normalize=not args.no_normalize
    )
    
    return converter.convert()


if __name__ == '__main__':
    sys.exit(main())
