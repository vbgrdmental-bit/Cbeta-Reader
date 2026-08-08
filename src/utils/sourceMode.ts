export type SourceMode = 'primary' | 'backup';

const STORAGE_KEY = 'cbeta_source_mode';
const EVENT_NAME = 'cbeta_source_mode_changed';

/**
 * 取得當前下載與檢索模式 (優先依據 URL 參數 ?source=backup 或 ?source=primary，其次為 localStorage)
 */
export function getSourceMode(): SourceMode {
  if (typeof window === 'undefined') return 'primary';

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const sourceParam = urlParams.get('source');
    if (sourceParam === 'backup') {
      return 'backup';
    }
    if (sourceParam === 'primary') {
      return 'primary';
    }
  } catch (e) {
    // 忽略 URL 解析例外
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'backup' || stored === 'primary') {
      return stored;
    }
  } catch (e) {
    // 忽略 localStorage 例外
  }

  return 'primary';
}

/**
 * 設定並切換下載與檢索模式
 */
export function setSourceMode(mode: SourceMode, reloadPage = false): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (e) {
    console.warn('Failed to save source mode to localStorage:', e);
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('source', mode);
    window.history.replaceState({}, '', url.toString());
  } catch (e) {
    console.warn('Failed to update URL search params:', e);
  }

  // 廣播變更事件
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { mode } }));

  if (reloadPage) {
    window.location.reload();
  }
}

/**
 * 是否為備源檢索與下載專用模式
 */
export function isBackupMode(): boolean {
  return getSourceMode() === 'backup';
}

/**
 * 訂閱模式變更事件
 */
export function subscribeSourceMode(callback: (mode: SourceMode) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ mode: SourceMode }>;
    if (customEvent.detail && customEvent.detail.mode) {
      callback(customEvent.detail.mode);
    } else {
      callback(getSourceMode());
    }
  };

  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('popstate', handler);

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('popstate', handler);
  };
}
