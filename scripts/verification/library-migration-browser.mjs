import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4190/';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base);
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('paperterm-library', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('books', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('books', 'readwrite');
      transaction.objectStore('books').put({ id: 'migration-fixture', name: 'Saved research copy.pdf', blob: new Blob(['preserved local PDF bytes'], { type: 'application/pdf' }), updated: 1 });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
  await page.waitForFunction(async () => {
    const db = await new Promise(resolve => {
      const request = indexedDB.open('pipit-library', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    if (!db) return false;
    return await new Promise(resolve => {
      const request = db.transaction('books', 'readonly').objectStore('books').get('migration-fixture');
      request.onsuccess = () => { const book = request.result; db.close(); resolve(book?.name === 'Saved research copy.pdf' && book?.blob?.size > 0); };
      request.onerror = () => { db.close(); resolve(false); };
    });
  });
  const names = await page.evaluate(async () => (await indexedDB.databases()).map(database => database.name));
  assert.ok(names.includes('pipit-library'));
  assert.ok(!names.includes('paperterm-library'), 'the previous database is removed after its contents migrate');
  console.log('PASS saved local PDF copies migrate to the Pipit library and the old database is removed');
} finally { await browser.close(); }
