// Small global helpers shown by components/FeedbackHost.jsx

export const TOAST_EVENT = 'jomnoub:toast';
export const CONFIRM_EVENT = 'jomnoub:confirm';
export const SESSION_EXPIRED = 'jomnoub:session-expired';

// A short message at the bottom of the screen: toast('Saved') or toast('Failed', 'error').
// An optional action adds a button: toast('Moved', 'success', { label: 'Undo', onClick })
export function toast(message, type = 'success', action = null) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type, action } }));
}

// A styled replacement for window.confirm. Resolves to true or false.
// confirmDialog({ title, message, confirmLabel, danger })
export function confirmDialog(options) {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(CONFIRM_EVENT, { detail: { ...options, resolve } }));
  });
}
