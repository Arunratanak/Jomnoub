// "just now", "5 min ago", "3 h ago", "2 days ago", then a plain date after a week
export function timeAgo(date) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(date).toLocaleDateString();
}

// Same rule as the backend reminder job: unfinished, with a deadline on or
// before UTC midnight today + 2 days (this includes overdue tasks)
export const ATTENTION_DAYS = 2;
export function needsAttention(task) {
  if (!task.deadline || task.status === 'done') return false;
  const limit = new Date();
  limit.setUTCHours(0, 0, 0, 0);
  limit.setUTCDate(limit.getUTCDate() + ATTENTION_DAYS);
  return new Date(task.deadline) <= limit;
}

export function isOverdue(task) {
  if (!task.deadline || task.status === 'done') return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(task.deadline) < today;
}
