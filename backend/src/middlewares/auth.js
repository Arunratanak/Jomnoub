import User from '../models/User.js';
import { SESSION_COOKIE } from '../config/auth.js';
import { verifySessionToken } from '../services/authService.js';
import { UnauthorizedError } from '../exceptions/HttpError.js';

// Requires a valid session cookie; sets req.user
export default async function requireAuth(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  if (typeof token !== 'string' || !token) throw new UnauthorizedError();

  let user;
  let tokenVersion;
  try {
    const session = verifySessionToken(token);
    tokenVersion = session.tokenVersion;
    user = await User.findById(session.id);
  } catch {
    throw new UnauthorizedError(); // bad signature, wrong algorithm, expired, or malformed id
  }
  // A lower version means this session was ended (see tokenVersion in models/User.js)
  if (!user || tokenVersion !== (user.tokenVersion || 0)) throw new UnauthorizedError();
  req.user = user;
  next();
}
