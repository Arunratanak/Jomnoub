import { useEffect, useRef, useSyncExternalStore } from 'react';
import { TAB_ID } from '../api/client';

// One live connection per open page, shared by everything on it. The server sends a short
// message whenever something changes ("tasks in project X"), and whatever shows that part
// reloads it. If the connection can't be made, or messages stop arriving, pages fall back
// to checking every few seconds (see useLiveStatus) and the connection is retried.
const CHANGE = 'jomnoub:live-change';
const READY_WAIT_MS = 10000; // no "ready" by then: something on the way is holding messages back
const SILENT_MS = 70000; // the server pings every 25 s, so this long without anything is a dead line
const RETRY_FIRST_MS = 3000;
const RETRY_MAX_MS = 60000;

let source = null;
let status = 'off'; // 'off' | 'connecting' | 'live' | 'offline'
let wanted = false;
let everLive = false;
let lastHeard = 0;
let retryDelay = RETRY_FIRST_MS;
let readyTimer = null;
let retryTimer = null;
let watchdog = null;
const statusListeners = new Set();

function setStatus(next) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}

const emit = (change) => window.dispatchEvent(new CustomEvent(CHANGE, { detail: change }));
const streamUrl = () => `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/live?tab=${encodeURIComponent(TAB_ID)}`;

function closeSource() {
  clearTimeout(readyTimer);
  if (source) {
    source.close();
    source = null;
  }
}

function retryLater() {
  closeSource();
  clearTimeout(retryTimer);
  if (!wanted) return;
  retryTimer = setTimeout(connect, retryDelay);
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
}

function connect() {
  closeSource();
  if (status !== 'offline') setStatus('connecting');
  source = new EventSource(streamUrl(), { withCredentials: true });
  readyTimer = setTimeout(() => {
    setStatus('offline');
    retryLater();
  }, READY_WAIT_MS);

  source.addEventListener('ready', () => {
    clearTimeout(readyTimer);
    lastHeard = Date.now();
    retryDelay = RETRY_FIRST_MS;
    const cameBack = everLive;
    everLive = true;
    setStatus('live');
    // Anything that changed while disconnected was missed: everyone reloads once
    if (cameBack) emit({ type: 'resync' });
  });
  source.addEventListener('ping', () => { lastHeard = Date.now(); });
  source.addEventListener('change', (e) => {
    lastHeard = Date.now();
    try {
      emit(JSON.parse(e.data));
    } catch {
      // A malformed message is ignored
    }
  });
  source.onerror = () => {
    // The browser retries a dropped connection by itself; a refused one (e.g. signed out) it doesn't
    if (status === 'live') setStatus('connecting');
    if (source?.readyState === EventSource.CLOSED) retryLater();
  };
}

// Back online, or back to a tab that has been quiet too long (e.g. after the computer
// slept): the line may look open while messages were lost, so start a fresh one. The new
// connection's "ready" makes every page catch up.
const STALE_MS = 40000;
function reconnectNow() {
  if (!wanted) return;
  clearTimeout(retryTimer);
  retryDelay = RETRY_FIRST_MS;
  connect();
}
const onOffline = () => setStatus('offline');
const onVisible = () => {
  if (!document.hidden && status === 'live' && Date.now() - lastHeard > STALE_MS) reconnectNow();
};

export function startLive() {
  if (wanted || typeof EventSource === 'undefined') return;
  wanted = true;
  retryDelay = RETRY_FIRST_MS;
  window.addEventListener('online', reconnectNow);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  connect();
  watchdog = setInterval(() => {
    if (status === 'live' && Date.now() - lastHeard > SILENT_MS) {
      setStatus('offline');
      retryLater();
    }
  }, 15000);
}

export function stopLive() {
  wanted = false;
  window.removeEventListener('online', reconnectNow);
  window.removeEventListener('offline', onOffline);
  document.removeEventListener('visibilitychange', onVisible);
  everLive = false;
  clearTimeout(retryTimer);
  clearInterval(watchdog);
  closeSource();
  setStatus('off');
}

// Calls fn(change) for each change, and { type: 'resync' } after a reconnection. Returns
// a function that stops listening.
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

// 'live' while messages are arriving; anything else means pages should check by themselves
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
  let timer = null;
  const run = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  run.cancel = () => clearTimeout(timer);
  return run;
}

// Is this change about the given project, for one of these areas? A reconnection counts too.
export const isAbout = (change, projectId, areas) =>
  change.type === 'resync' || (change.type === 'project' && change.projectId === projectId && (!areas || areas.includes(change.area)));
