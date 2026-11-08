import { rateLimit, ipKeyGenerator, MINUTE, HOUR } from 'express-rate-limit';
import { SESSION_COOKIE } from '../config/auth.js';
import { verifySessionToken } from '../services/authService.js';

// Limits are generous so two-account demo testing never hits them; they only
// stop scripted abuse. Counters live in memory, so they reset when the server restarts.

const tooMany = (req, res) => res.status(429).json({ error: 'Too many requests' });
const common = { standardHeaders: 'draft-8', legacyHeaders: false, handler: tooMany };

// Behind Render's proxies (and the static site's /api rewrite), req.ip may be a
// proxy's address shared by many users. So whenever we know who the user is, we
// count per user id instead, and only fall back to the IP for anonymous requests.
const ipKey = (req) => `ip:${ipKeyGenerator(req.ip || '')}`;

// For limiters placed after requireAuth
const userKey = (req) => (req.user ? `user:${req.user.id}` : ipKey(req));

// For the global limiter, which runs before requireAuth: identify the user from
// their login cookie if it's valid (cheap signature check, no database call)
function cookieUserKey(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string' && process.env.JWT_SECRET) {
    try {
      const { id } = verifySessionToken(token);
      if (id) return `user:${id}`;
    } catch {
      // invalid or expired token: treat as anonymous
    }
  }
  return ipKey(req);
}

// Everything under /api: 600 requests per 15 minutes per user (or IP)
export const generalLimiter = rateLimit({ ...common, windowMs: 15 * MINUTE, limit: 600, keyGenerator: cookieUserKey });

// Live update checks, counted separately: a visible page checks every few seconds
// (about 300 per 15 minutes), so this allows several open at once
export const liveLimiter = rateLimit({ ...common, windowMs: 15 * MINUTE, limit: 1500, keyGenerator: cookieUserKey });

// Google sign-in: 30 attempts per 15 minutes per IP (no user yet at login)
export const loginLimiter = rateLimit({ ...common, windowMs: 15 * MINUTE, limit: 30, keyGenerator: ipKey });

// Password sign-in: guessing is limited per email from each address, on top of the
// per-IP limit. Successful sign-ins don't count, so normal use never hits it.
const emailKey = (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${email}|${ipKey(req)}`;
};
export const passwordLoginIpLimiter = rateLimit({ ...common, windowMs: 15 * MINUTE, limit: 30, keyGenerator: ipKey, skipSuccessfulRequests: true });
export const passwordLoginEmailLimiter = rateLimit({ ...common, windowMs: 15 * MINUTE, limit: 10, keyGenerator: emailKey, skipSuccessfulRequests: true });

// Emails cost quota and can annoy people, so requests that send one are tightly limited
export const forgotEmailLimiter = rateLimit({ ...common, windowMs: HOUR, limit: 3, keyGenerator: emailKey });
export const forgotIpLimiter = rateLimit({ ...common, windowMs: HOUR, limit: 20, keyGenerator: ipKey });
export const resendVerificationLimiter = rateLimit({ ...common, windowMs: HOUR, limit: 3, keyGenerator: userKey });

// Using a link from an email. Tokens can't be guessed; this just stops scripted abuse.
export const emailLinkLimiter = rateLimit({ ...common, windowMs: 15 * MINUTE, limit: 30, keyGenerator: ipKey });

// Creating accounts: 20 per hour per IP
export const registerLimiter = rateLimit({ ...common, windowMs: HOUR, limit: 20, keyGenerator: ipKey });

// Creating and accepting invites share one budget: 30 per 15 minutes per user
export const inviteLimiter = rateLimit({ ...common, windowMs: 15 * MINUTE, limit: 30, keyGenerator: userKey });

// Creating content, per user
export const createProjectLimiter = rateLimit({ ...common, windowMs: HOUR, limit: 30, keyGenerator: userKey });
export const createTaskLimiter = rateLimit({ ...common, windowMs: HOUR, limit: 200, keyGenerator: userKey });

// Posting comments, per user
export const commentLimiter = rateLimit({ ...common, windowMs: MINUTE, limit: 30, keyGenerator: userKey });

// Uploading files, per user
export const uploadLimiter = rateLimit({ ...common, windowMs: HOUR, limit: 60, keyGenerator: userKey });

// Sending chat messages, per user
export const messageLimiter = rateLimit({ ...common, windowMs: MINUTE, limit: 40, keyGenerator: userKey });
