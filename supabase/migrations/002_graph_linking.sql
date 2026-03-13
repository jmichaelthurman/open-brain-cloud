CREATE TABLE thought_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id    UUID NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  to_id      UUID NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  relation   TEXT NOT NULL CHECK (relation IN (
               'related', 'supports', 'contradicts',
               'follows_from', 'part_of', 'example_of', 'references'
             )),
  note       TEXT,
  is_manual  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (from_id, to_id, relation)
);

CREATE INDEX thought_links_from_idx ON thought_links(from_id);
CREATE INDEX thought_links_to_idx   ON thought_links(to_id);
