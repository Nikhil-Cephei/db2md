import { MongoClient, Db } from 'mongodb';
import { BaseConnector } from './base';
import { ConnectionConfig, TableInfo, ColumnInfo } from './types';

export class MongoDBConnector extends BaseConnector {
  private client!: MongoClient;
  private db!: Db;
  private dbName: string = '';

  constructor(private config: ConnectionConfig) {
    super();
  }

  async connect(): Promise<void> {
    const url = this.config.url ?? buildMongoUrl(this.config);
    this.client = new MongoClient(url);
    await this.client.connect();

    const dbName = this.config.database ?? extractDbFromUrl(url) ?? 'test';
    this.db = this.client.db(dbName);
    this.dbName = dbName;
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  getDatabaseName(): string {
    return this.dbName;
  }

  async getTables(): Promise<TableInfo[]> {
    const collections = await this.db.listCollections().toArray();
    const tables: TableInfo[] = [];

    for (const col of collections) {
      const collectionName = col.name;
      const collection = this.db.collection(collectionName);

      const sampleDocs = await collection.find({}).limit(20).toArray();
      const rowCount = await collection.countDocuments();

      const fieldTypes = new Map<string, Set<string>>();
      for (const doc of sampleDocs) {
        flattenDoc(doc, '', fieldTypes);
      }

      const columns: ColumnInfo[] = Array.from(fieldTypes.entries()).map(([name, types]) => ({
        name,
        type: Array.from(types).join(' | '),
        nullable: true,
        primaryKey: name === '_id',
        unique: name === '_id',
      }));

      tables.push({ name: collectionName, columns, rowCount });
    }

    return tables;
  }
}

function flattenDoc(doc: Record<string, unknown>, prefix: string, map: Map<string, Set<string>>): void {
  for (const [key, val] of Object.entries(doc)) {
    if (key === '__v') continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const type = val === null ? 'null' : Array.isArray(val) ? 'array' : typeof val;
    if (!map.has(fullKey)) map.set(fullKey, new Set());
    map.get(fullKey)!.add(type);

    if (type === 'object' && val !== null && !Array.isArray(val)) {
      flattenDoc(val as Record<string, unknown>, fullKey, map);
    }
  }
}

function buildMongoUrl(config: ConnectionConfig): string {
  const auth = config.user ? `${config.user}:${config.password}@` : '';
  const host = config.host ?? 'localhost';
  const port = config.port ?? 27017;
  const db = config.database ?? 'test';
  return `mongodb://${auth}${host}:${port}/${db}`;
}

function extractDbFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, '') || null;
  } catch {
    return null;
  }
}
