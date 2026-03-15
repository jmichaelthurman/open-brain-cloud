---
layout: page
title: MCP Tools
permalink: /mcp-tools/
---

# MCP Tools Reference

Open Brain Cloud exposes 6 tools over the MCP protocol. All tools are available to any MCP client that connects to `https://open-brain-cloud.fly.dev/mcp` with a valid `Authorization: Bearer` header.

---

## Tool summary

| Tool                                  | Description                                                     |
| ------------------------------------- | --------------------------------------------------------------- |
| [`capture_thought`](#capture_thought) | Save a thought with automatic embedding and metadata extraction |
| [`search_thoughts`](#search_thoughts) | Semantic vector search across all captured thoughts             |
| [`list_recent`](#list_recent)         | List the most recently captured thoughts                        |
| [`link_thoughts`](#link_thoughts)     | Create a typed directional link between two thoughts            |
| [`get_links`](#get_links)             | Retrieve all thoughts linked to a given thought                 |
| [`stats`](#stats)                     | Get aggregate statistics                                        |

---

## `capture_thought`

Save a thought, decision, or note to Open Brain with semantic embeddings and metadata extraction.

The server embeds the content with Voyage AI and runs best-effort metadata extraction via claude-haiku-4 in parallel. Explicit metadata you provide takes precedence; extracted values fill gaps without duplication.

### Parameters

| Parameter      | Type     | Required | Default       | Description                                      |
| -------------- | -------- | -------- | ------------- | ------------------------------------------------ |
| `content`      | string   | Yes      | —             | The thought or note to capture (min 1 character) |
| `people`       | string[] | No       | `[]`          | People mentioned; merged with auto-extracted     |
| `topics`       | string[] | No       | `[]`          | Topic tags; merged with auto-extracted           |
| `action_items` | string[] | No       | `[]`          | Action items; merged with auto-extracted         |
| `source`       | string   | No       | `claude-code` | Origin label stored with the thought             |

### Return value

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "suggested_links": [
    {
      "thought_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "content": "An existing thought that is semantically similar",
      "similarity": 0.87
    }
  ]
}
```

`suggested_links` contains up to 5 existing thoughts with cosine similarity above 0.5. Call `link_thoughts` to confirm any connections you want to preserve.

### Example

```
capture_thought(
  content: "Decided to switch from OpenAI embeddings to Voyage AI — 512-dim vectors are smaller and Voyage is tuned for retrieval",
  topics: ["embeddings", "architecture"],
  action_items: ["update README with model rationale"]
)
```

---

## `search_thoughts`

Semantically search Open Brain for relevant thoughts using vector similarity.

The query is embedded with the same Voyage AI model used at capture time, then compared against all stored embeddings using cosine similarity via the Supabase HNSW index.

### Parameters

| Parameter   | Type   | Required | Default | Description                                      |
| ----------- | ------ | -------- | ------- | ------------------------------------------------ |
| `query`     | string | Yes      | —       | Natural language search query (min 3 characters) |
| `limit`     | number | No       | `5`     | Maximum number of results to return (1–20)       |
| `threshold` | number | No       | `0.3`   | Minimum similarity score to include (0–1)        |

### Return value

Array of thought objects, each with an added `similarity` field:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "content": "Decided to switch to Voyage AI embeddings...",
    "people": [],
    "topics": ["embeddings", "architecture"],
    "action_items": ["update README with model rationale"],
    "source": "claude-code",
    "created_at": "2025-03-10T14:22:00Z",
    "similarity": 0.91
  }
]
```

Results are ordered by descending similarity. An empty array means no thoughts exceeded the threshold.

### Example

```
search_thoughts(query: "why did we choose Voyage AI over OpenAI for embeddings", limit: 3)
```

**Tuning tips:**

- Lower `threshold` (e.g. `0.2`) to cast a wider net when you are exploring a topic broadly.
- Raise `threshold` (e.g. `0.5`) to return only highly relevant results.
- Increase `limit` to get more context before linking thoughts.

---

## `list_recent`

List the most recently captured thoughts in reverse chronological order.

### Parameters

| Parameter | Type   | Required | Default | Description                         |
| --------- | ------ | -------- | ------- | ----------------------------------- |
| `limit`   | number | No       | `10`    | Number of thoughts to return (1–50) |

### Return value

Array of thought objects ordered by `created_at` descending (same schema as `search_thoughts` results, without the `similarity` field).

### Example

```
list_recent(limit: 5)
```

---

## `link_thoughts`

Create a typed directional link between two thoughts.

Links form the edges of the knowledge graph. Every link has a `relation` type that describes how the source thought relates to the target thought. Links are directional: `from_id` → `to_id`.

### Parameters

| Parameter  | Type   | Required | Description                                    |
| ---------- | ------ | -------- | ---------------------------------------------- |
| `from_id`  | UUID   | Yes      | Source thought ID                              |
| `to_id`    | UUID   | Yes      | Target thought ID                              |
| `relation` | enum   | Yes      | Relationship type (see below)                  |
| `note`     | string | No       | Optional annotation to add context to the edge |

### Relation types

| Relation       | Meaning                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| `related`      | General semantic relationship — the default when nothing more specific fits |
| `supports`     | `from` provides evidence or reinforcement for `to`                          |
| `contradicts`  | `from` conflicts with or refutes `to`                                       |
| `follows_from` | `from` is a logical consequence or conclusion drawn from `to`               |
| `part_of`      | `from` is a component, sub-topic, or detail of `to`                         |
| `example_of`   | `from` is a concrete instance or illustration of `to`                       |
| `references`   | `from` cites, links to, or quotes `to`                                      |

### Return value

```json
{
  "success": true,
  "from_id": "550e8400-e29b-41d4-a716-446655440000",
  "to_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "relation": "supports"
}
```

### Example

```
link_thoughts(
  from_id: "550e8400-e29b-41d4-a716-446655440000",
  to_id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  relation: "supports",
  note: "Both point to retrieval-optimized embeddings as the right trade-off"
)
```

The unique constraint `(from_id, to_id, relation)` prevents duplicate edges of the same type — calling `link_thoughts` twice with the same IDs and relation is safe.

---

## `get_links`

Retrieve all thoughts linked to a given thought, traversing the knowledge graph in one or both directions.

### Parameters

| Parameter   | Type | Required | Default | Description                                                            |
| ----------- | ---- | -------- | ------- | ---------------------------------------------------------------------- |
| `id`        | UUID | Yes      | —       | The thought ID to retrieve links for                                   |
| `direction` | enum | No       | `both`  | `from` (links originating here), `to` (links pointing here), or `both` |

### Return value

Array of link objects, each including the full `linked_thought`:

```json
[
  {
    "id": "link-uuid",
    "from_id": "550e8400-e29b-41d4-a716-446655440000",
    "to_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "relation": "supports",
    "note": "Both point to retrieval-optimized embeddings",
    "is_manual": true,
    "created_at": "2025-03-10T14:25:00Z",
    "linked_thought": {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "content": "The related thought text",
      "people": [],
      "topics": ["embeddings"],
      "action_items": [],
      "source": "claude-code",
      "created_at": "2025-03-09T09:00:00Z"
    }
  }
]
```

`is_manual: true` indicates the link was confirmed by a human (via `link_thoughts`); `false` would indicate an automatically suggested link that was stored without confirmation.

### Example

```
get_links(id: "550e8400-e29b-41d4-a716-446655440000", direction: "from")
```

---

## `stats`

Get aggregate statistics about the Open Brain knowledge base. Takes no parameters.

### Return value

```json
{
  "total_thoughts": 247,
  "total_links": 89,
  "by_source": [
    { "source": "claude-code", "count": 183 },
    { "source": "ios-shortcut", "count": 48 },
    { "source": "rest-api", "count": 16 }
  ],
  "oldest": "2024-11-15T08:30:00Z",
  "newest": "2025-03-10T14:22:00Z"
}
```

`by_source` is ordered by count descending, showing which clients contribute the most captures.

### Example

```
stats()
```
