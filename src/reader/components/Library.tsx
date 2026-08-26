import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Check, CheckSquare, CheckCircle2, X, Download,
  Home, Search,
  Folder, FolderPlus, Edit3, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUp, Settings, Clock, Heart, Trash2, FolderInput, MoreVertical, Notebook, BookOpen, Play, RotateCcw
} from 'lucide-react';
import type { BookMetadata, ReaderPackage } from '../../types/book';
import { listBooks, deleteBook, getAllHighlights, deleteHighlight, saveHighlight } from '../../utils/db';
import type { AppSettings, BookHighlight } from '../../utils/db';
import { IndexBuilder, FEATURED_BOOKS, sanitizeCreators } from '../../builder/IndexBuilder';
import type { SearchResult } from '../../builder/IndexBuilder';
import { PackageBuilder } from '../../builder/PackageBuilder';
import type { BuildProgress } from '../../builder/PackageBuilder';
import { BuilderProgressOverlay } from './BuilderProgressOverlay';
import { SearchPanel } from './SearchPanel';
import { isBackupMode, subscribeSourceMode } from '../../utils/sourceMode';
import '../styles/library.css';

interface LibraryProps {
  onSelectBook: (workId: string, segmentId?: string, searchQuery?: string, autoResumeMode?: 'resume' | 'restart') => void;
  booksUpdatedTrigger: number;
  settings: AppSettings;
  initialSearchQuery?: string;
  resetFolderTrigger?: number;
  onOpenSettings?: () => void;
  onOpenCbetaCatalog?: () => void;
}

