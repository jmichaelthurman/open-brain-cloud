---
layout: page
title: Architecture
permalink: /architecture/
---

# Architecture

A technical deep-dive into system components, design decisions, and the API surface.

---

## System components

```
MCP Clients (Claude Code · claude.ai desktop · claude.ai mobile · iOS Shortcuts)
        │
        │  HTTPS  Authorization: Bearer $OPEN_BRAIN_API_KEY
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Fly.io MCP Server  (Node.js/TypeScript)                        │
│                                                                  │
│  ┌──────────────────────┐  ┌────────────────────────────────┐   │
│  │  /mcp endpoint       │  │  /capture endpoint (REST)      │   │
│  │  StreamableHTTP      │  │  POST — for non-MCP clients    │   │
│  │  ServerTransport     │  │  (iOS Shortcuts, curl, etc.)   │   │
│  └──────────────────────┘  └────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tool registry (6 tools)                                 │   │
│  │  capture_thought · search_thoughts · list_recent         │   │
│  │  link_thoughts · get_links · stats                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
  Supabase Postgres     Voyage AI           OpenRouter
  (pgvector HNSW)       (voyage-3-lite      (claude-haiku-4
  thoughts table        512-dim embeddings) metadata extraction)
  thought_links table
```

---

## Data flow — capture

1. Client sends `capture_thought` (MCP) or `POST /capture` (REST) with `content` text.
2. The server fires two requests in parallel:
   - Voyage AI: embed `content` → 512-dimensional float vector
   - OpenRouter/claude-haiku-4: extract `{ people, topics, action_items }` from `content`
3. Explicit metadata from the client is merged with extracted metadata (client values take precedence; extracted values fill gaps without duplication).
4. The thought is written to Supabase: `id`, `content`, `embedding`, `people`, `topics`, `action_items`, `source`, `created_at`.
5. A similarity search runs immediately against the new embedding at threshold 0.5 to find up to 5 existing related thoughts.
6. The response returns `{ id, suggested_links[] }`. The client can call `link_thoughts` for any suggested link it wants to confirm.

## Data flow — search

1. Client sends `search_thoughts` with a natural language `query`.
2. The server embeds the query with Voyage AI (same model, same 512-dim space).
3. Supabase runs the `search_thoughts` SQL function, which uses the HNSW index to compute cosine similarity: `1 - (embedding <=> query_embedding)`.
4. Results above `threshold` (default 0.3) are returned ordered by descending similarity.

---

## Database schema

### `thoughts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key, `gen_random_uuid()` |
| `content` | TEXT | The captured text |
| `embedding` | vector(512) | Voyage AI voyage-3-lite embedding |
| `people` | TEXT[] | Extracted + explicit people mentions |
| `topics` | TEXT[] | Extracted + explicit topic tags |
| `action_items` | TEXT[] | Extracted + explicit action items |
| `source` | TEXT | Origin label (e.g. `claude-code`, `ios-shortcut`) |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |

HNSW index: `m=16, ef_construction=64`, cosine distance operator.

### `thought_links`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `from_id` | UUID | FK → thoughts, CASCADE DELETE |
| `to_id` | UUID | FK → thoughts, CASCADE DELETE |
| `relation` | TEXT | One of 7 enum values (see below) |
| `note` | TEXT | Optional edge annotation |
| `is_manual` | BOOLEAN | `true` when confirmed by a human |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |

Unique constraint: `(from_id, to_id, relation)` — prevents duplicate edges of the same type.

Relation types: `related` · `supports` · `contradicts` · `follows_from` · `part_of` · `example_of` · `references`

---

## Technology choices

### Fly.io over Supabase Edge Functions

The MCP SDK's `StreamableHTTPServerTransport` is a Node.js-native class. Running it in Supabase Edge Functions (Deno) would require a full JSON-RPC reimplementation from scratch. Fly.io runs the same Node.js Docker image used locally with no translation layer.

