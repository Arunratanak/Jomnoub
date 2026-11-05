import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import { LogoMark } from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { takeTokenFromUrl } from '../utils/emailLink';
import useTitle from '../utils/useTitle';

export default function VerifyEmail() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState('working'); // 'working' | 'done' | 'failed'
  const [message, setMessage] = useState('');
  const started = useRef(false); // the link works once, so never send it twice
  useTitle('Verify your email');

  useEffect(() => {
    const verify = (token) =>
      api
        .post('/auth/verify-email', { token })
        .then(async () => {
          await refreshUser();
          setStatus('done');
        })
        .catch((err) => {
          setMessage(err.response?.status === 429
            ? err.response.data.error
            : 'This link is invalid or has expired. Sign in and request a new one from the banner at the top.');
          setStatus('failed');
        });

    if (!started.current) {
      started.current = true;
      verify(takeTokenFromUrl());
    }

    // Opening another link in this tab only changes the # part, so the page doesn't reload
    const onHashChange = () => {
      const token = takeTokenFromUrl();
      if (!token) return;
      setStatus('working');
      verify(token);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [refreshUser]);

  return (
    <div className="center-page">
      <div className="corner-action"><ThemeToggle /></div>
      {status === 'working' ? (
        <Loading />
      ) : (
        <div className="center-card">
          <div className="center-body">
            <LogoMark size={48} />
            <h2>{status === 'done' ? 'Your email is verified' : "Couldn't verify your email"}</h2>
            <p className="muted">{status === 'done' ? 'You can now get reminders and be added to projects by email.' : message}</p>
            <Link className="btn btn-primary" to={user ? '/dashboard' : '/login'}>{user ? 'Go to Jomnoub' : 'Sign in'}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
