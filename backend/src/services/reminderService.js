import Task from '../models/Task.js';
import ReminderLog from '../models/ReminderLog.js';
import { hasVerifiedEmail } from '../models/User.js';
import { sendEmail, escapeHtml } from './emailService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 2;
const SEND_GAP_MS = 600; // Resend's free tier allows 2 requests per second

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatDate = (d) => new Date(d).toISOString().slice(0, 10); // deadlines are UTC dates

// One summary email: subject with counts, overdue and due-soon sections, link to My Tasks.
// Every user-supplied value in the HTML is escaped.
export function buildReminderEmail(name, overdue, dueSoon) {
  const parts = [];
  if (overdue.length) parts.push(`${overdue.length} overdue`);
  if (dueSoon.length) parts.push(`${dueSoon.length} due soon`);
  const subject = `Jomnoub: ${parts.join(', ')}`;
  const link = `${process.env.FRONTEND_URL}/my-tasks`;

  const textSection = (title, items) =>
    items.length
      ? `${title}\n${items.map((t) => `- ${t.title} (${t.project.name}), due ${formatDate(t.deadline)}`).join('\n')}\n\n`
      : '';
  const text =
    `Hi ${name},\n\n` +
    textSection('OVERDUE', overdue) +
    textSection('DUE SOON', dueSoon) +
    `See all your tasks: ${link}\n`;

  const htmlSection = (title, color, items) =>
    items.length
      ? `<h3 style="color:${color}">${title}</h3><ul>${items
          .map(
            (t) =>
              `<li><strong>${escapeHtml(t.title)}</strong> (${escapeHtml(t.project.name)}), due ${formatDate(t.deadline)}</li>`
          )
          .join('')}</ul>`
      : '';
  const html =
    `<p>Hi ${escapeHtml(name)},</p>` +
    htmlSection('Overdue', '#b91c1c', overdue) +
    htmlSection('Due soon', '#1d4ed8', dueSoon) +
    `<p><a href="${escapeHtml(link)}">See all your tasks in Jomnoub</a></p>`;

  return { subject, text, html };
}

// Emails each person one summary of their unfinished tasks that are overdue or
// due within 2 days. Never sends the same reminder twice. With dryRun, sends
// nothing and writes nothing. Returns counts only.
export async function runReminders({ dryRun }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dueSoonLimit = new Date(today.getTime() + DUE_SOON_DAYS * DAY_MS);

  const tasks = await Task.find({
    status: { $ne: 'done' },
    assignee: { $ne: null },
    deadline: { $ne: null, $lte: dueSoonLimit },
  })
    .select('title deadline assignee project')
    .populate('assignee', 'name email isDemo googleId emailVerified')
    .populate('project', 'name')
    .lean();

  // Claim each reminder before sending: inserting the log row first means two
  // overlapping runs can never both send the same reminder.
  const byUser = new Map();
  const claimed = [];
  let skipped = 0;
  try {
    for (const t of tasks) {
      if (!t.assignee?.email || !t.project) { skipped += 1; continue; } // deleted user/project
      if (t.assignee.isDemo) { skipped += 1; continue; } // seed data: fake @example.invalid users
      // Unverified address (password account): it might not be theirs, so never email it
      if (!hasVerifiedEmail(t.assignee)) { skipped += 1; continue; }

      const type = t.deadline < today ? 'overdue' : 'due-soon';
      const key = { task: t._id, type, deadline: t.deadline };

      let logId = null;
      if (dryRun) {
        if (await ReminderLog.exists(key)) { skipped += 1; continue; }
      } else {
        try {
          logId = (await ReminderLog.create(key))._id;
          claimed.push(logId);
        } catch (err) {
          if (err.code === 11000) { skipped += 1; continue; } // already sent (or claimed by another run)
          throw err;
        }
      }

      const userId = String(t.assignee._id);
      if (!byUser.has(userId)) byUser.set(userId, { user: t.assignee, overdue: [], dueSoon: [], logIds: [] });
      const group = byUser.get(userId);
      (type === 'overdue' ? group.overdue : group.dueSoon).push(t);
      if (logId) group.logIds.push(logId);
    }
  } catch (err) {
    // Unexpected DB error mid-claim: release our claims so the next run retries them
    if (claimed.length) await ReminderLog.deleteMany({ _id: { $in: claimed } });
    throw err;
  }

  let emails = 0;
  let failures = 0;
  if (!dryRun) {
    for (const { user, overdue, dueSoon, logIds } of byUser.values()) {
      if (emails + failures > 0) await sleep(SEND_GAP_MS);
      try {
        await sendEmail({ to: user.email, ...buildReminderEmail(user.name, overdue, dueSoon) });
        emails += 1;
      } catch (err) {
        failures += 1;
        console.error('Reminder email failed:', err.message); // never log addresses
        await ReminderLog.deleteMany({ _id: { $in: logIds } }); // un-claim so the next run retries
      }
    }
  }

  return {
    tasksFound: tasks.length,
    skipped,
    emails: dryRun ? byUser.size : emails, // dry run: how many emails WOULD be sent
    failures,
  };
}
