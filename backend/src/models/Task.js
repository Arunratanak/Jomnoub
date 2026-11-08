import mongoose from 'mongoose';

const subtaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  note: { type: String, trim: true, maxlength: 1000, default: '' },
  done: { type: Boolean, default: false },
});

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
    // Who moved the task along and when. Set only by the server when the status changes.
    startedAt: { type: Date, default: null },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deadline: { type: Date, default: null },
    // Everyone working on the task. Empty means nobody has it yet.
    assignees: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subtasks: [subtaskSchema],
    attachmentCount: { type: Number, default: 0 }, // shown on task cards
    commentCount: { type: Number, default: 0 }, // shown on task cards
    // Members can't assign work to the owner, only suggest it. While suggestedBy is
    // set, the task waits for the owner to accept (joins the assignees) or decline.
    suggestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    suggestedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

taskSchema.index({ assignees: 1, deadline: 1 });

export default mongoose.model('Task', taskSchema);
