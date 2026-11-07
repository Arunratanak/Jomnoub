import { STATUSES } from '../utils/taskStatus';

// All three stages in one row: where the task is now, and one click to move it anywhere.
// The highlight slides with CSS: as a Motion shared element it held the window open while closing.
export default function StatusStepper({ status, canChange, onChange }) {
  const index = STATUSES.findIndex((s) => s.value === status);

  return (
    <div className="status-stepper" role="group" aria-label="Task status">
      <span
        className="stepper-pill"
        style={{ '--step-color': STATUSES[index]?.color, transform: `translateX(calc(${index} * (100% + 2px)))` }}
        aria-hidden="true"
      />
      {STATUSES.map((s) => {
        const active = s.value === status;
        return (
          <button
            key={s.value}
            type="button"
            className={`stepper-step${active ? ' active' : ''}`}
            disabled={!canChange}
            aria-pressed={active}
            onClick={() => { if (!active) onChange(s.value); }}
          >
            <span className="stepper-label">
              <span className="dot" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
