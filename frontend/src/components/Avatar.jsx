import { useState } from 'react';
import { avatarColor, firstLetter, projectGradient } from '../utils/colors';

// A person's Google picture, or a colored circle with their first initial
export default function Avatar({ user, size = 32 }) {
  const [broken, setBroken] = useState(false);
  const name = user?.name || 'Unassigned';

  if (user?.picture && !broken) {
    return (
      <img
        className="avatar"
        src={user.picture}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.45, background: user ? avatarColor(user._id || name) : 'var(--text-2)' }}
    >
      {user ? firstLetter(name) : '?'}
    </span>
  );
}

// A project's colored square with its first letter
export function ProjectMark({ id, name, size = 32, radius = 8 }) {
  return (
    <span
      className="project-mark"
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.45, background: projectGradient(id) }}
    >
      {firstLetter(name)}
    </span>
  );
}
