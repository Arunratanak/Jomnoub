import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Modal from './Modal';
import TemplatePicker from './TemplatePicker';
import { CheckIcon } from './Icons';

const COPIED_MS = 2000;

function createError(err) {
  const status = err.response?.status;
  if (status === 429) return err.response.data.error;
  return status === 400
    ? 'Could not create the project. Check the name and try again.'
    : 'Could not create the project. Please try again.';
}

// Shown once the project exists, so the team can be invited straight away
function ProjectCreated({ project, onClose }) {
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null); // { url, expiresAt }
  const [inviteFailed, setInviteFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const linkInput = useRef(null);
  const copiedTimer = useRef(null);
  const started = useRef(false);

  const makeInvite = useCallback(async () => {
    setInviteFailed(false);
    try {
      const res = await api.post(`/projects/${project.id}/invites`);
      setInvite({ url: `${window.location.origin}/invite/${res.data.token}`, expiresAt: res.data.expiresAt });
    } catch {
      setInviteFailed(true);
    }
  }, [project.id]);

  useEffect(() => {
    // Strict mode runs effects twice in development, and a second link would replace the first
    if (!started.current) makeInvite();
    started.current = true;
    return () => clearTimeout(copiedTimer.current);
  }, [makeInvite]);

  const copy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      setCopyFailed(true);
      linkInput.current?.select();
    }
  };

  return (
    <div className="form">
      <p className="notice">
        <strong>{project.name}</strong> is ready{project.taskCount > 0 && ` with ${project.taskCount} tasks`}.
        {!inviteFailed && ' Invite your team with this link.'}
      </p>

      {inviteFailed && (
        <div className="alert notice-row">
          <span>The invite link couldn't be made.</span>
          <button type="button" className="btn btn-sm" onClick={makeInvite}>Try again</button>
        </div>
      )}
      {!invite && !inviteFailed && <p className="muted" role="status">Making your invite link...</p>}

      {invite && (
        <div className="field">
          <span id="new-invite-label">Invite link</span>
          <div className="invite-link-row">
            <input
              ref={linkInput}
              className="input"
              readOnly
              value={invite.url}
              onFocus={(e) => e.target.select()}
              aria-labelledby="new-invite-label"
            />
            <button type="button" className="btn" onClick={copy} autoFocus>
              {copied ? <><CheckIcon size={18} /> Copied</> : 'Copy link'}
            </button>
          </div>
          <small className="muted">
            Anyone with this link can join as a member until {new Date(invite.expiresAt).toLocaleDateString()}. You can manage it in the Members tab.
          </small>
          {copyFailed && <p className="alert">Copy failed. Select the link and copy it manually.</p>}
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>Done</button>
        <button type="button" className="btn btn-primary" onClick={() => navigate(`/projects/${project.id}`)}>Open project</button>
      </div>
    </div>
  );
}

export default function NewProjectModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templatesFailed, setTemplatesFailed] = useState(false);
  const [template, setTemplate] = useState('');

  useEffect(() => {
    api
      .get('/projects/templates')
      .then((res) => setTemplates(res.data.templates))
      .catch(() => setTemplatesFailed(true));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/projects', { name, description, ...(template ? { template } : {}) });
      const project = res.data.project;
      const taskCount = templates.find((t) => t.id === template)?.tasks.length || 0;
      setCreated({ id: project.id || project._id, name: project.name, taskCount });
      onCreated();
    } catch (err) {
      setError(createError(err));
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <Modal title="Project created" onClose={onClose}>
        <ProjectCreated project={created} onClose={onClose} />
      </Modal>
    );
  }

  return (
    <Modal title="New project" onClose={onClose}>
      <form className="form" onSubmit={create}>
        <label className="field">
          <span>Project name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </label>
        <div className="field">
          <span id="template-label">Start with</span>
          <TemplatePicker templates={templates} value={template} onChange={setTemplate} labelledBy="template-label" />
          {templatesFailed && <small className="muted">Templates couldn't load, but you can still create an empty project.</small>}
        </div>
        {error && <p className="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create project'}</button>
        </div>
      </form>
    </Modal>
  );
}
