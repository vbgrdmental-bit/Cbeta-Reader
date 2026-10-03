import type { BookMetadata } from '../types/book';

/**
 * 取得經典的精確下載時間戳記 (毫秒)
 * 優先序：
 * 1. BookMetadata.packagedAt (ISO 時間字串)
 * 2. localStorage: cbeta_download_time_${workId}
 * 3. 預設 0
 */
export function getBookDownloadTimestamp(book: BookMetadata): number {
  if (book.packagedAt) {
    const t = new Date(book.packagedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const localSaved = localStorage.getItem(`cbeta_download_time_${book.workId}`);
      if (localSaved) {
        const t = parseInt(localSaved, 10);
        if (!isNaN(t) && t > 0) return t;
      }
    } catch {
      // 忽略 localStorage 存取異常
    }
  }
  return 0;
}

/**
 * 依「近期下載」權威規則過濾與排序經文清單：
 * 規則 1：距離當下時間點最近 48 小時下載的經文
 * 規則 2：距離當下時間點最近下載的 10 本書
 * 排序原則：依下載時間由新到舊倒序排列（最新下載永遠排在最前面）
 */
export function getRecentDownloadedBooks(books: BookMetadata[]): BookMetadata[] {
  if (!books || books.length === 0) return [];

  const now = Date.now();
  const cutoff48h = now - 48 * 60 * 60 * 1000;

  // 1. 依照下載時間由大到小排序（最新排在最前）
  const sorted = [...books].sort((a, b) => {
    const timeA = getBookDownloadTimestamp(a);
    const timeB = getBookDownloadTimestamp(b);
    if (timeA !== timeB) return timeB - timeA;
    return 0;
  });

  // 2. 篩選：符合 48 小時內 OR 屬於最新下載的前 10 本
  return sorted.filter((book, index) => {
    const time = getBookDownloadTimestamp(book);
    const isWithin48h = time > 0 && time >= cutoff48h;
    const isTop10Recent = index < 10;
    return isWithin48h || isTop10Recent;
  });
}
