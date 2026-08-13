import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Check, CheckSquare, CheckCircle2, AlertCircle, X, Download,
  Home, Search,
  Folder, FolderPlus, Edit3, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUp, Settings, Clock, Heart, Trash2, FolderInput, MoreVertical, Notebook, BookOpen, FileText, Play, RotateCcw, RefreshCw
} from 'lucide-react';
import type { BookMetadata, ReaderPackage } from '../../types/book';
import { listBooks, deleteBook, getAllHighlights, deleteHighlight, saveHighlight } from '../../utils/db';
import type { AppSettings, BookHighlight } from '../../utils/db';
import { IndexBuilder, FEATURED_BOOKS } from '../../builder/IndexBuilder';
import type { SearchResult } from '../../builder/IndexBuilder';
import { PackageBuilder } from '../../builder/PackageBuilder';
import type { BuildProgress, BuildStep } from '../../builder/PackageBuilder';
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
  const [loadingDots, setLoadingDots] = useState('...');
  const [progressUpdatedTrigger, setProgressUpdatedTrigger] = useState(0);

  const [isBackup, setIsBackup] = useState(isBackupMode());

  useEffect(() => {
    return subscribeSourceMode((mode) => setIsBackup(mode === 'backup'));
  }, []);

  const isLongPressTriggeredRef = useRef(false);

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

  // 💡 整理編輯模式狀態（長按卡片進入，空白點選退出，按鈕平常隱藏，模式下才顯現）
  const [isEditMode, setIsEditMode] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // 批量選擇經書狀態
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [showBatchMoveDialog, setShowBatchMoveDialog] = useState(false);
  // 💡 movingFolderId：正在被移動的資料夾 ID（非 null 時，批量移動對話框改為「移動資料夾」模式）
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);

  // 「...」選項 Modal 狀態
  const [menuTargetFolder, setMenuTargetFolder] = useState<BookFolder | null>(null);
  const [menuTargetBook, setMenuTargetBook] = useState<BookMetadata | null>(null);

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

  const formatEstimatedReadingTime = (cjkChars?: number) => {
    const chars = cjkChars || 2000;
    const totalMins = Math.max(1, Math.round(chars / 200));
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

  // 💡 同經典劃線重點折疊狀態 (Record<workId, boolean>)
  const [collapsedBookGroups, setCollapsedBookGroups] = useState<Record<string, boolean>>({});

  const toggleBookGroup = (workId: string) => {
    setCollapsedBookGroups(prev => ({
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

  const handleGlobalTouchStart = (e: React.TouchEvent) => {
    if (isEditMode) return;
    const touch = e.touches[0];
    touchSwipeRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    if (swipeContainerRef.current) {
      swipeContainerRef.current.style.transition = 'none';
    }
  };

  const handleGlobalTouchMove = (e: React.TouchEvent) => {
    if (!touchSwipeRef.current || isEditMode) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchSwipeRef.current.x;
    const deltaY = touch.clientY - touchSwipeRef.current.y;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 6) {
      if (swipeContainerRef.current) {
        swipeContainerRef.current.style.transform = `translateX(${deltaX * 0.65}px)`;
      }
    }
  };

  const handleGlobalTouchEnd = (e: React.TouchEvent) => {
    if (!touchSwipeRef.current || isEditMode) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchSwipeRef.current.x;
    const deltaY = touch.clientY - touchSwipeRef.current.y;
    const deltaTime = Date.now() - touchSwipeRef.current.time;
    touchSwipeRef.current = null;

    if (swipeContainerRef.current) {
      swipeContainerRef.current.style.transition = 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)';
      swipeContainerRef.current.style.transform = 'translateX(0px)';
    }

    // 💡 靈敏觸發門檻：位移 > 28px, 時間 < 550ms, 水平角度寬容比 1.15
    if (Math.abs(deltaX) > 28 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15 && deltaTime < 550) {
      const SHELF_NAV_CHAIN: (string | null)[] = [
        null, // 首頁
        'virtual_my_folders', // 我的資料夾
        'virtual_recent_reads', // 近期閱讀
        'virtual_favorites', // 我的最愛
        'virtual_highlights' // 重點與筆記
      ];

      if (deltaX < -28) {
        // 👈 向左滑動 (推進)
        if (activeTab === 'shelf') {
          const currentIndex = SHELF_NAV_CHAIN.indexOf(currentFolderId);
          if (currentIndex !== -1 && currentIndex < SHELF_NAV_CHAIN.length - 1) {
            navigateToFolder(SHELF_NAV_CHAIN[currentIndex + 1]);
          } else if (currentFolderId === 'virtual_highlights') {
            setActiveTab('search');
          }
        }
      } else if (deltaX > 28) {
        // 👉 向右滑動 (返回 / 觸發 CBETA)
        if (activeTab === 'search') {
          setActiveTab('shelf');
        } else if (activeTab === 'shelf') {
          const currentIndex = SHELF_NAV_CHAIN.indexOf(currentFolderId);
          if (currentIndex > 0) {
            navigateToFolder(SHELF_NAV_CHAIN[currentIndex - 1]);
          } else if (!currentFolderId) {
            // 💡 在首頁向右滑 1 下：直接開啟 CBETA 藏經庫與下載
            if (onOpenCbetaCatalog) onOpenCbetaCatalog();
          }
        }
      }
    }
  };

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

  // 💡 點選進入專區/資料夾時的平滑推進動畫 (Forward Slide In)
  const navigateToFolderWithAnimation = (targetFolderId: string | null) => {
    if (currentFolderId === targetFolderId) return;

    if (swipeContainerRef.current) {
      const container = swipeContainerRef.current;
      // 1. 當前首頁/舊視窗向左平滑流暢推走
      container.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.22s ease-out';
      container.style.transform = 'translateX(-80px)';
      container.style.opacity = '0.3';

      setTimeout(() => {
        // 2. 切換狀態至目標專區
        navigateToFolder(targetFolderId);

        // 3. 新專區從右側 +40px 平滑流暢推入歸位
        container.style.transition = 'none';
        container.style.transform = 'translateX(40px)';
        container.style.opacity = '0.7';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            container.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease-out';
            container.style.transform = 'translateX(0px)';
            container.style.opacity = '1';
          });
        });
      }, 200);
    } else {
      navigateToFolder(targetFolderId);
    }
  };

  // 💡 點擊「+」開啟 CBETA 藏經庫時的平滑向右推進動畫 (Slide Right In)
  const handleOpenCbetaCatalogWithAnimation = () => {
    if (!onOpenCbetaCatalog) return;
    if (swipeContainerRef.current) {
      const container = swipeContainerRef.current;
      container.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.22s ease-out';
      container.style.transform = 'translateX(80px)';
      container.style.opacity = '0.3';
      setTimeout(() => {
        onOpenCbetaCatalog();
        container.style.transition = 'none';
        container.style.transform = 'translateX(0px)';
        container.style.opacity = '1';
      }, 200);
    } else {
      onOpenCbetaCatalog();
    }
  };

  // 💡 點擊「首頁」按鈕時的平滑倒滑往回動畫 (Smooth Reverse Slide back to Home)
  const handleGoHomeWithAnimation = () => {
    if (activeTab === 'shelf' && !currentFolderId) return; // 本身就在首頁時不觸發

    if (swipeContainerRef.current) {
      const container = swipeContainerRef.current;
      // 1. 當前頁面向右平滑流暢滑出
      container.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.22s ease-out';
      container.style.transform = 'translateX(80px)';
      container.style.opacity = '0.3';

      setTimeout(() => {
        // 2. 切換狀態回首頁
        setActiveTab('shelf');
        setCurrentFolderId(null);
        setFolderHistory([null]);
        setHistoryIndex(0);

        // 3. 從左側微幅滑入歸位
        container.style.transition = 'none';
        container.style.transform = 'translateX(-40px)';
        container.style.opacity = '0.7';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            container.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease-out';
            container.style.transform = 'translateX(0px)';
            container.style.opacity = '1';
          });
        });
      }, 200);
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
  useEffect(() => {
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
    
    // 如果在「我的資料夾」專區，parentId 設為 null，屬於頂層自訂資料夾
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

  // 💡 資料夾順序前移 (<) / 後移 (>)
  const handleSwapFolderOrder = (folderId: string, direction: 'left' | 'right') => {
    const idx = displayFolders.findIndex(f => f.id === folderId);
    if (idx === -1) return;

    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= displayFolders.length) return;

    // 交換 displayFolders 中的資料夾位置
    const newDisplayFolders = [...displayFolders];
    const temp = newDisplayFolders[idx];
    newDisplayFolders[idx] = newDisplayFolders[targetIdx];
    newDisplayFolders[targetIdx] = temp;

    // 保留非目前層級的資料夾，更新全域 folders
    const otherFolders = folders.filter(f => !newDisplayFolders.some(df => df.id === f.id));
    const updatedFolders = [...otherFolders, ...newDisplayFolders];

    saveFolders(updatedFolders);
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

  // 將經典移出資料夾至上一層 (parentId 代表的資料夾)
  const handleRemoveFromFolder = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    if (!currentFolderId) return;

    const currentFolder = folders.find(f => f.id === currentFolderId);
    if (!currentFolder) return;

    const parentId = currentFolder.parentId;

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

  // 將子資料夾移出至上一層
  const handleRemoveFolderFromFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    const folder = folders.find(f => f.id === folderId);
    if (!folder || !folder.parentId) return;

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

  const openMoveFolderDialog = (folderId: string) => {
    setSelectedBookIds([]);
    setMovingFolderId(folderId);
    setShowBatchMoveDialog(true);
  };

  // 💡 執行資料夾移動：更改 parentId（不能移入自身或其子孫資料夾）
  const handleMoveFolder = (targetParentId: string | null) => {
    if (!movingFolderId) return;
    // 防止循環：檢查目標是否為被移動資料夾的後代
    const isDescendant = (checkId: string | null): boolean => {
      if (checkId === null) return false;
      if (checkId === movingFolderId) return true;
      const parent = folders.find(f => f.id === checkId);
      return parent ? isDescendant(parent.parentId) : false;
    };
    if (targetParentId === movingFolderId || isDescendant(targetParentId)) return;

    const updated = folders.map(f => {
      if (f.id === movingFolderId) return { ...f, parentId: targetParentId };
      return f;
    });
    saveFolders(updated);
    setMovingFolderId(null);
    setShowBatchMoveDialog(false);
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
            message: `[批量下載 ${i + 1} / ${totalToDownload} 本：《${searchRes.title}》] ${progress.message}`
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

    // 3. 載入最新本地經書清單
    await loadLocalBooks();
    setSelectedOnlineWorkIds([]);

    setTimeout(() => {
      setBuildProgress(null);
    }, 1500);
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

  // 渲染下載步驟圖示
  const renderStepIcon = (targetStep: BuildStep, itemIndex: number, currentProgressStep: BuildStep) => {
    const stepsOrder: BuildStep[] = ['metadata', 'fetch_content', 'navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed'];
    const currentIndex = stepsOrder.indexOf(currentProgressStep);
    const targetIndex = stepsOrder.indexOf(targetStep);

    if (currentProgressStep === 'failed') {
      return <AlertCircle size={14} style={{ color: '#bd3a3a' }} />;
    }

    if (currentIndex > targetIndex) {
      return <Check size={16} style={{ color: '#2e7d32', strokeWidth: 2.5 }} />;
    } else if (currentProgressStep === targetStep) {
      return <div className="builder-step-icon animate-spin-slow">⏳</div>;
    } else {
      return <span style={{ opacity: 0.65, fontWeight: 'bold' }}>{itemIndex}</span>;
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
    return Array.from(map.values());
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
    loadLocalBooks();
    loadAllHighlights();
  }, [booksUpdatedTrigger]);

  const subfolderBookIds = useMemo(() => folders.flatMap(f => f.bookIds), [folders]);
  const allBookshelfBookIds = useMemo(() => Array.from(new Set([...myBookshelfBookIds, ...subfolderBookIds])), [myBookshelfBookIds, subfolderBookIds]);
  
  // 近期閱讀（最多 10 本）與我的最愛經典列表
  const recentReadsBooks = resumeBooks.slice(0, 10).map(item => item.book);
  const favoriteBooksList = downloadedBooks.filter(b => favoriteWorkIds.includes(b.workId));

  // 如果是虛擬系統資料夾，不顯示任何一般子資料夾；首頁亦不直鋪自訂資料夾（統一收納於「我的書櫃」）
  const isSystemFolder = currentFolderId === 'virtual_resume' || currentFolderId === 'virtual_recent_reads' || currentFolderId === 'virtual_favorites' || currentFolderId === 'virtual_highlights';
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
                      : downloadedBooks.filter(b => !allBookshelfBookIds.includes(b.workId)))
              )));

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
    if (!folderId) return '首頁';
    if (folderId === 'virtual_recent_reads') return '近期閱讀 (最多10本)';
    if (folderId === 'virtual_favorites') return '我的最愛';
    if (folderId === 'virtual_highlights') return '重點與筆記';
    if (folderId === 'virtual_resume') return '繼續閱讀';
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

  return (
    <div 
      className="library-container" 
      style={{ position: 'relative' }}
      onTouchStart={handleGlobalTouchStart}
      onTouchMove={handleGlobalTouchMove}
      onTouchEnd={handleGlobalTouchEnd}
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
              // 💡 1. 處於最外層首頁：顯示「下載新佛典（+）」與「新建資料夾」
              <>
                <button
                  className="library-header-btn"
                  onClick={handleOpenCbetaCatalogWithAnimation}
                  title="進入 CBETA 藏經庫目錄下載佛典"
                >
                  <Plus size={22} style={{ strokeWidth: 2.5 }} />
                </button>
                {/* 💡 首頁頂部控制列：保留原「+」進入 CBETA 藏經庫目錄 */}
              </>
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

                {/* 💡 在「我的資料夾」或自訂子資料夾內，頂部控制列放回原「新建資料夾 (+)」圖示按鈕 */}
                {(currentFolderId === 'virtual_my_folders' || (currentFolderId && !currentFolderId.startsWith('virtual_'))) && (
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
                </div>
                {currentFolderId !== 'virtual_recent_reads' && currentFolderId !== 'virtual_favorites' && currentFolderId !== 'virtual_highlights' && currentFolderId !== 'virtual_my_folders' && (
                  <div className="folder-nav-right">
                    <span className="folder-book-count-badge" title="當前層級經典總數 (含子資料夾)">
                      {currentFolderId === 'virtual_resume' ? displayBooks.length : getFolderTotalBookCount(currentFolderId)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!currentFolderId && (
            <>
              <div className="library-title-area">
                <h1 style={{ fontFamily: 'var(--font-rounded)', letterSpacing: '0.04em' }}>
                  <span style={{ color: '#1ea98c' }}>CBETA</span> Reader
                </h1>
                <p>淨心小角落．閱讀大藏經</p>
              </div>

              {/* 💡 首頁根目錄固定渲染 4 個系統固定資料夾（由左至右：我的書櫃、近期閱讀、我的最愛、重點與筆記） */}
              <div className="folders-grid-container system-grid">
                {/* 1. 我的書櫃 - 經典深琥珀色 (#8c4b27) */}
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
                      {folders.filter(f => !f.parentId).length}個資料夾
                    </div>
                  </div>
                </div>

                {/* 2. 近期閱讀系統資料夾 - 深咖啡色 (#4a2c11) */}
                <div 
                  className="list-book-item list-folder-item system-folder-item"
                  onClick={() => navigateToFolderWithAnimation('virtual_recent_reads')}
                  title="點擊查看近期閱讀經典"
                >
                  <div className="list-folder-icon-wrapper" style={{ backgroundColor: '#4a2c11' }}>
                    <Clock size={15} color="#ffffff" />
                  </div>
                  <div className="list-folder-info">
                    <div className="list-folder-title" title="近期閱讀">
                      近期閱讀
                    </div>
                    <div className="list-folder-count-text">
                      {recentReadsBooks.length}本經書
                    </div>
                  </div>
                </div>

                {/* 3. 我的最愛系統資料夾 */}
                <div 
                  className="list-book-item list-folder-item system-folder-item"
                  onClick={() => navigateToFolderWithAnimation('virtual_favorites')}
                  title="點擊查看我的最愛經典"
                >
                  <div className="list-folder-icon-wrapper" style={{ backgroundColor: '#e53e3e' }}>
                    <Heart size={14} fill="#ffffff" color="#ffffff" />
                  </div>
                  <div className="list-folder-info">
                    <div className="list-folder-title" title="我的最愛">
                      我的最愛
                    </div>
                    <div className="list-folder-count-text">
                      {favoriteBooksList.length}本經書
                    </div>
                  </div>
                </div>

                {/* 4. 重點與筆記系統資料夾 - 琥珀金 (#c07d2a) */}
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
                      {allHighlights.length}條筆記
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

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
                    const isCollapsed = !!collapsedBookGroups[group.workId];

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
                          padding: '0.75rem 0.9rem',
                          backgroundColor: 'var(--input-bg, rgba(255, 255, 255, 0.02))'
                        }}
                      >
                        {/* 經典分組開合標頭 ([+] / [-]) */}
                        <div 
                          onClick={() => toggleBookGroup(group.workId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            userSelect: 'none',
                            padding: '0.2rem 0'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                            <span 
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                width: '20px', 
                                height: '20px', 
                                borderRadius: '4px', 
                                border: '1px solid var(--border-color, rgba(0,0,0,0.15))', 
                                fontSize: '0.85rem',
                                color: 'var(--text-muted)',
                                fontWeight: 'bold'
                              }}
                            >
                              {isCollapsed ? '+' : '-'}
                            </span>
                            <BookOpen size={15} style={{ opacity: 0.75 }} />
                            <span>《{group.title}》</span>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', opacity: 0.8 }}>
                            {group.list.length} 條重點
                          </span>
                        </div>

                        {/* 該經典下的劃線重點清單 */}
                        {!isCollapsed && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.2rem' }}>
                            {group.list.map((hl) => (
                              <div 
                                key={hl.id} 
                                className="highlight-card animate-fade-in"
                                style={{
                                  backgroundColor: 'var(--card-bg, rgba(255, 255, 255, 0.4))',
                                  border: '1px solid var(--border-color, rgba(140, 75, 39, 0.15))',
                                  borderRadius: '10px',
                                  padding: '0.85rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5rem'
                                }}
                              >
                                {/* 標頭：卷次與日期 */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', opacity: 0.85 }}>
                                    第 {hl.juan} 卷
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                                    {new Date(hl.createdAt).toLocaleDateString()}
                                  </span>
                                </div>

                                {/* 劃線重點片段 */}
                                <div 
                                  className="reader-text-highlight-preview"
                                  style={{
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    fontFamily: 'var(--font-serif)',
                                    lineHeight: 1.6,
                                    padding: '0.2rem 0.3rem',
                                    cursor: 'pointer',
                                    color: 'var(--text-primary)',
                                    wordBreak: 'break-all'
                                  }}
                                  onClick={() => onSelectBook(hl.workId, hl.segmentId)}
                                  title="點擊跳轉至經文處"
                                >
                                  「{hl.text}」
                                </div>

                                {/* 筆記隨筆卡片 (圓體，無筆記二字) */}
                                {hl.note && (
                                  <div 
                                    style={{
                                      fontSize: '0.85rem',
                                      color: 'var(--text-primary)',
                                      backgroundColor: 'var(--theme-accent-light, rgba(140, 75, 39, 0.08))',
                                      borderLeft: '3px solid var(--color-gold-500, #c07d2a)',
                                      padding: '0.45rem 0.7rem',
                                      borderRadius: '4px',
                                      fontFamily: '"Yuanti SC", "YouYuan", "圓體", "Quicksand", sans-serif',
                                      whiteSpace: 'pre-wrap',
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '4px'
                                    }}
                                  >
                                    <FileText size={13} style={{ marginTop: '3px', flexShrink: 0, opacity: 0.7 }} />
                                    <div>
                                      {hl.note}
                                    </div>
                                  </div>
                                )}

                                {/* 卡片動作按鈕 */}
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

            {/* 💡 第一次進入且無經典時，顯示「+ 點此下載佛典」長 Bar 導引 */}
            {!currentFolderId && downloadedBooks.length === 0 && (
              <div 
                className="empty-download-bar animate-pulse"
                onClick={() => {
                  if (onOpenCbetaCatalog) onOpenCbetaCatalog();
                }}
                title="進入 CBETA 藏經庫目錄"
              >
                <Plus size={20} style={{ marginRight: '6px' }} />
                <span>點此下載佛典</span>
              </div>
            )}

            {/* === A. 渲染使用者自訂資料夾清單 (僅在「我的資料夾」或自訂子資料夾專區內才渲染) === */}
            {(currentFolderId === 'virtual_my_folders' || (!isSystemFolder && currentFolderId)) && (
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
                    {/* 💡 右上角 「...」按鈕 (僅長按/進入編輯模式後才顯現) */}
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

                    {/* iOS 檔案風格：上方資料夾圖示 */}
                    <div className="list-folder-icon-wrapper theme-folder-wrapper" style={{ backgroundColor: '#8b7355' }}>
                      <Folder size={15} className="theme-folder-icon" />
                    </div>

                    {/* iOS 檔案風格：中間標題與下方項目數 */}
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

                {/* 💡 虛線新建資料夾卡片：僅在資料夾內是「空的」（無任何子資料夾且無任何書籍）時才顯示 (圖2) */}
                {displayFolders.length === 0 && displayBooks.length === 0 && (
                  <div 
                    className="list-book-item list-folder-item add-folder-dashed-card animate-fade-in"
                    onClick={() => setShowNewFolderDialog(true)}
                    title="點擊新建資料夾"
                  >
                    <div className="dashed-icon-box">
                      <FolderPlus size={16} />
                    </div>
                    <div className="list-folder-info">
                      <div className="list-folder-title" style={{ fontSize: '0.82rem', color: 'var(--reader-text-muted, #666)', fontWeight: 500 }}>
                        + 新建資料夾
                      </div>
                      <div className="list-folder-count-text">
                        按此建立
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === B. 渲染經典列表卡片清單 === */}
            {displayBooks.length > 0 && (
              <div className={`books-list-cards-container ${isEditMode ? 'edit-mode-active' : ''}`}>
                {displayBooks.map((book) => {
                  const isSelected = selectedBookIds.includes(book.workId);
                  const featuredBook = FEATURED_BOOKS.find((b: any) => b.workId === book.workId);
                  const titleText = book.title || featuredBook?.title || book.workId;
                  let creatorText = book.creators || featuredBook?.creators || 'CBETA 電子佛典';

                  // 💡 印順導師著作 (Y 系列) 作譯者名稱統一規範顯示為「民國 釋印順著」
                  if (book.workId.startsWith('Y') || creatorText.includes('印順')) {
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

                      {/* 💡 中間：經名與朝代/作譯者小灰字 */}
                      <div className="horizontal-book-info">
                        <div className="horizontal-book-title" title={titleText}>
                          {titleText}
                        </div>
                        <div className="horizontal-book-author" title={creatorText}>
                          {creatorText}
                        </div>
                      </div>

                      {/* 💡 右側：長按/編輯模式下顯示「↑」「↓」順序調整按鈕 + 「...」選項按鈕 */}
                      <div className="horizontal-book-right-actions">
                        {isEditMode && (
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
                          }}
                          title="經典選項"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
                          {res.workId} · {res.juansCount}卷 · {res.creators} · {res.category}
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

      {/* Builder 進度遮罩 (下載與建置時呈現) */}
      {buildProgress && (
        <div className={`builder-progress-overlay theme-${settings.theme}`}>
          {/* 1. 圓型圖案 (經典蓮花「淨心閱讀」標誌與旋轉外圈) */}
          <div className="builder-animation-box">
            <div 
              className="builder-outer-ring" 
              style={{ transform: `rotate(${buildProgress.percent * 3.6}deg)`, transition: 'transform 0.2s linear' }}
            />
            <div className={`builder-mandala ${buildProgress.percent === 100 ? 'is-completed' : ''}`}>
              <img 
                src="/apple-touch-icon.png" 
                alt="CBETA Reader 淨心閱讀"
                className="builder-logo-img"
              />
            </div>
          </div>

          {/* 2. 圓型圖案正下方的「批量下載 / 當前下載訊息」 (粗體、深色、醒目) */}
          <div className="builder-header-message">
            {buildProgress.message}
          </div>

          {/* 3. 詳細建置進度卡片 */}
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

      {/* 編輯資料夾（修改名稱與顏色）對話框 */}
      {editingFolderId && (
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

              {/* 💡 更換資料夾顏色：暫時隱藏 (color picker hidden temporarily) */}


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

      {/* 批量移動至資料夾對話框 (雙模式：移動書籍 / 移動資料夾) */}
      {showBatchMoveDialog && (
        <div className="search-dialog-overlay" onClick={() => { setShowBatchMoveDialog(false); setMovingFolderId(null); }}>
          <div className="search-dialog-card animate-slide-up" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>
                {movingFolderId
                  ? `移動資料夾：${folders.find(f => f.id === movingFolderId)?.name || ''}`
                  : `批量移動經典 (${selectedBookIds.length}本)`
                }
              </h3>
              <button className="icon-button close-btn" onClick={() => { setShowBatchMoveDialog(false); setMovingFolderId(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className="dialog-body" style={{ gap: '0.8rem', padding: '1.2rem', maxHeight: '60vh' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                請選擇要移入的目標資料夾：
              </p>
              
              {/* 首頁 (暫存經典) */}
              <div 
                className="folder-target-option"
                onClick={() => movingFolderId ? handleMoveFolder(null) : handleBatchMoveBooks(null)}
              >
                <Home size={18} style={{ color: 'var(--theme-accent)', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>首頁 (暫存經典)</span>
              </div>

              {/* 移入我的書櫃頂層 */}
              {!movingFolderId && (
                <div 
                  className="folder-target-option"
                  onClick={() => handleBatchMoveBooks('virtual_my_folders')}
                >
                  <Folder size={18} style={{ color: '#8c4b27', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>我的書櫃 (頂層)</span>
                </div>
              )}

              {folders
                .filter(f => movingFolderId ? f.id !== movingFolderId : true)
                .map(f => {
                  // 移動資料夾模式：排除被移動資料夾本身與其子孫
                  if (movingFolderId) {
                    const isDescendant = (checkId: string | null): boolean => {
                      if (checkId === null) return false;
                      if (checkId === movingFolderId) return true;
                      const p = folders.find(x => x.id === checkId);
                      return p ? isDescendant(p.parentId) : false;
                    };
                    if (isDescendant(f.id)) return null;
                  }
                  return (
                    <div 
                      key={f.id}
                      className="folder-target-option"
                      onClick={() => movingFolderId ? handleMoveFolder(f.id) : handleBatchMoveBooks(f.id)}
                    >
                      <Folder size={18} style={{ color: '#8b7355', flexShrink: 0 }} />
                      <span>{getFolderPath(f.id)}</span>
                    </div>
                  );
                })
              }
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
              {/* 💡 僅在自訂子資料夾（非我的資料夾頂層）內，才顯示「移出至上一層資料夾」 */}
              {currentFolderId && currentFolderId !== 'virtual_my_folders' && (
                <button 
                  className="action-menu-item-btn"
                  onClick={(e) => {
                    handleRemoveFolderFromFolder(e, menuTargetFolder.id);
                    setMenuTargetFolder(null);
                  }}
                >
                  <ArrowUp size={16} />
                  <span>移出至上一層資料夾</span>
                </button>
              )}
              <button 
                className="action-menu-item-btn"
                onClick={() => {
                  const f = menuTargetFolder;
                  setMenuTargetFolder(null);
                  openMoveFolderDialog(f.id);
                }}
              >
                <FolderInput size={16} />
                <span>移動資料夾</span>
              </button>
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
                <div><span style={{ color: 'var(--text-muted)' }}>譯者 : </span>{menuTargetBook.creators || '未知'}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>經號 : </span>CBETA No. {menuTargetBook.workId}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>部類 : </span>{menuTargetBook.category || '大藏經部類'}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>冊別 : </span>{menuTargetBook.vol || menuTargetBook.canon || 'CBETA 典籍'}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>字數 : </span>{(menuTargetBook.cjkChars || 0).toLocaleString()} 字</div>
                <div><span style={{ color: 'var(--text-muted)' }}>預計閱讀時間 : </span>{formatEstimatedReadingTime(menuTargetBook.cjkChars)}</div>
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

              {/* 1 列 4 個按鈕：移至資料夾 | 加入我的最愛 | 更新經文 | 刪除經文 */}
              <div className="action-buttons-grid-4">
                {/* 1. 移至資料夾 */}
                <button 
                  className="action-grid-btn"
                  onClick={() => {
                    const b = menuTargetBook;
                    setMenuTargetBook(null);
                    setSelectedBookIds([b.workId]);
                    setShowBatchMoveDialog(true);
                  }}
                  title="移至資料夾"
                >
                  <FolderInput size={20} />
                  <span>移至資料夾</span>
                </button>

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

                {/* 3. 更新經文 */}
                <button 
                  className="action-grid-btn"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const b = menuTargetBook;
                    setMenuTargetBook(null);
                    if (!b) return;
                    try {
                      setBuildProgress({
                        step: 'metadata',
                        percent: 5,
                        message: `正在準備更新《${b.title}》最新經文...`
                      });
                      await PackageBuilder.downloadAndPackage(
                        {
                          workId: b.workId,
                          title: b.title,
                          category: b.category,
                          juansCount: b.juansCount,
                          creators: b.creators,
                          vol: b.vol
                        },
                        (p) => setBuildProgress(p)
                      );
                      await loadLocalBooks();
                      setBuildProgress(null);
                      alert(`《${b.title}》已成功更新至最新校勘經文！`);
                    } catch (err: any) {
                      setBuildProgress(null);
                      alert(`更新《${b.title}》失敗：${err.message || err}`);
                    }
                  }}
                  title="更新經文"
                >
                  <RefreshCw size={20} />
                  <span>更新經文</span>
                </button>

                {/* 4. 刪除經文 */}
                <button 
                  className="action-grid-btn delete-action"
                  onClick={(e) => {
                    const b = menuTargetBook;
                    setMenuTargetBook(null);
                    if (currentFolderId === 'virtual_resume') {
                      handleDeleteProgress(e, b.workId);
                    } else {
                      handleDeleteBook(e, b.workId);
                    }
                  }}
                  title="刪除經文"
                >
                  <Trash2 size={20} color="#e53e3e" />
                  <span style={{ color: '#e53e3e' }}>刪除經文</span>
                </button>
              </div>

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
                  fontSize: '0.92rem',
                  fontFamily: 'var(--font-serif)',
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

      {/* 💡 Builder 更新 / 下載動態進度遮罩 */}
      {buildProgress && (
        <div className={`builder-progress-overlay theme-${settings.theme}`}>
          <div className="builder-animation-box">
            <div 
              className="builder-outer-ring" 
              style={{ transform: `rotate(${buildProgress.percent * 3.6}deg)`, transition: 'transform 0.2s linear' }}
            />
            <div className={`builder-mandala ${buildProgress.percent === 100 ? 'is-completed' : ''}`}>
              <img 
                src="/apple-touch-icon.png" 
                alt="CBETA Reader 淨心閱讀"
                className="builder-logo-img"
              />
            </div>
          </div>

          <div className="builder-header-message">
            {buildProgress.message}
          </div>

          <div className="builder-details-card animate-slide-up">
            <div className="builder-title">更新中{loadingDots}</div>
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
          </div>
        </div>
      )}

    </div>
  );
}

export default Library;
