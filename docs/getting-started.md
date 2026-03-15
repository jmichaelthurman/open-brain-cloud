---
layout: page
permalink: /getting-started/
title: Getting Started
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

__Migration 1__ — `supabase/migrations/001_schema.sql`

Creates the `thoughts` table with a `vector(512)` column, an HNSW index for fast cosine similarity search, and the `search_thoughts` SQL function.

__Migration 2__ — `supabase/migrations/002_graph_linking.sql`

Creates the `thought_links` table with typed relations and cascade deletes.

__Migration 3__ — `supabase/migrations/003_owner_id.sql`

Adds `owner_id` (UUID FK to `auth.users`) to both `thoughts` and `thought_links`. Run Step A first (adds nullable column), then create a service account user in the Supabase SQL editor (see issue #9 Step 1), backfill existing rows with that UUID (Step B), and finally enforce NOT NULL (Step C).

After running both migrations, get your connection string:

**Supabase Dashboard → Settings → Database → Connection string → Transaction pooler** (use port 6543, not 5432)

The connection string looks like:

```sh
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
SUPABASE_JWT_SECRET=<from Supabase Dashboard → Settings → API → JWT Secret>
SERVICE_ACCOUNT_USER_ID=<UUID returned by the service account INSERT in Migration 3>
PORT=8080
```

Generate a strong API key with:

```bash
openssl rand -hex 32
```

`OPEN_BRAIN_API_KEY` gates access for non-browser clients (iOS Shortcuts, scripts). Browser clients authenticate with Supabase JWTs instead. Both methods are accepted — see the [Architecture](architecture) page for details.

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
  OPENROUTER_API_KEY="<your-OPENROUTER_API_KEY>" \
  SUPABASE_JWT_SECRET="<your-SUPABASE_JWT_SECRET>" \
  SERVICE_ACCOUNT_USER_ID="<UUID from service account creation>"
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

Claude Desktop only supports stdio MCP servers, not HTTP. Use the bundled `proxy/stdio-proxy.ts` bridge, which forwards stdio ↔ remote HTTP:

```json
{
  "mcpServers": {
    "open-brain": {
      "command": "/path/to/node",
      "args": ["/path/to/open-brain-cloud/proxy/dist/stdio-proxy.js"],
      "env": {
        "OPEN_BRAIN_API_KEY": "<your-OPEN_BRAIN_API_KEY>",
        "OPEN_BRAIN_URL": "https://open-brain-cloud.fly.dev/mcp"
      }
    }
  }
}
```

Replace `/path/to/node` with the absolute path to your Node.js binary (e.g., `~/.asdf/installs/nodejs/22.2.0/bin/node`). Claude Desktop uses a stripped PATH — asdf/nvm shims are not visible; you must use the absolute install path.

Compile the proxy first if you have not already (run from the repo root):

```bash
npm run build:proxy
```

### claude.ai (browser and mobile)

In claude.ai, go to **Settings → Integrations → Add MCP Server** and enter:

- **URL:** `https://open-brain-cloud.fly.dev/mcp`
- **Authentication:** Bearer token
- __Token:__ `<your-OPEN_BRAIN_API_KEY>`

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
