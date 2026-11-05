import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { CheckIcon } from '../components/Icons';
import Loading from '../components/Loading';
import { LogoMark } from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../utils/theme';
import useTitle from '../utils/useTitle';

// Only follow in-app paths, never "//evil.com" or full URLs (open redirect)
const safePath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/dashboard');

const FEATURES = ['Invite your team with one link', 'Assign tasks and track deadlines', 'Get email reminders before things are late'];

export default function Login() {
  const { user, loading, loginWithGoogle } = useAuth();
  const { theme } = useTheme();
  useTitle('Sign in');
  const location = useLocation();
  const [error, setError] = useState('');
  const from = safePath(location.state?.from);
  const fromInvite = from.startsWith('/invite/');

  if (user) return <Navigate to={from} replace />;

  return (
    <div className="center-page">
      <div className="corner-action"><ThemeToggle /></div>
      {loading ? (
        <Loading />
      ) : (
        <div className="center-card">
          <div className="center-hero">
            <LogoMark size={56} inverse />
            <h1>TaskHub</h1>
            <p>Organize and track your group work.</p>
          </div>
          <div className="center-body">
            {fromInvite ? (
              <p><strong>Sign in to accept your project invite.</strong></p>
            ) : (
              <ul className="feature-list">
                {FEATURES.map((f) => <li key={f}><CheckIcon size={18} /> {f}</li>)}
              </ul>
            )}
            {/* Re-mounted on theme change, because Google draws this button itself */}
            <GoogleLogin
              key={theme}
              theme={theme === 'dark' ? 'filled_black' : 'outline'}
              shape="pill"
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
            {error && <p className="alert">{error}</p>}
            <small><Link to="/privacy">Privacy policy</Link></small>
          </div>
        </div>
      )}
    </div>
  );
}
