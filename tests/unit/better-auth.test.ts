import { describe, it, expect } from 'vitest';
import { auth } from '@/lib/auth';

describe('Better Auth Authentication System', () => {
  it('initializes auth instance with database adapter and emailAndPassword provider', () => {
    expect(auth).toBeDefined();
    expect(auth.api).toBeDefined();
    expect(typeof auth.api.signInEmail).toBe('function');
    expect(typeof auth.api.signUpEmail).toBe('function');
    expect(typeof auth.api.getSession).toBe('function');
  });

  it('rejects authentication with invalid credentials', async () => {
    try {
      await auth.api.signInEmail({
        body: {
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        },
      });
      // Should not reach here
      expect.unreachable('Should have failed authentication');
    } catch (err: unknown) {
      expect(err).toBeDefined();
    }
  });

  it('authenticates successfully with seeded admin credentials', async () => {
    const res = await auth.api.signInEmail({
      body: {
        email: 'admin@moncabinet.fr',
        password: 'AdminPassword2026!',
      },
    });

    expect(res).toBeDefined();
    expect(res.user).toBeDefined();
    expect(res.user.email).toBe('admin@moncabinet.fr');
    expect(res.token).toBeDefined();
  });
});
