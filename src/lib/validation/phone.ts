/**
 * Normalizes phone numbers to standard E.164 format.
 * Primarily handles French phone numbers (+33).
 */
export function normalizePhoneNumber(rawNumber?: string | null): string {
  if (!rawNumber) return '';

  // Remove quotes, brackets, and whitespace
  let cleaned = rawNumber.replace(/["'\s().-]/g, '').trim();

  // If starts with 0033, replace with +33
  if (cleaned.startsWith('0033')) {
    cleaned = '+33' + cleaned.substring(4);
  }
  // If starts with 33 and no +, add +
  else if (cleaned.startsWith('33') && cleaned.length >= 11) {
    cleaned = '+' + cleaned;
  }
  // If starts with French national prefix 0 followed by 6, 7, 1, 2, 3, 4, 5, 9
  else if (/^0[1-9]\d{8}$/.test(cleaned)) {
    cleaned = '+33' + cleaned.substring(1);
  }
  // If 9 digits starting with 6, 7, 9 (missing leading 0 or +33)
  else if (/^[1-9]\d{8}$/.test(cleaned)) {
    cleaned = '+33' + cleaned;
  }
  // If doesn't start with +, add +
  else if (!cleaned.startsWith('+') && cleaned.length > 5) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Validates whether a phone number matches standard E.164 formatting
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}
