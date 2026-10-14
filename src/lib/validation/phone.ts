/**
 * Normalizes phone numbers to standard E.164 format.
 * Primarily handles French phone numbers (+33).
 */
export function normalizePhoneNumber(rawNumber?: string | null): string {
  if (!rawNumber) return '';

  // Reject unresolved template placeholders like "{{customer.number}}" or "+{{customernumber}}"
  if (/\{\{|\}\}|customernumber/i.test(rawNumber)) {
    return '';
  }

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
  else if (!cleaned.startsWith('+') && cleaned.length > 5 && /^\d+$/.test(cleaned)) {
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

/**
 * Checks whether a phone string contains a real phone number rather than a placeholder/template
 */
export function isRealPhoneNumber(phone?: string | null): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  if (/\{\{|\}\}|customer|undefined|null|nan|unknown/i.test(trimmed)) {
    return false;
  }
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 6;
}

/**
 * Formats a phone number for user-friendly display in French UI
 * Returns null if the phone number is invalid or a template placeholder
 */
export function formatDisplayPhoneNumber(phone?: string | null): string | null {
  if (!isRealPhoneNumber(phone)) return null;
  const raw = phone!.trim();
  const digits = raw.replace(/\D/g, '');

  if (raw.startsWith('+33') && digits.startsWith('33') && digits.length === 11) {
    const nat = digits.substring(2);
    return `+33 ${nat[0]} ${nat.substring(1, 3)} ${nat.substring(3, 5)} ${nat.substring(5, 7)} ${nat.substring(7, 9)}`;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.substring(0, 2)} ${digits.substring(2, 4)} ${digits.substring(4, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
  }
  return raw;
}

