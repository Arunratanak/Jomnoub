import { useEffect, useRef, useState } from 'react';
import { motion as Motion, useIsPresent } from 'motion/react';
import api from '../api/client';
import AttachmentPanel from './AttachmentPanel';
import Avatar from './Avatar';
import CommentList from './CommentList';
import Modal from './Modal';
import StatusStepper from './StatusStepper';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, EditIcon, TrashIcon } from './Icons';
import { STATUSES, statusNote } from '../utils/taskStatus';
import { confirmDialog, toast } from '../utils/feedback';
import { isOverdue } from '../utils/dates';

const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

function SubtaskItem({ subtask: s, canEdit, onToggle, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(s.title);
  const [note, setNote] = useState(s.note || '');

  const save = async (e) => {
    e.preventDefault();
    if (await onSave(s, { title, note })) setEditing(false);
  };

  if (editing) {
    return (
      <li className="subtask">
        <form className="form" style={{ flex: 1, gap: 8 }} onSubmit={save}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus aria-label="Subtask title" />
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Description (optional)" aria-label="Subtask description" />
          <div className="form-actions">
            <button type="button" className="btn btn-sm" onClick={() => { setEditing(false); setTitle(s.title); setNote(s.note || ''); }}>Cancel</button>
            <button type="submit" className="btn btn-sm btn-primary">Save</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="subtask">
      <input
        type="checkbox"
        className="subtask-check"
        checked={s.done}
        disabled={!canEdit}
        onChange={(e) => onToggle(s, e.target.checked)}
        aria-label={`Mark "${s.title}" as ${s.done ? 'not done' : 'done'}`}
      />
      <div className="row-main">
        <div className={s.done ? 'done-title' : ''}>{s.title}</div>
        {s.note && <div className="subtask-note">{s.note}</div>}
      </div>
      {canEdit && (
        <>
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditing(true)} aria-label={`Edit ${s.title}`} title="Edit"><EditIcon size={16} /></button>
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => onDelete(s)} aria-label={`Delete ${s.title}`} title="Delete"><TrashIcon size={16} /></button>
        </>
      )}
    </li>
  );
}

