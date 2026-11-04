import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { isOverdue } from '../utils/dates';
import Loading from '../components/Loading';
import NotificationBell from '../components/NotificationBell';
import { notifyTasksChanged } from '../utils/events';

const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    api
      .get('/my-tasks')
      .then((res) => setTasks(res.data.tasks))
      .catch(() => setError('Could not load your tasks. Refresh the page to try again.'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const changeStatus = async (t, status) => {
    try {
      setError('');
      await api.patch(`/projects/${t.project._id}/tasks/${t._id}`, { status });
      notifyTasksChanged();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update the task.');
    }
  };

  const visible = tasks.filter((t) => showDone || t.status !== 'done');

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Link to="/dashboard">← Back</Link>
        <NotificationBell />
      </div>
      <h1>My tasks</h1>
      <label>
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed
      </label>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {loading ? (
        <Loading />
      ) : error && tasks.length === 0 ? null : visible.length === 0 ? (
        <p>Nothing assigned to you right now.</p>
      ) : (
        visible.map((t) => (
          <div
            key={t._id}
            style={{
              border: `1px solid ${isOverdue(t) ? 'crimson' : '#ccc'}`,
              borderRadius: 8, padding: 12, margin: '12px 0',
            }}
          >
            <strong>{t.title}</strong>
            <div>
              <Link to={`/projects/${t.project._id}`}>{t.project.name}</Link>
              {t.deadline && ` · Due ${new Date(t.deadline).toLocaleDateString()}`}
              {isOverdue(t) && <span style={{ color: 'crimson' }}> · OVERDUE</span>}
            </div>
            <select value={t.status} onChange={(e) => changeStatus(t, e.target.value)} style={{ marginTop: 8 }}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        ))
      )}
    </div>
  );
}