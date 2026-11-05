import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ProjectMark } from '../components/Avatar';
import Modal from '../components/Modal';
import { FolderIcon, PlusIcon, SearchIcon } from '../components/Icons';
import { projectGradient } from '../utils/colors';
import { timeAgo } from '../utils/dates';
import { notifyProjectsChanged } from '../utils/events';
import useTitle from '../utils/useTitle';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'owner', label: 'Owned by me' },
  { value: 'member', label: 'Joined' },
];

function ProjectCard({ project: p }) {
  return (
    <Link to={`/projects/${p.id}`} className="project-card">
      <div className="project-thumb" style={{ background: projectGradient(p.id) }}>
        <span className="project-thumb-title">{p.name}</span>
        <span className="thumb-badge">{p.memberCount} member{p.memberCount === 1 ? '' : 's'}</span>
      </div>
      <div className="project-info">
        <ProjectMark id={p.id} name={p.name} size={36} radius={18} />
        <div style={{ minWidth: 0 }}>
          <div className="project-meta">{p.role === 'owner' ? 'Owner' : 'Member'} · updated {timeAgo(p.updatedAt)}</div>
          {p.description && <div className="project-desc">{p.description}</div>}
        </div>
      </div>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="project-grid" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i}>
          <div className="skeleton" style={{ aspectRatio: '16 / 9', borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 16, width: '80%', marginTop: 12 }} />
          <div className="skeleton" style={{ height: 12, width: '50%', marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  useTitle('Home');
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').trim();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    api
      .get('/projects')
      .then((res) => {
        setProjects(res.data.projects);
        setLoadError('');
      })
      .catch(() => setLoadError('Could not load your projects. Refresh the page to try again.'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const closeModal = useCallback(() => {
    setCreating(false);
    setError('');
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/projects', { name, description });
      setName('');
      setDescription('');
      setCreating(false);
      notifyProjectsChanged();
      await load();
    } catch (err) {
      const status = err.response?.status;
      setError(status === 429 ? err.response.data.error
        : status === 400 ? 'Could not create the project. Check the name and try again.'
        : 'Could not create the project. Please try again.');
    }
  };

  const q = query.toLowerCase();
  const visible = projects.filter((p) =>
    (filter === 'all' || p.role === filter) &&
    (!q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="muted">Here's what your teams are working on.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <PlusIcon size={18} /> New project
        </button>
      </div>

      <div className="chips" role="group" aria-label="Filter projects">
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

      {query && (
        <p style={{ marginBottom: 16 }} className="muted">
          Results for "<strong>{query}</strong>" ·{' '}
          <button type="button" className="btn btn-sm" onClick={() => setParams({})}>Clear search</button>
        </p>
      )}

      {loading ? (
        <SkeletonGrid />
      ) : loadError ? (
        <p className="alert">{loadError}</p>
      ) : visible.length > 0 ? (
        <div className="project-grid">
          {visible.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="empty">
          <FolderIcon />
          <h2>No projects yet</h2>
          <p>Create your first project, then invite your team.</p>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon size={18} /> New project
          </button>
        </div>
      ) : (
        <div className="empty">
          <SearchIcon />
          <h2>No matching projects</h2>
          <p>Try a different search or filter.</p>
        </div>
      )}

      {creating && (
        <Modal title="New project" onClose={closeModal}>
          <form className="form" onSubmit={create}>
            <label className="field">
              <span>Project name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
            </label>
            <label className="field">
              <span>Description (optional)</span>
              <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            </label>
            {error && <p className="alert">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create project</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
