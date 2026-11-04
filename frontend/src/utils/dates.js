export function isOverdue(task) {
  if (!task.deadline || task.status === 'done') return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(task.deadline) < today;
}
