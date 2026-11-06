import Avatar from './Avatar';
import { ChevronDownIcon } from './Icons';
import { isOverdue } from '../utils/dates';

const MAX_FACES = 4;

// The To do column, for the person looking at it: their own work first, then anything
// nobody has taken yet, with teammates' tasks folded away behind a button.
export default function TodoGroups({ tasks, personOf, currentUserId, showTeammates, onToggle, renderCard }) {
  const mine = tasks.filter((t) => personOf(t)?._id === currentUserId);
  const open = tasks.filter((t) => !personOf(t));
  const teammates = tasks
    .filter((t) => personOf(t) && personOf(t)._id !== currentUserId)
    .sort((a, b) => personOf(a).name.localeCompare(personOf(b).name));

  const people = [...new Map(teammates.map((t) => [personOf(t)._id, personOf(t)])).values()];
  const overdue = teammates.filter(isOverdue).length;

  return (
    <>
      <div className="todo-group">
        <h3 className="todo-group-head">Your tasks <span className="muted">({mine.length})</span></h3>
        {mine.length === 0 ? <p className="todo-none">Nothing assigned to you right now.</p> : mine.map(renderCard)}
      </div>

      {open.length > 0 && (
        <div className="todo-group">
          <h3 className="todo-group-head">Unassigned <span className="muted">({open.length})</span></h3>
          {open.map(renderCard)}
        </div>
      )}

      {teammates.length > 0 && (
        <div className="todo-group">
          <button
            type="button"
            className={`teammates-toggle${showTeammates ? ' open' : ''}`}
            onClick={onToggle}
            aria-expanded={showTeammates}
          >
            <span className="teammates-faces" aria-hidden="true">
              {people.slice(0, MAX_FACES).map((p) => <Avatar key={p._id} user={p} size={22} />)}
            </span>
            <span className="row-main">
              {showTeammates ? 'Hide' : 'Show'} teammates' tasks ({teammates.length})
              {overdue > 0 && <small className="teammates-overdue"> · {overdue} overdue</small>}
            </span>
            <ChevronDownIcon size={18} />
          </button>
          {showTeammates && teammates.map(renderCard)}
        </div>
      )}
    </>
  );
}
