import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { db } from './db';

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'USER',
        input: true,
      },
      assignedBusiness: {
        type: 'string',
        required: false,
        defaultValue: 'ALL',
        input: true,
      },
      allowedSections: {
        type: 'string',
        required: false,
        defaultValue: 'ALL',
        input: true,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret: process.env.BETTER_AUTH_SECRET || 'ai_calling_system_secure_better_auth_secret_2026_xyz987',
  baseURL: process.env.BETTER_AUTH_URL || process.env.APP_URL,
  trustedOrigins: [
    process.env.APP_URL,
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
