import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { ProjectMark } from '../components/Avatar';
import { LogoMark } from '../components/Logo';
import Loading from '../components/Loading';
import ThemeToggle from '../components/ThemeToggle';
import useTitle from '../utils/useTitle';

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  useTitle(invite ? `Join ${invite.projectName}` : 'Project invite');

  useEffect(() => {
    api
      .get(`/invites/${encodeURIComponent(token)}`)
      .then((res) => setInvite(res.data.invite))
      .catch((err) =>
        setError(err.response?.data?.error || 'Could not load this invite. Refresh the page to try again.')
      );
  }, [token]);

  const join = async () => {
    setJoining(true);
    setError('');
    try {
      const res = await api.post(`/invites/${encodeURIComponent(token)}/accept`);
      navigate(`/projects/${res.data.projectId}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not join the project. Please try again.');
      setJoining(false);
    }
  };

  let content;
  if (error && !invite) {
    content = (
      <div className="center-card">
        <div className="center-body">
          <LogoMark size={40} />
          <h2>Invite unavailable</h2>
          <p>{error}</p>
          <p className="muted">Ask the project owner for a new link.</p>
          <Link className="btn" to="/dashboard">Go to home</Link>
        </div>
      </div>
    );
  } else if (!invite) {
    content = <Loading />;
  } else {
    content = (
      <div className="center-card">
        <div className="center-hero">
          <ProjectMark id={invite.projectId} name={invite.projectName} size={64} radius={16} />
          <p>You're invited to join</p>
          <h1>{invite.projectName}</h1>
        </div>
        <div className="center-body">
          <p className="muted">
            {invite.memberCount} member{invite.memberCount === 1 ? '' : 's'} · link expires{' '}
            {new Date(invite.expiresAt).toLocaleDateString()}
          </p>
          {invite.alreadyMember ? (
            <>
              <p>You're already a member of this project.</p>
              <Link className="btn btn-primary" to={`/projects/${invite.projectId}`}>Open project</Link>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={join} disabled={joining}>
              {joining ? 'Joining...' : 'Join project'}
            </button>
          )}
          {error && <p className="alert">{error}</p>}
          <Link to="/dashboard">Not now</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="center-page">
      <div className="corner-action"><ThemeToggle /></div>
      {content}
    </div>
  );
}
