import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getLinks } from '../services/db.js';

export function registerGetLinksTool(server: McpServer): void {
  server.registerTool(
    'get_links',
    {
      description: 'Get all thoughts linked to a given thought.',
      inputSchema: {
        id: z.uuid().describe('Thought ID'),
        direction: z.enum(['from', 'to', 'both']).optional().default('both'),
      },
    },
    async ({ id, direction }) => {
      const links = await getLinks(id, direction);

      return {
        content: [{ type: 'text', text: JSON.stringify(links, null, 2) }],
      };
    }
  );
}
