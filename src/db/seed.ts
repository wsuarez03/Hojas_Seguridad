import { db } from './appDb';
import { hashPassword, normalizeUsername } from '../utils/auth';

export const defaultAdminCredentials = {
  username: 'admin',
  password: 'Admin123!'
};

export async function seedDatabase(): Promise<void> {
  const usersCount = await db.users.count();

  if (usersCount > 0) {
    return;
  }

  const now = new Date().toISOString();

  await db.users.add({
    id: crypto.randomUUID(),
    fullName: 'Administrador principal',
    username: normalizeUsername(defaultAdminCredentials.username),
    passwordHash: await hashPassword(defaultAdminCredentials.username, defaultAdminCredentials.password),
    role: 'admin',
    createdAt: now
  });
}