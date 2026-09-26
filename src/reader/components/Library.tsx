import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Check, CheckSquare, CheckCircle2, X, Download,
  Home, Search, CalendarDays,
  Folder, FolderPlus, Edit3, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Settings, Clock, Heart, Trash2, FolderInput, MoreVertical, Notebook, BookOpen, Play, RotateCcw, Tag,
  Layers, User
} from 'lucide-react';
import type { BookMetadata, ReaderPackage } from '../../types/book';
import { listBooks, deleteBook, getAllHighlights, deleteHighlight, saveHighlight } from '../../utils/db';
import type { AppSettings, BookHighlight } from '../../utils/db';
import { buildKeywordComparisonGroups } from '../../utils/notesCrossComparison';
import { IndexBuilder, FEATURED_BOOKS, sanitizeCreators } from '../../builder/IndexBuilder';
import type { SearchResult } from '../../builder/IndexBuilder';
import { PackageBuilder } from '../../builder/PackageBuilder';
import type { BuildProgress } from '../../builder/PackageBuilder';
import { BuilderProgressOverlay } from './BuilderProgressOverlay';
import { SearchPanel } from './SearchPanel';
import { ReadingLogView } from './ReadingLogView';
import { HomeDashboard } from './HomeDashboard';
import { CbetaCatalogView, STATIC_DEPT_CATEGORIES } from './CbetaCatalogView';
import { BookshelfInteractivePlayground, getDeptCategoryInfo, getCanonCategoryInfo, parseCreators } from './BookshelfInteractivePlayground';
import { updateHashRoute } from '../../App';
import { isBackupMode, subscribeSourceMode } from '../../utils/sourceMode';
import { getBookCoverGradient } from '../../utils/bookColors';
import '../styles/library.css';

interface LibraryProps {
  onSelectBook: (workId: string, segmentId?: string, searchQuery?: string, autoResumeMode?: 'resume' | 'restart') => void;
  booksUpdatedTrigger: number;
  settings: AppSettings;
  initialSearchQuery?: string;
  resetFolderTrigger?: number;
  targetSection?: { section: 'home' | 'shelf' | 'notes' | 'search' | 'reading-log' | 'cbeta'; timestamp: number } | null;
  onOpenSettings?: () => void;
  onOpenCbetaCatalog?: () => void;
  onSaveSettings?: (settings: AppSettings) => void;
}

