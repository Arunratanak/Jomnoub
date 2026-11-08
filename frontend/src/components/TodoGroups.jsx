import { Faces } from './People';
import { ChevronDownIcon } from './Icons';
import { isOverdue } from '../utils/dates';
import { groupByPeople, joinNames, splitTodo } from '../utils/taskStatus';

// The To do column, for the person looking at it: their own work first, then anything
// nobody has taken yet, with teammates' tasks folded away behind a button and, once
// opened, sorted under each person.
export default function TodoGroups({ tasks, peopleOf, currentUserId, showTeammates, onToggle, renderCard }) {
  const { mine, open, teammates } = splitTodo(tasks, peopleOf, currentUserId);
  const groups = groupByPeople(teammates, peopleOf);
  const people = [...new Map(teammates.flatMap(peopleOf).map((p) => [p._id, p])).values()];
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
            <Faces people={people} size={22} />
            <span className="row-main">
              {showTeammates ? 'Hide' : 'Show'} teammates' tasks ({teammates.length})
              {overdue > 0 && <small className="teammates-overdue"> · {overdue} overdue</small>}
            </span>
            <ChevronDownIcon size={18} />
          </button>
          {showTeammates && groups.map((g) => (
            <section key={g.key} className="member-group" aria-label={`${joinNames(g.people)}'s tasks`}>
              <h4 className="member-group-head">
                <Faces people={g.people} size={22} />
                <span className="member-group-name">{joinNames(g.people)}</span>
                <span className="muted">({g.tasks.length})</span>
              </h4>
              {g.tasks.map(renderCard)}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
