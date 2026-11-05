import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { isOverdue, needsAttention } from '../utils/dates';
import { TASKS_CHANGED } from '../utils/events';
import useClickOutside from '../utils/useClickOutside';
import { BellIcon } from './Icons';

const MAX_ITEMS = 5;

function dueText(t) {
  const due = new Date(t.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' });
  return isOverdue(t) ? `Overdue · was due ${due}` : `Due ${due}`;
}

// Bell with a count of my unfinished tasks that are overdue or due within 2 days.
// Uses GET /my-tasks (already sorted soonest first). Refreshes on mount, on
// window focus, and when a page reports a task change. No polling.
export default function NotificationBell() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = () => setOpen(false);
  useClickOutside(ref, open, close);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get('/my-tasks')
        .then((res) => {
          if (!active) return;
          setTasks(res.data.tasks.filter(needsAttention));
          setError(false);
        })
        .catch(() => active && setError(true));

    load();
    window.addEventListener('focus', load);
    window.addEventListener(TASKS_CHANGED, load);
    return () => {
      active = false;
      window.removeEventListener('focus', load);
      window.removeEventListener(TASKS_CHANGED, load);
    };
  }, []);

  const count = tasks?.length || 0;
  const label = error
    ? 'Notifications: could not load'
    : `Notifications: ${count} task${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention`;

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
        <div id="notification-panel" className="menu">
          <div className="menu-section"><strong>Needs attention</strong></div>
          <hr className="menu-sep" />
          {error ? (
            <p className="menu-section" style={{ color: 'var(--danger)' }}>Could not load your tasks.</p>
          ) : !tasks ? (
            <p className="menu-section muted">Loading...</p>
          ) : count === 0 ? (
            <p className="menu-section muted">Nothing overdue or due in the next 2 days.</p>
          ) : (
            <ul>
              {tasks.slice(0, MAX_ITEMS).map((t) => (
                <li key={t._id}>
                  <Link className="notif" to={`/projects/${t.project._id}`} onClick={close}>
                    <span className="notif-title">{t.title}</span>
                    <small style={{ color: isOverdue(t) ? 'var(--danger)' : 'var(--text-2)' }}>
                      {t.project.name} · {dueText(t)}
                    </small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {count > MAX_ITEMS && <p className="menu-section muted"><small>+ {count - MAX_ITEMS} more</small></p>}
          <hr className="menu-sep" />
          <Link className="menu-item" to="/my-tasks" onClick={close} style={{ color: 'var(--accent-text)' }}>See all my tasks</Link>
        </div>
      )}
    </div>
  );
}
