import type { IncomingMessage } from 'node:http';

if (!process.env.OPEN_BRAIN_API_KEY) {
  throw new Error('OPEN_BRAIN_API_KEY environment variable is required');
}

export const API_KEY = process.env.OPEN_BRAIN_API_KEY;

export function validateApiKey(req: IncomingMessage): boolean {
  const authHeader = req.headers['authorization'] ?? '';
  const match = authHeader.match(/^bearer\s+(.+)$/i);
  if (!match) return false;
  return match[1] === API_KEY;
}
