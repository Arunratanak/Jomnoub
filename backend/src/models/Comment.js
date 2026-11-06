import mongoose from 'mongoose';

// A comment on a task. "mentions" is worked out by the server from the text and the
// project's members, never taken from the client.
const commentSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

commentSchema.index({ task: 1, createdAt: 1 });
commentSchema.index({ project: 1 });

export default mongoose.model('Comment', commentSchema);
