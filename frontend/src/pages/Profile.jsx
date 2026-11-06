import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Avatar, { ProjectMark } from '../components/Avatar';
import Loading from '../components/Loading';
import { useAuth } from '../context/AuthContext';
import { confirmDialog, toast } from '../utils/feedback';
import { makeProfilePhoto, PHOTO_ACCEPT } from '../utils/profilePhoto';
import useTitle from '../utils/useTitle';

const errorMessage = (err, fallback) => err.response?.data?.error || fallback;

function signInLabel(account) {
  if (account.signInWithGoogle && account.signInWithPassword) return 'Google or email and password';
  return account.signInWithGoogle ? 'Google' : 'Email and password';
}

const joinedDate = (value) => new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

function ProjectRow({ project: p }) {
  return (
    <li>
      <Link to={`/projects/${p.id}`} className="row profile-project">
        <ProjectMark id={p.id} name={p.name} size={36} radius={8} />
        <span className="row-main">
          <strong className="profile-project-name">{p.name}</strong>
          <small className="muted">
            {p.open} open · {p.done} done
            {p.overdue > 0 && <span className="due overdue"> · {p.overdue} overdue</span>}
          </small>
        </span>
        <span className={`role-badge${p.role === 'owner' ? ' owner' : ''}`}>{p.role === 'owner' ? 'Owner' : 'Member'}</span>
      </Link>
    </li>
  );
}

export default function Profile() {
  const { user, setSessionUser } = useAuth();
  const [account, setAccount] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [nameDraft, setNameDraft] = useState(null); // null until edited
  const [savingName, setSavingName] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef(null);
  useTitle('Your profile');

  useEffect(() => {
    api
      .get('/profile')
      .then((res) => {
        setAccount(res.data.account);
        setSummary(res.data.summary);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  const name = nameDraft ?? user.name;
  const nameChanged = name.trim() !== '' && name.trim() !== user.name;

  const applyResult = (res) => {
    setSessionUser(res.data.user);
    setAccount(res.data.account);
  };

  const saveName = async (e) => {
    e.preventDefault();
    if (!nameChanged) return;
    setSavingName(true);
    try {
      applyResult(await api.patch('/profile', { name: name.trim() }));
      setNameDraft(null);
      toast('Name saved.');
    } catch (err) {
      toast(errorMessage(err, 'Could not save your name.'), 'error');
    } finally {
      setSavingName(false);
    }
  };

  const changePhoto = async (run, done, fallback) => {
    setPhotoBusy(true);
    try {
      applyResult(await run());
      toast(done);
    } catch (err) {
      // Our own messages about the chosen file are worth showing; a raw network error isn't
      toast(err.isAxiosError ? errorMessage(err, fallback) : err.message, 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const onFileChosen = (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // so choosing the same file again still works
    if (!file) return;
    changePhoto(
      async () => api.post('/profile/photo', await makeProfilePhoto(file), { headers: { 'Content-Type': 'image/jpeg' } }),
      'Photo updated.',
      'Could not upload your photo.',
    );
  };

  const removePhoto = async () => {
    const ok = await confirmDialog({
      title: 'Remove your photo?',
      message: 'Your teammates will see your initial instead.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) changePhoto(() => api.delete('/profile/photo'), 'Photo removed.', 'Could not remove your photo.');
  };

  const useGooglePhoto = () => changePhoto(() => api.post('/profile/photo/google'), 'Using your Google photo.', 'Could not change your photo.');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your profile</h1>
          <p className="muted">Your teammates see this name and photo in the projects you share.</p>
        </div>
      </div>

      <div className="two-col">
        <div className="stack">
          <section className="card profile-card" aria-label="Photo">
            <Avatar user={user} size={96} />
            <div className="profile-photo-actions">
              <input ref={fileInput} type="file" accept={PHOTO_ACCEPT} className="sr-only" onChange={onFileChosen} tabIndex={-1} aria-label="Choose a photo" />
              <button type="button" className="btn btn-sm" onClick={() => fileInput.current.click()} disabled={photoBusy}>
                {photoBusy ? 'Saving...' : 'Change photo'}
              </button>
              {account?.hasPhoto && <button type="button" className="btn btn-sm" onClick={removePhoto} disabled={photoBusy}>Remove photo</button>}
              {account?.canUseGooglePhoto && <button type="button" className="btn btn-sm" onClick={useGooglePhoto} disabled={photoBusy}>Use Google photo</button>}
              <small className="muted profile-photo-hint">JPG, PNG or WebP. It's cropped to a square.</small>
            </div>
          </section>

          <form className="card form" onSubmit={saveName}>
            <h2>Your name</h2>
            <label className="field">
              <span>Name</span>
              <input className="input" value={name} onChange={(e) => setNameDraft(e.target.value)} maxLength={60} required />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={!nameChanged || savingName}>{savingName ? 'Saving...' : 'Save name'}</button>
            </div>
          </form>

          <section className="card">
            <h2 style={{ marginBottom: 8 }}>Account</h2>
            <dl className="profile-details">
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Email status</dt><dd>{user.emailVerified ? 'Verified' : 'Not verified yet'}</dd></div>
              {account && <div><dt>Sign-in</dt><dd>{signInLabel(account)}</dd></div>}
              {user.createdAt && <div><dt>Joined</dt><dd>{joinedDate(user.createdAt)}</dd></div>}
            </dl>
          </section>
        </div>

        <div className="stack">
          {loadFailed && <p className="alert">Could not load your work summary. Refresh the page to try again.</p>}
          {!loadFailed && !summary && <Loading />}
          {summary && (
            <>
              <section className="card">
                <div className="profile-section-head">
                  <h2>Your tasks</h2>
                  <Link to="/my-tasks">View my tasks</Link>
                </div>
                <div className="tiles profile-tiles">
                  <div className="tile"><div className="tile-value">{summary.todo}</div><div className="tile-label">To do</div></div>
                  <div className="tile"><div className="tile-value">{summary.inProgress}</div><div className="tile-label">In progress</div></div>
                  <div className="tile"><div className="tile-value">{summary.done}</div><div className="tile-label">Completed</div></div>
                  <div className={`tile${summary.overdue ? ' tile-alert' : ''}`}><div className="tile-value">{summary.overdue}</div><div className="tile-label">Overdue</div></div>
                </div>
              </section>

              <section className="card">
                <h2 style={{ marginBottom: 8 }}>Your projects ({summary.projectCount})</h2>
                {summary.projects.length === 0 ? (
                  <p className="muted">You're not in any projects yet. <Link to="/dashboard">Go to Home</Link> to create one.</p>
                ) : (
                  <ul>{summary.projects.map((p) => <ProjectRow key={p.id} project={p} />)}</ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
