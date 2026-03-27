import { FormEvent, useMemo, useState } from 'react';
import { db } from '../db/appDb';
import type { UserRecord, UserRole } from '../types';
import { hashPassword, normalizeUsername } from '../utils/auth';

interface UserManagementProps {
  currentUser: UserRecord;
  users: UserRecord[];
  onUsersChanged: () => Promise<void>;
}

export function UserManagement({ currentUser, users, onUsersChanged }: UserManagementProps) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('uploader');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const adminCount = useMemo(() => users.filter((user) => user.role === 'admin').length, [users]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsSaving(true);

    const normalizedUsername = normalizeUsername(username);
    const existingUser = await db.users.where('username').equals(normalizedUsername).first();

    if (existingUser) {
      setError('El nombre de usuario ya existe.');
      setIsSaving(false);
      return;
    }

    const now = new Date().toISOString();

    await db.users.add({
      id: crypto.randomUUID(),
      fullName: fullName.trim(),
      username: normalizedUsername,
      passwordHash: await hashPassword(normalizedUsername, password),
      role,
      createdAt: now
    });

    setFullName('');
    setUsername('');
    setPassword('');
    setRole('uploader');
    setMessage('Usuario creado correctamente.');
    setIsSaving(false);
    await onUsersChanged();
  }

  async function handleDeleteUser(user: UserRecord): Promise<void> {
    if (user.id === currentUser.id) {
      setError('No puede eliminar la sesion activa.');
      return;
    }

    if (user.role === 'admin' && adminCount === 1) {
      setError('Debe permanecer al menos un administrador.');
      return;
    }

    const confirmed = window.confirm(`Eliminar al usuario ${user.fullName}?`);

    if (!confirmed) {
      return;
    }

    await db.users.delete(user.id);
    setMessage('Usuario eliminado.');
    setError('');
    await onUsersChanged();
  }

  return (
    <section className="panel-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Control de acceso</p>
          <h2>Administracion de usuarios</h2>
        </div>
      </div>

      <div className="two-column-layout">
        <form className="stack-form" onSubmit={(event) => void handleCreateUser(event)}>
          <label>
            Nombre completo
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>

          <label>
            Usuario
            <input value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>

          <label>
            Contrasena
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>

          <label>
            Rol
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="uploader">Usuario de cargue</option>
              <option value="admin">Administrador</option>
            </select>
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}

          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Crear usuario'}
          </button>
        </form>

        <div className="list-panel">
          {users.map((user) => (
            <article className="user-card" key={user.id}>
              <div>
                <strong>{user.fullName}</strong>
                <p>{user.username}</p>
              </div>
              <div className="user-card-actions">
                <span className="status-chip neutral">{user.role === 'admin' ? 'Administrador' : 'Cargue'}</span>
                <button className="ghost-button" type="button" onClick={() => void handleDeleteUser(user)}>
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}