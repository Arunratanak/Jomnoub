import { useEffect, useRef, useState } from 'react';
import { CONFIRM_EVENT, TOAST_EVENT } from '../utils/feedback';

const TOAST_MS = 4000;
const ACTION_TOAST_MS = 8000; // long enough to read it and press Undo

// Renders toasts and the confirm dialog requested through utils/feedback.js
export default function FeedbackHost() {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const confirmRef = useRef(null);
  const nextId = useRef(1);

  useEffect(() => {
    const onToast = (e) => {
      const id = nextId.current++;
      // Only the latest action stays on offer: an older Undo would no longer match what's on screen
      setToasts((list) => [...list.filter((t) => !(e.detail.action && t.action)), { id, ...e.detail }]);
      setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), e.detail.action ? ACTION_TOAST_MS : TOAST_MS);
    };
    const onConfirm = (e) => setDialog(e.detail);
    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(CONFIRM_EVENT, onConfirm);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(CONFIRM_EVENT, onConfirm);
    };
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    confirmRef.current?.focus();
    // Capture phase: Escape closes this dialog only, not a modal underneath it
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        dialog.resolve(false);
        setDialog(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog]);

  const answer = (value) => {
    dialog.resolve(value);
    setDialog(null);
  };

  return (
    <>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.type === 'error' ? ' toast-error' : ''}`}>
            {t.message}
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  setToasts((list) => list.filter((x) => x.id !== t.id));
                  t.action.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>

      {dialog && (
        <div className="modal-backdrop confirm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
          <div className="confirm" role="alertdialog" aria-modal="true" aria-label={dialog.title}>
            <h2>{dialog.title}</h2>
            {dialog.message && <p className="muted">{dialog.message}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => answer(false)}>Cancel</button>
              <button
                ref={confirmRef}
                type="button"
                className={`btn ${dialog.danger ? 'btn-danger-solid' : 'btn-primary'}`}
                onClick={() => answer(true)}
              >
                {dialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
