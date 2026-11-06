import Avatar from './Avatar';
import { AlertIcon, CalendarIcon, CheckIcon, EditIcon, PaperclipIcon, TrashIcon } from './Icons';
import { isOverdue } from '../utils/dates';
import { STATUSES } from '../utils/taskStatus';

// One card on the project board
export default function TaskCard({
  task: t, isOwner, canManage, canChangeStatus, draggable,
  onOpen, onStatus, onEdit, onDelete, onSuggestion, onDragStart,
}) {
  const overdue = isOverdue(t);
  const subtasks = t.subtasks || [];
  const doneCount = subtasks.filter((s) => s.done).length;

  return (
    <div
      className={`task-card${overdue ? ' overdue' : ''}${draggable ? ' draggable' : ''}`}
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart(e, t) : undefined}
    >
      <button type="button" className="task-title-btn" onClick={() => onOpen(t)}>{t.title}</button>
      {t.description && <div className="task-desc">{t.description}</div>}

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

      {t.attachmentCount > 0 && (
        <button type="button" className="subtask-summary" onClick={() => onOpen(t)} aria-label={`${t.attachmentCount} file${t.attachmentCount === 1 ? '' : 's'} attached. Open task`}>
          <PaperclipIcon size={14} />
          <span>{t.attachmentCount} file{t.attachmentCount === 1 ? '' : 's'}</span>
        </button>
      )}

      <div className="task-people">
        <Avatar user={t.assignee} size={24} />
        <span>{t.assignee ? t.assignee.name : 'Unassigned'}</span>
      </div>

      {(canManage || canChangeStatus) && (
        <div className="task-actions">
          <select
            className="select select-sm"
            value={t.status}
            onChange={(e) => onStatus(t, e.target.value)}
            aria-label={`Status of ${t.title}`}
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
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
      )}
    </div>
  );
}
