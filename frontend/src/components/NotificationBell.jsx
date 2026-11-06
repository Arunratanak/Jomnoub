import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import Avatar from './Avatar';
import { BellIcon } from './Icons';
import { isOverdue, needsAttention, timeAgo } from '../utils/dates';
import { TASKS_CHANGED } from '../utils/events';
import useClickOutside from '../utils/useClickOutside';

const MAX_ATTENTION = 5;
const CHECK_MS = 30000; // while the page is visible, so new notifications arrive by themselves

function dueText(t) {
  const due = new Date(t.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' });
  return isOverdue(t) ? `Overdue · was due ${due}` : `Due ${due}`;
}

function linkFor(n) {
  if (!n.project?._id || n.type === 'removed') return '/dashboard';
  if (!n.task) return `/projects/${n.project._id}`;
  return `/projects/${n.project._id}?task=${n.task}${n.comment ? `&comment=${n.comment}` : ''}`;
}

// The inbox (assignments, mentions, comments...) plus what needs attention right now:
// tasks due soon and suggestions waiting for a decision.
export default function NotificationBell() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  useEffect(() => {
    let active = true;
    const load = () => {
      if (document.hidden) return;
      Promise.all([api.get('/my-tasks'), api.get('/notifications')])
        .then(([mine, inbox]) => {
          if (!active) return;
          setTasks(mine.data.tasks.filter(needsAttention));
          setSuggestions(mine.data.suggestions || []);
          setNotifications(inbox.data.notifications);
          setUnread(inbox.data.unreadCount);
          setError(false);
        })
        .catch(() => active && setError(true));
    };

    load();
    const timer = setInterval(load, CHECK_MS);
    window.addEventListener('focus', load);
    window.addEventListener(TASKS_CHANGED, load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', load);
      window.removeEventListener(TASKS_CHANGED, load);
    };
  }, []);

  const openNotification = (n) => {
    close();
    if (!n.readAt) {
      setNotifications((list) => list.map((x) => (x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.post(`/notifications/${n._id}/read`).catch(() => {});
    }
    navigate(linkFor(n));
  };

  const markAllRead = () => {
    setNotifications((list) => list.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    setUnread(0);
    api.post('/notifications/read-all').catch(() => {});
  };

  const attention = (tasks?.length || 0) + suggestions.length;
  const count = unread + attention;
  const label = error
    ? 'Notifications: could not load'
    : `Notifications: ${unread} unread, ${attention} need${attention === 1 ? 's' : ''} attention`;

  return (
    <div ref={ref} className="menu-wrap">
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-controls="notification-panel"
        title={label}
      >
        <BellIcon />
        {count > 0 && <span className="badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div id="notification-panel" className="menu notif-menu">
          <div className="notif-head">
            <strong>Notifications</strong>
            {unread > 0 && <button type="button" className="link-btn" onClick={markAllRead}>Mark all as read</button>}
          </div>

          {error && <p className="menu-section" style={{ color: 'var(--danger)' }}>Could not load your notifications.</p>}
          {!error && !tasks && <p className="menu-section muted">Loading...</p>}
          {!error && tasks && notifications.length === 0 && <p className="menu-section muted">Nothing new. Mentions and assignments will show up here.</p>}

          {notifications.length > 0 && (
            <ul>
              {notifications.map((n) => (
                <li key={n._id}>
                  <button type="button" className={`notif-item${n.readAt ? '' : ' unread'}`} onClick={() => openNotification(n)}>
                    <Avatar user={n.actor || { name: '?' }} size={32} />
                    <span className="row-main">
                      <span className="notif-text"><strong>{n.actor?.name || 'Someone'}</strong> {n.message}</span>
                      {n.detail && <span className="notif-detail">{n.detail}</span>}
                      <small className="muted">{n.project?.name ? `${n.project.name} · ` : ''}{timeAgo(n.createdAt)}</small>
                    </span>
                    {!n.readAt && <span className="notif-dot"><span className="sr-only">Unread</span></span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {attention > 0 && (
            <>
              <hr className="menu-sep" />
              <div className="menu-section"><strong>Needs attention</strong></div>
              <ul>
                {suggestions.slice(0, MAX_ATTENTION).map((t) => (
                  <li key={t._id}>
                    <Link className="notif" to={`/projects/${t.project._id}?task=${t._id}`} onClick={close}>
                      <span className="notif-title">{t.title}</span>
                      <small style={{ color: 'var(--accent-text)' }}>{t.suggestedBy?.name} suggested this for you · {t.project.name}</small>
                    </Link>
                  </li>
                ))}
                {(tasks || []).slice(0, Math.max(0, MAX_ATTENTION - suggestions.length)).map((t) => (
                  <li key={t._id}>
                    <Link className="notif" to={`/projects/${t.project._id}?task=${t._id}`} onClick={close}>
                      <span className="notif-title">{t.title}</span>
                      <small style={{ color: isOverdue(t) ? 'var(--danger)' : 'var(--text-2)' }}>{t.project.name} · {dueText(t)}</small>
                    </Link>
                  </li>
                ))}
              </ul>
              {attention > MAX_ATTENTION && <p className="menu-section muted"><small>+ {attention - MAX_ATTENTION} more</small></p>}
            </>
          )}

          <hr className="menu-sep" />
          <Link className="menu-item" to="/my-tasks" onClick={close} style={{ color: 'var(--accent-text)' }}>See all my tasks</Link>
        </div>
      )}
    </div>
  );
}
