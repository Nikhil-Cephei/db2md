import { Client } from 'pg';
import { BaseConnector } from './base';
import { ConnectionConfig, TableInfo, ColumnInfo } from './types';

export class PostgresConnector extends BaseConnector {
  private client: Client;
  private dbName: string = '';

  constructor(private config: ConnectionConfig) {
    super();
    this.client = config.url
      ? new Client({ connectionString: config.url })
      : new Client({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          ssl: { rejectUnauthorized: false },
        });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    const res = await this.client.query('SELECT current_database()');
    this.dbName = res.rows[0].current_database;
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  getDatabaseName(): string {
    return this.dbName;
  }

  async getTables(): Promise<TableInfo[]> {
    const tablesRes = await this.client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables: TableInfo[] = [];

    for (const row of tablesRes.rows) {
      const tableName: string = row.table_name;

      const colsRes = await this.client.query(`
        SELECT
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key,
          CASE WHEN uq.column_name IS NOT NULL THEN true ELSE false END AS is_unique
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          WHERE tc.table_name = $1 AND tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON pk.column_name = c.column_name
        LEFT JOIN (
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          WHERE tc.table_name = $1 AND tc.table_schema = 'public' AND tc.constraint_type = 'UNIQUE'
        ) uq ON uq.column_name = c.column_name
        WHERE c.table_name = $1 AND c.table_schema = 'public'
        ORDER BY c.ordinal_position
      `, [tableName]);

      const fkRes = await this.client.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.table_name = $1 AND tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
      `, [tableName]);

      const fkMap = new Map<string, { table: string; column: string }>();
      for (const fk of fkRes.rows) {
        fkMap.set(fk.column_name, { table: fk.foreign_table_name, column: fk.foreign_column_name });
      }

      const countRes = await this.client.query(`SELECT COUNT(*) FROM "${tableName}"`);

      const columns: ColumnInfo[] = colsRes.rows.map((col) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        primaryKey: col.is_primary_key,
        foreignKey: fkMap.get(col.column_name),
        unique: col.is_unique,
        defaultValue: col.column_default ?? undefined,
      }));

      tables.push({
        name: tableName,
        columns,
        rowCount: parseInt(countRes.rows[0].count, 10),
      });
    }

    return tables;
  }
}
