import http from 'node:http';
import { embed } from '../services/voyage.js';
import { extractMetadata } from '../services/openrouter.js';
import { insertThought, searchByEmbedding } from '../services/db.js';
import type { SuggestedLink } from '../types.js';

const MAX_BODY_BYTES = 1_048_576; // 1 MB
const MAX_CONTENT_LENGTH = 50_000;
const MAX_ARRAY_LENGTH = 50;
const MAX_ELEMENT_LENGTH = 500;

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function boundedStrings(arr: unknown): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  return (arr as unknown[])
    .filter((v): v is string => typeof v === 'string')
    .slice(0, MAX_ARRAY_LENGTH)
    .map((v) => v.slice(0, MAX_ELEMENT_LENGTH));
}

export async function handleRestCapture(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const requestId = Math.random().toString(36).slice(2, 10);
  const start = Date.now();

  const contentType = req.headers['content-type'] ?? '';

  let raw: string;
  try {
    raw = await readBody(req);
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode ?? 400;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: status === 413 ? 'Payload too large' : 'Failed to read body' }));
    return;
  }

  let input: Record<string, unknown>;

  if (contentType.startsWith('application/json')) {
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
      res.end(JSON.stringify({ error: 'Request body must be a JSON object' }));
      return;
    }
    input = body as Record<string, unknown>;
  } else if (contentType.startsWith('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw);
    input = Object.fromEntries(params.entries());
  } else {
    res.writeHead(415, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Content-Type must be application/json or application/x-www-form-urlencoded' }));
    return;
  }
  const content = input['content'];

  if (typeof content !== 'string' || content.trim() === '') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'content is required' }));
    return;
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `content exceeds ${MAX_CONTENT_LENGTH} character limit` }));
    return;
  }

  const source = typeof input['source'] === 'string' ? input['source'] : 'rest-api';
  const people = boundedStrings(input['people']);
  const topics = boundedStrings(input['topics']);
  const action_items = boundedStrings(input['action_items']);

  console.log(JSON.stringify({ requestId, event: 'capture_start', source, contentLength: content.length }));

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

  const id = await insertThought({
    content,
    embedding,
    people: merge(people, extracted.people),
    topics: merge(topics, extracted.topics),
    action_items: merge(action_items, extracted.action_items),
    source,
  });

  const similar = await searchByEmbedding(embedding, 5, 0.5);
  const suggested_links: SuggestedLink[] = similar
    .filter((r) => r.id !== id)
    .map((r) => ({ thought_id: r.id, content: r.content, similarity: r.similarity }));

  console.log(JSON.stringify({ requestId, event: 'capture_ok', id, durationMs: Date.now() - start }));

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ id, suggested_links }));
}
