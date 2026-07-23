import { randomInt } from 'crypto';

/*===============================================================================================
  Random ID Generator (PREFIX + A–Z + 0–9)
================================================================================================*/
export function generateId(prefix: string, totalLength: number): string {
  if (prefix.length >= totalLength) {
    throw new Error('Prefix length must be smaller than total length');
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const remainingLength = totalLength - prefix.length;
  let randomPart = '';
  for (let i = 0; i < remainingLength; i++) {
    randomPart += chars[randomInt(chars.length)];
  }
  return `${prefix}${randomPart}`;
}
