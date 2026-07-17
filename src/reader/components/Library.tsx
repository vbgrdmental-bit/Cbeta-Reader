import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Check, AlertCircle, X, Download, BookOpen,
  Home, Search,
  Folder, FolderPlus, Edit3, ChevronLeft
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
  onSaveSettings: (settings: AppSettings) => void;
  initialSearchQuery?: string;
}

export function Library({ 
  onSelectBook, 
  booksUpdatedTrigger,
  settings,
  onSaveSettings,
  initialSearchQuery
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
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
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
    const bookId = e.dataTransfer.getData('text/plain') || draggingWorkId;
    if (!bookId || bookId.startsWith('folder-')) return;
    
    // 經典只屬於單一資料夾
    const updated = folders.map(f => {
      if (f.id === folderId) {
        const bookIds = f.bookIds.includes(bookId) ? f.bookIds : [...f.bookIds, bookId];
        return { ...f, bookIds };
      }
      return { ...f, bookIds: f.bookIds.filter(id => id !== bookId) };
    });
    
    saveFolders(updated);
    setDraggingWorkId(null);
  };

  // 將經典移出資料夾
  const handleRemoveFromFolder = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    const updated = folders.map(f => {
      if (f.id === currentFolderId) {
        return { ...f, bookIds: f.bookIds.filter(id => id !== bookId) };
      }
      return f;
    });
    saveFolders(updated);
  };

  // 刪除經典暫存 ID
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);

  // HTML5 拖曳排序事件處理
  const handleDragStart = (e: React.DragEvent, workId: string) => {
    setDraggingWorkId(workId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', workId);
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
    setShowSearchDialog(false);
    
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
  const allInFolderBookIds = folders.flatMap(f => f.bookIds);
  const displayFolders = folders.filter(f => f.parentId === currentFolderId);
  const displayBooks = currentFolderId
    ? downloadedBooks.filter(b => {
        const f = folders.find(folder => folder.id === currentFolderId);
        return f ? f.bookIds.includes(b.workId) : false;
      })
    : downloadedBooks.filter(b => !allInFolderBookIds.includes(b.workId));

  const currentFolder = folders.find(f => f.id === currentFolderId);

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
          }}
          title="書架首頁"
        >
          <Home size={20} />
        </button>

        {activeTab === 'shelf' && (
          <>
            <div className="control-divider" />
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
        )}

        <div className="header-theme-circles" style={{ marginLeft: 'auto' }}>
          <div 
            className={`header-theme-circle bg-ivory ${settings.theme === 'ivory' ? 'active' : ''}`}
            onClick={() => onSaveSettings({ ...settings, theme: 'ivory' })}
            title="象牙白"
          />
          <div 
            className={`header-theme-circle bg-parchment ${settings.theme === 'parchment' ? 'active' : ''}`}
            onClick={() => onSaveSettings({ ...settings, theme: 'parchment' })}
            title="羊皮紙"
          />
          <div 
            className={`header-theme-circle bg-comfort ${settings.theme === 'comfort' ? 'active' : ''}`}
            onClick={() => onSaveSettings({ ...settings, theme: 'comfort' })}
            title="舒適"
          />
          <div 
            className={`header-theme-circle bg-ebony ${settings.theme === 'ebony' ? 'active' : ''}`}
            onClick={() => onSaveSettings({ ...settings, theme: 'ebony' })}
            title="玄木"
          />
        </div>

        <button 
          className={`library-header-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
          title="本地經典檢索"
        >
          <Search size={20} />
        </button>
      </div>

      {activeTab === 'shelf' ? (
        /* 書架主畫面 */
        <div className="bookshelf-section animate-slide-up">
          {/* 資料夾導航與麵包屑 */}
          {currentFolderId && currentFolder && (
            <div className="folder-nav-wrapper">
              <div className="folder-navigation-bar">
                <div className="folder-nav-left">
                  <button className="folder-back-btn" onClick={() => setCurrentFolderId(currentFolder.parentId)}>
                    <ChevronLeft size={16} /> 返回上層
                  </button>
                </div>
                <div className="folder-nav-middle">
                  <span className="folder-path-display">{getFolderPath(currentFolderId)}</span>
                </div>
                <div className="folder-nav-right">
                  <span className="folder-book-count-badge" title="此資料夾內經典數">
                    {displayBooks.length}
                  </span>
                </div>
              </div>
              <div className="folder-sub-actions">
                <button className="folder-add-sub-btn-flat" onClick={() => setShowNewFolderDialog(true)}>
                  <Plus size={13} /> 新建子資料夾
                </button>
              </div>
            </div>
          )}

          {!currentFolderId && (
            <div className="library-title-area">
              <h1>淨 心 閱 讀</h1>
              <p>以CBETA為主的電子大藏經閱讀器</p>
            </div>
          )}

          {/* 清單模式（唯一） */}
          <div className="shelf-list">
            {/* === A. 渲染資料夾清單 === */}
            {displayFolders.map((folder) => (
              <div 
                key={folder.id}
                className="list-book-item list-folder-item"
                onClick={() => setCurrentFolderId(folder.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropIntoFolder(e, folder.id)}
              >
                <div className="list-folder-icon-wrapper theme-folder-wrapper">
                  <Folder size={16} className="theme-folder-icon" />
                </div>
                <div className="list-folder-info">
                  <div className="list-folder-title">{folder.name}</div>
                  <div className="list-folder-meta">含 {folder.bookIds.length} 部經典 · 拖曳以歸檔</div>
                </div>
                <div className="list-folder-actions">
                  <button 
                    className="list-folder-btn"
                    onClick={(e) => startRenameFolder(folder, e)}
                    title="重新命名"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button 
                    className="list-folder-btn text-danger"
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    title="刪除資料夾"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}

            {/* === B. 渲染經典清單 === */}
            {displayBooks.map((book) => (
              <div 
                key={book.workId}
                className={`list-book-item ${draggingWorkId === book.workId ? 'dragging' : ''}`}
                onClick={() => onSelectBook(book.workId)}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, book.workId)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, book.workId)}
              >
                <div className="list-book-cover" style={{ backgroundColor: getBookCoverColor(book.workId) }}>
                  {book.workId}
                </div>
                <div className="list-book-info">
                  <div className="list-book-title">{book.title}</div>
                  <div className="list-book-meta">{book.creators} · 共 {book.juansCount} 卷</div>
                </div>
                <div className="list-book-actions-right">
                  {currentFolderId && (
                    <button 
                      className="list-book-move-out"
                      onClick={(e) => handleRemoveFromFolder(e, book.workId)}
                      title="移出資料夾"
                    >
                      移出
                    </button>
                  )}
                  <button 
                    className="list-delete-btn"
                    onClick={(e) => handleDeleteBook(e, book.workId)}
                    title="刪除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
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
