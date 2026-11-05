# TaskHub

TaskHub is a project management web app for student group work. Sign in with Google, create a project, invite teammates with a link, assign tasks with deadlines, and follow progress with charts, a timeline, an activity log and daily email reminders.

Built as a full-stack course final project.

## Features

**Accounts**
- Google sign-in. The backend verifies Google's ID token and sets an httpOnly session cookie (7 days).

**Projects and teams**
- Create, rename and delete projects. The creator is the owner.
- Invite teammates with a link (random token, expires after 7 days, one active link per project, can be regenerated or disabled), or add someone by email if they have signed in before.
- Owners can remove members; members can leave. Tasks assigned to someone who leaves or is removed become unassigned. The last owner can't be removed.

**Tasks**
- Title, description, status (To do / In progress / Done), deadline and assignee. The assignee must be a project member.
- The owner or the task's creator can edit and delete a task; its assignee can change only its status.
- **Suggestions:** members can't assign work to the owner. Choosing the owner creates a suggestion, and the task stays unassigned until the owner accepts or declines it (on the board, in My Tasks, or from the bell).
- **Subtasks:** each task can have up to 50 subtasks with notes and a done checkbox. The owner, the task's creator and its assignee can change them; other members can read them.
- Board view with three status columns, filters (assigned to me, overdue, unassigned, suggestions) and drag and drop; overdue tasks are highlighted.

**Chat**
- Each project has a chat room for its members. Messages appear within about 5 seconds, with an unread dot on the tab. Authors can delete their own messages, and the owner can delete any.

**Tracking**
- **Progress stats** per project: completion %, counts by status, overdue, due this week, and a workload chart per member (Recharts).
- **Timeline** (`/projects/:id/timeline`): tasks grouped as Overdue, then by deadline date, then No deadline.
- **Activity log**: the last 30 events in a project (task created, moved, assigned, deleted; member joined, added, removed, left).
- **My Tasks**: everything assigned to you across projects, soonest deadline first.
- **Notification bell**: count of your unfinished tasks that are overdue or due within 2 days, plus suggestions waiting for you. It refreshes when the page loads, when the window regains focus, and after you change a task. No polling.

**Email reminders**
- Once a day, a GitHub Actions workflow calls the backend, which emails each person one summary of their unfinished tasks that are overdue or due within 2 days (via Resend). The same reminder is never sent twice.

**Interface**
- App frame with a top bar, project search, a collapsible sidebar (a drawer plus bottom navigation on phones), and project pages with Board, Chat, Progress, Members, Activity and Settings tabs. The open tab is kept in the URL, so refreshing stays on it.
- Toast messages and styled confirm dialogs. If a session expires, you're sent to sign in and then back to the same page.
- Green theme with a light/dark toggle. It starts from the device's preference and remembers your choice in this browser.

**Demo data**
- `npm run seed` creates a demo project with fake teammates and 12 tasks; `npm run seed:clear` removes it.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 19, Vite, react-router-dom, axios, Recharts, @react-oauth/google. Plain React with inline styles, no UI library. |
| Backend | Node.js 22, Express 5 (ES modules), Mongoose, zod, helmet, cors, cookie-parser, jsonwebtoken, google-auth-library, express-rate-limit, morgan, resend |
| Database | MongoDB Atlas |
| Hosting | Render: a static site for the frontend and a web service for the backend (both free tier) |
| Scheduler | GitHub Actions (daily cron) |

## Architecture

```
                          +----------------------------+
   Browser  ------------> |  Render static site        |   React build (HTML/JS/CSS)
   (React app)            |  rewrites:                 |
       |                  |    /api/*  -> backend      |   same-origin, so the cookie
       |  /api/...        |    /*      -> /index.html  |   works with SameSite=Lax
       +----------------> +-------------+--------------+
       |                                |
       | Google sign-in popup           v
       v                  +----------------------------+        +------------------+
   +-----------+  ID token|  Render web service        | <----> |  MongoDB Atlas   |
   |  Google   | -------> |  Express API  /api/...     |        |  users, projects,|
   |  OAuth    |  verified|  - session JWT cookie      |        |  tasks, invites, |
   +-----------+  by API  |  - rate limits, helmet     |        |  activity, logs  |
                          +-------------+--------------+        +------------------+
                                ^       |
           POST /api/cron/      |       |  send email
           reminders            |       v
           (Bearer CRON_SECRET) |   +-----------+
   +--------------------+       |   |  Resend   | ---> reminder emails
   |  GitHub Actions    | ------+   +-----------+
   |  daily 01:00 UTC   |
   +--------------------+
```

