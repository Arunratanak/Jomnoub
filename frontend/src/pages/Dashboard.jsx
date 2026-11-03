import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    api
      .get('/projects')
      .then((res) => setProjects(res.data.projects))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/projects', { name, description });
      setName('');
      setDescription('');
      load();
    } catch {
      setError('Could not create the project. Check the name and try again.');
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user.picture && (
          <img src={user.picture} alt="" width={40} height={40} style={{ borderRadius: '50%' }} referrerPolicy="no-referrer" />
        )}
        <div>
          <strong>{user.name}</strong>
          <div>{user.email}</div>
        </div>
        <button onClick={logout} style={{ marginLeft: 'auto' }}>Log out</button>
      </div>

      <h2>New project</h2>
      <form onSubmit={create} style={{ display: 'grid', gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" maxLength={100} required />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" maxLength={500} />
        <button type="submit">Create project</button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </form>

      <h2>Your projects</h2>
      {loading ? (
        <p>Loading...</p>
      ) : projects.length === 0 ? (
        <p>No projects yet. Create your first one above.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {projects.map((p) => (
            <li key={p.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12 }}>
              <Link to={`/projects/${p.id}`}><strong>{p.name}</strong></Link>
              <div>{p.description}</div>
              <small>{p.role} · {p.memberCount} member{p.memberCount === 1 ? '' : 's'}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}