import Avatar from './Avatar';
import { timeAgo } from '../utils/dates';

// Latest project activity. Text is rendered as plain React text, so it's escaped.
export default function ActivityPanel({ activity, error }) {
  if (error) return <p className="alert">Could not load activity.</p>;
  if (!activity) return <p className="muted">Loading...</p>;
  if (activity.length === 0) return <p className="muted">No activity yet.</p>;

  return (
    <ul style={{ maxWidth: 760 }}>
      {activity.map((a) => (
        <li key={a._id} className="activity-item">
          <Avatar user={a.actor || { name: 'Someone' }} size={36} />
          <div style={{ minWidth: 0 }}>
            <div><strong>{a.actor?.name || 'Someone'}</strong> {a.message}</div>
            <small className="muted" title={new Date(a.createdAt).toLocaleString()}>{timeAgo(a.createdAt)}</small>
          </div>
        </li>
      ))}
    </ul>
  );
}
