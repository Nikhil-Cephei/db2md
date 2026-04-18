import { Command } from 'commander';
import { input, password, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { setSecret, getSecret, clearAll, getConfigDir } from './store';

const CREDENTIALS = [
  { key: 'AWS_ACCESS_KEY_ID',     label: 'AWS Access Key ID',  sensitive: false },
  { key: 'AWS_SECRET_ACCESS_KEY', label: 'AWS Secret Access Key', sensitive: true },
  { key: 'AWS_REGION',            label: 'AWS Region',          sensitive: false, default: 'us-east-1' },
  { key: 'BEDROCK_MODEL_ID',      label: 'Bedrock Model ID',    sensitive: false, default: 'anthropic.claude-3-5-sonnet-20241022-v2:0' },
] as const;

export function registerConfigCommand(program: Command): void {
  const cmd = program.command('config').description('Manage AI credentials');

  cmd
    .command('set')
    .description('Configure AWS Bedrock credentials (stored encrypted)')
    .action(async () => {
      console.log(chalk.bold('\n  Configure AWS Bedrock credentials'));
      console.log(chalk.gray(`  Stored encrypted at: ${getConfigDir()}\n`));

      for (const cred of CREDENTIALS) {
        const current = getSecret(cred.key);
        const hint = current
          ? chalk.gray(`current: ${cred.sensitive ? '••••' + current.slice(-4) : current}`)
          : chalk.gray('not set');

        const val = cred.sensitive
          ? await password({ message: `${cred.label} (${hint}):`, mask: '*' })
          : await input({
              message: `${cred.label} (${hint}):`,
              default: current ?? ('default' in cred ? cred.default : undefined),
            });

        if (val) setSecret(cred.key, val);
      }

      console.log('\n' + chalk.green('  ✓ Credentials saved securely\n'));
    });

  cmd
    .command('show')
    .description('Show stored credentials')
    .action(() => {
      console.log(chalk.bold('\n  Stored credentials'));
      console.log(chalk.gray(`  Location: ${getConfigDir()}\n`));

      let any = false;
      for (const cred of CREDENTIALS) {
        const val = getSecret(cred.key);
        if (val) {
          const display = cred.sensitive ? '••••' + val.slice(-4) : val;
          console.log(`  ${chalk.yellow(cred.key.padEnd(26))} ${display}`);
          any = true;
        }
      }

      if (!any) {
        console.log(chalk.gray('  No credentials stored. Run `db2md config set` to configure.'));
      }
      console.log();
    });

  cmd
    .command('clear')
    .description('Remove all stored credentials')
    .action(async () => {
      const ok = await confirm({ message: 'Remove all stored credentials?', default: false });
      if (ok) {
        clearAll();
        console.log(chalk.green('\n  ✓ Credentials cleared\n'));
      }
    });
}
