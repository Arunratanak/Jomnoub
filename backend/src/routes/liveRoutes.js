import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import { openStream } from '../services/liveService.js';

// Mounted at /api/live. GET opens the page's stream of "this changed" messages.
const router = Router();

router.get('/', requireAuth, (req, res) => {
  if (!openStream(req, res)) res.status(503).json({ error: 'Too many live connections. Please try again later.' });
});

export default router;
