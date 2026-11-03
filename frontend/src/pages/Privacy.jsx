export default function Privacy() {
  const contactEmail = 'your-email@example.com'; // replace with your real email
  const lastUpdated = 'November 3, 2026';

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 20px', lineHeight: 1.6 }}>
      <h1>TaskHub Privacy Policy</h1>
      <p><em>Last updated: {lastUpdated}</em></p>

      <p>
        TaskHub is a project management tool for organizing group work: assigning tasks,
        tracking deadlines, and following progress. This page explains what information
        the app collects and how it is used.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Google account information.</strong> When you sign in with Google, we
          receive your name, email address, profile picture, and a unique Google account
          identifier. We do not receive your Google password.
        </li>
        <li>
          <strong>Content you create.</strong> Projects, tasks, descriptions, deadlines,
          assignments, and team membership that you or your teammates enter in the app.
        </li>
        <li>
          <strong>Session cookie.</strong> After you sign in, we store a single secure
          cookie in your browser to keep you logged in. It is used only for
          authentication.
        </li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To sign you in and identify your account.</li>
        <li>To show your name and picture to teammates in projects you belong to, for example next to tasks assigned to you.</li>
        <li>To send you email reminders when tasks assigned to you are due soon or overdue.</li>
      </ul>

      <h2>What we do not do</h2>
      <p>
        We do not sell your information, share it with advertisers, or use it for
        marketing. Your data is visible only to you and to members of the projects
        you join.
      </p>

      <h2>Where your data is stored</h2>
      <p>
        Your data is stored in a MongoDB Atlas database. The app is hosted on Vercel
        (frontend) and Render (backend), and reminder emails are sent through Resend.
        These providers process data only to run the service.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your information for as long as your account exists. To request deletion
        of your account and associated data, email us at{' '}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Contact{' '}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
    </main>
  );
}