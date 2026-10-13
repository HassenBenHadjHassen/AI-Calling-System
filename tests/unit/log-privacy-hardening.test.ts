import { describe, it, expect, vi } from 'vitest';
import { sanitizeLogString, sanitizeLogData, serializeError, logger } from '@/lib/logger';

describe('Log Privacy & Data Minimization Hardening Unit Tests', () => {
  it('redacts Bearer tokens and JWTs in strings', () => {
    const raw = 'Request header contains Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID';
    const sanitized = sanitizeLogString(raw);
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(sanitized).toContain('[REDACTED_');
  });

  it('redacts credentials, passwords, api keys, and tokens', () => {
    const raw = 'Connection failed with api_key: key_secret_xyz123 and password="SuperSecretPassword!"';
    const sanitized = sanitizeLogString(raw);
    expect(sanitized).not.toContain('key_secret_xyz123');
    expect(sanitized).not.toContain('SuperSecretPassword!');
    expect(sanitized).toContain('[REDACTED_CREDENTIAL]');
  });

  it('masks French and international phone numbers', () => {
    const raw = 'Caller with phone +33612345678 called to request care for 0698765432';
    const sanitized = sanitizeLogString(raw);
    expect(sanitized).not.toContain('+33612345678');
    expect(sanitized).not.toContain('0698765432');
    expect(sanitized).toContain('+336****78');
  });

  it('redacts postal codes in text', () => {
    const raw = 'Intervention requested at postal code 75008 in Paris';
    const sanitized = sanitizeLogString(raw);
    expect(sanitized).not.toContain('75008');
    expect(sanitized).toContain('[REDACTED_POSTAL_CODE]');
  });

  it('redacts email addresses in key-value context', () => {
    const raw = 'Sent alert to email: patient.secret@hospital.com';
    const sanitized = sanitizeLogString(raw);
    expect(sanitized).not.toContain('patient.secret@hospital.com');
    expect(sanitized).toContain('[REDACTED_EMAIL]');
  });

  it('sanitizes nested sensitive object keys (PII, Medical, Content)', () => {
    const payload = {
      patientName: 'Jean Dupont',
      phoneNumber: '+33612345678',
      symptoms: 'Forte fièvre et toux persistante',
      medicalNotes: 'Injections quotidiennes requises',
      summary: 'Demande urgente de soins infirmiers',
      nested: {
        token: 'secret_jwt_token',
        address: '12 rue de la Paix, 75002 Paris',
      },
    };

    const sanitized = sanitizeLogData(payload) as Record<string, any>;

    expect(sanitized.patientName).toBe('***REDACTED***');
    expect(sanitized.phoneNumber).toBe('***REDACTED***');
    expect(sanitized.symptoms).toBe('***REDACTED***');
    expect(sanitized.medicalNotes).toBe('***REDACTED***');
    expect(sanitized.summary).toBe('***REDACTED***');
    expect(sanitized.nested.token).toBe('***REDACTED***');
    expect(sanitized.nested.address).toBe('***REDACTED***');
  });

  it('serializes errors safely redacting sensitive data from stack and message', () => {
    const sensitiveErr = new Error('Database query failed for patient +33612345678 with token: sk_live_secret123');
    const serialized = serializeError(sensitiveErr);

    expect(serialized).toBeDefined();
    expect(serialized!.message).not.toContain('+33612345678');
    expect(serialized!.message).not.toContain('sk_live_secret123');
    expect(serialized!.message).toContain('[REDACTED_CREDENTIAL]');
  });

  it('captures console sink output and verifies sensitive metadata is redacted', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.error('Test critical failure', {
      module: 'TEST_SINK',
      error: new Error('Twilio call to +33612345678 failed with bearer: secret_key_99'),
      patientName: 'Alice Secret',
      token: 'jwt_abc_123',
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const calls = consoleErrorSpy.mock.calls.flat().join(' ');

    expect(calls).not.toContain('+33612345678');
    expect(calls).not.toContain('secret_key_99');
    expect(calls).not.toContain('Alice Secret');
    expect(calls).not.toContain('jwt_abc_123');

    consoleErrorSpy.mockRestore();
  });
});
