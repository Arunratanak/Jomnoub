import { useCallback, useSyncExternalStore } from 'react';

// The theme lives on <html data-theme="..."> (set before first paint by the script
// in index.html). This hook keeps every toggle and the Google button in sync with it.
const KEY = 'taskhub-theme';
const CHANGED = 'taskhub:theme-changed';

const read = () => document.documentElement.getAttribute('data-theme') || 'light';

function subscribe(listener) {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read);

  const toggleTheme = useCallback(() => {
    const next = read() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // private mode: the theme still applies for this page view
    }
    window.dispatchEvent(new Event(CHANGED));
  }, []);

  return { theme, toggleTheme };
}
