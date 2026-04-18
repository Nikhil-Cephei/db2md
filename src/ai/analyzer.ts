import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { TableInfo } from '../connectors/types.js';
import { getSecret } from '../config/store.js';

export interface AiAnalysis {
  overview: string;
  features: string;
}

const DEFAULT_MODEL = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

function resolveCredential(envKey: string): string | undefined {
  return process.env[envKey] ?? getSecret(envKey) ?? undefined;
}

export function isBedrockAvailable(): boolean {
  return !!(
    resolveCredential('AWS_ACCESS_KEY_ID') ||
    process.env.AWS_PROFILE ||
    process.env.AWS_ROLE_ARN
  );
}

export async function analyzeSchema(
  tables: TableInfo[],
  userContext?: string
): Promise<AiAnalysis | null> {
  if (!isBedrockAvailable()) return null;

  const accessKeyId = resolveCredential('AWS_ACCESS_KEY_ID');
  const secretAccessKey = resolveCredential('AWS_SECRET_ACCESS_KEY');
  const region = resolveCredential('AWS_REGION') ?? 'us-east-1';
  const modelId = resolveCredential('BEDROCK_MODEL_ID') ?? DEFAULT_MODEL;

  const client = new BedrockRuntimeClient({
    region,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });

  const schemaText = tables.map((t) => {
    const cols = t.columns.map((c) => {
      const flags = [
        c.primaryKey ? 'PK' : null,
        c.foreignKey ? `FK→${c.foreignKey.table}.${c.foreignKey.column}` : null,
        c.unique ? 'UNIQUE' : null,
        !c.nullable ? 'NOT NULL' : null,
      ].filter(Boolean).join(', ');
      return `    - ${c.name} (${c.type})${flags ? ` [${flags}]` : ''}`;
    }).join('\n');
    return `Table: ${t.name}${t.rowCount !== undefined ? ` (${t.rowCount} rows)` : ''}\n${cols}`;
  }).join('\n\n');

  const contextBlock = userContext
    ? `\nAdditional context provided by the user:\n${userContext}\n`
    : '';

  const prompt = `You are a senior software architect analyzing a database schema to document a project.

${contextBlock}
Here is the complete database schema:

${schemaText}

Please provide:

1. **Project Overview** (2-3 paragraphs): Describe what this application/system likely does based on the schema. Include the domain, main entities, and how they relate. Be concrete and specific.

2. **Possible Features** (bulleted list): List 8-15 features that this system likely supports based on the schema design. Each bullet should be a brief feature description.

Format your response exactly as:

## Project Overview
[your overview here]

## Possible Features
- [feature 1]
- [feature 2]
...`;

  const response = await client.send(new ConverseCommand({
    modelId,
    system: [{ text: 'You are a technical documentation assistant. Analyze database schemas and produce clear, accurate documentation. Be specific and avoid vague statements.' }],
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 1024 },
  }));

  const text = (response.output?.message?.content ?? [])
    .filter((b): b is { text: string } => b.text !== undefined)
    .map((b) => b.text)
    .join('');

  return parseAiResponse(text);
}

function parseAiResponse(text: string): AiAnalysis {
  const overviewMatch = text.match(/## Project Overview\n([\s\S]*?)(?=\n## |$)/);
  const featuresMatch = text.match(/## Possible Features\n([\s\S]*?)(?=\n## |$)/);

  return {
    overview: overviewMatch ? overviewMatch[1].trim() : text,
    features: featuresMatch ? featuresMatch[1].trim() : '',
  };
}
