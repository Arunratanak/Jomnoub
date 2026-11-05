import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { LogoMark } from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import useTitle from '../utils/useTitle';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  useTitle('Reset your password');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.status === 429 ? err.response.data.error
        : err.response ? 'Enter a valid email address.'
        : "Couldn't reach the server. It may be waking up, so please try again in a moment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="center-page">
      <div className="corner-action"><ThemeToggle /></div>
      <div className="center-card">
        <div className="center-body">
          <LogoMark size={48} />
          <h2>Reset your password</h2>
          {sent ? (
            <>
              <p className="muted">
                If an account exists for <strong>{email}</strong>, we've sent a link to reset the password.
                It expires in 1 hour. Check your spam folder if you don't see it.
              </p>
              <Link className="btn" to="/login">Back to sign in</Link>
            </>
          ) : (
            <>
              <p className="muted">Enter your email and we'll send you a link to choose a new password.</p>
              <form className="form auth-form" onSubmit={submit}>
                <label className="field">
                  <span>Email</span>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" required autoFocus />
                </label>
                {error && <p className="alert" role="alert">{error}</p>}
                <button type="submit" className="btn btn-primary auth-submit" disabled={sending}>{sending ? 'Sending...' : 'Send reset link'}</button>
              </form>
              <small><Link to="/login">Back to sign in</Link></small>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
