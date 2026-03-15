---
layout: home
title: Open Brain Cloud
---

# Open Brain Cloud

A cloud-native personal AI memory system — capture thoughts from any Claude client, retrieve them semantically from anywhere.

Open Brain Cloud is an MCP server that runs on Fly.io and stores your knowledge in Supabase Postgres with pgvector. Every thought is embedded with Voyage AI and linked into a typed knowledge graph you build yourself.

---

## Architecture

```
MCP Clients (Claude Code · claude.ai desktop · claude.ai mobile · iOS Shortcuts)
        │
        │  HTTPS  Authorization: Bearer $OPEN_BRAIN_API_KEY
        ▼
  Fly.io MCP Server  (Node.js/TypeScript, StreamableHTTPServerTransport)
        │
        ├──► POST /mcp      — MCP protocol endpoint
        ├──► POST /capture  — REST endpoint for non-MCP clients
        ├──► GET  /health   — liveness probe
        │
        ├──► Supabase Postgres  (thoughts + thought_links tables, pgvector HNSW index)
        ├──► Voyage AI          (voyage-3-lite, 512-dim embeddings)
        └──► OpenRouter         (claude-haiku-4, metadata extraction)
```

---

## How it works

1. **Capture** — call `capture_thought` (or `POST /capture`) with your text. The server embeds it with Voyage AI and extracts people, topics, and action items via claude-haiku-4.
2. **Store** — the thought and its 512-dimensional embedding are written to Supabase. An HNSW index enables sub-millisecond cosine similarity search.
3. **Link** — on every capture, up to 5 semantically similar existing thoughts are returned as `suggested_links`. Confirm them with `link_thoughts` to build a typed knowledge graph.
4. **Retrieve** — call `search_thoughts` from any device. Results are ranked by cosine similarity with a configurable threshold.

---

## Quick links

| Page                               | What's there                                                       |
| ---------------------------------- | ------------------------------------------------------------------ |
| [Getting Started](getting-started) | Prerequisites, environment setup, Fly.io deploy, MCP client config |
| [Architecture](architecture)       | Component deep-dive, design decisions, API reference               |
| [MCP Tools](mcp-tools)             | All 6 tools with parameters, return values, and examples           |
| [Mobile Capture](mobile)           | iOS Shortcuts setup, `/capture` REST endpoint                      |

---

## Get started in 5 minutes

```bash
git clone https://github.com/jmichaelthurman/open-brain-cloud
cd open-brain-cloud
npm install
cp .env.example .env   # fill in your keys
fly deploy
```

Then add one block to your Claude config and every session has access to your full knowledge base. See the [Getting Started guide](getting-started) for the complete walkthrough.
