// Layer:  L1 -- Web SDK
// File:   utils/uuid.ts
// Role:   UUID v4 generation using Web Crypto API (no dependencies).
// Author: Youssef Emad

/**
 * Generate a UUID v4 using the browser's Web Crypto API.
 * Falls back to Math.random() only if crypto is unavailable (very old browsers).
 */
export function uuidv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback — RFC 4122 compliant
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
