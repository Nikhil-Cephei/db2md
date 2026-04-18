import sql from 'mssql';
import { BaseConnector } from './base';
import { ConnectionConfig, TableInfo, ColumnInfo } from './types';

export class MSSQLConnector extends BaseConnector {
  private pool!: sql.ConnectionPool;
  private dbName: string = '';

  constructor(private config: ConnectionConfig) {
    super();
  }

  async connect(): Promise<void> {
    const cfg: sql.config = this.config.url
      ? { connectionString: this.config.url } as any
      : {
          server: this.config.host ?? 'localhost',
          port: this.config.port ?? 1433,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
          options: { encrypt: true, trustServerCertificate: true },
        };

    this.pool = await sql.connect(cfg);
    const res = await this.pool.query('SELECT DB_NAME() AS db');
    this.dbName = res.recordset[0].db ?? this.config.database ?? 'unknown';
  }

  async disconnect(): Promise<void> {
    await this.pool.close();
  }

  getDatabaseName(): string {
    return this.dbName;
  }

  async getTables(): Promise<TableInfo[]> {
    const tableRes = await this.pool.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    const tables: TableInfo[] = [];

    for (const row of tableRes.recordset) {
      const tableName: string = row.TABLE_NAME;

      const colRes = await this.pool.request()
        .input('tbl', sql.NVarChar, tableName)
        .query(`
          SELECT
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.IS_NULLABLE,
            c.COLUMN_DEFAULT
          FROM INFORMATION_SCHEMA.COLUMNS c
          WHERE c.TABLE_NAME = @tbl
          ORDER BY c.ORDINAL_POSITION
        `);

      const pkRes = await this.pool.request()
        .input('tbl', sql.NVarChar, tableName)
        .query(`
          SELECT kcu.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          WHERE tc.TABLE_NAME = @tbl AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        `);

      const pkSet = new Set(pkRes.recordset.map((r: any) => r.COLUMN_NAME));

      const fkRes = await this.pool.request()
        .input('tbl', sql.NVarChar, tableName)
        .query(`
          SELECT
            col.name AS column_name,
            ref_tab.name AS ref_table,
            ref_col.name AS ref_column
          FROM sys.foreign_key_columns fkc
          JOIN sys.objects fk ON fkc.constraint_object_id = fk.object_id
          JOIN sys.tables tab ON fkc.parent_object_id = tab.object_id
          JOIN sys.columns col ON fkc.parent_object_id = col.object_id AND fkc.parent_column_id = col.column_id
          JOIN sys.tables ref_tab ON fkc.referenced_object_id = ref_tab.object_id
          JOIN sys.columns ref_col ON fkc.referenced_object_id = ref_col.object_id AND fkc.referenced_column_id = ref_col.column_id
          WHERE tab.name = @tbl
        `);

      const fkMap = new Map<string, { table: string; column: string }>();
      for (const fk of fkRes.recordset) {
        fkMap.set(fk.column_name, { table: fk.ref_table, column: fk.ref_column });
      }

      const countRes = await this.pool.request().query(`SELECT COUNT(*) AS cnt FROM [${tableName}]`);

      const columns: ColumnInfo[] = colRes.recordset.map((col: any) => ({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        nullable: col.IS_NULLABLE === 'YES',
        primaryKey: pkSet.has(col.COLUMN_NAME),
        foreignKey: fkMap.get(col.COLUMN_NAME),
        unique: false,
        defaultValue: col.COLUMN_DEFAULT ?? undefined,
      }));

      tables.push({
        name: tableName,
        columns,
        rowCount: countRes.recordset[0].cnt,
      });
    }

    return tables;
  }
}
