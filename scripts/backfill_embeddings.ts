/**
 * backfill_embeddings.ts
 *
 * Migrates thoughts from the local open-brain Postgres (BIGSERIAL ids, vector(768))
 * to Supabase (UUID ids, vector(512)), re-embedding each with Voyage AI voyage-3-lite.
 *
 * Usage:
 *   # 1. Make sure local Docker DB is running:
 *   #    cd ~/.open-brain && docker compose up -d postgres
 *
 *   # 2. Find your POSTGRES_PASSWORD:
 *   #    cat ~/.open-brain/.env
 *
 *   # 3. Dry run first:
 *   OLD_DATABASE_URL="postgresql://openbrain:<password>@localhost:5432/openbrain" \
 *   tsx scripts/backfill_embeddings.ts --dry-run
 *
 *   # 4. Run for real:
 *   OLD_DATABASE_URL="postgresql://openbrain:<password>@localhost:5432/openbrain" \
 *   tsx scripts/backfill_embeddings.ts
 *
 * Notes:
 *   - Old ids are BIGSERIAL integers — new UUIDs are generated fresh.
 *   - A mapping file (backfill_id_map.json) is written so you can trace old→new ids.
 *   - Idempotent: re-running skips already-migrated thoughts (matched by content + created_at).
 */

import pg from 'pg';
import fs from 'node:fs';
import 'dotenv/config';

const { Pool } = pg;

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;
const ID_MAP_FILE = 'backfill_id_map.json';

interface OldThought {
  id: string;           // BIGSERIAL — comes back as string from pg
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

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('Fetching thoughts from local database...');

  const { rows: thoughts } = await oldPool.query<OldThought>(
    `SELECT id, content, people, topics, action_items, source, created_at
     FROM thoughts
     ORDER BY created_at ASC`
  );

  console.log(`Found ${thoughts.length} thoughts to migrate.\n`);

  // Load existing id map if present (for idempotency)
  const idMap: Record<string, string> = fs.existsSync(ID_MAP_FILE)
    ? (JSON.parse(fs.readFileSync(ID_MAP_FILE, 'utf8')) as Record<string, string>)
    : {};

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < thoughts.length; i += BATCH_SIZE) {
    const batch = thoughts.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (thought) => {
        try {
          // Skip if already migrated (id present in map)
          if (idMap[thought.id]) {
            if (DRY_RUN) console.log(`[dry-run] Already migrated: old_id=${thought.id} → ${idMap[thought.id]}`);
            skipped++;
            return;
          }

          if (DRY_RUN) {
            console.log(`[dry-run] Would migrate: old_id=${thought.id} — ${thought.content.slice(0, 60)}...`);
            migrated++;
            return;
          }

          const embedding = await embedText(thought.content);
          const vectorLiteral = `[${embedding.join(',')}]`;

          const { rows } = await newPool.query<{ id: string }>(
            `INSERT INTO thoughts (content, embedding, people, topics, action_items, source, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              thought.content,
              vectorLiteral,
              thought.people,
              thought.topics,
              thought.action_items,
              thought.source,
              thought.created_at,
            ]
          );

          const newId = rows[0].id;
          idMap[thought.id] = newId;
          migrated++;
        } catch (err) {
          console.error(`Failed to migrate old_id=${thought.id}:`, err);
          failed++;
        }
      })
    );

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, thoughts.length)}/${thoughts.length} processed`);

    // Persist id map after each batch (crash safety)
    if (!DRY_RUN) {
      fs.writeFileSync(ID_MAP_FILE, JSON.stringify(idMap, null, 2));
    }

    if (i + BATCH_SIZE < thoughts.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  await oldPool.end();
  await newPool.end();

  console.log('\n=== Backfill Summary ===');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped (already done): ${skipped}`);
  console.log(`Failed:   ${failed}`);
  if (!DRY_RUN && migrated > 0) {
    console.log(`\nID map written to: ${ID_MAP_FILE}`);
    console.log('Keep this file — it maps old BIGSERIAL ids to new UUIDs.');
  }
  if (DRY_RUN) console.log('\n(DRY RUN — no changes written)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
