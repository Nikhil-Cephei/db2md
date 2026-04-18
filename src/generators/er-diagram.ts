import { TableInfo } from '../connectors/types';

export function generateErDiagram(tables: TableInfo[]): string {
  const lines: string[] = ['erDiagram'];

  for (const table of tables) {
    lines.push(`  ${sanitize(table.name)} {`);
    for (const col of table.columns) {
      const markers: string[] = [];
      if (col.primaryKey) markers.push('PK');
      if (col.foreignKey) markers.push('FK');
      const type = sanitizeType(col.type);
      const markerStr = markers.length ? ` "${markers.join(',')}"` : '';
      lines.push(`    ${type} ${sanitize(col.name)}${markerStr}`);
    }
    lines.push('  }');
  }

  const seen = new Set<string>();
  for (const table of tables) {
    for (const col of table.columns) {
      if (!col.foreignKey) continue;
      const key = `${table.name}__${col.foreignKey.table}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(
        `  ${sanitize(table.name)} }o--|| ${sanitize(col.foreignKey.table)} : "${col.name}"`
      );
    }
  }

  return lines.join('\n');
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitizeType(type: string): string {
  return type.replace(/[\s(),]/g, '_').replace(/\|/g, '_or_').substring(0, 30);
}
