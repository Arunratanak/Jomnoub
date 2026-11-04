import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import Task from '../models/Task.js';
import ReminderLog from '../models/ReminderLog.js';
import { sendEmail, escapeHtml } from '../utils/email.js';

const router = Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 2;
const SEND_GAP_MS = 600; // Resend's free tier allows 2 requests per second

// Machine-to-machine auth for the scheduled job. Deliberately NOT requireAuth (user cookies).
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  // No secret configured -> reject everything. Length check first: timingSafeEqual throws on unequal lengths.
  if (!secret || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatDate = (d) => new Date(d).toISOString().slice(0, 10); // deadlines are UTC dates

function buildEmail(name, overdue, dueSoon) {
  const parts = [];
  if (overdue.length) parts.push(`${overdue.length} overdue`);
  if (dueSoon.length) parts.push(`${dueSoon.length} due soon`);
  const subject = `TaskHub: ${parts.join(', ')}`;
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
    `<p><a href="${escapeHtml(link)}">See all your tasks in TaskHub</a></p>`;

  return { subject, text, html };
}

const querySchema = z.object({ dryRun: z.enum(['true', 'false']).optional() });

router.post('/reminders', requireCronSecret, async (req, res) => {
  const dryRun = querySchema.parse(req.query).dryRun === 'true';

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dueSoonLimit = new Date(today.getTime() + DUE_SOON_DAYS * DAY_MS);

  const tasks = await Task.find({
    status: { $ne: 'done' },
    assignee: { $ne: null },
    deadline: { $ne: null, $lte: dueSoonLimit },
  })
    .select('title deadline assignee project')
    .populate('assignee', 'name email')
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
        await sendEmail({ to: user.email, ...buildEmail(user.name, overdue, dueSoon) });
        emails += 1;
      } catch (err) {
        failures += 1;
        console.error('Reminder email failed:', err.message); // never log addresses
        await ReminderLog.deleteMany({ _id: { $in: logIds } }); // un-claim so the next run retries
      }
    }
  }

  res.json({
    ok: true,
    dryRun,
    tasksFound: tasks.length,
    skipped,
    emails: dryRun ? byUser.size : emails, // dry run: how many emails WOULD be sent
    failures,
  });
});

export default router;
