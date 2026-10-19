export interface LocalBook { id: string; name: string; blob: Blob; updated: number }

const database = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('paperterm-library', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('books', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

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
