import crypto from 'node:crypto';
import { UnauthorizedError } from '../exceptions/HttpError.js';

// Machine-to-machine auth for the scheduled job. Deliberately NOT requireAuth (user cookies).
export default function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  // No secret configured -> reject everything. Length check first: timingSafeEqual throws on unequal lengths.
  if (!secret || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    throw new UnauthorizedError('Unauthorized');
  }
  next();
}
