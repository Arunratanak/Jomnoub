import { useEffect, useState } from 'react';

// The free Render backend sleeps when idle and can take ~30-60s to wake up.
// After a few seconds, tell the user why it's slow instead of looking frozen.
export default function Loading() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="loading" role="status">
      <div className="spinner" aria-hidden="true" />
      <p>Loading...</p>
      {slow && <p><small>Waking up the server. This can take up to a minute the first time.</small></p>}
    </div>
  );
}
