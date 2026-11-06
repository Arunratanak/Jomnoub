import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import useTitle from '../utils/useTitle';

export default function Privacy() {
  useTitle('Privacy policy');
  const contactEmail = 'prak092839351@gmail.com';
  const lastUpdated = 'November 5, 2026';

  return (
    <main className="prose">
      <div className="prose-head">
        <Link to="/dashboard" className="logo" aria-label="Jomnoub home"><Logo /></Link>
        <ThemeToggle />
      </div>
      <h1>Jomnoub Privacy Policy</h1>
      <p><em>Last updated: {lastUpdated}</em></p>

      <p>
        Jomnoub is a project management tool for organizing group work: assigning tasks,
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
          <strong>Email and password accounts.</strong> If you create an account with an
          email and password, we store your name, email address, and a one-way hash of your
          password. We never store the password itself.
        </li>
        <li>
          <strong>Profile photo.</strong> If you upload a photo, your browser first shrinks it
          to a small square, which leaves out details such as where it was taken. Only you and
          people in your projects can see it, and it is deleted when you remove or replace it.
        </li>
        <li>
          <strong>Content you create.</strong> Projects, tasks, subtasks, descriptions,
          deadlines, assignments, comments, chat messages, uploaded files, and team membership that you or your
          teammates enter in the app. We also keep in-app notifications about this activity for up to 90 days.
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
        Your data is stored in a MongoDB Atlas database, and uploaded files in Cloudflare R2.
        The app is hosted on Render, and emails are sent through Resend.
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