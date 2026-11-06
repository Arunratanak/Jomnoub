import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import { uploadLimiter } from '../middlewares/rateLimit.js';
import * as profile from '../controllers/profileController.js';

// Mounted at /api/profile
const router = Router();
router.use(requireAuth);

router.get('/', profile.get);
router.patch('/', profile.update);
router.post('/photo', uploadLimiter, profile.uploadPhoto);
router.delete('/photo', profile.removePhoto);
router.post('/photo/google', profile.useGooglePhoto);
router.get('/photos/:userId', profile.showPhoto);

export default router;