Fly also provides persistent long-lived connections, which MCP's streaming transport requires.

### Supabase + pgvector

Supabase is managed Postgres — no separate vector database to operate. `pgvector` with an HNSW index gives sub-millisecond approximate nearest-neighbor search at the scale of a personal knowledge base (tens of thousands of rows). The free tier is more than sufficient.

The Supabase transaction pooler (port 6543) is required for serverless/edge deployments. The standard port 5432 uses session-mode pooling that does not work well with short-lived server processes.

### Voyage AI `voyage-3-lite`

- 512-dimensional vectors (vs 1536 for OpenAI `text-embedding-3-small`) — smaller storage, faster index operations, no meaningful quality loss at this scale
- Approximately $0.02 per 1M tokens
- Optimized for retrieval tasks (asymmetric search: short queries against longer documents)

### OpenRouter for metadata extraction

Metadata extraction (people, topics, action items) is best-effort enrichment — a failure never blocks a capture. OpenRouter provides model flexibility: if a cheaper or better model becomes available, changing one environment variable is all that is needed. The current default is `claude-haiku-4` via OpenRouter.

---

## Key implementation notes

### Supabase pooler URL parsing

The Supabase transaction pooler connection string uses a dotted username format: `postgres.[project-ref]`. The standard `pg` URL parser treats the dot as a host separator. The server parses the connection string manually to preserve the full username before constructing the `Pool` config, avoiding silent connection failures.

### stdio proxy for local development

Claude Code's MCP client communicates over stdio by default. During local development, a lightweight proxy bridges the stdio transport to the HTTP server's `/mcp` endpoint. This allows testing with a real Claude client without deploying.

### Input validation on `/capture`

The REST endpoint applies layered input validation before any upstream API calls:

- `Content-Type` must be `application/json` (415 if not)
- Body size limit: 1 MB (413 if exceeded)
- `content` field: required string, max 50,000 characters
- `people`, `topics`, `action_items` arrays: max 50 elements each, max 500 characters per element

---

## API reference

### `GET /health`

Liveness probe. No authentication required.

**Response 200:**
```json
{"ok": true}
```

---

### `POST /mcp`

MCP protocol endpoint. All MCP tool calls are routed through here.

**Headers required:**
```
Authorization: Bearer <your-OPEN_BRAIN_API_KEY>
Content-Type: application/json
```

Implements the [Model Context Protocol](https://modelcontextprotocol.io) using `StreamableHTTPServerTransport`. The request body is a JSON-RPC 2.0 message.

---

### `POST /capture`

REST capture endpoint for non-MCP clients (iOS Shortcuts, scripts, webhooks).

**Headers required:**
```
Authorization: Bearer <your-OPEN_BRAIN_API_KEY>
Content-Type: application/json
```

**Request body:**
```json
{
  "content": "The thought or note to capture",
  "source": "ios-shortcut",
  "people": ["Alice", "Bob"],
  "topics": ["project-x", "design"],
  "action_items": ["follow up by Friday"]
}
```

Only `content` is required. All other fields are optional.

**Response 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "suggested_links": [
    {
      "thought_id": "...",
      "content": "A semantically similar existing thought",
      "similarity": 0.82
    }
  ]
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Missing or empty `content`, invalid JSON, content too long |
| 401 | Missing or invalid `Authorization` header |
| 413 | Request body exceeds 1 MB |
| 415 | `Content-Type` is not `application/json` |

---

## Security

- All endpoints (except `/health`) require a valid `Authorization: Bearer` header
- `OPEN_BRAIN_API_KEY` is validated at server startup — a missing key prevents the process from starting
- Secrets are managed via `fly secrets` and injected as environment variables; they are never written to the filesystem or the repository
- Supabase connection uses SSL (`rejectUnauthorized: false` for Supabase pooler CA compatibility)
- The `/capture` endpoint applies strict input bounds before making any upstream API calls to prevent abuse
