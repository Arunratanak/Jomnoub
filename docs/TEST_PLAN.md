# Jomnoub manual test plan

A step-by-step script for testing Jomnoub with two Google accounts. It takes about 25 minutes. Run it on the live site (or locally on `http://localhost:5173`) before a demo or after a deploy.

## Setup

- **Account A** (owner): your main Google account, in a normal browser window.
- **Account B** (teammate): a second Google account, in a **private/incognito window**, so the two sessions don't share cookies.
- `<site>` below means the frontend URL (live: your Render static site URL; local: `http://localhost:5173`).
- If the site has been idle, open `<site>` once and wait for "Waking up the server..." to finish (up to a minute).

Tick each result. If one fails, note what you saw.

## 1. Sign-in and session

| # | Step | Expected |
|---|---|---|
| 1.1 | A: open `<site>` | Redirected to the login page |
| 1.2 | A: sign in with Google | Dashboard with your name, email and picture |
| 1.3 | A: refresh the page | Still signed in (cookie works) |
| 1.4 | A: DevTools > Application > Cookies | `token` cookie is HttpOnly and SameSite Lax (and Secure on the live site) |
| 1.5 | A: Log out, then refresh | Login page, still logged out |
| 1.6 | Logged out, open `<site>/api/projects` | `{"error":"Not authenticated"}` |

Sign A back in before continuing.

## 2. Projects and tasks

| # | Step | Expected |
|---|---|---|
| 2.1 | A: create project "Test project" | Appears in "Your projects" as owner, 1 member |
| 2.2 | A: open it, add a task due **tomorrow**, assigned to A | Task appears in To do on the Board tab; the Progress tab shows 1 task |
| 2.3 | A: add a task due **yesterday**, assigned to A | Red border and "Overdue"; the Progress tab's Overdue count = 1 |
| 2.4 | A: add a task named `<img src=x onerror=alert(1)>` | Shown as plain text; no alert pops up |
| 2.5 | A: click Start on a task assigned to A | It moves column; the card shows "Started by" and A's name; "Moved to In progress" appears with Undo; Activity shows "moved ... from To do to In progress" |
| 2.5a | A: click Mark complete, then Undo | It goes to Done with "Completed by", the progress bar rises, then Undo returns it to In progress and the bar drops |
| 2.5b | A: click the back arrow on an In progress card; drag a card to Done; click Reopen | It returns to To do with its record cleared; dragging works and offers Undo; Reopen returns it to In progress |
| 2.6 | A: click the bell | Badge shows 2 (the overdue and the tomorrow task, both assigned to A); dropdown lists them |
| 2.7 | A: open the Timeline tab | Overdue group first, then dates, then No deadline |

## 3. Invite flow

| # | Step | Expected |
|---|---|---|
| 3.1 | A: Members tab > Generate invite link > Copy link | Link shown with an expiry date 7 days ahead |
| 3.2 | B (private window, logged out): paste the link | Login page says "Sign in to accept your project invite" |
| 3.3 | B: sign in with Google | Back on the invite page: "You're invited to join Test project" |
| 3.4 | B: click Join project | Project page opens; B is listed as member |
| 3.5 | B: open the same link again | "You're already a member of this project" |
| 3.6 | A: refresh the project | B appears in Members; Activity shows "B joined via invite link" |

## 4. Permissions (as member B)

| # | Step | Expected |
|---|---|---|
| 4.1 | B: look at the project page | No Settings tab (edit/delete project); on the Members tab, no invite link panel or Remove buttons |
| 4.2 | B: on a task created by A and not assigned to B | No Start, Mark complete or Reopen button, no Edit or Delete |
| 4.3 | A: assign a task to B | B (after refresh) can move, edit and delete it |
| 4.4 | B: change that task to Done | Works; A sees it moved and the activity entry |
| 4.5 | B: create a task | B can edit and delete their own task |

## 5. Outsider blocked

