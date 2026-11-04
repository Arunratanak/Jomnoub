import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

// Only follow in-app paths, never "//evil.com" or full URLs (open redirect)
const safePath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/dashboard');

export default function Login() {
  const { user, loading, loginWithGoogle } = useAuth();
  const location = useLocation();
  const [error, setError] = useState('');
  const from = safePath(location.state?.from);
  const fromInvite = from.startsWith('/invite/');

  if (loading) return <Loading />;
  if (user) return <Navigate to={from} replace />;

  return (
    <div style={{ maxWidth: 360, margin: '120px auto', textAlign: 'center' }}>
      <h1>TaskHub</h1>
      <p>Organize and track your group work.</p>
      {fromInvite && <p><strong>Sign in to accept your project invite.</strong></p>}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
        <GoogleLogin
          onSuccess={async (res) => {
            try {
              setError('');
              await loginWithGoogle(res.credential);
            } catch (err) {
              setError(err.response?.status === 429 ? err.response.data.error : 'Login failed. Please try again.');
            }
          }}
          onError={() => setError('Google sign-in was cancelled or failed.')}
        />
      </div>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  );
}