The browser only ever talks to the static site's domain; Render forwards `/api/*` to the backend. The backend sleeps when idle on the free tier.

## Project structure

```
backend/
  index.js               starts the server (loads .env, connects to MongoDB)
  app.js                 Express app: middleware, routes, error handler
  scripts/seed.js        demo data (npm run seed / seed:clear)
  src/
    config/              db (MongoDB connection), auth (cookie and JWT settings)
    routes/              URL -> middlewares -> controller, one file per area (*Routes.js)
    controllers/         read the request, call a service, send the response (*Controller.js)
    services/            business logic and database work (*Service.js), incl. email and activity
    middlewares/         requireAuth, requireMember/requireOwner, loadTask, loadInvite,
                         requireCronSecret, rateLimit, errorHandler
    validations/         zod schemas for every request body/query, ObjectId check
    dto/                 response shapes (project list item, invite preview)
    exceptions/          HttpError classes (NotFound, Forbidden, ...) turned into JSON by errorHandler
    models/              Mongoose models: User, Project, Task, Message, Invite, Activity, ReminderLog
    data/                demo content used by the seed script

Request flow: route -> middlewares (auth, membership, rate limit) -> controller
(validates with zod) -> service (rules + database) -> JSON response. Services throw
HttpError subclasses; middlewares/errorHandler.js sends them as { "error": "..." }.
(There is no uploads/ folder: TaskHub has no file uploads.)

frontend/
  src/pages/             Login, Dashboard, ProjectPage, TimelinePage, MyTasks, InvitePage, Privacy
  src/App.css            design tokens (light/dark colors) and all shared styles
  src/components/        Layout (top bar, sidebar), ProtectedRoute, ProjectStats, ActivityPanel,
                         ChatPanel, TaskCard, TaskDetail, NotificationBell, ThemeToggle, Modal,
                         FeedbackHost (toasts, confirm dialog), Avatar, Logo, Icons, Loading
  src/context/           AuthContext (current user)
  src/api/client.js      axios instance (cookies on, friendly 429 message)
  src/utils/             dates, timeline, taskStatus, events, feedback, chatRead, theme, colors,
                         useTitle, useClickOutside
.github/workflows/reminders.yml   daily reminder job
docs/                    SECURITY.md, TEST_PLAN.md, PRESENTATION.md
```

## API overview

All routes are under `/api`. Everything requires login except `GET /status`, `POST /auth/google`, `POST /auth/logout`, and `POST /cron/reminders` (which needs `Authorization: Bearer <CRON_SECRET>` instead).

| Method and path | Who |
|---|---|
| `GET /status` | anyone (health check: server and database state) |
| `POST /auth/google`, `GET /auth/me`, `POST /auth/logout` | login / current user / logout |
| `GET /projects`, `POST /projects` | your projects / create one |
| `GET /projects/:projectId` | members |
| `PATCH`, `DELETE /projects/:projectId` | owner |
| `GET /projects/:projectId/stats`, `/activity` | members |
| `POST /projects/:projectId/members` (by email) | owner |
| `DELETE /projects/:projectId/members/:userId` | owner (remove), or the member themselves (leave) |
| `POST`, `DELETE /projects/:projectId/invites` | owner (generate / disable link) |
| `GET`, `POST /projects/:projectId/tasks`, `PATCH`, `DELETE .../tasks/:taskId` | members (edit/delete: owner or creator; status: also assignee) |
| `POST .../tasks/:taskId/suggestion/accept`, `/decline` | owner |
| `POST .../tasks/:taskId/subtasks`, `PATCH`, `DELETE .../subtasks/:subtaskId` | owner, the task's creator, or its assignee |
| `GET`, `POST /projects/:projectId/messages`, `DELETE .../messages/:messageId` | members (delete: author or owner) |
| `GET /invites/:token`, `POST /invites/:token/accept` | any logged-in user with a valid link |
| `GET /my-tasks` | your assigned tasks |
| `POST /cron/reminders[?dryRun=true]` | GitHub Actions (CRON_SECRET) |

## Local setup

Requirements: Node.js 22, a MongoDB Atlas cluster, a Google OAuth client ID, and (for reminders) a Resend API key.

