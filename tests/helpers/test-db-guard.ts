import { getActiveDatabaseUrl } from '@/lib/db';

/**
 * Test Database Safety Guard
 * Prevents integration tests from executing destructive database operations
 * (INSERT, UPDATE, DELETE, TRUNCATE) against unapproved or production databases.
 */

export interface ValidatedDatabaseTarget {
  sanitizedUrl: string;
  databaseName: string;
  host: string;
  isLocal: boolean;
}

/**
 * Structurally parses a database URL and produces a safe sanitized URL for logging/diagnostics,
 * stripping credentials entirely.
 */
export function parseAndSanitizeDbUrl(rawUrl: string): {
  parsed: URL;
  databaseName: string;
  sanitizedUrl: string;
} {
  try {
    const parsed = new URL(rawUrl);
    // Extract database name from pathname (e.g. "/ai_calling_system_test" -> "ai_calling_system_test")
    const pathnameWithoutSlash = parsed.pathname.replace(/^\/+/, '');
    const databaseName = pathnameWithoutSlash.split('?')[0].split('#')[0].trim();
    
    const hostWithPort = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    const sanitizedUrl = `${parsed.protocol}//${parsed.username ? parsed.username + ':****@' : ''}${hostWithPort}/${databaseName}`;

    return { parsed, databaseName, sanitizedUrl };
  } catch {
    throw new Error('[TestDatabaseGuard] Invalid or malformed database connection URL.');
  }
}

/**
 * Validates that the database name structurally designates an isolated test database.
 * Rejects production, shared, and default system databases regardless of approval flags.
 */
export function isApprovedTestDatabaseName(databaseName: string): boolean {
  if (!databaseName || typeof databaseName !== 'string') {
    return false;
  }
  const lower = databaseName.toLowerCase().trim();

  // Explicitly forbidden production, default, and shared database names
  const forbidden = [
    'ai_calling_system',
    'production',
    'prod',
    'main',
    'master',
    'postgres',
    'defaultdb',
  ];
  if (forbidden.includes(lower)) {
    return false;
  }

  // Must structurally denote a dedicated test database
  return (
    lower.endsWith('_test') ||
    lower.endsWith('-test') ||
    lower.startsWith('test_') ||
    lower.startsWith('test-') ||
    lower === 'test' ||
    lower.includes('_test_')
  );
}

/**
 * Asserts that the currently configured database target is an approved, dedicated test database.
 * 
 * Safety invariants enforced:
 * 1. NODE_ENV=production is strictly blocked.
 * 2. In test mode with TEST_DATABASE_URL, Prisma is guaranteed to connect to TEST_DATABASE_URL.
 * 3. The target database name MUST structurally indicate an isolated test database (e.g. ends with '_test').
 * 4. Production database targets (including 'ai_calling_system') are REJECTED even if ALLOW_INTEGRATION_TESTS=true.
 * 5. Remote test databases require BOTH a dedicated test database name AND ALLOW_INTEGRATION_TESTS=true.
 * 6. Passwords and credentials are never logged or included in error messages.
 */
export function assertApprovedTestDatabase(explicitUrl?: string): ValidatedDatabaseTarget {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[TestDatabaseGuard] Destructive test operations are strictly forbidden in NODE_ENV=production!'
    );
  }

  // Determine authoritative database URL
  const targetUrl = explicitUrl || getActiveDatabaseUrl();
  if (!targetUrl || !targetUrl.trim()) {
    throw new Error('[TestDatabaseGuard] No database URL configured in environment.');
  }

  // Verify Prisma client alignment when TEST_DATABASE_URL is set in test environment
  if (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL) {
    const activeUrl = getActiveDatabaseUrl();
    if (activeUrl !== process.env.TEST_DATABASE_URL.trim()) {
      throw new Error(
        '[TestDatabaseGuard] Configuration mismatch: Active Prisma database URL differs from TEST_DATABASE_URL!'
      );
    }
  }

  const { parsed, databaseName, sanitizedUrl } = parseAndSanitizeDbUrl(targetUrl);

  // 1. Verify PostgreSQL protocol
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(
      `[TestDatabaseGuard] Invalid database protocol: "${parsed.protocol}". Expected postgres: or postgresql:.`
    );
  }

  // 2. Verify database name is present
  if (!databaseName) {
    throw new Error(
      `[TestDatabaseGuard] Database URL lacks a specific database name in path: ${sanitizedUrl}`
    );
  }

  // 3. Verify database name structurally indicates an isolated test database
  if (!isApprovedTestDatabaseName(databaseName)) {
    throw new Error(
      `[TestDatabaseGuard] Refusing to run destructive tests against unapproved database target: ${sanitizedUrl}.\n` +
      `Target database "${databaseName}" is NOT an approved test database. To protect production and shared environments, ` +
      `an approved test database name must end with '_test' (e.g. 'ai_calling_system_test') or start with 'test_'. ` +
      `The shared/production database 'ai_calling_system' is strictly forbidden, even when ALLOW_INTEGRATION_TESTS=true.`
    );
  }

  // 4. Remote host protection
  const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (!isLocalHost) {
    if (process.env.ALLOW_INTEGRATION_TESTS !== 'true') {
      throw new Error(
        `[TestDatabaseGuard] Refusing to connect to remote test database ${sanitizedUrl} without explicit ALLOW_INTEGRATION_TESTS=true.`
      );
    }
  }

  return {
    sanitizedUrl,
    databaseName,
    host: parsed.hostname,
    isLocal: isLocalHost,
  };
}
