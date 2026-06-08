import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ThemeSwitcher from './components/ui/ThemeSwitcher';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import Integrations from './pages/Integrations';
import Schedules from './pages/Schedules';
import Logs from './pages/Logs';
import Users from './pages/Users';
import Databases from './pages/Databases';
import Spinner from './components/ui/Spinner';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size={8} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/companies" element={<PrivateRoute><Companies /></PrivateRoute>} />
      <Route path="/companies/:id" element={<PrivateRoute><CompanyDetail /></PrivateRoute>} />
      <Route path="/integrations" element={<PrivateRoute><Integrations /></PrivateRoute>} />
      <Route path="/schedules" element={<PrivateRoute><Schedules /></PrivateRoute>} />
      <Route path="/logs" element={<PrivateRoute><Logs /></PrivateRoute>} />
      <Route path="/databases" element={<PrivateRoute><Databases /></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute roles={['superadmin','admin']}><Users /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <ThemeSwitcher />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
