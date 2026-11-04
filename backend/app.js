import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import authRoutes from './src/routes/auth.js';
import projectRoutes from './src/routes/projects.js';
import myTaskRoutes from './src/routes/myTasks.js';
import inviteRoutes from './src/routes/invites.js';
import cronRoutes from './src/routes/cron.js';

import statusRoute from './src/routes/status.js';
import errorHandler from './src/middleware/handleError.js';
import { generalLimiter, loginLimiter } from './src/middleware/rateLimit.js';

const app = express();

app.set('trust proxy', 1); // Render's proxy sets X-Forwarded-For

app.use(helmet());
app.use(cors({
  // Without FRONTEND_URL, allow no cross-origin requests at all (the cors package
  // would otherwise answer "*"). In production the frontend is same-origin via /api anyway.
  origin: process.env.FRONTEND_URL || false,
  credentials: true,
}));

// Request log: method, path, status and timing only (never bodies, cookies or IPs).
// Invite tokens in URLs are hidden so the logs can't be used to join projects.
morgan.token('safe-url', (req) => req.originalUrl.replace(/(\/api\/invites\/)[^/?]+/, '$1[token]'));
app.use(morgan(':method :safe-url :status :res[content-length] - :response-time ms'));

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api', generalLimiter);
app.use('/api/auth/google', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/status', statusRoute);
app.use('/api/projects', projectRoutes);
app.use('/api/my-tasks', myTaskRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/cron', cronRoutes); // protected by CRON_SECRET, not user login

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

export default app;