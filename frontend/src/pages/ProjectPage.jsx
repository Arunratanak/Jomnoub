import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];
const emptyForm = { title: '', description: '', assignee: '', deadline: '' };

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const loadTasks = () =>
    api.get(`/projects/${id}/tasks`).then((res) => setTasks(res.data.tasks));

  useEffect(() => {
    api
      .get(`/projects/${id}`)
      .then((res) => {
        setData(res.data);
        return loadTasks();
      })
      .catch(() => setNotFound(true));
  }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const body = {
      title: form.title,
      description: form.description,
      assignee: form.assignee || null,
      deadline: form.deadline || null,
    };
    try {
      if (editingId) await api.patch(`/projects/${id}/tasks/${editingId}`, body);
      else await api.post(`/projects/${id}/tasks`, body);
      setForm(emptyForm);
      setEditingId(null);
      await loadTasks();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save the task.');
    }
  };

  const startEdit = (t) => {
    setEditingId(t._id);
    setForm({
      title: t.title,
      description: t.description || '',
      assignee: t.assignee?._id || '',
      deadline: t.deadline ? t.deadline.slice(0, 10) : '',
    });
  };

  const changeStatus = async (t, status) => {
    try {
      await api.patch(`/projects/${id}/tasks/${t._id}`, { status });
      await loadTasks();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update the status.');
    }
  };

  const removeTask = async (t) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    await api.delete(`/projects/${id}/tasks/${t._id}`);
    await loadTasks();
  };

  const removeProject = async () => {
    if (!window.confirm('Delete this project and all its tasks?')) return;
    await api.delete(`/projects/${id}`);
    navigate('/dashboard');
  };

  if (notFound) {
    return (
      <div style={{ maxWidth: 640, margin: '60px auto' }}>
        <h2>Project not found</h2>
        <Link to="/dashboard">Back to dashboard</Link>
      </div>
    );
  }
  if (!data) return <p>Loading...</p>;

  const { project, role } = data;
  const canManage = (t) => role === 'owner' || t.createdBy === user._id;
  const isOverdue = (t) => t.deadline && t.status !== 'done' && new Date(t.deadline) < new Date();

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', padding: '0 16px' }}>
      <Link to="/dashboard">← Back</Link>
      <h1>{project.name}</h1>
      <p>{project.description}</p>
      <p>
        <strong>Members:</strong>{' '}
        {project.members.map((m) => `${m.user.name} (${m.role})`).join(', ')}
      </p>

      <h2>{editingId ? 'Edit task' : 'New task'}</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title" maxLength={120} required />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" maxLength={1000} />
        <select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
          <option value="">Unassigned</option>
          {project.members.map((m) => (
            <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
          ))}
        </select>
        <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit">{editingId ? 'Save changes' : 'Add task'}</button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button>
          )}
        </div>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </form>

      <h2>Tasks</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {STATUSES.map((col) => (
          <div key={col.value}>
            <h3>{col.label} ({tasks.filter((t) => t.status === col.value).length})</h3>
            {tasks.filter((t) => t.status === col.value).map((t) => (
              <div key={t._id} style={{ border: `1px solid ${isOverdue(t) ? 'crimson' : '#ccc'}`, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <strong>{t.title}</strong>
                {t.description && <div>{t.description}</div>}
                <small>
                  {t.assignee ? `Assigned to ${t.assignee.name}` : 'Unassigned'}
                  {t.deadline && ` · Due ${new Date(t.deadline).toLocaleDateString()}`}
                  {isOverdue(t) && ' · OVERDUE'}
                </small>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {(canManage(t) || t.assignee?._id === user._id) && (
                    <select value={t.status} onChange={(e) => changeStatus(t, e.target.value)}>
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  )}
                  {canManage(t) && <button onClick={() => startEdit(t)}>Edit</button>}
                  {canManage(t) && <button onClick={() => removeTask(t)}>Delete</button>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {role === 'owner' && (
        <p style={{ marginTop: 32 }}>
          <button onClick={removeProject}>Delete project</button>
        </p>
      )}
    </div>
  );
}