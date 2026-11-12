import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, formatBytes, downloadBlob } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { DB_KEYS, dbKeys, dbEstimate } from '../../os/db';
import type { PhotoItem, VoiceNote } from '../../os/types';
import { isAudio, isImage, isText, isVideo } from '../../os/media';
import { deleteLocalFile, listSavedFiles, saveLocalFile, type SavedFile } from '../../os/savedFiles';

interface Entry {
  name: string;
  kind: 'file' | 'dir';
  size: number;
  modified: number;
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
  file?: File;
}

const supportsFs = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export default function FilesApp() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rootName, setRootName] = useState<string | null>(null);
  const [dirStack, setDirStack] = useState<{ name: string; handle: FileSystemDirectoryHandle }[]>([]);
  const [sort, setSort] = useState<'name' | 'size' | 'date'>('name');
  const [grid, setGrid] = useState(false);
  const [preview, setPreview] = useState<{ name: string; url: string; type: string; text?: string } | null>(null);
  const [info, setInfo] = useState<Entry | null>(null);
  const [tab, setTab] = useState<'device' | 'saved' | 'internal'>('device');
  const [estimates, setEstimates] = useState({ usage: 0, quota: 0 });
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [photos] = useCollection<PhotoItem>(DB_KEYS.photos);
  const [voice] = useCollection<VoiceNote>(DB_KEYS.voiceNotes);
  const toast = useStore((s) => s.toast);
  const setAppMenu = useStore((s) => s.setAppMenu);

  const refreshSaved = async () => {
    try { setSavedFiles(await listSavedFiles()); }
    catch { toast('Could not load saved files'); }
  };

  useEffect(() => {
    void dbEstimate().then(setEstimates);
    void refreshSaved();
    setAppMenu({
      title: 'File Manager',
      actions: [
        { id: 'dir', label: 'Open a folder', icon: 'folder', run: () => void pickDirectory() },
        { id: 'files', label: 'Pick files to save', icon: 'list', run: () => void pickFilesFallback() },
        { id: 'saved', label: 'My saved files', icon: 'database', run: () => setTab('saved') },
        { id: 'internal', label: 'Show app storage', icon: 'battery', run: () => setTab('internal') },
      ],
    });
    return () => setAppMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToOwl = async (file: File) => {
    try {
      await saveLocalFile(file);
      await refreshSaved();
      const storage = navigator.storage as StorageManager & { persist?: () => Promise<boolean> };
      if (storage.persist) void storage.persist().catch(() => false);
      toast('Saved in OWL on this device');
      setInfo(null);
      setTab('saved');
    } catch (error) {
      console.error('[OWL] file save failed', error);
      toast('Could not save this file. Check available device storage.');
    }
  };

  const removeSaved = async (file: SavedFile) => {
    const confirmed = window.confirm(`Delete "${file.name}" from OWL saved files? This will not delete the original file on your phone.`);
    if (!confirmed) return;
    try {
      await deleteLocalFile(file.id);
      await refreshSaved();
      toast('Saved copy deleted from OWL');
    } catch {
      toast('Could not delete this saved copy');
    }
  };

  const loadDir = async (handle: FileSystemDirectoryHandle) => {
    const list: Entry[] = [];
    try {
      for await (const [name, child] of (handle as any).entries()) {
        if (child.kind === 'directory') list.push({ name, kind: 'dir', size: 0, modified: 0, handle: child });
        else {
          const file = await (child as FileSystemFileHandle).getFile();
          list.push({ name, kind: 'file', size: file.size, modified: file.lastModified, handle: child, file });
        }
      }
      setEntries(list);
    } catch { toast('Could not read that folder'); }
  };

  const pickDirectory = async () => {
    const anyWin = window as any;
    if (!anyWin.showDirectoryPicker) {
      toast('Folder picking is not available here — use Pick files instead');
      void pickFilesFallback();
      return;
    }
    try {
      const handle = await anyWin.showDirectoryPicker({ mode: 'read' });
      setRootName(handle.name);
      setDirStack([{ name: handle.name, handle }]);
      setTab('device');
      await loadDir(handle);
    } catch { /* user cancelled */ }
  };

  const pickFilesFallback = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      setEntries(files.map((file) => ({ name: file.name, kind: 'file', size: file.size, modified: file.lastModified, file })));
      setRootName('Selected files');
      setDirStack([]);
      setTab('device');
    };
    input.click();
  };

  const openFile = async (file: File) => {
    if (isImage(file) || isVideo(file) || isAudio(file) || /\.pdf$/i.test(file.name)) {
      const url = URL.createObjectURL(file);
      setPreview({ name: file.name, url, type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : '') });
    } else if (isText(file) || /json|md|csv|xml/i.test(file.name)) {
      const text = await file.text();
      setPreview({ name: file.name, url: '', type: file.type || 'text/plain', text: text.slice(0, 8000) });
    } else {
      toast('Preview is not available for this file type. You can download it.');
    }
  };

  const openEntry = async (entry: Entry) => {
    if (entry.kind === 'dir' && entry.handle) {
      setDirStack((prev) => [...prev, { name: entry.name, handle: entry.handle as FileSystemDirectoryHandle }]);
      await loadDir(entry.handle as FileSystemDirectoryHandle);
      return;
    }
    const file = entry.file || (entry.handle ? await (entry.handle as FileSystemFileHandle).getFile().catch(() => null) : null);
    if (!file) { toast('Could not read that file'); return; }
    await openFile(file);
  };

  const goUp = () => {
    if (dirStack.length <= 1) return;
    const next = dirStack.slice(0, -1);
    setDirStack(next);
    void loadDir(next[next.length - 1].handle);
  };

  const sorted = useMemo(() => [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    if (sort === 'size') return b.size - a.size;
    if (sort === 'date') return b.modified - a.modified;
    return a.name.localeCompare(b.name);
  }), [entries, sort]);

  const [internalKeys, setInternalKeys] = useState<string[]>([]);
  useEffect(() => {
    if (tab === 'internal') void dbKeys().then(setInternalKeys);
  }, [tab]);

  return (
    <AppFrame title="File Manager" icon="folder" actions={
      <>
        <button className="hbtn" onClick={() => setTab(tab === 'device' ? 'saved' : 'device')}>{tab === 'device' ? 'Saved files' : 'Device'}</button>
        {tab === 'device' && <button className="hbtn" onClick={() => void pickDirectory()}>Folder</button>}
        {tab === 'saved' && <button className="hbtn" onClick={pickFilesFallback}>＋ Save files</button>}
      </>
    }>
      <div className="owlTabBar">
        <button className={`owlTab ${tab === 'device' ? 'active' : ''}`} onClick={() => setTab('device')}>This device</button>
        <button className={`owlTab ${tab === 'saved' ? 'active' : ''}`} onClick={() => setTab('saved')}>My saved files ({savedFiles.length})</button>
        <button className={`owlTab ${tab === 'internal' ? 'active' : ''}`} onClick={() => setTab('internal')}>App storage</button>
      </div>

      {tab === 'device' ? (
        <>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', padding: '3px 5px', borderBottom: '1px solid var(--line)' }}>
            {dirStack.length > 0 && <button className="iconBtn" onClick={goUp} aria-label="Up one level" style={{ width: 17, height: 17 }}>↑</button>}
            <span className="tiny" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dirStack.length ? dirStack.map((d) => d.name).join(' / ') : rootName || 'No folder opened'}</span>
            <button className={`chip ${sort === 'name' ? 'on' : ''}`} onClick={() => setSort('name')}>A–Z</button>
            <button className={`chip ${sort === 'size' ? 'on' : ''}`} onClick={() => setSort('size')}>Size</button>
            <button className={`chip ${sort === 'date' ? 'on' : ''}`} onClick={() => setSort('date')}>Date</button>
            <button className="iconBtn" onClick={() => setGrid((value) => !value)} aria-label="Toggle view" style={{ width: 17, height: 17 }}><Icon name={grid ? 'list' : 'grid'} size={8} /></button>
          </div>
          <div className="appBody">
            {entries.length === 0 && <div className="empty">
              <div className="big">📁</div><div><b>Browse your phone files</b></div>
              <div className="tiny" style={{ maxWidth: 310, lineHeight: 1.5 }}>{supportsFs ? 'Open a folder, or pick individual files to save a permanent copy inside OWL.' : 'Pick files from your phone. Choose which ones to keep in OWL.'}</div>
              <div className="btnRow" style={{ justifyContent: 'center' }}>
                <button className="btn primary" onClick={() => void pickDirectory()}>Open folder</button>
                <button className="btn" onClick={pickFilesFallback}>Pick files</button>
              </div>
              <div className="tiny" style={{ maxWidth: 300, opacity: 0.8 }}>Picking a file does not save or upload it. Use Save in OWL to keep a local copy.</div>
            </div>}
            {entries.length > 0 && !grid && sorted.map((entry, index) => (
              <div key={`${entry.name}-${index}`} className="rowBtn" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <button onClick={() => void openEntry(entry)} style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1, border: 0, background: 'transparent', color: 'inherit', textAlign: 'left' }}>
                  <Icon name={entry.kind === 'dir' ? 'folder' : iconFor(entry.name)} size={12} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                  <span className="meta">{entry.kind === 'dir' ? 'Folder' : formatBytes(entry.size)}</span>
                </button>
                {entry.kind === 'file' && entry.file && <button className="chip" onClick={() => setInfo(entry)}>Save</button>}
              </div>
            ))}
            {entries.length > 0 && grid && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, padding: 4 }}>
              {sorted.map((entry, index) => <button key={`${entry.name}-${index}`} className="dockItem" onClick={() => void openEntry(entry)} style={{ padding: 4, border: '1px solid var(--line)', borderRadius: 5, color: 'var(--text)' }}>
                <Icon name={entry.kind === 'dir' ? 'folder' : iconFor(entry.name)} size={18} />
                <span style={{ fontSize: 7.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{entry.name}</span>
              </button>)}
            </div>}
          </div>
        </>
      ) : tab === 'saved' ? (
        <div className="appBody">
          <div className="owlSection">Saved on this phone · {savedFiles.length} file(s) · {formatBytes(savedFiles.reduce((total, file) => total + file.size, 0))}</div>
          <div className="tiny" style={{ padding: '5px 8px', lineHeight: 1.5 }}>Files stay inside OWL on this device and are available offline. Nothing is uploaded automatically.</div>
          <div className="owlSection">Optional cloud sync</div>
          <div style={{ margin: '4px 6px 8px', padding: 8, border: '1px solid var(--line)', borderRadius: 6 }}>
            <b style={{ fontSize: 9 }}>Not connected</b>
            <div className="tiny" style={{ marginTop: 4, lineHeight: 1.5 }}>Cloud sync is off until you connect a storage provider. Local saving works without internet. No file will be sent to the cloud unless you enable sync and choose it.</div>
          </div>
          {savedFiles.length === 0 && <div className="empty"><div className="big">🗂️</div><b>No saved files yet</b><div className="tiny">Choose files from This device, then press Save.</div><button className="btn primary" onClick={pickFilesFallback}>Choose files</button></div>}
          {savedFiles.map((file) => <div key={file.id} className="rowBtn" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button onClick={() => void openFile(new File([file.blob], file.name, { type: file.type, lastModified: file.modified }))} style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1, border: 0, background: 'transparent', color: 'inherit', textAlign: 'left' }}>
              <Icon name={iconFor(file.name)} size={12} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <span className="meta">{formatBytes(file.size)}</span>
            </button>
            <button className="chip" onClick={() => downloadBlob(file.blob, file.name)}>Export</button>
            <button className="chip" onClick={() => removeSaved(file)}>Delete</button>
          </div>)}
        </div>
      ) : (
        <div className="appBody">
          <div className="owlSection">Browser storage · {formatBytes(estimates.usage)} of {formatBytes(estimates.quota)}</div>
          <div style={{ padding: '0 6px 4px' }}><div className="progress"><i style={{ width: `${estimates.quota ? Math.min(100, (estimates.usage / estimates.quota) * 100) : 0}%` }} /></div></div>
          <div className="owlSection">Pictures ({photos.length})</div>
          {photos.slice(0, 4).map((photo) => <button key={photo.id} className="rowBtn" onClick={() => downloadBlob(photo.blob, photo.name)}><Icon name="image" size={11} /><span>{photo.name}</span><span className="meta">{formatBytes(photo.blob.size)} ⤓</span></button>)}
          <div className="owlSection">Voice notes ({voice.length})</div>
          {voice.slice(0, 4).map((note) => <button key={note.id} className="rowBtn" onClick={() => downloadBlob(note.blob, `${note.name}.webm`)}><Icon name="mic" size={11} /><span>{note.name}</span><span className="meta">{formatBytes(note.blob.size)} ⤓</span></button>)}
          <div className="owlSection">IndexedDB keys ({internalKeys.length})</div>
          {internalKeys.map((key) => <div key={key} className="rowBtn" style={{ cursor: 'default' }}><Icon name="database" size={11} /><span className="mono" style={{ fontSize: 9.5 }}>{key}</span></div>)}
          <div className="tiny" style={{ padding: 8 }}>This screen does not include a clear-all action. Your saved files are separate and are never removed by OWL automatically.</div>
        </div>
      )}

      {preview && <div className="dialogLayer" role="dialog" aria-label={preview.name} onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null); }}>
        <div className="dialog" style={{ maxWidth: 380 }} onClick={(event) => event.stopPropagation()}>
          <h3 style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.name}</h3>
          <div className="dBody">
            {preview.text !== undefined ? <pre style={{ whiteSpace: 'pre-wrap', fontSize: 9, maxHeight: 180, overflow: 'auto', background: 'rgba(0,0,0,.3)', padding: 5, borderRadius: 4 }}>{preview.text}</pre>
              : preview.type.startsWith('image') ? <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%', borderRadius: 4 }} />
              : preview.type.startsWith('video') ? <video src={preview.url} controls style={{ maxWidth: '100%' }} />
              : preview.type.startsWith('audio') ? <audio src={preview.url} controls style={{ width: '100%' }} />
              : <div className="tiny">Inline preview is not available.</div>}
          </div>
          <div className="dActions"><button className="btn" onClick={() => window.open(preview.url, '_blank', 'noopener')} disabled={!preview.url}>Open tab</button><button className="btn primary" onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null); }}>Close</button></div>
        </div>
      </div>}

      {info && <div className="dialogLayer" role="dialog" aria-label="File info" onClick={() => setInfo(null)}>
        <div className="dialog" onClick={(event) => event.stopPropagation()}>
          <h3>Save file in OWL?</h3>
          <div className="dBody">
            <div className="kv"><b>Name</b><span>{info.name}</span></div>
            <div className="kv"><b>Size</b><span>{formatBytes(info.size)}</span></div>
            <div className="kv"><b>Modified</b><span>{info.modified ? new Date(info.modified).toLocaleString() : '—'}</span></div>
            <div className="tiny" style={{ marginTop: 6 }}>A separate copy will be stored locally in OWL. The original file on your phone will not be changed.</div>
          </div>
          <div className="dActions">
            <button className="btn" onClick={() => setInfo(null)}>Cancel</button>
            {info.file && <button className="btn primary" onClick={() => void saveToOwl(info.file!)}>Save in OWL</button>}
          </div>
        </div>
      </div>}
    </AppFrame>
  );
}

function iconFor(name: string): string {
  if (/\.(mp3|m4a|wav|ogg|flac)$/i.test(name)) return 'music';
  if (/\.(mp4|webm|mov|mkv)$/i.test(name)) return 'video';
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name)) return 'image';
  if (/\.(txt|md|json|csv|xml|html)$/i.test(name)) return 'memo';
  if (/\.pdf$/i.test(name)) return 'memo';
  return 'folder';
}
