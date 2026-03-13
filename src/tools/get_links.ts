import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getLinks } from '../services/db.js';

export function registerGetLinksTool(server: McpServer): void {
  server.tool(
    'get_links',
    'Get all thoughts linked to a given thought.',
    {
      id: z.string().uuid().describe('Thought ID'),
      direction: z.enum(['from', 'to', 'both']).optional().default('both'),
    },
    async ({ id, direction }) => {
      const links = await getLinks(id, direction);

      return {
        content: [{ type: 'text', text: JSON.stringify(links, null, 2) }],
      };
    }
  );
}
