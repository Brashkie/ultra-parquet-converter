const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\n🔧 Ultra Parquet Converter - Post-instalación\n');

// Verifica si Python está instalado
const pythonCheck = spawn('python3', ['--version']);

pythonCheck.on('close', (code) => {
  if (code !== 0) {
    console.log('⚠️  Python no detectado. Por favor instala Python 3.8 o superior.');
    console.log('   Descarga: https://www.python.org/downloads/\n');
    return;
  }

  console.log('✅ Python detectado\n');
  console.log('📦 Para instalar las dependencias Python, ejecuta:\n');
  console.log('   npx ultra-parquet-converter setup\n');
  console.log('   O manualmente:\n');
  console.log('   pip install pandas pyarrow openpyxl lxml\n');
});

pythonCheck.on('error', () => {
  console.log('⚠️  Python no detectado en el PATH.');
  console.log('   Asegúrate de tener Python 3.8+ instalado.\n');
});
