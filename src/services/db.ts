import pg from 'pg';
import type { Thought, ThoughtLink, SearchResult } from '../types.js';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pool;
}

export async function searchByEmbedding(
  embedding: number[],
  limit: number,
  threshold: number
): Promise<SearchResult[]> {
  const pool = getPool();
  const vectorLiteral = `[${embedding.join(',')}]`;
  const { rows } = await pool.query<SearchResult>(
    `SELECT * FROM search_thoughts($1::vector(512), $2, $3)`,
    [vectorLiteral, threshold, limit]
  );
  return rows;
}

export async function insertThought(data: {
  content: string;
  embedding: number[];
  people: string[];
  topics: string[];
  action_items: string[];
  source: string | null;
}): Promise<string> {
  const pool = getPool();
  const vectorLiteral = `[${data.embedding.join(',')}]`;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO thoughts (content, embedding, people, topics, action_items, source)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [data.content, vectorLiteral, data.people, data.topics, data.action_items, data.source]
  );
  return rows[0].id;
}

export async function insertLink(
  from_id: string,
  to_id: string,
  relation: string,
  note: string | null,
  is_manual: boolean
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO thought_links (from_id, to_id, relation, note, is_manual)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (from_id, to_id, relation) DO NOTHING`,
    [from_id, to_id, relation, note, is_manual]
  );
}

export async function getLinks(
  id: string,
  direction: 'from' | 'to' | 'both'
): Promise<Array<ThoughtLink & { linked_thought: Thought }>> {
  const pool = getPool();

  const conditions: string[] = [];
  if (direction === 'from' || direction === 'both') conditions.push('tl.from_id = $1');
  if (direction === 'to' || direction === 'both') conditions.push('tl.to_id = $1');
  const where = conditions.join(' OR ');

  const { rows } = await pool.query(
    `SELECT
       tl.id, tl.from_id, tl.to_id, tl.relation, tl.note, tl.is_manual, tl.created_at,
       t.id        AS lt_id,
       t.content   AS lt_content,
       t.people    AS lt_people,
       t.topics    AS lt_topics,
       t.action_items AS lt_action_items,
       t.source    AS lt_source,
       t.created_at AS lt_created_at
     FROM thought_links tl
     JOIN thoughts t ON (
       CASE WHEN tl.from_id = $1 THEN tl.to_id ELSE tl.from_id END = t.id
     )
     WHERE ${where}
     ORDER BY tl.created_at DESC`,
    [id]
  );

  return rows.map((row) => ({
    id: row.id as string,
    from_id: row.from_id as string,
    to_id: row.to_id as string,
    relation: row.relation as ThoughtLink['relation'],
    note: row.note as string | null,
    is_manual: row.is_manual as boolean,
    created_at: row.created_at as string,
    linked_thought: {
      id: row.lt_id as string,
      content: row.lt_content as string,
      people: row.lt_people as string[],
      topics: row.lt_topics as string[],
      action_items: row.lt_action_items as string[],
      source: row.lt_source as string | null,
      created_at: row.lt_created_at as string,
    },
  }));
}
