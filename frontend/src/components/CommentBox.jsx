import { useRef, useState } from 'react';
import api from '../api/client';
import Avatar from './Avatar';
import { toast } from '../utils/feedback';

// What's being typed after an @, or null. Names can contain spaces.
function mentionQueryAt(text, caret) {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at === -1 || (at > 0 && /[\p{L}\p{M}\p{N}_]/u.test(before[at - 1]))) return null;
  const query = before.slice(at + 1);
  if (query.includes('\n') || query.length > 40) return null;
  return { at, query };
}

// Writes a comment. Typing @ lists the project's members. The server works out who was
// actually mentioned, so this list is only a typing aid.
export default function CommentBox({ projectId, taskId, members, currentUserId, onPosted, autoFocus = false, placeholder = 'Write a comment. Type @ to mention someone' }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState(null); // { at, query }
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const matches = picker
    ? members
      .filter((m) => m.user._id !== currentUserId)
      .filter((m) => m.user.name.toLowerCase().includes(picker.query.trim().toLowerCase()))
      .slice(0, 6)
    : [];
  const showPicker = matches.length > 0;

  const update = (value, caret) => {
    setText(value);
    setPicker(mentionQueryAt(value, caret));
    setActive(0);
  };

  const pick = (member) => {
    const caret = inputRef.current.selectionStart;
    const inserted = `@${member.user.name} `;
    const next = text.slice(0, picker.at) + inserted + text.slice(caret);
    setText(next);
    setPicker(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const position = picker.at + inserted.length;
      inputRef.current?.setSelectionRange(position, position);
    });
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { text: body });
      setText('');
      setPicker(null);
      onPosted(res.data.comment);
    } catch (err) {
      // The typed text stays in the box so nothing is lost
      toast(err.response?.data?.error || 'Could not post your comment.', 'error');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    if (showPicker) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches[active]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPicker(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) send(e);
  };

  return (
    <form className="comment-box" onSubmit={send}>
      <div className="comment-input-wrap">
        <textarea
          ref={inputRef}
          className="textarea comment-input"
          rows={2}
          value={text}
          onChange={(e) => update(e.target.value, e.target.selectionStart)}
          onClick={(e) => setPicker(mentionQueryAt(text, e.target.selectionStart))}
          onKeyDown={onKeyDown}
          onBlur={() => setPicker(null)}
          placeholder={placeholder}
          aria-label="Comment"
          maxLength={2000}
          autoFocus={autoFocus}
        />
        {showPicker && (
          <ul className="mention-picker" role="listbox" aria-label="Mention someone">
            {matches.map((m, i) => (
              <li key={m.user._id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`mention-option${i === active ? ' active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                >
                  <Avatar user={m.user} size={24} /> {m.user.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="comment-box-actions">
        <small className="muted">Enter to post, Shift+Enter for a new line</small>
        <button type="submit" className="btn btn-sm btn-primary" disabled={!text.trim() || sending}>{sending ? 'Posting...' : 'Comment'}</button>
      </div>
    </form>
  );
}
