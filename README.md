# db2md

Generate Markdown documentation from any database — ER diagrams, table details, and AI-powered overviews.

## Features

- **Multi-database support** — PostgreSQL, MySQL, MSSQL, SQLite, MongoDB
- **ER diagram** — Mermaid `erDiagram` showing relationships between tables/collections
- **Table details** — Column types, nullability, primary/foreign keys, indexes
- **AI overview** — Optional natural-language summary via AWS Bedrock (Claude)
- **Interactive CLI** — Guided prompts if no flags are provided

## Install

```bash
npm install -g @nikhil-cephei/db2md
```

Or use directly without installing:

```bash
npx @nikhil-cephei/db2md
```

## Usage

```bash
db2md --type <db-type> --url "<connection-string>"
```

Or run interactively (prompts for all connection details):

```bash
db2md
```

### Connection Options

| Flag | Description |
|------|-------------|
| `--type <type>` | Database type: `postgres`, `mysql`, `mssql`, `sqlite`, `mongodb` |
| `--url <url>` | Full connection string (takes precedence over individual flags) |
| `--host <host>` | Database host (default: `localhost`) |
| `--port <port>` | Database port (default: varies by type) |
| `--db <name>` | Database name |
| `--user <user>` | Username |
| `--password <pass>` | Password |

### Output Options

| Flag | Description |
|------|-------------|
| `--output <dir>` | Output directory (default: `.`) |
| `--filename <name>` | Output filename (default: `db-schema.md`) |

### AI Options

| Flag | Description |
|------|-------------|
| `--context <text>` | Project context for a more accurate AI description |
| `--no-ai` | Skip AI analysis even if AWS credentials are set |

### Examples

```bash
# SQLite
db2md --type sqlite --url ./mydb.db

# PostgreSQL via connection string
db2md --type postgres --url "postgresql://user:pass@localhost:5432/mydb"

# MySQL with individual flags
db2md --type mysql --host localhost --db myapp --user root

# MSSQL
db2md --type mssql --url "mssql://user:pass@localhost:1433/mydb"

# MongoDB
db2md --type mongodb --url "mongodb://localhost:27017/mydb"

# Custom output directory with AI context
db2md --type postgres --url "..." --output ./docs --context "Healthcare SaaS"

# Disable AI even if credentials are configured
db2md --type postgres --url "..." --no-ai
```

## AI Overview (AWS Bedrock)

When AWS credentials are available, `db2md` automatically calls AWS Bedrock (Claude) to generate a plain-English description of your schema. Use `--context` to provide project background for a more accurate result.

### Configure credentials

```bash
db2md config set    # store credentials encrypted
db2md config show   # view stored credentials
db2md config clear  # remove all stored credentials
```

Credentials are stored encrypted on disk. Alternatively, set environment variables directly:

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | AWS region (default: `us-east-1`) |
| `BEDROCK_MODEL_ID` | Claude model ID (default: `anthropic.claude-3-5-sonnet-20241022-v2:0`) |

## Output

The generated Markdown file includes:

1. **AI Overview** *(if AWS credentials are available)* — high-level description of the database purpose and key features
2. **ER Diagram** — Mermaid diagram (also saved as a `.mmd` file alongside the Markdown)
3. **Table/Collection Details** — columns, types, constraints, indexes

## Requirements

- Node.js >= 18

## License

MIT — [Nikhil Makwana](https://github.com/Nikhil-Cephei)