1. **Google OAuth:** in Google Cloud Console, create an OAuth client (Web). Add `http://localhost:5173` (and your live frontend URL) to *Authorized JavaScript origins*.
2. **Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env      # then fill in the values (see below)
   npm run dev               # http://localhost:5000, restarts on changes
   ```
3. **Frontend** (second terminal)
   ```bash
   cd frontend
   npm install
   cp .env.example .env      # then fill in the values
   npm run dev               # http://localhost:5173
   ```
   Vite reads `.env` only at startup, so restart it after changing values.
4. Optional demo data: set `SEED_EMAIL` to the Google email you signed in with, then `npm run seed` in `backend`.

Check the backend with `http://localhost:5000/api/status`.

## Environment variables

Names only. Real values live in `.env` files (git-ignored) and in the Render / GitHub settings. Never commit them.

**Backend (`backend/.env`, Render web service)**

| Name | Purpose |
|---|---|
| `PORT` | Port to listen on (Render sets it automatically) |
| `NODE_ENV` | `development` locally, `production` on Render |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Signs session cookies. Long random string (32+ characters) |
| `FRONTEND_URL` | Frontend origin, e.g. `http://localhost:5173` locally. Used for CORS and links in emails |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (verifies sign-in tokens) |
| `RESEND_API_KEY` | Resend API key for reminder emails |
| `CRON_SECRET` | Shared secret the reminder job must send |
| `EMAIL_FROM` | Optional sender, defaults to `TaskHub <onboarding@resend.dev>` |
| `SEED_EMAIL` | Optional, only for `npm run seed` |

The server prints a warning at startup naming any missing reminder variables (never their values).

**Frontend (`frontend/.env`, Render static site)**

| Name | Purpose |
|---|---|
| `VITE_API_URL` | `http://localhost:5000/api` locally, `/api` in production |
| `VITE_GOOGLE_CLIENT_ID` | Same client ID as the backend |

Vite builds these into the public JavaScript, so they must never contain secrets.

**GitHub repository secrets (Settings > Secrets and variables > Actions)**

| Name | Purpose |
|---|---|
| `BACKEND_URL` | Backend base URL, no trailing slash, no `/api` |
| `CRON_SECRET` | Same value as the backend's `CRON_SECRET` |

## Deployment (Render)

- **Backend:** Web Service, root directory `backend`, build `npm install`, start `npm start`, Node 22 (`engines` in `package.json`). Set the backend environment variables above with `NODE_ENV=production`.
- **Frontend:** Static Site, root directory `frontend`, build `npm install && npm run build`, publish directory `dist`. Set `VITE_API_URL=/api` and `VITE_GOOGLE_CLIENT_ID`. Rewrite rules, in this order:
  1. `/api/*` -> `https://<backend>.onrender.com/api/*` (Rewrite)
  2. `/*` -> `/index.html` (Rewrite)
- **Reminders:** set the two GitHub secrets; the workflow runs daily at 01:00 UTC and can be started by hand from the Actions tab ("Run workflow").
- Pushing to `main` redeploys both services if auto-deploy is on. Environment variable changes need a redeploy to take effect.

## Known limitations

- **Free-tier cold starts.** The Render backend sleeps when idle; the first request can take 30 to 60 seconds. The app shows "Waking up the server..." after 4 seconds, and the reminder workflow retries.
- **Resend test sender.** With the default `onboarding@resend.dev` sender, Resend only delivers to the email address of the Resend account owner. Emailing teammates needs a verified domain and `EMAIL_FROM` on that domain.
- **Push notifications are not implemented.** The bell is in-app only and updates on page load, window focus and after your own changes; there is no real-time push (no WebSockets, no browser push).
- **No automated test suite in the repository.** The features were tested with scripts run outside the repo and with the manual plan in [docs/TEST_PLAN.md](docs/TEST_PLAN.md).
- **Roles.** A project has exactly one owner; there is no way to promote a member or transfer ownership.
- **Chat isn't instant.** It checks for new messages every 5 seconds while open (no WebSockets), has no file attachments, and tracks "unread" per browser, not per account.
- **Suggestions aren't emailed.** The owner sees them in the app only.
- **Sessions.** Logging out clears the cookie, but an already-issued token stays valid until it expires (7 days); there is no server-side session revocation.
- **Rate limits are in memory.** They reset when the backend restarts or sleeps, and would not be shared across multiple server instances.
- **Reminders** are daily only, and a crash between claiming and sending a reminder can lose that one reminder (it is never sent twice).
- `frontend/README.md` is still the default Vite template; this file is the real README.

## More documentation

- [docs/SECURITY.md](docs/SECURITY.md): each security measure, where it lives, and how to demonstrate it
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md): two-account manual test script
- [docs/PRESENTATION.md](docs/PRESENTATION.md): 5 to 8 minute talk and demo plan
