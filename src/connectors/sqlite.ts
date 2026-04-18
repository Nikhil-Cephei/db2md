import Database from 'better-sqlite3';
import path from 'path';
import { BaseConnector } from './base';
import { ConnectionConfig, TableInfo, ColumnInfo } from './types';

export class SQLiteConnector extends BaseConnector {
  private db!: Database.Database;
  private dbName: string = '';

  constructor(private config: ConnectionConfig) {
    super();
  }

  async connect(): Promise<void> {
    const filePath = this.config.url ?? this.config.database ?? ':memory:';
    this.db = new Database(filePath);
    this.dbName = path.basename(filePath, path.extname(filePath));
  }

  async disconnect(): Promise<void> {
    this.db.close();
  }

  getDatabaseName(): string {
    return this.dbName;
  }

  async getTables(): Promise<TableInfo[]> {
    const tableRows = this.db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string }[];

    const tables: TableInfo[] = [];

    for (const { name: tableName } of tableRows) {
      const colRows = this.db.prepare(`PRAGMA table_info("${tableName}")`).all() as {
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }[];

      const fkRows = this.db.prepare(`PRAGMA foreign_key_list("${tableName}")`).all() as {
        from: string;
        table: string;
        to: string;
      }[];

      const fkMap = new Map<string, { table: string; column: string }>();
      for (const fk of fkRows) {
        fkMap.set(fk.from, { table: fk.table, column: fk.to });
      }

      const indexRows = this.db.prepare(`PRAGMA index_list("${tableName}")`).all() as {
        name: string;
        unique: number;
      }[];

      const uniqueCols = new Set<string>();
      for (const idx of indexRows) {
        if (idx.unique) {
          const idxInfo = this.db.prepare(`PRAGMA index_info("${idx.name}")`).all() as {
            name: string;
          }[];
          if (idxInfo.length === 1) uniqueCols.add(idxInfo[0].name);
        }
      }

      const countRow = this.db.prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"`).get() as { cnt: number };

      const columns: ColumnInfo[] = colRows.map((col) => ({
        name: col.name,
        type: col.type || 'TEXT',
        nullable: col.notnull === 0 && col.pk === 0,
        primaryKey: col.pk > 0,
        foreignKey: fkMap.get(col.name),
        unique: uniqueCols.has(col.name),
        defaultValue: col.dflt_value ?? undefined,
      }));

      tables.push({
        name: tableName,
        columns,
        rowCount: countRow.cnt,
      });
    }

    return tables;
  }
}
