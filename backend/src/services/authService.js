import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_ALGORITHM, JWT_EXPIRES_IN } from '../config/auth.js';
import { UnauthorizedError } from '../exceptions/HttpError.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Checks Google's signature, that the token was issued for our client ID, and
// that the email is verified. Returns Google's payload.
export async function verifyGoogleCredential(credential) {
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new UnauthorizedError('Invalid Google token');
  }
  if (!payload?.email || !payload.email_verified) throw new UnauthorizedError('Google email not verified');
  return payload;
}

// Creates the user on first sign-in, refreshes name/email/picture afterwards
export function upsertGoogleUser(payload) {
  return User.findOneAndUpdate(
    { googleId: payload.sub },
    { email: payload.email, name: payload.name || payload.email, picture: payload.picture },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export const signSessionToken = (user) =>
  jwt.sign({ id: user.id }, process.env.JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRES_IN });

// Returns the user id from a session token, or throws if it's invalid or expired
export function verifySessionToken(token) {
  const { id } = jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  return id;
}
