import type { ReaderPackage, BookMetadata } from '../types/book';

const DB_NAME = 'cbeta_reader_db';
const DB_VERSION = 1;
const BOOKS_STORE = 'books';
const SETTINGS_STORE = 'settings';

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
    };
  });
}

export async function saveBook(bookPackage: ReaderPackage): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.put(bookPackage);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getBook(workId: string): Promise<ReaderPackage | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readonly');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.get(workId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deleteBook(workId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readwrite');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.delete(workId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function listBooks(): Promise<BookMetadata[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BOOKS_STORE, 'readonly');
    const store = transaction.objectStore(BOOKS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const books: ReaderPackage[] = request.result || [];
      resolve(books.map(b => b.metadata));
    };
  });
}

// 偏好設定儲存與讀取
export interface AppSettings {
  id: string;
  theme: 'ivory' | 'parchment' | 'comfort' | 'ebony';
  fontSize: number; // px
  lineHeight: number; // 比例，如 1.8, 2.0
  padding: number; // 左右留白 %, 如 5, 10, 15, 20
  autoHideToolbar: boolean;
  profile: 'beginner' | 'standard' | 'scholar' | 'custom';
  customVisibleElements: {
    showReaderControls: boolean; // 顯示閱讀頁上下控制列
    notes: boolean;        // 顯示校勘
    pageNumber: boolean;   // 顯示頁碼
    ttsHighlight: boolean; // 朗讀時 Highlight
  };
  ttsVoice: string; // 選定的 Voice Name
  ttsSpeed: number; // 播放速度 0.5 ~ 2
  ttsPitch: number; // 音調高低 0.5 ~ 2
  ttsMode: 'normal' | 'natural'; // 朗讀口吻
}

const DEFAULT_SETTINGS: AppSettings = {
  id: 'current',
  theme: 'parchment',
  fontSize: 22,
  lineHeight: 2.0,
  padding: 10,
  autoHideToolbar: true,
  profile: 'standard',
  customVisibleElements: {
    showReaderControls: true, // 預設改為顯示上下控制列
    notes: false,
    pageNumber: false,
    ttsHighlight: true
  },
  ttsVoice: '',
  ttsSpeed: 1.0,
  ttsPitch: 1.0,
  ttsMode: 'normal'
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
