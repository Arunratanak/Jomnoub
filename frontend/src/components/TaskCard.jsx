import { useRef, useState } from 'react';
import Avatar from './Avatar';
import { AlertIcon, CalendarIcon, CheckIcon, CommentIcon, EditIcon, PaperclipIcon, PlayIcon, TrashIcon, UndoIcon } from './Icons';
import { isOverdue } from '../utils/dates';
import { ACCEPT } from '../utils/files';
import { NEXT_STEP, opensCard, statusNote } from '../utils/taskStatus';
import useTaskFileUpload from '../utils/useTaskFileUpload';

const STEP_ICONS = { todo: PlayIcon, 'in-progress': CheckIcon, done: UndoIcon };

// One card on the project board
export default function TaskCard({
  projectId, task: t, person, isMine, isOwner, canManage, canChangeStatus, draggable, justMoved,
  onOpen, onStatus, onEdit, onDelete, onSuggestion, onDragStart, onFileAdded,
}) {
  const overdue = isOverdue(t);
  const next = NEXT_STEP[t.status];
  const StepIcon = STEP_ICONS[t.status];
  const note = statusNote(t);
  const subtasks = t.subtasks || [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const inputRef = useRef(null);
  const [fileOver, setFileOver] = useState(false);
  // Any member can attach files, so this works on every card
  const { uploading, addFiles } = useTaskFileUpload(projectId, t._id, onFileAdded);

  // Files dragged in from the computer, as opposed to the card itself being dragged
  const isFileDrag = (e) => Array.from(e.dataTransfer.types).includes('Files');

  return (
    <div
      className={`task-card status-${t.status}${overdue ? ' overdue' : ''}${draggable ? ' draggable' : ''}${fileOver ? ' file-over' : ''}${justMoved ? ' just-moved' : ''}${isMine ? ' mine' : ''}`}
      draggable={draggable && !uploading}
      onClick={(e) => { if (opensCard(e)) onOpen(t); }}
      onDragStart={draggable ? (e) => onDragStart(e, t) : undefined}
      onDragOver={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setFileOver(true);
      }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFileOver(false); }}
      onDrop={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setFileOver(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <button type="button" className={`task-title-btn${t.status === 'done' ? ' done-title' : ''}`} onClick={() => onOpen(t)}>{t.title}</button>
      {t.description && <div className="task-desc">{t.description}</div>}

      {t.status === 'in-progress' && (
        <div className="status-line">
          <span className="status-badge">In progress</span>
          {note && <small className="muted">{note}</small>}
          {/* Dragging doesn't work by keyboard or on phones, so this needs its own control */}
          {canChangeStatus && (
            <button
              type="button"
              className="icon-btn icon-btn-sm status-back"
              onClick={() => onStatus(t, 'todo')}
              aria-label={`Move ${t.title} back to To do`}
              title="Back to To do"
            >
              <UndoIcon size={16} />
            </button>
          )}
        </div>
      )}
      {t.status === 'done' && (
        <div className="status-line status-line-done">
          <CheckIcon size={15} />
          <small>{note || 'Completed'}</small>
        </div>
      )}

      {t.suggestedBy && (
        <div className="suggestion">
          <div>
            <strong>{t.suggestedBy.name}</strong> suggested this {isOwner ? 'for you' : 'for the owner'}
            {!isOwner && <div className="muted"><small>Waiting for the owner to confirm.</small></div>}
          </div>
          {isOwner && (
            <div className="suggestion-actions">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => onSuggestion(t, 'accept')}>Accept</button>
              <button type="button" className="btn btn-sm" onClick={() => onSuggestion(t, 'decline')}>Decline</button>
            </div>
          )}
        </div>
      )}

      {t.deadline && (
        <span className={`due${overdue ? ' overdue' : ''}`}>
          {overdue ? <AlertIcon size={14} /> : <CalendarIcon size={14} />}
          {overdue ? 'Overdue · was due' : 'Due'} {new Date(t.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}
        </span>
      )}

      {subtasks.length > 0 && (
        <button type="button" className="subtask-summary" onClick={() => onOpen(t)} aria-label={`${doneCount} of ${subtasks.length} subtasks done. Open task`}>
          <CheckIcon size={14} />
          <span>{doneCount}/{subtasks.length}</span>
          <span className="progress-track mini"><span className="progress-fill" style={{ width: `${(doneCount / subtasks.length) * 100}%` }} /></span>
        </button>
      )}

      {(t.attachmentCount > 0 || t.commentCount > 0) && (
        <div className="card-counts">
          {t.commentCount > 0 && (
            <button type="button" className="subtask-summary" onClick={() => onOpen(t)} aria-label={`${t.commentCount} comment${t.commentCount === 1 ? '' : 's'}. Open task`}>
              <CommentIcon size={14} />
              <span>{t.commentCount} comment{t.commentCount === 1 ? '' : 's'}</span>
            </button>
          )}
          {t.attachmentCount > 0 && (
            <button type="button" className="subtask-summary" onClick={() => onOpen(t)} aria-label={`${t.attachmentCount} file${t.attachmentCount === 1 ? '' : 's'} attached. Open task`}>
              <PaperclipIcon size={14} />
              <span>{t.attachmentCount} file{t.attachmentCount === 1 ? '' : 's'}</span>
            </button>
          )}
        </div>
      )}

      <div className="task-people">
        <Avatar user={person} size={24} />
        <span>
          {person ? person.name : 'Unassigned'}
          {isMine && <span className="you-tag">You</span>}
          {t.suggestedBy && <small className="muted"> · waiting to accept</small>}
        </span>
      </div>

      {uploading && (
        <div className="upload-progress" role="status">
          <div className="upload-progress-text"><span>{uploading.name}</span><span className="muted">{uploading.percent}%</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${uploading.percent}%` }} /></div>
        </div>
      )}

      <div className="task-actions">
        {canChangeStatus && (
          <button
            type="button"
            className={`btn btn-sm next-step${t.status === 'in-progress' ? ' btn-primary' : ''}`}
            onClick={() => onStatus(t, next.status)}
            aria-label={`${next.label}: ${t.title}`}
          >
            <StepIcon size={15} /> {next.label}
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm attach-btn"
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(uploading)}
          aria-label={`Attach files to ${t.title}`}
          title="Attach files, or drag them onto this card"
        >
          <PaperclipIcon size={15} /> Attach
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          aria-label={`Choose files for ${t.title}`}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
        {canManage && (
          <>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => onEdit(t)} aria-label={`Edit ${t.title}`} title="Edit">
              <EditIcon size={18} />
            </button>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => onDelete(t)} aria-label={`Delete ${t.title}`} title="Delete">
              <TrashIcon size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
