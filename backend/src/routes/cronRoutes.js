import { Router } from 'express';
import requireCronSecret from '../middlewares/requireCronSecret.js';
import * as cron from '../controllers/cronController.js';

// Mounted at /api/cron. Protected by CRON_SECRET, not user login.
const router = Router();

router.post('/reminders', requireCronSecret, cron.reminders);

export default router;
