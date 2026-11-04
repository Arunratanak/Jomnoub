import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import authRoutes from './src/routes/auth.js';
import projectRoutes from './src/routes/projects.js';
import myTaskRoutes from './src/routes/myTasks.js';
import inviteRoutes from './src/routes/invites.js';

import statusRoute from './src/routes/status.js';
import errorHandler from './src/middleware/handleError.js';

const app = express();

app.set('trust proxy', 1); // needed later behind Render's proxy

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/status', statusRoute);
app.use('/api/projects', projectRoutes);
app.use('/api/my-tasks', myTaskRoutes);
app.use('/api/invites', inviteRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

export default app;