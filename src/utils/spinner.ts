import ora, { Ora } from 'ora';
import chalk from 'chalk';

let current: Ora | null = null;

export function spin(text: string): Ora {
  current = ora({ text, color: 'cyan' }).start();
  return current;
}

export function succeed(text: string): void {
  if (current) {
    current.succeed(chalk.green(text));
    current = null;
  }
}

export function fail(text: string): void {
  if (current) {
    current.fail(chalk.red(text));
    current = null;
  }
}

export function info(text: string): void {
  console.log(chalk.cyan('  ℹ ') + text);
}

export function warn(text: string): void {
  console.log(chalk.yellow('  ⚠ ') + text);
}

export function printBanner(): void {
  console.log(chalk.bold.cyan('\n  db2md') + chalk.gray(' — Database → Markdown\n'));
}

export function printSuccess(filePath: string): void {
  console.log('\n' + chalk.bold.green('  ✓ Done!') + ' Output written to:\n');
  console.log('  ' + chalk.underline(filePath) + '\n');
}
