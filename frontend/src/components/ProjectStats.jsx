import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const LABELS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };
const COLORS = { todo: '#9ca3af', 'in-progress': '#3b82f6', done: '#22c55e' };
const card = { border: '1px solid #ddd', borderRadius: 8, padding: 12, textAlign: 'center' };

export default function ProjectStats({ stats }) {
  if (!stats) return null;
  if (stats.total === 0) return <p>No tasks yet. Add one to see progress here.</p>;

  const pieData = Object.keys(LABELS)
    .map((key) => ({ key, name: LABELS[key], value: stats.byStatus[key] }))
    .filter((d) => d.value > 0);

  return (
    <section style={{ margin: '24px 0' }}>
      <h2>Progress</h2>

      <div style={{ background: '#e5e7eb', borderRadius: 8, height: 18, overflow: 'hidden' }}>
        <div style={{ width: `${stats.completion}%`, background: '#22c55e', height: '100%' }} />
      </div>
      <p><strong>{stats.completion}% complete</strong> ({stats.done} of {stats.total} tasks done)</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, margin: '16px 0' }}>
        <div style={card}><div style={{ fontSize: 28 }}>{stats.total}</div>Total</div>
        <div style={card}><div style={{ fontSize: 28 }}>{stats.byStatus['in-progress']}</div>In progress</div>
        <div style={{ ...card, borderColor: stats.overdue ? 'crimson' : '#ddd' }}>
          <div style={{ fontSize: 28, color: stats.overdue ? 'crimson' : 'inherit' }}>{stats.overdue}</div>Overdue
        </div>
        <div style={card}><div style={{ fontSize: 28 }}>{stats.dueThisWeek}</div>Due this week</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div>
          <h3>Tasks by status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                {pieData.map((d) => <Cell key={d.key} fill={COLORS[d.key]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3>Workload per member</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.workload}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="open" name="Open" stackId="a" fill="#3b82f6" />
              <Bar dataKey="done" name="Done" stackId="a" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}