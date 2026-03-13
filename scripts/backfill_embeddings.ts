/**
 * backfill_embeddings.ts
 *
 * Migrates thoughts from the old local Postgres to Supabase,
 * re-embedding each with Voyage AI voyage-3-lite (vector(512)).
 *
 * Usage:
 *   OLD_DATABASE_URL=postgresql://... DATABASE_URL=postgresql://... \
 *   VOYAGE_API_KEY=... tsx scripts/backfill_embeddings.ts [--dry-run]
 */

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

interface OldThought {
  id: string;
  content: string;
  people: string[];
  topics: string[];
  action_items: string[];
  source: string | null;
  created_at: Date;
}

async function embedText(text: string): Promise<number[]> {
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!voyageKey) throw new Error('VOYAGE_API_KEY is required');

  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${voyageKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'voyage-3-lite', input: [text] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { data: { embedding: number[] }[] };
  const embedding = data.data[0]?.embedding;
  if (!embedding || embedding.length !== 512) {
    throw new Error(`Unexpected embedding dimension: ${embedding?.length}`);
  }
  return embedding;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const oldUrl = process.env.OLD_DATABASE_URL;
  const newUrl = process.env.DATABASE_URL;
  if (!oldUrl) throw new Error('OLD_DATABASE_URL is required');
  if (!newUrl) throw new Error('DATABASE_URL is required');

  const oldPool = new Pool({ connectionString: oldUrl });
  const newPool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });

  console.log(`DRY RUN: ${DRY_RUN}`);
  console.log('Fetching thoughts from old database...');

  const { rows: thoughts } = await oldPool.query<OldThought>(
    'SELECT id, content, people, topics, action_items, source, created_at FROM thoughts ORDER BY created_at ASC'
  );

  console.log(`Found ${thoughts.length} thoughts to migrate.\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < thoughts.length; i += BATCH_SIZE) {
    const batch = thoughts.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (thought) => {
        try {
          if (DRY_RUN) {
            console.log(`[dry-run] Would migrate: ${thought.id} — ${thought.content.slice(0, 60)}...`);
            migrated++;
            return;
          }

          const embedding = await embedText(thought.content);
          const vectorLiteral = `[${embedding.join(',')}]`;

          await newPool.query(
            `INSERT INTO thoughts (id, content, embedding, people, topics, action_items, source, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [
              thought.id,
              thought.content,
              vectorLiteral,
              thought.people,
              thought.topics,
              thought.action_items,
              thought.source,
              thought.created_at,
            ]
          );
          migrated++;
        } catch (err) {
          console.error(`Failed to migrate ${thought.id}:`, err);
          failed++;
        }
      })
    );

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, thoughts.length)}/${thoughts.length} processed`);

    if (i + BATCH_SIZE < thoughts.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  await oldPool.end();
  await newPool.end();

  console.log('\n=== Backfill Summary ===');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
  if (DRY_RUN) console.log('(DRY RUN — no changes written)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
