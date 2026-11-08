import { useEffect, useRef, useSyncExternalStore } from 'react';
import api, { TAB_ID } from '../api/client';

// Live updates: while the page is visible, it asks the server every few seconds whether
// anything has changed ("tasks in project X"), and whatever shows that part reloads it.
// Each check is a short request; nothing is held open. A hidden page stops checking and
// catches up as soon as it's shown again. If checks fail, pages fall back to reloading by
// themselves (see useLiveStatus) and checks are retried, less often each time.
const CHANGE = 'jomnoub:live-change';
const CHECK_MS = 3000;
const RETRY_MAX_MS = 30000;

let status = 'off'; // 'off' | 'connecting' | 'live' | 'offline'
let wanted = false;
let boot = null; // which server run the counter below belongs to
let since = 0; // the server's change counter at the last check
let failures = 0;
let timer = null;
let inFlight = false;
let generation = 0; // stopping makes the answer to a check still on its way ignored
const statusListeners = new Set();

function setStatus(next) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}

const emit = (change) => window.dispatchEvent(new CustomEvent(CHANGE, { detail: change }));

function schedule() {
  clearTimeout(timer);
  timer = null;
  if (!wanted || document.hidden) return;
  const delay = failures ? Math.min(CHECK_MS * 2 ** failures, RETRY_MAX_MS) : CHECK_MS;
  timer = setTimeout(check, delay);
}

async function check() {
  clearTimeout(timer);
  timer = null;
  if (!wanted || inFlight || document.hidden) return;
  inFlight = true;
  const run = generation;
  try {
    const { data } = await api.get('/live/changes', { params: { since, boot: boot || undefined, tab: TAB_ID } });
    if (run !== generation) return;
    const first = !boot;
    boot = data.boot;
    since = data.seq;
    failures = 0;
    setStatus('live');
    // The server restarted, or this page was away too long: everything reloads once
    if (!first && data.resync) emit({ type: 'resync' });
    else data.changes.forEach(emit);
  } catch {
    if (run !== generation) return;
    failures += 1;
    setStatus('offline');
  } finally {
    if (run === generation) {
      inFlight = false;
      schedule();
    }
  }
}

const onOnline = () => {
  failures = 0;
  check();
};
const onOffline = () => setStatus('offline');
const onVisibility = () => (document.hidden ? clearTimeout(timer) : check());

export function startLive() {
  if (wanted) return;
  wanted = true;
  generation += 1;
  setStatus('connecting');
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisibility);
  check();
}

export function stopLive() {
  wanted = false;
  generation += 1;
  inFlight = false;
  clearTimeout(timer);
  timer = null;
  boot = null;
  since = 0;
  failures = 0;
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  document.removeEventListener('visibilitychange', onVisibility);
  setStatus('off');
}

// Calls fn(change) for each change, and { type: 'resync' } when everything should
// reload. Returns a function that stops listening.
export function onLiveChange(fn) {
  const listener = (e) => fn(e.detail);
  window.addEventListener(CHANGE, listener);
  return () => window.removeEventListener(CHANGE, listener);
}

// The same, for components: always calls the latest version of handler
export function useLiveChanges(handler) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => onLiveChange((change) => latest.current(change)), []);
}

// 'live' while checks are working; anything else means pages should reload by themselves
export function useLiveStatus() {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    () => status,
  );
}

// Runs fn once a burst of calls has settled
export function debounce(fn, ms) {
  let pending = null;
  const run = (...args) => {
    clearTimeout(pending);
    pending = setTimeout(() => fn(...args), ms);
  };
  run.cancel = () => clearTimeout(pending);
  return run;
}

// Is this change about the given project, for one of these areas? A full reload counts too.
export const isAbout = (change, projectId, areas) =>
  change.type === 'resync' || (change.type === 'project' && change.projectId === projectId && (!areas || areas.includes(change.area)));
