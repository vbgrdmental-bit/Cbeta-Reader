import type { ReaderPackage } from '../types/book';
import { APP_VERSION } from '../builder/version';
import { 
  initDB, 
  saveHighlight, 
  saveBook, 
  saveSettings, 
  getSettings, 
  type BookHighlight 
} from './db';

const BOOKS_STORE = 'books';
const HIGHLIGHTS_STORE = 'highlights';

export async function getAllHighlights(): Promise<BookHighlight[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HIGHLIGHTS_STORE, 'readonly');
    const store = transaction.objectStore(HIGHLIGHTS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getAllFullBooks(): Promise<ReaderPackage[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readonly');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

// 匯出個人資料（選擇包含經文與劃線重點，或僅重點與偏好設定）
export async function exportUserData(options: { includeBooks?: boolean } = {}): Promise<void> {
  const highlights = await getAllHighlights();
  const settings = await getSettings();
  let books: ReaderPackage[] = [];

  if (options.includeBooks) {
    books = await getAllFullBooks();
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const data = {
    app: 'CBETA Reader',
    version: APP_VERSION,
    exportedAt: now.toISOString(),
    includeBooks: !!options.includeBooks,
    highlightsCount: highlights.length,
    booksCount: books.length,
    highlights,
    settings,
    books: options.includeBooks ? books : undefined
  };

  const jsonStr = JSON.stringify(data, null, options.includeBooks ? undefined : 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const prefix = options.includeBooks ? 'cbeta_reader_full_backup' : 'cbeta_reader_backup';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 匯入個人備份 (.json) 並覆寫還原至 IndexedDB
export async function importUserData(file: File): Promise<{ highlightsCount: number; booksCount: number; settingsUpdated: boolean }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || (parsed.app !== 'CBETA Reader' && !parsed.highlights && !parsed.books)) {
          throw new Error('無效的 CBETA Reader 備份檔案格式。');
        }

        let highlightsCount = 0;
        let booksCount = 0;
        let settingsUpdated = false;

        // 1. 還原劃線重點
        if (Array.isArray(parsed.highlights) && parsed.highlights.length > 0) {
          for (const h of parsed.highlights) {
            if (h.id && h.workId && h.segmentId) {
              await saveHighlight(h);
              highlightsCount++;
            }
          }
        }

        // 2. 還原離線經文包
        if (Array.isArray(parsed.books) && parsed.books.length > 0) {
          for (const bookPkg of parsed.books) {
            if (bookPkg.metadata && bookPkg.metadata.workId) {
              await saveBook(bookPkg);
              booksCount++;
            }
          }
        }

        // 3. 還原偏好設定
        if (parsed.settings && typeof parsed.settings === 'object') {
          await saveSettings(parsed.settings);
          settingsUpdated = true;
        }

        resolve({ highlightsCount, booksCount, settingsUpdated });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('檔案讀取失敗。'));
    reader.readAsText(file);
  });
}
