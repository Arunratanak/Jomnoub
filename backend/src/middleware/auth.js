import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export default async function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (typeof token !== 'string' || !token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(id);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
  }
}