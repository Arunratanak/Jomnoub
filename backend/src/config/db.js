import mongoose from 'mongoose';
import User from '../models/User.js';

// Brings the users collection's indexes up to date. Safe to run every startup: it
// only replaces the two old indexes once and never changes any user data.
export async function ensureUserIndexes() {
  let existing = [];
  try {
    existing = await User.collection.indexes();
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') throw err; // no users collection yet is fine
  }
  const googleIndex = existing.find((i) => i.name === 'googleId_1');
  if (googleIndex && !googleIndex.partialFilterExpression) await User.collection.dropIndex('googleId_1');
  const emailIndex = existing.find((i) => i.name === 'email_1');
  if (emailIndex && !emailIndex.unique) await User.collection.dropIndex('email_1');

  try {
    await User.createIndexes();
  } catch (err) {
    // Mongo's message contains the duplicate value, so don't log it (it could be an email)
    if (err.code === 11000) {
      console.error('Could not make user emails unique: some accounts share an email. Sign-up still checks for duplicates.');
    } else {
      throw err;
    }
  }
}

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
  await ensureUserIndexes();
}

export default connectDB;
