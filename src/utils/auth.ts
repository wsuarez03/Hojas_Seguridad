import { hashSha256Hex } from './platform';

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function hashPassword(username: string, password: string): Promise<string> {
  const payload = `${normalizeUsername(username)}::${password}`;
  return hashSha256Hex(payload);
}

export async function verifyPassword(
  username: string,
  password: string,
  expectedHash: string
): Promise<boolean> {
  const computedHash = await hashPassword(username, password);
  return computedHash === expectedHash;
}