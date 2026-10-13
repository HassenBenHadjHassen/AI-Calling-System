import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
};

export function getActiveDatabaseUrl(overrideUrl?: string): string {
  if (overrideUrl && overrideUrl.trim()) {
    return overrideUrl.trim();
  }
  if (process.env.NODE_ENV === 'test') {
    if (process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL.trim()) {
      return process.env.TEST_DATABASE_URL.trim();
    }
  }
  return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_calling_system';
}

export function createPrismaClient(overrideUrl?: string): PrismaClient {
  const rawConnectionString = getActiveDatabaseUrl(overrideUrl);

  // In test mode, keep DATABASE_URL aligned with authoritative test connection
  if (process.env.NODE_ENV === 'test' && !overrideUrl && process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }

  // Detect SSL need (cloud hosts, sslmode in URL, or remote host)
  const isCloudHost =
    !rawConnectionString.includes('localhost') && !rawConnectionString.includes('127.0.0.1');
  const hasSslParam =
    rawConnectionString.includes('sslmode=') || rawConnectionString.includes('ssl=');

  const needsSsl = isCloudHost || hasSslParam;

  // Clean connection string to prevent pg-connection-string libpq alias security warning
  const cleanConnectionString = rawConnectionString
    .replace(/([?&])sslmode=[^&]*/g, '')
    .replace(/([?&])ssl=[^&]*/g, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');

  const poolConfig: pg.PoolConfig = {
    connectionString: cleanConnectionString,
    max: process.env.NODE_ENV === 'test' ? 3 : 10,
    idleTimeoutMillis: 30000,
  };

  if (needsSsl) {
    // Allows cloud databases (Aiven, Supabase, Neon, AWS RDS, Render) with self-signed / custom project CAs
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = globalForPrisma.pgPool ?? new pg.Pool(poolConfig);

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
