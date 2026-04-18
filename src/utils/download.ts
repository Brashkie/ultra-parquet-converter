/**
 * Portable Python Downloader
 * Descarga y configura Python portable automáticamente
 */

import fetch from 'node-fetch';
import { createWriteStream, existsSync, mkdirSync, chmodSync } from 'fs';
import { pipeline } from 'stream/promises';
import extract from 'extract-zip';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import cliProgress from 'cli-progress';

const PORTABLE_PYTHON_URLS = {
  win32: {
    url: 'https://www.python.org/ftp/python/3.11.7/python-3.11.7-embed-amd64.zip',
    size: 10_500_000 // ~10MB
  },
  linux: {
    url: 'https://github.com/indygreg/python-build-standalone/releases/download/20231002/cpython-3.11.6+20231002-x86_64-unknown-linux-gnu-install_only.tar.gz',
    size: 50_000_000 // ~50MB
  },
  darwin: {
    url: 'https://github.com/indygreg/python-build-standalone/releases/download/20231002/cpython-3.11.6+20231002-x86_64-apple-darwin-install_only.tar.gz',
    size: 45_000_000 // ~45MB
  }
};

export class PortablePythonDownloader {
  private installDir: string;
  private platform: NodeJS.Platform;

  constructor() {
    this.platform = process.platform;
    this.installDir = join(homedir(), '.ultra-parquet-converter', 'python-portable');
  }

  isInstalled(): boolean {
    return existsSync(this.getPythonExecutable());
  }

  getPythonExecutable(): string {
    if (this.platform === 'win32') {
      return join(this.installDir, 'python.exe');
    } else {
      return join(this.installDir, 'bin', 'python3');
    }
  }

  async download(): Promise<string> {
    console.log('📦 Descargando Python portable...');

    const config = PORTABLE_PYTHON_URLS[this.platform as keyof typeof PORTABLE_PYTHON_URLS];
    if (!config) {
      throw new Error(`Platform ${this.platform} no soportada para Python portable`);
    }

    if (!existsSync(this.installDir)) {
      mkdirSync(this.installDir, { recursive: true });
    }

    const downloadPath = join(this.installDir, 'python-portable.zip');
    await this.downloadFile(config.url, downloadPath, config.size);

    console.log('📂 Extrayendo archivos...');
    await this.extractFile(downloadPath);

    await this.setupPython();
    await this.installPip();
    await this.installDependencies();

    console.log('✅ Python portable instalado correctamente');
    return this.getPythonExecutable();
  }

  /**
   * Descarga archivo con progress bar.
   * node-fetch@2 devuelve un Node.js Readable stream directamente,
   * NO un Web ReadableStream — por eso pipeline() funciona sin conversión.
   */
  private async downloadFile(url: string, dest: string, totalSize: number): Promise<void> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error(`Response body vacío para: ${url}`);
    }

    const progressBar = new cliProgress.SingleBar({
      format: 'Descargando |{bar}| {percentage}% | {value}/{total} MB',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    });

    const totalMB = Math.round(totalSize / 1024 / 1024);
    progressBar.start(totalMB, 0);

    const fileStream = createWriteStream(dest);
    let downloaded = 0;

    response.body.on('data', (chunk: Buffer) => {
      downloaded += chunk.length;
      progressBar.update(Math.round(downloaded / 1024 / 1024));
    });

    await pipeline(response.body, fileStream);
    progressBar.stop();
  }

  private async extractFile(filePath: string): Promise<void> {
    if (this.platform === 'win32') {
      await extract(filePath, { dir: this.installDir });
    } else {
      return new Promise((resolve, reject) => {
        const tar = spawn('tar', ['-xzf', filePath, '-C', this.installDir]);
        tar.on('close', (code) => {
          code === 0 ? resolve() : reject(new Error('Extracción falló'));
        });
        tar.on('error', reject);
      });
    }
  }

  private async setupPython(): Promise<void> {
    const pythonExe = this.getPythonExecutable();

    if (this.platform !== 'win32') {
      chmodSync(pythonExe, 0o755);
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(pythonExe, ['--version']);
      proc.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error('Python portable no funciona'));
      });
      proc.on('error', reject);
    });
  }

  /**
   * Descarga get-pip.py y lo ejecuta.
   * node-fetch@2: pipeline directo sin Readable.fromWeb()
   */
  private async installPip(): Promise<void> {
    console.log('📦 Instalando pip...');

    const pythonExe = this.getPythonExecutable();
    const getPipPath = join(this.installDir, 'get-pip.py');

    const response = await fetch('https://bootstrap.pypa.io/get-pip.py');

    if (!response.ok) {
      throw new Error(`No se pudo descargar get-pip.py: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body vacío para get-pip.py');
    }

    await pipeline(response.body, createWriteStream(getPipPath));

    return new Promise((resolve, reject) => {
      const proc = spawn(pythonExe, [getPipPath], { stdio: 'inherit' });
      proc.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error('pip install failed'));
      });
      proc.on('error', reject);
    });
  }

  private async installDependencies(): Promise<void> {
    console.log('📦 Instalando dependencias Python...');

    const pythonExe = this.getPythonExecutable();
    const requirementsPath = join(__dirname, '..', '..', 'python', 'requirements.txt');

    return new Promise((resolve, reject) => {
      const proc = spawn(pythonExe, ['-m', 'pip', 'install', '-r', requirementsPath], {
        stdio: 'inherit'
      });
      proc.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error('Dependencies install failed'));
      });
      proc.on('error', reject);
    });
  }

  async getInfo() {
    if (!this.isInstalled()) {
      return { installed: false, path: null, version: null };
    }

    const pythonExe = this.getPythonExecutable();

    const version = await new Promise<string>((resolve) => {
      const proc = spawn(pythonExe, ['--version']);
      let output = '';

      proc.stdout?.on('data', (data: Buffer) => { output += data.toString(); });
      proc.stderr?.on('data', (data: Buffer) => { output += data.toString(); });

      proc.on('close', () => {
        const match = output.match(/Python (\d+\.\d+\.\d+)/);
        resolve(match ? match[1] : 'unknown');
      });
    });

    return { installed: true, path: pythonExe, version };
  }
}

let downloader: PortablePythonDownloader | null = null;

export function getDownloader(): PortablePythonDownloader {
  if (!downloader) {
    downloader = new PortablePythonDownloader();
  }
  return downloader;
}

export async function ensurePortablePython(): Promise<string> {
  const dl = getDownloader();
  if (dl.isInstalled()) return dl.getPythonExecutable();
  return dl.download();
}