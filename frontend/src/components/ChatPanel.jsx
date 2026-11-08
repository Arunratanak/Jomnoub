import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import api from '../api/client';
import Avatar from './Avatar';
import { TrashIcon } from './Icons';
import { setLastRead } from '../utils/chatRead';
import { isAbout, onLiveChange } from '../utils/live';
import { confirmDialog, toast } from '../utils/feedback';

const POLL_MS = 5000; // checks for new messages only while this panel is open and visible
const PAGE_SIZE = 50;
const GROUP_MS = 5 * 60 * 1000;

const dayKey = (date) => new Date(date).toDateString();
const timeText = (date) => new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function dayText(date) {
  const key = dayKey(date);
  if (key === dayKey(Date.now())) return 'Today';
  if (key === dayKey(Date.now() - 24 * 60 * 60 * 1000)) return 'Yesterday';
  return new Date(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ChatPanel({ projectId, user, isOwner, onSeen }) {
  const [messages, setMessages] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const listRef = useRef(null);
  const stickToBottom = useRef(true); // follow new messages unless reading older ones
  const olderLoaded = useRef(false);
  const heightBeforeOlder = useRef(null);
  const url = `/projects/${projectId}/messages`;

  const refresh = useCallback(async () => {
    try {
      const res = await api.get(url, { params: { limit: PAGE_SIZE } });
      const latest = res.data.messages;
      // Keep older pages the user loaded; replace the newest page (this also picks up deletions)
      setMessages((prev) => {
        const oldest = latest[0]?._id;
        const older = prev && oldest ? prev.filter((m) => m._id < oldest) : [];
        return [...older, ...latest];
      });
      if (!olderLoaded.current) setHasMore(res.data.hasMore);
      setOffline(false);
      setLoadError(false);
    } catch {
      setOffline(true);
      setLoadError(true);
    }
  }, [url]);

  useEffect(() => {
    let timer = null;
    const tick = () => {
      if (!document.hidden) refresh();
    };
    tick();
    timer = setInterval(tick, POLL_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    const stopListening = onLiveChange((change) => { if (isAbout(change, projectId, ['chat'])) refresh(); });
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
      stopListening();
    };
  }, [refresh, projectId]);

  // Keep the view in the right place whenever the list changes
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (heightBeforeOlder.current !== null) {
      el.scrollTop += el.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Everything on screen counts as read
  useEffect(() => {
    if (!messages?.length) return;
    setLastRead(projectId, messages[messages.length - 1]._id);
    onSeen();
  }, [messages, projectId, onSeen]);

  const onScroll = () => {
    const el = listRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    setLoadingOlder(true);
    try {
      const res = await api.get(url, { params: { limit: PAGE_SIZE, before: messages[0]._id } });
      olderLoaded.current = true;
      heightBeforeOlder.current = listRef.current.scrollHeight;
      setMessages((prev) => [...res.data.messages, ...prev]);
      setHasMore(res.data.hasMore);
    } catch {
      toast('Could not load older messages.', 'error');
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await api.post(url, { text: body });
      setText('');
      stickToBottom.current = true;
      setMessages((prev) => [...(prev || []), res.data.message]);
    } catch (err) {
      // The typed text stays in the box so nothing is lost
      toast(err.response?.data?.error || 'Could not send your message.', 'error');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
  };

  const remove = async (m) => {
    const ok = await confirmDialog({ title: 'Delete message?', message: 'This removes it for everyone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`${url}/${m._id}`);
      setMessages((prev) => prev.filter((x) => x._id !== m._id));
    } catch (err) {
      toast(err.response?.data?.error || 'Could not delete the message.', 'error');
    }
  };

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef} onScroll={onScroll} role="log" aria-label="Project chat" aria-live="polite">
        {messages === null && !loadError && <p className="chat-note">Loading messages...</p>}
        {messages === null && loadError && <p className="chat-note">Could not load messages. Retrying...</p>}
        {messages?.length === 0 && (
          <div className="empty">
            <h2>No messages yet</h2>
            <p>Say hello to your team. Everyone in this project can read this chat.</p>
          </div>
        )}
        {hasMore && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <button type="button" className="btn btn-sm" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}
        {messages?.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          const authorId = m.author?._id;
          const grouped = !newDay && prev?.author?._id === authorId &&
            new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_MS;
          const mine = authorId === user._id;
          return (
            <div key={m._id}>
              {newDay && <div className="chat-day"><span>{dayText(m.createdAt)}</span></div>}
              <div className={`chat-row${mine ? ' mine' : ''}${grouped ? ' grouped' : ''}`}>
                {!mine && (grouped ? <span className="chat-avatar-gap" /> : <Avatar user={m.author || { name: '?' }} size={32} />)}
                <div className="chat-bubble-wrap">
                  {!grouped && (
                    <div className="chat-meta">
                      {!mine && <strong>{m.author?.name || 'Former member'}</strong>} {timeText(m.createdAt)}
                    </div>
                  )}
                  <div className="chat-line">
                    <div className="chat-bubble">{m.text}</div>
                    {(mine || isOwner) && (
                      <button type="button" className="icon-btn icon-btn-sm chat-delete" onClick={() => remove(m)} aria-label="Delete message" title="Delete">
                        <TrashIcon size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {offline && messages !== null && <p className="chat-offline">Reconnecting...</p>}

      <form className="chat-compose" onSubmit={send}>
        <textarea
          className="textarea"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message your team. Enter to send, Shift+Enter for a new line"
          aria-label="Message"
          maxLength={2000}
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim() || sending}>Send</button>
      </form>
    </div>
  );
}
