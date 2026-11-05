import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import { LogoMark } from '../components/Logo';
import PasswordInput from '../components/PasswordInput';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../utils/theme';
import useTitle from '../utils/useTitle';

// Only follow in-app paths, never "//evil.com" or full URLs (open redirect)
const safePath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/dashboard');

const MIN_PASSWORD = 8;

function friendlyError(err, mode) {
  const status = err.response?.status;
  if (!err.response) return "Couldn't reach the server. It may be waking up, so please try again in a moment.";
  if (status === 429 || status === 409 || status === 401) return err.response.data.error;
  if (status === 400) return mode === 'register'
    ? `Check your details: a valid email and a password of at least ${MIN_PASSWORD} characters.`
    : 'Enter a valid email and your password.';
  return 'Something went wrong. Please try again.';
}

export default function Login() {
  const { user, loading, loginWithGoogle, loginWithPassword, register } = useAuth();
  const { theme } = useTheme();
  useTitle('Sign in');
  const location = useLocation();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const from = safePath(location.state?.from);
  const fromInvite = from.startsWith('/invite/');
  const isRegister = mode === 'register';

  if (user) return <Navigate to={from} replace />;

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) await register(name, email, password);
      else await loginWithPassword(email, password);
    } catch (err) {
      setError(friendlyError(err, mode));
      setSubmitting(false);
    }
  };

  return (
    <div className="center-page">
      <div className="corner-action"><ThemeToggle /></div>
      {loading ? (
        <Loading />
      ) : (
        <div className="center-card">
          <div className="center-hero">
            <LogoMark size={56} inverse />
            <h1>Jomnoub</h1>
            <p>Organize and track your group work.</p>
          </div>
          <div className="center-body">
            {fromInvite && <p><strong>Sign in to accept your project invite.</strong></p>}

            <div className="auth-tabs" role="tablist" aria-label="Sign in or create an account">
              <button type="button" role="tab" aria-selected={!isRegister} className={`auth-tab${!isRegister ? ' active' : ''}`} onClick={() => switchMode('login')}>Sign in</button>
              <button type="button" role="tab" aria-selected={isRegister} className={`auth-tab${isRegister ? ' active' : ''}`} onClick={() => switchMode('register')}>Create account</button>
            </div>

            <form className="form auth-form" onSubmit={submit}>
              {isRegister && (
                <label className="field">
                  <span>Name</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" required autoFocus />
                </label>
              )}
              <label className="field">
                <span>Email</span>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" required />
              </label>
              <label className="field">
                <span>Password</span>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  minLength={isRegister ? MIN_PASSWORD : undefined}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                />
                {isRegister && <small className="muted">At least {MIN_PASSWORD} characters.</small>}
              </label>
              {!isRegister && <small className="forgot-link"><Link to="/forgot-password">Forgot password?</Link></small>}
              {error && <p className="alert" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
                {submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <div className="auth-divider"><span>or</span></div>

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
                  setError(err.response?.status === 429 ? err.response.data.error : 'Google sign-in failed. Please try again.');
                }
              }}
              onError={() => setError('Google sign-in was cancelled or failed.')}
            />
            <small><Link to="/privacy">Privacy policy</Link></small>
          </div>
        </div>
      )}
    </div>
  );
}
