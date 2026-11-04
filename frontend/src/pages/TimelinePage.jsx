import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import Loading from '../components/Loading';
import useTitle from '../utils/useTitle';
import { OVERDUE, NO_DEADLINE, utcDay, groupTasks } from '../utils/timeline';

const STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };

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
      <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 16px' }}>
        <h2>{loadError === 'notFound' ? 'Project not found' : 'Could not load the timeline'}</h2>
        {loadError === 'failed' && <p>Check your connection and refresh the page.</p>}
        <Link to="/dashboard">Back to dashboard</Link>
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
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
      <Link to={`/projects/${id}`}>← Back to project</Link>
      <h1 style={{ overflowWrap: 'anywhere' }}>{project.name}: timeline</h1>
      <label>
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed
      </label>

      {groups.length === 0 ? (
        <p style={{ marginTop: 24 }}>
          {tasks.length === 0 ? 'No tasks in this project yet.' : 'All tasks are done. Tick "Show completed" to see them.'}
        </p>
      ) : (
        groups.map(({ key, tasks: items }) => (
          <section key={key} style={{ margin: '24px 0' }}>
            <h2 style={{ fontSize: 18, color: key === OVERDUE ? 'crimson' : 'inherit', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>
              {key === OVERDUE ? 'Overdue' : key === NO_DEADLINE ? 'No deadline' : dayLabel(key, todayKey, tomorrowKey)}
              {' '}<small style={{ fontWeight: 'normal', color: '#666' }}>({items.length})</small>
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {items.map((t) => (
                <li
                  key={t._id}
                  style={{ border: `1px solid ${key === OVERDUE ? 'crimson' : '#ccc'}`, borderRadius: 8, padding: 10, overflowWrap: 'anywhere' }}
                >
                  <strong style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</strong>
                  <div>
                    <small>
                      {t.assignee ? t.assignee.name : 'Unassigned'} · {STATUS_LABELS[t.status]}
                      {key === OVERDUE && ` · was due ${new Date(t.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}`}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
