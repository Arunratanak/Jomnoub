import { googleLoginSchema } from '../validations/authValidation.js';
import { verifyGoogleCredential, upsertGoogleUser, signSessionToken } from '../services/authService.js';
import { SESSION_COOKIE, cookieOptions, clearCookieOptions } from '../config/auth.js';

// POST /api/auth/google
export async function googleLogin(req, res) {
  const { credential } = googleLoginSchema.parse(req.body);
  const payload = await verifyGoogleCredential(credential);
  const user = await upsertGoogleUser(payload);
  res.cookie(SESSION_COOKIE, signSessionToken(user), cookieOptions);
  res.json({ user });
}

// GET /api/auth/me
export function me(req, res) {
  res.json({ user: req.user });
}

// POST /api/auth/logout
export function logout(req, res) {
  res.clearCookie(SESSION_COOKIE, clearCookieOptions);
  res.json({ ok: true });
}
