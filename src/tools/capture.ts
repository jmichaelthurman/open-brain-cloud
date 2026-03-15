import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { embed } from '../services/voyage.js';
import { extractMetadata } from '../services/openrouter.js';
import { insertThought, searchByEmbedding } from '../services/db.js';

export function registerCaptureTool(server: McpServer): void {
  server.registerTool(
    'capture_thought',
    {
      description:
        'Save a thought, decision, or note to Open Brain with semantic embeddings and metadata extraction.',
      inputSchema: {
        content: z.string().min(1).describe('The thought or note to capture'),
        people: z.array(z.string()).optional().describe('People mentioned'),
        topics: z.array(z.string()).optional().describe('Topic tags'),
        action_items: z.array(z.string()).optional().describe('Action items'),
        source: z.string().optional().default('claude-code').describe('Source of the thought'),
      },
    },
    async ({ content, people, topics, action_items, source }) => {
      const [embedding, extracted] = await Promise.all([embed(content), extractMetadata(content)]);

      // Merge: explicit values first, then extracted (no dupes)
      const merge = (explicit: string[] | undefined, extracted: string[]): string[] => {
        const base = explicit ?? [];
        const deduped = extracted.filter((v) => !base.includes(v));
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

      return {
        content: [{ type: 'text', text: JSON.stringify({ id, suggested_links }, null, 2) }],
      };
    }
  );
}
