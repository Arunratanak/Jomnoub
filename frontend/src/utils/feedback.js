// Small global helpers shown by components/FeedbackHost.jsx

export const TOAST_EVENT = 'taskhub:toast';
export const CONFIRM_EVENT = 'taskhub:confirm';
export const SESSION_EXPIRED = 'taskhub:session-expired';

// A short message at the bottom of the screen: toast('Saved') or toast('Failed', 'error')
export function toast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
}

// A styled replacement for window.confirm. Resolves to true or false.
// confirmDialog({ title, message, confirmLabel, danger })
export function confirmDialog(options) {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(CONFIRM_EVENT, { detail: { ...options, resolve } }));
  });
}
