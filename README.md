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
npm install -g db2md
```

## Usage

```bash
db2md --db postgres --connection-string "postgresql://user:pass@localhost:5432/mydb"
```

Or run interactively:

```bash
db2md
```

### Options

| Flag | Description |
|------|-------------|
| `--db` | Database type: `postgres`, `mysql`, `mssql`, `sqlite`, `mongodb` |
| `--connection-string` | Full connection string (or path for SQLite) |
| `--output` | Output file path (default: `schema.md`) |
| `--ai` | Enable AI-generated overview via AWS Bedrock |

### Examples

```bash
# PostgreSQL
db2md --db postgres --connection-string "postgresql://user:pass@localhost:5432/mydb"

# MySQL
db2md --db mysql --connection-string "mysql://user:pass@localhost:3306/mydb"

# SQLite
db2md --db sqlite --connection-string "./database.sqlite"

# MongoDB
db2md --db mongodb --connection-string "mongodb://localhost:27017/mydb"

# With AI overview (requires AWS credentials)
db2md --db postgres --connection-string "..." --ai
```

## AI Overview (AWS Bedrock)

When `--ai` is enabled, `db2md` calls AWS Bedrock (Claude) to generate a plain-English description of your schema. Requires:

- AWS credentials configured (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
- Access to a Claude model in your AWS account

## Output

The generated Markdown file includes:

1. **AI Overview** *(optional)* — high-level description of the database purpose
2. **ER Diagram** — rendered via Mermaid
3. **Table/Collection Details** — columns, types, constraints, indexes

## Requirements

- Node.js >= 18

## License

MIT — [Nikhil Makwana](https://github.com/Nikhil-Cephei)
