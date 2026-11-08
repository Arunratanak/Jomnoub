import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'motion/react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AssigneePicker from '../components/AssigneePicker';
import Avatar, { ProjectMark } from '../components/Avatar';
import BoardProgress from '../components/BoardProgress';
import ChatPanel from '../components/ChatPanel';
import Loading from '../components/Loading';
import ActivityPanel from '../components/ActivityPanel';
import Modal from '../components/Modal';
import TaskCard from '../components/TaskCard';
import TaskDetail from '../components/TaskDetail';
import TimelinePanel from '../components/TimelinePanel';
import TodoGroups from '../components/TodoGroups';
import EditProjectModal from '../components/EditProjectModal';
import { EditIcon, FolderIcon, LinkIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { getLastRead } from '../utils/chatRead';
import { debounce, isAbout, useLiveChanges, useLiveStatus } from '../utils/live';
import { projectGradient } from '../utils/colors';
import { isOverdue } from '../utils/dates';
import { notifyProjectsChanged, notifyTasksChanged } from '../utils/events';
import { confirmDialog, toast } from '../utils/feedback';
import { groupByPeople, splitTodo, STATUSES, statusLabel, taskPeople } from '../utils/taskStatus';
import useTitle from '../utils/useTitle';

// The chart library is large, so it only loads when the Progress tab is opened
const ProjectStats = lazy(() => import('../components/ProjectStats'));

const UNREAD_CHECK_MS = 30000;
const FALLBACK_CHECK_MS = 8000; // only while live updates aren't getting through
const MOVED_HIGHLIGHT_MS = 900;
const CARD_SPRING = { type: 'spring', stiffness: 380, damping: 34 };
const SHOW_TEAMMATES_KEY = 'jomnoub:show-teammates';

// Only a convenience, so it has to work when browser storage doesn't
function loadShowTeammates() {
  try {
    return localStorage.getItem(SHOW_TEAMMATES_KEY) === '1';
  } catch {
    return false;
  }
}
const emptyForm = { title: '', description: '', assignees: [], separate: false, deadline: '' };
const sameIds = (a, b) => a.length === b.length && a.every((id) => b.includes(id));
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
  const [initialAssignees, setInitialAssignees] = useState([]);
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
  const [chatSignal, setChatSignal] = useState(0); // a live "new message" nudge for the Chat tab's dot
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [showTeammates, setShowTeammates] = useState(loadShowTeammates);
  const [movedId, setMovedId] = useState(null); // the card that just changed column
  const [leavingId, setLeavingId] = useState(null); // the card fading out after being deleted
  const [draggingId, setDraggingId] = useState(null);
  const movedTimer = useRef(null);
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
  // Moving to another task replaces this one in history, so Back still closes the window
  const goToTask = (task) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('task', task._id);
    next.delete('comment');
    return next;
  }, { replace: true, state: location.state });
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
  }, [id, tab, user._id, loaded, chatSignal]);

  const clearUnread = useCallback(() => setUnread(false), []);

  // ---------- Live updates: teammates' changes appear without reloading ----------
  const latestLoad = useRef(null);
  useEffect(() => {
    latestLoad.current = () => loadTasks().catch(() => {});
  });
  // Several changes in a row (e.g. a copy for each member) reload once
  const refreshBoardSoon = useRef(null);
  useEffect(() => {
    const soon = debounce(() => latestLoad.current?.(), 250);
    refreshBoardSoon.current = soon;
    return soon.cancel;
  }, []);

  // Renamed, members changed, deleted, or this person was removed (then it shows "not found")
  const reloadProject = () =>
    api
      .get(`/projects/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => { if (err.response?.status === 404) setLoadError('notFound'); });

  useLiveChanges((change) => {
    if (!isAbout(change, id)) return;
    if (change.type === 'resync' || ['project', 'members', 'access'].includes(change.area)) reloadProject();
    if (change.type === 'resync' || change.area === 'chat') setChatSignal((n) => n + 1);
    if (change.area !== 'chat') refreshBoardSoon.current?.();
  });

  // If live updates aren't getting through, check by ourselves every few seconds
  const liveStatus = useLiveStatus();
  useEffect(() => {
    if (liveStatus === 'live' || !loaded) return undefined;
    const timer = setInterval(() => { if (!document.hidden) latestLoad.current?.(); }, FALLBACK_CHECK_MS);
    return () => clearInterval(timer);
  }, [liveStatus, loaded]);
  const closeProjectEdit = useCallback(() => setEditingProject(false), []);

  // Replaces one task in the list with the server's copy
  const applyTask = (task) => setTasks((list) => list.map((t) => (t._id === task._id ? task : t)));

  // ---------- Tasks ----------
  const openNewTask = () => {
    setEditingId(null);
    setForm(emptyForm);
    setInitialAssignees([]);
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
    // Only send the people if they changed, so editing other fields can't
    // accidentally accept or withdraw a pending suggestion
    const peopleChanged = !sameIds(form.assignees, initialAssignees);
    if (!editingId || peopleChanged) body.assignees = form.assignees;
    if (!editingId && form.separate && form.assignees.length > 1) body.separate = true;
    try {
      const res = editingId
        ? await api.patch(`/projects/${id}/tasks/${editingId}`, body)
        : await api.post(`/projects/${id}/tasks`, body);
      if (res.data.tasks) {
        toast(`Added a copy for each of ${res.data.tasks.length} people.`);
      } else {
        const suggested = res.data.task.suggestedBy && peopleChanged && !isOwnerRole();
        const others = res.data.task.assignees.length > 0;
        toast(suggested
          ? (others ? 'Task saved. The owner was asked to confirm joining it.' : 'Suggested to the owner. They need to confirm it.')
          : editingId ? 'Task saved.' : 'Task added.');
      }
      notifyTasksChanged();
      // Don't let a task just given to teammates vanish into the folded list
      if (form.assignees.some((a) => a !== user._id) && !form.assignees.includes(user._id)) changeShowTeammates(true);
      closeTaskForm();
      await loadTasks();
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the task.'));
    }
  };

  const isOwnerRole = () => data?.role === 'owner';

  const changeShowTeammates = (value) => {
    setShowTeammates(value);
    try {
      localStorage.setItem(SHOW_TEAMMATES_KEY, value ? '1' : '0');
    } catch {
      // Stays open or closed for this visit only
    }
  };

  const startEdit = (t) => {
    const ownerMember = data.project.members.find((m) => m.role === 'owner');
    // A pending suggestion is shown as ticked for the owner
    const current = taskPeople(t, ownerMember?.user).map((p) => p._id);
    setEditingId(t._id);
    setInitialAssignees(current);
    setForm({
      title: t.title,
      description: t.description || '',
      assignees: current,
      separate: false,
      deadline: t.deadline ? t.deadline.slice(0, 10) : '',
    });
    setFormError('');
    setTaskFormOpen(true);
  };

  const changeStatus = async (t, status, { isUndo = false, inTaskWindow = false } = {}) => {
    if (t.status === status) return;
    const previous = t.status;
    setError('');
    setTasks((list) => list.map((x) => (x._id === t._id ? { ...x, status } : x))); // feels instant
    setMovedId(t._id);
    clearTimeout(movedTimer.current);
    movedTimer.current = setTimeout(() => setMovedId(null), MOVED_HIGHLIGHT_MS);
    try {
      await api.patch(`/projects/${id}/tasks/${t._id}`, { status });
      notifyTasksChanged();
      if (isUndo) {
        toast(`Moved back to ${statusLabel(status)}.`);
      } else {
        toast(`Moved to ${statusLabel(status)}.`, 'success', {
          label: 'Undo',
          onClick: () => changeStatus({ ...t, status }, previous, { isUndo: true }),
        });
      }
      await loadTasks();
    } catch (err) {
      const message = errorMessage(err, 'Could not update the status.');
      // Undo can be pressed after leaving this page, and the task window covers the page,
      // so an inline error wouldn't be seen in either case
      if (isUndo || inTaskWindow) toast(message, 'error');
      else setError(message);
      loadTasks().catch(() => {});
    }
  };

  const removeTask = async (t) => {
    const ok = await confirmDialog({ title: 'Delete task?', message: `"${t.title}" and its subtasks will be removed.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      setError('');
      await api.delete(`/projects/${id}/tasks/${t._id}`);
      setLeavingId(t._id);
      notifyTasksChanged();
      toast('Task deleted.');
      await loadTasks();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the task.'));
    } finally {
      setLeavingId(null);
    }
  };

  // A member picking up a task nobody has
  const takeTask = async (t) => {
    try {
      setError('');
      const res = await api.post(`/projects/${id}/tasks/${t._id}/take`);
      applyTask(res.data.task);
      setMovedId(t._id);
      clearTimeout(movedTimer.current);
      movedTimer.current = setTimeout(() => setMovedId(null), MOVED_HIGHLIGHT_MS);
      notifyTasksChanged();
      toast('It\'s yours now. You can start it whenever you\'re ready.');
      loadActivity();
    } catch (err) {
      const message = errorMessage(err, 'Could not take the task.');
      if (detailId) toast(message, 'error');
      else setError(message);
      loadTasks().catch(() => {});
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
    setTimeout(() => setDraggingId(t._id)); // after the browser has taken its picture of the card
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setDropColumn(null);
    draggedId.current = null;
  };

  const onDrop = (e, status) => {
    e.preventDefault();
    setDropColumn(null);
    setDraggingId(null);
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
  // Same rule as the server: the owner can do anything; a member only to their own tasks,
  // meaning ones they're on, or ones they created with nobody else assigned
  const canManage = (t) => isOwner || (t.assignees.length ? t.assignees.some((a) => a._id === user._id) : t.createdBy === user._id);
  const isAssignee = (t) => t.assignees.some((a) => a._id === user._id);
  // A suggestion for the owner alone has to be accepted before anyone works on it
  const canMove = (t) => !(t.suggestedBy && !t.assignees.length) && canManage(t);
  // Members can pick up a task nobody has, when they couldn't otherwise work on it
  const canTake = (t) => !isOwner && !t.assignees.length && !t.suggestedBy && !canManage(t);
  const settings = projectForm || { name: project.name, description: project.description || '' };
  const ownerMember = project.members.find((m) => m.role === 'owner');
  const peopleOf = (t) => taskPeople(t, ownerMember?.user);
  const membersSorted = [...project.members].sort((a, b) => (a.role === b.role ? 0 : a.role === 'owner' ? -1 : 1));
  const pendingSuggestions = tasks.filter((t) => t.suggestedBy);
  const detailTask = tasks.find((t) => t._id === detailId);
  const assigningToOwner = !isOwner && ownerMember && form.assignees.includes(ownerMember.user._id);
  const makingCopies = !editingId && form.separate && form.assignees.length > 1;

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
    { value: 'unassigned', label: 'Unassigned', test: (t) => peopleOf(t).length === 0 },
    ...(pendingSuggestions.length ? [{ value: 'suggested', label: `Suggestions (${pendingSuggestions.length})`, test: (t) => t.suggestedBy }] : []),
  ];
  const activeFilter = FILTERS.find((f) => f.value === filter) || FILTERS[0];
  const visibleTasks = tasks.filter(activeFilter.test);
  const isMine = (t) => peopleOf(t).some((p) => p._id === user._id);
  const inColumn = (status) => visibleTasks
    .filter((t) => t.status === status)
    .sort((a, b) => isMine(b) - isMine(a)); // your own first

  // Cards only re-measure when this changes, not on every keystroke elsewhere on the page
  const boardLayoutKey = `${showTeammates}|${visibleTasks.map((t) => `${t._id}:${t.status}:${peopleOf(t).map((p) => p._id).join('+')}`).join()}`;

  // The tasks the window's Previous and Next step through, in the order the column shows them
  const detailSiblings = (() => {
    if (!detailTask) return [];
    const items = inColumn(detailTask.status);
    if (detailTask.status !== 'todo' || filter !== 'all') return items;
    const { mine, open, teammates } = splitTodo(items, peopleOf, user._id);
    const includeTeammates = showTeammates || teammates.includes(detailTask);
    const grouped = groupByPeople(teammates, peopleOf).flatMap((g) => g.tasks);
    return [...mine, ...open, ...(includeTeammates ? grouped : [])];
  })();

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
            {tab === t.value && <Motion.span layoutId="tab-underline" className="tab-underline" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          </button>
        ))}
      </div>

      {error && <p className="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {tab === 'chat' && <ChatPanel projectId={id} user={user} isOwner={isOwner} onSeen={clearUnread} />}

      {/* Chat stays outside: it sizes itself to the screen, and has no need to fade in */}
      {tab !== 'chat' && (
      <Motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
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
          canChangeStatus={canMove}
          peopleOf={peopleOf}
          onOpen={openTask}
          onStatus={changeStatus}
          onCommentAdded={onCommentAdded}
          onFileAdded={onFileAdded}
        />
      )}

      {tab === 'board' && (
        <>
          <BoardProgress tasks={tasks} />
          <div className={`board${draggingId ? ' is-dragging' : ''}`}>
            {STATUSES.map((col) => {
              const items = inColumn(col.value);
              // The wrapper animates and the card keeps the browser's own dragging, which
              // Motion would take over if the two were the same element
              const renderCard = (t) => (
                <Motion.div
                  key={t._id}
                  className="task-slot"
                  layout="position"
                  layoutId={`task-${t._id}`}
                  layoutDependency={boardLayoutKey}
                  initial={movedId === t._id ? false : { opacity: 0, y: 8 }}
                  animate={leavingId === t._id ? { opacity: 0, scale: 0.95 } : { opacity: 1, y: 0, scale: 1 }}
                  transition={CARD_SPRING}
                  style={movedId === t._id ? { position: 'relative', zIndex: 5 } : undefined}
                >
                  <TaskCard
                    projectId={id}
                    task={t}
                    people={peopleOf(t)}
                    isMine={isMine(t)}
                    canTake={canTake(t)}
                    onTake={takeTask}
                    onFileAdded={onFileAdded}
                    isOwner={isOwner}
                    canManage={canManage(t)}
                    canChangeStatus={canMove(t)}
                    draggable={canMove(t)}
                    justMoved={movedId === t._id}
                    beingDragged={draggingId === t._id}
                    onOpen={openTask}
                    onStatus={changeStatus}
                    onEdit={startEdit}
                    onDelete={removeTask}
                    onSuggestion={respondToSuggestion}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                </Motion.div>
              );
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
                  {/* With a filter on, the person asked to see those tasks, so nothing is folded */}
                  {items.length > 0 && col.value === 'todo' && filter === 'all' ? (
                    <TodoGroups
                      tasks={items}
                      peopleOf={peopleOf}
                      currentUserId={user._id}
                      showTeammates={showTeammates}
                      onToggle={() => changeShowTeammates(!showTeammates)}
                      renderCard={renderCard}
                    />
                  ) : items.map(renderCard)}
                </div>
              );
            })}
          </div>
        </>
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
                  Anyone with the link can join as a member for 7 days. Only share it with your team. Generating a new link turns off any earlier one, including the one made with the project.
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
      </Motion.div>
      )}

      <AnimatePresence>
      {detailTask && (
        <TaskDetail
          key="task-window"
          projectId={id}
          task={detailTask}
          user={user}
          isOwner={isOwner}
          siblings={detailSiblings}
          canChangeStatus={canMove(detailTask)}
          onStatus={(t, status) => changeStatus(t, status, { inTaskWindow: true })}
          onNavigate={goToTask}
          canEditSubtasks={canManage(detailTask)}
          onUpdated={onTaskUpdated}
          onAttachmentCount={(change) => changeFileCount(detailTask._id, change)}
          onCommentCount={(total) => setCommentTotal(detailTask._id, total)}
          members={membersSorted}
          people={peopleOf(detailTask)}
          canTake={canTake(detailTask)}
          onTake={takeTask}
          highlightCommentId={params.get('comment')}
          onClose={closeTask}
        />
      )}

      {editingProject && (
        <EditProjectModal
          key="edit-project"
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
        <Modal key="task-form" title={editingId ? 'Edit task' : 'New task'} onClose={closeTaskForm}>
          <form className="form" onSubmit={submit}>
            <label className="field">
              <span>Title</span>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} required autoFocus />
            </label>
            <label className="field">
              <span>Description (optional)</span>
              <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} />
            </label>
            <div className="field">
              <span id="assignee-label">Assignee</span>
              <AssigneePicker
                members={membersSorted}
                value={form.assignees}
                onChange={(assignees) => setForm({ ...form, assignees })}
                separate={form.separate}
                onSeparateChange={(separate) => setForm({ ...form, separate })}
                canSeparate={!editingId}
                labelledBy="assignee-label"
                currentUserId={user._id}
                isOwner={isOwner}
              />
              {assigningToOwner && (
                <small className="muted">You can't assign work to the owner directly. They'll get a suggestion to accept or decline{makingCopies ? ' for their copy' : ''}.</small>
              )}
            </div>
            <label className="field">
              <span>Deadline</span>
              <input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </label>
            {formError && <p className="alert">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={closeTaskForm}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editingId ? 'Save changes' : makingCopies ? `Add ${form.assignees.length} copies` : assigningToOwner ? 'Add and suggest' : 'Add task'}</button>
            </div>
          </form>
        </Modal>
      )}
      </AnimatePresence>
    </>
  );
}
