import { useState } from 'react';
import { avatarColor, firstLetter, projectGradient } from '../utils/colors';

// Uploaded photos are stored as a path on our API; Google's are full addresses
const pictureUrl = (picture) => (picture.startsWith('/') ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}${picture}` : picture);

// A person's photo, or a colored circle with their first initial
export default function Avatar({ user, size = 32 }) {
  const [brokenPicture, setBrokenPicture] = useState(null);
  const name = user?.name || 'Unassigned';
  const picture = user?.picture;

  if (picture && picture !== brokenPicture) {
    return (
      <img
        className="avatar"
        src={pictureUrl(picture)}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBrokenPicture(picture)}
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
