import {
  forgotPasswordSchema, googleLoginSchema, passwordLoginSchema, registerSchema, resetPasswordSchema, verifyEmailSchema,
} from '../validations/authValidation.js';
import {
  loginWithPassword, registerWithPassword, signSessionToken, upsertGoogleUser, verifyGoogleCredential,
} from '../services/authService.js';
import { resetPassword, sendPasswordResetEmail, sendVerificationEmail, verifyEmail } from '../services/accountEmailService.js';
import { hasVerifiedEmail } from '../models/User.js';
import { SESSION_COOKIE, cookieOptions, clearCookieOptions } from '../config/auth.js';

// All sign-in methods end the same way: a session JWT in an httpOnly cookie
const startSession = (res, user) => res.cookie(SESSION_COOKIE, signSessionToken(user), cookieOptions);

// Sends in the background: a slow or failed email must not hold up the request, and
// the response time must not reveal whether an address has an account. Logs the
// message only, never the address.
const sendLater = (task) => task.catch((err) => console.error('Account email failed:', err.message));

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
  sendLater(sendVerificationEmail(user));
}

// POST /api/auth/login
export async function login(req, res) {
  const user = await loginWithPassword(passwordLoginSchema.parse(req.body));
  startSession(res, user);
  res.json({ user });
}

// POST /api/auth/verify-email (the link itself is the proof, so no login is needed)
export async function confirmEmail(req, res) {
  const { token } = verifyEmailSchema.parse(req.body);
  await verifyEmail(token);
  res.json({ ok: true });
}

// POST /api/auth/resend-verification (logged in)
export async function resendVerification(req, res) {
  if (!hasVerifiedEmail(req.user)) sendLater(sendVerificationEmail(req.user));
  res.json({ ok: true });
}

// POST /api/auth/forgot-password. The same answer whether or not the account exists.
export async function forgotPassword(req, res) {
  const { email } = forgotPasswordSchema.parse(req.body);
  sendLater(sendPasswordResetEmail(email));
  res.json({ ok: true });
}

// POST /api/auth/reset-password. Also signs them in with a fresh session.
export async function completePasswordReset(req, res) {
  const { token, password } = resetPasswordSchema.parse(req.body);
  const user = await resetPassword(token, password);
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
