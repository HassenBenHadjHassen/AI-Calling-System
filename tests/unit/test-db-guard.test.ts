import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  assertApprovedTestDatabase,
  isApprovedTestDatabaseName,
  parseAndSanitizeDbUrl,
} from '../helpers/test-db-guard';
import { getActiveDatabaseUrl, resetPrismaClientForTesting } from '@/lib/db';

describe('Test Database Safety Guard Invariants', () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    await resetPrismaClientForTesting();
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await resetPrismaClientForTesting();
  });

  it('rejects destructive operations when NODE_ENV=production', () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/my_test';

    expect(() => assertApprovedTestDatabase()).toThrow(
      /Destructive test operations are strictly forbidden in NODE_ENV=production/
    );
  });

  it('rejects the shared/production database ai_calling_system even when ALLOW_INTEGRATION_TESTS=true', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.ALLOW_INTEGRATION_TESTS = 'true';
    const prodUrl = 'postgres://avnadmin:SecretPass123@pg-10bc0c4.aivencloud.com:13147/ai_calling_system?sslmode=require';
    process.env.TEST_DATABASE_URL = prodUrl;

    expect(() => assertApprovedTestDatabase(prodUrl)).toThrow(
      /Target database "ai_calling_system" is NOT an approved test database/
    );
    expect(() => assertApprovedTestDatabase(prodUrl)).toThrow(
      /The shared\/production database 'ai_calling_system' is strictly forbidden/
    );
  });

  it('rejects standard production database names like postgres, prod, main, master', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.ALLOW_INTEGRATION_TESTS = 'true';

    for (const forbiddenDb of ['postgres', 'prod', 'production', 'main', 'master', 'defaultdb']) {
      const url = `postgresql://localhost:5432/${forbiddenDb}`;
      process.env.TEST_DATABASE_URL = url;
      expect(() => assertApprovedTestDatabase(url)).toThrow(
        /is NOT an approved test database/
      );
    }
  });

  it('never logs passwords or secrets in error messages', () => {
    (process.env as any).NODE_ENV = 'test';
    const secretUrl = 'postgresql://myuser:SUPER_SECRET_PASSWORD_XYZ@localhost:5432/ai_calling_system';
    process.env.TEST_DATABASE_URL = secretUrl;

    try {
      assertApprovedTestDatabase(secretUrl);
      expect.fail('Should have thrown an error');
    } catch (err: any) {
      expect(err.message).not.toContain('SUPER_SECRET_PASSWORD_XYZ');
      expect(err.message).toContain('****');
    }
  });

  it('guarantees that getActiveDatabaseUrl uses TEST_DATABASE_URL in test mode', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/live_database';
    process.env.TEST_DATABASE_URL = 'postgresql://localhost:5432/ai_calling_system_test';

    const active = getActiveDatabaseUrl();
    expect(active).toBe('postgresql://localhost:5432/ai_calling_system_test');

    const result = assertApprovedTestDatabase();
    expect(result.databaseName).toBe('ai_calling_system_test');
  });

  it('detects and rejects configuration mismatch when active URL diverges from TEST_DATABASE_URL', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.TEST_DATABASE_URL = 'postgresql://localhost:5432/isolated_test';

    // Call assertApprovedTestDatabase with an explicit divergent URL
    const explicitDivergent = 'postgresql://localhost:5432/another_db_test';
    expect(() => assertApprovedTestDatabase(explicitDivergent)).toThrow(
      /Configuration mismatch: Explicitly supplied URL .* diverges from active Prisma database URL/
    );
  });

  it('fails closed when explicit URL differs from active connection target (preventing guard checking one URL while Prisma uses another)', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.TEST_DATABASE_URL = 'postgresql://localhost:5432/real_active_test';

    // Attempting to validate a fake safe URL while Prisma targets another must fail closed
    const spoofedUrl = 'postgresql://localhost:5432/spoofed_safe_test';
    expect(() => assertApprovedTestDatabase(spoofedUrl)).toThrow(
      /Configuration mismatch: Explicitly supplied URL .* diverges from active Prisma database URL/
    );
  });

  it('detects and rejects reused pool initialized against a different database URL', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.TEST_DATABASE_URL = 'postgresql://localhost:5432/current_suite_test';

    // Simulate an existing PostgreSQL pool initialized against an earlier target
    const globalForPrisma = globalThis as any;
    globalForPrisma.pgPoolUrl = 'postgresql://localhost:5432/earlier_suite_test';

    expect(() => assertApprovedTestDatabase()).toThrow(
      /Pool mismatch: Reused connection pool was initialized with target .* but active Prisma configuration is/
    );
  });

  it('accepts reused pool when pool URL matches active target URL', () => {
    (process.env as any).NODE_ENV = 'test';
    const testUrl = 'postgresql://localhost:5432/matching_suite_test';
    process.env.TEST_DATABASE_URL = testUrl;

    const globalForPrisma = globalThis as any;
    globalForPrisma.pgPoolUrl = testUrl;

    const target = assertApprovedTestDatabase();
    expect(target.databaseName).toBe('matching_suite_test');
    expect(target.isLocal).toBe(true);
  });

  it('accepts valid isolated local test databases without requiring ALLOW_INTEGRATION_TESTS', () => {
    (process.env as any).NODE_ENV = 'test';
    delete process.env.ALLOW_INTEGRATION_TESTS;
    process.env.TEST_DATABASE_URL = 'postgresql://localhost:5432/local_isolated_test';

    const target = assertApprovedTestDatabase();
    expect(target.databaseName).toBe('local_isolated_test');
    expect(target.isLocal).toBe(true);
  });

  it('rejects remote test databases when ALLOW_INTEGRATION_TESTS is not explicitly true', () => {
    (process.env as any).NODE_ENV = 'test';
    delete process.env.ALLOW_INTEGRATION_TESTS;
    const remoteTestUrl = 'postgresql://user:pass@remote-postgres.aivencloud.com:13147/remote_integration_test';
    process.env.TEST_DATABASE_URL = remoteTestUrl;

    expect(() => assertApprovedTestDatabase(remoteTestUrl)).toThrow(
      /Refusing to connect to remote test database .* without explicit ALLOW_INTEGRATION_TESTS=true/
    );
  });

  it('accepts remote test databases when name is approved AND ALLOW_INTEGRATION_TESTS=true', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.ALLOW_INTEGRATION_TESTS = 'true';
    const remoteTestUrl = 'postgresql://user:pass@remote-postgres.aivencloud.com:13147/remote_integration_test';
    process.env.TEST_DATABASE_URL = remoteTestUrl;

    const result = assertApprovedTestDatabase(remoteTestUrl);
    expect(result.databaseName).toBe('remote_integration_test');
    expect(result.isLocal).toBe(false);
  });

  it('rejects invalid database protocols like mysql or http', () => {
    (process.env as any).NODE_ENV = 'test';
    process.env.TEST_DATABASE_URL = 'mysql://localhost:3306/app_test';
    expect(() => assertApprovedTestDatabase('mysql://localhost:3306/app_test')).toThrow(
      /Invalid database protocol: "mysql:"/
    );
  });

  it('validates structural test database naming rules correctly', () => {
    expect(isApprovedTestDatabaseName('ai_calling_system_test')).toBe(true);
    expect(isApprovedTestDatabaseName('app-test')).toBe(true);
    expect(isApprovedTestDatabaseName('test_db')).toBe(true);
    expect(isApprovedTestDatabaseName('test')).toBe(true);

    // Rejected
    expect(isApprovedTestDatabaseName('ai_calling_system')).toBe(false);
    expect(isApprovedTestDatabaseName('production')).toBe(false);
    expect(isApprovedTestDatabaseName('prod')).toBe(false);
    expect(isApprovedTestDatabaseName('postgres')).toBe(false);
    expect(isApprovedTestDatabaseName('main')).toBe(false);
    expect(isApprovedTestDatabaseName('master')).toBe(false);
    expect(isApprovedTestDatabaseName('')).toBe(false);
  });

  it('structurally extracts database names and sanitizes connection strings', () => {
    const { databaseName, sanitizedUrl } = parseAndSanitizeDbUrl(
      'postgresql://avnadmin:MySuperSecret123@remote.host:13147/custom_client_test?sslmode=require'
    );
    expect(databaseName).toBe('custom_client_test');
    expect(sanitizedUrl).toBe('postgresql://avnadmin:****@remote.host:13147/custom_client_test');
    expect(sanitizedUrl).not.toContain('MySuperSecret123');
  });
});
