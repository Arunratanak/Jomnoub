import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { uploadTaskFile } from '../api/attachments';
import { DownloadIcon, FileIcon, PaperclipIcon, TrashIcon } from './Icons';
import { timeAgo } from '../utils/dates';
import { confirmDialog, toast } from '../utils/feedback';
import { ACCEPT, fileProblem, formatBytes } from '../utils/files';

const isImage = (a) => a.contentType.startsWith('image/');

// A task's files: list, upload (button or drag and drop), download, delete.
// Any member can upload; the uploader, the task's creator or the owner can delete.
export default function AttachmentPanel({ projectId, task, user, isOwner, onCountChange }) {
  const [attachments, setAttachments] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [uploads, setUploads] = useState([]); // [{ id, name, percent }]
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const base = `/projects/${projectId}/tasks/${task._id}/attachments`;
  const fileUrl = (a, preview = false) => `${api.defaults.baseURL}${base}/${a._id}/download${preview ? '?preview=1' : ''}`;

  useEffect(() => {
    api
      .get(base)
      .then((res) => setAttachments(res.data.attachments))
      .catch(() => setLoadError(true));
  }, [base]);

  const uploadOne = async (file) => {
    const id = `${file.name}-${Date.now()}-${Math.random()}`;
    setUploads((list) => [...list, { id, name: file.name, percent: 0 }]);
    try {
      const attachment = await uploadTaskFile(projectId, task._id, file, (percent) => {
        setUploads((list) => list.map((u) => (u.id === id ? { ...u, percent } : u)));
      });
      setAttachments((list) => [...(list || []), attachment]);
      onCountChange(1);
    } catch (err) {
      toast(err.response?.data?.error || `Could not upload "${file.name}".`, 'error');
    } finally {
      setUploads((list) => list.filter((u) => u.id !== id));
    }
  };

  const addFiles = async (fileList) => {
    // One at a time, so several large files don't compete on a slow connection
    for (const file of Array.from(fileList)) {
      const problem = fileProblem(file);
      if (problem) toast(problem, 'error');
      else await uploadOne(file);
    }
  };

  const remove = async (a) => {
    const ok = await confirmDialog({ title: 'Delete this file?', message: `"${a.filename}" will be removed for everyone.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`${base}/${a._id}`);
      setAttachments((list) => list.filter((x) => x._id !== a._id));
      onCountChange(-1);
    } catch (err) {
      toast(err.response?.data?.error || 'Could not delete the file.', 'error');
    }
  };

  const canDelete = (a) => isOwner || task.createdBy === user._id || a.uploader?._id === user._id;

  return (
    <section
      className={`attachments${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
    >
      <div className="subtask-head">
        <h3>Attachments</h3>
        {attachments?.length > 0 && <span className="muted">{attachments.length}</span>}
      </div>

      {loadError && <p className="alert">Could not load the files.</p>}
      {!attachments && !loadError && <p className="muted">Loading files...</p>}

      {attachments?.length > 0 && (
        <ul className="attachment-list">
          {attachments.map((a) => (
            <li key={a._id} className="attachment">
              {isImage(a) ? (
                <a href={fileUrl(a, true)} target="_blank" rel="noopener noreferrer" className="attachment-thumb" aria-label={`Open ${a.filename}`}>
                  <img src={fileUrl(a, true)} alt="" loading="lazy" />
                </a>
              ) : (
                <span className="attachment-thumb" aria-hidden="true"><FileIcon size={22} /></span>
              )}
              <div className="row-main">
                <a className="attachment-name" href={fileUrl(a)} download={a.filename}>{a.filename}</a>
                <small className="muted">{formatBytes(a.size)} · {a.uploader?.name || 'Former member'} · {timeAgo(a.createdAt)}</small>
              </div>
              <a className="icon-btn icon-btn-sm" href={fileUrl(a)} download={a.filename} aria-label={`Download ${a.filename}`} title="Download"><DownloadIcon size={18} /></a>
              {canDelete(a) && (
                <button type="button" className="icon-btn icon-btn-sm" onClick={() => remove(a)} aria-label={`Delete ${a.filename}`} title="Delete"><TrashIcon size={18} /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {uploads.map((u) => (
        <div key={u.id} className="upload-progress" role="status">
          <div className="upload-progress-text"><span>{u.name}</span><span className="muted">{u.percent}%</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${u.percent}%` }} /></div>
        </div>
      ))}

      <button type="button" className="attachment-drop" onClick={() => inputRef.current?.click()}>
        <PaperclipIcon size={18} />
        <span>{dragging ? 'Drop to upload' : 'Add files'}</span>
        <small className="muted">Drag and drop, or click. Up to 10 MB each.</small>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        aria-label="Add files"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />
    </section>
  );
}
