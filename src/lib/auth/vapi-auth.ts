import { NextRequest } from 'next/server';
import { env } from '../env';

export interface VapiAuthResult {
  authorized: boolean;
  status?: number;
  error?: string;
}

/**
 * Validates incoming Vapi requests using Bearer token or x-vapi-secret header.
 * Rejects unauthorized requests with 401.
 * Fails closed in production if the webhook secret is missing or insecure.
 */
export function verifyVapiSecret(req: NextRequest): VapiAuthResult {
  const configuredSecret = env.VAPI_WEBHOOK_SECRET;

  // Fail closed in production if secret is missing or using default fallback
  if (env.NODE_ENV === 'production') {
    if (!configuredSecret || configuredSecret.trim() === '' || configuredSecret === 'vapi_test_secret') {
      return {
        authorized: false,
        status: 401,
        error: 'Vapi webhook secret is not securely configured on the server',
      };
    }
  }

  const expectedSecret = configuredSecret || 'vapi_test_secret';

  // Extract token from Authorization: Bearer <secret> or x-vapi-secret: <secret>
  const authHeader = req.headers.get('authorization');
  const xVapiSecret = req.headers.get('x-vapi-secret');

  let token: string | null = null;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  } else if (xVapiSecret) {
    token = xVapiSecret.trim();
  }

  if (!token) {
    return {
      authorized: false,
      status: 401,
      error: 'Missing authentication credentials (expected Authorization: Bearer <token> or x-vapi-secret header)',
    };
  }

  // Safe equality check
  if (token !== expectedSecret) {
    return {
      authorized: false,
      status: 401,
      error: 'Invalid authentication credentials',
    };
  }

  return { authorized: true };
}
