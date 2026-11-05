import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LogoMark } from '../components/Logo';
import PasswordInput from '../components/PasswordInput';
import ThemeToggle from '../components/ThemeToggle';
import { takeTokenFromUrl } from '../utils/emailLink';
import { toast } from '../utils/feedback';
import useTitle from '../utils/useTitle';

const MIN_PASSWORD = 8;

export default function ResetPassword() {
  const { setSessionUser } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState(takeTokenFromUrl);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useTitle('Choose a new password');

  // Opening another link in this tab only changes the # part, so the page doesn't reload
  useEffect(() => {
    const onHashChange = () => {
      const next = takeTokenFromUrl();
      if (!next) return;
      setToken(next);
      setError('');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/auth/reset-password', { token, password });
      setSessionUser(res.data.user);
      toast('Password changed. You\'re signed in.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error && err.response.status !== 400 ? err.response.data.error
        : err.response?.data?.error === 'Invalid input' ? `Use at least ${MIN_PASSWORD} characters.`
        : err.response?.data?.error || "Couldn't reach the server. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="center-page">
      <div className="corner-action"><ThemeToggle /></div>
      <div className="center-card">
        <div className="center-body">
          <LogoMark size={48} />
          <h2>Choose a new password</h2>
          {!token ? (
            <>
              <p className="muted">This link is missing its code. Please request a new one.</p>
              <Link className="btn btn-primary" to="/forgot-password">Request a new link</Link>
            </>
          ) : (
            <>
              <form className="form auth-form" onSubmit={submit}>
                <label className="field">
                  <span>New password</span>
                  <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" minLength={MIN_PASSWORD} autoFocus />
                  <small className="muted">At least {MIN_PASSWORD} characters. This signs you out everywhere else.</small>
                </label>
                {error && <p className="alert" role="alert">{error}</p>}
                <button type="submit" className="btn btn-primary auth-submit" disabled={saving}>{saving ? 'Saving...' : 'Change password'}</button>
              </form>
              {error && <small><Link to="/forgot-password">Request a new link</Link></small>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
