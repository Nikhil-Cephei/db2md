import { TableInfo } from './types';

export abstract class BaseConnector {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getTables(): Promise<TableInfo[]>;
  abstract getDatabaseName(): string;
}
