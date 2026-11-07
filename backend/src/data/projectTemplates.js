// Ready-made starting points for a new project. Tasks are listed in the order they're
// usually done, and start unassigned with no deadline, so each team can fill those in.
const task = (title, description, subtasks = []) => ({ title, description, subtasks });

export const PROJECT_TEMPLATES = [
  {
    id: 'group-report',
    name: 'Group report',
    description: 'From choosing a topic to handing it in',
    tasks: [
      task('Agree on the topic and scope', 'Decide what the report covers and what the brief requires.', ['Read the brief together', 'Choose the topic', 'Split the work between members']),
      task('Research and collect sources', 'Gather what the report will be based on, and keep track of where it came from.', ['Find sources', 'Share notes with the team']),
      task('Write the outline', 'List the sections and who writes each one.'),
      task('Write the first draft', 'Each member writes their section.'),
      task('Review and edit', 'Read the whole report as one piece and fix anything inconsistent.', ['Check facts and references', 'Make the writing consistent', 'Proofread']),
      task('Format and submit', 'Follow the required format and hand it in before the deadline.', ['Add the title page and references', 'Export the final file', 'Submit']),
    ],
  },
  {
    id: 'presentation',
    name: 'Presentation',
    description: 'Plan, build and rehearse a talk',
    tasks: [
      task('Define the message and audience', 'Agree on the main point and who it is for.'),
      task('Plan the structure', 'Outline the sections and decide who presents each one.'),
      task('Gather content', 'Collect the facts, images and examples the slides need.'),
      task('Build the slides', 'Make the slides and keep their style consistent.', ['Draft each section', 'Combine into one deck', 'Check spelling and images']),
      task('Rehearse as a team', 'Run through it together and time it.', ['First run-through', 'Adjust the timing', 'Prepare for likely questions']),
      task('Present', 'Check the equipment beforehand and keep a backup copy of the slides.'),
    ],
  },
  {
    id: 'software-project',
    name: 'Software project',
    description: 'Plan, build, test and launch an app',
    tasks: [
      task('Define the requirements', 'Agree on what the app must do and who it is for.', ['List the main features', 'Decide what to leave out']),
      task('Design the screens and data', 'Sketch the main screens and plan how the data is stored.'),
      task('Set up the project', 'Create the repository and a shared way to run the project.', ['Create the repository', 'Set up the development environment']),
      task('Build the main features', 'Split this into a task for each feature as the work becomes clearer.'),
      task('Test and fix bugs', 'Try the main paths, then record and fix what breaks.'),
      task('Write the documentation', 'Explain how to install and use the project.'),
      task('Deploy and present', 'Put it online and prepare the demo.', ['Deploy', 'Prepare the demo']),
    ],
  },
  {
    id: 'event',
    name: 'Event planning',
    description: 'Organise an event from budget to follow-up',
    tasks: [
      task('Set the goal, date and budget', 'Agree on what the event is for, when it happens and what it can cost.'),
      task('Book the venue', 'Compare options and confirm the booking.'),
      task('Plan the schedule', 'Write the timetable and decide who is responsible for each part.'),
      task('Promote the event', 'Tell people about it and collect sign-ups.', ['Create the announcement', 'Share it', 'Track sign-ups']),
      task('Prepare supplies and equipment', 'List what is needed and check it is ready the day before.'),
      task('Run the event', 'Set up early, and make sure everyone knows their role.'),
      task('Follow up', 'Thank people, collect feedback and settle the costs.'),
    ],
  },
];

export const findTemplate = (id) => PROJECT_TEMPLATES.find((t) => t.id === id);
