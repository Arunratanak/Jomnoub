import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ProjectMark } from '../components/Avatar';
import EditProjectModal from '../components/EditProjectModal';
import JoinProjectModal from '../components/JoinProjectModal';
import NewProjectModal from '../components/NewProjectModal';
import { EditIcon, FolderIcon, LinkIcon, MoreIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/Icons';
import { projectGradient } from '../utils/colors';
import { timeAgo } from '../utils/dates';
import { notifyProjectsChanged, notifyTasksChanged } from '../utils/events';
import { confirmDialog, toast } from '../utils/feedback';
import useClickOutside from '../utils/useClickOutside';
import useTitle from '../utils/useTitle';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'owner', label: 'Owned by me' },
  { value: 'member', label: 'Joined' },
];

// The owner's Edit / Delete menu on a project card
function CardMenu({ project: p, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  return (
    <div ref={ref} className="menu-wrap card-menu">
      <button
        type="button"
        className="icon-btn icon-btn-sm"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Options for ${p.name}`}
        aria-expanded={open}
      >
        <MoreIcon size={20} />
      </button>
      {open && (
        <div className="menu menu-sm">
          <button type="button" className="menu-item" onClick={() => { close(); onEdit(p); }}><EditIcon size={18} /> Edit</button>
          <button type="button" className="menu-item menu-item-danger" onClick={() => { close(); onDelete(p); }}><TrashIcon size={18} /> Delete</button>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project: p, onEdit, onDelete }) {
  const to = `/projects/${p.id}`;
  return (
    <div className="project-card">
      <Link to={to} className="project-thumb" style={{ background: projectGradient(p.id) }}>
        <span className="project-thumb-title">{p.name}</span>
        <span className="thumb-badge">{p.memberCount} member{p.memberCount === 1 ? '' : 's'}</span>
      </Link>
      <div className="project-info">
        <ProjectMark id={p.id} name={p.name} size={36} radius={18} />
        {/* Same destination as the thumbnail above, so it's skipped when tabbing */}
        <Link to={to} className="project-info-link" tabIndex={-1}>
          <div className="project-meta">{p.role === 'owner' ? 'Owner' : 'Member'} · updated {timeAgo(p.updatedAt)}</div>
          {p.description && <div className="project-desc">{p.description}</div>}
          {p.taskCount > 0 && (
            <div className="card-progress">
              <span className="progress-track mini"><span className="progress-fill" style={{ width: `${(p.doneCount / p.taskCount) * 100}%` }} /></span>
              <small className="muted">{p.doneCount}/{p.taskCount} tasks done</small>
            </div>
          )}
        </Link>
        {p.role === 'owner' && <CardMenu project={p} onEdit={onEdit} onDelete={onDelete} />}
      </div>
    </div>
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
  const [joining, setJoining] = useState(false);
  const [editing, setEditing] = useState(null); // the project being edited

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

  const closeCreate = useCallback(() => setCreating(false), []);

  const onProjectCreated = () => {
    notifyProjectsChanged();
    load();
  };

  const closeEdit = useCallback(() => setEditing(null), []);
  const closeJoin = useCallback(() => setJoining(false), []);

  const onProjectSaved = async () => {
    setEditing(null);
    notifyProjectsChanged();
    toast('Project updated.');
    await load();
  };

  const deleteProject = async (p) => {
    const ok = await confirmDialog({
      title: `Delete "${p.name}"?`,
      message: 'This removes the project, its tasks and its chat for everyone. It can\'t be undone.',
      confirmLabel: 'Delete project',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/projects/${p.id}`);
      notifyProjectsChanged();
      notifyTasksChanged();
      toast('Project deleted.');
      await load();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not delete the project.', 'error');
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
        <div className="channel-actions">
          <button type="button" className="btn" onClick={() => setJoining(true)}>
            <LinkIcon size={18} /> Join project
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon size={18} /> New project
          </button>
        </div>
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
          {visible.map((p) => <ProjectCard key={p.id} project={p} onEdit={setEditing} onDelete={deleteProject} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="empty">
          <FolderIcon />
          <h2>No projects yet</h2>
          <p>Create your first project and invite your team, or join one with an invite link.</p>
          <div className="channel-actions">
            <button type="button" className="btn" onClick={() => setJoining(true)}>
              <LinkIcon size={18} /> Join project
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <PlusIcon size={18} /> New project
            </button>
          </div>
        </div>
      ) : (
        <div className="empty">
          <SearchIcon />
          <h2>No matching projects</h2>
          <p>Try a different search or filter.</p>
        </div>
      )}

      {editing && (
        <EditProjectModal
          projectId={editing.id}
          name={editing.name}
          description={editing.description}
          onClose={closeEdit}
          onSaved={onProjectSaved}
        />
      )}

      {joining && <JoinProjectModal onClose={closeJoin} />}

      {creating && <NewProjectModal onClose={closeCreate} onCreated={onProjectCreated} />}
    </>
  );
}
