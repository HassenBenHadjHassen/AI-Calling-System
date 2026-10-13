import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
  pgPoolUrl?: string;
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

export function getActivePoolUrl(): string | undefined {
  return globalForPrisma.pgPoolUrl;
}

export function sanitizeDbUrlForLogging(rawUrl?: string): string {
  if (!rawUrl) return '[undefined]';
  try {
    const parsed = new URL(rawUrl);
    const hostWithPort = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    const dbName = parsed.pathname.replace(/^\/+/, '').split('?')[0].split('#')[0];
    return `${parsed.protocol}//${parsed.username ? parsed.username + ':****@' : ''}${hostWithPort}/${dbName}`;
  } catch {
    return '[malformed-url]';
  }
}

export function createPrismaClient(overrideUrl?: string): PrismaClient {
  const rawConnectionString = getActiveDatabaseUrl(overrideUrl);

  // In test mode, keep DATABASE_URL aligned with authoritative test connection
  if (process.env.NODE_ENV === 'test' && !overrideUrl && process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }

  // Check if globally reused pgPool exists and verify target URL matches
  if (globalForPrisma.pgPool) {
    if (globalForPrisma.pgPoolUrl && globalForPrisma.pgPoolUrl !== rawConnectionString) {
      throw new Error(
        `[DatabaseClient] Active connection pool mismatch: Existing pool is connected to "${sanitizeDbUrlForLogging(globalForPrisma.pgPoolUrl)}" but requested URL is "${sanitizeDbUrlForLogging(rawConnectionString)}". Cannot reuse pool with different target database!`
      );
    }
    const adapter = new PrismaPg(globalForPrisma.pgPool);
    return new PrismaClient({ adapter });
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

  const pool = new pg.Pool(poolConfig);

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.pgPool = pool;
    globalForPrisma.pgPoolUrl = rawConnectionString;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export async function resetPrismaClientForTesting(): Promise<void> {
  if (globalForPrisma.prisma) {
    try {
      await globalForPrisma.prisma.$disconnect();
    } catch {}
    delete globalForPrisma.prisma;
  }
  if (globalForPrisma.pgPool) {
    try {
      await globalForPrisma.pgPool.end();
    } catch {}
    delete globalForPrisma.pgPool;
  }
  delete globalForPrisma.pgPoolUrl;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
