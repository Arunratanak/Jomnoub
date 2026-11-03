import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ maxWidth: 640, margin: '60px auto' }}>
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
      <h2>Your projects</h2>
      <p>Nothing here yet.</p>
    </div>
  );
}