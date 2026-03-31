import { sha256 } from '@noble/hashes/sha2.js';

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function utf8ToBytes(input: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(input);
  }

  const escaped = unescape(encodeURIComponent(input));
  const bytes = new Uint8Array(escaped.length);

  for (let index = 0; index < escaped.length; index += 1) {
    bytes[index] = escaped.charCodeAt(index);
  }

  return bytes;
}

export async function hashSha256Hex(input: string): Promise<string> {
  const bytes = utf8ToBytes(input);

  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.digest === 'function'
  ) {
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const digest = await crypto.subtle.digest('SHA-256', data);
    return toHex(new Uint8Array(digest));
  }

  return toHex(sha256(bytes));
}