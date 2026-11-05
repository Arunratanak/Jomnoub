import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import {
  emailLinkLimiter, forgotEmailLimiter, forgotIpLimiter, passwordLoginEmailLimiter, passwordLoginIpLimiter,
  registerLimiter, resendVerificationLimiter,
} from '../middlewares/rateLimit.js';
import * as auth from '../controllers/authController.js';

// Mounted at /api/auth (POST /google also has loginLimiter, see app.js)
const router = Router();

router.post('/google', auth.googleLogin);
router.post('/register', registerLimiter, auth.register);
router.post('/login', passwordLoginIpLimiter, passwordLoginEmailLimiter, auth.login);
router.post('/verify-email', emailLinkLimiter, auth.confirmEmail);
router.post('/resend-verification', requireAuth, resendVerificationLimiter, auth.resendVerification);
router.post('/forgot-password', forgotIpLimiter, forgotEmailLimiter, auth.forgotPassword);
router.post('/reset-password', emailLinkLimiter, auth.completePasswordReset);
router.get('/me', requireAuth, auth.me);
router.post('/logout', auth.logout);

export default router;
