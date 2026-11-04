import User from '../models/User.js';
import { SESSION_COOKIE } from '../config/auth.js';
import { verifySessionToken } from '../services/authService.js';
import { UnauthorizedError } from '../exceptions/HttpError.js';

// Requires a valid session cookie; sets req.user
export default async function requireAuth(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  if (typeof token !== 'string' || !token) throw new UnauthorizedError();

  let user;
  try {
    user = await User.findById(verifySessionToken(token));
  } catch {
    throw new UnauthorizedError(); // bad signature, wrong algorithm, expired, or malformed id
  }
  if (!user) throw new UnauthorizedError();
  req.user = user;
  next();
}
