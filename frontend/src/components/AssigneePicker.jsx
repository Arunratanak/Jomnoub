import Avatar from './Avatar';
import { CheckIcon } from './Icons';

const MAX_FACES = 3;

function Option({ value, selected, onChange, face, name, note, isYou }) {
  return (
    <label className={`assignee-option${selected ? ' selected' : ''}`} title={name}>
      <input
        type="radio"
        className="sr-only"
        name="assignee"
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
      />
      {face}
      <span className="assignee-text">
        <span className="assignee-name">
          <span className="assignee-name-text">{name}</span>
          {isYou && <span className="you-tag">You</span>}
        </span>
        <small className="muted">{note}</small>
      </span>
      {selected && <CheckIcon size={18} />}
    </label>
  );
}

// Who a task is for, shown as people with their pictures and names.
// These are radio buttons underneath, so the arrow keys and screen readers work as usual.
export default function AssigneePicker({ members, value, onChange, labelledBy, currentUserId, isOwner, everyoneValue }) {
  const memberNote = (m) => {
    if (m.role !== 'owner') return 'Member';
    return isOwner ? 'Owner' : 'Owner · as a suggestion';
  };

  return (
    <div className="assignee-picker" role="radiogroup" aria-labelledby={labelledBy}>
      <Option
        value=""
        selected={value === ''}
        onChange={onChange}
        face={<Avatar user={null} size={36} />}
        name="Unassigned"
        note="Nobody yet"
      />
      {everyoneValue && (
        <Option
          value={everyoneValue}
          selected={value === everyoneValue}
          onChange={onChange}
          face={(
            <span className="teammates-faces">
              {members.slice(0, MAX_FACES).map((m) => <Avatar key={m.user._id} user={m.user} size={24} />)}
            </span>
          )}
          name="Everyone"
          note="A separate task for each member"
        />
      )}
      {members.map((m) => (
        <Option
          key={m.user._id}
          value={m.user._id}
          selected={value === m.user._id}
          onChange={onChange}
          face={<Avatar user={m.user} size={36} />}
          name={m.user.name}
          note={memberNote(m)}
          isYou={m.user._id === currentUserId}
        />
      ))}
    </div>
  );
}
