import { Router } from 'express';
import * as health from '../controllers/statusController.js';

// Mounted at /api/status (public health check)
const router = Router();

router.get('/', health.status);

export default router;
