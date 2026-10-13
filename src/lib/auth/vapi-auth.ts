import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { env } from '../env';

export interface VapiAuthResult {
  authorized: boolean;
  status?: number;
  error?: string;
}

/**
 * Validates incoming Vapi requests using Bearer token or x-vapi-secret header.
 * Uses crypto.timingSafeEqual with byte-length verification.
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
        error: 'Unauthorized',
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
      error: 'Unauthorized',
    };
  }

  const tokenBuf = Buffer.from(token, 'utf8');
  const expectedBuf = Buffer.from(expectedSecret, 'utf8');

  // Verify byte length matches before timingSafeEqual to prevent length mismatch exceptions
  if (tokenBuf.length !== expectedBuf.length) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized',
    };
  }

  if (!crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized',
    };
  }

  return { authorized: true };
}
