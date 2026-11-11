/* Bundled copy of the jsmediatags browser build (no ESM entry upstream), so
   ID3 reading works offline. Nothing leaves the device. */
import tagReaderUrl from 'jsmediatags/dist/jsmediatags.min.js?url';

/** Shared media helpers: file picking, ID3 tags, object URLs. Nothing is uploaded. */

export interface PickedFile {
  name: string;
  size: number;
  type: string;
  file: File;
  path?: string;
}

export function pickFiles(accept: string, multiple = true, directory = false): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    if (directory) {
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    }
    input.style.display = 'none';
    document.body.appendChild(input);
    let settled = false;
    const finish = (files: PickedFile[]) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };
    input.onchange = () => {
      const list = Array.from(input.files || []);
      finish(list.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || guessType(file.name),
        file,
        path: (file as any).webkitRelativePath || undefined,
      })));
    };
    // Some browsers never fire change when cancelled; clean up on focus return.
    window.addEventListener('focus', () => window.setTimeout(() => finish([]), 600), { once: true });
    input.click();
  });
}

function guessType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac', opus: 'audio/opus',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
    pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', json: 'application/json', vtt: 'text/vtt', srt: 'application/x-subrip',
  };
  return map[ext] || 'application/octet-stream';
}

export interface TrackTags {
  title?: string;
  artist?: string;
  album?: string;
  picture?: string;
}

let tagReaderPromise: Promise<any> | null = null;

function loadTagReader(): Promise<any> {
  if (tagReaderPromise) return tagReaderPromise;
  tagReaderPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.jsmediatags?.read) { resolve(w.jsmediatags); return; }
    const script = document.createElement('script');
    script.src = tagReaderUrl;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => (w.jsmediatags?.read ? resolve(w.jsmediatags) : reject(new Error('tag reader unavailable')));
    script.onerror = () => reject(new Error('tag reader blocked'));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error('tag reader timeout')), 6000);
  }).catch(() => null);
  return tagReaderPromise;
}

/** Read ID3 tags locally with jsmediatags. Never sends the file anywhere. */
export async function readTags(file: File): Promise<TrackTags> {
  try {
    // jsmediatags ships only a browser IIFE bundle (no ESM entry), so it is
    // loaded from a CDN at runtime. If it cannot load, tag reading silently
    // falls back to the file name — no metadata is ever uploaded anywhere.
    const jsmediatags = await loadTagReader();
    return await new Promise<TrackTags>((resolve) => {
      jsmediatags.read(file, {
        onSuccess: (tag: any) => {
          const t = tag?.tags || {};
          let picture: string | undefined;
          if (t.picture) {
            const { data, format } = t.picture;
            try {
              let binary = '';
              const bytes = new Uint8Array(data as number[]);
              const step = 4096;
              for (let i = 0; i < bytes.length; i += step) {
                binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + step)) as any);
              }
              picture = `data:${format};base64,${btoa(binary)}`;
            } catch { /* picture optional */ }
          }
          resolve({ title: t.title, artist: t.artist, album: t.album, picture });
        },
        onError: () => resolve({}),
      });
    });
  } catch {
    return {};
  }
}

export function isAudio(file: { type: string; name: string }): boolean {
  return file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac|aac|opus|weba)$/i.test(file.name);
}
export function isVideo(file: { type: string; name: string }): boolean {
  return file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|ogv|m4v)$/i.test(file.name);
}
export function isImage(file: { type: string; name: string }): boolean {
  return file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(file.name);
}
export function isText(file: { type: string; name: string }): boolean {
  return file.type.startsWith('text/') || /\.(txt|md|json|csv|log|ini|yml|yaml|html|css|js|ts|xml)$/i.test(file.name);
}
