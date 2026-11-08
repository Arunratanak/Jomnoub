import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import { liveLimiter } from '../middlewares/rateLimit.js';
import { changesFor, cleanTabId } from '../services/liveService.js';

// Mounted at /api/live, ahead of the general rate limit: visible pages check here every
// few seconds, which would otherwise use up their normal allowance.
const router = Router();

// GET /api/live/changes?since=<number>&boot=<id>&tab=<id>
router.get('/changes', liveLimiter, requireAuth, (req, res) => {
  const since = Number(req.query.since);
  const boot = typeof req.query.boot === 'string' && req.query.boot.length <= 64 ? req.query.boot : null;
  res.set('Cache-Control', 'no-store');
  res.json(changesFor(req.user._id, { since, boot, tab: cleanTabId(req.query.tab) }));
});

export default router;
