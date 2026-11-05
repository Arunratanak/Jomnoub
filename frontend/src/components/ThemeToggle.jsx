import { useTheme } from '../utils/theme';
import { MoonIcon, SunIcon } from './Icons';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
