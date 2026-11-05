import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar, { ProjectMark } from '../components/Avatar';
import Loading from '../components/Loading';
import ActivityPanel from '../components/ActivityPanel';
import Modal from '../components/Modal';
import { AlertIcon, CalendarIcon, EditIcon, FolderIcon, LinkIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { projectGradient } from '../utils/colors';
import useTitle from '../utils/useTitle';
import { notifyProjectsChanged, notifyTasksChanged } from '../utils/events';
import { isOverdue } from '../utils/dates';

// The chart library is large, so it only loads when the Progress tab is opened
const ProjectStats = lazy(() => import('../components/ProjectStats'));

const STATUSES = [
  { value: 'todo', label: 'To do', color: 'var(--status-todo)' },
  { value: 'in-progress', label: 'In progress', color: 'var(--status-progress)' },
  { value: 'done', label: 'Done', color: 'var(--status-done)' },
];
const emptyForm = { title: '', description: '', assignee: '', deadline: '' };
const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

function TaskCard({ task: t, canManage, canChangeStatus, onStatus, onEdit, onDelete }) {
  const overdue = isOverdue(t);
  return (
    <div className={`task-card${overdue ? ' overdue' : ''}`}>
      <div className="task-title">{t.title}</div>
      {t.description && <div className="task-desc">{t.description}</div>}
      {t.deadline && (
        <span className={`due${overdue ? ' overdue' : ''}`}>
          {overdue ? <AlertIcon size={14} /> : <CalendarIcon size={14} />}
          {overdue ? 'Overdue · was due' : 'Due'} {new Date(t.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}
        </span>
      )}
      <div className="task-people">
        <Avatar user={t.assignee} size={24} />
        <span>{t.assignee ? t.assignee.name : 'Unassigned'}</span>
      </div>
      {(canManage || canChangeStatus) && (
        <div className="task-actions">
          <select
            className="select select-sm"
            value={t.status}
            onChange={(e) => onStatus(t, e.target.value)}
            aria-label={`Status of ${t.title}`}
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {canManage && (
            <>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => onEdit(t)} aria-label={`Edit ${t.title}`} title="Edit">
                <EditIcon size={18} />
              </button>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => onDelete(t)} aria-label={`Delete ${t.title}`} title="Delete">
                <TrashIcon size={18} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState(null); // 'notFound' | 'failed' | null
  const [tab, setTab] = useState('board');
  const [form, setForm] = useState(emptyForm);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberError, setMemberError] = useState('');
  const [projectForm, setProjectForm] = useState(null); // { name, description } once edited
  const [settingsMsg, setSettingsMsg] = useState(null); // { ok, text }
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
  const openNewTask = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setTaskFormOpen(true);
    setTab('board');
  };

  const closeTaskForm = useCallback(() => {
    setTaskFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
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
      closeTaskForm();
      await loadTasks();
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the task.'));
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
    setFormError('');
    setTaskFormOpen(true);
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
      await loadTasks();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the task.'));
    }
  };

  // ---------- Project ----------
  const saveProject = async (e, values) => {
    e.preventDefault();
    setSettingsMsg(null);
    try {
      const res = await api.patch(`/projects/${id}`, values);
      setData({ ...data, project: res.data.project });
      setProjectForm(null);
      setSettingsMsg({ ok: true, text: 'Changes saved.' });
      notifyProjectsChanged();
    } catch (err) {
      setSettingsMsg({ ok: false, text: errorMessage(err, 'Could not save the project.') });
    }
  };

  const removeProject = async () => {
    if (!window.confirm('Delete this project and all its tasks?')) return;
    try {
      await api.delete(`/projects/${id}`);
      notifyProjectsChanged();
      notifyTasksChanged();
      navigate('/dashboard');
    } catch (err) {
      setSettingsMsg({ ok: false, text: errorMessage(err, 'Could not delete the project.') });
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
      notifyProjectsChanged();
      notifyTasksChanged();
      navigate('/dashboard');
    } catch (err) {
      setMemberError(errorMessage(err, 'Could not leave the project.'));
    }
  };

  if (loadError) {
    return (
      <div className="empty">
        <FolderIcon />
        <h2>{loadError === 'notFound' ? 'Project not found' : 'Could not load this project'}</h2>
        {loadError === 'failed' && <p>Check your connection and refresh the page.</p>}
        <Link className="btn" to="/dashboard">Back to home</Link>
      </div>
    );
  }
  if (!data) return <Loading />;

  const { project, role } = data;
  const isOwner = role === 'owner';
  const canManage = (t) => isOwner || t.createdBy === user._id;
  const settings = projectForm || { name: project.name, description: project.description || '' };

  const TABS = [
    { value: 'board', label: 'Board' },
    { value: 'progress', label: 'Progress' },
    { value: 'members', label: `Members (${project.members.length})` },
    { value: 'activity', label: 'Activity' },
    ...(isOwner ? [{ value: 'settings', label: 'Settings' }] : []),
  ];

  return (
    <>
      <div className="banner" style={{ background: projectGradient(project._id) }} />

      <div className="channel-head">
        <ProjectMark id={project._id} name={project.name} size={72} radius={36} />
        <div className="channel-info">
          <h1>{project.name}</h1>
          <div className="muted">
            {isOwner ? 'Owner' : 'Member'} · {project.members.length} member{project.members.length === 1 ? '' : 's'} · {tasks.length} task{tasks.length === 1 ? '' : 's'}
          </div>
          {project.description && <p className="muted">{project.description}</p>}
        </div>
        <div className="channel-actions">
          <Link className="btn" to={`/projects/${id}/timeline`}><CalendarIcon size={18} /> Timeline</Link>
          <button type="button" className="btn btn-primary" onClick={openNewTask}><PlusIcon size={18} /> Add task</button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Project sections">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={`tab${tab === t.value ? ' active' : ''}`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {tab === 'board' && (
        <div className="board">
          {STATUSES.map((col) => {
            const items = tasks.filter((t) => t.status === col.value);
            return (
              <div key={col.value} className="column">
                <div className="column-head">
                  <span className="dot" style={{ background: col.color }} aria-hidden="true" />
                  {col.label} <span className="muted" style={{ fontWeight: 400 }}>({items.length})</span>
                </div>
                {items.length === 0 && <p className="column-empty">No tasks here.</p>}
                {items.map((t) => (
                  <TaskCard
                    key={t._id}
                    task={t}
                    canManage={canManage(t)}
                    canChangeStatus={t.assignee?._id === user._id}
                    onStatus={changeStatus}
                    onEdit={startEdit}
                    onDelete={removeTask}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'progress' && (
        <Suspense fallback={<Loading />}>
          <ProjectStats stats={stats} />
        </Suspense>
      )}

      {tab === 'members' && (
        <div className="two-col">
          <div className="card">
            <h2 style={{ marginBottom: 8 }}>Members</h2>
            <ul>
              {project.members.map((m) => (
                <li key={m.user._id} className="row">
                  <Avatar user={m.user} size={40} />
                  <div className="row-main">
                    <div><strong>{m.user.name}</strong></div>
                    <small className="muted">{m.user.email} · {m.role}</small>
                  </div>
                  {isOwner && m.role !== 'owner' && (
                    <button type="button" className="btn btn-sm" onClick={() => removeMember(m)}>Remove</button>
                  )}
                </li>
              ))}
            </ul>
            {!isOwner && (
              <button type="button" className="btn btn-danger" style={{ marginTop: 12 }} onClick={leaveProject}>Leave project</button>
            )}
            {memberError && !isOwner && <p className="alert" style={{ marginTop: 12 }}>{memberError}</p>}
          </div>

          {isOwner && (
            <div className="stack">
              <div className="card">
                <h2 style={{ marginBottom: 4 }}><LinkIcon size={18} /> Invite link</h2>
                <p className="muted" style={{ marginBottom: 12 }}>
                  Anyone with the link can join as a member for 7 days. Only share it with your team.
                </p>
                {invite && (
                  <div style={{ marginBottom: 12 }}>
                    <input
                      className="input"
                      readOnly
                      value={invite.url}
                      onFocus={(e) => e.target.select()}
                      aria-label="Invite link"
                    />
                    <small className="muted">Expires {new Date(invite.expiresAt).toLocaleString()}</small>
                  </div>
                )}
                <div className="channel-actions">
                  <button type="button" className="btn btn-primary" onClick={generateInvite}>{invite ? 'Generate new link' : 'Generate invite link'}</button>
                  {invite && <button type="button" className="btn" onClick={copyInvite}>Copy link</button>}
                  <button type="button" className="btn" onClick={disableInvite}>Disable links</button>
                </div>
                {inviteMsg && <p className="muted" style={{ marginTop: 8 }}>{inviteMsg}</p>}
              </div>

              <div className="card">
                <h2 style={{ marginBottom: 4 }}>Add by email</h2>
                <p className="muted" style={{ marginBottom: 12 }}>
                  Only works for people who have signed in to TaskHub before. Otherwise, send an invite link.
                </p>
                <form onSubmit={addMember} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    className="input"
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="Teammate's Google email"
                    aria-label="Teammate's Google email"
                    required
                    style={{ flex: '1 1 200px', minWidth: 0 }}
                  />
                  <button type="submit" className="btn">Add member</button>
                </form>
                {memberError && <p className="alert" style={{ marginTop: 12 }}>{memberError}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && <ActivityPanel activity={activity} error={activityError} />}

      {tab === 'settings' && isOwner && (
        <div className="stack" style={{ maxWidth: 560 }}>
          <form className="card form" onSubmit={(e) => saveProject(e, settings)}>
            <h2>Project details</h2>
            <label className="field">
              <span>Name</span>
              <input className="input" value={settings.name} onChange={(e) => setProjectForm({ ...settings, name: e.target.value })} maxLength={100} required />
            </label>
            <label className="field">
              <span>Description (optional)</span>
              <textarea className="textarea" value={settings.description} onChange={(e) => setProjectForm({ ...settings, description: e.target.value })} maxLength={500} />
            </label>
            {settingsMsg && <p className={settingsMsg.ok ? 'notice' : 'alert'}>{settingsMsg.text}</p>}
            <div className="form-actions"><button type="submit" className="btn btn-primary">Save changes</button></div>
          </form>
          <div className="card">
            <h2 style={{ marginBottom: 4 }}>Delete project</h2>
            <p className="muted" style={{ marginBottom: 12 }}>This removes the project and all its tasks for everyone. It can't be undone.</p>
            <button type="button" className="btn btn-danger" onClick={removeProject}><TrashIcon size={18} /> Delete project</button>
          </div>
        </div>
      )}

      {taskFormOpen && (
        <Modal title={editingId ? 'Edit task' : 'New task'} onClose={closeTaskForm}>
          <form className="form" onSubmit={submit}>
            <label className="field">
              <span>Title</span>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} required autoFocus />
            </label>
            <label className="field">
              <span>Description (optional)</span>
              <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
            </label>
            <label className="field">
              <span>Assignee</span>
              <select className="select" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
                <option value="">Unassigned</option>
                {project.members.map((m) => (
                  <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Deadline</span>
              <input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </label>
            {formError && <p className="alert">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={closeTaskForm}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editingId ? 'Save changes' : 'Add task'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
