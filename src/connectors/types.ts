export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: { table: string; column: string };
  unique: boolean;
  defaultValue?: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount?: number;
}

export type DbType = 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'mssql';

export interface ConnectionConfig {
  type: DbType;
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}
