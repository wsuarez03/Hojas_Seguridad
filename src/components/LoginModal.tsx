import { FormEvent, useState } from 'react';
import { defaultAdminCredentials } from '../db/seed';
import { useAuth } from '../hooks/useAuth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const result = await login(username, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? 'No fue posible iniciar sesion.');
      return;
    }

    setUsername('');
    setPassword('');
    onSuccess();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Acceso administrativo</p>
            <h2 id="login-title">Ingresar al panel</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Usuario
            <input
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="admin"
              required
            />
          </label>

          <label>
            Contrasena
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Validando...' : 'Iniciar sesion'}
          </button>
        </form>

        <div className="helper-box">
          <strong>Credencial inicial:</strong> {defaultAdminCredentials.username} / {defaultAdminCredentials.password}
        </div>
      </div>
    </div>
  );
}