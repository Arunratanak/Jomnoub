import mongoose from 'mongoose';
import ReminderLog from '../models/ReminderLog.js';
import Task from '../models/Task.js';
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

async function dropIndexIfPresent(collection, name) {
  try {
    if ((await collection.indexes()).some((i) => i.name === name)) await collection.dropIndex(name);
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') throw err; // no collection yet is fine
  }
}

// Tasks used to have one person (assignee); now they have a list (assignees). Moves any
// task still in the old form, and swaps the indexes that depended on it. Safe to run
// every startup: once everything is moved, it finds nothing to do.
export async function migrateToSharedTasks() {
  const { modifiedCount } = await Task.collection.updateMany(
    { assignee: { $exists: true } },
    [
      {
        $set: {
          assignees: {
            $setUnion: [
              { $ifNull: ['$assignees', []] },
              { $cond: [{ $eq: [{ $ifNull: ['$assignee', null] }, null] }, [], ['$assignee']] },
            ],
          },
        },
      },
      { $unset: 'assignee' },
    ],
  );
  if (modifiedCount) console.log(`Moved ${modifiedCount} tasks to the shared-task format`);
  await dropIndexIfPresent(Task.collection, 'assignee_1_deadline_1');
  // The old one-reminder-per-task index would stop a second person getting theirs
  await dropIndexIfPresent(ReminderLog.collection, 'task_1_type_1_deadline_1');
  await Task.createIndexes();
  await ReminderLog.createIndexes();
}

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
  await ensureUserIndexes();
  await migrateToSharedTasks();
}

export default connectDB;
