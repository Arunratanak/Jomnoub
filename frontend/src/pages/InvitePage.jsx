import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import Loading from '../components/Loading';
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

  const box = { maxWidth: 420, margin: '100px auto', padding: '0 16px', textAlign: 'center' };

  if (error && !invite) {
    return (
      <div style={box}>
        <h2>Invite unavailable</h2>
        <p>{error}</p>
        <p>Ask the project owner for a new link.</p>
        <Link to="/dashboard">Go to dashboard</Link>
      </div>
    );
  }
  if (!invite) return <Loading />;

  return (
    <div style={box}>
      <h2>You're invited to join</h2>
      <h1 style={{ overflowWrap: 'anywhere' }}>{invite.projectName}</h1>
      <p>
        {invite.memberCount} member{invite.memberCount === 1 ? '' : 's'} · link expires{' '}
        {new Date(invite.expiresAt).toLocaleDateString()}
      </p>
      {invite.alreadyMember ? (
        <>
          <p>You're already a member of this project.</p>
          <Link to={`/projects/${invite.projectId}`}>Open project</Link>
        </>
      ) : (
        <button onClick={join} disabled={joining}>{joining ? 'Joining...' : 'Join project'}</button>
      )}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <p style={{ marginTop: 24 }}><Link to="/dashboard">Not now</Link></p>
    </div>
  );
}
