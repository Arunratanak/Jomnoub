import {
  PieChart, Pie, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const LABELS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };
// Colors come from the theme tokens in App.css (validated separately for light and dark)
const COLORS = { todo: 'var(--status-todo)', 'in-progress': 'var(--status-progress)', done: 'var(--status-done)' };

const tooltipProps = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' },
  itemStyle: { color: 'var(--text)' },
  labelStyle: { color: 'var(--text-2)' },
};
const legendText = (value) => <span style={{ color: 'var(--text-2)' }}>{value}</span>;

export default function ProjectStats({ stats }) {
  if (!stats) return <p className="muted">Loading progress...</p>;
  if (stats.total === 0) return <p className="muted">No tasks yet. Add one to see progress here.</p>;

  const pieData = Object.keys(LABELS)
    .map((key) => ({ key, name: LABELS[key], value: stats.byStatus[key], fill: COLORS[key] }))
    .filter((d) => d.value > 0);

  return (
    <div className="stack">
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <strong>{stats.completion}% complete</strong>
          <span className="muted">{stats.done} of {stats.total} tasks done</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${stats.completion}%` }} /></div>
      </div>

      <div className="tiles">
        <div className="tile"><div className="tile-value">{stats.total}</div><div className="tile-label">Total</div></div>
        <div className="tile"><div className="tile-value">{stats.byStatus['in-progress']}</div><div className="tile-label">In progress</div></div>
        <div className={`tile${stats.overdue ? ' tile-alert' : ''}`}><div className="tile-value">{stats.overdue}</div><div className="tile-label">Overdue</div></div>
        <div className="tile"><div className="tile-value">{stats.dueThisWeek}</div><div className="tile-label">Due this week</div></div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Tasks by status</h3>
          <div className="donut">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} stroke="var(--surface)" strokeWidth={2} />
                <Tooltip {...tooltipProps} />
                <Legend formatter={legendText} itemSorter={null} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{stats.completion}%</strong>
              <small className="muted">done</small>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Workload per member</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.workload} maxBarSize={36}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip {...tooltipProps} cursor={{ fill: 'var(--surface-2)' }} />
              <Legend formatter={legendText} itemSorter={null} />
              <Bar dataKey="open" name="Open" stackId="a" fill="var(--status-progress)" stroke="var(--surface)" strokeWidth={2} />
              <Bar dataKey="done" name="Done" stackId="a" fill="var(--status-done)" stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <details style={{ marginTop: 8 }}>
            <summary>View as table</summary>
            <table className="data-table">
              <thead><tr><th>Member</th><th>Open</th><th>Done</th></tr></thead>
              <tbody>
                {stats.workload.map((w) => <tr key={w.name}><td>{w.name}</td><td>{w.open}</td><td>{w.done}</td></tr>)}
              </tbody>
            </table>
          </details>
        </div>
      </div>
    </div>
  );
}
