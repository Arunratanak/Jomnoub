import { useState } from 'react';

// Password box with a Show/Hide button
export default function PasswordInput({ value, onChange, autoComplete, minLength, autoFocus = false }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input
        className="input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength}
        maxLength={128}
        autoComplete={autoComplete}
        required
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShow((s) => !s)}
        aria-pressed={show}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
