// Live updates: each open page keeps one connection (server-sent events) and is told
// when something it shows has changed. Messages only say WHAT changed ("tasks in project
// X"), never the content: the page then reloads it through the normal API, with all its
// permission checks. So a live connection can't reveal anything its viewer couldn't
// already load.
//
// Connections are kept in this process's memory, which suits a single server (as on
// Render's free plan). Several servers would need a shared message bus instead.

const PING_MS = 25000; // keeps proxies from closing a quiet connection
const MAX_PER_USER = 10; // open tabs per person; the oldest is closed beyond this
const MAX_TOTAL = 2000;

const byUser = new Map(); // userId -> Set of { res, tab }
let total = 0;
let pingTimer = null;

const TAB_ID = /^[\w-]{8,64}$/;
export const cleanTabId = (value) => (typeof value === 'string' && TAB_ID.test(value) ? value : null);

function write(client, event, data) {
  try {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // The connection is closing; its close handler removes it
  }
}

export function sendPings() {
  for (const clients of byUser.values()) for (const client of clients) write(client, 'ping', {});
}

function removeClient(userId, client) {
  const clients = byUser.get(userId);
  if (!clients?.delete(client)) return;
  total -= 1;
  if (clients.size === 0) byUser.delete(userId);
  if (total === 0 && pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

// Starts a stream for this request. Returns false if the server is at its limit.
export function openStream(req, res) {
  if (total >= MAX_TOTAL) return false;
  const userId = String(req.user._id);
  const client = { res, tab: cleanTabId(req.query.tab) };

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // tells proxies not to hold the stream back
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  const clients = byUser.get(userId) || new Set();
  if (clients.size >= MAX_PER_USER) {
    const oldest = clients.values().next().value;
    removeClient(userId, oldest);
    oldest.res.end();
  }
  clients.add(client);
  byUser.set(userId, clients);
  total += 1;
  if (!pingTimer) {
    pingTimer = setInterval(sendPings, PING_MS);
    pingTimer.unref?.();
  }

  write(client, 'ready', {});
  req.on('close', () => removeClient(userId, client));
  return true;
}

// Tells these people that something changed. The tab that made the change is skipped,
// since it has already updated itself.
export function announce(userIds, change, { exceptTab = null } = {}) {
  for (const id of new Set(userIds.filter(Boolean).map(String))) {
    for (const client of byUser.get(id) || []) {
      if (exceptTab && client.tab === exceptTab) continue;
      write(client, 'change', change);
    }
  }
}

export const openConnections = () => total;
