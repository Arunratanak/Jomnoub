import { randomUUID } from 'node:crypto';

// Live updates: each visible page asks every few seconds "has anything changed since my
// last check?" and reloads only the parts that did. A short request each time, rather than
// a connection held open, so nothing piles up in Render's network or keeps a request
// waiting.
//
// Changes only say WHAT changed ("tasks in project X"), never the content: the page then
// reloads it through the normal API, with all its permission checks. So this can't reveal
// anything its viewer couldn't already load.
//
// The list is kept in this process's memory, which suits a single server (as on Render's
// free plan). Several servers would need a shared store instead.

const KEEP_MS = 10 * 60 * 1000; // a page away longer than this reloads everything instead
const MAX_KEEP = 5000; // changes kept across everyone
const MAX_PER_CHECK = 50; // more than this since the last check: reload everything instead

// Changes from before a restart are gone, so pages that see a new id reload everything
const BOOT = randomUUID();
let seq = 0;
let floor = 0; // the newest change already dropped from the list
const log = []; // oldest first: { seq, at, users: Set of user ids, change, tab }

const TAB_ID = /^[\w-]{8,64}$/;
export const cleanTabId = (value) => (typeof value === 'string' && TAB_ID.test(value) ? value : null);

function prune(now = Date.now()) {
  let drop = 0;
  while (drop < log.length && (log.length - drop > MAX_KEEP || now - log[drop].at > KEEP_MS)) drop += 1;
  if (drop) {
    floor = log[drop - 1].seq;
    log.splice(0, drop);
  }
}

// Notes that something changed for these people. The tab that made the change is left
// out of its own results, since it has already updated itself.
export function announce(userIds, change, { exceptTab = null } = {}) {
  const users = new Set(userIds.filter(Boolean).map(String));
  if (!users.size) return;
  seq += 1;
  log.push({ seq, at: Date.now(), users, change, tab: exceptTab });
  prune();
}

// What changed for this person since their page's last check. `resync` means the page
// should reload everything: the server restarted, or the page was away too long.
export function changesFor(userId, { since, boot, tab }) {
  prune();
  const now = { boot: BOOT, seq };
  if (!boot) return { ...now, changes: [], resync: false }; // a page's first check
  if (boot !== BOOT || !Number.isSafeInteger(since) || since < floor || since > seq) {
    return { ...now, changes: [], resync: true };
  }
  const id = String(userId);
  const changes = [];
  for (let i = log.length - 1; i >= 0 && log[i].seq > since; i -= 1) {
    const entry = log[i];
    if (entry.users.has(id) && !(tab && entry.tab === tab)) changes.push(entry.change);
  }
  if (changes.length > MAX_PER_CHECK) return { ...now, changes: [], resync: true };
  return { ...now, changes: changes.reverse(), resync: false };
}

// For tests
export const keptChanges = () => log.length;
