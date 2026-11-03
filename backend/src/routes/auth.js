import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import requireAuth from '../middleware/auth.js';

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const isProd = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const loginSchema = z.object({ credential: z.string().min(1) });

router.post('/google', async (req, res) => {
  const { credential } = loginSchema.parse(req.body);

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Invalid Google token' });
  }

  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ error: 'Google email not verified' });
  }

  const user = await User.findOneAndUpdate(
    { googleId: payload.sub },
    { email: payload.email, name: payload.name || payload.email, picture: payload.picture },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, cookieOptions);
  res.json({ user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', (req, res) => {
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie('token', clearOptions);
  res.json({ ok: true });
});

export default router;