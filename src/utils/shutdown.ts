import chalk from 'chalk';
import { fail } from './spinner.js';

type Cleanup = () => Promise<void> | void;

const cleanups: Cleanup[] = [];
let shuttingDown = false;

export function onShutdown(fn: Cleanup): void {
  cleanups.push(fn);
}

export function removeShutdown(fn: Cleanup): void {
  const i = cleanups.indexOf(fn);
  if (i !== -1) cleanups.splice(i, 1);
}

async function handleSignal(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  process.stdout.write('\n');
  fail('Interrupted');
  console.log(chalk.gray(`\n  Received ${signal} — cleaning up…\n`));

  for (const fn of cleanups.reverse()) {
    try { await fn(); } catch { /* best effort */ }
  }

  process.exit(130);
}

export function registerSignalHandlers(): void {
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(sig, () => handleSignal(sig));
  }

  process.on('uncaughtException', (err) => {
    if (shuttingDown) return;
    fail('Unexpected error');
    console.error(chalk.red(`\n  ${err.message}\n`));
    process.exit(1);
  });
}
