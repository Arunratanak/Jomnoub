import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_ALGORITHM, JWT_EXPIRES_IN } from '../config/auth.js';
import { ConflictError, UnauthorizedError } from '../exceptions/HttpError.js';
import { fakeVerify, hashPassword, verifyPassword } from './passwordService.js';
import { deleteFile } from './storageService.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const BAD_LOGIN = 'Incorrect email or password';

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

// Google's details are the default, but never replace a name or photo the person chose
function applyGoogleProfile(user, payload, email) {
  if (!user.customName) user.name = payload.name || email;
  if (!user.customPicture) user.picture = payload.picture;
  user.googlePicture = payload.picture;
}

// Creates the user on first sign-in, refreshes name/email/picture afterwards.
// If a password account already uses this email, Google has just proved who really
// owns the address, so it's linked. If that account was never email-verified, someone
// else could have created it: the password is removed and any existing sessions end,
// which locks out anyone who registered with this person's email, and removes the name
// and photo they set.
export async function upsertGoogleUser(payload) {
  const email = payload.email.toLowerCase();

  let user = await User.findOne({ googleId: payload.sub });
  if (user) {
    // Keep the old address if Google's new one belongs to another account
    if (user.email !== email && !(await User.exists({ email, _id: { $ne: user._id } }))) user.email = email;
    applyGoogleProfile(user, payload, email);
    return user.save();
  }

  user = await User.findOne({ email }).select('+passwordHash');
  if (user) {
    user.googleId = payload.sub;
    // A password set by someone who has proved they own this email is kept
    const untrusted = user.passwordHash && !user.emailVerified;
    const oldPhoto = untrusted ? user.photoFileId : null;
    if (untrusted) {
      user.passwordHash = undefined;
      user.tokenVersion += 1;
      user.customName = false;
      user.customPicture = false;
      user.photoFileId = undefined;
    }
    applyGoogleProfile(user, payload, email);
    await user.save();
    if (oldPhoto) await deleteFile(oldPhoto);
    return user;
  }

  try {
    return await User.create({
      googleId: payload.sub, email, name: payload.name || email, picture: payload.picture, googlePicture: payload.picture,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    return User.findOne({ googleId: payload.sub }); // two simultaneous first sign-ins
  }
}

export async function registerWithPassword({ name, email, password }) {
  const taken = 'An account with this email already exists. Try signing in instead.';
  if (await User.exists({ email })) throw new ConflictError(taken);
  const passwordHash = await hashPassword(password);
  try {
    return await User.create({ name, email, passwordHash });
  } catch (err) {
    if (err.code === 11000) throw new ConflictError(taken); // lost a race for the same email
    throw err;
  }
}

// The same error for an unknown email, a wrong password and a Google-only account,
// so sign-in can't be used to find out who has an account
export async function loginWithPassword({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : await fakeVerify(password);
  if (!ok) throw new UnauthorizedError(BAD_LOGIN);
  return user;
}

export const signSessionToken = (user) =>
  jwt.sign({ id: user.id, tv: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN,
  });

// Returns { id, tokenVersion } from a session token, or throws if it's invalid or expired
export function verifySessionToken(token) {
  const { id, tv } = jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  return { id, tokenVersion: tv || 0 };
}
