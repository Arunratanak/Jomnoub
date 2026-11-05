# TaskHub presentation plan (5 to 8 minutes)

## Before you present (15 minutes ahead)

- **Wake the backend:** open the live site 10 to 15 minutes early and sign in (free-tier Render sleeps; the first request can take up to a minute). Keep the tab open.
- **Two windows:** Account A (owner) in a normal window, Account B in a private window, both signed in. Zoom the browser to 125% so the room can read it.
- **Demo data:** in `backend`, run `npm run seed` (with `SEED_EMAIL` set) to get "Demo project" with three teammates, 12 tasks, overdue items and activity history. Afterwards: `npm run seed:clear`.
- **Have ready:** a second project owned by A that B is **not** in (for the security demo), the GitHub repo, the Actions tab, and a reminder email already in your inbox (screenshot as backup).
- Close notifications and unrelated tabs. Don't show `.env` files or the Render Environment page on screen.

## Timing

| Time | Section | Slides |
|---|---|---|
| 0:00 to 0:45 | Problem and what TaskHub is | 1, 2 |
| 0:45 to 1:30 | Architecture | 3 |
| 1:30 to 5:00 | Live demo | (browser) |
| 5:00 to 6:15 | Security, including the live security demo | 4 |
| 6:15 to 7:00 | What I learned, limitations, next steps | 5, 6 |
| 7:00 to 8:00 | Questions (buffer) | 7 |

## Slides

1. **Title:** TaskHub, project management for student group work. Name, course, live URL.
2. **The problem:** group projects lose track of who does what and when. TaskHub: projects, invite links, tasks with assignees and deadlines, progress tracking, daily email reminders.
3. **Architecture:** the ASCII diagram from the README (browser, Render static site with `/api` rewrite, Express API, MongoDB Atlas, Google OAuth, Resend, GitHub Actions). Tech stack in one line under it.
4. **Security:** five bullets: Google sign-in verified on the server; httpOnly SameSite=Lax cookie; every project route checks membership (404 for outsiders); hashed, expiring invite tokens; zod validation and rate limiting.
5. **What I learned:** for example the cookie and cross-site issues that led to the same-origin `/api` rewrite; case-sensitive imports on Linux; a secret committed by accident and what it took to fix (rewrite history and rotate).
6. **Limitations and next steps:** cold starts, Resend test-domain limit, no push notifications, one owner per project, no automated tests yet.
7. **Thank you / questions.**

## What to say (short script)

**Slides 1 and 2 (45 s):** "Group projects usually fail on coordination, not ability: nobody knows who is doing what, or what's due. TaskHub puts a project, its tasks, deadlines and teammates in one place, and reminds people by email before things are late."

**Slide 3 (45 s):** "The React frontend is a static site on Render. It forwards everything under `/api` to my Express backend, so the browser only ever talks to one domain, which keeps the login cookie simple and safe. Data is in MongoDB Atlas, sign-in is Google, and once a day GitHub Actions calls a protected endpoint that sends reminder emails through Resend."

## Live demo order (3.5 minutes)

1. **Sign in** (Account A) with Google: "No passwords stored; the server verifies Google's token."
2. **Dashboard:** projects list, the **bell** with its count, "My tasks". Open the bell dropdown.
3. **Demo project:**
   - **Board** tab: status columns; point at a red overdue task. Create a task, assign it, change its status.
   - **Activity** tab: show those changes logged.
   - **Progress** tab: progress bar, overdue and due-this-week tiles, **status donut** and **workload chart** per member.
   - Toggle **dark mode** in the top bar.
4. **Timeline view:** Overdue group first, then dates, then No deadline. Toggle "Show completed".
5. **Invite flow:**
   - A: Generate invite link > Copy.
   - B (private window): paste, sign in, **Join project**.
   - A: refresh, B appears in Members and in Activity ("joined via invite link").
6. **Permissions:** as B, show that there is no Settings tab or invite panel, and that B can only change the status of a task assigned to them.
   - As B, assign a task to the owner: it becomes a **suggestion**. As A, click **Accept**.
   - Open a task and tick a **subtask**. Send a **chat** message from B and show it arrive in A's window.
