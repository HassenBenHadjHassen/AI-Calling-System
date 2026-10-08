import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber, isValidE164 } from '@/lib/validation/phone';

describe('Phone Number Normalization & Validation', () => {
  it('normalizes French 10-digit mobile numbers with leading 0', () => {
    expect(normalizePhoneNumber('0612345678')).toBe('+33612345678');
    expect(normalizePhoneNumber('0798765432')).toBe('+33798765432');
  });

  it('normalizes French 10-digit landline numbers with leading 0', () => {
    expect(normalizePhoneNumber('0145236789')).toBe('+33145236789');
    expect(normalizePhoneNumber('0491223344')).toBe('+33491223344');
    expect(normalizePhoneNumber('0939033663')).toBe('+33939033663');
  });

  it('handles international format with +33 prefix correctly', () => {
    expect(normalizePhoneNumber('+33612345678')).toBe('+33612345678');
  });

  it('handles 0033 international prefix', () => {
    expect(normalizePhoneNumber('0033612345678')).toBe('+33612345678');
  });

  it('handles 33 prefix without leading plus', () => {
    expect(normalizePhoneNumber('33612345678')).toBe('+33612345678');
  });

  it('cleans quotes, spaces, dashes, dots, and parentheses', () => {
    expect(normalizePhoneNumber('"\"+336 12 34 56 78\""')).toBe('+33612345678');
    expect(normalizePhoneNumber('06.12.34.56.78')).toBe('+33612345678');
    expect(normalizePhoneNumber('(06) 12-34-56-78')).toBe('+33612345678');
  });

  it('validates E.164 formatted numbers', () => {
    expect(isValidE164('+33612345678')).toBe(true);
    expect(isValidE164('+33939033663')).toBe(true);
    expect(isValidE164('0612345678')).toBe(false);
    expect(isValidE164('invalid')).toBe(false);
  });
});
