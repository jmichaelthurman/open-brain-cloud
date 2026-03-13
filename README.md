# open-brain-cloud

A cloud-native MCP server for semantic knowledge capture and retrieval. Capture thoughts, decisions, and notes from any Claude client — they're embedded with vector similarity and linked into a knowledge graph.

**Stack:** Node.js/TypeScript · Fly.io · Supabase Postgres + pgvector · Voyage AI · OpenRouter (claude-haiku-4)

---

## How it works

1. `capture_thought` embeds your note with Voyage AI (`voyage-3-lite`, 512-dim) and extracts metadata (people, topics, action items) via claude-haiku-4.
2. Thoughts are stored in Supabase with an HNSW vector index for fast cosine similarity search.
3. On capture, similar existing thoughts are returned as `suggested_links` — confirm them with `link_thoughts` to build a typed knowledge graph.
4. Search from any device: Claude Code, claude.ai desktop, claude.ai mobile.

---

## Prerequisites

- [Fly.io account](https://fly.io) + `flyctl` installed
- [Supabase](https://supabase.com) project (free tier sufficient)
- [Voyage AI](https://www.voyageai.com) API key
- [OpenRouter](https://openrouter.ai) API key (fund with a few dollars)
- Node.js 18+

---

## Installation

### 1. Clone and install

```bash
git clone https://github.com/jmichaelthurman/open-brain-cloud
cd open-brain-cloud
npm install
```

### 2. Set up Supabase

In your Supabase project, open the **SQL Editor** and run the migrations in order:

```bash
# Run in Supabase SQL Editor:
supabase/migrations/001_schema.sql   # thoughts table, HNSW index, search function
supabase/migrations/002_graph_linking.sql  # thought_links table
```

Get your connection string from:
**Supabase Dashboard → Settings → Database → Connection string → Transaction pooler** (port 6543)

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
OPEN_BRAIN_API_KEY=<generate with: openssl rand -hex 32>
VOYAGE_API_KEY=<from dash.voyageai.com>
OPENROUTER_API_KEY=<from openrouter.ai/keys>
PORT=8080
```

### 4. Deploy to Fly.io

```env

```

```bash
fly auth login
fly apps create open-brain-cloud   # or your chosen app name

# Set secrets
fly secrets set \
  DATABASE_URL="..." \
  OPEN_BRAIN_API_KEY="..." \
  VOYAGE_API_KEY="..." \
  OPENROUTER_API_KEY="..."

fly deploy
```

```bash

```

```bash

```

```bash
  DATABASE_URL="..." \
  OPEN_BRAIN_API_KEY="..." \
  VOYAGE_API_KEY="..." \
  OPENROUTER_API_KEY="..."

fly deploy
```

Verify deployment:

```bash
curl https://open-brain-cloud.fly.dev/health
# {"ok":true}
```

### 5. Configure MCP client

Add to your Claude MCP config (`~/.claude/claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "open-brain": {
      "type": "http",
      "url": "https://open-brain-cloud.fly.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_OPEN_BRAIN_API_KEY"
      }
    }
  }
}
```

---

## MCP Tools

### `capture_thought`

Save a thought, decision, or note with automatic embedding and metadata extraction.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | ✓ | The thought or note to capture |
| `people` | string[] | | People mentioned (merged with extracted) |
| `topics` | string[] | | Topic tags (merged with extracted) |
| `action_items` | string[] | | Action items (merged with extracted) |
| `source` | string | | Source label (default: `claude-code`) |

Returns: `{ id, suggested_links[] }` — suggested_links are semantically similar thoughts for you to link manually.

---

### `search_thoughts`

Semantic vector search across all captured thoughts.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | — | Natural language search query |
| `limit` | number | `5` | Max results (1–20) |
| `threshold` | number | `0.3` | Minimum similarity score (0–1) |

Returns: array of thoughts ranked by cosine similarity, each with a `similarity` score.

---

### `list_recent`

List the most recently captured thoughts.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | `10` | Number to return (1–50) |

---

### `link_thoughts`

Create a typed directional link between two thoughts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_id` | UUID | ✓ | Source thought ID |
| `to_id` | UUID | ✓ | Target thought ID |
| `relation` | enum | ✓ | See relation types below |
| `note` | string | | Optional edge annotation |

__Relation types:__ `related` · `supports` · `contradicts` · `follows_from` · `part_of` · `example_of` · `references`

---

### `get_links`

Retrieve all thoughts linked to a given thought.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `id` | UUID | — | Thought ID |
| `direction` | `from\|to\|both` | `both` | Link direction to traverse |

Returns: array of links, each including the `linked_thought` object.

---

### `stats`

Get aggregate statistics.

Returns: `{ total_thoughts, total_links, by_source[], oldest, newest }`

---

## Local development

```bash
npm run dev       # tsx watch — hot reload
npm run typecheck # TypeScript check without emit
npm run build     # compile to dist/
npm start         # run compiled output
```

Health check: `curl http://localhost:8080/health`

MCP endpoint: `POST http://localhost:8080/mcp` with `Authorization: Bearer $OPEN_BRAIN_API_KEY`

---

## Migrating from the local-first repo

If you have an existing local Open Brain instance, use the backfill script to re-embed your thoughts with Voyage AI and migrate to Supabase:

```bash
OLD_DATABASE_URL="postgresql://localhost:5432/openbrain" \
tsx scripts/backfill_embeddings.ts --dry-run   # preview first

OLD_DATABASE_URL="postgresql://localhost:5432/openbrain" \
tsx scripts/backfill_embeddings.ts             # run migration
```

The script batches in groups of 10 with a 200ms delay to respect Voyage rate limits. Original `id` and `created_at` values are preserved.

---

## Architecture

```ini
MCP Clients (Claude Code · claude.ai desktop · claude.ai mobile)
        │
        │  HTTPS  Authorization: Bearer $OPEN_BRAIN_API_KEY
        ▼
  Fly.io MCP Server  (Node.js 18+, StreamableHTTPServerTransport)
        │
        ├──► Supabase Postgres  (thoughts + thought_links, pgvector HNSW)
        ├──► Voyage AI          (voyage-3-lite, 512-dim embeddings)
        └──► OpenRouter         (claude-haiku-4, metadata extraction)
```

**Why Fly.io over Supabase Edge Functions:** The MCP SDK's `StreamableHTTPServerTransport` is Node.js-specific and won't run in Deno without a full JSON-RPC reimplementation.

**Why Voyage `voyage-3-lite`:** 512-dim vectors, ~$0.02/1M tokens, optimized for retrieval tasks.

**Why OpenRouter for metadata:** Model flexibility and cost optimization. Metadata extraction is best-effort — a failure never blocks a capture.

---

## Security

- All endpoints require `Authorization: Bearer` header — no unauthenticated access
- `OPEN_BRAIN_API_KEY` is validated at server startup; missing key prevents boot
- Database SSL enforced (`rejectUnauthorized: false` for Supabase pooler compatibility)
- Secrets managed via `fly secrets` — never committed to the repo
