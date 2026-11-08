import mongoose from 'mongoose';

// One row per reminder sent. The unique index is what guarantees a reminder is
// never sent twice: a run "claims" a reminder by inserting its row first.
// Including the deadline means a task whose deadline changes can be reminded again, and
// including the person means each assignee of a shared task gets their own reminder.
const reminderLogSchema = new mongoose.Schema({
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  type: { type: String, enum: ['due-soon', 'overdue'], required: true },
  deadline: { type: Date, required: true },
  // Rows from before tasks could be shared have none: they count as sent to everyone
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sentAt: { type: Date, default: Date.now },
});

reminderLogSchema.index({ task: 1, type: 1, deadline: 1, user: 1 }, { unique: true });

export default mongoose.model('ReminderLog', reminderLogSchema);
