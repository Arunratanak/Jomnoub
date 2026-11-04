import { Resend } from 'resend';

const DEFAULT_FROM = 'TaskHub <onboarding@resend.dev>';
let client = null;

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set, so emails cannot be sent');
  if (!client) client = new Resend(key);
  return client;
}

export async function sendEmail({ to, subject, text, html }) {
  const { data, error } = await getClient().emails.send({
    from: process.env.EMAIL_FROM || DEFAULT_FROM,
    to,
    subject,
    text,
    html,
  });
  // The SDK reports API failures in `error` instead of throwing
  if (error) throw new Error(`Resend failed to send email: ${error.message || error.name || 'unknown error'}`);
  return data;
}

// Use for every user-supplied value placed into HTML (task titles, project names, user names)
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
