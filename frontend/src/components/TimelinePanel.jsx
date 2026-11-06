import { useRef, useState } from 'react';
import Avatar from './Avatar';
import CommentBox from './CommentBox';
import { CalendarIcon, CheckIcon, CommentIcon, PaperclipIcon } from './Icons';
import { toast } from '../utils/feedback';
import { ACCEPT } from '../utils/files';
import { OVERDUE, NO_DEADLINE, utcDay, groupTasks } from '../utils/timeline';
import { opensCard, STATUSES, statusNote } from '../utils/taskStatus';
import useTaskFileUpload from '../utils/useTaskFileUpload';

function dayLabel(key, todayKey, tomorrowKey) {
  const text = new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  if (key === todayKey) return `Today · ${text}`;
  if (key === tomorrowKey) return `Tomorrow · ${text}`;
  return text;
}

function TimelineItem({ task: t, person, overdue, projectId, user, members, canChangeStatus, onOpen, onStatus, onCommentAdded, onFileAdded }) {
  const [commenting, setCommenting] = useState(false);
  const inputRef = useRef(null);
  const { uploading, addFiles } = useTaskFileUpload(projectId, t._id, onFileAdded);
  const status = STATUSES.find((s) => s.value === t.status);
  const subtasks = t.subtasks || [];
  const doneSubtasks = subtasks.filter((s) => s.done).length;

  return (
    <li className={`task-card timeline-item${overdue ? ' overdue' : ''}`} onClick={(e) => { if (opensCard(e)) onOpen(t); }}>
      <button type="button" className={`task-title-btn${t.status === 'done' ? ' done-title' : ''}`} onClick={() => onOpen(t)}>{t.title}</button>

      <div className="feed-meta">
        <span className="task-people">
          <Avatar user={person} size={20} />
          {person ? person.name : 'Unassigned'}
        </span>
        {canChangeStatus ? (
          <select className="select select-sm" value={t.status} onChange={(e) => onStatus(t, e.target.value)} aria-label={`Status of ${t.title}`}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        ) : (
          <span className="status-pill">
            <span className="dot" style={{ background: status?.color }} aria-hidden="true" />
            {status?.label}
          </span>
        )}
        {overdue && <span className="due overdue">was due {new Date(t.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}</span>}
        {t.suggestedBy && <span className="muted">Suggested by {t.suggestedBy.name} · waiting to accept</span>}
        {subtasks.length > 0 && (
          <span className="due"><CheckIcon size={14} /> {doneSubtasks}/{subtasks.length}</span>
        )}
        {statusNote(t) && <small className="muted">{statusNote(t)}</small>}
      </div>

      {uploading && (
        <div className="upload-progress" role="status">
          <div className="upload-progress-text"><span>{uploading.name}</span><span className="muted">{uploading.percent}%</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${uploading.percent}%` }} /></div>
        </div>
      )}

      <div className="timeline-actions">
        <button type="button" className="btn btn-sm" onClick={() => setCommenting((c) => !c)} aria-expanded={commenting}>
          <CommentIcon size={15} /> Comment{t.commentCount > 0 ? ` (${t.commentCount})` : ''}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(uploading)}
          aria-label={`Attach files to ${t.title}`}
        >
          <PaperclipIcon size={15} /> Attach{t.attachmentCount > 0 ? ` (${t.attachmentCount})` : ''}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onOpen(t)}>View</button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          aria-label={`Choose files for ${t.title}`}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {commenting && (
        <CommentBox
          projectId={projectId}
          taskId={t._id}
          members={members}
          currentUserId={user._id}
          autoFocus
          onPosted={() => {
            onCommentAdded(t._id);
            setCommenting(false);
            toast('Comment posted.');
          }}
        />
      )}
    </li>
  );
}

// Tasks by date: Overdue first, then each date, then No deadline. Each one can be
// opened, updated, commented on or given files right here.
export default function TimelinePanel({ tasks, filtered, projectId, user, members, showDone, onShowDone, canChangeStatus, personOf, onOpen, onStatus, onCommentAdded, onFileAdded }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayKey = utcDay(today);
  const tomorrowKey = utcDay(today.getTime() + 24 * 60 * 60 * 1000);
  const visible = filtered.filter((t) => showDone || t.status !== 'done');
  const groups = groupTasks(visible);

  return (
    <div className="timeline">
      <label className="check timeline-toggle">
        <input type="checkbox" checked={showDone} onChange={(e) => onShowDone(e.target.checked)} /> Show completed
      </label>

      {groups.length === 0 ? (
        <div className="empty">
          <CalendarIcon />
          <h2>{tasks.length === 0 ? 'No tasks yet' : 'Nothing to show'}</h2>
          <p>{tasks.length === 0 ? 'Add a task to see it here.' : 'Try another filter, or tick "Show completed".'}</p>
        </div>
      ) : (
        groups.map(({ key, tasks: items }) => {
          const dotClass = key === OVERDUE ? ' overdue' : key === NO_DEADLINE ? ' none' : '';
          return (
            <section key={key} className="timeline-group">
              <span className={`timeline-dot${dotClass}`} aria-hidden="true" />
              <h2 className={`timeline-head${key === OVERDUE ? ' overdue' : ''}`}>
                {key === OVERDUE ? 'Overdue' : key === NO_DEADLINE ? 'No deadline' : dayLabel(key, todayKey, tomorrowKey)}
                {' '}<small className="muted" style={{ fontWeight: 400 }}>({items.length})</small>
              </h2>
              <ul className="timeline-tasks">
                {items.map((t) => (
                  <TimelineItem
                    key={t._id}
                    task={t}
                    person={personOf(t)}
                    overdue={key === OVERDUE}
                    projectId={projectId}
                    user={user}
                    members={members}
                    canChangeStatus={canChangeStatus(t)}
                    onOpen={onOpen}
                    onStatus={onStatus}
                    onCommentAdded={onCommentAdded}
                    onFileAdded={onFileAdded}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