export function Library({ 
  onSelectBook, 
  booksUpdatedTrigger,
  settings,
  initialSearchQuery,
  resetFolderTrigger,
  targetSection,
  onOpenSettings,
  onOpenCbetaCatalog,
  onSaveSettings
}: LibraryProps) {
  const [downloadedBooks, setDownloadedBooks] = useState<BookMetadata[]>([]);
  const [downloadedPackages, setDownloadedPackages] = useState<ReaderPackage[]>([]);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<SearchResult[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  
  // Builder 進度與動畫
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null);
  const [activeTab, setActiveTab] = useState<'shelf' | 'search' | 'reading-log' | 'cbeta'>(initialSearchQuery ? 'search' : 'shelf');
  const [progressUpdatedTrigger, setProgressUpdatedTrigger] = useState(0);
  const [isLayoutEditMode, setIsLayoutEditMode] = useState(false);
  const [showPlaygroundDemo, setShowPlaygroundDemo] = useState(true);

  // 💡 目錄外部跳轉目標（由書櫃/筆記分組標題點擊跳轉特定部類）
  const [catalogTargetCategory, setCatalogTargetCategory] = useState<{
    tab: 'favorite' | 'dept' | 'vol' | 'creator' | 'time';
    node: { id: string; label: string };
  } | null>(null);

  const handleNavigateToCatalogCategory = (target: {
    tab: 'favorite' | 'dept' | 'vol' | 'creator' | 'time';
    node: { id: string; label: string };
  }) => {
    setCatalogTargetCategory(target);
    setActiveTab('cbeta');
  };

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
    } else {
      setCurrentFolderId(null);
    }
  };

  // 💡 當接收到首頁重設信號時，重置當前所在的資料夾路徑與瀏覽歷史，並回到首頁
  useEffect(() => {
    if (resetFolderTrigger && resetFolderTrigger > 0) {
      setActiveTab('shelf');
      setCurrentFolderId(null);
      setFolderHistory([null]);
      setHistoryIndex(0);
    }
  }, [resetFolderTrigger]);

  // 💡 當接收到全站頂部四大功能導航目標時，在渲染期即時同步狀態（徹底消除切換時的 1 幀白屏/首頁閃爍）
  const [prevTargetSectionTimestamp, setPrevTargetSectionTimestamp] = useState<number | null>(null);
  if (targetSection && targetSection.timestamp !== prevTargetSectionTimestamp) {
    setPrevTargetSectionTimestamp(targetSection.timestamp);
    if (targetSection.section === 'home') {
      setActiveTab('shelf');
      setCurrentFolderId(null);
      setFolderHistory([null]);
      setHistoryIndex(0);
    } else if (targetSection.section === 'shelf') {
      setActiveTab('shelf');
      setCurrentFolderId('virtual_my_folders');
      setFolderHistory(['virtual_my_folders']);
      setHistoryIndex(0);
    } else if (targetSection.section === 'notes') {
      setActiveTab('shelf');
      setCurrentFolderId('virtual_highlights');
      setFolderHistory(['virtual_highlights']);
      setHistoryIndex(0);
    } else if (targetSection.section === 'search') {
      setActiveTab('search');
    } else if (targetSection.section === 'reading-log') {
      setActiveTab('reading-log');
    } else if (targetSection.section === 'cbeta') {
      setActiveTab('cbeta');
    }
  }

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
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [menuTargetFolder, setMenuTargetFolder] = useState<BookFolder | null>(null);
  const [menuTargetBook, setMenuTargetBook] = useState<BookMetadata | null>(null);
  const [menuTargetBookSource, setMenuTargetBookSource] = useState<string | null>(null);

  const [selectedOnlineWorkIds, setSelectedOnlineWorkIds] = useState<string[]>([]);
  const [showBatchDownloadModal, setShowBatchDownloadModal] = useState(false);
  const [batchFolderMode, setBatchFolderMode] = useState<'unclassified' | 'existing' | 'new'>('unclassified');
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
    return (book.juansCount || 1) * 8000;
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

  // 💡 點擊「+」開啟 CBETA 藏經庫時
  const handleOpenCbetaCatalogWithAnimation = () => {
    setActiveTab('cbeta');
    updateHashRoute('cbeta');
    if (onOpenCbetaCatalog) {
      onOpenCbetaCatalog();
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
    
    // 如果在「我的書櫃」專區或在分類管理 Modal，parentId 設為 null，屬於頂層自訂資料夾
    const targetParentId = (showFolderManagerModal || currentFolderId === 'virtual_my_folders') ? null : currentFolderId;

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
    } catch (e) {
      console.error('Failed to load local books from IndexedDB:', e);
    }
  };

  // 💡 僅在使用者切換至「關鍵字搜尋」分頁時，才在背景輕量載入搜尋索引 (避免首頁啟動時載入大量經文造成手機 Safari 記憶體爆表閃退)
  useEffect(() => {
    if (activeTab === 'search' && downloadedPackages.length === 0 && downloadedBooks.length > 0) {
      const loadSearchIndexes = async () => {
        try {
          const { getBook } = await import('../../utils/db');
          const pkgs: ReaderPackage[] = [];
          for (const meta of downloadedBooks) {
            const pkg = await getBook(meta.workId);
            if (pkg) {
              pkgs.push({
                metadata: pkg.metadata,
                searchIndex: pkg.searchIndex
              } as ReaderPackage);
            }
          }
          setDownloadedPackages(pkgs);
        } catch (e) {
          console.warn('Failed to load search indexes:', e);
        }
      };
      loadSearchIndexes();
    }
  }, [activeTab, downloadedBooks, downloadedPackages.length]);

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

    // 1. 處理目標資料夾 ID (新建分類 或 放入 我的書櫃/已有資料夾 或 放入 我的書櫃/近期下載)
    if (batchFolderMode === 'new' && batchFolderName.trim()) {
      const newFolder: BookFolder = {
        id: `folder-${Date.now()}`,
        name: batchFolderName.trim(),
        bookIds: [],
        parentId: null,
        color: batchFolderColor
      };
      targetFolderId = newFolder.id;
      const updatedFolders = [...folders, newFolder];
      saveFolders(updatedFolders);
    } else if (batchFolderMode === 'existing') {
      const found = folders.find(f => f.id === selectedExistingFolderId) || folders[0];
      targetFolderId = found ? found.id : null;
    } else {
      // 放入 我的書櫃/近期下載 (targetFolderId 為 null，即未分類經典)
      targetFolderId = null;
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

  // 💡 重點與筆記：雙分段切換（'books' 依書籍檢視 vs 'dimensions' 法義多維度）與 4 快捷膠囊
  const [notesViewMode, setNotesViewMode] = useState<'books' | 'dimensions'>('books');
  const [notesFilterStatus, setNotesFilterStatus] = useState<'all' | 'has_note' | 'only_hl' | 'recent'>('all');
  const [expandedKeywordGroups, setExpandedKeywordGroups] = useState<Record<string, boolean>>({});

  const toggleKeywordGroup = (kw: string) => {
    setExpandedKeywordGroups(prev => ({
      ...prev,
      [kw]: prev[kw] === false ? true : false
    }));
  };

  // 快捷膠囊計數
  const notesHasNoteCount = useMemo(() => allHighlights.filter(h => !!h.note).length, [allHighlights]);
  const notesOnlyHlCount = useMemo(() => allHighlights.filter(h => !h.note).length, [allHighlights]);

  // 依 4 快捷膠囊過濾重點條目池
  const filteredHighlights = useMemo(() => {
    return allHighlights.filter(hl => {
      if (notesFilterStatus === 'has_note') return !!hl.note;
      if (notesFilterStatus === 'only_hl') return !hl.note;
      if (notesFilterStatus === 'recent') {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        return hl.createdAt >= thirtyDaysAgo;
      }
      return true;
    });
  }, [allHighlights, notesFilterStatus]);

  // 依書籍分組 (根據 filteredHighlights 排序)
  const groupedHighlights = useMemo(() => {
    const map = new Map<string, { workId: string; title: string; list: BookHighlight[] }>();
    filteredHighlights.forEach(hl => {
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
  }, [filteredHighlights, downloadedBooks]);

  // 🌟 法義多維度：客觀文字關鍵字交叉聚合 (頻次 ≥ 3 次自動成群)
  const keywordComparisonGroups = useMemo(() => {
    return buildKeywordComparisonGroups(filteredHighlights);
  }, [filteredHighlights]);

  // 💡 「我的筆記」4 大維度分類（依部類 / 依冊別 / 依作譯者 / 依朝代）
  const [notesClassificationMode, setNotesClassificationMode] = useState<'category' | 'volume' | 'author' | 'dynasty'>('category');
  const [expandedDimensionGroups, setExpandedDimensionGroups] = useState<Record<string, boolean>>({});

  const toggleDimensionGroup = (groupTitle: string) => {
    setExpandedDimensionGroups(prev => ({
      ...prev,
      [groupTitle]: prev[groupTitle] === false ? true : false
    }));
  };

  // 依選取的維度進行筆記分組（依部類、依冊別、依作譯者、依朝代）
  const notesDimensionGroups = useMemo(() => {
    const groups: Record<string, { order: number; books: typeof groupedHighlights }> = {};

    groupedHighlights.forEach(bookGroup => {
      const bookMeta = downloadedBooks.find(b => b.workId === bookGroup.workId);
      const effectiveMeta: BookMetadata = bookMeta || {
        workId: bookGroup.workId,
        title: bookGroup.title,
        canon: 'T',
        vol: 'T01',
        creators: '',
        juansCount: 1,
        category: '未分類'
      };

      let key = '未分類';
      let sortOrder = 999;

      if (notesClassificationMode === 'category') {
        const info = getDeptCategoryInfo(effectiveMeta);
        key = info.key;
        sortOrder = info.order;
      } else if (notesClassificationMode === 'volume') {
        const info = getCanonCategoryInfo(effectiveMeta);
        key = info.key;
        sortOrder = info.order;
      } else if (notesClassificationMode === 'author') {
        const { authorName, dynastyOrder } = parseCreators(effectiveMeta.creators);
        key = authorName;
        sortOrder = dynastyOrder * 1000;
      } else if (notesClassificationMode === 'dynasty') {
        const { dynastyName, dynastyOrder } = parseCreators(effectiveMeta.creators);
        key = dynastyName;
        sortOrder = dynastyOrder;
      }

      if (!groups[key]) {
        groups[key] = { order: sortOrder, books: [] };
      }
      groups[key].books.push(bookGroup);
    });

    const sortedEntries = Object.entries(groups).sort((a, b) => {
      if (a[1].order !== b[1].order) {
        return a[1].order - b[1].order;
      }
      return a[0].localeCompare(b[0], 'zh-Hant');
    });

    return sortedEntries;
  }, [groupedHighlights, downloadedBooks, notesClassificationMode]);

  // 關鍵字高亮渲染輔助函式
  const renderMatchedKeywordText = (text: string, keyword: string) => {
    if (!text || !keyword) return text;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, idx) => {
      if (part.toLowerCase() === keyword.toLowerCase()) {
        return (
          <span key={idx} className="kw-matched-highlight">
            {part}
          </span>
        );
      }
      return part;
    });
  };

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
            ? unclassifiedBooks.slice(0, 9)
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
    if (folderId === 'virtual_recent_reads') return '上次閱讀';
    if (folderId === 'virtual_favorites') return '我的最愛';
    if (folderId === 'virtual_unclassified') return '近期下載';
    if (folderId === 'virtual_highlights') return '我的筆記';
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
        <div className="horizontal-book-badge" style={{ background: getBookCoverGradient(book.workId) }}>
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
      
      {/* 首頁一致控制列：雙翼對稱展開微膠囊 (方案 C + 方案 B) */}
      <div className="library-header animate-fade-in">
        {isBackup && (
          <div className="header-backup-badge" title="目前處於備援閱讀模式 (?source=backup)">
            備援
          </div>
        )}
        
        {/* 1. 左端：家 (Home) */}
        <button 
          className={`library-header-btn ${activeTab === 'shelf' && !currentFolderId ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('shelf');
            setCurrentFolderId(null);
            setFolderHistory([null]);
            setHistoryIndex(0);
            updateHashRoute('library');
          }}
          title="書架首頁"
        >
          <Home size={20} />
        </button>

        {/* 2. 中央統一微膠囊：[ 下載 + 書櫃 + 筆記 + 搜尋 + (閱讀日誌) ] */}
        <div className="unified-nav-capsule">
          {/* 下載經典 */}
          <button
            className={`capsule-nav-item ${activeTab === 'cbeta' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('cbeta');
              updateHashRoute('cbeta');
              onOpenCbetaCatalog?.();
            }}
            title="從 CBETA 資料庫下載經典"
          >
            <Plus size={17} style={{ strokeWidth: 2.2 }} />
            <span className="capsule-label">下載經典</span>
          </button>

          {/* 我的書櫃 */}
          <button
            className={`capsule-nav-item ${activeTab === 'shelf' && (currentFolderId === 'virtual_my_folders' || (currentFolderId && currentFolderId !== 'virtual_highlights')) ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('shelf');
              navigateToFolder('virtual_my_folders');
              updateHashRoute('library');
            }}
            title="我的書櫃（已下載經典與資料夾）"
          >
            <Folder size={16} />
            <span className="capsule-label">我的書櫃</span>
          </button>

          {/* 我的筆記 */}
          <button
            className={`capsule-nav-item ${activeTab === 'shelf' && currentFolderId === 'virtual_highlights' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('shelf');
              navigateToFolder('virtual_highlights');
              updateHashRoute('library');
            }}
            title="我的筆記"
          >
            <Notebook size={16} />
            <span className="capsule-label">我的筆記</span>
          </button>

          {/* 全文搜尋 */}
          <button
            className={`capsule-nav-item ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('search');
              updateHashRoute('library');
            }}
            title="關鍵字搜尋（已下載經典檢索）"
          >
            <Search size={16} />
            <span className="capsule-label">全文搜尋</span>
          </button>

          {/* 閱讀日誌（若勾選「閱讀日誌」時整合於微膠囊內） */}
          {settings.readingLogEnabled && (
            <button
              className={`capsule-nav-item ${activeTab === 'reading-log' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('reading-log');
                updateHashRoute('library');
              }}
              title="閱讀日誌"
            >
              <CalendarDays size={16} />
              <span className="capsule-label">閱讀日誌</span>
            </button>
          )}
        </div>

        {/* 3. 右端：設定 */}
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
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
            <div className={`folder-nav-wrapper ${(currentFolderId === 'virtual_my_folders' || currentFolderId === 'virtual_highlights') ? 'my-folders-nav' : ''}`}>
              <div className="folder-navigation-bar">
                {/* 💡 深入專區/子資料夾時，左側顯示圓型「<」返回上一層（與下方書籍卡片左側對齊） */}
                {currentFolderId && currentFolderId !== 'virtual_my_folders' && currentFolderId !== 'virtual_highlights' && (
                  <button 
                    type="button"
                    className="folder-back-circle-btn"
                    onClick={handleGoBack}
                    title="返回上一層"
                  >
                    <ChevronLeft size={18} strokeWidth={2.6} />
                  </button>
                )}
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
                                       currentFolderId === 'virtual_unclassified' ? '#2b6cb0' :
                                       '#8c4b27',
                      flexShrink: 0
                    }}
                  >
                    {currentFolderId === 'virtual_recent_reads' ? <Clock size={13} color="#ffffff" /> :
                     currentFolderId === 'virtual_favorites' ? <Heart size={13} fill="#ffffff" color="#ffffff" /> :
                     currentFolderId === 'virtual_highlights' ? <Notebook size={13} color="#ffffff" /> :
                     currentFolderId === 'virtual_unclassified' ? <Download size={13} color="#ffffff" style={{ strokeWidth: 2.2 }} /> :
                     <Folder size={13} color="#ffffff" />}
                  </div>

                  <span className="folder-path-display">
                    {currentFolderId === 'virtual_resume' ? '繼續閱讀' : 
                     currentFolderId === 'virtual_recent_reads' ? '上次閱讀' :
                     currentFolderId === 'virtual_favorites' ? '我的最愛' :
                     currentFolderId === 'virtual_highlights' ? '我的筆記' :
                     currentFolderId === 'virtual_my_folders' ? '我的書櫃' :
                     currentFolderId === 'virtual_unclassified' ? '近期下載' :
                     getFolderPath(currentFolderId)}
                  </span>

                  {/* 💡 在「我的書櫃」時恆常提供圓形「...」資料夾集中管理按鈕 */}
                  {currentFolderId === 'virtual_my_folders' && (
                    <button
                      className="appstore-section-circle-more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFolderManagerModal(true);
                      }}
                      title="我的書櫃分類管理（新增分類、上移、下移、重新命名、刪除）"
                      style={{ marginLeft: '4px' }}
                    >
                      <MoreVertical size={13} />
                    </button>
                  )}
                </div>
                <div className="folder-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="folder-book-count-badge" title="當前層級數量">
                    {currentFolderId === 'virtual_my_folders' ? `共${downloadedBooks.length}本` :
                     currentFolderId === 'virtual_recent_reads' ? `共${recentReadsBooks.length}本` :
                     currentFolderId === 'virtual_favorites' ? `共${favoriteBooksList.length}本` :
                     currentFolderId === 'virtual_unclassified' ? `共${Math.min(unclassifiedBooks.length, 9)}本` :
                     currentFolderId === 'virtual_highlights' ? `共${allHighlights.length}則` :
                     currentFolderId === 'virtual_resume' ? `共${displayBooks.length}本` :
                     `共${getFolderTotalBookCount(currentFolderId)}本`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* === A. 最外層首頁：CBETA Reader 4格卡片系統首頁 (支援自由自訂/拖曳排序/切換尺寸) === */}
          {!currentFolderId && (
            <div className="home-dashboard-container animate-fade-in">
              <HomeDashboard
                downloadedBooks={downloadedBooks}
                resumeBooks={resumeBooks}
                allHighlights={allHighlights}
                settings={settings}
                onSaveSettings={onSaveSettings || (() => {})}
                onSelectBook={onSelectBook}
                onOpenCbetaCatalog={onOpenCbetaCatalog || handleOpenCbetaCatalogWithAnimation}
                onNavigateToLibrarySection={(section) => {
                  if (section === 'shelf') {
                    setActiveTab('shelf');
                    navigateToFolder('virtual_my_folders');
                    updateHashRoute('library');
                  } else if (section === 'notes') {
                    setActiveTab('shelf');
                    navigateToFolder('virtual_highlights');
                    updateHashRoute('library');
                  } else if (section === 'search') {
                    setActiveTab('search');
                    updateHashRoute('library');
                  } else if (section === 'reading-log') {
                    setActiveTab('reading-log');
                    updateHashRoute('library');
                  } else if (section === 'cbeta') {
                    setActiveTab('cbeta');
                    updateHashRoute('cbeta');
                  } else if (section === 'home') {
                    setActiveTab('shelf');
                    navigateToFolder(null);
                    updateHashRoute('library');
                  }
                }}
                onOpenFolder={navigateToFolderWithAnimation}
                isLayoutEditMode={isLayoutEditMode}
                setIsLayoutEditMode={setIsLayoutEditMode}
              />
            </div>
          )}

          {/* === B. 「我的書櫃」（virtual_my_folders）：支援體驗 ABC 互動排版提案與原版書櫃切換 === */}
          {currentFolderId === 'virtual_my_folders' && (
            <>
              {/* 💡 方案切換左右雙分段膠囊（左：「讀者分類」 / 右：「多維度分類」） */}
              <div className="bookshelf-scheme-switch-container">
                <div className="bookshelf-scheme-segmented-capsule">
                  <button
                    type="button"
                    className={`scheme-seg-btn ${!showPlaygroundDemo ? 'active' : ''}`}
                    onClick={() => setShowPlaygroundDemo(false)}
                    title="切換至讀者分類（一般資料夾方案）"
                  >
                    讀者分類
                  </button>
                  <button
                    type="button"
                    className={`scheme-seg-btn ${showPlaygroundDemo ? 'active' : ''}`}
                    onClick={() => setShowPlaygroundDemo(true)}
                    title="切換至多維度分類（經藏多維度整理方案）"
                  >
                    多維度分類
                  </button>
                </div>
              </div>

              {showPlaygroundDemo ? (
                <div className="appstore-bookshelf-container animate-fade-in" style={{ transform: 'none' }}>
                  <BookshelfInteractivePlayground
                    downloadedBooks={downloadedBooks}
                    favoriteWorkIds={favoriteWorkIds}
                    recentReadsBooks={recentReadsBooks}
                    onSelectBook={onSelectBook}
                    onExitDemo={() => setShowPlaygroundDemo(false)}
                    onOpenBookMenu={(book) => {
                      setMenuTargetBook(book);
                      setMenuTargetBookSource(currentFolderId || null);
                    }}
                    onToggleFavorite={(workId) => {
                      toggleFavoriteBook(undefined as any, workId);
                    }}
                    onDeleteBook={(workId) => {
                      handleDeleteBook(undefined as any, workId);
                    }}
                    onNavigateToCatalogCategory={handleNavigateToCatalogCategory}
                  />
                </div>
              ) : (
                <div className="appstore-bookshelf-container animate-slide-up">
                  {/* 1. 最上面：近期下載 (未分類經書，一直都留著，若無書籍則為空) */}
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
                      {Math.min(unclassifiedBooks.length, 9)}
                    </span>
                  </div>
                </div>
                {unclassifiedBooks.length > 0 && (
                  <div className="appstore-carousel-scroll custom-scrollbar">
                    {chunkBooksInto3(unclassifiedBooks.slice(0, 9)).map((colBooks, colIdx) => (
                      <div key={`unclassified-col-${colIdx}`} className="appstore-carousel-column">
                        {colBooks.map(b => renderBookCard(b, false, 'virtual_unclassified'))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. 下一個：上次閱讀 (最多 9 本，即 3 欄 × 3 列) */}
              {recentReadsBooks.length > 0 && (
                <div className="appstore-section animate-fade-in">
                  <div 
                    className="appstore-section-header"
                    onClick={() => navigateToFolderWithAnimation('virtual_recent_reads')}
                    title="點擊查看所有上次閱讀經典"
                  >
                    <div className="appstore-section-title-wrap">
                      <span className="appstore-section-title-capsule appstore-capsule-recent">
                        <Clock size={15} style={{ strokeWidth: 2.2 }} />
                        <span>上次閱讀</span>
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

              {/* 3. 下一個：我的最愛 */}
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
        </>
      )}

          {/* === C. 「我的筆記」（virtual_highlights）：支援「依書籍檢視」與「法義多維度」雙分段 + 4 維度分類 + 4 快捷膠囊 (與「我的書櫃」完全一致對齊) === */}
          {currentFolderId === 'virtual_highlights' && (
            <>
              {/* 1. 雙分段切換膠囊（左：「依書籍檢視」 / 右：「法義多維度」） */}
              <div className="bookshelf-scheme-switch-container">
                <div className="bookshelf-scheme-segmented-capsule">
                  <button
                    type="button"
                    className={`scheme-seg-btn ${notesViewMode === 'books' ? 'active' : ''}`}
                    onClick={() => setNotesViewMode('books')}
                    title="依書籍檢視劃線與筆記"
                  >
                    依書籍檢視
                  </button>
                  <button
                    type="button"
                    className={`scheme-seg-btn ${notesViewMode === 'dimensions' ? 'active' : ''}`}
                    onClick={() => setNotesViewMode('dimensions')}
                    title="法義多維度客觀關鍵字交叉比對"
                  >
                    法義多維度
                  </button>
                </div>
              </div>

              {/* 2. 主容器：使用與「我的書櫃」完全一致之 appstore-bookshelf-container + bookshelf-playground-root */}
              <div className="appstore-bookshelf-container animate-fade-in" style={{ transform: 'none' }}>
                <div className="bookshelf-playground-root animate-fade-in" style={{ padding: '0 0.85rem 3rem 0.85rem' }}>
                  {/* 🌟 吸頂浮動控制列：4 大分類切換 + 4 大膠囊快捷過濾 (比照書櫃圖1、圖2、圖3像素級對齊) */}
                  <div className="bookshelf-sticky-controls-header">
                    {/* 2. 第一層 (圖2)：4 大分類切換 (依部類 / 依冊別 / 依作譯者 / 依朝代) */}
                    <div 
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        background: 'rgba(0, 0, 0, 0.05)',
                        borderRadius: '16px',
                        padding: '4px',
                        marginBottom: '0.55rem',
                        border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      {[
                        { id: 'category', label: '依部類', icon: Layers },
                        { id: 'volume', label: '依冊別', icon: BookOpen },
                        { id: 'author', label: '依作譯者', icon: User },
                        { id: 'dynasty', label: '依朝代', icon: Clock }
                      ].map(item => {
                        const isActive = notesClassificationMode === item.id;
                        const IconComp = item.icon;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setNotesClassificationMode(item.id as any)}
                            style={{
                              padding: '0.55rem 0.2rem',
                              borderRadius: '12px',
                              border: 'none',
                              background: isActive ? 'var(--bg-card, #ffffff)' : 'transparent',
                              color: isActive ? 'var(--theme-accent, #8c4b27)' : 'var(--text-muted)',
                              fontWeight: isActive ? 800 : 600,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                              boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
                            }}
                          >
                            <IconComp size={18} strokeWidth={isActive ? 2.3 : 1.8} />
                            <span style={{ fontSize: '0.8rem', letterSpacing: '0.02em' }}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* 3. 第二層 (圖3)：4 大膠囊快捷過濾 (全部 / 有心得 / 純重點 / 近期標註) */}
                    <div 
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(4, 1fr)', 
                        gap: '6px' 
                      }}
                    >
                      {[
                        { id: 'all', label: `全部 (${allHighlights.length})` },
                        { id: 'has_note', label: `有心得 (${notesHasNoteCount})` },
                        { id: 'only_hl', label: `純重點 (${notesOnlyHlCount})` },
                        { id: 'recent', label: '近期標註' }
                      ].map(item => (
                        <button
                          key={item.id}
                          type="button"
                          className={`bookshelf-filter-capsule ${notesFilterStatus === item.id ? 'active' : ''}`}
                          onClick={() => setNotesFilterStatus(item.id as any)}
                        >
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. 狀態提示列 (第三層) */}
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      margin: '0.2rem 0.2rem 0.75rem 0.2rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600
                    }}
                  >
                    <div>
                      {notesViewMode === 'books' ? (
                        <>
                          共 {groupedHighlights.length} 部經典 · 自動依
                          {notesClassificationMode === 'category' ? '部類' :
                           notesClassificationMode === 'volume' ? '冊別' :
                           notesClassificationMode === 'author' ? '作譯者' : '朝代'}歸納
                        </>
                      ) : (
                        <>共 {keywordComparisonGroups.length} 組跨經共通關鍵字 · 頻次 ≥ 3 次客觀交叉聚合</>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {notesViewMode === 'books' ? `共 ${filteredHighlights.length} 條重點` : '客觀交叉對照'}
                    </div>
                  </div>

                  {/* 5. 內容區：依書籍檢視 vs 法義多維度 */}
                  {notesViewMode === 'books' ? (
                    /* === A. 依書籍檢視 (依 4 大分類分組折疊卡) === */
                    groupedHighlights.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                        <Notebook size={36} style={{ opacity: 0.4, marginBottom: '0.6rem' }} />
                        <p>目前篩選條件下尚無劃線重點或筆記。</p>
                        <p style={{ fontSize: '0.82rem', opacity: 0.7, marginTop: '0.3rem' }}>切換「全部」或在閱讀經典時選取文字即可加入重點。</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {notesDimensionGroups.map(([groupTitle, groupData]) => {
                          const isGroupExpanded = expandedDimensionGroups[groupTitle] !== false; // 預設展開
                          const totalHlsInGroup = groupData.books.reduce((acc, b) => acc + b.list.length, 0);
                          const deptMatch = notesClassificationMode === 'category'
                            ? STATIC_DEPT_CATEGORIES.find(c => {
                                const code = groupTitle.slice(0, 2);
                                return c.id === `CBETA.0${code}` || c.label.startsWith(groupTitle) || c.label.startsWith(code);
                              })
                            : null;

                          return (
                            <div 
                              key={groupTitle}
                              className="bookshelf-group-card"
                              style={{
                                background: 'var(--bg-card, #ffffff)',
                                borderRadius: '18px',
                                border: '1.2px solid var(--border-color, rgba(0,0,0,0.1))',
                                overflow: 'hidden',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
                              }}
                            >
                              {/* 分組標題列 (支援折疊展開) */}
                              <div 
                                onClick={() => toggleDimensionGroup(groupTitle)}
                                style={{
                                  padding: '0.75rem 1rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  background: 'rgba(140, 75, 39, 0.03)',
                                  borderBottom: isGroupExpanded ? '1px solid rgba(0,0,0,0.06)' : 'none'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--theme-accent, #8c4b27)' }} />
                                  <span 
                                    className={deptMatch ? "bookshelf-group-title-link" : ""}
                                    onClick={(e) => {
                                      if (deptMatch) {
                                        e.stopPropagation();
                                        handleNavigateToCatalogCategory({
                                          tab: 'dept',
                                          node: { id: deptMatch.id, label: deptMatch.label }
                                        });
                                      }
                                    }}
                                    style={{ 
                                      fontSize: '0.94rem', 
                                      fontWeight: 800, 
                                      color: 'var(--text-primary)', 
                                      fontFamily: 'var(--font-serif)',
                                      cursor: deptMatch ? 'pointer' : 'inherit'
                                    }}
                                    title={deptMatch ? `前往 CBETA 藏經庫瀏覽「${groupTitle}」` : undefined}
                                  >
                                    {groupTitle}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.06)', padding: '2px 7px', borderRadius: '10px' }}>
                                    {groupData.books.length} 部 · {totalHlsInGroup} 則
                                  </span>
                                </div>
                                {isGroupExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                              </div>

                              {/* 分組內容：組內書籍折疊卡 */}
                              {isGroupExpanded && (
                                <div style={{ padding: '0.55rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                  {groupData.books.map((group) => {
                                    const isBookExpanded = !!expandedBookGroups[group.workId];
                                    const isBookCollapsed = !isBookExpanded;
                                    const cleanTitle = (group.title || group.workId).replace(/[《》]/g, '').trim();

                                    return (
                                      <div 
                                        key={group.workId}
                                        className="highlight-card"
                                        style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '0.6rem',
                                          width: '100%',
                                          borderRadius: '12px',
                                          padding: '0.8rem 1rem',
                                          boxSizing: 'border-box'
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
                                                background: getBookCoverGradient(group.workId),
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
                                            {isBookCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                                          </button>
                                        </div>

                                        {/* 展開後的重點與筆記卡片清單 */}
                                        {!isBookCollapsed && (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.4rem', borderTop: '1px dashed var(--border-color, rgba(140,75,39,0.1))', paddingTop: '0.6rem' }}>
                                            {group.list.map((hl) => (
                                              <div 
                                                key={hl.id}
                                                className="highlight-entry-card"
                                                style={{
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  gap: '0.4rem',
                                                  padding: '0.6rem 0.8rem',
                                                  borderRadius: '8px'
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
                                                    className="highlight-note-content"
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
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    /* === B. 法義多維度：客觀關鍵字交叉比對 (頻次 ≥ 3 次) === */
                    keywordComparisonGroups.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                        <Tag size={36} style={{ opacity: 0.35, marginBottom: '0.6rem' }} />
                        <p style={{ fontWeight: 700, marginBottom: '0.3rem' }}>目前尚無命中 ≥ 3 次之跨經共通關鍵字</p>
                        <p style={{ fontSize: '0.8rem', opacity: 0.75, lineHeight: 1.5 }}>
                          當您在不同經典中劃重點或撰寫心得，且出現相同客觀詞彙達 3 次以上時，系統將自動在此聚集成群供您上下交叉比對。
                        </p>
                      </div>
                    ) : (
                      keywordComparisonGroups.map((grp) => {
                        const isExpanded = expandedKeywordGroups[grp.keyword] !== false; // 預設展開
                        return (
                          <div 
                            key={grp.keyword}
                            className="highlight-card"
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.6rem',
                              width: '100%',
                              borderRadius: '12px',
                              padding: '0.8rem 1rem',
                              boxSizing: 'border-box'
                            } as React.CSSProperties}
                          >
                            {/* 關鍵字分組標題列 */}
                            <div 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                userSelect: 'none'
                              }}
                              onClick={() => toggleKeywordGroup(grp.keyword)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexGrow: 1, minWidth: 0 }}>
                                <div className="keyword-cross-badge">
                                  🏷️ {grp.keyword}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <div style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    共通詞「{grp.keyword}」
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    跨 {grp.booksCount} 部經典 · 共 {grp.totalCount} 條交叉重點
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
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                            </div>

                            {/* 展開後的跨經交叉重點清單 */}
                            {isExpanded && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.4rem', borderTop: '1px dashed var(--border-color, rgba(140,75,39,0.1))', paddingTop: '0.6rem' }}>
                                {grp.highlights.map((hl) => {
                                  const bookMeta = downloadedBooks.find(b => b.workId === hl.workId);
                                  const cleanTitle = (bookMeta?.title || hl.workId).replace(/[《》]/g, '').trim();

                                  return (
                                    <div 
                                      key={hl.id}
                                      className="highlight-entry-card"
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.4rem',
                                        padding: '0.6rem 0.8rem',
                                        borderRadius: '8px'
                                      }}
                                    >
                                      {/* 上方經典與卷次定位標籤 */}
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                                          <span 
                                            style={{
                                              fontWeight: 800,
                                              color: 'var(--theme-accent, #8c4b27)',
                                              background: 'var(--theme-accent-light, rgba(140,75,39,0.08))',
                                              padding: '1px 5px',
                                              borderRadius: '4px',
                                              fontSize: '0.7rem'
                                            }}
                                          >
                                            {hl.workId}
                                          </span>
                                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {cleanTitle}
                                          </span>
                                          <span>· 第 {hl.juan} 卷</span>
                                        </div>
                                        <span style={{ flexShrink: 0 }}>{new Date(hl.createdAt).toLocaleDateString()}</span>
                                      </div>

                                      {/* 經文引言 (關鍵字柔和高亮) */}
                                      <div style={{ fontSize: '0.9rem', lineHeight: 1.55, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                                        「{renderMatchedKeywordText(hl.text, grp.keyword)}」
                                      </div>

                                      {/* 讀者手寫心得筆記 (關鍵字柔和高亮) */}
                                      {hl.note && (
                                        <div 
                                          className="highlight-note-content"
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
                                          {renderMatchedKeywordText(hl.note, grp.keyword)}
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
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              </div>
            </>
          )}

          {/* === D. 進入特定資料夾/專區檢視 (非 virtual_my_folders 且非 virtual_highlights)：垂直列表向下無限延伸 === */}
          {currentFolderId && currentFolderId !== 'virtual_my_folders' && currentFolderId !== 'virtual_highlights' && (
            <div className="shelf-list">
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
      ) : activeTab === 'search' ? (
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
      ) : activeTab === 'reading-log' ? (
        /* 💡 每日閱讀日誌分頁畫面 (延用頂部微膠囊控制列) */
        <div className="animate-slide-up" style={{ width: '100%', height: '100%' }}>
          <ReadingLogView
            mode="page"
            onSelectBook={onSelectBook}
          />
        </div>
      ) : null}

      {/* 💡 藏經庫 (下載經典) 視圖：以 display 控制顯隱，保留搜尋狀態與滾動位置，且共享頂部微膠囊 Header */}
      <div style={{ display: activeTab === 'cbeta' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', height: '100%' }}>
        <CbetaCatalogView
          hideHeader={true}
          isActive={activeTab === 'cbeta'}
          targetCategory={catalogTargetCategory}
          onClearTargetCategory={() => setCatalogTargetCategory(null)}
          onBackToLibrary={() => {
            setActiveTab('shelf');
            setCurrentFolderId(null);
            setFolderHistory([null]);
            setHistoryIndex(0);
            updateHashRoute('library');
          }}
          onOpenSettings={onOpenSettings || (() => {})}
          onSelectBook={onSelectBook}
          settings={settings}
          onNavigateToLibrarySection={(sec) => {
            if (sec === 'home') {
              setActiveTab('shelf');
              setCurrentFolderId(null);
              setFolderHistory([null]);
              setHistoryIndex(0);
            } else if (sec === 'shelf') {
              setActiveTab('shelf');
              navigateToFolder('virtual_my_folders');
            } else if (sec === 'notes') {
              setActiveTab('shelf');
              setCurrentFolderId('virtual_highlights');
            } else if (sec === 'search') {
              setActiveTab('search');
            } else if (sec === 'reading-log') {
              setActiveTab('reading-log');
            } else if (sec === 'cbeta') {
              setActiveTab('cbeta');
            }
            updateHashRoute(sec === 'cbeta' ? 'cbeta' : 'library');
          }}
        />
      </div>
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
                      const defaultName = onlineSearchQuery.trim() || '常用經典';
                      setBatchFolderName(defaultName);
                      setBatchFolderMode('unclassified'); // 預設為近期下載
                      if (folders.length > 0) {
                        setSelectedExistingFolderId(prev => prev && folders.some(f => f.id === prev) ? prev : folders[0].id);
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  選擇下載收納方式：
                </span>

                {/* 1. 放入 我的書櫃/近期下載 (此為預設) */}
                <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="radio" 
                    name="batchFolderMode"
                    checked={batchFolderMode === 'unclassified'} 
                    onChange={() => setBatchFolderMode('unclassified')}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  <span>放入 我的書櫃/近期下載</span>
                </label>

                {/* 2. 放入 我的書櫃/ xxx (已經有建立的資料夾，由讀者自選) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="radio" 
                      name="batchFolderMode"
                      checked={batchFolderMode === 'existing'} 
                      onChange={() => {
                        setBatchFolderMode('existing');
                        if (!selectedExistingFolderId && folders.length > 0) {
                          setSelectedExistingFolderId(folders[0].id);
                        }
                      }}
                      style={{ accentColor: 'var(--theme-accent)' }}
                    />
                    <span>
                      放入 我的書櫃/ {(() => {
                        const target = folders.find(f => f.id === selectedExistingFolderId) || folders[0];
                        return target ? target.name : '（已建立資料夾）';
                      })()}
                    </span>
                  </label>

                  {batchFolderMode === 'existing' && (
                    <div style={{ marginLeft: '1.6rem' }}>
                      {folders && folders.length > 0 ? (
                        <select 
                          className="settings-select"
                          value={selectedExistingFolderId || folders[0]?.id || ''}
                          onChange={(e) => setSelectedExistingFolderId(e.target.value)}
                          style={{ 
                            width: '100%',
                            fontSize: '0.88rem', 
                            padding: '0.5rem 0.8rem', 
                            fontFamily: 'var(--font-sans, "Microsoft JhengHei", "PingFang TC", sans-serif)',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, rgba(140, 75, 39, 0.2))',
                            background: 'var(--bg-card, #ffffff)',
                            color: 'var(--text-primary)'
                          }}
                        >
                          {folders.filter(f => !f.parentId).map(f => (
                            <option key={f.id} value={f.id}>
                              {f.name} ({f.bookIds?.length || 0} 部)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.2rem 0' }}>
                          （書櫃目前尚未建立任何自訂資料夾，請選擇「新建分類名稱」）
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. 新建分類名稱 (並自動帶出文字，如「太虛」) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="radio" 
                      name="batchFolderMode"
                      checked={batchFolderMode === 'new'} 
                      onChange={() => setBatchFolderMode('new')}
                      style={{ accentColor: 'var(--theme-accent)' }}
                    />
                    <span>新建分類名稱</span>
                  </label>

                  {batchFolderMode === 'new' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.6rem' }}>
                      <input 
                        type="text" 
                        className="settings-select"
                        value={batchFolderName}
                        onChange={(e) => setBatchFolderName(e.target.value)}
                        placeholder="常用經典"
                        style={{ 
                          fontSize: '0.88rem', 
                          padding: '0.5rem 0.8rem', 
                          fontFamily: 'var(--font-sans, "Microsoft JhengHei", "PingFang TC", sans-serif)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, rgba(140, 75, 39, 0.2))',
                          background: 'var(--bg-card, #ffffff)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="dialog-actions-row" style={{ marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="dialog-btn-cancel"
                  onClick={() => setShowBatchDownloadModal(false)}
                  style={{ fontFamily: 'var(--font-sans, "Microsoft JhengHei", "PingFang TC", sans-serif)', fontWeight: 600 }}
                >
                  取消
                </button>
                <button 
                  type="button" 
                  className="dialog-btn-confirm"
                  onClick={handleExecuteBatchDownload}
                  disabled={
                    (batchFolderMode === 'new' && !batchFolderName.trim()) ||
                    (batchFolderMode === 'existing' && (!folders || folders.length === 0))
                  }
                  style={{ fontFamily: 'var(--font-sans, "Microsoft JhengHei", "PingFang TC", sans-serif)', fontWeight: 600 }}
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



      {/* 📁 「我的書櫃」分類管理 Modal (新增分類、上移、下移、重新命名、刪除) */}
      {showFolderManagerModal && (
        <div className="search-dialog-overlay" onClick={() => { setEditingFolderId(null); setIsAddingCategory(false); setShowFolderManagerModal(false); }}>
          <div className="search-dialog-card action-menu-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '92%', borderRadius: '16px', padding: '1.2rem' }}>
            <div className="dialog-header" style={{ marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                <Folder size={18} style={{ color: '#8c4b27' }} />
                <span>我的書櫃分類管理</span>
              </div>
              <button className="icon-button close-btn" onClick={() => { setEditingFolderId(null); setIsAddingCategory(false); setShowFolderManagerModal(false); }}>
                <X size={18} />
              </button>
            </div>

            <div className="dialog-body" style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.2rem 0.1rem' }}>
              {/* 💡 新增分類項目 (按鈕與內嵌即時輸入框) */}
              {isAddingCategory ? (
                <div className="folder-manager-item" style={{ border: '1.5px dashed var(--theme-accent, #8c4b27)', background: 'rgba(140, 75, 39, 0.04)', marginBottom: '0.2rem' }}>
                  <div className="folder-manager-item-left">
                    <FolderPlus size={16} style={{ color: 'var(--theme-accent, #8c4b27)', flexShrink: 0 }} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="請輸入分類名稱..."
                      className="folder-manager-inline-input"
                      style={{ maxWidth: '180px' }}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (newFolderName.trim()) {
                            handleCreateFolder();
                            setIsAddingCategory(false);
                          }
                        } else if (e.key === 'Escape') {
                          setIsAddingCategory(false);
                          setNewFolderName('');
                        }
                      }}
                    />
                  </div>
                  <div className="folder-manager-item-actions">
                    <button
                      className="folder-manager-action-btn"
                      style={{ color: '#1ea98c' }}
                      onClick={() => {
                        if (newFolderName.trim()) {
                          handleCreateFolder();
                          setIsAddingCategory(false);
                        }
                      }}
                      title="確認新增分類"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      className="folder-manager-action-btn"
                      onClick={() => {
                        setIsAddingCategory(false);
                        setNewFolderName('');
                      }}
                      title="取消"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="folder-manager-add-btn"
                  onClick={() => {
                    setNewFolderName('');
                    setIsAddingCategory(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '0.6rem',
                    borderRadius: '10px',
                    border: '1.5px dashed var(--border-color, rgba(140, 75, 39, 0.25))',
                    background: 'rgba(140, 75, 39, 0.04)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    marginBottom: '0.2rem',
                    flexShrink: 0
                  }}
                  title="新增書櫃分類"
                >
                  <FolderPlus size={16} style={{ color: '#8c4b27' }} />
                  <span>新增分類</span>
                </button>
              )}

              {folders.filter(f => !f.parentId).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  目前尚無自訂分類
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
                onClick={() => {
                  setEditingFolderId(null);
                  setIsAddingCategory(false);
                  setShowFolderManagerModal(false);
                }}
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

            {/* 💡 【下半部份：功能鍵 (1 列 3 個圖示按鈕)】 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

              {/* 1 列 3 個按鈕：移至資料夾 | 加入我的最愛 | 刪除經文 (等寬 1:1:1 佐以細分隔線) */}
              {(() => {
                const isTransitionFolder = menuTargetBookSource === 'virtual_recent_reads' || menuTargetBookSource === 'virtual_favorites';
                return (
                  <div className="action-buttons-grid-3">
                    {/* 1. 移至資料夾 (改為淺灰，暫不開啟這個功能) */}
                    <button 
                      className="action-grid-btn"
                      disabled={true}
                      style={{ opacity: 0.35, cursor: 'not-allowed', filter: 'grayscale(1)', color: 'var(--text-muted)' }}
                      onClick={() => {}}
                      title="移至資料夾 (暫未開放)"
                    >
                      <FolderInput size={20} />
                      <span style={{ color: 'var(--text-muted)' }}>移至資料夾</span>
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
