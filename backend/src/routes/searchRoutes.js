import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import { search } from '../services/searchService.js';
import { searchSchema } from '../validations/taskValidation.js';

// Mounted at /api/search
const router = Router();
router.use(requireAuth);

// GET /api/search?q=text
router.get('/', async (req, res) => {
  const { q } = searchSchema.parse(req.query);
  res.json(await search(req.user._id, q));
});

export default router;
