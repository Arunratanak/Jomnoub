import { useEffect } from 'react';

// Sets the browser tab title, e.g. "My tasks · TaskHub"
export default function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · TaskHub` : 'TaskHub';
  }, [title]);
}
