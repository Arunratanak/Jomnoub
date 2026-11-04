import 'dotenv/config';
import dns from 'node:dns';
if (process.env.NODE_ENV !== 'production') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}
import app from './app.js';
import connectDB from './src/config/db.js';

const PORT = process.env.PORT || 5000;

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