import { useState, useEffect, useCallback } from 'react';

export interface BookFolder {
  id: string;
  name: string;
  bookIds: string[];
  parentId: string | null;
  color?: string;
}

const FOLDERS_STORAGE_KEY = 'cbeta_reader_folders';

/**
 * useBookshelfFolders - 書櫃資料夾系統自訂 Hook
 * 職責：
 * 1. 管理多層資料夾 CRUD 與 localStorage 持久化
 * 2. 管理資料夾導航歷史（上一頁/下一頁）
 * 3. 虛擬資料夾（近期下載、上次閱讀、我的最愛、全部）篩選切換
 */
export function useBookshelfFolders(resetFolderTrigger?: number) {
  const [folders, setFolders] = useState<BookFolder[]>(() => {
    try {
      const saved = localStorage.getItem(FOLDERS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [bookshelfStatusFilter, setBookshelfStatusFilter] = useState<'all' | 'downloads' | 'recent' | 'favorites'>('all');
  const [folderHistory, setFolderHistory] = useState<Array<string | null>>([null]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // 重新自 localStorage 讀取最新資料夾（相容舊格式）
  const reloadFolders = useCallback(() => {
    try {
      const saved = localStorage.getItem(FOLDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as BookFolder[];
        const upgraded = parsed.map((f) => ({
          ...f,
          parentId: f.parentId !== undefined ? f.parentId : null,
          color: f.color || '#3d5a45'
        }));
        setFolders(upgraded);
      }
    } catch (e) {
      console.warn('Failed to reload folders:', e);
    }
  }, []);

  // 監聽外部資料夾更新事件（如從目錄下載歸類時發布之事件）
  useEffect(() => {
    const handleSync = () => {
      reloadFolders();
    };
    window.addEventListener('cbeta_folders_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('cbeta_folders_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [reloadFolders]);

  // 持久化資料夾變更（支援物件或函式更新，不對自身重複同步觸發事件造成死循環）
  const saveFolders = useCallback((action: React.SetStateAction<BookFolder[]>) => {
    setFolders((prev) => {
      const next = typeof action === 'function' ? (action as (prev: BookFolder[]) => BookFolder[])(prev) : action;
      try {
        localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save folders to localStorage:', e);
      }
      return next;
    });
  }, []);

  // 導航至特定資料夾並推進歷史
  const navigateToFolder = useCallback((folderId: string | null) => {
    let targetFolderId = folderId;
    if (folderId === 'virtual_unclassified') {
      setBookshelfStatusFilter('downloads');
      targetFolderId = 'virtual_my_folders';
    } else if (folderId === 'virtual_recent_reads') {
      setBookshelfStatusFilter('recent');
      targetFolderId = 'virtual_my_folders';
    } else if (folderId === 'virtual_favorites') {
      setBookshelfStatusFilter('favorites');
      targetFolderId = 'virtual_my_folders';
    }

    setFolderHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(targetFolderId);
      return next;
    });
    setHistoryIndex((prev) => prev + 1);
    setCurrentFolderId(targetFolderId);
  }, [historyIndex]);

  // 回到上一頁資料夾
  const handleGoBack = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setCurrentFolderId(folderHistory[prevIdx]);
    } else {
      setCurrentFolderId(null);
    }
  }, [historyIndex, folderHistory]);

  // 前往下一頁資料夾
  const handleGoForward = useCallback(() => {
    if (historyIndex < folderHistory.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setCurrentFolderId(folderHistory[nextIdx]);
    }
  }, [historyIndex, folderHistory]);

  // 新增資料夾
  const createFolder = useCallback((name: string, parentId: string | null = null, color = '#8b7355') => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const newFolder: BookFolder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      bookIds: [],
      parentId,
      color
    };
    const updated = [...folders, newFolder];
    saveFolders(updated);
    return newFolder;
  }, [folders, saveFolders]);

  // 刪除資料夾
  const deleteFolder = useCallback((folderId: string) => {
    const updated = folders.filter((f) => f.id !== folderId && f.parentId !== folderId);
    saveFolders(updated);
    if (currentFolderId === folderId) {
      navigateToFolder(null);
    }
  }, [folders, saveFolders, currentFolderId, navigateToFolder]);

  // 重新命名資料夾
  const renameFolder = useCallback((folderId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const updated = folders.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f));
    saveFolders(updated);
  }, [folders, saveFolders]);

  // 調換資料夾順序
  const swapFolderOrder = useCallback((folderId: string, direction: 'left' | 'right') => {
    const targetIdx = folders.findIndex((f) => f.id === folderId);
    if (targetIdx === -1) return;
    const swapIdx = direction === 'left' ? targetIdx - 1 : targetIdx + 1;
    if (swapIdx < 0 || swapIdx >= folders.length) return;

    const next = [...folders];
    const temp = next[targetIdx];
    next[targetIdx] = next[swapIdx];
    next[swapIdx] = temp;
    saveFolders(next);
  }, [folders, saveFolders]);

  // 移動書籍至資料夾
  const moveBooksToFolder = useCallback((bookIds: string[], targetFolderId: string | null) => {
    const updated = folders.map((f) => {
      // 先從所有其他資料夾移除
      const cleanedBookIds = f.bookIds.filter((id) => !bookIds.includes(id));
      if (f.id === targetFolderId) {
        // 移入目標資料夾
        return { ...f, bookIds: [...cleanedBookIds, ...bookIds] };
      }
      return { ...f, bookIds: cleanedBookIds };
    });
    saveFolders(updated);
  }, [folders, saveFolders]);

  // 重置資料夾信號
  useEffect(() => {
    if (resetFolderTrigger && resetFolderTrigger > 0) {
      setCurrentFolderId(null);
      setFolderHistory([null]);
      setHistoryIndex(0);
    }
  }, [resetFolderTrigger]);

  return {
    folders,
    setFolders: saveFolders,
    currentFolderId,
    setCurrentFolderId,
    bookshelfStatusFilter,
    setBookshelfStatusFilter,
    folderHistory,
    setFolderHistory,
    historyIndex,
    setHistoryIndex,
    navigateToFolder,
    handleGoBack,
    handleGoForward,
    createFolder,
    deleteFolder,
    renameFolder,
    swapFolderOrder,
    moveBooksToFolder,
    reloadFolders
  };
}
