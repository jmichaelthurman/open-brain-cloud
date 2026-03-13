import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { insertLink } from '../services/db.js';
import type { LinkRelation } from '../types.js';

const RELATIONS: [LinkRelation, ...LinkRelation[]] = [
  'related', 'supports', 'contradicts', 'follows_from', 'part_of', 'example_of', 'references',
];

export function registerLinkThoughtsTool(server: McpServer): void {
  server.tool(
    'link_thoughts',
    'Create a typed link between two thoughts.',
    {
      from_id: z.string().uuid().describe('Source thought ID'),
      to_id: z.string().uuid().describe('Target thought ID'),
      relation: z.enum(RELATIONS).describe('Relationship type'),
      note: z.string().optional().describe('Optional edge annotation'),
    },
    async ({ from_id, to_id, relation, note }) => {
      await insertLink(from_id, to_id, relation, note ?? null, true);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, from_id, to_id, relation }, null, 2),
          },
        ],
      };
    }
  );
}
