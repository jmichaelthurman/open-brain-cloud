import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPool } from '../services/db.js';
import type { Thought } from '../types.js';

export function registerListRecentTool(server: McpServer): void {
  server.registerTool(
    'list_recent',
    {
      description: 'List the most recently captured thoughts.',
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional().default(10),
      },
    },
    async ({ limit }) => {
      const pool = getPool();
      const { rows } = await pool.query<Thought>(
        `SELECT id, content, people, topics, action_items, source, created_at
         FROM thoughts
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
      };
    }
  );
}
