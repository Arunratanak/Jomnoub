import mongoose from 'mongoose';

// GET /api/status: health check (server up, database connected?)
export function status(req, res) {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
}
