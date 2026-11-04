// Demo data for presentations. Never runs automatically.
//
//   npm run seed          create (or re-create) the demo project for SEED_EMAIL
//   npm run seed:clear    remove all demo data, nothing else
//
// Refuses to run when NODE_ENV=production unless you add --force:
//   npm run seed -- --force
import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Project from '../src/models/Project.js';
import Task from '../src/models/Task.js';
import Activity from '../src/models/Activity.js';
import Invite from '../src/models/Invite.js';
import ReminderLog from '../src/models/ReminderLog.js';
import { quote } from '../src/utils/activity.js';

const args = process.argv.slice(2);
const CLEAR = args.includes('--clear');
const FORCE = args.includes('--force');
const DAY = 24 * 60 * 60 * 1000;
const STATUS = { todo: 'To do', 'in-progress': 'In progress', done: 'Done' };

const TEAMMATES = [
  { key: 'alex', name: 'Alex Demo' },
  { key: 'sam', name: 'Sam Demo' },
  { key: 'jordan', name: 'Jordan Demo' },
];

// [title, status, assignee key ('me' = SEED_EMAIL user, null = unassigned), deadline in days from today (null = none), creator key]
const TASKS = [
  ['Write project proposal', 'done', 'me', -10, 'me'],
  ['Set up GitHub repository', 'done', 'alex', -8, 'me'],
  ['Design the database schema', 'done', 'sam', -6, 'alex'],
  ['Build Google sign-in', 'done', 'me', -4, 'me'],
  ['Write API unit tests', 'todo', 'sam', -3, 'sam'],
  ['Create UI wireframes', 'in-progress', 'jordan', -2, 'jordan'],
  ['Implement the task API', 'in-progress', 'alex', -1, 'alex'],
  ['Add dashboard charts', 'in-progress', 'me', 1, 'me'],
  ['Test the invite flow', 'todo', 'jordan', 2, 'me'],
  ['Prepare presentation slides', 'todo', 'me', 4, 'me'],
  ['Accessibility review', 'todo', 'sam', 6, 'jordan'],
  ['Write the README', 'todo', null, null, 'alex'],
];

function fail(message) {
  console.error(`Seed: ${message}`);
  process.exit(1);
}

// Removes every demo project (with its tasks, activity, invites and reminder
// logs) and every demo user, including their memberships in real projects.
async function clearDemo() {
  const demoUsers = await User.find({ isDemo: true }).select('_id').lean();
  const demoUserIds = demoUsers.map((u) => u._id);
  const demoProjects = await Project.find({ isDemo: true }).select('_id').lean();
  const demoProjectIds = demoProjects.map((p) => p._id);
  const demoTaskIds = (await Task.find({ project: { $in: demoProjectIds } }).select('_id').lean()).map((t) => t._id);

  const counts = {
    reminderLogs: (await ReminderLog.deleteMany({ task: { $in: demoTaskIds } })).deletedCount,
    tasks: (await Task.deleteMany({ project: { $in: demoProjectIds } })).deletedCount,
    activity: (await Activity.deleteMany({ $or: [{ project: { $in: demoProjectIds } }, { actor: { $in: demoUserIds } }] })).deletedCount,
    invites: (await Invite.deleteMany({ project: { $in: demoProjectIds } })).deletedCount,
    projects: (await Project.deleteMany({ _id: { $in: demoProjectIds } })).deletedCount,
  };
  // If demo users were added to real projects, take them out and unassign their tasks
  await Task.updateMany({ assignee: { $in: demoUserIds } }, { assignee: null });
  await Project.updateMany({ 'members.user': { $in: demoUserIds } }, { $pull: { members: { user: { $in: demoUserIds } } } });
  counts.users = (await User.deleteMany({ _id: { $in: demoUserIds } })).deletedCount;
  return counts;
}

