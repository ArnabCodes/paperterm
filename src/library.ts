export interface LocalBook { id: string; name: string; blob: Blob; updated: number }

const libraryName = 'pipit-library';
const legacyLibraryName = 'paperterm-library';

function openLibrary(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('books', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function migrateLegacyLibrary(target: IDBDatabase): Promise<IDBDatabase | null> {
  let legacy: IDBDatabase | null;
  try {
    legacy = await new Promise<IDBDatabase | null>((resolve, reject) => {
      const request = indexedDB.open(legacyLibraryName, 1);
      let didNotExist = false;
      request.onupgradeneeded = event => {
        if (event.oldVersion === 0) {
          didNotExist = true;
          request.transaction?.abort();
        }
      };
      request.onsuccess = () => didNotExist ? (request.result.close(), resolve(null)) : resolve(request.result);
      request.onerror = () => didNotExist ? resolve(null) : reject(request.error);
    });
  } catch { return null; }
  if (!legacy) return null;

  try {
    if (!legacy.objectStoreNames.contains('books')) { legacy.close(); return null; }
    const books = await new Promise<LocalBook[]>((resolve, reject) => {
      const request = legacy.transaction('books', 'readonly').objectStore('books').getAll();
      request.onsuccess = () => resolve(request.result as LocalBook[]);
      request.onerror = () => reject(request.error);
    });
    if (!books.length) {
      legacy.close();
      indexedDB.deleteDatabase(legacyLibraryName);
      return null;
    }
    await new Promise<void>((resolve, reject) => {
      const transaction = target.transaction('books', 'readwrite');
      const store = transaction.objectStore('books');
      const keys = store.getAllKeys();
      keys.onsuccess = () => {
        const existing = new Set(keys.result);
        for (const book of books) if (!existing.has(book.id)) store.put(book);
      };
      keys.onerror = () => transaction.abort();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    legacy.close();
    const deletion = indexedDB.deleteDatabase(legacyLibraryName);
    deletion.onblocked = () => console.info('Pipit will finish migrating the old local library after its other open tabs close.');
    return null;
  } catch {
    // Keep using the original database if the copy cannot complete; this avoids hiding local files.
    return legacy;
  }
}

const database = openLibrary(libraryName).then(async db => (await migrateLegacyLibrary(db)) ?? db);

async function request<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('books', mode);
    const query = operation(transaction.objectStore('books'));
    transaction.oncomplete = () => resolve(query.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export const listBooks = async () => (await request<LocalBook[]>('readonly', store => store.getAll())).sort((left, right) => right.updated - left.updated);
export const readBook = (id: string) => request<LocalBook | undefined>('readonly', store => store.get(id));
export const clearBooks = () => request('readwrite', store => store.clear());
export async function saveBook(book: LocalBook) {
  if (book.blob.size > 25 * 1024 * 1024) return false;
  await request('readwrite', store => store.put(book));
  const books = await listBooks();
  for (const old of books.slice(6)) await request('readwrite', store => store.delete(old.id));
  return true;
}
