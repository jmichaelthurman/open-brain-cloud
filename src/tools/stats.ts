import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPool } from '../services/db.js';

export function registerStatsTool(server: McpServer): void {
  server.registerTool(
    'stats',
    {
      description: 'Get Open Brain statistics: total thoughts, links, and breakdown by source.',
      inputSchema: {},
    },
    async () => {
      const pool = getPool();

      const [thoughts, links, bySource, range] = await Promise.all([
        pool.query<{ total_thoughts: string }>('SELECT COUNT(*) AS total_thoughts FROM thoughts'),
        pool.query<{ total_links: string }>('SELECT COUNT(*) AS total_links FROM thought_links'),
        pool.query<{ source: string | null; count: string }>(
          'SELECT source, COUNT(*) AS count FROM thoughts GROUP BY source ORDER BY count DESC'
        ),
        pool.query<{ oldest: string | null; newest: string | null }>(
          'SELECT MIN(created_at) AS oldest, MAX(created_at) AS newest FROM thoughts'
        ),
      ]);

      const result = {
        total_thoughts: parseInt(thoughts.rows[0].total_thoughts, 10),
        total_links: parseInt(links.rows[0].total_links, 10),
        by_source: bySource.rows.map((r) => ({ source: r.source, count: parseInt(r.count, 10) })),
        oldest: range.rows[0].oldest,
        newest: range.rows[0].newest,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
