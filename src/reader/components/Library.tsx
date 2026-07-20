import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Check, AlertCircle, X, Download, BookOpen,
  Home, Search,
  Folder, FolderPlus, Edit3, ChevronLeft, ChevronRight, GripVertical, ArrowUp, Settings
} from 'lucide-react';
import type { BookMetadata, ReaderPackage } from '../../types/book';
import { listBooks, deleteBook } from '../../utils/db';
import type { AppSettings } from '../../utils/db';
import { IndexBuilder } from '../../builder/IndexBuilder';
import type { SearchResult } from '../../builder/IndexBuilder';
import { PackageBuilder } from '../../builder/PackageBuilder';
import type { BuildProgress, BuildStep } from '../../builder/PackageBuilder';
import { SearchPanel } from './SearchPanel';
import '../styles/library.css';

interface LibraryProps {
  onSelectBook: (workId: string, segmentId?: string, searchQuery?: string) => void;
  booksUpdatedTrigger: number;
  settings: AppSettings;
  initialSearchQuery?: string;
  resetFolderTrigger?: number;
  onOpenSettings?: () => void;
}

export function Library({ 
  onSelectBook, 
  booksUpdatedTrigger,
  settings,
  initialSearchQuery,
  resetFolderTrigger,
  onOpenSettings
}: LibraryProps) {
  const [downloadedBooks, setDownloadedBooks] = useState<BookMetadata[]>([]);
  const [downloadedPackages, setDownloadedPackages] = useState<ReaderPackage[]>([]);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<SearchResult[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  
  // Builder 進度與動畫
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null);
  const [activeTab, setActiveTab] = useState<'shelf' | 'search'>(initialSearchQuery ? 'search' : 'shelf');
  const [draggingWorkId, setDraggingWorkId] = useState<string | null>(null);
  const [loadingDots, setLoadingDots] = useState('...');
  const [lastReadBookInfo, setLastReadBookInfo] = useState<{ workId: string; title: string; juan: number; segmentId?: string } | null>(null);
  const [progressUpdatedTrigger, setProgressUpdatedTrigger] = useState(0);

  // 💡 自動讀取最後一次閱讀的歷史佛經
  useEffect(() => {
    const lastWorkId = localStorage.getItem('last_read_work_id');
    if (lastWorkId) {
      const matchedBook = downloadedBooks.find(b => b.workId === lastWorkId);
      if (matchedBook) {
        const progressStr = localStorage.getItem(`reader_progress_${lastWorkId}`);
        if (progressStr) {
          try {
            const progress = JSON.parse(progressStr);
            setLastReadBookInfo({
              workId: lastWorkId,
              title: matchedBook.title,
              juan: progress.juan || 1,
              segmentId: progress.segmentId || ''
            });
          } catch {
            setLastReadBookInfo(null);
          }
        } else {
          setLastReadBookInfo({
            workId: lastWorkId,
            title: matchedBook.title,
            juan: 1
          });
        }
      } else {
        setLastReadBookInfo(null);
      }
    } else {
      setLastReadBookInfo(null);
    }
  }, [downloadedBooks]);

  useEffect(() => {
    let interval: number;
    if (buildProgress) {
      interval = window.setInterval(() => {
        setLoadingDots((prev) => {
          if (prev === '.') return '..';
          if (prev === '..') return '...';
          return '.';
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [buildProgress]);

  // === 資料夾系統結構與狀態 ===
  interface BookFolder {
    id: string;
    name: string;
    bookIds: string[];
    parentId: string | null; // 支援多層資料夾
    color?: string;
  }

  const [folders, setFolders] = useState<BookFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // 💡 資料夾瀏覽歷史紀錄，用於支援正方形上一頁（<）與下一頁（>）導航按鈕
  const [folderHistory, setFolderHistory] = useState<Array<string | null>>([null]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const navigateToFolder = (folderId: string | null) => {
    // 當使用者手動點選資料夾時，截斷並寫入新歷史
    const newHistory = folderHistory.slice(0, historyIndex + 1);
    newHistory.push(folderId);
    setFolderHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentFolderId(folderId);
  };

  const handleGoBack = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setCurrentFolderId(folderHistory[prevIdx]);
    }
  };

  const handleGoForward = () => {
    if (historyIndex < folderHistory.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setCurrentFolderId(folderHistory[nextIdx]);
    }
  };

  // 💡 當接收到首頁重設信號時，重置當前所在的資料夾路徑與瀏覽歷史
  useEffect(() => {
    if (resetFolderTrigger && resetFolderTrigger > 0) {
      setCurrentFolderId(null);
      setFolderHistory([null]);
      setHistoryIndex(0);
    }
  }, [resetFolderTrigger]);

  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);

  // 💡 整理編輯模式狀態（長按卡片進入，空白點選退出，手把與垃圾桶平常隱藏，模式下才顯現）
  const [isEditMode, setIsEditMode] = useState(false);
  const [dragOverSortTargetId, setDragOverSortTargetId] = useState<string | null>(null);
  const [dragOverFolderTargetId, setDragOverFolderTargetId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const startLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (isEditMode) return;
    
    const target = e.target as HTMLElement;
    // 點擊 actions 按鈕或 input 等控制項不觸發長按
    if (
      target.closest('button') || 
      target.closest('.list-folder-actions') || 
      target.closest('input')
    ) {
      return;
    }

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    
    longPressTimerRef.current = window.setTimeout(() => {
      setIsEditMode(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 700); // 700 毫秒長按判定
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // 💡 遞迴計算某一層（包括該層所有的子資料夾中）的經典總數
  const getFolderTotalBookCount = (folderId: string | null): number => {
    let count = 0;
    
    if (!folderId) {
      // 1. 首頁直接持有的書籍（不在任何資料夾內的書籍）
      const allInFolderBookIds = folders.flatMap(f => f.bookIds);
      count = downloadedBooks.filter(b => !allInFolderBookIds.includes(b.workId)).length;
    } else {
      // 2. 當前資料夾直接持有的書籍
      const folder = folders.find(f => f.id === folderId);
      if (folder) {
        count = folder.bookIds.length;
      }
    }

    // 3. 累加所有屬於當前層級下的子資料夾內部的書籍
    const subFolders = folders.filter(f => f.parentId === folderId);
    for (const sub of subFolders) {
      count += getFolderTotalBookCount(sub.id);
    }

    return count;
  };

  // 💡 全域空白處點擊監聽：當處於編輯模式時，點擊任何經書卡片、手把與編輯按鈕以外的任意全域空白處，立刻退出編輯模式
  useEffect(() => {
    if (!isEditMode) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.list-book-item') &&
        !target.closest('.square-btn') &&
        !target.closest('.library-header-btn') &&
        !target.closest('.folder-add-sub-btn-flat') &&
        !target.closest('.edit-action-btn') &&
        !target.closest('.item-actions-panel')
      ) {
        setIsEditMode(false);
      }
    };

    // 延遲綁定以防當下長按觸發時的 MouseUp 立即觸發退出
    const timer = setTimeout(() => {
      document.addEventListener('click', handleGlobalClick);
      document.addEventListener('touchstart', handleGlobalClick as any);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick as any);
    };
  }, [isEditMode]);

  const handleShelfBackgroundClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 若點擊的不是卡片、不是任何正方形按鈕與頂層按鈕，則退出編輯模式
    if (
      !target.closest('.list-book-item') && 
      !target.closest('.square-btn') && 
      !target.closest('.library-header-btn') &&
      !target.closest('.folder-add-sub-btn-flat')
    ) {
      setIsEditMode(false);
    }
  };

  // 💡 計算拖曳懸停時是應該渲染「上方」還是「下方」提示線（排序用）
  const getDragOverLineClass = (targetId: string) => {
    if (!draggingWorkId || dragOverSortTargetId !== targetId || draggingWorkId === targetId) return '';
    
    // 如果是資料夾拖曳，或者是在對比資料夾與經典，預設放上面
    if (draggingWorkId.startsWith('folder-') || targetId.startsWith('folder-')) {
      const sourceIdx = folders.findIndex(f => f.id === draggingWorkId);
      const targetIdx = folders.findIndex(f => f.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1) return 'drag-over-top';
      return sourceIdx < targetIdx ? 'drag-over-bottom' : 'drag-over-top';
    }

    // 經典拖曳
    const sourceIdx = downloadedBooks.findIndex(b => b.workId === draggingWorkId);
    const targetIdx = downloadedBooks.findIndex(b => b.workId === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return 'drag-over-top';

    return sourceIdx < targetIdx ? 'drag-over-bottom' : 'drag-over-top';
  };
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // 載入資料夾設置並相容舊格式
  useEffect(() => {
    const savedFolders = localStorage.getItem('cbeta_reader_folders');
    if (savedFolders) {
      try {
        const parsed = JSON.parse(savedFolders) as BookFolder[];
        const upgraded = parsed.map(f => ({
          ...f,
          parentId: f.parentId !== undefined ? f.parentId : null
        }));
        setFolders(upgraded);
      } catch (e) {
        console.error('Failed to parse folders from localStorage:', e);
      }
    }
  }, []);

  // 儲存資料夾設定
  const saveFolders = (newFolders: BookFolder[]) => {
    setFolders(newFolders);
    localStorage.setItem('cbeta_reader_folders', JSON.stringify(newFolders));
  };

  // 建立資料夾
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    
    const newFolder: BookFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      bookIds: [],
      parentId: currentFolderId // 子資料夾的 parentId 為當前資料夾 ID
    };
    
    saveFolders([...folders, newFolder]);
    setNewFolderName('');
    setShowNewFolderDialog(false);
  };

  // 刪除資料夾
  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const folderToDelete = folders.find(f => f.id === folderId);
    if (!folderToDelete) return;
    const confirm = window.confirm("確定要刪除此資料夾嗎？內部的子資料夾與經典將移至上一層。");
    if (!confirm) return;
    
    const parentId = folderToDelete.parentId;
    let updatedFolders = folders.filter(f => f.id !== folderId);
    
    // 1. 將子資料夾移至上一層 parentId
    updatedFolders = updatedFolders.map(f => {
      if (f.parentId === folderId) {
        return { ...f, parentId };
      }
      return f;
    });
    
    // 2. 將內部經典移至上一層
    if (parentId) {
      updatedFolders = updatedFolders.map(f => {
        if (f.id === parentId) {
          const combinedBooks = Array.from(new Set([...f.bookIds, ...folderToDelete.bookIds]));
          return { ...f, bookIds: combinedBooks };
        }
        return f;
      });
    }
    
    saveFolders(updatedFolders);
    
    // 若當前身處被刪除的資料夾，退回上一層
    if (currentFolderId === folderId) {
      setCurrentFolderId(parentId);
    }
  };

  // 啟動資料夾重新命名
  const startRenameFolder = (folder: BookFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  // 保存資料夾重新命名
  const handleRenameFolder = () => {
    if (!editingFolderName.trim() || !editingFolderId) return;
    const updated = folders.map(f => {
      if (f.id === editingFolderId) {
        return { ...f, name: editingFolderName.trim() };
      }
      return f;
    });
    saveFolders(updated);
    setEditingFolderId(null);
  };

  // 拖曳移入資料夾
  const handleDropIntoFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData('text/plain') || draggingWorkId;
    if (!dragId || dragId === folderId) return;

    if (dragId.startsWith('folder-')) {
      // 💡 嵌套資料夾：將資料夾拖入另一個資料夾
      // 防範循環嵌套 (Descendant Check)
      const isDescendantOf = (childId: string, parentId: string): boolean => {
        let current: BookFolder | undefined = folders.find(f => f.id === childId);
        while (current && current.parentId) {
          if (current.parentId === parentId) return true;
          const nextParentId = current.parentId;
          current = folders.find(f => f.id === nextParentId);
        }
        return false;
      };

      if (isDescendantOf(folderId, dragId)) {
        console.warn('Cannot drop parent folder into its child folder');
        return;
      }

      const updated = folders.map(f => {
        if (f.id === dragId) {
          return { ...f, parentId: folderId };
        }
        return f;
      });
      saveFolders(updated);
    } else {
      // 💡 將經典拖入資料夾
      const updated = folders.map(f => {
        if (f.id === folderId) {
          const bookIds = f.bookIds.includes(dragId) ? f.bookIds : [...f.bookIds, dragId];
          return { ...f, bookIds };
        }
        return { ...f, bookIds: f.bookIds.filter(id => id !== dragId) };
      });
      saveFolders(updated);
    }
    setDraggingWorkId(null);
  };

  // 將經典移出資料夾至上一層 (parentId 代表的資料夾)
  const handleRemoveFromFolder = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    if (!currentFolderId) return;

    const currentFolder = folders.find(f => f.id === currentFolderId);
    if (!currentFolder) return;

    const parentId = currentFolder.parentId; // 上一層資料夾 ID (可以是 null 也就是首頁)

    const updated = folders.map(f => {
      // 1. 從當前資料夾移除
      if (f.id === currentFolderId) {
        return { ...f, bookIds: f.bookIds.filter(id => id !== bookId) };
      }
      // 2. 加入到上一層資料夾中 (如果上一層不是首頁的話)
      if (parentId && f.id === parentId) {
        const bookIds = f.bookIds.includes(bookId) ? f.bookIds : [...f.bookIds, bookId];
        return { ...f, bookIds };
      }
      return f;
    });

    saveFolders(updated);
  };

  // 💡 將子資料夾移出至上一層 (parentId 代表的上一層資料夾，若是首頁則為 null)
  const handleRemoveFolderFromFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    const folder = folders.find(f => f.id === folderId);
    if (!folder || !folder.parentId) return;

    // 尋找父資料夾以取得其 parentId（即上上層 ID，可以是 null）
    const parentFolder = folders.find(f => f.id === folder.parentId);
    const grandParentId = parentFolder ? parentFolder.parentId : null;

    const updated = folders.map(f => {
      if (f.id === folderId) {
        return { ...f, parentId: grandParentId };
      }
      return f;
    });

    saveFolders(updated);
  };

  // 資料夾手把間上下排序
  const handleFolderSort = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceFolderId = e.dataTransfer.getData('text/plain') || draggingWorkId;
    if (!sourceFolderId || !sourceFolderId.startsWith('folder-') || sourceFolderId === targetFolderId) return;

    setFolders((prev) => {
      const sourceIdx = prev.findIndex(f => f.id === sourceFolderId);
      const targetIdx = prev.findIndex(f => f.id === targetFolderId);
      if (sourceIdx === -1 || targetIdx === -1) return prev;

      const newFolders = [...prev];
      const [removed] = newFolders.splice(sourceIdx, 1);
      newFolders.splice(targetIdx, 0, removed);

      localStorage.setItem('cbeta_reader_folders', JSON.stringify(newFolders));
      return newFolders;
    });
    setDraggingWorkId(null);
  };

  // 書籍手把間排序
  const handleBookSort = (e: React.DragEvent, targetWorkId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceWorkId = e.dataTransfer.getData('text/plain') || draggingWorkId;
    if (!sourceWorkId || sourceWorkId.startsWith('folder-') || sourceWorkId === targetWorkId) return;

    setDownloadedBooks((prev) => {
      const sourceIndex = prev.findIndex(b => b.workId === sourceWorkId);
      const targetIndex = prev.findIndex(b => b.workId === targetWorkId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const newBooks = [...prev];
      const [removed] = newBooks.splice(sourceIndex, 1);
      newBooks.splice(targetIndex, 0, removed);

      const orderList = newBooks.map(b => b.workId);
      localStorage.setItem('cbeta_reader_shelf_order', JSON.stringify(orderList));
      return newBooks;
    });
    setDraggingWorkId(null);
  };

  // 刪除經典暫存 ID
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);

  // HTML5 拖曳排序事件處理
  const handleDragStart = (e: React.DragEvent, id: string) => {
    // 💡 只有在編輯模式下才放行拖曳，平常日常點閱時進行攔截阻斷，防範干擾正常點選
    if (!isEditMode) {
      e.preventDefault();
      return;
    }
    setDraggingWorkId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetWorkId: string) => {
    e.preventDefault();
    const sourceWorkId = e.dataTransfer.getData('text/plain') || draggingWorkId;
    if (!sourceWorkId || sourceWorkId === targetWorkId) return;

    setDownloadedBooks((prev) => {
      const sourceIndex = prev.findIndex(b => b.workId === sourceWorkId);
      const targetIndex = prev.findIndex(b => b.workId === targetWorkId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const newBooks = [...prev];
      const [removed] = newBooks.splice(sourceIndex, 1);
      newBooks.splice(targetIndex, 0, removed);

      // 保存書架排序
      const orderList = newBooks.map(b => b.workId);
      localStorage.setItem('cbeta_reader_book_order', JSON.stringify(orderList));
      return newBooks;
    });

    setDraggingWorkId(null);
  };

  // 讀取本地已下載的經典
  const loadLocalBooks = async () => {
    try {
      const booksMeta = await listBooks();
      
      // 套用儲存的自訂順序
      const savedOrder = localStorage.getItem('cbeta_reader_book_order');
      if (savedOrder) {
        const orderList = JSON.parse(savedOrder) as string[];
        booksMeta.sort((a, b) => {
          const idxA = orderList.indexOf(a.workId);
          const idxB = orderList.indexOf(b.workId);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }

      setDownloadedBooks(booksMeta);

      // 同步讀取 package，以供本地檢索使用
      const { getBook } = await import('../../utils/db');
      const pkgs: ReaderPackage[] = [];
      for (const meta of booksMeta) {
        const pkg = await getBook(meta.workId);
        if (pkg) pkgs.push(pkg);
      }
      setDownloadedPackages(pkgs);
    } catch (e) {
      console.error('Failed to load local books from IndexedDB:', e);
    }
  };

  useEffect(() => {
    loadLocalBooks();
  }, [booksUpdatedTrigger]);

  // 線上搜尋 CBETA 經典
  const handleOnlineSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onlineSearchQuery.trim()) return;

    setIsSearchingOnline(true);
    try {
      const results = await IndexBuilder.searchTitle(onlineSearchQuery);
      setOnlineResults(results);
    } catch (e) {
      console.error('Online search failed:', e);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // 下載並匯入經典
  const handleDownloadBook = async (searchResult: SearchResult) => {
    try {
      await PackageBuilder.downloadAndPackage(searchResult, (progress) => {
        setBuildProgress(progress);
      });
      await loadLocalBooks();
      setTimeout(() => {
        setBuildProgress(null);
      }, 1500);
    } catch (error) {
      console.error('Download and packaging failed:', error);
      setTimeout(() => {
        setBuildProgress(null);
      }, 3000);
    }
  };

  // 觸發確認刪除對話框
  const handleDeleteBook = (e: React.MouseEvent, workId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setBookToDelete(workId);
  };

  // 執行確認刪除
  const confirmDeleteBook = async () => {
    if (!bookToDelete) return;
    try {
      await deleteBook(bookToDelete);
      await loadLocalBooks();
    } catch (e) {
      console.error('Delete book failed:', e);
    } finally {
      setBookToDelete(null);
    }
  };

  // 渲染下載步驟圖示
  const renderStepIcon = (targetStep: BuildStep, itemIndex: number, currentProgressStep: BuildStep) => {
    const stepsOrder: BuildStep[] = ['metadata', 'fetch_content', 'navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed'];
    const currentIndex = stepsOrder.indexOf(currentProgressStep);
    const targetIndex = stepsOrder.indexOf(targetStep);

    if (currentProgressStep === 'failed') {
      return <AlertCircle size={14} style={{ color: '#bd3a3a' }} />;
    }

    if (currentIndex > targetIndex) {
      return <Check size={14} style={{ color: 'var(--color-wood-300)' }} />;
    } else if (currentProgressStep === targetStep) {
      return <div className="builder-step-icon animate-spin-slow">⏳</div>;
    } else {
      return <span style={{ opacity: 0.3 }}>{itemIndex}</span>;
    }
  };

  // 本地搜尋結果點擊跳轉
  const handleSelectSearchResult = (workId: string, _juan: number, segmentId: string, query: string) => {
    onSelectBook(workId, segmentId, query);
  };

  // 線裝書典雅封面底色配置
  const getBookCoverColor = (workId: string) => {
    const colors: { [key: string]: string } = {
      T0412: '#2b4c7e', // 紺青 (地藏經)
      T0262: '#782d2d', // 緋紅 (法華經)
    };
    return colors[workId] || '#4a5b4e'; // 竹綠 (其餘)
  };

  // === 篩選渲染資料夾與書籍 ===
  // 💡 收集並排序所有有閱讀進度的經典
  const resumeBooks = React.useMemo(() => {
    const list: Array<{ book: BookMetadata; progress: { juan: number; segmentId: string; timestamp: number } }> = [];
    
    downloadedBooks.forEach((book) => {
      const progressStr = localStorage.getItem(`reader_progress_${book.workId}`);
      if (progressStr) {
        try {
          const progress = JSON.parse(progressStr);
          if (progress.juan || progress.segmentId) {
            list.push({
              book,
              progress: {
                juan: progress.juan || 1,
                segmentId: progress.segmentId || '',
                timestamp: progress.timestamp || 0
              }
            });
          }
        } catch {
          // 容錯
        }
      }
    });

    // 💡 根據 timestamp 降序排列 (最後閱讀的放最上面)
    list.sort((a, b) => b.progress.timestamp - a.progress.timestamp);
    return list;
  }, [downloadedBooks, progressUpdatedTrigger]);

  const handleDeleteProgress = (e: React.MouseEvent, workId: string) => {
    e.stopPropagation();
    e.preventDefault();
    localStorage.removeItem(`reader_progress_${workId}`);
    
    const lastWorkId = localStorage.getItem('last_read_work_id');
    if (lastWorkId === workId) {
      localStorage.removeItem('last_read_work_id');
    }
    
    setProgressUpdatedTrigger(prev => prev + 1);
  };

  const allInFolderBookIds = folders.flatMap(f => f.bookIds);
  
  // 如果是虛擬的「繼續閱讀」資料夾，不顯示任何子資料夾
  const displayFolders = currentFolderId === 'virtual_resume'
    ? []
    : folders.filter(f => f.parentId === currentFolderId);
    
  // 如果是虛擬的「繼續閱讀」資料夾，顯示有進度的書籍；否則顯示對應資料夾下的書籍
  const displayBooks = currentFolderId === 'virtual_resume'
    ? resumeBooks.map(item => item.book)
    : (currentFolderId
        ? downloadedBooks.filter(b => {
            const f = folders.find(folder => folder.id === currentFolderId);
            return f ? f.bookIds.includes(b.workId) : false;
          })
        : downloadedBooks.filter(b => !allInFolderBookIds.includes(b.workId)));


  // 獲取當前資料夾路徑麵包屑
  const getFolderPath = (folderId: string | null): string => {
    if (!folderId) return '首頁';
    const path: string[] = [];
    let currentId: string | null = folderId;
    let safetyCounter = 0;
    while (currentId && safetyCounter < 50) {
      const f = folders.find(folder => folder.id === currentId);
      if (f) {
        path.unshift(f.name);
        currentId = f.parentId;
      } else {
        break;
      }
      safetyCounter++;
    }
    return ['首頁', ...path].join(' / ');
  };

  return (
    <div className="library-container custom-scrollbar">
      
      {/* 首頁一致控制列 */}
      <div className="library-header animate-fade-in">
        <button 
          className={`library-header-btn ${activeTab === 'shelf' && !currentFolderId ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('shelf');
            setCurrentFolderId(null);
            setFolderHistory([null]);
            setHistoryIndex(0);
          }}
          title="書架首頁"
        >
          <Home size={20} />
        </button>

        {/* 只有在書架分頁 (shelf) 時才渲染後續按鈕 */}
        {activeTab === 'shelf' && (
          <>
            <div className="control-divider" />
            
            {currentFolderId === null ? (
              // 💡 1. 處於最外層首頁：顯示「下載新佛典（+）」與「新建資料夾」
              <>
                <button
                  className="library-header-btn"
                  onClick={async () => {
                    const defaultFeatured = await IndexBuilder.searchTitle('');
                    setOnlineResults(defaultFeatured);
                    setShowSearchDialog(true);
                  }}
                  title="下載新佛典"
                >
                  <Plus size={20} />
                </button>
                <button
                  className="library-header-btn"
                  onClick={() => setShowNewFolderDialog(true)}
                  title="新建資料夾"
                >
                  <FolderPlus size={18} />
                </button>
              </>
            ) : (
              // 💡 2. 處於第 2 層以上的資料夾內：將「<」和「>」整合到最上方控制列，並移去「+」下載按鈕
              <>
                <button
                  className="library-header-btn"
                  onClick={handleGoBack}
                  disabled={historyIndex === 0}
                  title="返回上一頁"
                  style={{ opacity: historyIndex === 0 ? 0.3 : 1 }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="library-header-btn"
                  onClick={handleGoForward}
                  disabled={historyIndex >= folderHistory.length - 1}
                  title="前進下一頁"
                  style={{ opacity: historyIndex >= folderHistory.length - 1 ? 0.3 : 1 }}
                >
                  <ChevronRight size={20} />
                </button>
                <button
                  className="library-header-btn"
                  onClick={() => setShowNewFolderDialog(true)}
                  title="新建資料夾"
                >
                  <FolderPlus size={18} />
                </button>
              </>
            )}
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* 只有在書架分頁時才顯示放大鏡，點擊切換至搜尋分頁 */}
          {activeTab === 'shelf' && (
            <button 
              className="library-header-btn"
              onClick={() => setActiveTab('search')}
              title="本地經典檢索"
            >
              <Search size={20} />
            </button>
          )}

          {/* 齒輪設定按鈕（一律在最右端顯示，點擊開啟與閱讀頁相同的設定彈窗） */}
          <button 
            className="library-header-btn"
            onClick={onOpenSettings}
            title="閱讀設定"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {activeTab === 'shelf' ? (
        /* 書架主畫面 */
        <div className="bookshelf-section animate-slide-up" onClick={handleShelfBackgroundClick}>
          {/* 資料夾導航與麵包屑 */}
          {currentFolderId && (
            <div className="folder-nav-wrapper">
              <div className="folder-navigation-bar">

                <div className="folder-nav-middle">
                  <span className="folder-path-display">
                    {currentFolderId === 'virtual_resume' ? '繼續閱讀' : getFolderPath(currentFolderId)}
                  </span>
                </div>
                <div className="folder-nav-right">
                  <span className="folder-book-count-badge" title="當前層級經典總數 (含子資料夾)">
                    {currentFolderId === 'virtual_resume' ? displayBooks.length : getFolderTotalBookCount(currentFolderId)}
                  </span>
                </div>
              </div>
              {currentFolderId !== 'virtual_resume' && (
                <div className="folder-sub-actions">
                  <button className="folder-add-sub-btn-flat" onClick={() => setShowNewFolderDialog(true)}>
                    <Plus size={13} /> 新建子資料夾
                  </button>
                </div>
              )}
            </div>
          )}

          {!currentFolderId && (
            <div className="library-title-area">
              <h1>淨 心 閱 讀</h1>
              <p>以CBETA為主的電子大藏經閱讀器</p>
              {lastReadBookInfo && (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '0.8rem auto 0 auto' }}>
                  <div className="resume-reading-box" onClick={() => onSelectBook(lastReadBookInfo.workId, lastReadBookInfo.segmentId)} title="點擊繼續閱讀">
                    <span className="resume-tag">接續閱讀</span>
                    <span className="resume-title" style={{ textAlign: 'left' }}>{lastReadBookInfo.title}</span>
                    <span className="resume-arrow">➔</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 清單模式（唯一） */}
          <div className="shelf-list">
            {/* 💡 第一次進入且無經典時，顯示「+ 點此下載佛典」長 Bar 導引 */}
            {!currentFolderId && downloadedBooks.length === 0 && (
              <div 
                className="empty-download-bar animate-pulse"
                onClick={async () => {
                  const defaultFeatured = await IndexBuilder.searchTitle('');
                  setOnlineResults(defaultFeatured);
                  setShowSearchDialog(true);
                }}
                title="檢索 CBETA 並匯入經典"
              >
                <Plus size={20} style={{ marginRight: '6px' }} />
                <span>點此下載佛典</span>
              </div>
            )}

            {/* === A. 渲染資料夾清單 === */}
            {displayFolders.map((folder) => (
              <div 
                key={folder.id}
                className={`list-book-item list-folder-item ${draggingWorkId === folder.id ? 'dragging' : ''} ${isEditMode ? 'edit-mode' : ''} ${getDragOverLineClass(folder.id)} ${dragOverFolderTargetId === folder.id ? 'drag-folder-hover' : ''}`}
                onClick={() => navigateToFolder(folder.id)}
                draggable={currentFolderId !== 'virtual_resume'}
                onDragStart={(e) => handleDragStart(e, folder.id)}
                onDragOver={(e) => { 
                  handleDragOver(e); 
                  if (!draggingWorkId || draggingWorkId === folder.id) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relativeY = (e.clientY - rect.top) / rect.height;
                  // 💡 Y 軸上下 25% 邊緣判定為同級排序，中央 50% 判定為移入資料夾
                  if (relativeY < 0.25 || relativeY > 0.75) {
                    setDragOverSortTargetId(folder.id);
                    setDragOverFolderTargetId(null);
                  } else {
                    setDragOverFolderTargetId(folder.id);
                    setDragOverSortTargetId(null);
                  }
                }}
                onDragLeave={() => {
                  setDragOverFolderTargetId(null);
                  setDragOverSortTargetId(null);
                }}
                onDragEnd={() => {
                  setDragOverFolderTargetId(null);
                  setDragOverSortTargetId(null);
                }}
                onDrop={(e) => { 
                  if (dragOverSortTargetId) {
                    handleFolderSort(e, folder.id);
                  } else {
                    handleDropIntoFolder(e, folder.id);
                  }
                  setDragOverFolderTargetId(null);
                  setDragOverSortTargetId(null);
                }}
                onMouseDown={startLongPress}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onTouchStart={startLongPress}
                onTouchMove={cancelLongPress}
                onTouchEnd={cancelLongPress}
              >
                {/* 💡 拖曳手把：只在編輯模式下顯現，只允許拖曳此處進行同級排序（阻斷冒泡以防觸發移入） */}
                <div 
                  className="drag-handle"
                  title="按住拖曳手把進行排序或將此資料夾移入其他資料夾"
                  onDragOver={(e) => { 
                    handleDragOver(e); 
                    e.stopPropagation(); 
                    if (draggingWorkId && draggingWorkId !== folder.id) {
                      setDragOverSortTargetId(folder.id); 
                      setDragOverFolderTargetId(null); 
                    }
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation();
                    setDragOverSortTargetId(null);
                  }}
                  onDrop={(e) => {
                    handleFolderSort(e, folder.id);
                    setDragOverSortTargetId(null);
                  }}
                  onClick={(e) => e.stopPropagation()} 
                >
                  <GripVertical size={16} />
                </div>

                <div className="list-folder-icon-wrapper theme-folder-wrapper">
                  <Folder size={16} className="theme-folder-icon" />
                </div>
                <div className="list-folder-info">
                  <div className="list-folder-title">{folder.name}</div>
                </div>

                <span className="folder-book-count-badge" style={{ marginLeft: 'auto', marginRight: '0.8rem', flexShrink: 0 }} title="資料夾所含經典總數 (含子資料夾)">
                  {getFolderTotalBookCount(folder.id)}
                </span>
                <div className="item-actions-panel">
                  {/* 槽位 1：返回（移出）按鈕（第 2 層以上才渲染） */}
                  {currentFolderId && (
                    <button 
                      className="edit-action-btn edit-move-out-btn"
                      onClick={(e) => handleRemoveFolderFromFolder(e, folder.id)}
                      title="移出至上一層資料夾"
                    >
                      <ArrowUp size={16} />
                    </button>
                  )}

                  {/* 槽位 2：編輯（重新命名）按鈕 */}
                  <button 
                    className="edit-action-btn edit-rename-btn"
                    onClick={(e) => startRenameFolder(folder, e)}
                    title="重新命名"
                  >
                    <Edit3 size={14} />
                  </button>

                  {/* 槽位 3：垃圾桶（刪除）按鈕 */}
                  <button 
                    className="edit-action-btn edit-delete-btn"
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    title="刪除資料夾"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* === B. 渲染經典清單 === */}
            {displayBooks.map((book) => {
              // 💡 取得閱讀進度
              const progressStr = localStorage.getItem(`reader_progress_${book.workId}`);
              let savedProgress: { juan: number; segmentId: string } | null = null;
              if (progressStr) {
                try {
                  savedProgress = JSON.parse(progressStr);
                } catch {}
              }

              return (
                <div 
                  key={book.workId}
                  className={`list-book-item ${draggingWorkId === book.workId ? 'dragging' : ''} ${isEditMode ? 'edit-mode' : ''} ${getDragOverLineClass(book.workId)}`}
                  onClick={() => { if (!isEditMode) onSelectBook(book.workId); }}
                  draggable={currentFolderId !== 'virtual_resume'}
                  onDragStart={(e) => handleDragStart(e, book.workId)}
                  onDragOver={(e) => {
                    handleDragOver(e);
                    if (draggingWorkId && draggingWorkId !== book.workId) {
                      setDragOverSortTargetId(book.workId);
                    }
                  }}
                  onDragLeave={() => {
                    setDragOverSortTargetId(null);
                  }}
                  onDragEnd={() => {
                    setDragOverSortTargetId(null);
                    setDragOverFolderTargetId(null);
                  }}
                  onDrop={(e) => { handleDrop(e, book.workId); setDragOverSortTargetId(null); }}
                  onMouseDown={startLongPress}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={startLongPress}
                  onTouchMove={cancelLongPress}
                  onTouchEnd={cancelLongPress}
                >
                  {/* 💡 拖曳手把：只在編輯模式下顯現，只允許按住此處進行同級排序（阻斷冒泡） */}
                  {currentFolderId !== 'virtual_resume' && (
                    <div 
                      className="drag-handle"
                      title="按住拖曳手把進行排序"
                      onDragOver={(e) => { 
                        handleDragOver(e); 
                        e.stopPropagation(); 
                        if (draggingWorkId && draggingWorkId !== book.workId) {
                          setDragOverSortTargetId(book.workId); 
                        }
                      }}
                      onDragLeave={(e) => {
                        e.stopPropagation();
                        setDragOverSortTargetId(null);
                      }}
                      onDrop={(e) => {
                        handleBookSort(e, book.workId);
                        setDragOverSortTargetId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical size={16} />
                    </div>
                  )}

                  <div className="list-book-cover" style={{ backgroundColor: getBookCoverColor(book.workId) }}>
                    {book.workId}
                  </div>
                  <div className="list-book-info">
                    <div className="list-book-title">{book.title}</div>
                    <div className="list-book-meta">
                      {currentFolderId === 'virtual_resume' && savedProgress ? (
                        <span style={{ color: 'var(--theme-accent)', fontWeight: 600 }}>
                          上次讀到：第 {savedProgress.juan} 卷
                        </span>
                      ) : (
                        `${book.creators} · 共 ${book.juansCount} 卷`
                      )}
                    </div>
                  </div>
                  <div className="item-actions-panel">
                    {currentFolderId === 'virtual_resume' ? (
                      <button 
                        className="list-book-move-out"
                        onClick={(e) => handleDeleteProgress(e, book.workId)}
                        title="清除此書的閱讀記錄，不刪除原書"
                        style={{ color: '#bd3a3a', borderColor: 'rgba(189, 58, 58, 0.3)' }}
                      >
                        清除記錄
                      </button>
                    ) : (
                      <>
                        {/* 槽位 1：返回（移出）按鈕（在資料夾內才渲染） */}
                        {currentFolderId && (
                          <button 
                            className="edit-action-btn edit-move-out-btn"
                            onClick={(e) => handleRemoveFromFolder(e, book.workId)}
                            title="移出至上一層資料夾"
                          >
                            <ArrowUp size={16} />
                          </button>
                        )}

                        {/* 槽位 3：垃圾桶（刪除）按鈕 */}
                        <button 
                          className="edit-action-btn edit-delete-btn"
                          onClick={(e) => handleDeleteBook(e, book.workId)}
                          title="刪除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 本地檢索畫面 */
        <div className="animate-slide-up">
          <SearchPanel 
            books={downloadedPackages} 
            onSelectResult={handleSelectSearchResult} 
            initialSearchQuery={initialSearchQuery}
          />
        </div>
      )}

      {/* 線上搜尋並下載對話框 */}
      {showSearchDialog && (
        <div className="search-dialog-overlay" onClick={() => setShowSearchDialog(false)}>
          <div className="search-dialog-card" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>檢索 CBETA 並匯入經典</h3>
              <button className="icon-button close-btn" onClick={() => setShowSearchDialog(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="dialog-body custom-scrollbar">
              <form onSubmit={handleOnlineSearch} className="dialog-search-bar">
                <input 
                  type="text" 
                  placeholder="輸入經典名稱、cbeta編號..."
                  value={onlineSearchQuery}
                  onChange={(e) => setOnlineSearchQuery(e.target.value)}
                />
                <button type="submit" title="搜尋">
                  <Search size={18} />
                </button>
              </form>

              <div className="search-results-list">
                {onlineResults.map((res) => {
                  const isDownloaded = downloadedBooks.some(b => b.workId === res.workId);
                  return (
                    <div key={res.workId} className="search-result-item">
                      <div className="result-info">
                        <span className="result-title">{res.title}</span>
                        <span className="result-meta">
                          {res.workId} · {res.juansCount}卷 · {res.creators} · {res.category}
                        </span>
                      </div>
                      
                      {isDownloaded ? (
                        <div className="download-status-square">
                          <Check size={15} />
                        </div>
                      ) : (
                        <button className="download-btn-square" onClick={() => handleDownloadBook(res)} title="下載匯入">
                          <Download size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {isSearchingOnline && (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                    正在搜尋 CBETA 檢索經典...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Builder 進度遮罩 (下載與建置時呈現) */}
      {buildProgress && (
        <div className={`builder-progress-overlay theme-${settings.theme}`}>
          <div className="builder-animation-box">
            <div 
              className="builder-outer-ring" 
              style={{ transform: `rotate(${buildProgress.percent * 3.6}deg)`, transition: 'transform 0.2s linear' }}
            />
            <div className={`builder-mandala ${buildProgress.percent === 100 ? 'is-completed' : ''}`}>
              <BookOpen size={44} />
            </div>
          </div>

          <div className="builder-details-card animate-slide-up">
            <div className="builder-title">下載中{loadingDots}</div>
            <div className="builder-progress-bar-wrapper">
              <div className="builder-progress-bar-fill" style={{ width: `${buildProgress.percent}%` }} />
            </div>
            
            <div className="builder-step-status">
              <div className={`builder-step-item ${buildProgress.step === 'metadata' ? 'active' : ''} ${['fetch_content', 'navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>1. 取得佛典詮釋資料(Index Builder)</span>
                <span>{renderStepIcon('metadata', 1, buildProgress.step)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'fetch_content' ? 'active' : ''} ${['navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>2. 經典段落標記解析(Reader Builder)</span>
                <span>{renderStepIcon('fetch_content', 2, buildProgress.step)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'navigation' ? 'active' : ''} ${['reference', 'search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>3. 目錄結構與卷期編排(Navigation Builder)</span>
                <span>{renderStepIcon('navigation', 3, buildProgress.step)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'reference' ? 'active' : ''} ${['search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>4. 校勘註解與學術比對(Reference Builder)</span>
                <span>{renderStepIcon('reference', 4, buildProgress.step)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'search_index' ? 'active' : ''} ${['ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>5. 本地高速檢索索引建置(Search Index Builder)</span>
                <span>{renderStepIcon('search_index', 5, buildProgress.step)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'ai_index' ? 'active' : ''} ${['saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>6. AI 輔助閱讀與語意索引(AI Indexer)</span>
                <span>{renderStepIcon('ai_index', 6, buildProgress.step)}</span>
              </div>
            </div>

            <div className="builder-message">
              {buildProgress.message}
            </div>
          </div>
        </div>
      )}

      {/* 刪除經典確認視窗 */}
      {bookToDelete && (
        <div className="search-dialog-overlay" onClick={() => setBookToDelete(null)}>
          <div className="search-dialog-card animate-slide-up" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>確認刪除</h3>
              <button className="icon-button close-btn" onClick={() => setBookToDelete(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="dialog-body" style={{ gap: '1.2rem', padding: '1.5rem' }}>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.6, opacity: 0.9 }}>
                確定要從書架中刪除《{downloadedBooks.find(b => b.workId === bookToDelete)?.title}》嗎？刪除後若需要閱讀需重新下載匯入。
              </p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', width: '100%' }}>
                <button 
                  className="dialog-btn-danger"
                  onClick={confirmDeleteBook}
                >
                  確認刪除
                </button>
                <button 
                  className="dialog-btn-cancel"
                  onClick={() => setBookToDelete(null)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 新建資料夾對話框 */}
      {showNewFolderDialog && (
        <div className="search-dialog-overlay" onClick={() => setShowNewFolderDialog(false)}>
          <div className="search-dialog-card animate-slide-up" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>新建資料夾</h3>
              <button className="icon-button close-btn" onClick={() => setShowNewFolderDialog(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="dialog-body" style={{ gap: '1.2rem', padding: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="請輸入資料夾名稱..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', width: '100%' }}>
                <button 
                  className="dialog-btn-confirm"
                  onClick={handleCreateFolder}
                >
                  確認建立
                </button>
                <button 
                  className="dialog-btn-cancel"
                  onClick={() => setShowNewFolderDialog(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重新命名資料夾對話框 */}
      {editingFolderId && (
        <div className="search-dialog-overlay" onClick={() => setEditingFolderId(null)}>
          <div className="search-dialog-card animate-slide-up" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>重新命名資料夾</h3>
              <button className="icon-button close-btn" onClick={() => setEditingFolderId(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="dialog-body" style={{ gap: '1.2rem', padding: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="請輸入新資料夾名稱..."
                value={editingFolderName}
                onChange={(e) => setEditingFolderName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameFolder();
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', width: '100%' }}>
                <button 
                  className="dialog-btn-confirm"
                  onClick={handleRenameFolder}
                >
                  確認修改
                </button>
                <button 
                  className="dialog-btn-cancel"
                  onClick={() => setEditingFolderId(null)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Library;
