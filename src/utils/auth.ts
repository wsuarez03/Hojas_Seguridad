const encoder = new TextEncoder();

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function hashPassword(username: string, password: string): Promise<string> {
  const payload = `${normalizeUsername(username)}::${password}`;
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(
  username: string,
  password: string,
  expectedHash: string
): Promise<boolean> {
  const computedHash = await hashPassword(username, password);
  return computedHash === expectedHash;
}