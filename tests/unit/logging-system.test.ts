import { describe, it, expect } from 'vitest';
import { Logger, logger, sanitizeLogData } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

describe('Extensive Logging System Unit Tests', () => {
  it('generates well-formatted correlation IDs with prefixes', () => {
    const defaultCorr = Logger.generateCorrelationId();
    expect(defaultCorr).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);

    const vapiCorr = Logger.generateCorrelationId('vapi');
    expect(vapiCorr).toMatch(/^vapi_[a-z0-9]+_[a-z0-9]+$/);

    const twilioCorr = Logger.generateCorrelationId('twilio');
    expect(twilioCorr).toMatch(/^twilio_[a-z0-9]+_[a-z0-9]+$/);
  });

  it('redacts sensitive credentials in metadata (passwords, tokens, secrets)', () => {
    const rawData = {
      user: 'admin@moncabinet.fr',
      password: 'SuperSecretPassword123!',
      api_key: 'sk_test_12345',
      nested: {
        authorizationHeader: 'Bearer eyJhbGciOi...',
        safeField: 'Dani Bâtiment Devis #001',
      },
    };

    const sanitized = sanitizeLogData(rawData) as Record<string, any>;
    expect(sanitized.user).toBe('admin@moncabinet.fr');
    expect(sanitized.password).toBe('***REDACTED***');
    expect(sanitized.api_key).toBe('***REDACTED***');
    expect(sanitized.nested.authorizationHeader).toBe('***REDACTED***');
    expect(sanitized.nested.safeField).toBe('Dani Bâtiment Devis #001');
  });

  it('creates child loggers inheriting bound context', () => {
    const childLog = logger.child({
      module: 'WEBHOOK_VAPI:TestModule',
      correlationId: 'test_corr_123',
      businessId: 'test_biz_456',
    });

    expect(childLog).toBeInstanceOf(Logger);
  });

  it('writes structured log entries into logs/ filesystem directory', async () => {
    const testCorrId = `test_entry_${Date.now()}`;
    logger.info('Test execution log entry for filesystem check', {
      module: 'TEST_LOGGER',
      correlationId: testCorrId,
      isWebhook: true,
      customAttr: 'verified',
    });

    // Wait a tick for non-blocking file append
    await new Promise((resolve) => setTimeout(resolve, 50));

    const combinedPath = path.resolve(process.cwd(), 'logs', 'combined.log');
    const webhooksPath = path.resolve(process.cwd(), 'logs', 'webhooks.log');

    expect(fs.existsSync(combinedPath)).toBe(true);
    expect(fs.existsSync(webhooksPath)).toBe(true);

    const combinedContent = await fs.promises.readFile(combinedPath, 'utf8');
    expect(combinedContent).toContain(testCorrId);
  });
});
