import 'dotenv/config';
import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { validateApiKey } from './auth.js';
import { server } from './server.js';

const PORT = parseInt(process.env.PORT ?? '8080', 10);

const httpServer = http.createServer((req, res) => {
  const url = req.url ?? '';

  // Health check
  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // MCP endpoint
  if (req.method === 'POST' && url === '/mcp') {
    if (!validateApiKey(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    server.connect(transport).then(() => transport.handleRequest(req, res)).catch((err: unknown) => {
      console.error('MCP transport error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

httpServer.listen(PORT, () => {
  console.log(`open-brain-cloud listening on port ${PORT}`);
});
