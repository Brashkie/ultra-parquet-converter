# cython/__init__.py
"""
Cython modules para ultra-parquet-converter v1.3.0
Importación segura — no falla si los módulos no están compilados.
"""

import sys
import os

# Agrega el directorio cython/ al path para encontrar los .pyd/.so
_CYTHON_DIR = os.path.dirname(os.path.abspath(__file__))
if _CYTHON_DIR not in sys.path:
    sys.path.insert(0, _CYTHON_DIR)

# Flags de disponibilidad
FAST_CSV_AVAILABLE = False
FAST_PARSER_AVAILABLE = False

try:
    from fast_csv import (
        fast_read_csv,
        fast_read_csv_chunked,
        detect_delimiter,
        count_rows_fast,
    )
    FAST_CSV_AVAILABLE = True
except ImportError:
    # Módulo no compilado — fallback a pandas puro
    fast_read_csv = None
    fast_read_csv_chunked = None
    detect_delimiter = None
    count_rows_fast = None

try:
    from fast_parser import (
        infer_column_types,
        fast_type_conversion,
        normalize_column_names,
        remove_empty_columns,
        fast_stats,
    )
    FAST_PARSER_AVAILABLE = True
except ImportError:
    # Módulo no compilado — fallback a pandas puro
    infer_column_types = None
    fast_type_conversion = None
    normalize_column_names = None
    remove_empty_columns = None
    fast_stats = None

# Estado general
CYTHON_AVAILABLE = FAST_CSV_AVAILABLE and FAST_PARSER_AVAILABLE


def get_status() -> dict:
    """Retorna estado de los módulos Cython"""
    return {
        'available': CYTHON_AVAILABLE,
        'fast_csv': FAST_CSV_AVAILABLE,
        'fast_parser': FAST_PARSER_AVAILABLE,
        'modules': [
            m for m, avail in [
                ('fast_csv', FAST_CSV_AVAILABLE),
                ('fast_parser', FAST_PARSER_AVAILABLE)
            ] if avail
        ]
    }


__all__ = [
    'CYTHON_AVAILABLE',
    'FAST_CSV_AVAILABLE',
    'FAST_PARSER_AVAILABLE',
    'fast_read_csv',
    'fast_read_csv_chunked',
    'detect_delimiter',
    'count_rows_fast',
    'infer_column_types',
    'fast_type_conversion',
    'normalize_column_names',
    'remove_empty_columns',
    'fast_stats',
    'get_status',
]