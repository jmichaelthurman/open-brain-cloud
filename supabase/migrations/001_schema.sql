CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE thoughts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content      TEXT NOT NULL,
  embedding    vector(512),
  people       TEXT[]  DEFAULT '{}',
  topics       TEXT[]  DEFAULT '{}',
  action_items TEXT[]  DEFAULT '{}',
  source       TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX thoughts_embedding_hnsw
  ON thoughts
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE OR REPLACE FUNCTION search_thoughts(
  query_embedding vector(512),
  match_threshold FLOAT DEFAULT 0.3,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  id           UUID,
  content      TEXT,
  people       TEXT[],
  topics       TEXT[],
  action_items TEXT[],
  source       TEXT,
  created_at   TIMESTAMPTZ,
  similarity   FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    t.id, t.content, t.people, t.topics, t.action_items, t.source, t.created_at,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM thoughts t
  WHERE 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
$$;
