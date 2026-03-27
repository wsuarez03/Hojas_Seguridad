import { useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginModal } from './components/LoginModal';
import { PublicDashboard } from './components/PublicDashboard';

function AppRoutes() {
  const { currentUser, isReady } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const navigate = useNavigate();

  if (!isReady) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <p className="eyebrow">Preparando datos locales</p>
          <h1>Cargando aplicacion</h1>
        </div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<PublicDashboard onOpenLogin={() => setIsLoginOpen(true)} />} />
        <Route path="/admin" element={currentUser ? <AdminDashboard /> : <Navigate replace to="/" />} />
      </Routes>

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => {
          setIsLoginOpen(false);
          navigate('/admin');
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}