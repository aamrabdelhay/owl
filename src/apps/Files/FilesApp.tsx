import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, formatBytes, downloadBlob } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { DB_KEYS, dbKeys, dbEstimate } from '../../os/db';
import type { PhotoItem, VoiceNote } from '../../os/types';
import { isAudio, isImage, isText, isVideo } from '../../os/media';

interface Entry {
  name: string;
  kind: 'file' | 'dir';
  size: number;
  modified: number;
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
  file?: File;
  path?: string;
}

const supportsFs = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/** File Manager: reads the user's own device via File System Access with fallbacks. */
export default function FilesApp() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rootName, setRootName] = useState<string | null>(null);
  const [dirStack, setDirStack] = useState<{ name: string; handle: FileSystemDirectoryHandle }[]>([]);
  const [sort, setSort] = useState<'name' | 'size' | 'date'>('name');
  const [grid, setGrid] = useState(false);
  const [preview, setPreview] = useState<{ name: string; url: string; type: string; text?: string } | null>(null);
  const [info, setInfo] = useState<Entry | null>(null);
  const [tab, setTab] = useState<'device' | 'internal'>('device');
  const [estimates, setEstimates] = useState({ usage: 0, quota: 0 });
  const [photos] = useCollection<PhotoItem>(DB_KEYS.photos);
  const [voice] = useCollection<VoiceNote>(DB_KEYS.voiceNotes);
  const toast = useStore((s) => s.toast);
  const setAppMenu = useStore((s) => s.setAppMenu);

  useEffect(() => {
    void dbEstimate().then(setEstimates);
    setAppMenu({
      title: 'File Manager',
      actions: [
        { id: 'dir', label: 'Open a folder', icon: 'folder', run: () => void pickDirectory() },
        { id: 'files', label: 'Pick files', icon: 'list', run: () => void pickFilesFallback() },
        { id: 'internal', label: 'Show app storage', icon: 'battery', run: () => setTab('internal') },
        { id: 'device', label: 'Show device files', icon: 'folder', run: () => setTab('device') },
      ],
    });
    return () => setAppMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDir = async (handle: FileSystemDirectoryHandle) => {
    const list: Entry[] = [];
    try {
      for await (const [name, child] of (handle as any).entries()) {
        if (child.kind === 'directory') {
          list.push({ name, kind: 'dir', size: 0, modified: 0, handle: child });
        } else {
          const file = await (child as FileSystemFileHandle).getFile();
          list.push({ name, kind: 'file', size: file.size, modified: file.lastModified, handle: child, file });
        }
      }
      setEntries(list);
    } catch {
      toast('Could not read that folder');
    }
  };

  const pickDirectory = async () => {
    const anyWin = window as any;
    if (!anyWin.showDirectoryPicker) {
      toast('Folder picking is not available here — use "Pick files" instead');
      void pickFilesFallback();
      return;
    }
    try {
      const handle = await anyWin.showDirectoryPicker({ mode: 'read' });
      setRootName(handle.name);
      setDirStack([{ name: handle.name, handle }]);
      setTab('device');
      await loadDir(handle);
    } catch {
      /* user cancelled */
    }
  };

  const pickFilesFallback = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []);
      setEntries(files.map((f) => ({
        name: f.name, kind: 'file', size: f.size, modified: f.lastModified, file: f,
      })));
      setRootName('Selected files');
      setDirStack([]);
      setTab('device');
    };
    input.click();
  };

  const openEntry = async (entry: Entry) => {
    if (entry.kind === 'dir' && entry.handle) {
      setDirStack((prev) => [...prev, { name: entry.name, handle: entry.handle as FileSystemDirectoryHandle }]);
      await loadDir(entry.handle as FileSystemDirectoryHandle);
      return;
    }
    const file = entry.file || (entry.handle ? await (entry.handle as FileSystemFileHandle).getFile().catch(() => null) : null);
    if (!file) { toast('Could not read that file'); return; }
    if (isImage(file) || isVideo(file) || isAudio(file)) {
      const url = URL.createObjectURL(file);
      setPreview({ name: file.name, url, type: file.type });
      return;
    }
    if (isText(file) || /json|md|csv|xml/i.test(file.name)) {
      const text = await file.text();
      setPreview({ name: file.name, url: '', type: file.type || 'text/plain', text: text.slice(0, 8000) });
      return;
    }
    if (/pdf$/i.test(file.name)) {
      const url = URL.createObjectURL(file);
      setPreview({ name: file.name, url, type: 'application/pdf' });
      return;
    }
    toast('No viewer for this file type — you can download it instead');
    setInfo(entry);
  };

  const goUp = () => {
    if (dirStack.length <= 1) return;
    const next = dirStack.slice(0, -1);
    setDirStack(next);
    void loadDir(next[next.length - 1].handle);
  };

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      if (sort === 'size') return b.size - a.size;
      if (sort === 'date') return b.modified - a.modified;
      return a.name.localeCompare(b.name);
    });
  }, [entries, sort]);

  const internal = async () => {
    const keys = await dbKeys();
    return keys;
  };
  const [internalKeys, setInternalKeys] = useState<string[]>([]);
  useEffect(() => {
    if (tab === 'internal') void internal().then(setInternalKeys);
  }, [tab]);

  return (
    <AppFrame
      title="File Manager"
      icon="folder"
      actions={
        <>
          <button className="hbtn" onClick={() => setTab(tab === 'device' ? 'internal' : 'device')}>{tab === 'device' ? 'App storage' : 'Device'}</button>
          {tab === 'device' && <button className="hbtn" onClick={() => void pickDirectory()}>Folder</button>}
        </>
      }
    >
      <div className="owlTabBar">
        <button className={`owlTab ${tab === 'device' ? 'active' : ''}`} onClick={() => setTab('device')}>This device</button>
        <button className={`owlTab ${tab === 'internal' ? 'active' : ''}`} onClick={() => setTab('internal')}>App storage</button>
      </div>

      {tab === 'device' ? (
        <>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', padding: '3px 5px', borderBottom: '1px solid var(--line)' }}>
            {dirStack.length > 0 && <button className="iconBtn" onClick={goUp} aria-label="Up one level" style={{ width: 17, height: 17 }}>↑</button>}
            <span className="tiny" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {dirStack.length ? dirStack.map((d) => d.name).join(' / ') : rootName || 'No folder opened'}
            </span>
            <button className={`chip ${sort === 'name' ? 'on' : ''}`} onClick={() => setSort('name')}>A–Z</button>
            <button className={`chip ${sort === 'size' ? 'on' : ''}`} onClick={() => setSort('size')}>Size</button>
            <button className={`chip ${sort === 'date' ? 'on' : ''}`} onClick={() => setSort('date')}>Date</button>
            <button className="iconBtn" onClick={() => setGrid((g) => !g)} aria-label="Toggle view" style={{ width: 17, height: 17 }}>
              <Icon name={grid ? 'list' : 'grid'} size={8} />
            </button>
          </div>
          <div className="appBody">
            {entries.length === 0 && (
              <div className="empty">
                <div className="big">📁</div>
                <div><b>Browse your own files</b></div>
                <div className="tiny" style={{ maxWidth: 310, lineHeight: 1.5 }}>
                  {supportsFs
                    ? 'Open a folder with the File System Access API — files are read directly from your disk.'
                    : 'This browser has no File System Access API, so you can pick individual files instead.'}
                </div>
                <div className="btnRow" style={{ justifyContent: 'center' }}>
                  <button className="btn primary" onClick={() => void pickDirectory()}>Open folder</button>
                  <button className="btn" onClick={pickFilesFallback}>Pick files</button>
                </div>
                <div className="tiny" style={{ maxWidth: 300, opacity: 0.8 }}>
                  Nothing is uploaded. No copies are made on any server.
                </div>
              </div>
            )}
            {entries.length > 0 && !grid && sorted.map((entry, i) => (
              <button key={`${entry.name}-${i}`} className="rowBtn" onClick={() => void openEntry(entry)}>
                <Icon name={entry.kind === 'dir' ? 'folder' : iconFor(entry.name)} size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{entry.name}</span>
                <span className="meta">{entry.kind === 'dir' ? 'Folder' : formatBytes(entry.size)}</span>
                {entry.kind === 'file' && (
                  <span
                    className="iconBtn"
                    role="button"
                    tabIndex={0}
                    aria-label="Info"
                    onClick={(e) => { e.stopPropagation(); setInfo(entry); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setInfo(entry); } }}
                  >i</span>
                )}
              </button>
            ))}
            {entries.length > 0 && grid && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, padding: 4 }}>
                {sorted.map((entry, i) => (
                  <button
                    key={`${entry.name}-${i}`}
                    className="dockItem"
                    onClick={() => void openEntry(entry)}
                    style={{ padding: 4, border: '1px solid var(--line)', borderRadius: 5, color: 'var(--text)' }}
                  >
                    <Icon name={entry.kind === 'dir' ? 'folder' : iconFor(entry.name)} size={18} />
                    <span style={{ fontSize: 7.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {entry.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="appBody">
          <div className="owlSection">Browser storage · {formatBytes(estimates.usage)} of {formatBytes(estimates.quota)}</div>
          <div style={{ padding: '0 6px 4px' }}>
            <div className="progress"><i style={{ width: `${estimates.quota ? Math.min(100, (estimates.usage / estimates.quota) * 100) : 0}%` }} /></div>
          </div>
          <div className="owlSection">Pictures ({photos.length})</div>
          {photos.slice(0, 4).map((p) => (
            <button key={p.id} className="rowBtn" onClick={() => downloadBlob(p.blob, p.name)}>
              <Icon name="image" size={11} />
              <span>{p.name}</span>
              <span className="meta">{formatBytes(p.blob.size)} ⤓</span>
            </button>
          ))}
          <div className="owlSection">Voice notes ({voice.length})</div>
          {voice.slice(0, 4).map((v) => (
            <button key={v.id} className="rowBtn" onClick={() => downloadBlob(v.blob, `${v.name}.webm`)}>
              <Icon name="mic" size={11} />
              <span>{v.name}</span>
              <span className="meta">{formatBytes(v.blob.size)} ⤓</span>
            </button>
          ))}
          <div className="owlSection">IndexedDB keys ({internalKeys.length})</div>
          {internalKeys.map((k) => (
            <div key={k} className="rowBtn" style={{ cursor: 'default' }}>
              <Icon name="database" size={11} />
              <span className="mono" style={{ fontSize: 9.5 }}>{k}</span>
            </div>
          ))}
          <div className="tiny" style={{ padding: 8 }}>
            Downloading a stored photo or note copies it back to your computer. Nothing leaves the browser.
          </div>
        </div>
      )}

      {preview && (
        <div className="dialogLayer" role="dialog" aria-label={preview.name} onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
          <div className="dialog" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview.name}</h3>
            <div className="dBody">
              {preview.text !== undefined ? (
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 9, maxHeight: 180, overflow: 'auto', background: 'rgba(0,0,0,.3)', padding: 5, borderRadius: 4 }}>{preview.text}</pre>
              ) : preview.type.startsWith('image') ? (
                <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%', borderRadius: 4 }} />
              ) : preview.type.startsWith('video') ? (
                <video src={preview.url} controls style={{ maxWidth: '100%', borderRadius: 4 }} />
              ) : preview.type.startsWith('audio') ? (
                <audio src={preview.url} controls style={{ width: '100%' }} />
              ) : (
                <div className="tiny">Inline preview is not available. Open it in a new tab instead.</div>
              )}
            </div>
            <div className="dActions">
              <button className="btn" onClick={() => window.open(preview.url, '_blank', 'noopener')} disabled={!preview.url}>Open tab</button>
              <button className="btn primary" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {info && (
        <div className="dialogLayer" role="dialog" aria-label="File info" onClick={() => setInfo(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>File info</h3>
            <div className="dBody">
              <div className="kv"><b>Name</b><span>{info.name}</span></div>
              <div className="kv"><b>Size</b><span>{formatBytes(info.size)}</span></div>
              <div className="kv"><b>Modified</b><span>{info.modified ? new Date(info.modified).toLocaleString() : '—'}</span></div>
              <div className="kv"><b>Type</b><span>{info.file?.type || 'unknown'}</span></div>
            </div>
            <div className="dActions">
              {info.file && <button className="btn" onClick={() => downloadBlob(info.file!, info.name)}>Download</button>}
              <button className="btn primary" onClick={() => setInfo(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
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
