import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCaptureTool } from './tools/capture.js';
import { registerSearchTool } from './tools/search.js';
import { registerListRecentTool } from './tools/list_recent.js';
import { registerLinkThoughtsTool } from './tools/link_thoughts.js';
import { registerGetLinksTool } from './tools/get_links.js';
import { registerStatsTool } from './tools/stats.js';

export const server = new McpServer({
  name: 'open-brain',
  version: '0.1.0',
});

registerCaptureTool(server);
registerSearchTool(server);
registerListRecentTool(server);
registerLinkThoughtsTool(server);
registerGetLinksTool(server);
registerStatsTool(server);
