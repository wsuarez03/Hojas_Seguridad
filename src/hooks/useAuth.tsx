import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import { db } from '../db/appDb';
import { seedDatabase } from '../db/seed';
import type { UserRecord } from '../types';
import { normalizeUsername, verifyPassword } from '../utils/auth';

interface AuthContextValue {
  currentUser: UserRecord | null;
  isReady: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_KEY = 'safety-sheets-session-user-id';

export function AuthProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function initialize(): Promise<void> {
      await seedDatabase();
      const userId = sessionStorage.getItem(SESSION_KEY);

      if (userId) {
        const user = await db.users.get(userId);
        setCurrentUser(user ?? null);
      }

      setIsReady(true);
    }

    void initialize();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isReady,
      login: async (username, password) => {
        const normalized = normalizeUsername(username);
        const user = await db.users.where('username').equals(normalized).first();

        if (!user) {
          return { ok: false, message: 'Usuario no encontrado.' };
        }

        const isValid = await verifyPassword(normalized, password, user.passwordHash);

        if (!isValid) {
          return { ok: false, message: 'Contrasena incorrecta.' };
        }

        sessionStorage.setItem(SESSION_KEY, user.id);
        setCurrentUser(user);
        return { ok: true };
      },
      logout: () => {
        sessionStorage.removeItem(SESSION_KEY);
        setCurrentUser(null);
      },
      refreshCurrentUser: async () => {
        const userId = sessionStorage.getItem(SESSION_KEY);

        if (!userId) {
          setCurrentUser(null);
          return;
        }

        const user = await db.users.get(userId);

        if (!user) {
          sessionStorage.removeItem(SESSION_KEY);
        }

        setCurrentUser(user ?? null);
      }
    }),
    [currentUser, isReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}