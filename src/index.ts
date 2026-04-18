#!/usr/bin/env node
import { registerSignalHandlers } from './utils/shutdown.js';
import { run } from './cli.js';

registerSignalHandlers();

run(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
