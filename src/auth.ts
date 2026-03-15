import type { IncomingMessage } from 'node:http';
import { jwtVerify } from 'jose';

if (!process.env.OPEN_BRAIN_API_KEY) {
  throw new Error('OPEN_BRAIN_API_KEY environment variable is required');
}

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null;
const API_KEY = process.env.OPEN_BRAIN_API_KEY;

if (!process.env.SERVICE_ACCOUNT_USER_ID) {
  throw new Error('SERVICE_ACCOUNT_USER_ID environment variable is required');
}
const SERVICE_ACCOUNT_USER_ID = process.env.SERVICE_ACCOUNT_USER_ID;

export interface AuthContext {
  userId: string;
  authMethod: 'jwt' | 'api_key';
  isServiceAccount: boolean;
}

async function tryJwt(token: string): Promise<AuthContext | null> {
  if (!JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub) return null;
    return { userId: payload.sub, authMethod: 'jwt', isServiceAccount: false };
  } catch {
    return null;
  }
}

function tryApiKey(token: string): AuthContext | null {
  if (token === API_KEY) {
    return { userId: SERVICE_ACCOUNT_USER_ID, authMethod: 'api_key', isServiceAccount: true };
  }
  return null;
}

export async function authenticate(req: IncomingMessage): Promise<AuthContext | null> {
  const match = (req.headers['authorization'] ?? '').match(/^bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];
  // Attempt JWT verification whenever a secret is configured; fall back to API key
  if (JWT_SECRET && token.split('.').length === 3) {
    const jwt = await tryJwt(token);
    if (jwt) return jwt;
  }
  return tryApiKey(token);
}