7. **My Tasks** as A: all assigned tasks across projects, soonest first.
8. **Reminder email:** show the email in your inbox (or the GitHub Actions run with `"emails":1`). "This runs every morning; a log table guarantees nobody gets the same reminder twice."

## Security demo (inside the 5:00 to 6:15 slot)

1. As **B**, paste the URL of A's private project (B isn't a member): **"Project not found."** "The server checks membership on every request. Outsiders get exactly the same 404 as a project that doesn't exist, so they can't even tell it's there."
2. Change one character in the id: same page.
3. Open an old (regenerated) invite link: **"Invite unavailable."** "Tokens are random, stored only as hashes, and expire after 7 days."
4. Optional: in DevTools > Application > Cookies, show the `token` cookie is **HttpOnly** and **SameSite Lax**.
5. Optional: create a task called `<img src=x onerror=alert(1)>`: it shows as text, nothing runs.

## Fallback if Render is asleep or down

- **Slow start:** keep talking through slide 3 while "Waking up the server..." shows; it usually recovers within a minute. If you pre-warmed it, this won't happen.
- **Backend down:** run locally. Have both terminals ready (`npm run dev` in `backend` and `frontend`) and open `http://localhost:5173`. Local sign-in needs `http://localhost:5173` in the Google client's authorized origins.
- **No internet or Google sign-in fails:** use backup screenshots or a short screen recording of the demo (record it the day before). Walk through the security demo with screenshots of "Project not found" and the 401/404 responses.
- **Email not arriving:** show the GitHub Actions log line (`"ok":true ... "emails":1`) and a screenshot of an earlier email.

## Likely questions and short answers

| Question | Answer |
|---|---|
| Why Google sign-in instead of passwords? | No password storage or reset flows to secure. The server verifies Google's signed ID token (audience and verified email), then issues its own session cookie. |
| Where is the session stored? | In a signed JWT inside an httpOnly, SameSite=Lax cookie (Secure in production). JavaScript can't read it, and other sites can't make the browser send it on cross-site POSTs. |
| How do you stop one user seeing another team's project? | Every project route runs `requireMember`, which looks the project up with the current user as a member. Non-members get the same 404 as a missing project. Task queries are always scoped to that verified project. |
| What stops someone guessing invite links? | 32 random bytes (about 256 bits), so guessing is impossible. Only a hash is stored, links expire after 7 days, and the owner can regenerate or disable them. |
| What if someone sends malicious input? | zod validates every body (types, enums, lengths) and drops unknown fields; ids must be 24 hex characters; React escapes text; emails escape HTML. There's also rate limiting. |
| How do reminders avoid double emails? | Before sending, the job inserts a log row with a unique index on task, type and deadline. If the insert fails as a duplicate, it skips; if the send fails, it deletes the row so the next run retries. |
| Why GitHub Actions instead of a timer in the server? | The free Render server sleeps, so an in-process timer wouldn't run. GitHub calls the endpoint once a day and retries while the server wakes up. |
| Why the `/api` rewrite? | It makes the API same-origin with the frontend: no CORS problems with cookies, and the cookie can use SameSite=Lax. |
| Is it real-time? | Nearly, for chat: it checks for new messages every 5 seconds while open. Other pages refresh on load, window focus and after your own actions. True real-time would need WebSockets, which is a next step. |
| What stops a member assigning work to the owner through the API? | The rule is on the server. It turns the request into a suggestion whichever way it's sent, and only the owner can accept it. |
| Did you write tests? | The features were tested with end-to-end scripts against an in-memory MongoDB plus a written two-account test plan. The scripts aren't in the repo yet; adding them as `npm test` is a next step. |
| What would you improve? | Automated tests in CI, real-time updates, multiple owners and role changes, a verified email domain, and server-side session revocation. |
| Did anything go wrong? | Yes: an early commit included the `.env` file. I removed it from history and rotated the secrets. Lesson: add `.gitignore` before the first commit. |
