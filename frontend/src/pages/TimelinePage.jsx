import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import Avatar from '../components/Avatar';
import Loading from '../components/Loading';
import { CalendarIcon, FolderIcon } from '../components/Icons';
import useTitle from '../utils/useTitle';
import { OVERDUE, NO_DEADLINE, utcDay, groupTasks } from '../utils/timeline';

const STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };
const STATUS_COLORS = { todo: 'var(--status-todo)', 'in-progress': 'var(--status-progress)', done: 'var(--status-done)' };

function dayLabel(key, todayKey, tomorrowKey) {
  const text = new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  if (key === todayKey) return `Today · ${text}`;
  if (key === tomorrowKey) return `Tomorrow · ${text}`;
  return text;
}

export default function TimelinePage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [loadError, setLoadError] = useState(null); // 'notFound' | 'failed' | null
  const [showDone, setShowDone] = useState(false);
  useTitle(project ? `${project.name} timeline` : loadError === 'notFound' ? 'Project not found' : 'Timeline');

  useEffect(() => {
    Promise.all([api.get(`/projects/${id}`), api.get(`/projects/${id}/tasks`)])
      .then(([p, t]) => {
        setProject(p.data.project);
        setTasks(t.data.tasks);
      })
      .catch((err) => setLoadError(err.response?.status === 404 ? 'notFound' : 'failed'));
  }, [id]);

  if (loadError) {
    return (
      <div className="empty">
        <FolderIcon />
        <h2>{loadError === 'notFound' ? 'Project not found' : 'Could not load the timeline'}</h2>
        {loadError === 'failed' && <p>Check your connection and refresh the page.</p>}
        <Link className="btn" to="/dashboard">Back to home</Link>
      </div>
    );
  }
  if (!tasks) return <Loading />;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayKey = utcDay(today);
  const tomorrowKey = utcDay(today.getTime() + 24 * 60 * 60 * 1000);

  const visible = tasks.filter((t) => showDone || t.status !== 'done');
  const groups = groupTasks(visible);

  return (
    <div style={{ maxWidth: 760 }}>
      <Link to={`/projects/${id}`}>← Back to project</Link>
      <div className="page-head">
        <h1>{project.name}: timeline</h1>
        <label className="check">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed
        </label>
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <CalendarIcon />
          <h2>{tasks.length === 0 ? 'No tasks yet' : 'All tasks are done'}</h2>
          <p>{tasks.length === 0 ? 'Add a task on the project board to see it here.' : 'Tick "Show completed" to see them.'}</p>
        </div>
      ) : (
        groups.map(({ key, tasks: items }) => {
          const dotClass = key === OVERDUE ? ' overdue' : key === NO_DEADLINE ? ' none' : '';
          return (
            <section key={key} className="timeline-group">
              <span className={`timeline-dot${dotClass}`} aria-hidden="true" />
              <h2 className={`timeline-head${key === OVERDUE ? ' overdue' : ''}`}>
                {key === OVERDUE ? 'Overdue' : key === NO_DEADLINE ? 'No deadline' : dayLabel(key, todayKey, tomorrowKey)}
                {' '}<small className="muted" style={{ fontWeight: 400 }}>({items.length})</small>
              </h2>
              <ul className="timeline-tasks">
                {items.map((t) => (
                  <li key={t._id} className={`task-card${key === OVERDUE ? ' overdue' : ''}`} style={{ marginBottom: 0 }}>
                    <span className={`task-title${t.status === 'done' ? ' done-title' : ''}`}>{t.title}</span>
                    <div className="feed-meta">
                      <span className="task-people">
                        <Avatar user={t.assignee} size={20} />
                        {t.assignee ? t.assignee.name : 'Unassigned'}
                      </span>
                      <span className="status-pill">
                        <span className="dot" style={{ background: STATUS_COLORS[t.status] }} aria-hidden="true" />
                        {STATUS_LABELS[t.status]}
                      </span>
                      {key === OVERDUE && (
                        <span className="due overdue">was due {new Date(t.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
