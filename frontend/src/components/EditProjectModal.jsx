import { useState } from 'react';
import api from '../api/client';
import Modal from './Modal';

// Edit a project's name and description (owner only; the server enforces this too)
export default function EditProjectModal({ projectId, name: initialName, description: initialDescription, onClose, onSaved }) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.patch(`/projects/${projectId}`, { name, description });
      onSaved(res.data.project);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save the project.');
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit project" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label className="field">
          <span>Project name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
        </label>
        <label className="field">
          <span>Description (optional)</span>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </label>
        {error && <p className="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}
