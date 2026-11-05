import { googleLoginSchema, passwordLoginSchema, registerSchema } from '../validations/authValidation.js';
import {
  loginWithPassword, registerWithPassword, signSessionToken, upsertGoogleUser, verifyGoogleCredential,
} from '../services/authService.js';
import { SESSION_COOKIE, cookieOptions, clearCookieOptions } from '../config/auth.js';

// All sign-in methods end the same way: a session JWT in an httpOnly cookie
const startSession = (res, user) => res.cookie(SESSION_COOKIE, signSessionToken(user), cookieOptions);

// POST /api/auth/google
export async function googleLogin(req, res) {
  const { credential } = googleLoginSchema.parse(req.body);
  const payload = await verifyGoogleCredential(credential);
  const user = await upsertGoogleUser(payload);
  startSession(res, user);
  res.json({ user });
}

// POST /api/auth/register
export async function register(req, res) {
  const user = await registerWithPassword(registerSchema.parse(req.body));
  startSession(res, user);
  res.status(201).json({ user });
}

// POST /api/auth/login
export async function login(req, res) {
  const user = await loginWithPassword(passwordLoginSchema.parse(req.body));
  startSession(res, user);
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
