import 'dotenv/config';
import dns from 'node:dns';
if (process.env.NODE_ENV !== 'production') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}
import app from './app.js';
import connectDB from './src/config/db.js';
import { missingR2Vars } from './src/services/storageService.js';

const PORT = process.env.PORT || 5000;

if (!process.env.FRONTEND_URL) {
  console.warn('FRONTEND_URL is not set: cross-origin requests (e.g. local dev on another port) will be blocked.');
}

// Names only, never values. Without R2, uploaded files go in the database, which is
// fine for development but uses up the database's limited space.
const missingR2 = missingR2Vars();
if (missingR2.length && process.env.NODE_ENV === 'production') {
  console.warn(`File uploads are using the database until these env vars are set: ${missingR2.join(', ')}`);
}

// Reminder emails need these; the server still runs without them. Prints names only, never values.
const missingReminderVars = ['RESEND_API_KEY', 'CRON_SECRET', 'FRONTEND_URL'].filter((k) => !process.env[k]);
if (missingReminderVars.length) {
  console.warn(`Reminder emails disabled until these env vars are set: ${missingReminderVars.join(', ')}`);
}

try {
  await connectDB();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
} catch (err) {
  console.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
}