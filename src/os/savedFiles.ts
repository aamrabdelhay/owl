import { createStore, get, set, del, keys } from 'idb-keyval';

const savedStore = createStore('owl-saved-files', 'files');

export interface SavedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  modified: number;
  savedAt: number;
  blob: Blob;
}

export async function listSavedFiles(): Promise<SavedFile[]> {
  const ids = (await keys(savedStore)).filter((key): key is string => typeof key === 'string');
  const files = await Promise.all(ids.map((id) => get<SavedFile>(id, savedStore)));
  return files.filter((file): file is SavedFile => Boolean(file)).sort((a, b) => b.savedAt - a.savedAt);
}

export async function saveLocalFile(file: File): Promise<SavedFile> {
  const record: SavedFile = {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    modified: file.lastModified,
    savedAt: Date.now(),
    blob: file,
  };
  await set(record.id, record, savedStore);
  const verified = await get<SavedFile>(record.id, savedStore);
  if (!verified || verified.size !== file.size || verified.name !== file.name) {
    throw new Error('The file could not be verified after saving');
  }
  return record;
}

export async function deleteLocalFile(id: string): Promise<void> {
  await del(id, savedStore);
}
