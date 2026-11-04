import { reminderQuerySchema } from '../validations/cronValidation.js';
import { runReminders } from '../services/reminderService.js';

// POST /api/cron/reminders[?dryRun=true] (CRON_SECRET)
export async function reminders(req, res) {
  const dryRun = reminderQuerySchema.parse(req.query).dryRun === 'true';
  const counts = await runReminders({ dryRun });
  res.json({ ok: true, dryRun, ...counts });
}
