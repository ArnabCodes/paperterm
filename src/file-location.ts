export interface LocalFolderHandle {
  kind: 'directory'; name: string;
  values(): AsyncIterable<LocalFolderHandle | LocalDocumentHandle>;
  queryPermission?(options: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(options: { mode: 'read' }): Promise<PermissionState>;
}
export interface LocalDocumentHandle { kind: 'file'; name: string; getFile(): Promise<File> }

async function locationStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('pipit-local-folder', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('location');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction('location', mode);
      const request = operation(transaction.objectStore('location'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export async function readLocalFolder(): Promise<LocalFolderHandle | undefined> {
  const handle = await locationStore<LocalFolderHandle | undefined>('readonly', store => store.get('folder'));
  return handle?.kind === 'directory' && typeof handle.values === 'function' ? handle : undefined;
}
export const saveLocalFolder = (handle: LocalFolderHandle) => locationStore('readwrite', store => store.put(handle, 'folder'));
