import { BaseConnector } from './base';
import { ConnectionConfig, DbType } from './types';

export function getConnector(config: ConnectionConfig): BaseConnector {
  switch (config.type) {
    case 'postgres': {
      const { PostgresConnector } = require('./postgres');
      return new PostgresConnector(config);
    }
    case 'mysql': {
      const { MySQLConnector } = require('./mysql');
      return new MySQLConnector(config);
    }
    case 'sqlite': {
      const { SQLiteConnector } = require('./sqlite');
      return new SQLiteConnector(config);
    }
    case 'mongodb': {
      const { MongoDBConnector } = require('./mongodb');
      return new MongoDBConnector(config);
    }
    case 'mssql': {
      const { MSSQLConnector } = require('./mssql');
      return new MSSQLConnector(config);
    }
    default:
      throw new Error(`Unsupported database type: ${(config as any).type}`);
  }
}

export const DB_TYPES: DbType[] = ['postgres', 'mysql', 'sqlite', 'mongodb', 'mssql'];
