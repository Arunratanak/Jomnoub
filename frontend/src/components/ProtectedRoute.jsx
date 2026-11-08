import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  // Signed out on Home (e.g. just logged out): show the welcome page instead
  if (!user && location.pathname === '/dashboard' && !location.search) return <Navigate to="/" replace />;
  // Remember where the user was going (e.g. an invite link) so Login can send them back
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
