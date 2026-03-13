/**
 * stdio-proxy.ts
 *
 * Bridges Claude Desktop (stdio MCP) ↔ open-brain-cloud (HTTP MCP).
 * Claude Desktop only supports stdio servers; this proxy lets it talk
 * to our remote Fly.io server transparently.
 *
 * Claude Desktop config (~/.../Claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "open-brain": {
 *       "command": "node",
 *       "args": ["/Users/jmichaelthurman/src/open-brain-cloud/proxy/dist/stdio-proxy.js"],
 *       "env": {
 *         "OPEN_BRAIN_API_KEY": "REDACTED_API_KEY",
 *         "OPEN_BRAIN_URL": "https://open-brain-cloud.fly.dev/mcp"
 *       }
 *     }
 *   }
 * }
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

const url = process.env.OPEN_BRAIN_URL ?? 'https://open-brain-cloud.fly.dev/mcp';
const apiKey = process.env.OPEN_BRAIN_API_KEY;

if (!apiKey) {
  process.stderr.write('OPEN_BRAIN_API_KEY is required\n');
  process.exit(1);
}

const stdio = new StdioServerTransport();

const http = new StreamableHTTPClientTransport(new URL(url), {
  requestInit: {
    headers: { Authorization: `Bearer ${apiKey}` },
  },
});

// Wire: Desktop → remote
stdio.onmessage = (msg: JSONRPCMessage) => {
  http.send(msg).catch((err: unknown) => {
    process.stderr.write(`http.send error: ${err}\n`);
  });
};

// Wire: remote → Desktop
http.onmessage = (msg: JSONRPCMessage) => {
  stdio.send(msg).catch((err: unknown) => {
    process.stderr.write(`stdio.send error: ${err}\n`);
  });
};

http.onerror = (err: Error) => process.stderr.write(`http error: ${err.message}\n`);
stdio.onerror = (err: Error) => process.stderr.write(`stdio error: ${err.message}\n`);

http.onclose = () => process.exit(0);
stdio.onclose = () => process.exit(0);

await Promise.all([stdio.start(), http.start()]);
