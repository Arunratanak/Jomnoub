import express from 'express'
import mongoose from  'mongoose'
const router = express.Router()

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

export default router;