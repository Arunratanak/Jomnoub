import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import * as auth from '../controllers/authController.js';

// Mounted at /api/auth (POST /google also has loginLimiter, see app.js)
const router = Router();

router.post('/google', auth.googleLogin);
router.get('/me', requireAuth, auth.me);
router.post('/logout', auth.logout);

export default router;
