import 'dotenv/config';
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import app from './app.js';
import connectDB from './src/config/db.js';

const PORT = process.env.PORT || 5000;

try {
  await connectDB();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
} catch (err) {
  console.error('Failed to connect to MongoDB:', err.message);
  process.exit(1);
}