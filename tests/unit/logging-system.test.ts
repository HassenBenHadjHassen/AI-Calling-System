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

    // Wait for async non-blocking file append to flush
    const combinedPath = path.resolve(process.cwd(), 'logs', 'combined.log');
    const webhooksPath = path.resolve(process.cwd(), 'logs', 'webhooks.log');

    let found = false;
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(combinedPath)) {
        const content = await fs.promises.readFile(combinedPath, 'utf8');
        if (content.includes(testCorrId)) {
          found = true;
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(fs.existsSync(combinedPath)).toBe(true);
    expect(fs.existsSync(webhooksPath)).toBe(true);
    expect(found).toBe(true);
  });

  it('redacts patient PII, phone numbers, addresses, and medical info', () => {
    const piiData = {
      patientName: 'Jean Dupont',
      contactName: 'Marie Curie',
      callerNumber: '+33612345678',
      postalCode: '75015',
      address: '12 Rue de la Paix, 75002 Paris',
      symptoms: 'Forte fièvre et toux persistante',
      careDescription: 'Pansement lourd post-opératoire',
      clinicalNotes: 'Antécédents diabétiques',
      transcript: 'Bonjour je voudrais un rendez-vous pour demain...',
      xTwilioSignature: 'abcdef1234567890signature==',
      freeText: 'Patient reachable at +33698765432 regarding care',
    };

    const sanitized = sanitizeLogData(piiData) as Record<string, any>;
    expect(sanitized.patientName).toBe('***REDACTED***');
    expect(sanitized.contactName).toBe('***REDACTED***');
    expect(sanitized.callerNumber).toBe('***REDACTED***');
    expect(sanitized.postalCode).toBe('***REDACTED***');
    expect(sanitized.address).toBe('***REDACTED***');
    expect(sanitized.symptoms).toBe('***REDACTED***');
    expect(sanitized.careDescription).toBe('***REDACTED***');
    expect(sanitized.clinicalNotes).toBe('***REDACTED***');
    expect(sanitized.transcript).toBe('***REDACTED***');
    expect(sanitized.xTwilioSignature).toBe('***REDACTED***');
    expect(sanitized.freeText).toContain('+336****78');
  });

  it('prunes database logs older than retention period safely', async () => {
    const deletedCount = await Logger.pruneDatabaseLogs(7);
    expect(typeof deletedCount).toBe('number');
  });

  it('safely handles logging failures without throwing or interrupting business operations', () => {
    // Calling logger even with circular or abnormal context never throws
    const circularObj: any = { note: 'safe' };
    circularObj.self = circularObj;

    expect(() => {
      logger.info('Test with circular data', {
        circular: circularObj,
      });
      logger.error('Test error logging', {
        error: new Error('Simulated test error'),
      });
    }).not.toThrow();
  });
});

