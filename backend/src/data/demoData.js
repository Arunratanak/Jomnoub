// Demo content for scripts/seed.js (npm run seed). Fake people only.

export const DEMO_PROJECT = {
  name: 'Demo project',
  description: 'Sample data for the TaskHub demo. Remove it with npm run seed:clear.',
};

// Become users with email <key>@example.invalid and isDemo: true
export const DEMO_TEAMMATES = [
  { key: 'alex', name: 'Alex Demo' },
  { key: 'sam', name: 'Sam Demo' },
  { key: 'jordan', name: 'Jordan Demo' },
];

// [title, status, assignee key ('me' = SEED_EMAIL user, null = unassigned),
//  deadline in days from today (null = none), creator key]
export const DEMO_TASKS = [
  ['Write project proposal', 'done', 'me', -10, 'me'],
  ['Set up GitHub repository', 'done', 'alex', -8, 'me'],
  ['Design the database schema', 'done', 'sam', -6, 'alex'],
  ['Build Google sign-in', 'done', 'me', -4, 'me'],
  ['Write API unit tests', 'todo', 'sam', -3, 'sam'],
  ['Create UI wireframes', 'in-progress', 'jordan', -2, 'jordan'],
  ['Implement the task API', 'in-progress', 'alex', -1, 'alex'],
  ['Add dashboard charts', 'in-progress', 'me', 1, 'me'],
  ['Test the invite flow', 'todo', 'jordan', 2, 'me'],
  ['Prepare presentation slides', 'todo', 'me', 4, 'me'],
  ['Accessibility review', 'todo', 'sam', 6, 'jordan'],
  ['Write the README', 'todo', null, null, 'alex'],
];
