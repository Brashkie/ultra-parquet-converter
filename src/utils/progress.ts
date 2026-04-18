/**
 * Progress Bar Utilities
 * Progress bars profesionales para CLI
 */

import cliProgress from 'cli-progress';
import chalk from 'chalk';

export class ProgressBar {
  private bar: cliProgress.SingleBar;
  private total: number;
  private current: number = 0;

  constructor(total: number, format?: string) {
    this.total = total;
    this.bar = new cliProgress.SingleBar({
      format: format || 'Progress |{bar}| {percentage}% | {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true
    });
    this.bar.start(total, 0);
  }

  update(value: number) {
    this.current = value;
    this.bar.update(value);
  }

  increment(step: number = 1) {
    this.current += step;
    this.bar.update(this.current);
  }

  stop() {
    this.bar.stop();
  }

  get value(): number {
    return this.current;
  }
}

export class MultiProgressBar {
  private multibar: cliProgress.MultiBar;
  private bars: Map<string, cliProgress.SingleBar> = new Map();

  constructor() {
    this.multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '{task} |{bar}| {percentage}% | {value}/{total}'
    });
  }

  addBar(name: string, total: number): cliProgress.SingleBar {
    const bar = this.multibar.create(total, 0, { task: name });
    this.bars.set(name, bar);
    return bar;
  }

  updateBar(name: string, value: number) {
    const bar = this.bars.get(name);
    if (bar) {
      bar.update(value);
    }
  }

  incrementBar(name: string, step: number = 1) {
    const bar = this.bars.get(name);
    if (bar) {
      bar.increment(step);
    }
  }

  stop() {
    this.multibar.stop();
  }
}

export class FileProgressBar {
  private bar: cliProgress.SingleBar;
  private startTime: number;
  private totalBytes: number;

  constructor(totalBytes: number, filename: string) {
    this.totalBytes = totalBytes;
    this.startTime = Date.now();

    this.bar = new cliProgress.SingleBar({
      format: `${chalk.cyan(filename)} |{bar}| {percentage}% | {downloadedMB}/{totalMB} MB | ETA: {eta}s | {speed} MB/s`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });

    const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
    this.bar.start(100, 0, {
      totalMB,
      downloadedMB: '0.00',
      speed: '0.00'
    });
  }

  update(downloadedBytes: number) {
    const percentage = Math.round((downloadedBytes / this.totalBytes) * 100);
    const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
    const elapsedSec = (Date.now() - this.startTime) / 1000;
    const speed = (downloadedBytes / 1024 / 1024 / elapsedSec).toFixed(2);

    this.bar.update(percentage, {
      downloadedMB,
      speed
    });
  }

  stop() {
    this.bar.stop();
  }
}

export class TaskProgressBar {
  private bar: cliProgress.SingleBar;
  private tasks: string[] = [];
  private completed: number = 0;

  constructor(taskNames: string[]) {
    this.tasks = taskNames;

    this.bar = new cliProgress.SingleBar({
      format: '{currentTask} |{bar}| {percentage}% | {completed}/{total} tasks',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });

    this.bar.start(taskNames.length, 0, {
      currentTask: taskNames[0] || '',
      completed: 0,
      total: taskNames.length
    });
  }

  completeTask(taskIndex: number) {
    this.completed++;
    const currentTask = this.tasks[taskIndex + 1] || 'Finalizado';

    this.bar.update(this.completed, {
      currentTask: chalk.green('✓ ') + currentTask,
      completed: this.completed
    });
  }

  stop() {
    this.bar.stop();
  }
}

export function createSpinner(text: string) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  const interval = setInterval(() => {
    process.stdout.write(`\r${chalk.cyan(frames[i])} ${text}`);
    i = (i + 1) % frames.length;
  }, 80);

  return {
    stop: (finalText?: string) => {
      clearInterval(interval);
      if (finalText) {
        process.stdout.write(`\r${finalText}\n`);
      } else {
        process.stdout.write('\r\x1b[K'); // Clear line
      }
    }
  };
}