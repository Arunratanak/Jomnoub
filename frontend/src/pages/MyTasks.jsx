import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Loading from '../components/Loading';
import { AlertIcon, CalendarIcon, TasksIcon } from '../components/Icons';
import { firstLetter, projectGradient } from '../utils/colors';
import { isOverdue } from '../utils/dates';
import { notifyTasksChanged } from '../utils/events';
import { toast } from '../utils/feedback';
import useTitle from '../utils/useTitle';

const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

const FILTERS = [
  { value: 'active', label: 'Active', test: (t) => t.status !== 'done' },
  { value: 'overdue', label: 'Overdue', test: isOverdue },
  { value: 'done', label: 'Completed', test: (t) => t.status === 'done' },
  { value: 'all', label: 'All', test: () => true },
];

const EMPTY_TEXT = {
  active: 'Nothing assigned to you right now.',
  overdue: 'Nothing overdue. Nice work!',
  done: 'No completed tasks yet.',
  all: 'No tasks are assigned to you yet.',
};

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [error, setError] = useState('');
  useTitle('My tasks');

  const load = () =>
    api
      .get('/my-tasks')
      .then((res) => {
        setTasks(res.data.tasks);
        setSuggestions(res.data.suggestions || []);
      })
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

  const respond = async (t, action) => {
    try {
      setError('');
      await api.post(`/projects/${t.project._id}/tasks/${t._id}/suggestion/${action}`);
      notifyTasksChanged();
      toast(action === 'accept' ? 'Task assigned to you.' : 'Suggestion declined.');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update the suggestion.');
    }
  };

  const active = FILTERS.find((f) => f.value === filter);
  const visible = tasks.filter(active.test);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My tasks</h1>
          <p className="muted">Everything assigned to you, soonest deadline first.</p>
        </div>
      </div>

      {suggestions.length > 0 && (
        <section className="suggestion-section" aria-label="Suggestions for you">
          <h2>Suggested for you ({suggestions.length})</h2>
          {suggestions.map((t) => (
            <div key={t._id} className="suggestion">
              <div className="row-main">
                <strong>{t.title}</strong>
                <div className="muted"><small>{t.suggestedBy?.name} suggested this in <Link to={`/projects/${t.project._id}`}>{t.project.name}</Link></small></div>
              </div>
              <div className="suggestion-actions">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => respond(t, 'accept')}>Accept</button>
                <button type="button" className="btn btn-sm" onClick={() => respond(t, 'decline')}>Decline</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="chips" role="group" aria-label="Filter tasks">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`chip${filter === f.value ? ' active' : ''}`}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <Loading />
      ) : error && tasks.length === 0 ? null : visible.length === 0 ? (
        <div className="empty">
          <TasksIcon />
          <h2>All clear</h2>
          <p>{EMPTY_TEXT[filter]}</p>
        </div>
      ) : (
        <div className="feed">
          {visible.map((t) => {
            const overdue = isOverdue(t);
            return (
              <div key={t._id} className="feed-item">
                <Link
                  to={`/projects/${t.project._id}`}
                  className="feed-thumb"
                  style={{ background: projectGradient(t.project._id) }}
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {firstLetter(t.project.name)}
                </Link>
                <div className="feed-body">
                  <span className={`feed-title${t.status === 'done' ? ' done-title' : ''}`}>{t.title}</span>
                  <div className="feed-meta">
                    <Link to={`/projects/${t.project._id}`}>{t.project.name}</Link>
                    {t.subtasks?.length > 0 && (
                      <span>{t.subtasks.filter((s) => s.done).length}/{t.subtasks.length} subtasks</span>
                    )}
                    {t.deadline && (
                      <span className={`due${overdue ? ' overdue' : ''}`}>
                        {overdue ? <AlertIcon size={14} /> : <CalendarIcon size={14} />}
                        {overdue ? 'Overdue · was due' : 'Due'} {new Date(t.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="feed-action">
                  <select
                    className="select select-sm"
                    value={t.status}
                    onChange={(e) => changeStatus(t, e.target.value)}
                    aria-label={`Status of ${t.title}`}
                  >
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
