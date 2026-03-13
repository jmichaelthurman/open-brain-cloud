---
layout: page
title: Getting Started
permalink: /getting-started/
---

# Getting Started

Deploy your own Open Brain Cloud instance in about 5 minutes. You need a few free accounts and one command to go live.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 22 | Check with `node --version` |
| [Fly CLI](https://fly.io/docs/flyctl/install/) | `brew install flyctl` on macOS |
| [Supabase account](https://supabase.com) | Free tier is sufficient |
| [Voyage AI API key](https://dash.voyageai.com) | Free tier includes generous credits |
| [OpenRouter API key](https://openrouter.ai/keys) | Fund with a few dollars; haiku-4 is cheap |

---

## Step 1 — Clone and install

```bash
git clone https://github.com/jmichaelthurman/open-brain-cloud
cd open-brain-cloud
npm install
```

---

## Step 2 — Apply Supabase migrations

Create a new project at [supabase.com](https://supabase.com), then open the **SQL Editor** and run the two migration files in order.

**Migration 1** — `supabase/migrations/001_schema.sql`

Creates the `thoughts` table with a `vector(512)` column, an HNSW index for fast cosine similarity search, and the `search_thoughts` SQL function.

**Migration 2** — `supabase/migrations/002_graph_linking.sql`

Creates the `thought_links` table with typed relations and cascade deletes.

After running both migrations, get your connection string:

**Supabase Dashboard → Settings → Database → Connection string → Transaction pooler** (use port 6543, not 5432)

The connection string looks like:

```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

---

## Step 3 — Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your actual values. Never commit this file — it is already in `.gitignore`.

```env
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
OPEN_BRAIN_API_KEY=<generate with: openssl rand -hex 32>
VOYAGE_API_KEY=<from dash.voyageai.com>
OPENROUTER_API_KEY=<from openrouter.ai/keys>
PORT=8080
```

Generate a strong API key with:

```bash
openssl rand -hex 32
```

This key gates all access to your server — treat it like a password.

---

## Step 4 — Deploy to Fly.io

```bash
fly auth login
fly apps create open-brain-cloud   # or choose your own app name
```

Set your secrets (Fly stores these encrypted and injects them as environment variables at runtime — they are never written to disk or the repo):

```bash
fly secrets set \
  DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
  OPEN_BRAIN_API_KEY="<your-OPEN_BRAIN_API_KEY>" \
  VOYAGE_API_KEY="<your-VOYAGE_API_KEY>" \
  OPENROUTER_API_KEY="<your-OPENROUTER_API_KEY>"
```

Deploy:

```bash
fly deploy
```

Verify the deployment:

```bash
curl https://open-brain-cloud.fly.dev/health
# {"ok":true}
```

If you used a different app name, replace `open-brain-cloud` in the URL with your app name.

---

## Step 5 — Configure your MCP clients

### Claude Code

Add to `.mcp.json` in your project root, or to `~/.claude/mcp.json` for global access:

```json
{
  "mcpServers": {
    "open-brain": {
      "type": "http",
      "url": "https://open-brain-cloud.fly.dev/mcp",
      "headers": {
        "Authorization": "Bearer <your-OPEN_BRAIN_API_KEY>"
      }
    }
  }
}
```

### Claude Desktop

Add the same block to `~/.claude/claude_desktop_config.json`.

### claude.ai (browser and mobile)

In claude.ai, go to **Settings → Integrations → Add MCP Server** and enter:

- **URL:** `https://open-brain-cloud.fly.dev/mcp`
- **Authentication:** Bearer token
- **Token:** `<your-OPEN_BRAIN_API_KEY>`

### iOS / iPadOS via Apple Shortcuts

Use the `POST /capture` REST endpoint — no MCP client required. See the [Mobile Capture guide](mobile) for step-by-step Shortcuts setup.

---

## Local development

```bash
npm run dev       # tsx watch — hot reload on file changes
npm run typecheck # TypeScript check without emit
npm run build     # compile to dist/
npm start         # run compiled output
```

The server starts on `http://localhost:8080` by default.

```bash
curl http://localhost:8080/health
# {"ok":true}

curl -X POST http://localhost:8080/capture \
  -H "Authorization: Bearer <your-OPEN_BRAIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"content": "test thought from local dev"}'
```

---

## Migrating from a local-first Open Brain instance

If you have an existing local Open Brain instance, use the backfill script to re-embed your thoughts with Voyage AI and migrate them to Supabase:

```bash
# Preview first (dry run)
OLD_DATABASE_URL="postgresql://localhost:5432/openbrain" \
tsx scripts/backfill_embeddings.ts --dry-run

# Run the migration
OLD_DATABASE_URL="postgresql://localhost:5432/openbrain" \
tsx scripts/backfill_embeddings.ts
```

The script processes thoughts in batches of 10 with a 200 ms delay to respect Voyage AI rate limits. Original `id` and `created_at` values are preserved.
