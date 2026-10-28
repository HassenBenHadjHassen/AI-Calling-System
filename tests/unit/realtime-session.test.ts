import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/realtime-session/route';
import { NextRequest } from 'next/server';

describe('Realtime Session Route (/api/realtime-session)', () => {
  it('handles sector and options with OpenAI mock for gpt-realtime-2.1-mini and Marin voice', async () => {
    // Mock global fetch for OpenAI realtime client_secrets endpoint
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        value: 'ek_test_token_12345',
        expires_at: 1793122449,
        session: {
          id: 'sess_12345',
          model: 'gpt-realtime-2.1-mini',
        },
      }),
    } as any);

    try {
      const req = new NextRequest('http://localhost:3000/api/realtime-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sector: 'sante',
          voice: 'marin',
          model: 'gpt-realtime-2.1-mini',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.clientSecret).toBe('ek_test_token_12345');
      expect(json.model).toBe('gpt-realtime-2.1-mini');
      expect(json.voice).toBe('marin');
      expect(json.reasoningEffort).toBe('medium');
      expect(json.sector).toBe('sante');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles quota exhaustion gracefully', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          code: 'insufficient_quota',
          message: 'You have no credits remaining.',
        },
      }),
    } as any);

    try {
      const req = new NextRequest('http://localhost:3000/api/realtime-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sector: 'btp',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(429);

      const json = await res.json();
      expect(json.error).toBe('QUOTA_EXHAUSTED');
      expect(json.fallbackAvailable).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
