import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPool } from '../services/db.js';

export function registerGetThoughtTool(server: McpServer): void {
  server.registerTool(
    'get_thought',
    {
      description: 'Fetch a single thought by its UUID',
      inputSchema: { id: z.uuid().describe('UUID of the thought to fetch') },
    },
    async ({ id }) => {
      const pool = getPool();
      const result = await pool.query(
        `SELECT id, content, people, topics, action_items, source, created_at
         FROM thoughts WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `Thought not found: ${id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result.rows[0]) }],
      };
    }
  );
}
