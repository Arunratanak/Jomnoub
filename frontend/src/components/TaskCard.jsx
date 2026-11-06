import { useRef, useState } from 'react';
import { uploadTaskFile } from '../api/attachments';
import Avatar from './Avatar';
import { AlertIcon, CalendarIcon, CheckIcon, EditIcon, PaperclipIcon, TrashIcon } from './Icons';
import { isOverdue } from '../utils/dates';
import { toast } from '../utils/feedback';
import { ACCEPT, fileProblem } from '../utils/files';
import { STATUSES } from '../utils/taskStatus';

// One card on the project board
export default function TaskCard({
  projectId, task: t, isOwner, canManage, canChangeStatus, draggable,
  onOpen, onStatus, onEdit, onDelete, onSuggestion, onDragStart, onFileAdded,
}) {
  const overdue = isOverdue(t);
  const subtasks = t.subtasks || [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(null); // { name, percent }
  const [fileOver, setFileOver] = useState(false);

  // Any member can attach files, so this works on every card. One file at a time,
  // so several large files don't compete on a slow connection.
  const addFiles = async (fileList) => {
    for (const file of Array.from(fileList)) {
      const problem = fileProblem(file);
      if (problem) {
        toast(problem, 'error');
        continue;
      }
      setUploading({ name: file.name, percent: 0 });
      try {
        await uploadTaskFile(projectId, t._id, file, (percent) => setUploading({ name: file.name, percent }));
        onFileAdded(t._id);
        toast(`"${file.name}" attached.`);
      } catch (err) {
        toast(err.response?.data?.error || `Could not upload "${file.name}".`, 'error');
      }
    }
    setUploading(null);
  };

  // Files dragged in from the computer, as opposed to the card itself being dragged
  const isFileDrag = (e) => Array.from(e.dataTransfer.types).includes('Files');

  return (
    <div
      className={`task-card${overdue ? ' overdue' : ''}${draggable ? ' draggable' : ''}${fileOver ? ' file-over' : ''}`}
      draggable={draggable && !uploading}
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

      {uploading && (
        <div className="upload-progress" role="status">
          <div className="upload-progress-text"><span>{uploading.name}</span><span className="muted">{uploading.percent}%</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${uploading.percent}%` }} /></div>
        </div>
      )}

      <div className="task-actions">
        {(canManage || canChangeStatus) && (
          <select
            className="select select-sm"
            value={t.status}
            onChange={(e) => onStatus(t, e.target.value)}
            aria-label={`Status of ${t.title}`}
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
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
