#!/usr/bin/env python3
"""
Ultra Parquet Converter - Python Backend
Convierte múltiples formatos a Parquet usando Apache Arrow
"""

import sys
import os
import json
from pathlib import Path
import argparse

try:
    import pandas as pd
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "Dependencias no instaladas. Ejecuta: pip install pandas pyarrow openpyxl lxml"
    }))
    sys.exit(1)


class ParquetConverter:
    """Conversor universal a formato Parquet"""
    
    SUPPORTED_FORMATS = ['csv', 'xlsx', 'xls', 'json', 'xml', 'txt', 'log']
    
    def __init__(self, input_file, output_file=None, verbose=False):
        self.input_file = Path(input_file)
        self.output_file = Path(output_file) if output_file else self._generate_output_path()
        self.verbose = verbose
        self.file_type = self._detect_file_type()
        
    def _detect_file_type(self):
        """Detecta el tipo de archivo por extensión"""
        ext = self.input_file.suffix.lower().lstrip('.')
        
        if ext not in self.SUPPORTED_FORMATS:
            raise ValueError(
                f"Formato '{ext}' no soportado. "
                f"Formatos válidos: {', '.join(self.SUPPORTED_FORMATS).upper()}"
            )
        
        return ext
    
    def _generate_output_path(self):
        """Genera path de salida automáticamente"""
        return self.input_file.with_suffix('.parquet')
    
    def _log(self, message):
        """Imprime mensaje si verbose está activado"""
        if self.verbose:
            print(f"[INFO] {message}", file=sys.stderr)
    
    def _read_csv(self):
        """Lee archivo CSV con optimizaciones"""
        self._log(f"Leyendo CSV: {self.input_file}")
        
        # Optimización: usa engine C (más rápido) con detección automática
        try:
            # Primero detecta el separador
            with open(self.input_file, 'r', encoding='utf-8') as f:
                first_line = f.readline()
            
            # Detecta delimitador común
            delimiters = [',', '\t', ';', '|']
            sep = max(delimiters, key=lambda d: first_line.count(d))
            
            # Lee con engine C (hasta 5x más rápido que Python)
            df = pd.read_csv(
                self.input_file,
                sep=sep,
                engine='c',  # Engine más rápido
                encoding='utf-8',
                low_memory=False  # Mejor inferencia de tipos
            )
        except Exception as e:
            # Fallback: engine Python con auto-detección
            df = pd.read_csv(
                self.input_file,
                sep=None,
                engine='python',
                encoding='utf-8'
            )
        
        return df
    
    def _read_xlsx(self):
        """Lee archivo Excel (XLSX/XLS) con optimizaciones"""
        self._log(f"Leyendo Excel: {self.input_file}")
        
        # Lee la primera hoja con configuraciones optimizadas
        df = pd.read_excel(
            self.input_file,
            engine='openpyxl',
            sheet_name=0,  # Primera hoja
            # Optimizaciones adicionales
            dtype_backend='numpy_nullable'  # Mejor manejo de tipos
        )
        
        return df
    
    def _read_json(self):
        """Lee archivo JSON"""
        self._log(f"Leyendo JSON: {self.input_file}")
        
        # Intenta diferentes orientaciones
        try:
            df = pd.read_json(self.input_file, orient='records')
        except ValueError:
            try:
                df = pd.read_json(self.input_file, orient='index')
            except ValueError:
                try:
                    df = pd.read_json(self.input_file, orient='columns')
                except ValueError:
                    # Último intento: cargar como JSON y convertir
                    with open(self.input_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    if isinstance(data, list):
                        df = pd.DataFrame(data)
                    elif isinstance(data, dict):
                        df = pd.DataFrame([data])
                    else:
                        raise ValueError("Formato JSON no reconocido")
        
        return df
    
    def _read_xml(self):
        """Lee archivo XML"""
        self._log(f"Leyendo XML: {self.input_file}")
        
        try:
            df = pd.read_xml(self.input_file)
        except Exception as e:
            # Fallback: intenta con lxml
            try:
                import xml.etree.ElementTree as ET
                tree = ET.parse(self.input_file)
                root = tree.getroot()
                
                # Convierte XML a lista de diccionarios
                data = []
                for child in root:
                    record = {}
                    for subchild in child:
                        record[subchild.tag] = subchild.text
                    data.append(record)
                
                df = pd.DataFrame(data)
            except Exception as e2:
                raise ValueError(f"Error al parsear XML: {e2}")
        
        return df
    
    def _read_txt_or_log(self):
        """Lee archivo de texto o log"""
        self._log(f"Leyendo archivo de texto: {self.input_file}")
        
        with open(self.input_file, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        
        # Intenta detectar si es un CSV disfrazado
        first_line = lines[0].strip() if lines else ""
        
        if ',' in first_line or '\t' in first_line or ';' in first_line:
            # Parece CSV
            self._log("Detectado formato delimitado en archivo TXT/LOG")
            df = pd.read_csv(self.input_file, sep=None, engine='python', encoding='utf-8', error_bad_lines=False)
        else:
            # Archivo de texto plano o logs
            df = pd.DataFrame({'line': [line.strip() for line in lines if line.strip()]})
        
        return df
    
    def convert(self):
        """Realiza la conversión a Parquet"""
        try:
            # Valida que el archivo exista
            if not self.input_file.exists():
                raise FileNotFoundError(f"Archivo no encontrado: {self.input_file}")
            
            self._log(f"Iniciando conversión: {self.input_file} -> {self.output_file}")
            
            # Lee según el tipo de archivo
            if self.file_type == 'csv':
                df = self._read_csv()
            elif self.file_type in ['xlsx', 'xls']:
                df = self._read_xlsx()
            elif self.file_type == 'json':
                df = self._read_json()
            elif self.file_type == 'xml':
                df = self._read_xml()
            elif self.file_type in ['txt', 'log']:
                df = self._read_txt_or_log()
            else:
                raise ValueError(f"Tipo de archivo no soportado: {self.file_type}")
            
            # Valida que tengamos datos
            if df.empty:
                raise ValueError("El archivo no contiene datos válidos")
            
            self._log(f"Datos leídos: {len(df)} filas, {len(df.columns)} columnas")
            
            # Optimización: Convierte tipos para mejor compresión
            # Categoriza columnas con valores repetidos
            for col in df.select_dtypes(include=['object']).columns:
                num_unique = df[col].nunique()
                num_total = len(df[col])
                # Si menos del 50% son únicos, categoriza
                if num_unique / num_total < 0.5:
                    df[col] = df[col].astype('category')
                    self._log(f"Optimizado columna categórica: {col}")
            
            # Convierte a tabla Arrow (más eficiente que pandas)
            table = pa.Table.from_pandas(df, preserve_index=False)
            
            # Escribe a Parquet con configuraciones optimizadas
            pq.write_table(
                table,
                self.output_file,
                compression='snappy',      # Compresión rápida (2-4x más rápida que gzip)
                use_dictionary=True,       # Optimiza columnas repetitivas
                write_statistics=True,     # Añade estadísticas para queries
                row_group_size=1000000,    # Grupos grandes para mejor compresión
                data_page_size=1048576,    # 1MB páginas para rendimiento
                use_deprecated_int96_timestamps=False,  # Usa INT64 (más eficiente)
                coerce_timestamps='ms',    # Millisecond precision
                allow_truncated_timestamps=True
            )
            
            # Obtiene tamaño del archivo
            input_size = self.input_file.stat().st_size
            output_size = self.output_file.stat().st_size
            compression_ratio = (1 - output_size / input_size) * 100 if input_size > 0 else 0
            
            # Retorna información del resultado
            result = {
                "success": True,
                "input_file": str(self.input_file),
                "output_file": str(self.output_file),
                "rows": len(df),
                "columns": len(df.columns),
                "input_size": input_size,
                "output_size": output_size,
                "compression_ratio": round(compression_ratio, 2),
                "file_type": self.file_type
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
        description='Ultra Parquet Converter - Convierte archivos a formato Parquet'
    )
    parser.add_argument('input', help='Archivo de entrada')
    parser.add_argument('-o', '--output', help='Archivo de salida (opcional)')
    parser.add_argument('-v', '--verbose', action='store_true', help='Modo verbose')
    
    args = parser.parse_args()
    
    converter = ParquetConverter(
        input_file=args.input,
        output_file=args.output,
        verbose=args.verbose
    )
    
    return converter.convert()


if __name__ == '__main__':
    sys.exit(main())
