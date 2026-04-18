import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { ConnectionConfig, DbType } from './connectors/types.js';
import { getConnector, DB_TYPES } from './connectors/factory.js';
import { promptConnectionConfig } from './utils/prompt.js';
import { spin, succeed, fail, warn, info, printBanner, printSuccess } from './utils/spinner.js';
import { generateErDiagram } from './generators/er-diagram.js';
import { generateTableDetails } from './generators/table-details.js';
import { assembleMarkdown } from './generators/markdown.js';
import { analyzeSchema, isBedrockAvailable } from './ai/analyzer.js';
import { registerConfigCommand } from './config/command.js';
import { onShutdown, removeShutdown } from './utils/shutdown.js';

function printHelp(): void {
  const b = chalk.bold;
  const c = chalk.cyan;
  const g = chalk.gray;
  const y = chalk.yellow;

  console.log(`
${b.cyan('  db2md')} ${g('v0.1.0')} — ${g('Database → Markdown')}

${b('USAGE')}

  ${c('npx db2md')} ${g('[options]')}

${b('CONNECTION')}

  ${y('--type')}     ${g('<type>')}    DB type: ${DB_TYPES.map((t) => c(t)).join(g(' | '))}
  ${y('--url')}      ${g('<url>')}     Connection string ${g('(takes precedence over flags)')}
  ${y('--host')}     ${g('<host>')}    Host               ${g('default: localhost')}
  ${y('--port')}     ${g('<port>')}    Port               ${g('default: varies by type')}
  ${y('--db')}       ${g('<name>')}    Database name
  ${y('--user')}     ${g('<user>')}    Username
  ${y('--password')} ${g('<pass>')}    Password

${b('OUTPUT')}

  ${y('--output')}   ${g('<dir>')}     Output directory   ${g('default: .')}
  ${y('--filename')} ${g('<name>')}    Output filename    ${g('default: db-schema.md')}

${b('AI')}

  ${y('--context')}  ${g('<text>')}    Pre-context about the project for a more accurate AI description
  ${y('--no-ai')}               Skip AI analysis ${g('(even if AWS_ACCESS_KEY_ID is set)')}

${b('CONFIG')}

  ${c('npx db2md config set')}   Configure AWS Bedrock credentials ${g('(stored encrypted)')}
  ${c('npx db2md config show')}  Show stored credentials
  ${c('npx db2md config clear')} Remove all stored credentials

${b('OTHER')}

  ${y('-v, --version')}          Show version
  ${y('-h, --help')}             Show this help
  ${y('help')}                   Show this help ${g('(subcommand alias)')}

${b('EXAMPLES')}

  ${g('# SQLite')}
  ${c('npx db2md')} --type sqlite --url ./mydb.db

  ${g('# PostgreSQL via connection string')}
  ${c('npx db2md')} --type postgres --url "postgresql://user:pass@localhost/mydb"

  ${g('# MySQL with individual flags')}
  ${c('npx db2md')} --type mysql --host localhost --db myapp --user root

  ${g('# Custom output directory + AI context')}
  ${c('npx db2md')} --type postgres --url "..." --output ./docs --context "Healthcare SaaS"

  ${g('# Interactive mode (prompts for all connection details)')}
  ${c('npx db2md')}
`);
}

export async function run(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  if (args.includes('help') || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args[0] === 'config') {
    const program = new Command().name('db2md').helpOption(false);
    registerConfigCommand(program);
    await program.parseAsync(argv);
    return;
  }

  const program = new Command();

  program
    .name('db2md')
    .description('Generate Markdown documentation from any database schema')
    .version('0.1.0', '-v, --version', 'Show version')
    .helpOption(false)
    .option('--type <type>', `Database type: ${DB_TYPES.join(' | ')}`)
    .option('--url <url>', 'Connection string (takes precedence over individual flags)')
    .option('--host <host>', 'Database host')
    .option('--port <port>', 'Database port', parseInt as any)
    .option('--db <name>', 'Database name')
    .option('--user <user>', 'Database username')
    .option('--password <pass>', 'Database password')
    .option('--context <text>', 'Pre-context about your project for better AI description')
    .option('--output <dir>', 'Output directory', '.')
    .option('--filename <name>', 'Output filename', 'db-schema.md')
    .option('--no-ai', 'Skip AI analysis even if AWS_ACCESS_KEY_ID is set')
    .parse(argv);

  const opts = program.opts();

  printBanner();

  const partial: Partial<ConnectionConfig> = {
    type: opts.type as DbType | undefined,
    url: opts.url,
    host: opts.host,
    port: opts.port,
    database: opts.db,
    user: opts.user,
    password: opts.password,
  };

  const needsPrompt = !partial.type || (!partial.url && !partial.host && partial.type !== 'sqlite');
  const config: ConnectionConfig = needsPrompt
    ? await promptConnectionConfig(partial)
    : (partial as ConnectionConfig);

  const connector = getConnector(config);
  const disconnectOnExit = async () => { try { await connector.disconnect(); } catch { /* ignore */ } };
  onShutdown(disconnectOnExit);

  spin('Connecting to database…');
  try {
    await connector.connect();
    succeed(`Connected to ${chalk.bold(connector.getDatabaseName())}`);
  } catch (err: any) {
    fail('Failed to connect to database');
    console.error('\n  ' + err.message + '\n');
    process.exit(1);
  }

  spin('Fetching schema…');
  let tables;
  try {
    tables = await connector.getTables();
    succeed(`Fetched ${tables.length} table${tables.length === 1 ? '' : 's'}`);
  } catch (err: any) {
    fail('Failed to fetch schema');
    console.error('\n  ' + err.message + '\n');
    await connector.disconnect();
    process.exit(1);
  }

  await connector.disconnect();
  removeShutdown(disconnectOnExit);

  if (tables.length === 0) {
    warn('No tables found in database. Nothing to document.');
    process.exit(0);
  }

  spin('Generating ER diagram…');
  const erDiagram = generateErDiagram(tables);
  succeed('ER diagram generated');

  spin('Generating table details…');
  const tableDetails = generateTableDetails(tables);
  succeed('Table details generated');

  let aiOverview: string | null = null;
  let aiFeatures: string | null = null;

  const skipAi = opts.ai === false;

  if (isBedrockAvailable() && !skipAi) {
    spin('Analyzing project with AI…');
    try {
      const analysis = await analyzeSchema(tables, opts.context);
      if (analysis) {
        aiOverview = analysis.overview;
        aiFeatures = analysis.features;
        succeed('AI analysis complete');
      }
    } catch (err: any) {
      fail('AI analysis failed (continuing without it)');
      info(err.message);
    }
  } else if (!isBedrockAvailable() && !skipAi) {
    info('No AWS credentials found — skipping AI analysis');
  }

  spin('Writing output…');
  const markdown = assembleMarkdown({
    dbName: connector.getDatabaseName(),
    tables,
    erDiagram,
    tableDetails,
    aiOverview,
    aiFeatures,
  });

  const outputDir = path.resolve(opts.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, opts.filename);
  fs.writeFileSync(outputPath, markdown, 'utf8');
  succeed('File written');

  printSuccess(outputPath);
}

