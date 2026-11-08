import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import Logo, { LogoMark } from '../components/Logo';
import Modal from '../components/Modal';
import ThemeToggle from '../components/ThemeToggle';
import { BellIcon, CalendarIcon, CommentIcon, FolderIcon, LinkIcon, PlusIcon, TasksIcon } from '../components/Icons';
import useTitle from '../utils/useTitle';

const FEATURES = [
  { icon: TasksIcon, title: 'A board for every project', text: 'Move tasks from To do to Done and see who is working on what.' },
  { icon: CalendarIcon, title: 'Deadlines and reminders', text: 'Everyone gets a reminder before a task is due.' },
  { icon: CommentIcon, title: 'Chat and comments', text: 'Talk about the project or one task, right where the work is.' },
  { icon: BellIcon, title: 'Live updates', text: "Teammates' changes appear on your screen without reloading." },
];

// What each locked action asks for, and where to go after signing in
const ACTIONS = {
  create: { title: 'Sign in to create a project', text: 'Log in or create a free account to start your project. It only takes a moment.', after: '/dashboard?new=project' },
  join: { title: 'Sign in to join a project', text: 'Log in or create a free account, then paste your invite link.', after: '/dashboard?join=1' },
};

// The home page for people who aren't signed in
export default function Welcome() {
  useTitle('Organize your group work');
  const navigate = useNavigate();
  const [asking, setAsking] = useState(null); // 'create' | 'join'
  const close = useCallback(() => setAsking(null), []);
  const goSignIn = (mode, from = '/dashboard') => navigate('/login', { state: { mode, from } });

  return (
    <div className="welcome">
      <header className="welcome-bar">
        <span className="welcome-logo"><Logo /></span>
        <div className="welcome-bar-actions">
          <ThemeToggle />
          <Link className="btn" to="/login">Log in</Link>
        </div>
      </header>

      <main className="welcome-main">
        <section className="welcome-hero">
          <LogoMark size={72} />
          <h1>Organize and track your group work</h1>
          <p>Plan projects with your team, share tasks, and always know what's left to do.</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => goSignIn('register')}>Get started</button>
          <small>Already have an account? <Link to="/login">Log in</Link></small>
        </section>

        <section className="welcome-start" aria-label="Start a project">
          <button type="button" className="welcome-action" onClick={() => setAsking('create')}>
            <PlusIcon size={22} />
            <span><strong>New project</strong><small>Start from scratch or a template</small></span>
          </button>
          <button type="button" className="welcome-action" onClick={() => setAsking('join')}>
            <LinkIcon size={22} />
            <span><strong>Join project</strong><small>Use an invite link from a teammate</small></span>
          </button>
        </section>

        <section className="welcome-features" aria-label="What you can do">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="welcome-feature">
              <Icon size={22} />
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          ))}
        </section>

        <footer className="welcome-footer">
          <FolderIcon size={16} /> Jomnoub · <Link to="/privacy">Privacy policy</Link>
        </footer>
      </main>

      <AnimatePresence>
        {asking && (
          <Modal key="ask" title={ACTIONS[asking].title} onClose={close}>
            <p className="muted">{ACTIONS[asking].text}</p>
            <div className="form-actions welcome-ask-actions">
              <button type="button" className="btn" onClick={close}>Not now</button>
              <button type="button" className="btn" onClick={() => goSignIn('login', ACTIONS[asking].after)}>Log in</button>
              <button type="button" className="btn btn-primary" onClick={() => goSignIn('register', ACTIONS[asking].after)}>Sign up</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
