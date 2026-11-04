import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { isOverdue, needsAttention } from '../utils/dates';
import { TASKS_CHANGED } from '../utils/events';

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

  // Close on outside click/tap or Escape
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = tasks?.length || 0;
  const label = error
    ? 'Notifications: could not load'
    : `Notifications: ${count} task${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} attention`;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-controls="notification-panel"
        title={label}
        style={{ position: 'relative', padding: '6px 8px', lineHeight: 0, minWidth: 40, minHeight: 40 }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: 0, right: 0, transform: 'translate(35%, -35%)',
              background: 'crimson', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 'bold',
              minWidth: 18, height: 18, lineHeight: '18px', padding: '0 4px', textAlign: 'center',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 10,
            width: 300, maxWidth: 'calc(100vw - 32px)', background: '#fff', color: '#111',
            border: '1px solid #ccc', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 12, textAlign: 'left',
          }}
        >
          <strong>Needs attention</strong>
          {error ? (
            <p style={{ color: 'crimson', margin: '8px 0' }}>Could not load your tasks.</p>
          ) : !tasks ? (
            <p style={{ margin: '8px 0' }}>Loading...</p>
          ) : count === 0 ? (
            <p style={{ margin: '8px 0' }}>Nothing overdue or due in the next 2 days.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', display: 'grid', gap: 6 }}>
              {tasks.slice(0, MAX_ITEMS).map((t) => (
                <li key={t._id} style={{ overflowWrap: 'anywhere' }}>
                  <Link to={`/projects/${t.project._id}`} onClick={() => setOpen(false)}>{t.title}</Link>
                  <div>
                    <small style={{ color: isOverdue(t) ? 'crimson' : '#555' }}>{t.project.name} · {dueText(t)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {count > MAX_ITEMS && <p style={{ margin: '4px 0' }}><small>+ {count - MAX_ITEMS} more</small></p>}
          <Link to="/my-tasks" onClick={() => setOpen(false)}>See all my tasks →</Link>
        </div>
      )}
    </div>
  );
}
