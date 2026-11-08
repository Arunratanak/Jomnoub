import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { ProjectMark } from './Avatar';
import { SearchIcon } from './Icons';
import useClickOutside from '../utils/useClickOutside';
import { joinNames, STATUSES } from '../utils/taskStatus';

const WAIT_MS = 200; // after the last keystroke, before asking the server

// The matching part of a name, in bold
function Highlight({ text, query }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || at < 0) return text;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + query.length)}</mark>{text.slice(at + query.length)}</>;
}

// Searches projects and tasks as you type. Results open directly: a project, or a task's
// window inside its project. Arrow keys move through them and Enter opens one.
export default function SearchBox({ open, onDone }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [text, setText] = useState(params.get('q') || '');
  const [results, setResults] = useState(null); // { projects, tasks } for `searched`
  const [searched, setSearched] = useState('');
  const [failed, setFailed] = useState(false);
  // Results stay open only on the page they were opened on: going anywhere closes them
  const [panelPage, setPanelPage] = useState(null);
  const panel = panelPage === location.key;
  const setPanel = (show) => setPanelPage(show ? location.key : null);
  const [active, setActive] = useState(-1);
  const wrap = useRef(null);
  const input = useRef(null);
  const latest = useRef(0);
  const closePanel = useCallback(() => setPanelPage(null), []);
  useClickOutside(wrap, panel, closePanel);

  const query = text.trim();

  // Ask the server once typing pauses; answers to older searches are ignored
  useEffect(() => {
    if (!query) return undefined;
    const ask = ++latest.current;
    const timer = setTimeout(() => {
      api
        .get('/search', { params: { q: query } })
        .then((res) => {
          if (ask !== latest.current) return;
          setResults(res.data);
          setSearched(query);
          setFailed(false);
          setActive(-1);
        })
        .catch(() => { if (ask === latest.current) setFailed(true); });
    }, WAIT_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Clearing Home's search clears the box too
  const homeQuery = params.get('q') || '';
  const [lastHomeQuery, setLastHomeQuery] = useState(homeQuery);
  if (lastHomeQuery !== homeQuery) {
    setLastHomeQuery(homeQuery);
    if (lastHomeQuery && !homeQuery) setText('');
  }

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const projects = query && results ? results.projects : [];
  const tasks = query && results ? results.tasks : [];
  const items = [
    ...projects.map((p) => ({ key: `p${p.id}`, to: `/projects/${p.id}` })),
    ...tasks.map((t) => ({ key: `t${t._id}`, to: `/projects/${t.project._id}?task=${t._id}` })),
    ...(query ? [{ key: 'all', to: `/dashboard?q=${encodeURIComponent(query)}` }] : []),
  ];
  const waiting = query && searched !== query && !failed;

  const choose = (item) => {
    if (!item) return;
    navigate(item.to);
    if (item.key !== 'all') setText('');
    setPanel(false);
    input.current?.blur();
    onDone?.();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPanel(true);
      setActive((i) => (i + 1) % Math.max(items.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      if (panel) { e.preventDefault(); setPanel(false); } else if (text) setText('');
      else onDone?.();
    }
  };

  const submit = (e) => {
    e.preventDefault();
    // Enter opens the highlighted result, or the first one
    choose(items[active] || items[0]);
  };

  const option = (index, content, className = '') => (
    <li
      key={items[index].key}
      id={`search-option-${index}`}
      role="option"
      aria-selected={active === index}
      className={`search-option${active === index ? ' active' : ''}${className}`}
      onMouseEnter={() => setActive(index)}
      onMouseDown={(e) => e.preventDefault()} // keep the text box focused
      onClick={() => choose(items[index])}
    >
      {content}
    </li>
  );

  return (
    <form ref={wrap} className={`search${open ? ' open' : ''}`} role="search" onSubmit={submit}>
      <input
        ref={input}
        type="search"
        value={text}
        onChange={(e) => { setText(e.target.value); setPanel(true); setActive(-1); }}
        onFocus={() => { if (query) setPanel(true); }}
        onKeyDown={onKeyDown}
        placeholder="Search projects and tasks"
        aria-label="Search projects and tasks"
        role="combobox"
        aria-expanded={panel && Boolean(query)}
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `search-option-${active}` : undefined}
        maxLength={100}
        autoComplete="off"
      />
      <button type="submit" aria-label="Search"><SearchIcon size={20} /></button>

      {panel && query && (
        <div className="search-panel">
          {failed && <p className="search-note">Search isn't working right now. Please try again.</p>}
          {!failed && waiting && !results && <p className="search-note">Searching...</p>}
          <ul id="search-results" role="listbox" aria-label="Search results" className={waiting ? 'search-stale' : ''}>
            {projects.length > 0 && <li className="search-heading" role="presentation">Projects</li>}
            {projects.map((p, i) => option(i, (
              <>
                <ProjectMark id={p.id} name={p.name} size={28} radius={7} />
                <span className="search-text">
                  <span className="search-title"><Highlight text={p.name} query={searched} /></span>
                  {p.description && <small className="muted">{p.description}</small>}
                </span>
              </>
            )))}
            {tasks.length > 0 && <li className="search-heading" role="presentation">Tasks</li>}
            {tasks.map((t, i) => {
              const status = STATUSES.find((s) => s.value === t.status);
              return option(projects.length + i, (
                <>
                  <span className="search-status" style={{ background: status?.color }} title={status?.label} aria-hidden="true" />
                  <span className="search-text">
                    <span className={`search-title${t.status === 'done' ? ' done-title' : ''}`}><Highlight text={t.title} query={searched} /></span>
                    <small className="muted">
                      {t.project.name} · {status?.label}{t.assignees.length > 0 && ` · ${joinNames(t.assignees)}`}
                    </small>
                  </span>
                </>
              ));
            })}
            {!waiting && !failed && results && projects.length === 0 && tasks.length === 0 && (
              <li className="search-note" role="presentation">Nothing matches "{query}".</li>
            )}
            {option(items.length - 1, <span className="search-text"><span className="search-title">Show projects matching "{query}" on Home</span></span>, ' search-all')}
          </ul>
        </div>
      )}
    </form>
  );
}
