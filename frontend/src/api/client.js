import axios from 'axios';
import { SESSION_EXPIRED } from '../utils/feedback';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // sends the login cookie on every request
});

// Identifies this open page. Live updates are not sent back to the page that made the change.
export const TAB_ID = typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
api.defaults.headers.common['X-Tab-Id'] = TAB_ID;

export const RATE_LIMIT_MESSAGE = "You're doing that too often. Please wait a few minutes and try again.";

api.interceptors.response.use(undefined, (err) => {
  // Replace the server's terse 429 text with a friendly one, so every page that
  // shows err.response.data.error displays it without extra code.
  if (err.response?.status === 429) {
    err.response.data = { ...(err.response.data || {}), error: RATE_LIMIT_MESSAGE };
  }
  // A 401 on any request except the login check means the session has ended
  const url = err.config?.url || '';
  if (err.response?.status === 401 && !url.startsWith('/auth/')) {
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }
  return Promise.reject(err);
});

export default api;
