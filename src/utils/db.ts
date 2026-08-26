import type { ReaderPackage, BookMetadata } from '../types/book';
import { APP_VERSION } from '../builder/version';

const DB_NAME = 'cbeta_reader_db';
const DB_VERSION = 2;
const BOOKS_STORE = 'books';
const SETTINGS_STORE = 'settings';
const HIGHLIGHTS_STORE = 'highlights';

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        db.createObjectStore(BOOKS_STORE, { keyPath: 'metadata.workId' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(HIGHLIGHTS_STORE)) {
        const highlightsStore = db.createObjectStore(HIGHLIGHTS_STORE, { keyPath: 'id' });
        highlightsStore.createIndex('workId', 'workId', { unique: false });
      }
    };
  });
}

// 💡 Gzip 雙向動態壓縮/解壓輔助 (為全集與大量經文節省 75%~85% 空間)
export async function compressData(str: string): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const encoder = new TextEncoder();
    const uint8 = encoder.encode(str);
    const blobInput = new Blob([uint8.buffer as ArrayBuffer]);
    const stream = blobInput.stream().pipeThrough(new CompressionStream('gzip'));
    const response = new Response(stream);
    const blob = await response.blob();
    return new Uint8Array(await blob.arrayBuffer());
  } catch (e) {
    console.warn('CompressionStream failed, fallback to raw', e);
    return null;
  }
}

export async function decompressData(compressed: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([compressed.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    const response = new Response(stream);
    return await response.text();
  } catch (e) {
    console.warn('DecompressionStream failed', e);
    return null;
  }
}

export async function saveBook(bookPackage: ReaderPackage): Promise<void> {
  const db = await initDB();
  
  // 💡 大於 50KB 之經典內容進行 Gzip 輕量化壓縮儲存
  let packageToStore: any = bookPackage;
  try {
    const contentStr = JSON.stringify(bookPackage.content);
    if (contentStr.length > 50000) {
      const compressed = await compressData(contentStr);
      if (compressed) {
        packageToStore = {
          metadata: bookPackage.metadata,
          toc: bookPackage.toc,
          navigation: bookPackage.navigation,
          reference: bookPackage.reference,
          searchIndex: bookPackage.searchIndex,
          embedding: bookPackage.embedding,
          compressedContent: compressed,
          isCompressed: true
        };
      }
    }
  } catch (e) {
    console.warn('Failed to compress bookPackage before save', e);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.put(packageToStore);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getBook(workId: string): Promise<ReaderPackage | null> {
  const db = await initDB();
  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readonly');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.get(workId);

    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      const result = request.result;
      if (!result) return resolve(null);

      // 若為壓縮套件，解壓還原 content
      if (result.isCompressed && result.compressedContent) {
        try {
          const decompressedStr = await decompressData(result.compressedContent);
          if (decompressedStr) {
            const content = JSON.parse(decompressedStr);
            return resolve({
              metadata: result.metadata,
              content,
              toc: result.toc,
              navigation: result.navigation,
              reference: result.reference,
              searchIndex: result.searchIndex,
              embedding: result.embedding
            });
          }
        } catch (e) {
          console.error('Failed to decompress book content for', workId, e);
        }
      }
      resolve(result);
    };
  });
}

export async function deleteBook(workId: string): Promise<void> {
  const db = await initDB();
  
  // 1. 刪除 IndexedDB 中的書籍資料
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.delete(workId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // 2. 徹底清空本地與此經文相關的 localStorage / sessionStorage 瀏覽與位置紀錄
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes(workId) || key.includes('reading_progress') || key.includes('last_read'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Failed to clear localStorage keys for', workId, e);
  }

  // 3. 徹底抹除 CacheStorage / Service Worker 中的 HTTP 快取，防止舊版網路快取殘留
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        for (const req of requests) {
          if (req.url.includes(workId)) {
            await cache.delete(req);
          }
        }
      }
    } catch (cacheErr) {
      console.warn('Failed to clear CacheStorage for', workId, cacheErr);
    }
  }
}

export async function clearAllBooks(): Promise<void> {
  const db = await initDB();
  
  // 1. 清空 IndexedDB BOOKS_STORE 中的所有書籍
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // 2. 清空所有的閱讀進度與資料夾狀態 (保留偏好設定 app_settings)
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key !== 'app_settings') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Failed to clear localStorage keys', e);
  }

  // 3. 清空 CacheStorage 中的網路快取
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    } catch (cacheErr) {
      console.warn('Failed to clear CacheStorage', cacheErr);
    }
  }
}

export async function listBooks(): Promise<BookMetadata[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readonly');
    const store = transaction.objectStore(BOOKS_STORE);
    const metadataList: BookMetadata[] = [];
    const request = store.openCursor();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        if (cursor.value && cursor.value.metadata) {
          metadataList.push(cursor.value.metadata);
        }
        cursor.continue();
      } else {
        resolve(metadataList);
      }
    };
  });
}

