import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProjectStats from '../components/ProjectStats';
import Loading from '../components/Loading';
import ActivityPanel from '../components/ActivityPanel';
import NotificationBell from '../components/NotificationBell';
import useTitle from '../utils/useTitle';
import { notifyTasksChanged } from '../utils/events';
import { isOverdue } from '../utils/dates';

const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];
const emptyForm = { title: '', description: '', assignee: '', deadline: '' };
const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState(null); // 'notFound' | 'failed' | null
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberError, setMemberError] = useState('');
  const [projectForm, setProjectForm] = useState(null); // { name, description } while editing
  const [invite, setInvite] = useState(null); // { url, expiresAt } right after generating
  const [inviteMsg, setInviteMsg] = useState('');
  const [activity, setActivity] = useState(null);
  const [activityError, setActivityError] = useState(false);
  useTitle(data ? data.project.name : loadError === 'notFound' ? 'Project not found' : 'Project');

  const loadProject = async () => {
    const res = await api.get(`/projects/${id}`);
    setData(res.data);
  };

  // Separate from tasks: a failed activity request must not break the task list
  const loadActivity = () =>
    api
      .get(`/projects/${id}/activity`)
      .then((res) => {
        setActivity(res.data.activity);
        setActivityError(false);
      })
      .catch(() => setActivityError(true));

  const loadTasks = async () => {
    loadActivity();
    const [t, s] = await Promise.all([
      api.get(`/projects/${id}/tasks`),
      api.get(`/projects/${id}/stats`),
    ]);
    setTasks(t.data.tasks);
    setStats(s.data.stats);
  };

  useEffect(() => {
    api
      .get(`/projects/${id}`)
      .then((res) => {
        setData(res.data);
        // The project loaded, so a failure here is a task/stats problem, not "not found"
        return loadTasks().catch((err) => setError(errorMessage(err, 'Could not load the tasks.')));
      })
      .catch((err) => setLoadError(err.response?.status === 404 ? 'notFound' : 'failed'));
  }, [id]);

  // ---------- Tasks ----------
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
      notifyTasksChanged();
      setForm(emptyForm);
      setEditingId(null);
      await loadTasks();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the task.'));
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
      setError('');
      await api.patch(`/projects/${id}/tasks/${t._id}`, { status });
      notifyTasksChanged();
      await loadTasks();
    } catch (err) {
      setError(errorMessage(err, 'Could not update the status.'));
    }
  };

  const removeTask = async (t) => {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    try {
      setError('');
      await api.delete(`/projects/${id}/tasks/${t._id}`);
      notifyTasksChanged();
      if (editingId === t._id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await loadTasks();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the task.'));
    }
  };

  // ---------- Project ----------
  const saveProject = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const res = await api.patch(`/projects/${id}`, projectForm);
      setData({ ...data, project: res.data.project });
      setProjectForm(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not save the project.'));
    }
  };

  const removeProject = async () => {
    if (!window.confirm('Delete this project and all its tasks?')) return;
    try {
      await api.delete(`/projects/${id}`);
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the project.'));
    }
  };

  // ---------- Members ----------
  const addMember = async (e) => {
    e.preventDefault();
    setMemberError('');
    try {
      const res = await api.post(`/projects/${id}/members`, { email: memberEmail });
      setData({ ...data, project: { ...data.project, members: res.data.members } });
      setMemberEmail('');
      loadActivity();
    } catch (err) {
      setMemberError(errorMessage(err, 'Could not add that member.'));
    }
  };

  const removeMember = async (m) => {
    if (!window.confirm(`Remove ${m.user.name} from this project? Their tasks here will become unassigned.`)) return;
    setMemberError('');
    try {
      await api.delete(`/projects/${id}/members/${m.user._id}`);
      notifyTasksChanged();
      await Promise.all([loadProject(), loadTasks()]);
    } catch (err) {
      setMemberError(errorMessage(err, 'Could not remove that member.'));
    }
  };

  // ---------- Invite links ----------
  const generateInvite = async () => {
    if (invite && !window.confirm('Generate a new link? The current link will stop working.')) return;
    setInviteMsg('');
    try {
      const res = await api.post(`/projects/${id}/invites`);
      setInvite({ url: `${window.location.origin}/invite/${res.data.token}`, expiresAt: res.data.expiresAt });
    } catch (err) {
      setInviteMsg(errorMessage(err, 'Could not create an invite link.'));
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invite.url);
      setInviteMsg('Link copied.');
    } catch {
      setInviteMsg('Copy failed. Select the link and copy it manually.');
    }
  };

  const disableInvite = async () => {
    if (!window.confirm('Disable invite links for this project? Anyone with an old link won\'t be able to join.')) return;
    try {
      await api.delete(`/projects/${id}/invites`);
      setInvite(null);
      setInviteMsg('Invite links disabled.');
    } catch (err) {
      setInviteMsg(errorMessage(err, 'Could not disable the invite link.'));
    }
  };

  const leaveProject = async () => {
    if (!window.confirm('Leave this project? Your tasks here will become unassigned.')) return;
    try {
      await api.delete(`/projects/${id}/members/${user._id}`);
      navigate('/dashboard');
    } catch (err) {
      setMemberError(errorMessage(err, 'Could not leave the project.'));
    }
  };

  if (loadError) {
    return (
      <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 16px' }}>
        <h2>{loadError === 'notFound' ? 'Project not found' : 'Could not load this project'}</h2>
        {loadError === 'failed' && <p>Check your connection and refresh the page.</p>}
        <Link to="/dashboard">Back to dashboard</Link>
      </div>
    );
  }
  if (!data) return <Loading />;

  const { project, role } = data;
  const isOwner = role === 'owner';
  const canManage = (t) => isOwner || t.createdBy === user._id;

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Link to="/dashboard">← Back</Link>
        <NotificationBell />
      </div>

      {projectForm ? (
        <form onSubmit={saveProject} style={{ display: 'grid', gap: 8, maxWidth: 480, margin: '16px 0' }}>
          <input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} maxLength={100} required />
          <textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="Description (optional)" maxLength={500} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">Save</button>
            <button type="button" onClick={() => setProjectForm(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <h1 style={{ overflowWrap: 'anywhere' }}>{project.name}</h1>
          <p style={{ overflowWrap: 'anywhere' }}>{project.description}</p>
          {isOwner && (
            <button onClick={() => setProjectForm({ name: project.name, description: project.description || '' })}>
              Edit project
            </button>
          )}
        </>
      )}

      <section style={{ margin: '24px 0' }}>
        <h2>Members ({project.members.length})</h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
          {project.members.map((m) => (
            <li key={m.user._id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', overflowWrap: 'anywhere' }}>
              <span>
                <strong>{m.user.name}</strong> <small>{m.user.email} · {m.role}</small>
              </span>
              {isOwner && m.role !== 'owner' && (
                <button onClick={() => removeMember(m)} style={{ marginLeft: 'auto' }}>Remove</button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <form onSubmit={addMember} style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="Teammate's Google email"
              required
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="submit">Add member</button>
          </form>
        )}
        {isOwner && <p><small>Adding by email only works for people who have signed in to TaskHub before. Otherwise, send them an invite link.</small></p>}

        {isOwner && (
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, maxWidth: 560, margin: '12px 0' }}>
            <strong>Invite link</strong>
            <p style={{ margin: '4px 0 8px' }}>
              <small>Anyone with the link can join as a member for 7 days. Only share it with your team.</small>
            </p>
            {invite && (
              <>
                <input readOnly value={invite.url} onFocus={(e) => e.target.select()} style={{ width: '100%', boxSizing: 'border-box' }} />
                <p style={{ margin: '4px 0' }}><small>Expires {new Date(invite.expiresAt).toLocaleString()}</small></p>
              </>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={generateInvite}>{invite ? 'Generate new link' : 'Generate invite link'}</button>
              {invite && <button onClick={copyInvite}>Copy link</button>}
              <button onClick={disableInvite}>Disable links</button>
            </div>
            {inviteMsg && <p style={{ margin: '8px 0 0' }}><small>{inviteMsg}</small></p>}
          </div>
        )}
        {!isOwner && <button onClick={leaveProject}>Leave project</button>}
        {memberError && <p style={{ color: 'crimson' }}>{memberError}</p>}
      </section>

      <ProjectStats stats={stats} />
      <p><Link to={`/projects/${id}/timeline`}>View timeline →</Link></p>

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
              <div key={t._id} style={{ border: `1px solid ${isOverdue(t) ? 'crimson' : '#ccc'}`, borderRadius: 8, padding: 10, marginBottom: 8, overflowWrap: 'anywhere' }}>
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

      <ActivityPanel activity={activity} error={activityError} />

      {isOwner && (
        <p style={{ marginTop: 32 }}>
          <button onClick={removeProject}>Delete project</button>
        </p>
      )}
    </div>
  );
}
