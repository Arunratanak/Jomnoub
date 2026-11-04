import { timeAgo } from '../utils/dates';

// Shows the latest project activity. Text is rendered as plain React text, so it's escaped.
export default function ActivityPanel({ activity, error }) {
  return (
    <section style={{ margin: '24px 0' }}>
      <h2>Activity</h2>
      {error ? (
        <p style={{ color: 'crimson' }}>Could not load activity.</p>
      ) : !activity ? (
        <p>Loading...</p>
      ) : activity.length === 0 ? (
        <p>No activity yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 280, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 8 }}>
          {activity.map((a) => (
            <li key={a._id} style={{ padding: '8px 12px', borderBottom: '1px solid #eee', overflowWrap: 'anywhere' }}>
              <strong>{a.actor?.name || 'Someone'}</strong> {a.message}
              <div><small style={{ color: '#666' }} title={new Date(a.createdAt).toLocaleString()}>{timeAgo(a.createdAt)}</small></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
