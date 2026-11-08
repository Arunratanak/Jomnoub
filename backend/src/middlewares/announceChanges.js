import { announce, cleanTabId } from '../services/liveService.js';

// After any successful change inside a project, tells the project's members which part
// changed, so their open pages can reload it. Runs for every route, so new features are
// covered without remembering to add anything.
const PROJECT_PATH = /^\/api\/projects\/([a-f\d]{24})(\/[^?]*)?/i;
const INVITE_ACCEPT = /^\/api\/invites\/[^/?]+\/accept/;

function describe(url) {
  if (INVITE_ACCEPT.test(url)) return { area: 'members' };
  const match = url.match(PROJECT_PATH);
  if (!match) return null;
  const rest = match[2] || '';
  if (rest.startsWith('/invites')) return null; // only the owner sees invite links
  if (rest.startsWith('/messages')) return { area: 'chat' };
  const comment = rest.match(/^\/tasks\/([a-f\d]{24})\/comments/i);
  if (comment) return { area: 'comments', taskId: comment[1] };
  const task = rest.match(/^\/tasks(?:\/([a-f\d]{24}))?/i);
  if (task) return { area: 'tasks', ...(task[1] ? { taskId: task[1] } : {}) };
  const member = rest.match(/^\/members(?:\/([a-f\d]{24}))?/i);
  if (member) return { area: 'members', removedUser: member[1] || null };
  if (rest === '' || rest === '/') return { area: 'project' };
  return null;
}

export default function announceChanges(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.project) return;
    const what = describe(req.originalUrl);
    if (!what) return;
    const { removedUser, ...detail } = what;
    const projectId = String(req.project._id);
    // Members may have been loaded as full profiles by then (e.g. after a rename)
    const members = req.project.members.map((m) => m.user?._id ?? m.user);
    const change = { type: 'project', projectId, ...detail };
    announce(members, change, { exceptTab: cleanTabId(req.get('x-tab-id')) });
    // Someone removed (or leaving) is no longer in the list, but their open pages
    // should find out they've lost access
    if (removedUser && req.method === 'DELETE') announce([removedUser], { ...change, area: 'access' });
  });
  next();
}
