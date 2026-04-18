# cython/fast_parser.pyx
# distutils: language = c
# cython: language_level=3
# cython: boundscheck=False
# cython: wraparound=False
# cython: cdivision=True
"""
Ultra-fast type inference y normalización de datos con Cython.
"""

import cython
import pandas as pd
import numpy as np


@cython.cfunc
@cython.inline
def _is_integer(str value) -> cython.bint:
    cdef str v = value.strip()
    if not v:
        return False
    if v[0] in ('-', '+'):
        v = v[1:]
    return v.isdigit()


@cython.cfunc
@cython.inline
def _is_float(str value) -> cython.bint:
    cdef str v = value.strip().replace(',', '.')
    try:
        float(v)
        return True
    except (ValueError, TypeError):
        return False


@cython.cfunc
@cython.inline
def _is_boolean(str value) -> cython.bint:
    return value.strip().lower() in ('true', 'false', '1', '0', 'yes', 'no', 'si', 'sí')


def infer_column_types(object df, double threshold=0.85) -> dict:
    """
    Infiere tipos de columnas con alta precisión.

    Args:
        df:        DataFrame a analizar
        threshold: % mínimo de valores válidos para cambiar tipo (0.0-1.0)

    Returns:
        Dict {columna: tipo_detectado}
    """
    cdef dict result = {}
    cdef str col
    cdef int total
    cdef int valid_int, valid_float, valid_bool
    cdef double ratio
    cdef str val

    for col in df.columns:
        if df[col].dtype != object:
            result[col] = str(df[col].dtype)
            continue

        total = len(df[col].dropna())
        if total == 0:
            result[col] = 'string'
            continue

        valid_int = 0
        valid_float = 0
        valid_bool = 0

        for val in df[col].dropna().astype(str):
            if _is_integer(val):
                valid_int += 1
                valid_float += 1
            elif _is_float(val):
                valid_float += 1
            if _is_boolean(val):
                valid_bool += 1

        if valid_bool / total >= threshold and total > 5:
            result[col] = 'boolean'
        elif valid_int / total >= threshold:
            result[col] = 'int64'
        elif valid_float / total >= threshold:
            result[col] = 'float64'
        else:
            result[col] = 'string'

    return result


def fast_type_conversion(object df, double threshold=0.85) -> object:
    """
    Convierte tipos de columnas automáticamente.

    Args:
        df:        DataFrame con columnas object
        threshold: % mínimo de valores válidos para convertir

    Returns:
        DataFrame con tipos optimizados
    """
    cdef dict types = infer_column_types(df, threshold)
    cdef str col, dtype

    for col, dtype in types.items():
        if col not in df.columns:
            continue
        try:
            if dtype == 'int64':
                df[col] = pd.to_numeric(df[col], errors='coerce').astype('Int64')
            elif dtype == 'float64':
                df[col] = pd.to_numeric(df[col], errors='coerce').astype('float64')
            elif dtype == 'boolean':
                df[col] = df[col].astype(str).str.strip().str.lower().map({
                    'true': True, 'false': False,
                    '1': True,    '0': False,
                    'yes': True,  'no': False,
                    'si': True,   'sí': True
                })
        except Exception:
            pass

    return df


def normalize_column_names(object df) -> object:
    """
    Normaliza nombres de columnas a snake_case.

    Returns:
        DataFrame con columnas normalizadas
    """
    cdef list new_cols = []
    cdef str col, normalized

    for col in df.columns:
        normalized = (
            str(col)
            .strip()
            .lower()
            .replace(' ', '_')
            .replace('-', '_')
            .replace('.', '_')
            .replace('/', '_')
            .replace('\\', '_')
            .replace('(', '')
            .replace(')', '')
            .replace('[', '')
            .replace(']', '')
        )
        if not normalized or normalized[0].isdigit():
            normalized = 'col_' + normalized
        new_cols.append(normalized)

    df.columns = new_cols
    return df


def remove_empty_columns(object df, double threshold=0.95) -> object:
    """
    Elimina columnas con demasiados valores nulos.

    Args:
        threshold: % de nulos para eliminar columna (default 95%)

    Returns:
        DataFrame sin columnas casi vacías
    """
    cdef list cols_to_drop = []
    cdef str col
    cdef double null_ratio

    for col in df.columns:
        null_ratio = df[col].isna().sum() / len(df) if len(df) > 0 else 1.0
        if null_ratio >= threshold:
            cols_to_drop.append(col)

    if cols_to_drop:
        df = df.drop(columns=cols_to_drop)

    return df


def fast_stats(object df) -> dict:
    """
    Estadísticas rápidas del DataFrame.

    Returns:
        Dict con rows, columns, null_count, memory_mb
    """
    cdef int null_count = 0
    cdef str col

    for col in df.columns:
        null_count += int(df[col].isna().sum())

    return {
        'rows': len(df),
        'columns': len(df.columns),
        'null_count': null_count,
        'memory_mb': round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
        'dtypes': {col: str(df[col].dtype) for col in df.columns}
    }