export function Library({ 
  onSelectBook, 
  booksUpdatedTrigger,
  settings,
  initialSearchQuery,
  resetFolderTrigger,
  onOpenSettings,
  onOpenCbetaCatalog
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
  const [progressUpdatedTrigger, setProgressUpdatedTrigger] = useState(0);

  const [isBackup, setIsBackup] = useState(isBackupMode());

  useEffect(() => {
    return subscribeSourceMode((mode) => setIsBackup(mode === 'backup'));
  }, []);

  const isLongPressTriggeredRef = useRef(false);

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

  // 💡 整理編輯模式狀態（長按卡片進入，空白點選退出，按鈕平常隱藏，模式下才顯現）
  const [isEditMode, setIsEditMode] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // 批量選擇經書狀態
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [showBatchMoveDialog, setShowBatchMoveDialog] = useState(false);

  // 「...」選項 Modal 狀態
  const [showFolderManagerModal, setShowFolderManagerModal] = useState(false);
  const [menuTargetFolder, setMenuTargetFolder] = useState<BookFolder | null>(null);
  const [menuTargetBook, setMenuTargetBook] = useState<BookMetadata | null>(null);
  const [menuTargetBookSource, setMenuTargetBookSource] = useState<string | null>(null);

  const [selectedOnlineWorkIds, setSelectedOnlineWorkIds] = useState<string[]>([]);
  const [showBatchDownloadModal, setShowBatchDownloadModal] = useState(false);
  const [batchFolderMode, setBatchFolderMode] = useState<'new' | 'existing' | 'none'>('new');
  const [batchFolderName, setBatchFolderName] = useState('');
  const [selectedExistingFolderId, setSelectedExistingFolderId] = useState<string>('');
  const batchFolderColor = '#8b7355';

  // 💡 直接位於「我的書櫃」頂層的經書 ID 清單 (localStorage 持久化)
  const [myBookshelfBookIds, setMyBookshelfBookIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cbeta_my_bookshelf_book_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveMyBookshelfBookIds = (ids: string[]) => {
    setMyBookshelfBookIds(ids);
    localStorage.setItem('cbeta_my_bookshelf_book_ids', JSON.stringify(ids));
  };

  const getBookCjkChars = (book: BookMetadata): number => {
    if (book.cjkChars && typeof book.cjkChars === 'number' && book.cjkChars > 0) {
      return book.cjkChars;
    }
    const feat = FEATURED_BOOKS.find(b => b.workId === book.workId);
    if (feat?.cjkChars && feat.cjkChars > 0) {
      return feat.cjkChars;
    }
    const pkg = downloadedPackages.find(p => p.metadata.workId === book.workId);
    if (pkg && pkg.content?.juans) {
      let count = 0;
      pkg.content.juans.forEach(j => {
        j.segments?.forEach(seg => {
          const cleanContent = seg.content.replace(/^No\.\s*\d+[a-z]?/i, '');
          const cjkMatches = cleanContent.match(/[\u4e00-\u9fa5\u3400-\u4dbf\u20000-\u2a6df]/g);
          if (cjkMatches) count += cjkMatches.length;
        });
      });
      if (count > 0) return count;
    }
    return 0;
  };

  const formatEstimatedReadingTime = (cjkChars?: number) => {
    if (!cjkChars || cjkChars <= 0) {
      return '10 分鐘';
    }
    const totalMins = Math.max(1, Math.round(cjkChars / 200));
    if (totalMins < 60) {
      return `${totalMins} 分鐘`;
    }
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (mins === 0) {
      return `${hours} 小時`;
    }
    return `${hours} 小時 ${mins} 分`;
  };

  const startLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    isLongPressTriggeredRef.current = false;
    if (isEditMode) return;
    // 💡 「近期閱讀」與「我的最愛」系統虛擬資料夾內，長按完全無任何反應
    if (currentFolderId === 'virtual_recent_reads' || currentFolderId === 'virtual_favorites') return;

    const target = e.target as HTMLElement;
    // 點擊 actions 按鈕或 input 等控制項不觸發長按
    // 💡 「近期閱讀」與「我的最愛」為系統虛擬資料夾，長按無任何反應
    if (
      target.closest('button') || 
      target.closest('.list-folder-actions') || 
      target.closest('input') ||
      target.closest('.item-actions-panel') ||
      target.closest('.batch-checkbox') ||
      target.closest('.system-folder-item')
    ) {
      return;
    }

    if ('touches' in e && e.touches.length > 0) {
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    } else {
      touchStartPosRef.current = null;
    }

    isLongPressTriggeredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setIsEditMode(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 380); // 380 毫秒長按判定，靈敏快速
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!longPressTimerRef.current || !touchStartPosRef.current) return;
    if (e.touches.length > 0) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      // 容許微小手指震顫（< 10px），超過 10px 才判定為手勢滑動並取消長按
      if (dx > 10 || dy > 10) {
        cancelLongPress();
      }
    }
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  // 💡 遞迴計算某一層（包括該層所有的子資料夾中）的經典總數
  const getFolderTotalBookCount = (folderId: string | null): number => {
    if (folderId === 'virtual_recent_reads') {
      return recentReadsBooks.length;
    }
    if (folderId === 'virtual_favorites') {
      return favoriteBooksList.length;
    }

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

  const handleExitEditMode = () => {
    setIsEditMode(false);
    setSelectedBookIds([]);
  };

  // 💡 同經典劃線重點開合狀態 (Record<workId, boolean>，預設全部收合)
  const [expandedBookGroups, setExpandedBookGroups] = useState<Record<string, boolean>>({});

  const toggleBookGroup = (workId: string) => {
    setExpandedBookGroups(prev => ({
      ...prev,
      [workId]: !prev[workId]
    }));
  };

  // 💡 全域空白處點擊監聽：當處於編輯模式時，點擊任何經書卡片、手把與編輯按鈕以外的任意全域空白處，立刻退出編輯模式
  useEffect(() => {
    if (!isEditMode) return;

    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.horizontal-book-card') &&
        !target.closest('.grid-book-card') &&
        !target.closest('.list-book-item') &&
        !target.closest('.batch-checkbox') &&
        !target.closest('.square-btn') &&
        !target.closest('.library-header-btn') &&
        !target.closest('.folder-add-sub-btn-flat') &&
        !target.closest('.edit-action-btn') &&
        !target.closest('.item-actions-panel') &&
        !target.closest('.batch-action-bar') &&
        !target.closest('.search-dialog-card') &&
        !target.closest('.search-dialog-overlay') &&
        !target.closest('.horizontal-book-more-btn') &&
        !target.closest('.book-more-btn-topright')
      ) {
        handleExitEditMode();
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
    if (
      !target.closest('.horizontal-book-card') &&
      !target.closest('.grid-book-card') &&
      !target.closest('.list-book-item') && 
      !target.closest('.square-btn') && 
      !target.closest('.library-header-btn') &&
      !target.closest('.folder-add-sub-btn-flat') &&
      // 💡 懸浮批量工具列的所有按鈕不得觸發退出編輯模式
      !target.closest('.batch-action-bar')
    ) {
      handleExitEditMode();
    }
  };

  // 💡 全站 Swipe 左右手勢滑動導航系統 (含實時位移跟隨與彈性過渡)
  const touchSwipeRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swipeContainerRef = useRef<HTMLDivElement | null>(null);
  // 💡 方向鎖定 Ref：'horizontal' | 'vertical' | null，一旦確認方向即鎖定至手勢結束
  const swipeLockRef = useRef<'horizontal' | 'vertical' | null>(null);
  // 💡 library-container 的 ref，用於掛載非被動 touchmove 原生事件
  const libraryContainerRef = useRef<HTMLDivElement | null>(null);

  // 💡 用 useEffect 掛載 non-passive touchmove，才能在水平滑動時呼叫 preventDefault() 阻止垂直偏移
  useEffect(() => {
    const el = libraryContainerRef.current;
    if (!el) return;

    const onTouchMove = (e: TouchEvent) => {
      if (!touchSwipeRef.current || isEditMode) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchSwipeRef.current.x;
      const deltaY = touch.clientY - touchSwipeRef.current.y;

      // 尚未鎖定方向時，根據初始移動量判斷
      if (!swipeLockRef.current) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 6) {
          swipeLockRef.current = 'horizontal';
        } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 6) {
          swipeLockRef.current = 'vertical';
        }
      }

      // 水平鎖定：阻止瀏覽器垂直捲動 + 跟隨手指位移
      if (swipeLockRef.current === 'horizontal') {
        e.preventDefault(); // ✅ 阻止垂直捲動偏移
        if (swipeContainerRef.current) {
          swipeContainerRef.current.style.transform = `translateX(${deltaX * 0.65}px)`;
        }
      }
    };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode]);

  // 💡 手機版手勢：停用首頁全幅左滑右滑換頁手勢，確保「我的書櫃」內經書左右橫向滾動 100% 順暢不衝突
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3d5a45');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [editingFolderColor, setEditingFolderColor] = useState('#3d5a45');

  // 勾選/取消勾選單本經典 (用於批量移動)
  const toggleSelectBook = (workId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBookIds(prev => 
      prev.includes(workId) ? prev.filter(id => id !== workId) : [...prev, workId]
    );
  };

  // 批量全選當前層級經典
  const handleSelectAllBooks = () => {
    const currentBookIds = displayBooks.map(b => b.workId);
    setSelectedBookIds(currentBookIds);
  };

  // 💡 點選進入專區/資料夾時的平滑推進動畫 (CBETA 式整頁飛出)
  const navigateToFolderWithAnimation = (targetFolderId: string | null) => {
    if (currentFolderId === targetFolderId) return;
    const goForward = true; // 點擊進入資料夾 = 向左推進

    if (swipeContainerRef.current) {
      const container = swipeContainerRef.current;
      // 1. 整頁向左飛出
      container.style.transition = 'transform 0.24s cubic-bezier(0.4, 0, 1, 1), opacity 0.24s ease-out';
      container.style.transform = goForward ? 'translateX(-100%)' : 'translateX(100%)';
      container.style.opacity = '0.15';

      setTimeout(() => {
        // 2. 切換狀態至目標專區
        navigateToFolder(targetFolderId);

        // 3. 新專區從右側全幅滑入歸位
        container.style.transition = 'none';
        container.style.transform = goForward ? 'translateX(100%)' : 'translateX(-100%)';
        container.style.opacity = '0.7';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            container.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out';
            container.style.transform = 'translateX(0px)';
            container.style.opacity = '1';
          });
        });
      }, 210);
    } else {
      navigateToFolder(targetFolderId);
    }
  };

  // 💡 點擊「+」開啟 CBETA 藏經庫時的平滑向左推進動畫 (CBETA 式整頁飛出)
  const handleOpenCbetaCatalogWithAnimation = () => {
    if (!onOpenCbetaCatalog) return;
    if (swipeContainerRef.current) {
      const container = swipeContainerRef.current;
      // 1. 整頁向右飛出（CBETA 在首頁左邊，向左滑進入 = 首頁向右飛出）
      container.style.transition = 'transform 0.24s cubic-bezier(0.4, 0, 1, 1), opacity 0.24s ease-out';
      container.style.transform = 'translateX(100%)';
      container.style.opacity = '0.15';
      setTimeout(() => {
        onOpenCbetaCatalog();
        // CBETA 頁接管，不需要復位動畫
        container.style.transition = 'none';
        container.style.transform = 'translateX(0px)';
        container.style.opacity = '1';
      }, 210);
    } else {
      onOpenCbetaCatalog();
    }
  };

  // 💡 點擊「首頁」按鈕時的平滑倒滑往回動畫 (CBETA 式整頁飛出)
  const handleGoHomeWithAnimation = () => {
    if (activeTab === 'shelf' && !currentFolderId) return; // 本身就在首頁時不觸發

    if (swipeContainerRef.current) {
      const container = swipeContainerRef.current;
      // 1. 整頁向右飛出（返回首頁 = 向後 = 右邊飛出）
      container.style.transition = 'transform 0.24s cubic-bezier(0.4, 0, 1, 1), opacity 0.24s ease-out';
      container.style.transform = 'translateX(100%)';
      container.style.opacity = '0.15';

      setTimeout(() => {
        // 2. 切換狀態回首頁
        setActiveTab('shelf');
        setCurrentFolderId(null);
        setFolderHistory([null]);
        setHistoryIndex(0);

        // 3. 從左側全幅滑入歸位
        container.style.transition = 'none';
        container.style.transform = 'translateX(-100%)';
        container.style.opacity = '0.7';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            container.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out';
            container.style.transform = 'translateX(0px)';
            container.style.opacity = '1';
          });
        });
      }, 210);
    } else {
      setActiveTab('shelf');
      setCurrentFolderId(null);
      setFolderHistory([null]);
      setHistoryIndex(0);
    }
  };

  // 取消全選
  const handleDeselectAllBooks = () => {
    setSelectedBookIds([]);
  };

  // 執行批量移動至目標資料夾 (targetFolderId 為 null 代表移至首頁暫存；'virtual_my_folders' 代表移至我的書櫃頂層)
  const handleBatchMoveBooks = (targetFolderId: string | null) => {
    if (selectedBookIds.length === 0) return;

    if (targetFolderId === 'virtual_my_folders') {
      // 移入「我的書櫃」頂層
      const updatedMyBookshelf = Array.from(new Set([...myBookshelfBookIds, ...selectedBookIds]));
      saveMyBookshelfBookIds(updatedMyBookshelf);
      // 從所有自訂子資料夾移出
      const updatedFolders = folders.map(f => ({
        ...f,
        bookIds: f.bookIds.filter(id => !selectedBookIds.includes(id))
      }));
      saveFolders(updatedFolders);
    } else if (!targetFolderId) {
      // 移回首頁 (擺脫「我的書櫃」頂層與任何子資料夾)
      saveMyBookshelfBookIds(myBookshelfBookIds.filter(id => !selectedBookIds.includes(id)));
      const updatedFolders = folders.map(f => ({
        ...f,
        bookIds: f.bookIds.filter(id => !selectedBookIds.includes(id))
      }));
      saveFolders(updatedFolders);
    } else {
      // 移入特定的子資料夾
      saveMyBookshelfBookIds(myBookshelfBookIds.filter(id => !selectedBookIds.includes(id)));
      const updatedFolders = folders.map(f => {
        if (f.id === targetFolderId) {
          const combined = Array.from(new Set([...f.bookIds, ...selectedBookIds]));
          return { ...f, bookIds: combined };
        }
        return { ...f, bookIds: f.bookIds.filter(id => !selectedBookIds.includes(id)) };
      });
      saveFolders(updatedFolders);
    }

    setSelectedBookIds([]);
    setShowBatchMoveDialog(false);
  };

  // 載入資料夾設置並相容舊格式
  const loadLocalFolders = () => {
    const savedFolders = localStorage.getItem('cbeta_reader_folders');
    if (savedFolders) {
      try {
        const parsed = JSON.parse(savedFolders) as BookFolder[];
        const upgraded = parsed.map(f => ({
          ...f,
          parentId: f.parentId !== undefined ? f.parentId : null,
          color: f.color || '#3d5a45'
        }));
        setFolders(upgraded);
      } catch (e) {
        console.error('Failed to parse folders from localStorage:', e);
      }
    } else {
      setFolders([]);
    }

    try {
      const savedBookshelf = localStorage.getItem('cbeta_my_bookshelf_book_ids');
      setMyBookshelfBookIds(savedBookshelf ? JSON.parse(savedBookshelf) : []);
    } catch {
      setMyBookshelfBookIds([]);
    }

    try {
      const savedFavs = localStorage.getItem('favorite_work_ids');
      setFavoriteWorkIds(savedFavs ? JSON.parse(savedFavs) : []);
    } catch {
      setFavoriteWorkIds([]);
    }
  };

  useEffect(() => {
    loadLocalFolders();
    const handleStorageOrCustomEvent = () => {
      loadLocalFolders();
      loadLocalBooks();
    };
    window.addEventListener('storage', handleStorageOrCustomEvent);
    window.addEventListener('cbeta_folders_updated', handleStorageOrCustomEvent);
    return () => {
      window.removeEventListener('storage', handleStorageOrCustomEvent);
      window.removeEventListener('cbeta_folders_updated', handleStorageOrCustomEvent);
    };
  }, []);

  // 儲存資料夾設定
  const saveFolders = (newFolders: BookFolder[]) => {
    setFolders(newFolders);
    localStorage.setItem('cbeta_reader_folders', JSON.stringify(newFolders));
    window.dispatchEvent(new Event('cbeta_folders_updated'));
  };

  // 建立資料夾
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    
    // 如果在「我的書櫃」專區，parentId 設為 null，屬於頂層自訂資料夾
    const targetParentId = currentFolderId === 'virtual_my_folders' ? null : currentFolderId;

    const newFolder: BookFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      bookIds: [],
      parentId: targetParentId,
      color: newFolderColor
    };
    
    saveFolders([...folders, newFolder]);
    setNewFolderName('');
    setNewFolderColor('#3d5a45');
    setShowNewFolderDialog(false);
  };

  // 💡 資料夾順序上移 / 下移
  const handleSwapFolderOrder = (folderId: string, direction: 'up' | 'down' | 'left' | 'right') => {
    const topFolders = folders.filter(f => !f.parentId);
    const idx = topFolders.findIndex(f => f.id === folderId);
    if (idx === -1) return;

    const isBackward = direction === 'up' || direction === 'left';
    const targetIdx = isBackward ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= topFolders.length) return;

    const newTopFolders = [...topFolders];
    const temp = newTopFolders[idx];
    newTopFolders[idx] = newTopFolders[targetIdx];
    newTopFolders[targetIdx] = temp;

    const subFolders = folders.filter(f => f.parentId);
    const updatedFolders = [...newTopFolders, ...subFolders];

    saveFolders(updatedFolders);
  };

  // 刪除資料夾
  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const folderToDelete = folders.find(f => f.id === folderId);
    if (!folderToDelete) return;
    const confirm = window.confirm("確定要刪除此資料夾嗎？內部的經典將回到「近期下載」。");
    if (!confirm) return;
    
    // 1. 從 folders 清單移除此資料夾
    const updatedFolders = folders.filter(f => f.id !== folderId);
    
    // 2. 將內部經典自 myBookshelfBookIds 移除，使其回歸「近期下載」（未分類）
    const folderBookIds = folderToDelete.bookIds;
    saveMyBookshelfBookIds(myBookshelfBookIds.filter(id => !folderBookIds.includes(id)));
    
    saveFolders(updatedFolders);
    
    // 若當前身處被刪除的資料夾，退回「我的書櫃」
    if (currentFolderId === folderId) {
      setCurrentFolderId('virtual_my_folders');
    }
  };

  // 啟動資料夾修改（包含重新命名與選擇顏色）
  const startRenameFolder = (folder: BookFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
    setEditingFolderColor(folder.color || '#3d5a45');
  };

  // 保存資料夾修改
  const handleRenameFolder = () => {
    if (!editingFolderName.trim() || !editingFolderId) return;
    const updated = folders.map(f => {
      if (f.id === editingFolderId) {
        return { ...f, name: editingFolderName.trim(), color: editingFolderColor };
      }
      return f;
    });
    saveFolders(updated);
    setEditingFolderId(null);
  };

  // 刪除經典暫存 ID
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);

  // 將經典移出資料夾至上一層 (parentId 代表的資料夾；若 parentId 為 null 則代表移至「我的書櫃」頂層)
  const handleRemoveFromFolder = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    if (!currentFolderId) return;

    const currentFolder = folders.find(f => f.id === currentFolderId);
    if (!currentFolder) return;

    const parentId = currentFolder.parentId;

    if (!parentId) {
      // 💡 上一層是「我的書櫃」頂層：加入我的書櫃 ID 清單
      const updatedMyBookshelf = Array.from(new Set([...myBookshelfBookIds, bookId]));
      saveMyBookshelfBookIds(updatedMyBookshelf);
    }

    const updated = folders.map(f => {
      if (f.id === currentFolderId) {
        return { ...f, bookIds: f.bookIds.filter(id => id !== bookId) };
      }
      if (parentId && f.id === parentId) {
        const bookIds = f.bookIds.includes(bookId) ? f.bookIds : [...f.bookIds, bookId];
        return { ...f, bookIds };
      }
      return f;
    });

    saveFolders(updated);
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

      setDownloadedBooks([...booksMeta]);

      // 同步讀取 package，以供本地檢索使用與缺失字數自動修復
      const { getBook, saveBook } = await import('../../utils/db');
      const pkgs: ReaderPackage[] = [];
      let hasHealedAny = false;

      for (const meta of booksMeta) {
        const pkg = await getBook(meta.workId);
        if (pkg) {
          pkgs.push(pkg);
          // 自動修復缺失或校勘 cjkChars (Auto-Heal 對齊 CBETA 權威字數)
          const feat = FEATURED_BOOKS.find(b => b.workId === meta.workId);
          if (feat?.cjkChars && feat.cjkChars > 0 && pkg.metadata.cjkChars !== feat.cjkChars) {
            pkg.metadata.cjkChars = feat.cjkChars;
            meta.cjkChars = feat.cjkChars;
            if (feat.vol && !pkg.metadata.vol) {
              pkg.metadata.vol = feat.vol;
              meta.vol = feat.vol;
            }
            hasHealedAny = true;
            await saveBook(pkg);
          } else if (!pkg.metadata.cjkChars || pkg.metadata.cjkChars === 0) {
            let count = 0;
            pkg.content?.juans?.forEach(j => {
              j.segments?.forEach(seg => {
                const cleanContent = seg.content.replace(/^No\.\s*\d+[a-z]?/i, '');
                const cjkMatches = cleanContent.match(/[\u4e00-\u9fa5\u3400-\u4dbf\u20000-\u2a6df]/g);
                if (cjkMatches) count += cjkMatches.length;
              });
            });
            if (count > 0) {
              pkg.metadata.cjkChars = count;
              meta.cjkChars = count;
              hasHealedAny = true;
              await saveBook(pkg);
            }
          }
        }
      }
      setDownloadedPackages(pkgs);
      if (hasHealedAny) {
        setDownloadedBooks([...booksMeta]);
      }
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
      setSelectedOnlineWorkIds([]); // 重置勾選狀態
    } catch (e) {
      console.error('Online search failed:', e);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // 勾選/取消勾選線上搜尋單項
  const toggleSelectOnlineWork = (workId: string) => {
    setSelectedOnlineWorkIds(prev => 
      prev.includes(workId) ? prev.filter(id => id !== workId) : [...prev, workId]
    );
  };

  // 全選線上未下載的搜尋結果
  const handleSelectAllOnlineResults = () => {
    const downloadableWorkIds = onlineResults
      .filter(res => !downloadedBooks.some(b => b.workId === res.workId))
      .map(res => res.workId);

    if (selectedOnlineWorkIds.length === downloadableWorkIds.length && selectedOnlineWorkIds.length > 0) {
      setSelectedOnlineWorkIds([]);
    } else {
      setSelectedOnlineWorkIds(downloadableWorkIds);
    }
  };

  // 執行批量下載與自動歸類至資料夾
  const handleExecuteBatchDownload = async () => {
    if (selectedOnlineWorkIds.length === 0) return;
    setShowBatchDownloadModal(false);

    let targetFolderId: string | null = null;

    // 1. 處理目標資料夾 ID (新建資料夾 或 放入已有資料夾)
    if (batchFolderMode === 'new' && batchFolderName.trim()) {
      const newFolder: BookFolder = {
        id: `folder-${Date.now()}`,
        name: batchFolderName.trim(),
        bookIds: [],
        parentId: currentFolderId,
        color: batchFolderColor
      };
      targetFolderId = newFolder.id;
      const updatedFolders = [...folders, newFolder];
      saveFolders(updatedFolders);
    } else if (batchFolderMode === 'existing' && selectedExistingFolderId) {
      targetFolderId = selectedExistingFolderId;
    }

    const totalToDownload = selectedOnlineWorkIds.length;
    const workIdsToProcess = [...selectedOnlineWorkIds];

    // 2. 逐一執行下載與建置
    for (let i = 0; i < workIdsToProcess.length; i++) {
      const workId = workIdsToProcess[i];
      const searchRes = onlineResults.find(r => r.workId === workId);
      if (!searchRes) continue;

      try {
        await PackageBuilder.downloadAndPackage(searchRes, (progress) => {
          setBuildProgress({
            ...progress,
            workTitle: searchRes.title,
            workId: searchRes.workId,
            batchInfo: { current: i + 1, total: totalToDownload },
            message: `批量下載中 (${i + 1}/${totalToDownload})：${progress.message}`
          });
        });

        // 如果設定了目標資料夾，將新下載的經書歸類進去
        if (targetFolderId) {
          setFolders(latestFolders => {
            const updated = latestFolders.map(f => {
              if (f.id === targetFolderId) {
                const bookIds = f.bookIds.includes(workId) ? f.bookIds : [...f.bookIds, workId];
                return { ...f, bookIds };
              }
              return f;
            });
            localStorage.setItem('cbeta_reader_folders', JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err) {
        console.error(`Batch download failed for ${workId}:`, err);
      }
    }

    // 3. 載入最新本地經書清單與資料夾
    loadLocalFolders();
    await loadLocalBooks();
    setSelectedOnlineWorkIds([]);
    window.dispatchEvent(new Event('cbeta_folders_updated'));

    setTimeout(() => {
      setBuildProgress(null);
    }, 1500);
  };

  // 下載並匯入經典
  const handleDownloadBook = async (searchResult: SearchResult) => {
    try {
      await PackageBuilder.downloadAndPackage(searchResult, (progress) => {
        setBuildProgress({
          ...progress,
          workTitle: searchResult.title,
          workId: searchResult.workId
        });
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

  // 💡 執行批次刪除選取書籍
  const handleBatchDeleteBooks = async () => {
    if (selectedBookIds.length === 0) return;
    if (!window.confirm(`確定要批次刪除選取的 ${selectedBookIds.length} 本經典嗎？刪除後若需要閱讀需重新下載。`)) return;
    try {
      for (const workId of selectedBookIds) {
        await deleteBook(workId);
      }
      setSelectedBookIds([]);
      setIsEditMode(false);
      await loadLocalBooks();
    } catch (e) {
      console.error('Batch delete failed:', e);
    }
  };



  // 本地搜尋結果點擊跳轉
  const handleSelectSearchResult = (workId: string, _juan: number, segmentId: string, query: string) => {
    onSelectBook(workId, segmentId, query);
  };

  // 💡 大藏經 A...Z 共 26 個字母開頭之經典色系字典 (典雅東方書籍質感配色)
  const CANON_LETTER_COLORS: { [key: string]: string } = {
    A: '#3b5998', // 紺藍
    B: '#702459', // 紫紅 / 茜色
    C: '#2b6cb0', // 寶藍
    D: '#2c5282', // 黛藍
    E: '#276749', // 苔綠
    F: '#317873', // 松石青
    G: '#4a5b4e', // 竹綠
    H: '#d69e2e', // 琥珀黃
    I: '#b7791f', // 古銅黃
    J: '#c05621', // 赭紅
    K: '#9b2c2c', // 硃砂紅
    L: '#742a2a', // 栗紅
    M: '#6b46c1', // 紫藤
    N: '#5a67d8', // 群青
    O: '#2b4c7e', // 藏青
    P: '#805ad5', // 桔梗紫
    Q: '#d53f8c', // 胭脂紅
    R: '#e53e3e', // 丹紅
    S: '#dd6b20', // 柿黃
    T: '#2b4c7e', // 大正藏 - 紺青
    U: '#319795', // 孔雀藍
    V: '#3182ce', // 琉璃藍
    W: '#805ad5', // 深紫
    X: '#782d2d', // 卍續藏 - 緋紅
    Y: '#654321', // 印順導師 - 墨茶
    Z: '#314e52'  // 墨綠
  };

  const getBookCoverColor = (workId: string) => {
    if (!workId) return '#4a5b4e';
    const letter = workId.charAt(0).toUpperCase();
    return CANON_LETTER_COLORS[letter] || '#4a5b4e';
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

  // 💡 我的最愛經書清單 (localStorage 持久化)
  const [favoriteWorkIds, setFavoriteWorkIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('favorite_work_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavoriteBook = (e: React.MouseEvent, workId: string) => {
    e.stopPropagation();
    setFavoriteWorkIds(prev => {
      const next = prev.includes(workId) ? prev.filter(id => id !== workId) : [...prev, workId];
      localStorage.setItem('favorite_work_ids', JSON.stringify(next));
      return next;
    });
  };

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

  const [allHighlights, setAllHighlights] = useState<BookHighlight[]>([]);
  const [editingHighlightInLibrary, setEditingHighlightInLibrary] = useState<BookHighlight | null>(null);
  const [editingNoteTextInLibrary, setEditingNoteTextInLibrary] = useState('');

  const groupedHighlights = useMemo(() => {
    const map = new Map<string, { workId: string; title: string; list: BookHighlight[] }>();
    allHighlights.forEach(hl => {
      if (!map.has(hl.workId)) {
        const bookMeta = downloadedBooks.find(b => b.workId === hl.workId);
        const title = bookMeta ? bookMeta.title : hl.workId;
        map.set(hl.workId, { workId: hl.workId, title, list: [] });
      }
      map.get(hl.workId)!.list.push(hl);
    });

    const groups = Array.from(map.values());

    // 💡 排序規則：每本經典內部的重點，100% 依據經文內文的先後次序排列 (卷次 -> 段落編號 -> 起始字元 offset)
    groups.forEach(group => {
      group.list.sort((a, b) => {
        if (a.juan !== b.juan) {
          return a.juan - b.juan;
        }
        const segIdxA = parseInt(a.segmentId.match(/seg(\d+)/)?.[1] || '0', 10);
        const segIdxB = parseInt(b.segmentId.match(/seg(\d+)/)?.[1] || '0', 10);
        if (segIdxA !== segIdxB) {
          return segIdxA - segIdxB;
        }
        if (a.startOffset !== b.startOffset) {
          return a.startOffset - b.startOffset;
        }
        return a.endOffset - b.endOffset;
      });
    });

    return groups;
  }, [allHighlights, downloadedBooks]);

  const loadAllHighlights = async () => {
    try {
      const hls = await getAllHighlights();
      hls.sort((a, b) => b.createdAt - a.createdAt);
      setAllHighlights(hls);
    } catch (e) {
      console.error('Failed to load all highlights:', e);
    }
  };

  useEffect(() => {
    loadLocalFolders();
    loadLocalBooks();
    loadAllHighlights();
  }, [booksUpdatedTrigger]);

  const subfolderBookIds = useMemo(() => folders.flatMap(f => f.bookIds), [folders]);
  const allBookshelfBookIds = useMemo(() => Array.from(new Set([...myBookshelfBookIds, ...subfolderBookIds])), [myBookshelfBookIds, subfolderBookIds]);
  // 1. 近期閱讀（最多 9 本，即 3 欄 × 3 列）
  const recentReadsBooks = resumeBooks.slice(0, 9).map(item => item.book);
  // 2. 我的最愛
  const favoriteBooksList = downloadedBooks.filter(b => favoriteWorkIds.includes(b.workId));
  // 3. 近期下載（未分類經典）
  const unclassifiedBooks = downloadedBooks.filter(b => !allBookshelfBookIds.includes(b.workId));

  // 💡 分割經書清單為 3 本一組的垂直欄 helper
  const chunkBooksInto3 = (booksList: BookMetadata[]): BookMetadata[][] => {
    const cols: BookMetadata[][] = [];
    for (let i = 0; i < booksList.length; i += 3) {
      cols.push(booksList.slice(i, i + 3));
    }
    return cols;
  };

  // 如果是虛擬系統資料夾，不顯示任何一般子資料夾；首頁亦不直鋪自訂資料夾（統一收納於「我的書櫃」）
  const isSystemFolder = currentFolderId === 'virtual_resume' || 
                         currentFolderId === 'virtual_recent_reads' || 
                         currentFolderId === 'virtual_favorites' || 
                         currentFolderId === 'virtual_unclassified' || 
                         currentFolderId === 'virtual_highlights';

  const displayFolders = isSystemFolder
    ? []
    : (currentFolderId === 'virtual_my_folders'
        ? folders.filter(f => !f.parentId)
        : (!currentFolderId
            ? []
            : folders.filter(f => f.parentId === currentFolderId)));
    
  // 💡 經文排序：先依英文字 A~Z 排，每個英文字的數字由小到大排
  const sortBooksByWorkId = (books: BookMetadata[]): BookMetadata[] => {
    return [...books].sort((a, b) => {
      const matchA = a.workId.match(/^([A-Za-z]+)(\d*)/);
      const matchB = b.workId.match(/^([A-Za-z]+)(\d*)/);

      const letterA = matchA ? matchA[1].toUpperCase() : a.workId;
      const letterB = matchB ? matchB[1].toUpperCase() : b.workId;

      if (letterA !== letterB) {
        return letterA.localeCompare(letterB);
      }

      const numA = matchA && matchA[2] ? parseInt(matchA[2], 10) : 0;
      const numB = matchB && matchB[2] ? parseInt(matchB[2], 10) : 0;

      return numA - numB;
    });
  };

  const [bookOrderTrigger, setBookOrderTrigger] = useState(0);

  const handleSwapBookOrder = (workId: string, direction: 'left' | 'right') => {
    const currentIds = displayBooks.map(b => b.workId);
    const idx = currentIds.indexOf(workId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentIds.length) return;

    const newOrder = [...currentIds];
    const temp = newOrder[idx];
    newOrder[idx] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;

    const key = `book_order_${currentFolderId || 'root'}`;
    localStorage.setItem(key, JSON.stringify(newOrder));
    setBookOrderTrigger(prev => prev + 1);
  };

  const rawDisplayBooks = currentFolderId === 'virtual_recent_reads'
    ? recentReadsBooks
    : (currentFolderId === 'virtual_favorites'
        ? favoriteBooksList
        : (currentFolderId === 'virtual_unclassified'
            ? unclassifiedBooks
            : (currentFolderId === 'virtual_resume'
                ? resumeBooks.map(item => item.book)
                : sortBooksByWorkId(
                    currentFolderId && currentFolderId !== 'virtual_my_folders'
                      ? downloadedBooks.filter(b => {
                          const f = folders.find(folder => folder.id === currentFolderId);
                          return f ? f.bookIds.includes(b.workId) : false;
                        })
                      : (currentFolderId === 'virtual_my_folders'
                          ? downloadedBooks.filter(b => myBookshelfBookIds.includes(b.workId))
                          : unclassifiedBooks)
                  ))));

  const displayBooks = useMemo(() => {
    const key = `book_order_${currentFolderId || 'root'}`;
    const savedOrderStr = localStorage.getItem(key);
    if (!savedOrderStr) return rawDisplayBooks;
    try {
      const savedOrder: string[] = JSON.parse(savedOrderStr);
      return [...rawDisplayBooks].sort((a, b) => {
        const idxA = savedOrder.indexOf(a.workId);
        const idxB = savedOrder.indexOf(b.workId);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    } catch {
      return rawDisplayBooks;
    }
  }, [rawDisplayBooks, currentFolderId, bookOrderTrigger]);


  // 獲取當前資料夾路徑麵包屑
  const getFolderPath = (folderId: string | null): string => {
    if (!folderId) return '我的書櫃';
    if (folderId === 'virtual_recent_reads') return '近期閱讀';
    if (folderId === 'virtual_favorites') return '我的最愛';
    if (folderId === 'virtual_unclassified') return '近期下載';
    if (folderId === 'virtual_highlights') return '重點與筆記';
    if (folderId === 'virtual_resume') return '繼續閱讀';
    if (folderId === 'virtual_my_folders') return '我的書櫃';
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
    return ['我的書櫃', ...path].join(' / ');
  };

  // 💡 經典橫向卡片組件 (支援單本、輪播欄位與詳細清單)
  const renderBookCard = (book: BookMetadata, allowReorder = true, sourceContext?: string) => {
    const isSelected = selectedBookIds.includes(book.workId);
    const featuredBook = FEATURED_BOOKS.find((b: any) => b.workId === book.workId);
    const titleText = book.title || featuredBook?.title || book.workId;
    let creatorText = sanitizeCreators(book.creators || featuredBook?.creators);

    // 💡 印順導師著作 (Y 系列) 作譯者名稱統一規範顯示為「民國 釋印順著」
    if (book.workId.startsWith('Y') || (creatorText && creatorText.includes('印順'))) {
      creatorText = '民國 釋印順著';
    }

    return (
      <div 
        key={book.workId}
        className={`horizontal-book-card ${isEditMode ? 'edit-mode' : ''} ${isSelected ? 'selected-for-batch' : ''}`}
        onClick={(e) => { 
          if (isLongPressTriggeredRef.current) {
            isLongPressTriggeredRef.current = false;
            return;
          }
          if (isEditMode) {
            e.stopPropagation();
            if ((e.target as HTMLElement).closest('.horizontal-card-checkbox')) return;
            toggleSelectBook(book.workId, e);
          } else {
            onSelectBook(book.workId); 
          }
        }}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchMove={handleTouchMove}
        onTouchEnd={cancelLongPress}
      >
        {/* 💡 左側：編輯模式下勾選框 (Checkbox) */}
        {isEditMode && (
          <div 
            className={`batch-checkbox horizontal-card-checkbox ${isSelected ? 'checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelectBook(book.workId, e);
            }}
            title="勾選以進行批量移動或批次刪除"
          >
            {isSelected && <Check size={12} />}
          </div>
        )}

        {/* 💡 左側：經典編號顏色方塊 Badge (如 T0801, Y0040) */}
        <div className="horizontal-book-badge" style={{ backgroundColor: getBookCoverColor(book.workId) }}>
          {book.workId}
        </div>

        {/* 💡 中間：經名與朝代/作譯者小灰字 + 卷數 */}
        <div className="horizontal-book-info">
          <div className="horizontal-book-title" title={titleText}>
            {titleText}
          </div>
          <div className="horizontal-book-author" title={creatorText}>
            {creatorText}
            {/* 💡 卷數顯示：juansCount > 1 且非 Y 系列 (印順著作/近代編著無傳統卷數) */}
            {book.juansCount > 1 && !book.workId.startsWith('Y') && (
              <span className="horizontal-book-juans-badge">
                {book.juansCount}卷
              </span>
            )}
          </div>
        </div>

        {/* 💡 右側：長按/編輯模式下顯示「↑」「↓」順序調整按鈕 + 「...」選項按鈕 */}
        <div className="horizontal-book-right-actions">
          {isEditMode && allowReorder && (
            <div className="book-reorder-btn-group">
              <button 
                className="book-reorder-btn"
                disabled={displayBooks.findIndex(b => b.workId === book.workId) <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwapBookOrder(book.workId, 'left');
                }}
                title="向上移動經典順序 (↑)"
              >
                <ChevronUp size={15} />
              </button>
              <button 
                className="book-reorder-btn"
                disabled={displayBooks.findIndex(b => b.workId === book.workId) >= displayBooks.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwapBookOrder(book.workId, 'right');
                }}
                title="向下移動經典順序 (↓)"
              >
                <ChevronDown size={15} />
              </button>
            </div>
          )}

          <button 
            className="horizontal-book-more-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMenuTargetBook(book);
              setMenuTargetBookSource(sourceContext || currentFolderId || null);
            }}
            title="經典選項"
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="library-container" 
      style={{ position: 'relative' }}
      ref={libraryContainerRef}
    >
      {/* 💡 長按觸發編輯模式：懸浮批量工具列 (5 個 1:1:1:1:1 等寬按鈕，透過 Portal 渲染至 body 避免父容器位移) */}
      {isEditMode && activeTab === 'shelf' && createPortal(
        <div className="batch-action-bar pure-floating-overlay animate-slide-up">
          <div className="batch-grid-5">
            {/* 按鈕 1: 已選 X 本 */}
            <button 
              className="batch-grid-btn"
              onClick={selectedBookIds.length === displayBooks.length ? handleDeselectAllBooks : handleSelectAllBooks}
              title="已選擇數量"
            >
              <CheckSquare size={17} style={{ color: selectedBookIds.length > 0 ? 'var(--theme-accent)' : 'inherit' }} />
              <span>已選 {selectedBookIds.length} 本</span>
            </button>

            {/* 按鈕 2: 全選 / 取消全選 */}
            <button 
              className="batch-grid-btn"
              onClick={selectedBookIds.length === displayBooks.length ? handleDeselectAllBooks : handleSelectAllBooks}
              title={selectedBookIds.length === displayBooks.length ? '取消全選' : '全選經書'}
            >
              <CheckCircle2 size={17} />
              <span>{selectedBookIds.length === displayBooks.length ? '取消全選' : '全選經書'}</span>
            </button>

            {/* 按鈕 3: 移至資料夾 */}
            <button 
              className="batch-grid-btn"
              disabled={selectedBookIds.length === 0}
              onClick={() => setShowBatchMoveDialog(true)}
              title="移至資料夾"
            >
              <FolderInput size={17} />
              <span>移至資料夾</span>
            </button>

            {/* 按鈕 4: 刪除書籍 */}
            <button 
              className="batch-grid-btn danger-btn"
              disabled={selectedBookIds.length === 0}
              onClick={handleBatchDeleteBooks}
              title="刪除書籍"
            >
              <Trash2 size={17} />
              <span>刪除書籍</span>
            </button>

            {/* 按鈕 5: 取消退出 */}
            <button 
              className="batch-grid-btn"
              onClick={handleExitEditMode}
              title="取消退出編輯模式"
            >
              <X size={17} />
              <span>取消退出</span>
            </button>
          </div>
        </div>,
        document.body
      )}
      
      {/* 首頁一致控制列 */}
      <div className="library-header animate-fade-in">
        {isBackup && (
          <div className="header-backup-badge" title="目前處於備援閱讀模式 (?source=backup)">
            備援
          </div>
        )}
        <button 
          className={`library-header-btn ${activeTab === 'shelf' && !currentFolderId ? 'active' : ''}`}
          onClick={handleGoHomeWithAnimation}
          title="書架首頁"
        >
          <Home size={20} />
        </button>

        {/* 只有在書架分頁 (shelf) 時才渲染後續按鈕 */}
        {activeTab === 'shelf' && (
          <>
            <div className="control-divider" />
            
            {currentFolderId === null ? (
              // 💡 1. 處於最外層首頁：顯示「下載新佛典（+）」
              <button
                className="library-header-btn"
                onClick={handleOpenCbetaCatalogWithAnimation}
                title="進入 CBETA 藏經庫目錄下載佛典"
              >
                <Plus size={22} style={{ strokeWidth: 2.5 }} />
              </button>
            ) : (
              // 💡 2. 處於資料夾內：將「<」和「>」整合到最上方控制列
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

                {/* 💡 只有在「我的書櫃」（virtual_my_folders）頂部控制列才顯示「新建資料夾 (+)」圖示按鈕；進入子資料夾時隱藏 */}
                {currentFolderId === 'virtual_my_folders' && (
                  <button
                    className="library-header-btn"
                    onClick={() => setShowNewFolderDialog(true)}
                    title="新建資料夾"
                  >
                    <FolderPlus size={20} />
                  </button>
                )}
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
              title="關鍵字搜尋"
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

      <div 
        ref={swipeContainerRef}
        className="library-content-area custom-scrollbar"
        style={{ willChange: 'transform' }}
      >
        {activeTab === 'shelf' ? (
        /* 書架主畫面 */
        <div className="bookshelf-section animate-slide-up" onClick={handleShelfBackgroundClick}>
          {/* 資料夾導航與麵包屑 */}
          {currentFolderId && (
            <div className="folder-nav-wrapper">
              <div className="folder-navigation-bar">
                <div className="folder-nav-middle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* 💡 專區/資料夾同款識別圖示 Badge */}
                  <div 
                    style={{ 
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      backgroundColor: currentFolderId === 'virtual_my_folders' ? '#8c4b27' :
                                       currentFolderId === 'virtual_recent_reads' ? '#4a2c11' :
                                       currentFolderId === 'virtual_favorites' ? '#e53e3e' :
                                       currentFolderId === 'virtual_highlights' ? '#c07d2a' :
                                       '#8c4b27',
                      flexShrink: 0
                    }}
                  >
                    {currentFolderId === 'virtual_recent_reads' ? <Clock size={13} color="#ffffff" /> :
                     currentFolderId === 'virtual_favorites' ? <Heart size={13} fill="#ffffff" color="#ffffff" /> :
                     currentFolderId === 'virtual_highlights' ? <Notebook size={13} color="#ffffff" /> :
                     <Folder size={13} color="#ffffff" />}
                  </div>

                  <span className="folder-path-display">
                    {currentFolderId === 'virtual_resume' ? '繼續閱讀' : 
                     currentFolderId === 'virtual_recent_reads' ? '近期閱讀' :
                     currentFolderId === 'virtual_favorites' ? '我的最愛' :
                     currentFolderId === 'virtual_highlights' ? '重點與筆記' :
                     currentFolderId === 'virtual_my_folders' ? '我的書櫃' :
                     getFolderPath(currentFolderId)}
                  </span>

                  {/* 💡 在「我的書櫃」時提供圓形「...」資料夾集中管理按鈕 */}
                  {currentFolderId === 'virtual_my_folders' && folders.filter(f => !f.parentId).length > 0 && (
                    <button
                      className="appstore-section-circle-more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFolderManagerModal(true);
                      }}
                      title="管理所有資料夾（上移、下移、重新命名、刪除）"
                      style={{ marginLeft: '4px' }}
                    >
                      <MoreVertical size={13} />
                    </button>
                  )}
                </div>
                <div className="folder-nav-right">
                  <span className="folder-book-count-badge" title="當前層級數量">
                    {currentFolderId === 'virtual_my_folders' ? `共${downloadedBooks.length}本` :
                     currentFolderId === 'virtual_recent_reads' ? `共${recentReadsBooks.length}本` :
                     currentFolderId === 'virtual_favorites' ? `共${favoriteBooksList.length}本` :
                     currentFolderId === 'virtual_unclassified' ? `共${unclassifiedBooks.length}本` :
                     currentFolderId === 'virtual_highlights' ? `共${allHighlights.length}則` :
                     currentFolderId === 'virtual_resume' ? `共${displayBooks.length}本` :
                     `共${getFolderTotalBookCount(currentFolderId)}本`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* === A. 最外層首頁：CBETA Reader 4 個系統資料夾方塊 === */}
          {!currentFolderId && (
            <>
              <div className="library-title-area">
                <h1 style={{ fontFamily: 'var(--font-rounded)', letterSpacing: '0.04em' }}>
                  <span style={{ color: '#1ea98c' }}>CBETA</span> Reader
                </h1>
                <p>淨心小角落．閱讀大藏經</p>
              </div>

              {/* 💡 首頁根目錄固定渲染 4 個系統資料夾方塊 */}
              <div className="folders-grid-container system-grid">
                {/* 1. 下載經典 - 主題綠色 (#1ea98c) */}
                <div 
                  className="list-book-item list-folder-item system-folder-item"
                  onClick={handleOpenCbetaCatalogWithAnimation}
                  title="進入 CBETA 藏經庫目錄下載經典"
                >
                  <div className="list-folder-icon-wrapper" style={{ backgroundColor: '#1ea98c' }}>
                    <Plus size={16} color="#ffffff" style={{ strokeWidth: 2.8 }} />
                  </div>
                  <div className="list-folder-info">
                    <div className="list-folder-title" title="下載經典">
                      下載經典
                    </div>
                    <div className="list-folder-count-text">
                      從CBETA資料庫
                    </div>
                  </div>
                </div>

                {/* 2. 我的書櫃 - 經典深琥珀色 (#8c4b27) */}
                <div 
                  className="list-book-item list-folder-item system-folder-item"
                  onClick={() => navigateToFolderWithAnimation('virtual_my_folders')}
                  title="點擊查看我的書櫃"
                >
                  <div className="list-folder-icon-wrapper" style={{ backgroundColor: '#8c4b27' }}>
                    <Folder size={15} color="#ffffff" />
                  </div>
                  <div className="list-folder-info">
                    <div className="list-folder-title" title="我的書櫃">
                      我的書櫃
                    </div>
                    <div className="list-folder-count-text">
                      共{downloadedBooks.length}本書
                    </div>
                  </div>
                </div>

                {/* 3. 重點與筆記 - 琥珀金 (#c07d2a) */}
                <div 
                  className="list-book-item list-folder-item system-folder-item"
                  onClick={() => navigateToFolderWithAnimation('virtual_highlights')}
                  title="點擊查看重點與筆記"
                >
                  <div className="list-folder-icon-wrapper" style={{ backgroundColor: '#c07d2a' }}>
                    <Notebook size={14} color="#ffffff" />
                  </div>
                  <div className="list-folder-info">
                    <div className="list-folder-title" title="重點與筆記">
                      重點與筆記
                    </div>
                    <div className="list-folder-count-text">
                      共{allHighlights.length}則筆記
                    </div>
                  </div>
                </div>

                {/* 4. 關鍵字搜尋 - 典雅海軍藍 (#2b6cb0) */}
                <div 
                  className="list-book-item list-folder-item system-folder-item"
                  onClick={() => setActiveTab('search')}
                  title="點擊進行關鍵字搜尋"
                >
                  <div className="list-folder-icon-wrapper" style={{ backgroundColor: '#2b6cb0' }}>
                    <Search size={14} color="#ffffff" style={{ strokeWidth: 2.5 }} />
                  </div>
                  <div className="list-folder-info">
                    <div className="list-folder-title" title="關鍵字搜尋">
                      關鍵字搜尋
                    </div>
                    <div className="list-folder-count-text">
                      站內已下載經典
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* === B. 「我的書櫃」（virtual_my_folders）：iOS App Store 精選專區式排版 (3 本一組橫向輪播) === */}
          {currentFolderId === 'virtual_my_folders' && (
            <div className="appstore-bookshelf-container animate-slide-up">
              {/* 1. 最上面：近期閱讀 (最多 9 本，即 3 欄 × 3 列) */}
              {recentReadsBooks.length > 0 && (
                <div className="appstore-section animate-fade-in">
                  <div 
                    className="appstore-section-header"
                    onClick={() => navigateToFolderWithAnimation('virtual_recent_reads')}
                    title="點擊查看所有近期閱讀經典"
                  >
                    <div className="appstore-section-title-wrap">
                      <span className="appstore-section-title-capsule appstore-capsule-recent">
                        <Clock size={15} style={{ strokeWidth: 2.2 }} />
                        <span>近期閱讀</span>
                      </span>
                      <span className="appstore-section-arrow">
                        <ChevronRight size={18} />
                      </span>
                      <span className="appstore-section-badge">
                        {recentReadsBooks.length}
                      </span>
                    </div>
                  </div>
                  <div className="appstore-carousel-scroll custom-scrollbar">
                    {chunkBooksInto3(recentReadsBooks).map((colBooks, colIdx) => (
                      <div key={`recent-col-${colIdx}`} className="appstore-carousel-column">
                        {colBooks.map(b => renderBookCard(b, false, 'virtual_recent_reads'))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. 下一個：我的最愛 */}
              {favoriteBooksList.length > 0 && (
                <div className="appstore-section animate-fade-in">
                  <div 
                    className="appstore-section-header"
                    onClick={() => navigateToFolderWithAnimation('virtual_favorites')}
                    title="點擊查看所有我的最愛經典"
                  >
                    <div className="appstore-section-title-wrap">
                      <span className="appstore-section-title-capsule appstore-capsule-favorites">
                        <Heart size={14} fill="currentColor" />
                        <span>我的最愛</span>
                      </span>
                      <span className="appstore-section-arrow">
                        <ChevronRight size={18} />
                      </span>
                      <span className="appstore-section-badge">
                        {favoriteBooksList.length}
                      </span>
                    </div>
                  </div>
                  <div className="appstore-carousel-scroll custom-scrollbar">
                    {chunkBooksInto3(favoriteBooksList).map((colBooks, colIdx) => (
                      <div key={`fav-col-${colIdx}`} className="appstore-carousel-column">
                        {colBooks.map(b => renderBookCard(b, false, 'virtual_favorites'))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. 下一個：近期下載 (未分類經書，一直都留著，若無書籍則為空) */}
              <div className="appstore-section animate-fade-in">
                <div 
                  className="appstore-section-header"
                  onClick={() => navigateToFolderWithAnimation('virtual_unclassified')}
                  title="點擊查看所有近期下載經典"
                >
                  <div className="appstore-section-title-wrap">
                    <span className="appstore-section-title-capsule appstore-capsule-unclassified">
                      <Download size={14} style={{ strokeWidth: 2.2 }} />
                      <span>近期下載</span>
                    </span>
                    <span className="appstore-section-arrow">
                      <ChevronRight size={18} />
                    </span>
                    <span className="appstore-section-badge">
                      {unclassifiedBooks.length}
                    </span>
                  </div>
                </div>
                {unclassifiedBooks.length > 0 && (
                  <div className="appstore-carousel-scroll custom-scrollbar">
                    {chunkBooksInto3(unclassifiedBooks).map((colBooks, colIdx) => (
                      <div key={`unclassified-col-${colIdx}`} className="appstore-carousel-column">
                        {colBooks.map(b => renderBookCard(b, false, 'virtual_unclassified'))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. 再來陸續是已分類的資料夾 */}
              {folders.filter(f => !f.parentId).map((folder) => {
                const folderBooks = downloadedBooks.filter(b => folder.bookIds.includes(b.workId));
                const totalCount = getFolderTotalBookCount(folder.id);

                return (
                  <div key={folder.id} className="appstore-section animate-fade-in">
                    <div 
                      className="appstore-section-header"
                      onClick={() => navigateToFolderWithAnimation(folder.id)}
                      title={`點擊進入 ${folder.name}`}
                    >
                      <div className="appstore-section-title-wrap">
                        {/* 1. 資料夾名稱（純文字無小圖無底色） */}
                        <span className="appstore-section-title">
                          {folder.name}
                        </span>

                        {/* 2. 數量徽章 */}
                        <span className="appstore-section-badge">
                          {totalCount}
                        </span>

                        {/* 3. 「>」箭頭 */}
                        <span className="appstore-section-arrow">
                          <ChevronRight size={18} />
                        </span>
                      </div>
                    </div>

                    {/* 💡 如資料夾內無書籍，暫時為空就好，不顯示佔位文字 */}
                    {folderBooks.length > 0 && (
                      <div className="appstore-carousel-scroll custom-scrollbar">
                        {chunkBooksInto3(folderBooks).map((colBooks, colIdx) => (
                          <div key={`${folder.id}-col-${colIdx}`} className="appstore-carousel-column">
                            {colBooks.map(b => renderBookCard(b, false, folder.id))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 若目前尚無任何經典與資料夾 */}
              {downloadedBooks.length === 0 && (
                <div 
                  className="appstore-empty-placeholder"
                  onClick={handleOpenCbetaCatalogWithAnimation}
                  style={{ marginTop: '1.5rem', padding: '2rem 1rem' }}
                >
                  <Plus size={28} style={{ opacity: 0.6, marginBottom: '0.5rem' }} />
                  <div>書櫃目前尚無經典</div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.7, marginTop: '0.3rem' }}>點此前往 CBETA 藏經庫下載經典</div>
                </div>
              )}
            </div>
          )}

          {/* === C. 進入特定資料夾/專區檢視 (非 virtual_my_folders)：垂直列表向下無限延伸 === */}
          {currentFolderId && currentFolderId !== 'virtual_my_folders' && (
            <div className="shelf-list">
              {/* 💡 溫習庫：專屬劃線與筆記清單 */}
              {currentFolderId === 'virtual_highlights' && (
                <div className="highlights-review-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
                  {groupedHighlights.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                      <Notebook size={36} style={{ opacity: 0.4, marginBottom: '0.6rem' }} />
                      <p>目前尚無任何劃線重點或感悟隨筆。</p>
                      <p style={{ fontSize: '0.82rem', opacity: 0.7, marginTop: '0.3rem' }}>在閱讀經典時選取文字即可畫重點與寫心得筆記。</p>
                    </div>
                  ) : (
                    groupedHighlights.map((group) => {
                      const isExpanded = !!expandedBookGroups[group.workId];
                      const isCollapsed = !isExpanded;
                      const cleanTitle = (group.title || group.workId).replace(/[《》]/g, '').trim();

                      return (
                        <div 
                          key={group.workId}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.6rem',
                            width: '100%',
                            border: '1px solid var(--border-color, rgba(140, 75, 39, 0.12))',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-card, #ffffff)',
                            padding: '0.8rem 1rem',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                            boxBox: 'border-box'
                          } as React.CSSProperties}
                        >
                          <div 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                            onClick={() => toggleBookGroup(group.workId)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexGrow: 1, minWidth: 0 }}>
                              <div 
                                className="horizontal-book-badge" 
                                style={{ 
                                  backgroundColor: getBookCoverColor(group.workId),
                                  width: '32px',
                                  height: '32px',
                                  minWidth: '32px',
                                  minHeight: '32px',
                                  fontSize: '0.72rem',
                                  borderRadius: '6px'
                                }}
                              >
                                {group.workId}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {cleanTitle}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  共 {group.list.length} 條重點筆記
                                </div>
                              </div>
                            </div>

                            <button 
                              type="button"
                              style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--text-muted)', 
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                            </button>
                          </div>

                          {/* 展開後的重點與筆記卡片清單 */}
                          {!isCollapsed && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.4rem', borderTop: '1px dashed var(--border-color, rgba(140,75,39,0.1))', paddingTop: '0.6rem' }}>
                              {group.list.map((hl) => (
                                <div 
                                  key={hl.id}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.4rem',
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(0,0,0,0.02)',
                                    border: '1px solid rgba(0,0,0,0.04)'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <span>第 {hl.juan} 卷</span>
                                    <span>{new Date(hl.createdAt).toLocaleDateString()}</span>
                                  </div>

                                  <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                                    「{hl.text}」
                                  </div>

                                  {hl.note && (
                                    <div 
                                      style={{
                                        fontSize: '0.95rem',
                                        lineHeight: 1.6,
                                        color: 'var(--text-primary)',
                                        backgroundColor: 'var(--theme-accent-light, rgba(140, 75, 39, 0.08))',
                                        borderLeft: '3px solid var(--color-gold-500, #c07d2a)',
                                        padding: '0.45rem 0.7rem',
                                        borderRadius: '4px',
                                        fontFamily: '"CBETASupplement", "標楷體", "BiauKai", "DFKai-SB", "TW-Kai", "STKaiti", "KaiTi", serif',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                      }}
                                    >
                                      {hl.note}
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.2rem' }}>
                                    <button
                                      className="batch-btn batch-btn-secondary"
                                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', opacity: 0.85 }}
                                      onClick={() => onSelectBook(hl.workId, hl.segmentId)}
                                    >
                                      <Play size={10} fill="currentColor" /> 跳至經文
                                    </button>
                                    <button
                                      className="batch-btn batch-btn-secondary"
                                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', opacity: 0.85 }}
                                      onClick={() => {
                                        setEditingHighlightInLibrary(hl);
                                        setEditingNoteTextInLibrary(hl.note || '');
                                      }}
                                    >
                                      <Edit3 size={11} /> 編輯
                                    </button>
                                    <button
                                      className="batch-btn batch-btn-secondary"
                                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.45rem', color: 'var(--text-muted)', opacity: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      title="刪除重點"
                                      onClick={async () => {
                                        if (window.confirm('確定要刪除這條劃線重點嗎？')) {
                                          await deleteHighlight(hl.id);
                                          await loadAllHighlights();
                                        }
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* === A. 渲染使用者自訂子資料夾清單 (若有子資料夾) === */}
              {displayFolders.length > 0 && (
                <div className="folders-grid-container">
                  {displayFolders.map((folder) => (
                    <div 
                      key={folder.id}
                      className={`list-book-item list-folder-item ${isEditMode ? 'edit-mode' : ''}`}
                      onClick={() => {
                        if (isLongPressTriggeredRef.current) {
                          isLongPressTriggeredRef.current = false;
                          return;
                        }
                        navigateToFolderWithAnimation(folder.id);
                      }}
                      onMouseDown={startLongPress}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                      onTouchStart={startLongPress}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={cancelLongPress}
                    >
                      {isEditMode && (
                        <button 
                          className="card-more-btn folder-top-right-more"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuTargetFolder(folder);
                          }}
                          title="資料夾選項"
                        >
                          <MoreVertical size={14} />
                        </button>
                      )}

                      <div className="list-folder-icon-wrapper theme-folder-wrapper" style={{ backgroundColor: '#8b7355' }}>
                        <Folder size={15} className="theme-folder-icon" />
                      </div>

                      <div className="list-folder-info">
                        <div className="list-folder-title" title={folder.name}>
                          {folder.name}
                        </div>
                        <div className="list-folder-count-text">
                          {getFolderTotalBookCount(folder.id)}本經書
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* === B. 渲染經典列表卡片清單 (垂直向下無限延伸) === */}
              {displayBooks.length > 0 && (
                <div className={`books-list-cards-container ${isEditMode ? 'edit-mode-active' : ''}`}>
                  {displayBooks.map(book => renderBookCard(book, true, currentFolderId || undefined))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* 本地檢索畫面 */
        <div className="animate-slide-up">
          <SearchPanel 
            books={downloadedPackages} 
            onSelectResult={handleSelectSearchResult} 
            initialSearchQuery={initialSearchQuery}
            onTriggerOnlineSearch={async (q) => {
              setActiveTab('shelf'); // 切換回書架分頁
              setOnlineSearchQuery(q);
              setIsSearchingOnline(true);
              setShowSearchDialog(true);
              try {
                const results = await IndexBuilder.searchTitle(q);
                setOnlineResults(results);
              } catch (e) {
                console.error('Online search failed:', e);
              } finally {
                setIsSearchingOnline(false);
              }
            }}
          />
        </div>
      )}
      </div>

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
                  placeholder="輸入經典名稱、cbeta編號、關鍵字(如: 印順、玄奘、地藏)..."
                  value={onlineSearchQuery}
                  onChange={(e) => setOnlineSearchQuery(e.target.value)}
                />
                <button type="submit" title="搜尋">
                  <Search size={18} />
                </button>
              </form>

              {/* 💡 批量下載工具列 (有搜尋結果時呈現) */}
              {onlineResults.length > 0 && (
                <div className="online-batch-toolbar">
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button 
                      type="button" 
                      className="batch-btn batch-btn-secondary" 
                      onClick={handleSelectAllOnlineResults}
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                    >
                      {selectedOnlineWorkIds.length === onlineResults.filter(r => !downloadedBooks.some(b => b.workId === r.workId)).length && selectedOnlineWorkIds.length > 0
                        ? '取消全選'
                        : '全選未下載'}
                    </button>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      已勾選 {selectedOnlineWorkIds.length} 本
                    </span>
                  </div>

                  <button 
                    type="button"
                    className="batch-btn batch-btn-primary"
                    disabled={selectedOnlineWorkIds.length === 0}
                    onClick={() => {
                      setBatchFolderName(onlineSearchQuery.trim() || '下載經典');
                      setBatchFolderMode('new');
                      if (currentFolderId && folders.some(f => f.id === currentFolderId)) {
                        setSelectedExistingFolderId(currentFolderId);
                      } else if (folders.length > 0) {
                        setSelectedExistingFolderId(folders[0].id);
                      } else {
                        setSelectedExistingFolderId('');
                      }
                      setShowBatchDownloadModal(true);
                    }}
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Download size={14} />
                    批量下載與收納
                  </button>
                </div>
              )}

              <div className="search-results-list">
                {onlineResults.map((res) => {
                  const isDownloaded = downloadedBooks.some(b => b.workId === res.workId);
                  const isChecked = selectedOnlineWorkIds.includes(res.workId);

                  return (
                    <div 
                      key={res.workId} 
                      className={`search-result-item ${isChecked ? 'selected-for-batch' : ''}`}
                      onClick={() => !isDownloaded && toggleSelectOnlineWork(res.workId)}
                      style={{ cursor: isDownloaded ? 'default' : 'pointer' }}
                    >
                      {!isDownloaded && (
                        <div 
                          className={`batch-checkbox ${isChecked ? 'checked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectOnlineWork(res.workId);
                          }}
                          style={{ marginRight: '10px' }}
                        >
                          {isChecked && <Check size={12} />}
                        </div>
                      )}

                      <div className="result-info" style={{ flexGrow: 1 }}>
                        <span className="result-title">{res.title}</span>
                        <span className="result-meta">
                          {res.workId} · {res.juansCount}卷{sanitizeCreators(res.creators) ? ` · ${sanitizeCreators(res.creators)}` : ''} · {res.category}
                        </span>
                      </div>
                      
                      {isDownloaded ? (
                        <div className="download-status-square">
                          <Check size={15} />
                        </div>
                      ) : (
                        <button 
                          className="download-btn-square" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadBook(res);
                          }} 
                          title="單本下載匯入"
                        >
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

      {/* 💡 批量下載與自動資料夾收納確認對話框 */}
      {showBatchDownloadModal && (
        <div className="search-dialog-overlay" style={{ zIndex: 1250 }} onClick={() => setShowBatchDownloadModal(false)}>
          <div className="changelog-dialog-card animate-slide-up" style={{ width: '92%', maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>批量下載經典收納設定</h3>
              <button className="icon-button close-btn" onClick={() => setShowBatchDownloadModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="dialog-body" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', fontFamily: '"Microsoft JhengHei", "PingFang TC", "STHeiti", sans-serif' }}>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                即將開始下載已勾選的 <strong style={{ color: 'var(--theme-accent)' }}>{selectedOnlineWorkIds.length}</strong> 本經典。
              </div>

              {/* 收納方式單選選項 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  選擇下載收納方式：
                </span>

                {/* 選項 1: 建立新資料夾 */}
                <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="batchFolderMode"
                    checked={batchFolderMode === 'new'} 
                    onChange={() => setBatchFolderMode('new')}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  建立新資料夾收納經書
                </label>

                {/* 建立新資料夾子項目 */}
                {batchFolderMode === 'new' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.6rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>資料夾名稱（預設於「我的書櫃」）：</span>
                    <input 
                      type="text" 
                      className="settings-select"
                      value={batchFolderName}
                      onChange={(e) => setBatchFolderName(e.target.value)}
                      placeholder="請輸入資料夾名稱..."
                      style={{ fontSize: '0.88rem', padding: '0.5rem 0.8rem', fontFamily: '"Microsoft JhengHei", "PingFang TC", "STHeiti", sans-serif' }}
                    />
                  </div>
                )}

                {/* 選項 2: 放入我的書櫃 */}
                <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="batchFolderMode"
                    checked={batchFolderMode === 'existing'} 
                    onChange={() => setBatchFolderMode('existing')}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  放入我的書櫃
                </label>

                {/* 選擇已有資料夾下拉選單 */}
                {batchFolderMode === 'existing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.6rem' }}>
                    {folders.length > 0 ? (
                      <>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>選擇目標資料夾：</span>
                        <select 
                          className="settings-select"
                          value={selectedExistingFolderId}
                          onChange={(e) => setSelectedExistingFolderId(e.target.value)}
                          style={{ fontSize: '0.88rem', padding: '0.55rem 0.8rem', fontFamily: '"Microsoft JhengHei", "PingFang TC", "STHeiti", sans-serif' }}
                        >
                          {folders.map(f => (
                            <option key={f.id} value={f.id}>
                              📁 {f.name} ({f.bookIds.length} 本)
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--theme-accent)', padding: '0.3rem 0' }}>
                        （目前尚未建立任何資料夾，請選擇「建立新資料夾」）
                      </div>
                    )}
                  </div>
                )}

                {/* 選項 3: 下載至首頁 */}
                <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="batchFolderMode"
                    checked={batchFolderMode === 'none'} 
                    onChange={() => setBatchFolderMode('none')}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  下載至首頁
                </label>
              </div>

              <div className="dialog-actions-row" style={{ marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="dialog-btn-cancel"
                  onClick={() => setShowBatchDownloadModal(false)}
                >
                  取消
                </button>
                <button 
                  type="button" 
                  className="dialog-btn-confirm"
                  onClick={handleExecuteBatchDownload}
                  disabled={(batchFolderMode === 'new' && !batchFolderName.trim()) || (batchFolderMode === 'existing' && !selectedExistingFolderId)}
                >
                  開始下載
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批量移動至資料夾對話框 (雙模式：移動書籍 / 移動資料夾) */}
      {/* 批量移動至資料夾對話框 */}
      {showBatchMoveDialog && (
        <div className="search-dialog-overlay" onClick={() => setShowBatchMoveDialog(false)}>
          <div className="search-dialog-card animate-slide-up" style={{ maxWidth: '480px', width: '92%', borderRadius: '16px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>
                移至目標資料夾 ({selectedBookIds.length}本)
              </h3>
              <button className="icon-button close-btn" onClick={() => setShowBatchMoveDialog(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="dialog-body" style={{ gap: '0.75rem', padding: '1rem 1.2rem 1.4rem 1.2rem', maxHeight: '68vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                請點選要移入的目標資料夾：
              </p>
              
              {/* 💡 一列 3 個資料夾九宮格呈現 */}
              <div className="target-folders-grid-3">
                {/* 1. 近期下載 (未分類經書) */}
                <div 
                  className="target-folder-grid-card"
                  onClick={() => handleBatchMoveBooks(null)}
                  title="移至 近期下載 (未分類)"
                >
                  <div className="target-folder-card-icon" style={{ backgroundColor: '#2b6cb0' }}>
                    <Download size={18} color="#ffffff" style={{ strokeWidth: 2.2 }} />
                  </div>
                  <div className="target-folder-card-title">
                    近期下載
                  </div>
                  <div className="target-folder-card-count">
                    未分類
                  </div>
                </div>

                {/* 2. 所有自訂資料夾 */}
                {folders.map(f => {
                  const bookCount = getFolderTotalBookCount(f.id);

                  return (
                    <div 
                      key={f.id}
                      className="target-folder-grid-card"
                      onClick={() => handleBatchMoveBooks(f.id)}
                      title={`移入 ${f.name}`}
                    >
                      <div className="target-folder-card-icon" style={{ backgroundColor: '#8b7355' }}>
                        <Folder size={18} color="#ffffff" />
                      </div>
                      <div className="target-folder-card-title" title={f.name}>
                        {f.name}
                      </div>
                      <div className="target-folder-card-count">
                        {bookCount}本經書
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Builder 進度遮罩 (6 方塊現代質感) */}
      {buildProgress && (
        <BuilderProgressOverlay 
          buildProgress={buildProgress} 
          theme={settings.theme} 
        />
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

              {/* 💡 選擇資料夾顏色：暫時隱藏 (color picker hidden temporarily) */}


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

      {/* 編輯資料夾（修改名稱與顏色）對話框（僅在非集中管理面板時作為備援） */}
      {editingFolderId && !showFolderManagerModal && (
        <div className="search-dialog-overlay" onClick={() => setEditingFolderId(null)}>
          <div className="search-dialog-card animate-slide-up" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>編輯資料夾</h3>
              <button className="icon-button close-btn" onClick={() => setEditingFolderId(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="dialog-body" style={{ gap: '1.2rem', padding: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="請輸入資料夾名稱..."
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



      {/* 📁 「我的書櫃」所有資料夾集中管理 Modal (上移、下移、重新命名、刪除) */}
      {showFolderManagerModal && (
        <div className="search-dialog-overlay" onClick={() => { setEditingFolderId(null); setShowFolderManagerModal(false); }}>
          <div className="search-dialog-card action-menu-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '92%', borderRadius: '16px', padding: '1.2rem' }}>
            <div className="dialog-header" style={{ marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                <Folder size={18} style={{ color: '#8c4b27' }} />
                <span>資料夾管理</span>
              </div>
              <button className="icon-button close-btn" onClick={() => { setEditingFolderId(null); setShowFolderManagerModal(false); }}>
                <X size={18} />
              </button>
            </div>

            <div className="dialog-body" style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.2rem 0.1rem' }}>
              {folders.filter(f => !f.parentId).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  目前尚無自訂資料夾
                </div>
              ) : (
                folders.filter(f => !f.parentId).map((folder, index, arr) => {
                  const bookCount = getFolderTotalBookCount(folder.id);
                  const isEditingThis = editingFolderId === folder.id;

                  return (
                    <div 
                      key={folder.id} 
                      className="folder-manager-item"
                    >
                      {/* 左側：資料夾名稱與書本數量 或 內嵌即時輸入框（點選直接文字反白修改） */}
                      <div className="folder-manager-item-left">
                        <Folder size={16} style={{ color: '#8b7355', flexShrink: 0 }} />
                        {isEditingThis ? (
                          <input
                            autoFocus
                            onFocus={(e) => e.target.select()}
                            type="text"
                            className="folder-manager-inline-input"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameFolder();
                              } else if (e.key === 'Escape') {
                                setEditingFolderId(null);
                              }
                            }}
                            onBlur={() => {
                              handleRenameFolder();
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <span 
                              className="folder-manager-item-name" 
                              title={folder.name}
                              onClick={(e) => startRenameFolder(folder, e)}
                            >
                              {folder.name}
                            </span>
                            <span className="folder-manager-item-badge">
                              {bookCount}本
                            </span>
                          </>
                        )}
                      </div>

                      {/* 右側：4 個功能鍵 (上移、下移、重新命名、刪除) */}
                      <div className="folder-manager-item-actions">
                        {/* 1. 上移 */}
                        <button
                          className="folder-manager-action-btn"
                          disabled={index === 0}
                          onClick={() => handleSwapFolderOrder(folder.id, 'up')}
                          title="上移資料夾"
                        >
                          <ChevronUp size={16} />
                        </button>

                        {/* 2. 下移 */}
                        <button
                          className="folder-manager-action-btn"
                          disabled={index === arr.length - 1}
                          onClick={() => handleSwapFolderOrder(folder.id, 'down')}
                          title="下移資料夾"
                        >
                          <ChevronDown size={16} />
                        </button>

                        {/* 3. 重新命名 */}
                        <button
                          className={`folder-manager-action-btn ${isEditingThis ? 'active-edit' : ''}`}
                          onClick={(e) => {
                            if (isEditingThis) {
                              handleRenameFolder();
                            } else {
                              startRenameFolder(folder, e);
                            }
                          }}
                          title={isEditingThis ? '確認修改' : '重新命名資料夾'}
                        >
                          {isEditingThis ? <Check size={15} color="#1ea98c" /> : <Edit3 size={15} />}
                        </button>

                        {/* 4. 刪除 */}
                        <button
                          className="folder-manager-action-btn delete-btn"
                          onClick={(e) => {
                            handleDeleteFolder(folder.id, e);
                          }}
                          title="刪除資料夾（經典將回到近期下載）"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid var(--border-color, rgba(0,0,0,0.08))', paddingTop: '0.8rem' }}>
              <button
                className="dialog-btn-confirm"
                onClick={() => setShowFolderManagerModal(false)}
                style={{ padding: '0.45rem 1.4rem', fontSize: '0.9rem' }}
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📁 資料夾 「...」選項 Modal */}
      {menuTargetFolder && (
        <div className="search-dialog-overlay" onClick={() => setMenuTargetFolder(null)}>
          <div className="search-dialog-card action-menu-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '320px', borderRadius: '16px', padding: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.02rem', fontWeight: 'bold', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <Folder size={18} style={{ color: '#8b7355', flexShrink: 0 }} />
                <span>{menuTargetFolder.name}</span>
              </div>
              {/* 💡 順序移動控制：前移 (<) 與 後移 (>) */}
              <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                <button 
                  className="square-btn"
                  style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => handleSwapFolderOrder(menuTargetFolder.id, 'left')}
                  title="向前移動資料夾順序"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  className="square-btn"
                  style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => handleSwapFolderOrder(menuTargetFolder.id, 'right')}
                  title="向後移動資料夾順序"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button 
                className="action-menu-item-btn"
                onClick={(e) => {
                  const f = menuTargetFolder;
                  setMenuTargetFolder(null);
                  startRenameFolder(f, e);
                }}
              >
                <Edit3 size={16} />
                <span>重新命名資料夾</span>
              </button>
              <button 
                className="action-menu-item-btn delete-action"
                onClick={(e) => {
                  const f = menuTargetFolder;
                  setMenuTargetFolder(null);
                  handleDeleteFolder(f.id, e);
                }}
              >
                <Trash2 size={16} />
                <span>刪除資料夾</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📖 經典 「...」選項 Modal (上半部經文詳細資訊 + 下半部功能鍵) */}
      {menuTargetBook && (
        <div className="search-dialog-overlay" onClick={() => setMenuTargetBook(null)}>
          <div className="search-dialog-card action-menu-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px', borderRadius: '16px', padding: '1.2rem' }}>
            
            {/* 💡 【上半部份：經文資訊】 */}
            <div>
              {/* 經名標題 (簡潔圖示 + 經名) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.8rem', fontFamily: 'var(--font-serif)' }}>
                <BookOpen size={20} style={{ color: '#5b82a6', flexShrink: 0 }} />
                <span>{menuTargetBook.title}</span>
              </div>

              {/* 詳細經文資訊 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.86rem', color: 'var(--text-primary)', opacity: 0.9, padding: '0 0.2rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>作譯者 : </span>{sanitizeCreators(menuTargetBook.creators)}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>經號 : </span>CBETA No. {menuTargetBook.workId}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>部類 : </span>{menuTargetBook.category || '大藏經部類'}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>冊別 : </span>{menuTargetBook.vol || menuTargetBook.canon || 'CBETA 典籍'}</div>
                {(() => {
                  const count = getBookCjkChars(menuTargetBook);
                  return (
                    <>
                      <div><span style={{ color: 'var(--text-muted)' }}>字數 : </span>{count > 0 ? `${count.toLocaleString()} 字` : '—'}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>預計閱讀時間 : </span>{formatEstimatedReadingTime(count)}</div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* 💡 【細細分隔線】 */}
            <div style={{ margin: '0.9rem 0 0.7rem 0', borderTop: '1px solid var(--border-color, rgba(0,0,0,0.12))' }} />

            {/* 💡 【下半部份：功能鍵 (1 列 4 個圖示按鈕)】 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {/* 若在子資料夾，顯示「移出至上一層」選項 */}
              {currentFolderId && !currentFolderId.startsWith('virtual_') && (
                <button 
                  className="action-menu-item-btn"
                  onClick={(e) => {
                    handleRemoveFromFolder(e, menuTargetBook.workId);
                    setMenuTargetBook(null);
                  }}
                  style={{ marginBottom: '0.2rem' }}
                >
                  <ArrowUp size={16} />
                  <span>移出至上一層資料夾</span>
                </button>
              )}

              {/* 1 列 3 個按鈕：移至資料夾 | 加入我的最愛 | 刪除經文 (等寬 1:1:1 佐以細分隔線) */}
              {(() => {
                const isTransitionFolder = menuTargetBookSource === 'virtual_recent_reads' || menuTargetBookSource === 'virtual_favorites';
                return (
                  <div className="action-buttons-grid-3">
                    {/* 1. 移至資料夾 */}
                    <button 
                      className="action-grid-btn"
                      disabled={isTransitionFolder}
                      style={isTransitionFolder ? { opacity: 0.35, cursor: 'not-allowed', filter: 'grayscale(1)' } : undefined}
                      onClick={() => {
                        if (isTransitionFolder) return;
                        const b = menuTargetBook;
                        setMenuTargetBook(null);
                        setSelectedBookIds([b.workId]);
                        setShowBatchMoveDialog(true);
                      }}
                      title={isTransitionFolder ? '過渡專區不可移動，請至原資料夾操作' : '移至資料夾'}
                    >
                      <FolderInput size={20} />
                      <span>移至資料夾</span>
                    </button>

                    {/* 分隔線 1 */}
                    <div className="action-grid-divider" />

                    {/* 2. 加入我的最愛 */}
                    <button 
                      className="action-grid-btn"
                      onClick={(e) => {
                        toggleFavoriteBook(e, menuTargetBook.workId);
                      }}
                      title={favoriteWorkIds.includes(menuTargetBook.workId) ? '取消最愛' : '加入我的最愛'}
                    >
                      <Heart 
                        size={20} 
                        fill={favoriteWorkIds.includes(menuTargetBook.workId) ? "#e53e3e" : "none"} 
                        color={favoriteWorkIds.includes(menuTargetBook.workId) ? "#e53e3e" : "currentColor"} 
                      />
                      <span>{favoriteWorkIds.includes(menuTargetBook.workId) ? '取消最愛' : '加入我的最愛'}</span>
                    </button>

                    {/* 分隔線 2 */}
                    <div className="action-grid-divider" />

                    {/* 3. 刪除經文 */}
                    <button 
                      className="action-grid-btn delete-action"
                      disabled={isTransitionFolder}
                      style={isTransitionFolder ? { opacity: 0.35, cursor: 'not-allowed', filter: 'grayscale(1)' } : undefined}
                      onClick={(e) => {
                        if (isTransitionFolder) return;
                        const b = menuTargetBook;
                        setMenuTargetBook(null);
                        if (currentFolderId === 'virtual_resume') {
                          handleDeleteProgress(e, b.workId);
                        } else {
                          handleDeleteBook(e, b.workId);
                        }
                      }}
                      title={isTransitionFolder ? '過渡專區不可刪除，請至原資料夾操作' : '刪除經文'}
                    >
                      <Trash2 size={20} color={isTransitionFolder ? 'var(--text-muted)' : '#e53e3e'} />
                      <span style={{ color: isTransitionFolder ? 'var(--text-muted)' : '#e53e3e' }}>刪除經文</span>
                    </button>
                  </div>
                );
              })()}

              {/* 閱讀控制按鈕 (維持「從頭開始閱讀」與「接續閱讀」雙欄按鈕) */}

              {/* 6. 開始閱讀：分二個按鈕「從頭開始閱讀」與「接續閱讀」 */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                <button 
                  className="dialog-btn-cancel"
                  style={{ flex: 1, padding: '0.65rem 0.3rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  onClick={() => {
                    const b = menuTargetBook;
                    setMenuTargetBook(null);
                    localStorage.removeItem(`reader_progress_${b.workId}`);
                    onSelectBook(b.workId, '', '', 'restart');
                  }}
                  title="從頭開始閱讀 (清空歷史進度)"
                >
                  <RotateCcw size={14} />
                  <span>從頭開始閱讀</span>
                </button>

                <button 
                  className="dialog-btn-confirm"
                  style={{ flex: 1, padding: '0.65rem 0.3rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  onClick={() => {
                    const b = menuTargetBook;
                    setMenuTargetBook(null);
                    onSelectBook(b.workId, '', '', 'resume');
                  }}
                  title="接續上一次的閱讀位置"
                >
                  <Play size={14} />
                  <span>接續閱讀</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💡 首頁「劃線筆記」編輯 Modal */}
      {editingHighlightInLibrary && (
        <div className="search-dialog-overlay" onClick={() => setEditingHighlightInLibrary(null)}>
          <div className="search-dialog-card animate-slide-up" style={{ maxWidth: '420px', borderRadius: '16px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📝 編輯感悟筆記</span>
              </h3>
              <button className="icon-button close-btn" onClick={() => setEditingHighlightInLibrary(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="dialog-body" style={{ gap: '1rem', padding: '1.2rem' }}>
              <div 
                style={{ 
                  fontSize: '0.85rem', 
                  color: 'var(--text-muted)', 
                  backgroundColor: 'var(--theme-accent-light, rgba(0,0,0,0.04))', 
                  padding: '0.6rem 0.8rem', 
                  borderRadius: '8px',
                  borderLeft: '3px solid var(--theme-accent)'
                }}
              >
                「{editingHighlightInLibrary.text}」
              </div>

              <textarea
                placeholder="寫下您對此句經文的感悟或讀後心得..."
                value={editingNoteTextInLibrary}
                onChange={(e) => setEditingNoteTextInLibrary(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                  backgroundColor: 'var(--input-bg, rgba(255,255,255,0.8))',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  fontFamily: '"CBETASupplement", "標楷體", "BiauKai", "DFKai-SB", "TW-Kai", "STKaiti", "KaiTi", serif',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />

              <div style={{ display: 'flex', gap: '0.8rem', width: '100%', marginTop: '0.2rem' }}>
                <button 
                  className="dialog-btn-confirm"
                  onClick={async () => {
                    if (!editingHighlightInLibrary) return;
                    const updated = {
                      ...editingHighlightInLibrary,
                      note: editingNoteTextInLibrary.trim()
                    };
                    await saveHighlight(updated);
                    await loadAllHighlights();
                    setEditingHighlightInLibrary(null);
                  }}
                  style={{ flex: 1 }}
                >
                  儲存修改
                </button>
                <button 
                  className="dialog-btn-cancel"
                  onClick={() => setEditingHighlightInLibrary(null)}
                  style={{ flex: 1 }}
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
