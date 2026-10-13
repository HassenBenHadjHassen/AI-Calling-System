/**
 * Test Database Safety Guard
 * Prevents integration tests from executing destructive database operations
 * (INSERT, UPDATE, DELETE) against unapproved or production databases.
 */
export function assertApprovedTestDatabase(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[TestDatabaseGuard] Destructive test operations are strictly forbidden in NODE_ENV=production!'
    );
  }

  const rawUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!rawUrl) {
    throw new Error('[TestDatabaseGuard] No database URL configured in environment.');
  }

  // Sanitize URL for logging / error reporting
  const safeDbUrl = rawUrl.replace(/:[^:@]+@/, ':****@');

  // Verify approval criteria
  const isExplicitlyAllowed =
    process.env.ALLOW_INTEGRATION_TESTS === 'true' ||
    Boolean(process.env.TEST_DATABASE_URL) ||
    process.env.INTEGRATION_TEST_APPROVED === 'true';

  const isNamedTestDb =
    rawUrl.toLowerCase().includes('_test') ||
    rawUrl.toLowerCase().includes('test_') ||
    rawUrl.toLowerCase().includes('/test') ||
    rawUrl.toLowerCase().includes('ai_calling_system_test');

  const isLocalDb =
    rawUrl.includes('localhost') ||
    rawUrl.includes('127.0.0.1');

  if (!isExplicitlyAllowed && !isNamedTestDb && !isLocalDb) {
    throw new Error(
      `[TestDatabaseGuard] Refusing to run destructive tests against unapproved database target: ${safeDbUrl}.\n` +
      `To protect production and shared environments, integration tests must target a database containing 'test' ` +
      `in its name, a local database, or have ALLOW_INTEGRATION_TESTS=true explicitly set.`
    );
  }
}
