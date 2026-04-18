# cython/setup.py
"""
Build script para compilar módulos Cython.

Uso:
    python setup.py build_ext --inplace

Genera:
    fast_csv.cp3XX-win_amd64.pyd     (Windows)
    fast_csv.cpython-3XX-x86_64.so   (Linux/macOS)
    fast_parser.cp3XX-win_amd64.pyd  (Windows)
    fast_parser.cpython-3XX-x86_64.so (Linux/macOS)
"""

from setuptools import setup, Extension
from Cython.Build import cythonize
import numpy as np
import sys
import os

# Directorio actual (cython/)
HERE = os.path.dirname(os.path.abspath(__file__))

# Flags de compilación por plataforma
if sys.platform == 'win32':
    extra_compile_args = ['/O2', '/W0']
    extra_link_args = []
elif sys.platform == 'darwin':
    extra_compile_args = ['-O3', '-w', '-ffast-math']
    extra_link_args = ['-Wl,-rpath,@loader_path']
else:  # Linux
    extra_compile_args = ['-O3', '-w', '-ffast-math', '-march=native']
    extra_link_args = ['-Wl,-rpath,$ORIGIN']

# Extensiones a compilar
extensions = [
    Extension(
        name='fast_csv',
        sources=[os.path.join(HERE, 'fast_csv.pyx')],
        include_dirs=[np.get_include()],
        extra_compile_args=extra_compile_args,
        extra_link_args=extra_link_args,
        language='c',
    ),
    Extension(
        name='fast_parser',
        sources=[os.path.join(HERE, 'fast_parser.pyx')],
        include_dirs=[np.get_include()],
        extra_compile_args=extra_compile_args,
        extra_link_args=extra_link_args,
        language='c',
    ),
]

setup(
    name='ultra-parquet-converter-cython',
    version='1.3.0',
    description='Cython modules for ultra-fast Parquet conversion',
    ext_modules=cythonize(
        extensions,
        compiler_directives={
            'language_level': '3',
            'boundscheck': False,
            'wraparound': False,
            'cdivision': True,
            'nonecheck': False,
            'embedsignature': True,
            'optimize.use_switch': True,
        },
        annotate=False,
        quiet=True,
    ),
    include_dirs=[np.get_include()],
    zip_safe=False,
)