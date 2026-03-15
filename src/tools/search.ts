import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { embed } from '../services/voyage.js';
import { searchByEmbedding } from '../services/db.js';

export function registerSearchTool(server: McpServer): void {
  server.registerTool(
    'search_thoughts',
    {
      description: 'Semantically search Open Brain for relevant thoughts using vector similarity.',
      inputSchema: {
        query: z.string().min(3).describe('Natural language search query'),
        limit: z.number().int().min(1).max(20).optional().default(5),
        threshold: z.number().min(0).max(1).optional().default(0.3),
      },
    },
    async ({ query, limit, threshold }) => {
      const embedding = await embed(query);
      const results = await searchByEmbedding(embedding, limit, threshold);

      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      };
    }
  );
}
