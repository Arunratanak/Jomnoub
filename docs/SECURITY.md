# TaskHub security measures

Each row lists what the measure does, where it is implemented, and how to show it in a demo. Paths are relative to the repo root. "Two accounts" means two different Google accounts in two browser windows (one normal, one private).

## Authentication and sessions

| Measure | Where | How to demonstrate |
|---|---|---|
| Google sign-in verified on the server: signature, audience (our client ID) and `email_verified` | `backend/src/services/authService.js` (`verifyGoogleCredential`) | Sign in normally. Then send a fake token: `POST /api/auth/google` with `{"credential":"fake"}` returns **401 Invalid Google token**. |
| Passwords are stored only as a salted **scrypt** hash, and the hash is excluded from queries and API responses | `backend/src/services/passwordService.js`, `backend/src/models/User.js` (`select: false`, `toJSON`) | Open the `users` collection in Atlas: `passwordHash` starts with `scrypt$` and two accounts with the same password have different hashes. |
| Sign-in gives the same error, in similar time, for an unknown email, a wrong password and a Google-only account | `backend/src/services/authService.js` (`loginWithPassword`), `passwordService.js` (`fakeVerify`) | Try a wrong password and an unknown email: both say **Incorrect email or password**. |
| Password guessing is limited: 10 failed tries per email from an address and 30 per IP, per 15 minutes | `backend/src/middlewares/rateLimit.js`, `backend/src/routes/authRoutes.js` | Enter a wrong password 11 times: the app shows "You're doing that too often". |
| Unverified emails can't be misused: until verified, a password account can't be added by email and gets no reminder emails. Google sign-in or a password reset by the real owner locks out whoever registered with that address | `authService.js` (`upsertGoogleUser`), `backend/src/services/accountEmailService.js`, `memberService.js`, `reminderService.js`, `backend/src/middlewares/auth.js` (`tokenVersion`) | Register with an address you own without verifying it, sign in with Google on it, then try the old password: refused. |
| Email links are one-time, expire (verify 24 hours, reset 1 hour), and are stored only as a SHA-256 hash. The token sits after the `#`, so it never reaches server logs, and the page removes it from the address bar | `backend/src/models/EmailToken.js`, `accountEmailService.js`, `frontend/src/utils/emailLink.js` | Use a reset link twice: the second time says it's invalid or expired. |
| "Forgot password" answers the same for any email and is limited to 3 per hour per email and 20 per IP, so it can't reveal accounts or be used to flood someone's inbox. A reset ends all other sessions | `backend/src/controllers/authController.js` (`forgotPassword`), `backend/src/middlewares/rateLimit.js`, `accountEmailService.js` | Try an email with no account: the same message appears. Reset in one browser: another browser is signed out. |
| Session in an **httpOnly** cookie (JavaScript can't read it), `Secure` in production, `SameSite=Lax`, 7-day expiry | `backend/src/config/auth.js` (`cookieOptions`) | DevTools > Application > Cookies: `token` shows HttpOnly, Secure, SameSite Lax. In the Console, `document.cookie` does not show it. |
| `SameSite=Lax` blocks cross-site request forgery: another website can't make your browser join a project, log you out, or regenerate an invite link | `backend/src/config/auth.js` | Explain: the frontend calls the API through the same-origin `/api` rewrite, so Lax costs nothing and cross-site POSTs arrive without the cookie. |
| JWT signed and verified with HS256 only (other algorithms rejected), 7-day expiry | `backend/src/config/auth.js` (`JWT_ALGORITHM`), `backend/src/services/authService.js` (`signSessionToken`, `verifySessionToken`) | Code walkthrough. |
| Logout clears the cookie with the same options it was set with | `backend/src/controllers/authController.js` (`logout`), `config/auth.js` (`clearCookieOptions`) | Log out, refresh: you stay on the login page. |
| Every route needs login except `/api/status`, the `/api/auth` sign-in, sign-up, email-link and logout routes, and the cron route | `backend/src/routes/*Routes.js` (`router.use(requireAuth)`), `backend/src/middlewares/auth.js` | Logged out, open `https://<site>/api/projects`: **401 Not authenticated**. |

## Authorization (who can see and change what)

| Measure | Where | How to demonstrate |
|---|---|---|
| Project routes check membership on the server; non-members get the **same 404** as a project that doesn't exist | `backend/src/middlewares/requireMember.js`, `backend/src/services/projectService.js` (`findProjectForMember`) | **Main demo:** copy a project URL from account A, open it as account B (not a member): **"Project not found"**. Change one character of the id: same page. |
| Owner-only actions: edit/delete project, add members, create/disable invites | `requireOwner` in `backend/src/middlewares/requireMember.js`, used in `backend/src/routes/projectRoutes.js` | As a member (account B), there is no Settings tab or invite link panel. Calling the API directly returns **403 Owners only**. |
| Tasks are always looked up inside the verified project, so a task id from another project returns 404 | `backend/src/middlewares/loadTask.js`, `backend/src/services/taskService.js` (`findTaskInProject`) | Code walkthrough: `Task.findOne({ _id: taskId, project: req.project._id })`. |
| Task permissions: owner or creator can edit/delete; the assignee can only change status | `taskService.js` (`canManageTask`, `updateTask`, `deleteTask`) | As account B, a task created by A and assigned to B shows only the status dropdown. |
| Assignee must be a project member, on create and on update | `taskService.js` (`createTask`, `updateTask`), `memberService.js` (`isMember`) | API call with a non-member's id as `assignee`: **400 Assignee must be a member of this project**. |
| Removing a member (or leaving) unassigns their tasks; the last owner can't be removed or leave | `backend/src/services/memberService.js` (`removeMember`) | Remove account B: their tasks show "Unassigned", and B's My Tasks no longer lists them. |
| Members can't assign work to the owner: the server turns it into a suggestion that only the owner can accept or decline | `backend/src/services/taskService.js` (`isSuggestionForOwner`, `acceptSuggestion`, `declineSuggestion`) | As B, assign a task to the owner: it stays Unassigned. Calling `POST .../suggestion/accept` as B returns **403 Owners only**. |
| Subtasks can be changed only by the owner, the task's creator or its assignee | `taskService.js` (`canEditSubtasks`) | As an unrelated member, the checkboxes are disabled. Calling the API directly returns **403 Not allowed**. |
| Chat is members only; authors can delete their own messages and the owner can delete any | `backend/src/routes/projectRoutes.js` (`requireMember`), `backend/src/services/messageService.js` | Open `/api/projects/<id>/messages` as a non-member: **404 Not found**. A script in a message shows as text. |
| My Tasks only includes projects you are still a member of | `backend/src/services/myTaskService.js` | After B leaves, B's My Tasks and bell no longer show that project's tasks. |

## Invite links

| Measure | Where | How to demonstrate |
|---|---|---|
| Token is 32 random bytes (`crypto.randomBytes`), about 256 bits: impossible to guess | `backend/src/models/Invite.js` (`newToken`) | Generate a link and point at the long random part. |
| Only a SHA-256 **hash** of the token is stored, so a database leak can't be used to join projects | `Invite.js` (`hashToken`), `backend/src/services/inviteService.js` (`createInvite`) | Show the `invites` collection in Atlas: `tokenHash` doesn't match the link. |
| Expires after 7 days; expiry is checked on **every** preview and accept (plus MongoDB auto-deletes expired invites) | `Invite.js` (TTL index), `inviteService.js` (`findValidInvite`: `expiresAt: { $gt: new Date() }`), `middlewares/loadInvite.js` | Generate a new link, then open the old one: **"Invite unavailable"**. Same after "Disable links". |
| Accepting needs login; joining twice doesn't duplicate membership | `routes/inviteRoutes.js` (`requireAuth`), `inviteService.js` (`acceptInvite`: atomic `updateOne` with `$ne`) | Open a link while logged out: you're sent to login, then back to the invite. |
| Invite tokens are hidden in the server's request log | `backend/app.js` (`safe-url` log token) | Render logs show `/api/invites/[token]/accept`. |

## Input validation

| Measure | Where | How to demonstrate |
|---|---|---|
| Every request body is validated with zod: types, enums, length limits; unknown fields are dropped, and raw `req.body` never reaches Mongoose | schemas in `backend/src/validations/`, applied in `backend/src/controllers/` (`schema.parse`) | Create a task with a 500-character title in the API: **400 Invalid input**. The form also limits length (`maxLength`). |
| Ids must be exactly 24 hex characters | `backend/src/validations/common.js` (`isObjectId`, `objectIdSchema`), used by the project, member and task services and `taskValidation.js` | `/projects/abc` shows "Project not found". |
| NoSQL operator injection blocked: query values are validated strings, route params (always strings), or come from the signed cookie | all routes | API call with `"assignee": {"$ne": null}`: **400 Invalid input**. |
| Deadlines limited to years 2000 to 2100; Google token max 4096 characters; JSON bodies max 10 KB | `validations/taskValidation.js`, `validations/authValidation.js`, `app.js` (`express.json({ limit: '10kb' })`) | Code walkthrough. |
| User text is rendered as plain text by React (escaped); there is no `dangerouslySetInnerHTML` and no `target="_blank"` link | `frontend/src` | Create a task named `<b>hi</b>` or `<img src=x onerror=alert(1)>`: it shows as literal text, nothing runs. |
| Reminder emails escape every user value placed in HTML | `backend/src/services/emailService.js` (`escapeHtml`), `backend/src/services/reminderService.js` (`buildReminderEmail`) | The same task title appears as text in the email. |

## Abuse protection and server hardening

| Measure | Where | How to demonstrate |
|---|---|---|
| Rate limits returning **429 `{ "error": "Too many requests" }`**: all `/api` 600 per 15 min; Google sign-in 30 per 15 min per IP; invite create+accept 30 per 15 min; project creation 30 per hour; task creation 200 per hour; chat messages 40 per minute | `backend/src/middlewares/rateLimit.js`, applied in `app.js` and the route files | PowerShell loop in [TEST_PLAN.md](TEST_PLAN.md) (test 9): the 31st sign-in attempt returns 429. The app shows "You're doing that too often...". |
| Limits are counted per **user id** when the user is known, so users behind the same proxy (Render's rewrite) don't throttle each other | `rateLimit.js` (`userKey`, `cookieUserKey`) | Code walkthrough. |
| Cron route protected by `CRON_SECRET` with a constant-time comparison; rejects everything if the secret isn't set; doesn't use user login | `backend/src/middlewares/requireCronSecret.js` | `POST /api/cron/reminders` without the header: **401 Unauthorized**. |
| Security headers via helmet (e.g. `X-Content-Type-Options`, `Strict-Transport-Security`, no `X-Powered-By`) | `app.js` | DevTools > Network > any `/api` response > Headers. |
| CORS allows only `FRONTEND_URL`; with it unset, no cross-origin access at all | `app.js` | Code walkthrough. |
| Errors never send stack traces to the browser (500 = "Something went wrong"); logs hold only the error name, message and stack, never request bodies or cookies | `backend/src/middlewares/errorHandler.js`, `backend/src/exceptions/HttpError.js`, `app.js` (morgan format) | Send malformed JSON: the response has no stack trace. |
| Dev-only DNS workaround is skipped in production | `backend/index.js` | Code walkthrough. |

## Secrets

| Measure | Where | How to demonstrate |
|---|---|---|
| `.env` files are git-ignored; `.env.example` files list names only | `backend/.gitignore`, `frontend/.gitignore`, `*/.env.example` | Show `.env.example` and `git status`. |
| The frontend bundle contains only `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` (both public) | `frontend/src/api/client.js`, `frontend/src/main.jsx` | Search the built JS for "mongodb" or "secret": no results. |
| Reminder failures log only the error message, never email addresses | `backend/src/services/reminderService.js` | Code walkthrough. |
| Startup warnings name missing variables but never print values | `backend/index.js` | Render logs on boot. |

## Known gaps

These are not implemented. Mention them honestly if asked.

- Logout doesn't revoke an issued token; it stays valid until it expires (7 days).
- There's no change-password page or two-factor sign-in. The sign-up form reveals whether an email already has an account.
- Rate limits are in memory: they reset on restart and aren't shared between instances.
- No Content Security Policy headers on the static frontend (helmet covers only the API responses).
- `backend/.env` was committed in the repo's first commits and pushed to the public repository. The history has been rewritten to remove it, but anyone could have copied it before that, so the database password and JWT secret it contained must be rotated. Removing a file from history doesn't undo an exposure.
- `npm audit` reports moderate issues only in dev tools (nodemon, eslint), not in anything that runs in production.
