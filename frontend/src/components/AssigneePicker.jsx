import Avatar from './Avatar';
import { Faces } from './People';
import { CheckIcon } from './Icons';

function Option({ value, checked, onToggle, face, name, note, isYou }) {
  return (
    <label className={`assignee-option${checked ? ' selected' : ''}`} title={name}>
      <input type="checkbox" className="sr-only" name="assignees" value={value} checked={checked} onChange={onToggle} />
      {face}
      <span className="assignee-text">
        <span className="assignee-name">
          <span className="assignee-name-text">{name}</span>
          {isYou && <span className="you-tag">You</span>}
        </span>
        <small className="muted">{note}</small>
      </span>
      <span className="assignee-box" aria-hidden="true">{checked && <CheckIcon size={14} />}</span>
    </label>
  );
}

// Who a task is for: tick any number of people, or nobody for now. With two or more
// ticked on a new task, the person also chooses between one shared task and a copy each.
export default function AssigneePicker({ members, value, onChange, separate, onSeparateChange, canSeparate, labelledBy, currentUserId, isOwner }) {
  const all = members.map((m) => m.user._id);
  const allChecked = all.length > 0 && all.every((id) => value.includes(id));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const memberNote = (m) => {
    if (m.role !== 'owner') return 'Member';
    return isOwner ? 'Owner' : 'Owner · as a suggestion';
  };

  return (
    <>
      <div className="assignee-picker" role="group" aria-labelledby={labelledBy}>
        {members.length > 1 && (
          <Option
            value="all"
            checked={allChecked}
            onToggle={() => onChange(allChecked ? [] : all)}
            face={<Faces people={members.map((m) => m.user)} size={24} />}
            name="Everyone"
            note={`All ${members.length} members`}
          />
        )}
        {members.map((m) => (
          <Option
            key={m.user._id}
            value={m.user._id}
            checked={value.includes(m.user._id)}
            onToggle={() => toggle(m.user._id)}
            face={<Avatar user={m.user} size={36} />}
            name={m.user.name}
            note={memberNote(m)}
            isYou={m.user._id === currentUserId}
          />
        ))}
      </div>
      <small className="muted" aria-live="polite">
        {value.length === 0 ? 'Nobody yet. You can assign it later.' : `${value.length} ${value.length === 1 ? 'person' : 'people'} chosen.`}
      </small>

      {canSeparate && value.length > 1 && (
        <div className="assign-mode" role="radiogroup" aria-label="How to give it to them">
          <label className={`assign-mode-option${!separate ? ' selected' : ''}`}>
            <input type="radio" className="sr-only" name="assign-mode" checked={!separate} onChange={() => onSeparateChange(false)} />
            <strong>One shared task</strong>
            <small className="muted">One card they all work on. Any of them can move it.</small>
          </label>
          <label className={`assign-mode-option${separate ? ' selected' : ''}`}>
            <input type="radio" className="sr-only" name="assign-mode" checked={separate} onChange={() => onSeparateChange(true)} />
            <strong>A copy for each person</strong>
            <small className="muted">{value.length} separate tasks, so each person tracks their own.</small>
          </label>
        </div>
      )}
    </>
  );
}
