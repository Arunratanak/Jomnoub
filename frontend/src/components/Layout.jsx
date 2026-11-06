import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PROJECTS_CHANGED } from '../utils/events';
import { toast } from '../utils/feedback';
import useClickOutside from '../utils/useClickOutside';
import Avatar, { ProjectMark } from './Avatar';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import { CloseIcon, HomeIcon, LogoutIcon, MenuIcon, SearchIcon, TasksIcon, UserIcon } from './Icons';

const COLLAPSE_KEY = 'jomnoub-sidebar-collapsed';
const navClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`;

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  return (
    <div ref={ref} className="menu-wrap">
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Account menu" aria-expanded={open}>
        <Avatar user={user} size={32} />
      </button>
      {open && (
        <div className="menu">
          <div className="menu-section" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Avatar user={user} size={40} />
            <div style={{ minWidth: 0 }}>
              <strong>{user.name}</strong>
              <div className="muted"><small>{user.email}</small></div>
            </div>
          </div>
          <hr className="menu-sep" />
          <Link to="/profile" className="menu-item" onClick={close}><UserIcon size={20} /> Your profile</Link>
          <button type="button" className="menu-item" onClick={logout}><LogoutIcon size={20} /> Log out</button>
        </div>
      )}
    </div>
  );
}

// Reminds password accounts to verify their email. Rechecks on focus, because the
// link is usually opened in another tab.
function VerifyEmailBanner() {
  const { user, refreshUser } = useAuth();
  const [sending, setSending] = useState(false);
  const unverified = !user.emailVerified;

  useEffect(() => {
    if (!unverified) return undefined;
    window.addEventListener('focus', refreshUser);
    return () => window.removeEventListener('focus', refreshUser);
  }, [unverified, refreshUser]);

  if (!unverified) return null;

  const resend = async () => {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      toast('Verification email sent. Check your inbox and spam folder.');
    } catch (err) {
      toast(err.response?.data?.error || 'Could not send the email. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="notice notice-row">
      <span>
        <strong>Please verify your email.</strong> We sent a link to {user.email}. Until then, you won't get reminders
        and can only join projects by invite link.
      </span>
      <button type="button" className="btn btn-sm" onClick={resend} disabled={sending}>{sending ? 'Sending...' : 'Resend email'}</button>
    </div>
  );
}

// The signed-in app frame: top bar with search, sidebar (or drawer), bottom nav on phones
export default function Layout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState(params.get('q') || '');
  const [projects, setProjects] = useState(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get('/projects')
        .then((res) => active && setProjects(res.data.projects))
        .catch(() => active && setProjects((p) => p || []));
    load();
    window.addEventListener(PROJECTS_CHANGED, load);
    return () => {
      active = false;
      window.removeEventListener(PROJECTS_CHANGED, load);
    };
  }, []);

  const toggleMenu = () => {
    if (window.matchMedia('(max-width: 1024px)').matches) {
      setDrawer((d) => !d);
      return;
    }
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        // private mode: not remembered, still works
      }
      return !c;
    });
  };

  const closeDrawer = () => setDrawer(false);

  const submitSearch = (e) => {
    e.preventDefault();
    const q = search.trim();
    setSearchOpen(false);
    navigate(q ? `/dashboard?q=${encodeURIComponent(q)}` : '/dashboard');
  };

  const shellClass = `${collapsed ? 'shell-collapsed' : ''} ${drawer ? 'shell-drawer' : ''}`.trim();

  return (
    <div className={shellClass}>
      <header className="topbar">
        <div className="topbar-start">
          <button type="button" className="icon-btn" onClick={toggleMenu} aria-label="Toggle menu"><MenuIcon /></button>
          <Link to="/dashboard" className="logo" aria-label="Jomnoub home"><Logo /></Link>
        </div>

        <form className={`search${searchOpen ? ' open' : ''}`} role="search" onSubmit={submitSearch}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
            maxLength={100}
          />
          <button type="submit" aria-label="Search"><SearchIcon size={20} /></button>
        </form>

        <div className="topbar-end">
          <button
            type="button"
            className="icon-btn search-toggle"
            onClick={() => setSearchOpen((o) => !o)}
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            style={searchOpen ? { position: 'relative', zIndex: 3 } : undefined}
          >
            {searchOpen ? <CloseIcon /> : <SearchIcon />}
          </button>
          <ThemeToggle />
          <NotificationBell />
          <UserMenu />
        </div>
      </header>

      <div className="backdrop" onClick={closeDrawer} aria-hidden="true" />

      <nav className="sidebar" aria-label="Main">
        <NavLink to="/dashboard" className={navClass} onClick={closeDrawer}><HomeIcon /><span>Home</span></NavLink>
        <NavLink to="/my-tasks" className={navClass} onClick={closeDrawer}><TasksIcon /><span>My tasks</span></NavLink>

        <div className="nav-projects">
          <hr className="nav-divider" />
          <div className="nav-title">Your projects</div>
          {projects && projects.length === 0 && <p className="nav-empty">No projects yet.</p>}
          {projects?.map((p) => (
            <NavLink key={p.id} to={`/projects/${p.id}`} className={navClass} onClick={closeDrawer} title={p.name}>
              <ProjectMark id={p.id} name={p.name} size={24} radius={6} />
              <span>{p.name}</span>
            </NavLink>
          ))}
          <hr className="nav-divider" />
          <NavLink to="/privacy" className={navClass}><span className="muted"><small>Privacy policy</small></span></NavLink>
        </div>
      </nav>

      <main className="main">
        <div className="main-inner">
          <VerifyEmailBanner />
          <Outlet />
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Quick links">
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}><HomeIcon /><span>Home</span></NavLink>
        <NavLink to="/my-tasks" className={({ isActive }) => (isActive ? 'active' : '')}><TasksIcon /><span>My tasks</span></NavLink>
      </nav>
    </div>
  );
}