// 偏好設定儲存與讀取
export interface AppSettings {
  id: string;
  theme: 'ivory' | 'parchment' | 'comfort' | 'ebony';
  fontSize: number; // px
  fontFamily?: 'default' | 'kaiti' | 'fangsong' | 'jhenghei' | 'iansui' | 'yuanti' | 'wenkai' | 'iansui-zy' | 'iansui-bold'; // 內文字體選項：宋/明體, 正黑體, 芫荽體, 芫荽體(粗)
  lineHeight: number; // 比例，如 1.8, 2.0
  padding: number; // 左右留白 %, 如 5, 10, 15, 20
  autoHideToolbar: boolean;
  profile: 'beginner' | 'standard' | 'scholar' | 'custom';
  customVisibleElements: {
    showReaderControls: boolean; // 顯示閱讀頁上下控制列
    notes: boolean;        // 顯示校勘
    pageNumber: boolean;   // 顯示頁碼
    ttsHighlight: boolean; // 朗讀時 Highlight
    showNoteInText?: boolean; // 顯示筆記內容 (經文中顯示 (筆記：xxx))
    autoResumeProgress?: boolean; // 開啟經文時自動回到上次閱讀位置 (預設 true)
  };
  ttsVoice: string; // 選定的 Voice Name
  ttsSpeed: number; // 播放速度 0.5 ~ 2
  ttsPitch: number; // 音調高低 0.5 ~ 2
  ttsMode: 'normal' | 'natural'; // 朗讀口吻
  highlightColor: 'yellow' | 'red' | 'gray' | 'blue';
  highlightStyle: 'underline' | 'bottom-half' | 'full' | 'border';
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'current',
  theme: 'ivory',
  fontSize: 22,
  fontFamily: 'jhenghei',        // 預設字體：正黑體
  lineHeight: 2.0,
  padding: 10,
  autoHideToolbar: true,
  profile: 'standard',
  customVisibleElements: {
    showReaderControls: true,    // 預設顯示上下控制列
    notes: true,                 // 預設顯示校勘
    pageNumber: true,            // 預設顯示頁碼
    ttsHighlight: true,
    showNoteInText: false,       // 預設關閉「顯示筆記內容」
    autoResumeProgress: true     // 預設開啟「自動回到上次閱讀位置」
  },
  ttsVoice: '',
  ttsSpeed: 1.0,
  ttsPitch: 1.0,
  ttsMode: 'normal',
  highlightColor: 'yellow',
  highlightStyle: 'full'         // 預設畫重點樣式：全塗
};

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.put(settings);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getSettings(): Promise<AppSettings> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.get('current');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const stored = request.result;
      if (stored) {
        // 合併邏輯：確保 customVisibleElements 裡面的子屬性能被正確認初始化與升級
        const mergedCustom = {
          ...DEFAULT_SETTINGS.customVisibleElements,
          ...(stored.customVisibleElements || {})
        };
        // 如果舊資料未包含該值，升級成 true
        if (stored.customVisibleElements?.showReaderControls === undefined) {
          mergedCustom.showReaderControls = true;
        }
        if (stored.customVisibleElements?.showNoteInText === undefined) {
          mergedCustom.showNoteInText = false;
        }
        resolve({
          ...DEFAULT_SETTINGS,
          ...stored,
          customVisibleElements: mergedCustom
        });
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    };
  });
}

// 經文選取畫重點 (Highlight) 資料結構
export interface BookHighlight {
  id: string; // `${workId}_${juan}_${segmentId}_${startOffset}_${endOffset}`
  workId: string;
  juan: number;
  segmentId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  createdAt: number;
  color?: 'yellow' | 'red' | 'gray' | 'blue';
  style?: 'underline' | 'bottom-half' | 'full' | 'border';
  note?: string; // 💡 讀者對該劃線的心得隨筆/筆記
}

export async function saveHighlight(highlight: BookHighlight): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HIGHLIGHTS_STORE, 'readwrite');
    const store = transaction.objectStore(HIGHLIGHTS_STORE);
    const request = store.put(highlight);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deleteHighlight(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HIGHLIGHTS_STORE, 'readwrite');
    const store = transaction.objectStore(HIGHLIGHTS_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function listHighlights(workId: string): Promise<BookHighlight[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HIGHLIGHTS_STORE, 'readonly');
    const store = transaction.objectStore(HIGHLIGHTS_STORE);
    const index = store.index('workId');
    const request = index.getAll(workId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const items: BookHighlight[] = request.result || [];
      // 依據卷次、段落 ID 以及起始偏移量進行排序
      items.sort((a, b) => {
        if (a.juan !== b.juan) return a.juan - b.juan;
        if (a.segmentId !== b.segmentId) return a.segmentId.localeCompare(b.segmentId);
        return a.startOffset - b.startOffset;
      });
      resolve(items);
    };
  });
}

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

  const jsonStr = JSON.stringify(data);
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

        // 2. 還原離線經文
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

// 💡 本地儲存容量統計與高效率清理工具
export interface StorageStats {
  usedBytes: number;
  formattedUsed: string;
  bookCount: number;
  quotaBytes?: number;
  formattedQuota?: string;
}

export async function getStorageStats(): Promise<StorageStats> {
  const books = await listBooks();
  let usedBytes = 0;
  let quotaBytes = 0;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usedBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || 0;
    } catch (e) {
      console.warn('Storage estimate failed', e);
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return {
    usedBytes,
    formattedUsed: formatSize(usedBytes),
    bookCount: books.length,
    quotaBytes,
    formattedQuota: quotaBytes ? formatSize(quotaBytes) : undefined
  };
}

export async function clearHttpCacheStorage(): Promise<number> {
  let clearedCount = 0;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        const deleted = await caches.delete(cacheName);
        if (deleted) clearedCount++;
      }
    } catch (err) {
      console.warn('Failed to clear CacheStorage', err);
    }
  }
  return clearedCount;
}

export async function compressAllBooks(): Promise<{ compressedCount: number }> {
  const rawBooks = await getAllFullBooks();
  let compressedCount = 0;
  for (const b of rawBooks) {
    if (!(b as any).isCompressed) {
      await saveBook(b);
      compressedCount++;
    }
  }
  return { compressedCount };
}


