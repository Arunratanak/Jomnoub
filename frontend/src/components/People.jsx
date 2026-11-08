import Avatar from './Avatar';
import { joinNames } from '../utils/taskStatus';

const MAX_FACES = 3;

// The faces of up to three people, overlapping
export function Faces({ people, size = 24 }) {
  if (people.length === 0) return <Avatar user={null} size={size} />;
  return (
    <span className="teammates-faces" aria-hidden="true">
      {people.slice(0, MAX_FACES).map((p) => <Avatar key={p._id} user={p} size={size} />)}
    </span>
  );
}

// Who a task is for, as faces and names: "Alex Demo", "Alex Demo and Sam Demo", or the
// first two and how many more
export default function People({ people, size = 24, empty = 'Unassigned' }) {
  const text = people.length === 0 ? empty
    : people.length <= 2 ? joinNames(people)
    : `${joinNames(people.slice(0, 2)).replace(' and ', ', ')} +${people.length - 2}`;
  return (
    <>
      <Faces people={people} size={size} />
      <span className="people-names" title={people.length > 2 ? joinNames(people) : undefined}>{text}</span>
    </>
  );
}
