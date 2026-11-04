import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // sends the login cookie on every request
});

export const RATE_LIMIT_MESSAGE = "You're doing that too often. Please wait a few minutes and try again.";

// Replace the server's terse 429 text with a friendly one, so every page that
// shows err.response.data.error displays it without extra code.
api.interceptors.response.use(undefined, (err) => {
  if (err.response?.status === 429) {
    err.response.data = { ...(err.response.data || {}), error: RATE_LIMIT_MESSAGE };
  }
  return Promise.reject(err);
});

export default api;
