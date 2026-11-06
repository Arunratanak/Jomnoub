// How far the whole project has come, whatever filter is on
export default function BoardProgress({ tasks }) {
  if (tasks.length === 0) return null;
  const done = tasks.filter((t) => t.status === 'done').length;
  const started = tasks.filter((t) => t.status === 'in-progress').length;
  const percent = (count) => Math.round((count / tasks.length) * 100);

  return (
    <div className="board-progress">
      <div className="board-progress-text">
        <strong>{done} of {tasks.length} task{tasks.length === 1 ? '' : 's'} complete</strong>
        <span className="muted">{started} in progress · {percent(done)}%</span>
      </div>
      <div
        className="board-progress-track"
        role="progressbar"
        aria-label="Tasks complete"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent(done)}
      >
        <span style={{ width: `${percent(done)}%`, background: 'var(--status-done)' }} />
        <span style={{ width: `${percent(started)}%`, background: 'var(--status-progress)' }} />
      </div>
    </div>
  );
}
