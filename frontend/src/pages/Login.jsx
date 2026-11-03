import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loading, loginWithGoogle } = useAuth();
  const [error, setError] = useState('');

  if (loading) return <p>Loading...</p>;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div style={{ maxWidth: 360, margin: '120px auto', textAlign: 'center' }}>
      <h1>TaskHub</h1>
      <p>Organize and track your group work.</p>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
        <GoogleLogin
          onSuccess={async (res) => {
            try {
              setError('');
              await loginWithGoogle(res.credential);
            } catch {
              setError('Login failed. Please try again.');
            }
          }}
          onError={() => setError('Google sign-in was cancelled or failed.')}
        />
      </div>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  );
}