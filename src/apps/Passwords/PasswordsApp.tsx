import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { uid } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { decryptVault, encryptVault, generatePassword, passwordStrength, type EncryptedBlob } from '../../os/security';
import { dbGet, dbSet, dbDel } from '../../os/db';
import type { VaultEntry } from '../../os/types';
import { errorBuzz, successChime } from '../../os/audio';

const VAULT_KEY = 'owl:vault:blob';

/**
 * Password Keeper. The vault is encrypted with AES-GCM using a key derived
 * from the master password with PBKDF2. Only ciphertext is written to
 * IndexedDB; the master password is never stored.
 */
export default function PasswordsApp() {
  const [stage, setStage] = useState<'loading' | 'setup' | 'locked' | 'open'>('loading');
  const [master, setMaster] = useState('');
  const [master2, setMaster2] = useState('');
  const [pass, setPass] = useState('');
  const [blob, setBlob] = useState<EncryptedBlob | null>(null);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [editing, setEditing] = useState<VaultEntry | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const toast = useStore((s) => s.toast);
  const showDialog = useStore((s) => s.showDialog);
  const clearTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    void dbGet<EncryptedBlob | null>(VAULT_KEY, null).then((stored) => {
      setBlob(stored || null);
      setStage(stored ? 'locked' : 'setup');
    });
    return () => window.clearTimeout(clearTimer.current);
  }, []);

  const persist = async (list: VaultEntry[], password = master) => {
    const encrypted = await encryptVault(password, JSON.stringify(list));
    await dbSet(VAULT_KEY, encrypted);
    setBlob(encrypted);
    setEntries(list);
  };

  const createVault = async () => {
    if (master.length < 8) { setError('Use at least 8 characters'); return; }
    if (master !== master2) { setError('Passwords do not match'); return; }
    setBusy(true);
    try {
      await persist([], master);
      setStage('open');
      setTimeout(() => { setMaster(''); setMaster2(''); }, 400);
      successChime();
      toast('Vault created — the key never leaves this device');
    } catch {
      setError('Could not create the vault');
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    if (!blob) return;
    setBusy(true);
    const plain = await decryptVault(pass, blob);
    setBusy(false);
    if (!plain) {
      errorBuzz();
      setError('Wrong master password');
      setPass('');
      return;
    }
    try {
      const parsed = JSON.parse(plain) as VaultEntry[];
      setEntries(parsed);
      setMaster(pass);
      setPass('');
      setError('');
      setStage('open');
      successChime(0.5);
    } catch {
      setError('Vault data is corrupted');
    }
  };

  const saveEntry = async (entry: VaultEntry) => {
    const exists = entries.some((e) => e.id === entry.id);
    const next = exists ? entries.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...entries];
    await persist(next);
    setEditing(null);
    toast(exists ? 'Entry updated' : 'Entry added');
  };

  const removeEntry = async (id: string) => {
    const next = entries.filter((e) => e.id !== id);
    await persist(next);
    toast('Entry deleted');
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied — clipboard clears in 30s');
      window.clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText().catch(() => '');
          if (current === text) await navigator.clipboard.writeText('');
        } catch { /* clipboard read may be blocked */ }
      }, 30000);
    } catch {
      toast('Clipboard is blocked in this browser');
    }
  };

  if (stage === 'loading') return <AppFrame title="Password Keeper" icon="lock"><div className="empty"><div className="spinner" /></div></AppFrame>;

  if (stage === 'setup') {
    return (
      <AppFrame title="Password Keeper" icon="lock">
        <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Icon name="shield" size={26} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Create your vault</div>
              <div className="tiny">AES-256-GCM · key derived with PBKDF2 (120k iterations)</div>
            </div>
          </div>
          <div className="fieldLabel">Master password (8+ characters)</div>
          <Field value={master} onChange={setMaster} kind="password" placeholder="Master password" autoFocus maxLength={64} />
          <Field value={master2} onChange={setMaster2} kind="password" placeholder="Repeat" maxLength={64} />
          {master && (
            <div className="tiny">
              Strength: <b>{passwordStrength(master).label}</b>
            </div>
          )}
          {error && <div className="tiny" style={{ color: 'var(--red)' }}>{error}</div>}
          <div className="card tiny" style={{ lineHeight: 1.5 }}>
            There is no recovery: the master password is what decrypts the vault. If you forget it,
            delete the vault and start again. Nothing is sent anywhere.
          </div>
          <button className="btn primary" onClick={() => void createVault()} disabled={busy}>
            {busy ? 'Creating…' : 'Create encrypted vault'}
          </button>
        </div>
      </AppFrame>
    );
  }

  if (stage === 'locked') {
    return (
      <AppFrame title="Password Keeper" icon="lock">
        <div className="appBody pad" style={{ display: 'grid', gap: 5, placeItems: 'center', paddingTop: 18 }}>
          <Icon name="lock" size={30} />
          <div style={{ fontSize: 12, fontWeight: 700 }}>Vault locked</div>
          <div className="tiny">{blob ? `Encrypted at ${new Date().toLocaleDateString()}` : ''}</div>
          <div style={{ width: 190 }}>
            <Field value={pass} onChange={setPass} kind="password" placeholder="Master password" autoFocus maxLength={64} onSubmit={() => void unlock()} />
          </div>
          {error && <div className="tiny" style={{ color: 'var(--red)' }}>{error}</div>}
          <button className="btn primary" onClick={() => void unlock()} disabled={busy}>{busy ? 'Unlocking…' : 'Unlock'}</button>
          <button
            className="btn"
            style={{ fontSize: 9 }}
            onClick={() => showDialog({
              title: 'Delete the vault?',
              body: 'All saved passwords will be permanently destroyed on this device.',
              confirmLabel: 'Delete vault', danger: true,
              onConfirm: async () => { await dbDel(VAULT_KEY); setBlob(null); setStage('setup'); setEntries([]); toast('Vault deleted'); },
            })}
          >
            I forgot the master password
          </button>
        </div>
      </AppFrame>
    );
  }

  if (editing) {
    return <EntryEditor entry={editing} onSave={(e) => void saveEntry(e)} onCancel={() => setEditing(null)} />;
  }

  const filtered = entries.filter((e) => !query || `${e.title} ${e.username} ${e.website}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <AppFrame
      title="Password Keeper"
      icon="lock"
      actions={
        <>
          <button className="hbtn" onClick={() => setEditing({ id: uid('vault'), title: '', username: '', password: generatePassword(16), website: '', notes: '', updatedAt: Date.now() })}>
            <Icon name="plus" size={9} /> New
          </button>
          <button className="hbtn" onClick={() => { setStage('locked'); setEntries([]); setMaster(''); toast('Vault locked'); }}>Lock</button>
        </>
      }
      menu={[
        { id: 'new', label: 'New entry', icon: 'plus', run: () => setEditing({ id: uid('vault'), title: '', username: '', password: generatePassword(16), website: '', notes: '', updatedAt: Date.now() }) },
        { id: 'lock', label: 'Lock vault', icon: 'lock', run: () => { setStage('locked'); setEntries([]); setMaster(''); toast('Vault locked'); } },
        { id: 'reveal', label: 'Hide all passwords', icon: 'eyeOff', run: () => setRevealed(null) },
        { id: 'generator', label: 'Copy a fresh password', icon: 'key', run: () => { const pw = generatePassword(20); void copy(pw); } },
      ]}
    >
      <div style={{ padding: 5 }}>
        <Field value={query} onChange={setQuery} placeholder="Search entries" />
      </div>
      <div className="appBody">
        <div className="owlSection">{entries.length} entries · encrypted on device</div>
        {filtered.length === 0 && (
          <div className="empty"><div className="big">🔐</div><div>No entries yet.</div>
            <button className="btn primary" onClick={() => setEditing({ id: uid('vault'), title: '', username: '', password: generatePassword(16), website: '', notes: '', updatedAt: Date.now() })}>Add entry</button>
          </div>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="rowBtn" style={{ cursor: 'default', alignItems: 'flex-start' }}>
            <Icon name="key" size={12} style={{ marginTop: 2 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{e.title}</span>
              <span className="tiny">{e.username}{e.website ? ` · ${e.website}` : ''}</span>
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.06em' }}>
                {revealed === e.id ? e.password : '•'.repeat(Math.min(16, e.password.length))}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 2 }}>
              <button className="iconBtn" onClick={() => setRevealed(revealed === e.id ? null : e.id)} aria-label="Show password">
                <Icon name={revealed === e.id ? 'eyeOff' : 'eye'} size={9} />
              </button>
              <button className="iconBtn" onClick={() => void copy(e.password)} aria-label="Copy password">⧉</button>
              <button className="iconBtn" onClick={() => setEditing(e)} aria-label="Edit entry">✎</button>
              <button className="iconBtn" onClick={() => showDialog({
                title: 'Delete entry?', body: e.title, confirmLabel: 'Delete', danger: true, onConfirm: () => void removeEntry(e.id),
              })} aria-label="Delete entry">✕</button>
            </div>
          </div>
        ))}
      </div>
    </AppFrame>
  );
}

function EntryEditor({ entry, onSave, onCancel }: { entry: VaultEntry; onSave: (e: VaultEntry) => void; onCancel: () => void }) {
  const [e, setE] = useState(entry);
  const [show, setShow] = useState(true);
  const [len, setLen] = useState(16);
  const toast = useStore((s) => s.toast);
  const strength = passwordStrength(e.password);
  return (
    <AppFrame title={entry.title ? 'Edit entry' : 'New entry'} icon="key" actions={<button className="hbtn" onClick={onCancel}>Cancel</button>}>
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div className="fieldLabel">Title</div>
        <Field value={e.title} onChange={(v) => setE({ ...e, title: v })} placeholder="e.g. Bank" autoFocus maxLength={60} />
        <div className="fieldLabel">Username</div>
        <Field value={e.username} onChange={(v) => setE({ ...e, username: v })} placeholder="user@example.com" maxLength={80} />
        <div className="fieldLabel">Password</div>
        <Field value={show ? e.password : '•'.repeat(e.password.length)} onChange={(v) => setE({ ...e, password: v })} kind={show ? 'text' : 'password'} placeholder="Password" maxLength={120} />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="chip" onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</button>
          <span className="tiny">Strength:</span>
          <div className="progress" style={{ flex: 1, height: 3 }}><i style={{ width: `${(strength.score / 5) * 100}%`, background: strength.score >= 4 ? 'var(--green)' : strength.score >= 2 ? 'var(--hl)' : 'var(--red)' }} /></div>
          <span className="tiny">{strength.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="range" min={8} max={32} value={len} onChange={(ev) => setLen(Number(ev.target.value))} style={{ flex: 1, accentColor: 'var(--hl)' }} inputMode="none" aria-label="Generator length" />
          <button className="btn" onClick={() => { const p = generatePassword(len); setE({ ...e, password: p }); toast('Password generated'); }}>Generate {len}</button>
        </div>
        <div className="fieldLabel">Website</div>
        <Field value={e.website} onChange={(v) => setE({ ...e, website: v })} placeholder="example.com" maxLength={100} />
        <div className="fieldLabel">Notes</div>
        <Field value={e.notes} onChange={(v) => setE({ ...e, notes: v })} placeholder="Notes" multiline maxLength={600} />
        <div className="btnRow" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={() => {
            if (!e.title.trim()) { toast('Add a title'); return; }
            onSave({ ...e, title: e.title.trim(), updatedAt: Date.now() });
          }}>Save to vault</button>
        </div>
      </div>
    </AppFrame>
  );
}
