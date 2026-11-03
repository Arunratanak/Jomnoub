import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .get(`/projects/${id}`)
      .then((res) => setData(res.data))
      .catch(() => setNotFound(true));
  }, [id]);

  const remove = async () => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    await api.delete(`/projects/${id}`);
    navigate('/dashboard');
  };

  if (notFound) {
    return (
      <div style={{ maxWidth: 640, margin: '60px auto' }}>
        <h2>Project not found</h2>
        <Link to="/dashboard">Back to dashboard</Link>
      </div>
    );
  }
  if (!data) return <p>Loading...</p>;

  const { project, role } = data;
  return (
    <div style={{ maxWidth: 640, margin: '60px auto', padding: '0 16px' }}>
      <Link to="/dashboard">← Back</Link>
      <h1>{project.name}</h1>
      <p>{project.description}</p>

      <h3>Members</h3>
      <ul>
        {project.members.map((m) => (
          <li key={m.user._id || m.user.id}>
            {m.user.name} ({m.role})
          </li>
        ))}
      </ul>

      <h3>Tasks</h3>
      <p>Tasks come in the next phase.</p>

      {role === 'owner' && <button onClick={remove}>Delete project</button>}
    </div>
  );
}