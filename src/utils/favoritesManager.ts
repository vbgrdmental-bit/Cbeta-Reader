import type { BookMetadata } from '../types/book';

const STORAGE_KEY_IDS = 'favorite_work_ids';
const STORAGE_KEY_TIMESTAMPS = 'favorite_timestamps';

/**
 * 取得所有收藏的經號清單 (workIds)
 */
export function getFavoriteWorkIds(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_IDS);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * 取得收藏時間戳記對應表 { [workId]: timestamp }
 */
export function getFavoriteTimestamps(): Record<string, number> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TIMESTAMPS);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/**
 * 檢查某部經典是否為我的最愛
 */
export function isBookFavorite(workId: string): boolean {
  const ids = getFavoriteWorkIds();
  return ids.includes(workId);
}

/**
 * 切換（加入/取消）我的最愛狀態
 * - 加入時：記錄當前時間戳記 (Date.now())，並將 workId 移至陣列首位（最新加入）
 * - 取消時：移除 workId 並刪除對應時間戳記
 * - 自動通知全站即時更新
 */
export function toggleFavoriteBookUtil(workId: string): { isFavorite: boolean; newIds: string[] } {
  const ids = getFavoriteWorkIds();
  const timestamps = getFavoriteTimestamps();
  const now = Date.now();
  let nextIds: string[];
  let isFav: boolean;

  if (ids.includes(workId)) {
    // 取消收藏
    nextIds = ids.filter(id => id !== workId);
    delete timestamps[workId];
    isFav = false;
  } else {
    // 加入收藏：最新點選排在最前面
    nextIds = [workId, ...ids.filter(id => id !== workId)];
    timestamps[workId] = now;
    isFav = true;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY_IDS, JSON.stringify(nextIds));
      localStorage.setItem(STORAGE_KEY_TIMESTAMPS, JSON.stringify(timestamps));
      window.dispatchEvent(new CustomEvent('cbeta_favorites_updated', { detail: { workId, isFavorite: isFav } }));
    } catch (e) {
      console.warn('Failed to save favorites to localStorage:', e);
    }
  }

  return { isFavorite: isFav, newIds: nextIds };
}

/**
 * 依「最近點選/加入我的最愛的時間」降序排列經典清單：
 * 排序原則：距離當下時間最近點選的最愛書籍永遠排在最前面
 */
export function getRecentFavoriteBooks(books: BookMetadata[]): BookMetadata[] {
  if (!books || books.length === 0) return [];
  const favIds = getFavoriteWorkIds();
  if (favIds.length === 0) return [];

  const timestamps = getFavoriteTimestamps();
  const bookMap = new Map<string, BookMetadata>();
  for (const b of books) {
    if (favIds.includes(b.workId)) {
      bookMap.set(b.workId, b);
    }
  }

  // 整理所有已下載的最愛書籍
  const items: Array<{ book: BookMetadata; time: number; rawIndex: number }> = [];
  favIds.forEach((id, idx) => {
    const b = bookMap.get(id);
    if (b) {
      // 若有記錄點選時間，使用 timestamp；若舊資料無時間戳記，以陣列索引倒序賦予基準時間
      const time = timestamps[id] || (1000000000000 - idx);
      items.push({ book: b, time, rawIndex: idx });
    }
  });

  // 依照點選時間由新到舊倒序排序（最新點選排最前）
  items.sort((a, b) => {
    if (b.time !== a.time) return b.time - a.time;
    return a.rawIndex - b.rawIndex;
  });

  return items.map(item => item.book);
}
