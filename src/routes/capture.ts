import http from 'node:http';
import { embed } from '../services/voyage.js';
import { extractMetadata } from '../services/openrouter.js';
import { insertThought, searchByEmbedding } from '../services/db.js';

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export async function handleRestCapture(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const raw = await readBody(req);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  if (typeof body !== 'object' || body === null) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'content is required' }));
    return;
  }

  const input = body as Record<string, unknown>;
  const content = input['content'];

  if (typeof content !== 'string' || content.trim() === '') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'content is required' }));
    return;
  }

  const source = typeof input['source'] === 'string' ? input['source'] : 'ios-shortcut';
  const people = Array.isArray(input['people']) ? (input['people'] as string[]).filter((v) => typeof v === 'string') : undefined;
  const topics = Array.isArray(input['topics']) ? (input['topics'] as string[]).filter((v) => typeof v === 'string') : undefined;
  const action_items = Array.isArray(input['action_items']) ? (input['action_items'] as string[]).filter((v) => typeof v === 'string') : undefined;

  const [embedding, extracted] = await Promise.all([
    embed(content),
    extractMetadata(content),
  ]);

  // Merge: explicit values first, then extracted (no dupes)
  const merge = (explicit: string[] | undefined, extractedValues: string[]): string[] => {
    const base = explicit ?? [];
    const deduped = extractedValues.filter((v) => !base.includes(v));
    return [...base, ...deduped];
  };

  const mergedPeople = merge(people, extracted.people);
  const mergedTopics = merge(topics, extracted.topics);
  const mergedActions = merge(action_items, extracted.action_items);

  const id = await insertThought({
    content,
    embedding,
    people: mergedPeople,
    topics: mergedTopics,
    action_items: mergedActions,
    source,
  });

  const similar = await searchByEmbedding(embedding, 5, 0.5);
  const suggested_links = similar
    .filter((r) => r.id !== id)
    .map((r) => ({ thought_id: r.id, content: r.content, similarity: r.similarity }));

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ id, suggested_links }));
}
