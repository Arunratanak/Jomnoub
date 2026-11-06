import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { inviteTokenFrom } from '../utils/inviteLink';
import Modal from './Modal';

export default function JoinProjectModal({ onClose }) {
  const navigate = useNavigate();
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const token = inviteTokenFrom(link);
    if (!token) {
      setError("That doesn't look like an invite link. Copy the whole link and try again.");
      return;
    }
    setError('');
    setChecking(true);
    try {
      await api.get(`/invites/${encodeURIComponent(token)}`);
      // The invite page shows which project this is before they join
      navigate(`/invite/${encodeURIComponent(token)}`);
    } catch (err) {
      const message = err.response?.data?.error;
      setError(err.response?.status === 404
        ? `${message} Ask the project owner for a new link.`
        : message || 'Could not check this link. Please try again.');
      setChecking(false);
    }
  };

  return (
    <Modal title="Join a project" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Invite link</span>
          <input
            className="input"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={`${window.location.origin}/invite/...`}
            autoComplete="off"
            spellCheck={false}
            required
            autoFocus
          />
          <small className="muted">Paste the link the project owner sent you.</small>
        </label>
        {error && <p className="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={checking}>{checking ? 'Checking...' : 'Continue'}</button>
        </div>
      </form>
    </Modal>
  );
}
