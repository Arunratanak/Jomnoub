import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import Avatar from './Avatar';
import CommentBox from './CommentBox';
import { TrashIcon } from './Icons';
import { timeAgo } from '../utils/dates';
import { confirmDialog, toast } from '../utils/feedback';

const REFRESH_MS = 15000; // only while this task is open

// Highlights mentions by finding the mentioned people's names. Everything stays plain
// text pieces, so React escapes it and comments can't inject HTML.
function CommentText({ text, mentions }) {
  const names = (mentions || []).map((m) => `@${m.name}`).sort((a, b) => b.length - a.length);
  if (names.length === 0) return <>{text}</>;
  const parts = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const lower = rest.toLowerCase();
    let at = -1;
    let found = '';
    for (const name of names) {
      const index = lower.indexOf(name.toLowerCase());
      if (index !== -1 && (at === -1 || index < at)) { at = index; found = name; }
    }
    if (at === -1) { parts.push(rest); break; }
    if (at > 0) parts.push(rest.slice(0, at));
    parts.push(<span key={key++} className="mention">{rest.slice(at, at + found.length)}</span>);
    rest = rest.slice(at + found.length);
  }
  return <>{parts}</>;
}

export default function CommentList({ projectId, task, user, isOwner, members, highlightId, onCountChange }) {
  const [comments, setComments] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const scrolledTo = useRef(null);
  const highlightRef = useRef(null);
  const reportCount = useRef(onCountChange);
  const base = `/projects/${projectId}/tasks/${task._id}/comments`;

  useEffect(() => {
    reportCount.current = onCountChange;
  });

  useEffect(() => {
    const load = () => {
      if (document.hidden) return;
      api
        .get(base)
        .then((res) => {
          setComments(res.data.comments);
          setLoadError(false);
        })
        .catch(() => setLoadError(true));
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
    // A notification for a brand new comment changes highlightId: fetch it straight away
  }, [base, highlightId]);

  // Keeps the count on the task's card in step, including other people's comments
  useEffect(() => {
    if (comments) reportCount.current(comments.length);
  }, [comments]);

  // Opened from a notification: bring that comment into view once
  useEffect(() => {
    if (highlightId && scrolledTo.current !== highlightId && highlightRef.current) {
      scrolledTo.current = highlightId;
      highlightRef.current.scrollIntoView({ block: 'center' });
    }
  }, [comments, highlightId]);

  const remove = async (c) => {
    const ok = await confirmDialog({ title: 'Delete this comment?', message: 'This removes it for everyone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`${base}/${c._id}`);
      setComments((list) => list.filter((x) => x._id !== c._id));
    } catch (err) {
      toast(err.response?.data?.error || 'Could not delete the comment.', 'error');
    }
  };

  return (
    <section className="comments">
      <div className="subtask-head">
        <h3>Comments</h3>
        {comments?.length > 0 && <span className="muted">{comments.length}</span>}
      </div>

      {loadError && !comments && <p className="alert">Could not load the comments.</p>}
      {!comments && !loadError && <p className="muted">Loading comments...</p>}
      {comments?.length === 0 && <p className="muted" style={{ padding: '4px 0 8px' }}>No comments yet. Start the conversation.</p>}

      {comments?.length > 0 && (
        <ul className="comment-list">
          {comments.map((c) => (
            <li
              key={c._id}
              ref={c._id === highlightId ? highlightRef : null}
              className={`comment${c._id === highlightId ? ' highlighted' : ''}`}
            >
              <Avatar user={c.author || { name: '?' }} size={32} />
              <div className="row-main">
                <div className="comment-head">
                  <strong>{c.author?.name || 'Former member'}</strong>
                  <small className="muted" title={new Date(c.createdAt).toLocaleString()}>{timeAgo(c.createdAt)}</small>
                </div>
                <div className="comment-text"><CommentText text={c.text} mentions={c.mentions} /></div>
              </div>
              {(isOwner || c.author?._id === user._id) && (
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => remove(c)} aria-label="Delete comment" title="Delete">
                  <TrashIcon size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <CommentBox
        projectId={projectId}
        taskId={task._id}
        members={members}
        currentUserId={user._id}
        onPosted={(comment) => setComments((list) => [...(list || []), comment])}
      />
    </section>
  );
}