// What can change between tasks: kept separate so moving to another task starts it fresh
function TaskBody({ projectId, task: t, person, user, isOwner, members, highlightCommentId, canEditSubtasks, onUpdated, onAttachmentCount, onCommentCount }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const base = `/projects/${projectId}/tasks/${t._id}/subtasks`;
  const subtasks = t.subtasks || [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const percent = subtasks.length ? Math.round((doneCount / subtasks.length) * 100) : 0;
  const overdue = isOverdue(t);

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post(base, { title, ...(note.trim() ? { note } : {}) });
      onUpdated(res.data.task);
      setTitle('');
      setNote('');
    } catch (err) {
      toast(errorMessage(err, 'Could not add the subtask.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (s, updates) => {
    try {
      const res = await api.patch(`${base}/${s._id}`, updates);
      onUpdated(res.data.task);
      return true;
    } catch (err) {
      toast(errorMessage(err, 'Could not update the subtask.'), 'error');
      return false;
    }
  };

  const remove = async (s) => {
    const ok = await confirmDialog({ title: 'Delete subtask?', message: `"${s.title}" will be removed.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      const res = await api.delete(`${base}/${s._id}`);
      onUpdated(res.data.task);
    } catch (err) {
      toast(errorMessage(err, 'Could not delete the subtask.'), 'error');
    }
  };

  return (
    <>
      <div className="detail-meta">
        {statusNote(t) && <small className="muted">{statusNote(t)}</small>}
        <span className="task-people"><Avatar user={person} size={22} /> {person ? person.name : 'Unassigned'}{t.suggestedBy && <small className="muted"> · waiting to accept</small>}</span>
        {t.deadline && (
          <span className={`due${overdue ? ' overdue' : ''}`}>
            {overdue ? 'Overdue · was due' : 'Due'} {new Date(t.deadline).toLocaleDateString(undefined, { timeZone: 'UTC' })}
          </span>
        )}
      </div>
      {t.description && <p className="detail-desc">{t.description}</p>}

      <div className="subtask-head">
        <h3>Subtasks</h3>
        {subtasks.length > 0 && <span className="muted">{doneCount} of {subtasks.length} done</span>}
      </div>
      {subtasks.length > 0 && (
        <div className="progress-track" style={{ marginBottom: 8 }}><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
      )}

      {subtasks.length === 0 ? (
        <p className="muted" style={{ padding: '8px 0' }}>
          {canEditSubtasks ? 'Break this task into smaller steps.' : 'No subtasks yet.'}
        </p>
      ) : (
        <ul>
          {subtasks.map((s) => (
            <SubtaskItem
              key={s._id}
              subtask={s}
              canEdit={canEditSubtasks}
              onToggle={(sub, done) => patch(sub, { done })}
              onSave={patch}
              onDelete={remove}
            />
          ))}
        </ul>
      )}

      {canEditSubtasks && (
        <form className="subtask-add" onSubmit={add}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a subtask" aria-label="New subtask title" maxLength={200} required />
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Description (optional)" aria-label="New subtask description" maxLength={1000} />
          <div className="subtask-add-actions">
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add subtask'}</button>
          </div>
        </form>
      )}
      {!canEditSubtasks && (
        <p className="muted" style={{ marginTop: 8 }}><small>Only the owner or the person whose task this is can change subtasks.</small></p>
      )}

      <AttachmentPanel projectId={projectId} task={t} user={user} isOwner={isOwner} onCountChange={onAttachmentCount} />

      <CommentList
        projectId={projectId}
        task={t}
        user={user}
        isOwner={isOwner}
        members={members}
        highlightId={highlightCommentId}
        onCountChange={onCommentCount}
      />
    </>
  );
}

// Full view of one task: where it stands, how to move it, and the way to the next one
export default function TaskDetail({ task: t, siblings, canChangeStatus, onStatus, onNavigate, onClose, ...body }) {
  const isPresent = useIsPresent();
  const shell = useRef(null);
  const [direction, setDirection] = useState(0);
  const index = siblings.findIndex((s) => s._id === t._id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  const columnLabel = STATUSES.find((s) => s.value === t.status)?.label;

  const go = (task, towards) => {
    setDirection(towards);
    onNavigate(task);
    shell.current?.closest('.modal-backdrop')?.scrollTo({ top: 0 });
  };

  // Left and right move between tasks, unless the person is typing or a dialog is on top
  useEffect(() => {
    if (!isPresent) return undefined;
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('.confirm')) return;
      const target = e.key === 'ArrowLeft' ? previous : next;
      if (!target) return;
      e.preventDefault();
      setDirection(e.key === 'ArrowLeft' ? -1 : 1);
      onNavigate(target);
      shell.current?.closest('.modal-backdrop')?.scrollTo({ top: 0 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPresent, previous, next, onNavigate]);

  return (
    <Modal title={t.title} onClose={onClose} wide>
      <div ref={shell} className="detail-nav">
        {siblings.length > 1 && index >= 0 ? (
          <div className="detail-nav-steps">
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => go(previous, -1)} disabled={!previous} aria-label="Previous task" title="Previous task (left arrow)">
              <ChevronLeftIcon size={18} />
            </button>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => go(next, 1)} disabled={!next} aria-label="Next task" title="Next task (right arrow)">
              <ChevronRightIcon size={18} />
            </button>
            <small className="muted">{index + 1} of {siblings.length} in {columnLabel}</small>
          </div>
        ) : <span />}
        <button type="button" className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Close task" title="Close (Esc)">
          <CloseIcon size={18} />
        </button>
      </div>

      <StatusStepper status={t.status} canChange={canChangeStatus} onChange={(status) => onStatus(t, status)} />
      {!canChangeStatus && (
        <p className="muted stepper-hint">
          <small>{t.suggestedBy ? 'The owner has to accept this task before it can be moved.' : 'Only the owner or the person whose task this is can move it.'}</small>
        </p>
      )}

      <Motion.div key={t._id} initial={{ opacity: 0, x: direction * 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
        <TaskBody task={t} {...body} />
      </Motion.div>

      <div className="form-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
