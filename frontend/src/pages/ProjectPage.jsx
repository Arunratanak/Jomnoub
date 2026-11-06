import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar, { ProjectMark } from '../components/Avatar';
import ChatPanel from '../components/ChatPanel';
import Loading from '../components/Loading';
import ActivityPanel from '../components/ActivityPanel';
import Modal from '../components/Modal';
import TaskCard from '../components/TaskCard';
import TaskDetail from '../components/TaskDetail';
import TimelinePanel from '../components/TimelinePanel';
import EditProjectModal from '../components/EditProjectModal';
import { EditIcon, FolderIcon, LinkIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { getLastRead } from '../utils/chatRead';
import { projectGradient } from '../utils/colors';
import { isOverdue } from '../utils/dates';
import { notifyProjectsChanged, notifyTasksChanged } from '../utils/events';
import { confirmDialog, toast } from '../utils/feedback';
import { STATUSES } from '../utils/taskStatus';
import useTitle from '../utils/useTitle';

// The chart library is large, so it only loads when the Progress tab is opened
const ProjectStats = lazy(() => import('../components/ProjectStats'));

const UNREAD_CHECK_MS = 30000;
const emptyForm = { title: '', description: '', assignee: '', deadline: '' };
const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState(null); // 'notFound' | 'failed' | null
  const [form, setForm] = useState(emptyForm);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [initialAssignee, setInitialAssignee] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [filter, setFilter] = useState('all');
  const [dropColumn, setDropColumn] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberError, setMemberError] = useState('');
  const [projectForm, setProjectForm] = useState(null); // { name, description } once edited
  const [settingsMsg, setSettingsMsg] = useState(null); // { ok, text }
  const [editingProject, setEditingProject] = useState(false);
  const [invite, setInvite] = useState(null); // { url, expiresAt } right after generating
  const [inviteMsg, setInviteMsg] = useState('');
  const [activity, setActivity] = useState(null);
  const [activityError, setActivityError] = useState(false);
  const [unread, setUnread] = useState(false);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const checkedTask = useRef(null);
  const draggedId = useRef(null);
  const tab = params.get('tab') || 'board';
  const loaded = Boolean(data);
  useTitle(data ? data.project.name : loadError === 'notFound' ? 'Project not found' : 'Project');

  const setTab = (value) => setParams(value === 'board' ? {} : { tab: value }, { replace: true });

  // The open task lives in the URL (?task=...), so notifications can link straight to a
  // task or comment, links can be shared, and the browser's Back button closes it
  const detailId = params.get('task');
  const openTask = (task) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('task', task._id);
    next.delete('comment');
    return next;
  }, { state: { openedHere: true } });
  const closeTask = () => {
    // Opened from this page: step back, so closing doesn't leave an extra history entry
    if (location.state?.openedHere) {
      navigate(-1);
      return;
    }
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('task');
      next.delete('comment');
      return next;
    }, { replace: true });
  };

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
    setTasksLoaded(true);
  };

  // A link can point at a task this page hasn't loaded (just assigned to you) or one that
  // was deleted. Reload once to find out which.
  useEffect(() => {
    if (!detailId) checkedTask.current = null;
    if (!detailId || !tasksLoaded || tasks.some((t) => t._id === detailId)) return;
    if (checkedTask.current !== detailId) {
      checkedTask.current = detailId;
      loadTasks().catch(() => {});
      return;
    }
    toast('That task no longer exists.', 'error');
    closeTask();
  }, [detailId, tasks, tasksLoaded]);

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

  // Dot on the Chat tab when someone else wrote since this browser last opened the chat
  useEffect(() => {
    if (tab === 'chat' || !loaded) return undefined;
    const check = () => {
      if (document.hidden) return;
      api
        .get(`/projects/${id}/messages`, { params: { limit: 1 } })
        .then((res) => {
          const latest = res.data.messages[0];
          setUnread(Boolean(latest && latest.author?._id !== user._id && latest._id > getLastRead(id)));
        })
        .catch(() => {});
    };
    check();
    const timer = setInterval(check, UNREAD_CHECK_MS);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [id, tab, user._id, loaded]);

  const clearUnread = useCallback(() => setUnread(false), []);
  const closeProjectEdit = useCallback(() => setEditingProject(false), []);

  // Replaces one task in the list with the server's copy
  const applyTask = (task) => setTasks((list) => list.map((t) => (t._id === task._id ? task : t)));

  // ---------- Tasks ----------
  const openNewTask = () => {
    setEditingId(null);
    setForm(emptyForm);
    setInitialAssignee('');
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
      deadline: form.deadline || null,
    };
    // Only send the assignee if it changed, so editing other fields can't
    // accidentally accept or withdraw a pending suggestion
    if (!editingId || form.assignee !== initialAssignee) body.assignee = form.assignee || null;
    try {
      const res = editingId
        ? await api.patch(`/projects/${id}/tasks/${editingId}`, body)
        : await api.post(`/projects/${id}/tasks`, body);
      notifyTasksChanged();
      const suggested = res.data.task.suggestedBy && form.assignee !== initialAssignee && !isOwnerRole();
      toast(suggested ? 'Suggested to the owner. They need to confirm it.' : editingId ? 'Task saved.' : 'Task added.');
      closeTaskForm();
      await loadTasks();
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the task.'));
    }
  };

  const isOwnerRole = () => data?.role === 'owner';

  const startEdit = (t) => {
    const ownerMember = data.project.members.find((m) => m.role === 'owner');
    // A member sees their pending suggestion as "owner" selected; the owner sees it as unassigned
    const current = t.suggestedBy && !isOwnerRole() ? ownerMember?.user._id || '' : t.assignee?._id || '';
    setEditingId(t._id);
    setInitialAssignee(current);
    setForm({
      title: t.title,
      description: t.description || '',
      assignee: current,
      deadline: t.deadline ? t.deadline.slice(0, 10) : '',
    });
    setFormError('');
    setTaskFormOpen(true);
  };

  const changeStatus = async (t, status) => {
    if (t.status === status) return;
    setError('');
    setTasks((list) => list.map((x) => (x._id === t._id ? { ...x, status } : x))); // feels instant
    try {
      await api.patch(`/projects/${id}/tasks/${t._id}`, { status });
      notifyTasksChanged();
      await loadTasks();
    } catch (err) {
      setError(errorMessage(err, 'Could not update the status.'));
      loadTasks().catch(() => {});
    }
  };

  const removeTask = async (t) => {
    const ok = await confirmDialog({ title: 'Delete task?', message: `"${t.title}" and its subtasks will be removed.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      setError('');
      await api.delete(`/projects/${id}/tasks/${t._id}`);
      notifyTasksChanged();
      toast('Task deleted.');
      await loadTasks();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the task.'));
    }
  };

  const respondToSuggestion = async (t, action) => {
    try {
      setError('');
      await api.post(`/projects/${id}/tasks/${t._id}/suggestion/${action}`);
      notifyTasksChanged();
      toast(action === 'accept' ? 'Task assigned to you.' : 'Suggestion declined.');
      await loadTasks();
    } catch (err) {
      setError(errorMessage(err, 'Could not update the suggestion.'));
    }
  };

  const changeFileCount = (taskId, change) => {
    setTasks((list) => list.map((t) => (t._id === taskId ? { ...t, attachmentCount: (t.attachmentCount || 0) + change } : t)));
    loadActivity();
  };
  const onFileAdded = (taskId) => changeFileCount(taskId, 1);
  // The total the task window just read, which may include other people's new comments
  const setCommentTotal = (taskId, total) => {
    const current = tasks.find((t) => t._id === taskId);
    if (!current || (current.commentCount || 0) === total) return;
    setTasks((list) => list.map((t) => (t._id === taskId ? { ...t, commentCount: total } : t)));
    loadActivity();
  };
  const onCommentAdded = (taskId) => {
    setTasks((list) => list.map((t) => (t._id === taskId ? { ...t, commentCount: (t.commentCount || 0) + 1 } : t)));
    loadActivity();
  };

  const onTaskUpdated = (task) => {
    applyTask(task);
    notifyTasksChanged();
    loadActivity();
  };

  // ---------- Drag a card between columns ----------
  const onDragStart = (e, t) => {
    draggedId.current = t._id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', t._id); // required by Firefox
  };

  const onDrop = (e, status) => {
    e.preventDefault();
    setDropColumn(null);
    const t = tasks.find((x) => x._id === draggedId.current);
    draggedId.current = null;
    if (t) changeStatus(t, status);
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
    const ok = await confirmDialog({
      title: 'Delete this project?',
      message: 'This removes the project, its tasks and its chat for everyone. It can\'t be undone.',
      confirmLabel: 'Delete project',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/projects/${id}`);
      notifyProjectsChanged();
      notifyTasksChanged();
      toast('Project deleted.');
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
      toast('Member added.');
      loadActivity();
    } catch (err) {
      setMemberError(errorMessage(err, 'Could not add that member.'));
    }
  };

  const removeMember = async (m) => {
    const ok = await confirmDialog({
      title: `Remove ${m.user.name}?`,
      message: 'Their tasks here will become unassigned, and their suggestions will be withdrawn.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setMemberError('');
    try {
      await api.delete(`/projects/${id}/members/${m.user._id}`);
      notifyTasksChanged();
      toast(`${m.user.name} was removed.`);
      await Promise.all([loadProject(), loadTasks()]);
    } catch (err) {
      setMemberError(errorMessage(err, 'Could not remove that member.'));
    }
  };

  // ---------- Invite links ----------
  const generateInvite = async () => {
    if (invite) {
      const ok = await confirmDialog({ title: 'Generate a new link?', message: 'The current link will stop working.', confirmLabel: 'Generate' });
      if (!ok) return;
    }
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
      toast('Link copied.');
    } catch {
      setInviteMsg('Copy failed. Select the link and copy it manually.');
    }
  };

  const disableInvite = async () => {
    const ok = await confirmDialog({ title: 'Disable invite links?', message: 'Anyone with an old link won\'t be able to join.', confirmLabel: 'Disable', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/projects/${id}/invites`);
      setInvite(null);
      setInviteMsg('Invite links disabled.');
    } catch (err) {
      setInviteMsg(errorMessage(err, 'Could not disable the invite link.'));
    }
  };

  const leaveProject = async () => {
    const ok = await confirmDialog({ title: 'Leave this project?', message: 'Your tasks here will become unassigned.', confirmLabel: 'Leave', danger: true });
    if (!ok) return;
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
  const isAssignee = (t) => t.assignee?._id === user._id;
  const settings = projectForm || { name: project.name, description: project.description || '' };
  const ownerMember = project.members.find((m) => m.role === 'owner');
  const membersSorted = [...project.members].sort((a, b) => (a.role === b.role ? 0 : a.role === 'owner' ? -1 : 1));
  const pendingSuggestions = tasks.filter((t) => t.suggestedBy);
  const detailTask = tasks.find((t) => t._id === detailId);
  const assigningToOwner = !isOwner && ownerMember && form.assignee === ownerMember.user._id;

  const TABS = [
    { value: 'board', label: 'Board' },
    { value: 'timeline', label: 'Timeline' },
    { value: 'chat', label: 'Chat', dot: unread },
    { value: 'progress', label: 'Progress' },
    { value: 'members', label: `Members (${project.members.length})` },
    { value: 'activity', label: 'Activity' },
    ...(isOwner ? [{ value: 'settings', label: 'Settings' }] : []),
  ];

  const FILTERS = [
    { value: 'all', label: 'All', test: () => true },
    { value: 'mine', label: 'Assigned to me', test: isAssignee },
    { value: 'overdue', label: 'Overdue', test: isOverdue },
    { value: 'unassigned', label: 'Unassigned', test: (t) => !t.assignee },
    ...(pendingSuggestions.length ? [{ value: 'suggested', label: `Suggestions (${pendingSuggestions.length})`, test: (t) => t.suggestedBy }] : []),
  ];
  const activeFilter = FILTERS.find((f) => f.value === filter) || FILTERS[0];
  const visibleTasks = tasks.filter(activeFilter.test);

  return (
    <>
      <div className={`banner${tab === 'chat' ? ' hide-on-phone' : ''}`} style={{ background: projectGradient(project._id) }} />
      {tab === 'chat' && <h1 className="phone-only chat-title">{project.name}</h1>}

      <div className={`channel-head${tab === 'chat' ? ' hide-on-phone' : ''}`}>
        <ProjectMark id={project._id} name={project.name} size={72} radius={36} />
        <div className="channel-info">
          <h1>{project.name}</h1>
          <div className="muted">
            {isOwner ? 'Owner' : 'Member'} · {project.members.length} member{project.members.length === 1 ? '' : 's'} · {tasks.length} task{tasks.length === 1 ? '' : 's'}
          </div>
          {project.description && <p className="muted">{project.description}</p>}
        </div>
        <div className="channel-actions">
          {isOwner && (
            <button type="button" className="btn" onClick={() => setEditingProject(true)}><EditIcon size={18} /> Edit</button>
          )}
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
            {t.dot && <span className="tab-dot"><span className="sr-only"> (new messages)</span></span>}
          </button>
        ))}
      </div>

      {error && <p className="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {(tab === 'board' || tab === 'timeline') && (
        <>
          {isOwner && pendingSuggestions.length > 0 && filter !== 'suggested' && (
            <div className="notice notice-row">
              <span>
                <strong>{pendingSuggestions.length}</strong> task{pendingSuggestions.length === 1 ? ' was' : 's were'} suggested for you and {pendingSuggestions.length === 1 ? 'needs' : 'need'} your confirmation.
              </span>
              <button type="button" className="btn btn-sm" onClick={() => setFilter('suggested')}>Review</button>
            </div>
          )}

          <div className="chips" role="group" aria-label="Filter tasks">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`chip${activeFilter.value === f.value ? ' active' : ''}`}
                aria-pressed={activeFilter.value === f.value}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'timeline' && (
        <TimelinePanel
          tasks={tasks}
          filtered={visibleTasks}
          projectId={id}
          user={user}
          members={membersSorted}
          showDone={showDone}
          onShowDone={setShowDone}
          canChangeStatus={(t) => canManage(t) || isAssignee(t)}
          onOpen={openTask}
          onStatus={changeStatus}
          onCommentAdded={onCommentAdded}
          onFileAdded={onFileAdded}
        />
      )}

      {tab === 'board' && (
        <>
          <div className="board">
            {STATUSES.map((col) => {
              const items = visibleTasks.filter((t) => t.status === col.value);
              return (
                <div
                  key={col.value}
                  className={`column${dropColumn === col.value ? ' drop' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault(); // also stops a file dropped here from opening in the browser
                    if (draggedId.current) setDropColumn(col.value); // only highlight for task cards
                  }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropColumn(null); }}
                  onDrop={(e) => onDrop(e, col.value)}
                >
                  <div className="column-head">
                    <span className="dot" style={{ background: col.color }} aria-hidden="true" />
                    {col.label} <span className="muted" style={{ fontWeight: 400 }}>({items.length})</span>
                  </div>
                  {items.length === 0 && <p className="column-empty">{filter === 'all' ? 'No tasks here.' : 'No matching tasks.'}</p>}
                  {items.map((t) => (
                    <TaskCard
                      key={t._id}
                      projectId={id}
                      task={t}
                      onFileAdded={onFileAdded}
                      isOwner={isOwner}
                      canManage={canManage(t)}
                      canChangeStatus={isAssignee(t)}
                      draggable={canManage(t) || isAssignee(t)}
                      onOpen={openTask}
                      onStatus={changeStatus}
                      onEdit={startEdit}
                      onDelete={removeTask}
                      onSuggestion={respondToSuggestion}
                      onDragStart={onDragStart}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'chat' && <ChatPanel projectId={id} user={user} isOwner={isOwner} onSeen={clearUnread} />}

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
              {membersSorted.map((m) => (
                <li key={m.user._id} className="row">
                  <Avatar user={m.user} size={40} />
                  <div className="row-main">
                    <div>
                      <strong>{m.user.name}</strong>
                      {m.user._id === user._id && <span className="muted"> (you)</span>}
                    </div>
                    <small className="muted">{m.user.email}</small>
                  </div>
                  <span className={`role-badge${m.role === 'owner' ? ' owner' : ''}`}>{m.role === 'owner' ? 'Owner' : 'Member'}</span>
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
                  Only works for people whose Jomnoub email is verified. Anyone else can join with an invite link.
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
            <p className="muted" style={{ marginBottom: 12 }}>This removes the project, its tasks and its chat for everyone. It can't be undone.</p>
            <button type="button" className="btn btn-danger" onClick={removeProject}><TrashIcon size={18} /> Delete project</button>
          </div>
        </div>
      )}

      {detailTask && (
        <TaskDetail
          projectId={id}
          task={detailTask}
          user={user}
          isOwner={isOwner}
          canEditSubtasks={canManage(detailTask) || isAssignee(detailTask)}
          onUpdated={onTaskUpdated}
          onAttachmentCount={(change) => changeFileCount(detailTask._id, change)}
          onCommentCount={(total) => setCommentTotal(detailTask._id, total)}
          members={membersSorted}
          highlightCommentId={params.get('comment')}
          onClose={closeTask}
        />
      )}

      {editingProject && (
        <EditProjectModal
          projectId={id}
          name={project.name}
          description={project.description}
          onClose={closeProjectEdit}
          onSaved={(updated) => {
            setData({ ...data, project: updated });
            setProjectForm(null);
            setEditingProject(false);
            notifyProjectsChanged();
            toast('Project updated.');
          }}
        />
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
                {membersSorted.map((m) => (
                  <option key={m.user._id} value={m.user._id}>
                    {m.user.name}{m.role === 'owner' && !isOwner ? ' (owner, as a suggestion)' : ''}
                  </option>
                ))}
              </select>
              {assigningToOwner && (
                <small className="muted">You can't assign work to the owner directly. They'll get a suggestion to accept or decline.</small>
              )}
            </label>
            <label className="field">
              <span>Deadline</span>
              <input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </label>
            {formError && <p className="alert">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={closeTaskForm}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editingId ? 'Save changes' : assigningToOwner ? 'Add and suggest' : 'Add task'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
