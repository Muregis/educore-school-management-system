/**
 * Prune stale IndexedDB entity caches (students/classes/etc.) older than maxAgeMs.
 * Does not touch pending_actions queue.
 */
const DB_NAME = 'educore_offline_v1';
const DEFAULT_MAX_AGE_MS = 2 * 60 * 1000;

export async function pruneStaleOfflineCaches(maxAgeMs = DEFAULT_MAX_AGE_MS) {
  if (typeof indexedDB === 'undefined') return 0;

  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const stores = ['students', 'classes', 'subjects', 'cached_attendance', 'cached_grades'];
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  for (const storeName of stores) {
    if (!db.objectStoreNames.contains(storeName)) continue;
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    for (const row of all) {
      if (row.is_pending) continue;
      const ts = Date.parse(row._cached_at || '');
      if (!row._cached_at || Number.isNaN(ts) || ts < cutoff) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const keyPath = store.keyPath;
          const key = typeof keyPath === 'string' ? row[keyPath] : row.cache_key;
          const req = store.delete(key);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        removed++;
      }
    }
  }
  db.close();
  return removed;
}