async function seed() {
  const email = process.env.SEED_EMAIL?.trim().toLowerCase();
  if (!email) fail('SEED_EMAIL is not set. Add SEED_EMAIL=<your Google email> to backend/.env.');
  const me = await User.findOne({ email, isDemo: false });
  if (!me) fail('No TaskHub user has the SEED_EMAIL address. Sign in to TaskHub once with that Google account, then run this again.');

  const cleared = await clearDemo(); // re-running replaces the old demo data instead of duplicating it

  const teammates = await User.insertMany(
    TEAMMATES.map((t) => ({ googleId: `demo:${t.key}`, email: `${t.key}@example.invalid`, name: t.name, isDemo: true }))
  );
  const people = { me, ...Object.fromEntries(TEAMMATES.map((t, i) => [t.key, teammates[i]])) };

  const project = await Project.create({
    name: 'Demo project',
    description: 'Sample data for the TaskHub demo. Remove it with npm run seed:clear.',
    members: [{ user: me._id, role: 'owner' }, ...teammates.map((u) => ({ user: u._id, role: 'member' }))],
    isDemo: true,
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // deadlines are UTC dates, like the app stores them
  const tasks = await Task.insertMany(
    TASKS.map(([title, status, assignee, days, creator]) => ({
      project: project._id,
      title,
      status,
      assignee: assignee ? people[assignee]._id : null,
      deadline: days === null ? null : new Date(today.getTime() + days * DAY),
      createdBy: people[creator]._id,
    }))
  );

  // Activity history spread over the last 12 days, in the same wording the app uses
  const events = [];
  for (const t of teammates) events.push({ actor: t._id, message: 'joined via invite link' });
  TASKS.forEach(([title, status, assignee, , creator]) => {
    events.push({ actor: people[creator]._id, message: `created task ${quote(title)}` });
    if (assignee) events.push({ actor: people[creator]._id, message: `assigned ${quote(title)} to ${people[assignee].name}` });
    const mover = people[assignee || creator]._id;
    if (status !== 'todo') events.push({ actor: mover, message: `moved ${quote(title)} from To do to In progress` });
    if (status === 'done') events.push({ actor: mover, message: `moved ${quote(title)} from In progress to Done` });
  });
  const start = Date.now() - 12 * DAY;
  const step = (11.5 * DAY) / events.length;
  await Activity.insertMany(
    events.map((e, i) => ({ ...e, project: project._id, createdAt: new Date(start + i * step) }))
  );

  const open = tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.deadline && t.deadline < today).length;
  const dueThisWeek = open.filter((t) => t.deadline && t.deadline >= today && t.deadline <= new Date(today.getTime() + 7 * DAY)).length;
  const byStatus = Object.fromEntries(Object.keys(STATUS).map((s) => [STATUS[s], tasks.filter((t) => t.status === s).length]));

  if (cleared.projects || cleared.users) console.log(`Removed previous demo data (${cleared.projects} project, ${cleared.users} demo users).`);
  console.log(`
Demo data created
  Owner:        ${me.name} (the SEED_EMAIL user)
  Project:      "${project.name}"  ->  /projects/${project.id}
  Teammates:    ${teammates.map((u) => u.name).join(', ')} (fake, @example.invalid, isDemo)
  Tasks:        ${tasks.length} (${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', ')})
                ${overdue} overdue, ${dueThisWeek} due within 7 days, ${tasks.filter((t) => !t.assignee).length} unassigned
  Activity:     ${events.length} entries over the last 12 days

Remove it any time with: npm run seed:clear`);
}

// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production' && !FORCE) {
  fail('NODE_ENV is "production". Refusing to touch a production database. Add --force if you really mean it.');
}
if (!process.env.MONGODB_URI) fail('MONGODB_URI is not set in backend/.env.');
if (process.env.NODE_ENV !== 'production') dns.setServers(['8.8.8.8', '1.1.1.1']); // same workaround as index.js

try {
  await mongoose.connect(process.env.MONGODB_URI);
  if (CLEAR) {
    const c = await clearDemo();
    console.log(`Demo data removed: ${c.projects} project(s), ${c.tasks} tasks, ${c.activity} activity entries, ${c.invites} invites, ${c.reminderLogs} reminder logs, ${c.users} demo users.`);
  } else {
    await seed();
  }
} catch (err) {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
