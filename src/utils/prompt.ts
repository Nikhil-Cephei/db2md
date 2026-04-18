import { select, input, password, confirm } from '@inquirer/prompts';
import { ConnectionConfig, DbType } from '../connectors/types.js';
import { DB_TYPES } from '../connectors/factory.js';

export async function promptConnectionConfig(partial: Partial<ConnectionConfig>): Promise<ConnectionConfig> {
  const type: DbType = partial.type ?? await select({
    message: 'Select database type:',
    choices: DB_TYPES.map((t) => ({ value: t, name: t })),
  });

  if (type === 'sqlite') {
    const url = partial.url ?? await input({
      message: 'SQLite file path:',
      default: './database.db',
    });
    return { type, url };
  }

  if (partial.url) {
    return { type, url: partial.url };
  }

  const useUrl = await confirm({
    message: 'Use a connection string (URL)?',
    default: false,
  });

  if (useUrl) {
    const url = await input({ message: 'Connection URL:' });
    return { type, url };
  }

  const host = partial.host ?? await input({ message: 'Host:', default: 'localhost' });
  const port = partial.port ?? parseInt(
    await input({
      message: 'Port:',
      default: defaultPort(type).toString(),
    }),
    10
  );
  const database = partial.database ?? await input({ message: 'Database name:' });
  const user = partial.user ?? await input({ message: 'Username:' });
  const pw = partial.password ?? await password({ message: 'Password:' });

  return { type, host, port, database, user, password: pw };
}

function defaultPort(type: DbType): number {
  switch (type) {
    case 'postgres': return 5432;
    case 'mysql': return 3306;
    case 'mongodb': return 27017;
    case 'mssql': return 1433;
    default: return 5432;
  }
}
