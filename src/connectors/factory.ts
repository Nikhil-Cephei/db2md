import { BaseConnector } from './base.js';
import { ConnectionConfig, DbType } from './types.js';

export function getConnector(config: ConnectionConfig): BaseConnector {
  switch (config.type) {
    case 'postgres': {
      const { PostgresConnector } = require('./postgres.js');
      return new PostgresConnector(config);
    }
    case 'mysql': {
      const { MySQLConnector } = require('./mysql.js');
      return new MySQLConnector(config);
    }
    case 'sqlite': {
      const { SQLiteConnector } = require('./sqlite.js');
      return new SQLiteConnector(config);
    }
    case 'mongodb': {
      const { MongoDBConnector } = require('./mongodb.js');
      return new MongoDBConnector(config);
    }
    case 'mssql': {
      const { MSSQLConnector } = require('./mssql.js');
      return new MSSQLConnector(config);
    }
    default:
      throw new Error(`Unsupported database type: ${(config as any).type}`);
  }
}

export const DB_TYPES: DbType[] = ['postgres', 'mysql', 'sqlite', 'mongodb', 'mssql'];
