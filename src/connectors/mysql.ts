import mysql from 'mysql2/promise';
import { BaseConnector } from './base.js';
import { ConnectionConfig, TableInfo, ColumnInfo } from './types.js';

export class MySQLConnector extends BaseConnector {
  private connection!: mysql.Connection;
  private dbName: string = '';

  constructor(private config: ConnectionConfig) {
    super();
  }

  async connect(): Promise<void> {
    this.connection = this.config.url
      ? await mysql.createConnection(this.config.url!)
      : await mysql.createConnection({
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
        });

    const [rows] = await this.connection.query('SELECT DATABASE() as db') as any;
    this.dbName = rows[0].db ?? this.config.database ?? 'unknown';
  }

  async disconnect(): Promise<void> {
    await this.connection.end();
  }

  getDatabaseName(): string {
    return this.dbName;
  }

  async getTables(): Promise<TableInfo[]> {
    const [tableRows] = await this.connection.query(`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `) as any;

    const tables: TableInfo[] = [];

    for (const row of tableRows) {
      const tableName: string = row.TABLE_NAME;

      const [colRows] = await this.connection.query(`
        SELECT
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          c.COLUMN_DEFAULT,
          c.COLUMN_KEY
        FROM information_schema.COLUMNS c
        WHERE c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = ?
        ORDER BY c.ORDINAL_POSITION
      `, [tableName]) as any;

      const [fkRows] = await this.connection.query(`
        SELECT
          kcu.COLUMN_NAME,
          kcu.REFERENCED_TABLE_NAME,
          kcu.REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.TABLE_CONSTRAINTS tc
          ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
        WHERE kcu.TABLE_SCHEMA = DATABASE()
          AND kcu.TABLE_NAME = ?
          AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
      `, [tableName]) as any;

      const fkMap = new Map<string, { table: string; column: string }>();
      for (const fk of fkRows) {
        if (fk.REFERENCED_TABLE_NAME) {
          fkMap.set(fk.COLUMN_NAME, {
            table: fk.REFERENCED_TABLE_NAME,
            column: fk.REFERENCED_COLUMN_NAME,
          });
        }
      }

      const [[countRow]] = await this.connection.query(
        `SELECT COUNT(*) as cnt FROM \`${tableName}\``
      ) as any;

      const columns: ColumnInfo[] = colRows.map((col: any) => ({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        nullable: col.IS_NULLABLE === 'YES',
        primaryKey: col.COLUMN_KEY === 'PRI',
        foreignKey: fkMap.get(col.COLUMN_NAME),
        unique: col.COLUMN_KEY === 'UNI',
        defaultValue: col.COLUMN_DEFAULT ?? undefined,
      }));

      tables.push({
        name: tableName,
        columns,
        rowCount: parseInt(countRow.cnt, 10),
      });
    }

    return tables;
  }
}
