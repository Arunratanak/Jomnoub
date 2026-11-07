import { useEffect } from 'react';
import { motion as Motion, useIsPresent } from 'motion/react';

const DIALOG_IN = { type: 'spring', stiffness: 420, damping: 32 };
const OUT = { duration: 0.12 };

// Centered dialog. Closes on Escape or a click on the dimmed background.
// Wrap it in AnimatePresence where it's used, so it can animate as it closes.
export default function Modal({ title, onClose, wide = false, children }) {
  const isPresent = useIsPresent(); // false while it animates out

  useEffect(() => {
    if (!isPresent) return undefined; // a second Escape must not close what's underneath
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isPresent]);

  return (
    <Motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: OUT }}
      transition={{ duration: 0.16 }}
      style={isPresent ? undefined : { pointerEvents: 'none' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Motion.div
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 6, transition: OUT }}
        transition={DIALOG_IN}
      >
        <h2>{title}</h2>
        {children}
      </Motion.div>
    </Motion.div>
  );
}
