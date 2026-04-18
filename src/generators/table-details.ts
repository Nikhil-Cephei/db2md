import { TableInfo } from '../connectors/types.js';

export function generateTableDetails(tables: TableInfo[]): string {
  const sections: string[] = [];

  for (const table of tables) {
    const rowInfo = table.rowCount !== undefined ? ` *(${table.rowCount.toLocaleString()} rows)*` : '';
    const lines: string[] = [`### \`${table.name}\`${rowInfo}`, ''];

    lines.push('| Column | Type | Nullable | PK | FK | Unique | Default |');
    lines.push('|--------|------|----------|----|----|--------|---------|');

    for (const col of table.columns) {
      const fk = col.foreignKey ? `→ \`${col.foreignKey.table}.${col.foreignKey.column}\`` : '';
      lines.push(
        `| \`${col.name}\` | \`${col.type}\` | ${bool(col.nullable)} | ${bool(col.primaryKey)} | ${fk} | ${bool(col.unique)} | ${col.defaultValue ?? ''} |`
      );
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

function bool(val: boolean): string {
  return val ? '✓' : '';
}
