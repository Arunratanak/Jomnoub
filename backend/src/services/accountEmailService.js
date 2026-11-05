import EmailToken, { hashEmailToken, newEmailToken } from '../models/EmailToken.js';
import User from '../models/User.js';
import { BadRequestError } from '../exceptions/HttpError.js';
import { hashPassword } from './passwordService.js';
import { escapeHtml, sendEmail } from './emailService.js';

const HOUR_MS = 60 * 60 * 1000;
const VERIFY_HOURS = 24;
const RESET_HOURS = 1;
const INVALID_LINK = 'This link is invalid or has expired. Please request a new one.';

// The token goes after the #, which browsers never send to servers, so it stays
// out of hosting logs and analytics
const linkFor = (path, token) => `${process.env.FRONTEND_URL}/${path}#token=${token}`;

// Only the newest link of each type works
async function issueToken(user, type, hours) {
  const token = newEmailToken();
  await EmailToken.deleteMany({ user: user._id, type });
  await EmailToken.create({
    user: user._id,
    type,
    tokenHash: hashEmailToken(token),
    expiresAt: new Date(Date.now() + hours * HOUR_MS),
  });
  return token;
}

async function consumeToken(token, type) {
  if (typeof token !== 'string') throw new BadRequestError(INVALID_LINK);
  const record = await EmailToken.findOneAndDelete({
    tokenHash: hashEmailToken(token),
    type,
    expiresAt: { $gt: new Date() },
  });
  if (!record) throw new BadRequestError(INVALID_LINK);
  return record;
}

function actionEmail({ name, intro, button, link, outro }) {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  return {
    text: `Hi ${name},\n\n${intro}\n\n${link}\n\n${outro}\n`,
    html:
      `<p>Hi ${safeName},</p><p>${intro}</p>` +
      `<p><a href="${safeLink}" style="display:inline-block;padding:10px 18px;border-radius:18px;background:#188038;color:#fff;text-decoration:none;font-weight:600">${button}</a></p>` +
      `<p style="color:#5f6368;font-size:13px">If the button doesn't work, copy this link:<br>${safeLink}</p>` +
      `<p style="color:#5f6368;font-size:13px">${outro}</p>`,
  };
}

// ---------- Email verification ----------
export async function sendVerificationEmail(user) {
  const token = await issueToken(user, 'verify-email', VERIFY_HOURS);
  await sendEmail({
    to: user.email,
    subject: 'Verify your Jomnoub email',
    ...actionEmail({
      name: user.name,
      intro: 'Please confirm this is your email address so you can get reminders and be added to projects.',
      button: 'Verify my email',
      link: linkFor('verify-email', token),
      outro: `This link expires in ${VERIFY_HOURS} hours. If you didn't create a Jomnoub account, you can ignore this email.`,
    }),
  });
}

export async function verifyEmail(token) {
  const record = await consumeToken(token, 'verify-email');
  const user = await User.findById(record.user);
  if (!user) throw new BadRequestError(INVALID_LINK);
  user.emailVerified = true;
  await user.save();
}

// ---------- Password reset ----------
// Works for any account with that address. For a Google-only account this adds a
// password, which is fine: the link proves they control the email.
export async function sendPasswordResetEmail(email) {
  const user = await User.findOne({ email, isDemo: { $ne: true } });
  if (!user) return; // says nothing: the caller responds the same either way
  const token = await issueToken(user, 'reset-password', RESET_HOURS);
  await sendEmail({
    to: user.email,
    subject: 'Reset your Jomnoub password',
    ...actionEmail({
      name: user.name,
      intro: 'Someone asked to reset the password for your Jomnoub account. If that was you, choose a new one here.',
      button: 'Reset my password',
      link: linkFor('reset-password', token),
      outro: `This link expires in ${RESET_HOURS} hour. If you didn't ask for this, you can ignore this email and your password won't change.`,
    }),
  });
}

// Replaces the password and ends every other session. Using the link also proves
// the email is theirs, which locks out anyone who registered with their address.
export async function resetPassword(token, password) {
  const record = await consumeToken(token, 'reset-password');
  const user = await User.findById(record.user);
  if (!user) throw new BadRequestError(INVALID_LINK);
  user.passwordHash = await hashPassword(password);
  user.emailVerified = true;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  await EmailToken.deleteMany({ user: user._id });
  return user;
}