| # | Step | Expected |
|---|---|---|
| 5.1 | A: create a second project "Private project" and copy its URL | |
| 5.2 | B: open that URL | **"Project not found"** (same page as a project that doesn't exist) |
| 5.3 | B: open the URL with one character of the id changed | Same "Project not found" |
| 5.4 | B: open `.../timeline` for that project | It redirects to the Timeline tab, then the same "Project not found" |

## 6. Assignee rule

| # | Step | Expected |
|---|---|---|
| 6.1 | A: open the Assignee choices in "Private project" | Only A is listed (B isn't a member there) |
| 6.2 | A: in "Test project", assign a task to B, then remove B (Members > Remove) | The task becomes Unassigned; Activity shows "removed B from the project" |
| 6.3 | B: refresh My Tasks | That task is gone; the project page now shows "Project not found" |

## 7. Leaving and the last owner

| # | Step | Expected |
|---|---|---|
| 7.1 | A: generate a new invite link; B joins again | B is a member again |
| 7.2 | B: click Leave project | B returns to the dashboard; the project is gone from B's list |
| 7.3 | A: Members list | No Remove button next to A (the owner can't be removed) |

## 8. Invite link expiry and revocation

Waiting 7 days isn't practical, so test the server checks this way:

| # | Step | Expected |
|---|---|---|
| 8.1 | A: Generate invite link, copy it (link 1) | |
| 8.2 | A: Generate new link (link 2) | Confirm dialog warns the old link stops working |
| 8.3 | B: open link 1 | **"Invite unavailable"** |
| 8.4 | A: Disable links; B opens link 2 | **"Invite unavailable"** |
| 8.5 | Optional real expiry: generate link 3; in MongoDB Atlas > Browse Collections > `invites`, set its `expiresAt` to yesterday; B opens link 3 | **"Invite unavailable"** (the server checks the date on every request) |

## 9. Rate limit

The Google sign-in route allows 30 attempts per 15 minutes per IP. In PowerShell (replace `<site>`):

```powershell
1..31 | ForEach-Object {
  try { Invoke-RestMethod -Method Post -Uri "<site>/api/auth/google" -ContentType "application/json" -Body '{"credential":"x"}' } catch { "$_ : $($_.Exception.Response.StatusCode.value__)" }
} | Select-Object -Last 2
```

| # | Expected |
|---|---|
| 9.1 | The first 30 return 401 (invalid token); the 31st returns **429** with `{"error":"Too many requests"}` |
| 9.2 | Signing in from the browser on the same network now shows "You're doing that too often. Please wait a few minutes and try again." |

After the test, wait 15 minutes (or restart the backend locally) before signing in again. On the live site, run this from a network you won't need for the demo.

## 10. Reminders

| # | Step | Expected |
|---|---|---|
| 10.1 | A: make sure A has an unfinished task due tomorrow or overdue | |
| 10.2 | Dry run (PowerShell, replace the secret): `Invoke-RestMethod -Method Post -Uri "https://<backend>.onrender.com/api/cron/reminders?dryRun=true" -Headers @{ Authorization = "Bearer <CRON_SECRET>" }` | `ok: True, dryRun: True`, `emails` at least 1; nothing is sent |
| 10.3 | Same command without the header | **401 Unauthorized** |
| 10.4 | GitHub > Actions > Daily task reminders > Run workflow | Green; the log's last line shows `"emails":1` (or more) |
| 10.5 | Check A's inbox (and spam) | "Jomnoub: N overdue, M due soon" with sections and a link to My Tasks |
| 10.6 | Run the workflow again | Green, `"emails":0`: the same reminder is never sent twice |

Note: with the default `onboarding@resend.dev` sender, only the Resend account owner's address receives email. Reminders for B will show as `failures` unless a domain is verified.

## 11. Member roles, suggestions, subtasks, chat

Do this with B back in a project owned by A.

| # | Step | Expected |
|---|---|---|
| 11.1 | A: open the Members tab | A is listed first with an Owner badge; B has a Member badge |
| 11.2 | B: Add task, choose A as assignee | A's choice says "Owner · as a suggestion" and the form explains the owner must confirm |
| 11.3 | B: click "Add and suggest" | The card says Unassigned and "Waiting for the owner to confirm" |
| 11.4 | A: refresh the board | A banner says a task was suggested; the bell count goes up; the card has Accept and Decline |
| 11.5 | A: click Accept | The task is assigned to A and appears in A's My Tasks |
| 11.6 | B: suggest another task; A: Decline it from My Tasks | The task stays Unassigned and the suggestion is gone |
| 11.7 | A or B: click a task's title you can edit, add a subtask with a description | The subtask and its description appear, with "0 of 1 done" |
| 11.8 | Tick its checkbox | "1 of 1 done"; the title is struck through; the card shows 1/1 |
| 11.9 | B: open a task B didn't create and isn't assigned | Checkboxes are disabled and there's no add form |
| 11.10 | B: open the Chat tab and send a message | It appears on the right |
| 11.11 | A: on another tab of the project, wait up to 30 seconds | A red dot appears on the Chat tab |
| 11.12 | A: open Chat, reply; watch B's window | The reply reaches B within about 5 seconds, without refreshing |
| 11.13 | B: hover over A's message, then B's own | Only B's own message has a delete icon |
| 11.14 | Outsider: open `<site>/api/projects/<id>/messages` | `{"error":"Not found"}` |

## 12. Email and password accounts

Use a private window and an email address you own.

| # | Step | Expected |
|---|---|---|
| 12.1 | Create account with a password under 8 characters | The form stops you |
| 12.2 | Create account with a valid password | You land on Home, signed in |
| 12.3 | Refresh, then log out and refresh | Still signed in, then still logged out |
| 12.4 | Sign in with a wrong password | "Incorrect email or password" |
| 12.5 | Sign in with an unknown email | The same message |
| 12.6 | Create another account with the same email | "An account with this email already exists" |
| 12.7 | Sign in with the right password | You land on Home |
| 12.8 | MongoDB Atlas > `users`: find the account | `passwordHash` starts with `scrypt$`; the password appears nowhere |
| 12.9 | Open an invite link while logged out, sign in with the password | You return to the invite and can join |
| 12.10 | Before verifying, owner: Members tab > Add by email with that address | Refused, with a suggestion to send an invite link |
| 12.10a | Check that inbox for "Verify your Jomnoub email" and click the link | "Your email is verified"; the banner disappears |
| 12.10b | Click the same link again | "Couldn't verify your email" |
| 12.10c | Sign in page > Forgot password?, enter the address, open the email | The link opens the page for choosing a new password |
| 12.10d | Set a new password; check another signed-in browser | You're signed in; the other browser is signed out; the old password fails |
| 12.10e | Forgot password? with an address that has no account | The same message; no email arrives |
| 12.11 | Enter a wrong password 11 times | "You're doing that too often" |
| 12.12 | Only if the address is a Google account: Sign in with Google, then try the old password | Same account as before; the password no longer works |

## 13. File attachments

| # | Step | Expected |
|---|---|---|
| 13.0 | On the board, click Attach on a card and choose a file, then drag another file onto the card | Progress shows on the card, then its file count goes up |
| 13.1 | Open a task, click Add files, choose a PDF | Progress shows, then the file is listed with its size and your name |
| 13.2 | Drag an image onto the task window | It uploads and shows a thumbnail |
| 13.3 | Click a file's name | It downloads with the right name and opens correctly |
| 13.4 | Close the window | The card shows the file count; Activity shows "attached" |
| 13.5 | Try a file over 10 MB, then an `.html` file | Each is refused with a clear message |
| 13.6 | Rename a text file to `fake.png` and upload it | "This file doesn't look like the image type its name says it is" |
| 13.7 | As another member, open the task | They can see, download and add files, but only delete their own |
| 13.8 | As an outsider, open a download URL | `{"error":"Not found"}` |
| 13.9 | Delete the task | Its files are gone from the bucket in the Cloudflare R2 dashboard |
| 13.10 | Upload a file of about 9 MB on the live site | It uploads and downloads intact |

## 14. Comments, mentions, notifications and the Timeline tab

Use two accounts in the same project (A in a normal window, B in a private window).

| # | Step | Expected |
|---|---|---|
| 14.1 | A: Timeline tab, click Comment on a task, type `@` and part of B's name | A list of matching members appears; arrows and Enter pick one |
| 14.2 | A: finish the comment and press Enter | "Comment posted"; the button shows the new count |
| 14.3 | B: within 30 seconds, or on switching back to the window | The bell's number goes up; the panel shows "mentioned you" with the comment |
| 14.4 | B: click that notification | The task opens with the comment highlighted and @B marked; the number goes down |
| 14.5 | B: reply using Shift+Enter for a second line | The reply appears at once, keeping the line break |
| 14.6 | A: open the bell | "commented on" with B's reply |
| 14.7 | B: try to delete A's comment, then their own | No delete button on A's; their own is removed |
| 14.8 | A: delete B's comment; close the task | It's removed; the card's count goes down |
| 14.9 | Post `<img src=x onerror=alert(1)>` | It shows as plain text and no alert appears |
| 14.10 | A: assign a new task to B | B's bell shows "assigned you to", and clicking it opens the task without a refresh |
| 14.11 | A: delete that task; B: click the notification | "That task no longer exists." |
| 14.12 | B: click Mark all as read, then refresh | Unread dots stay gone; tasks needing attention still count |
| 14.13 | On the Timeline tab: change a status, attach a file, tick Show completed, use a filter | Each works without leaving the tab |
| 14.14 | Open a task, press the browser's Back button; copy a task's address into a new tab | Back closes it; the address opens that task |
| 14.15 | Open an old `/projects/<id>/timeline` link | It goes to the Timeline tab |

## 15. Assign to all, the status rule, and your tasks first

Use the same two accounts, A (owner) and B (member).

| # | Step | Expected |
|---|---|---|
| 15.1 | A: new task, choose Everyone as the assignee | One task per member; each person is notified; Activity has one "for all" entry |
| 15.2 | B: new task, choose Everyone | Members get their copies; the owner's copy shows the owner's name and "waiting to accept" |
| 15.3 | B: new task, choose the owner | The card shows the owner's name, not Unassigned; the Unassigned filter doesn't list it; the Progress chart counts it for the owner |
| 15.4 | A: on a task assigned to B | A can move, drag, edit, reassign and delete it |
| 15.5 | B: move their own task through the stages | It works; a teammate's task offers no way to move it |
| 15.6 | A: on an unassigned task | A can still move it |
| 15.7 | Either: open the board with All selected | To do shows "Your tasks" first, then Unassigned, then a button for teammates' tasks with their count and any overdue |
| 15.8 | Click the button, refresh | The list opens, and stays open after refreshing |
| 15.9 | Choose the Overdue filter | Matching tasks all show, none folded |
| 15.10 | A: with the list folded, add a task for B | The list opens, so the new task can be seen |
| 15.11 | Hover over a task card, then click an empty part of it | The card lifts and its title turns green; pressing pushes it down; letting go opens the task |
| 15.12 | Click Attach, Start, Edit or Delete on a card | Each does its own job and does not open the task |
| 15.13 | Add task, look at Assignee | Each member appears with their picture and name, and you are marked "You"; clicking one selects it with a tick |
| 15.14 | Open a task you can change and look under Subtasks | A description box is already showing; a subtask can be added with or without a description |

## 16. Editing and deleting tasks

| # | Step | Expected |
|---|---|---|
| 16.1 | B: on a task assigned to B, even if A created it | B can edit and delete it |
| 16.2 | B: create a task with nobody assigned | B can delete it |
| 16.3 | B: create a task assigned to another member | B can no longer edit or delete it |
| 16.4 | B: look at a task assigned to someone else | No Edit or Delete button |
| 16.5 | B: suggest a task for the owner | B can delete it to withdraw the suggestion |
| 16.6 | A (owner): look at any task | A can edit and delete it |
| 16.7 | B: delete a task A created | A's bell shows "deleted task" with its name; clicking it opens the project |

## 17. Profile

| # | Step | Expected |
|---|---|---|
| 17.1 | A: click your picture at the top right, then Your profile | The page shows your details, task counts and projects |
| 17.2 | A: change your name and save | The menu updates straight away; B sees the new name after refreshing |
| 17.3 | A (Google account): log out and sign in with Google again | The name you chose is kept |
| 17.4 | A: upload a photo that isn't square | It appears as a circle, cropped from the middle, at the top right and on your profile |
| 17.5 | B: refresh the project | A's new photo shows on members, task cards and the assignee choices |
| 17.6 | A (Google account): log out and sign in with Google again | The uploaded photo is kept |
| 17.7 | A (Google account): click Use Google photo | The Google photo comes back |
| 17.8 | A: click Remove photo and confirm, then sign in with Google again | Your initial shows, and stays after signing in |
| 17.9 | A: choose a `.txt` or `.pdf` file as a photo | It's refused with a clear message, and the photo doesn't change |
| 17.10 | A: copy your uploaded photo's address, then open it as an account that shares no project with you | "Not found" |

## 18. Creating and joining from the home page

| # | Step | Expected |
|---|---|---|
| 18.1 | B: on Home, click Join project and paste A's invite link | The invite page shows the project's name; clicking Join project opens it |
| 18.2 | B: try again with the same link | The invite page says you're already a member, with an Open project button |
| 18.3 | B: enter `hello` | "That doesn't look like an invite link", and the box stays open |
| 18.4 | A: generate a new link; B: paste the old one | The box says the link is invalid or has expired |
| 18.5 | A: on Home, click New project, enter a name and click Create project | The box stays open and shows the project's invite link |
| 18.6 | A: click Copy link and paste it somewhere | The button says Copied, and the pasted link is the same one |
| 18.7 | B: join with that link | B joins the new project |
| 18.8 | A: in that box, click Open project (or Done) | Open project goes to the project; Done returns to Home, where it's listed |

## 19. Cleanup

- A: delete "Test project" and "Private project" (Settings tab > Delete project on each).
- If you used demo data: `npm run seed:clear` in `backend`.
