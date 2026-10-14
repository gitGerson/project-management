/**
 * Reversible, tamper-resistant obfuscation for card IDs into clean, short alphanumeric URL hashes.
 * Uses a 32-bit 4-round Feistel permutation with Base58 encoding and a 10-bit checksum.
 * Compatible with all JavaScript runtimes and TypeScript targets.
 */

const FEISTEL_KEYS = [0xa341, 0x5c8e, 0x9f12, 0x7b23] as const;
const BASE58_ALPHABET = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const BASE58_LEN = BASE58_ALPHABET.length;

function feistelRound(x: number, key: number): number {
  let val = Math.imul((x ^ key) & 0xffff, 0x45d9b);
  val = (val >>> 8) ^ val;
  return val & 0xffff;
}

function encrypt32(num: number): number {
  let l = (num >>> 16) & 0xffff;
  let r = num & 0xffff;
  for (let i = 0; i < 4; i++) {
    const nextR = (l ^ feistelRound(r, FEISTEL_KEYS[i])) & 0xffff;
    l = r;
    r = nextR;
  }
  return ((l << 16) | r) >>> 0;
}

function decrypt32(num: number): number {
  let l = (num >>> 16) & 0xffff;
  let r = num & 0xffff;
  for (let i = 3; i >= 0; i--) {
    const prevL = (r ^ feistelRound(l, FEISTEL_KEYS[i])) & 0xffff;
    r = l;
    l = prevL;
  }
  return ((l << 16) | r) >>> 0;
}

/**
 * Encodes an integer card ID into a short URL-friendly hash string.
 * Example: 1 -> "fdxd8Tr"
 */
export function encodeCardHash(cardId: number): string {
  if (!cardId || cardId <= 0) return '';
  const enc = encrypt32(cardId);
  const chk = (cardId * 2654435761 >>> 0) & 0x3ff; // 10-bit checksum
  let combined = enc * 1024 + chk;
  let str = '';
  while (combined > 0) {
    const rem = combined % BASE58_LEN;
    str = BASE58_ALPHABET[rem] + str;
    combined = Math.floor(combined / BASE58_LEN);
  }
  return str.padStart(7, BASE58_ALPHABET[0]);
}

/**
 * Decodes a hash string back to the original integer card ID.
 * Returns null if the hash is corrupted, tampered with, or invalid.
 */
export function decodeCardHash(hash: string): number | null {
  if (!hash || typeof hash !== 'string') return null;
  const trimmed = hash.trim();
  let combined = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const idx = BASE58_ALPHABET.indexOf(trimmed[i]);
    if (idx === -1) return null;
    combined = combined * BASE58_LEN + idx;
  }
  const chk = combined % 1024;
  const enc = Math.floor(combined / 1024);
  const cardId = decrypt32(enc);
  if (cardId <= 0) return null;
  const expectedChk = (cardId * 2654435761 >>> 0) & 0x3ff;
  if (chk !== expectedChk) return null;
  return cardId;
}

