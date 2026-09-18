import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Folder, Notebook, ChevronRight, ChevronLeft, Check, X,
  Maximize2, Sliders, CalendarDays, ArrowRight
} from 'lucide-react';
import type { BookMetadata } from '../../types/book';
import type { AppSettings, BookHighlight } from '../../utils/db';
import { sanitizeCreators } from '../../builder/IndexBuilder';
import { getBookCoverGradient } from '../../utils/bookColors';
import { readingTimer, formatTimerMMSS } from '../../utils/readingTimer';
import type { ReadingTimerState } from '../../utils/readingTimer';
import type { 
  HomeWidgetConfig, 
  HomeWidgetType, 
  HomeWidgetSize,
  HomeLayoutPreset,
  WidgetCategoryId 
} from '../../types/homeLayout';
import { 
  WIDGET_CATALOG, 
  WIDGET_CATEGORIES,
  PRESET_LAYOUTS, 
  ALLOWED_SIZES_BY_TYPE,
  ZEN_ICONS_LIST
} from '../../types/homeLayout';

interface HomeDashboardProps {
  downloadedBooks: BookMetadata[];
  resumeBooks: Array<{ book: BookMetadata; progress: any }>;
  allHighlights: BookHighlight[];
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onSelectBook: (workId: string, segmentId?: string, searchQuery?: string, autoResumeMode?: 'resume' | 'restart') => void;
  onOpenCbetaCatalog: () => void;
  onNavigateToLibrarySection: (section: 'home' | 'shelf' | 'notes' | 'search' | 'reading-log' | 'cbeta') => void;
  onOpenFolder?: (folderId: string) => void;
  isLayoutEditMode: boolean;
  setIsLayoutEditMode: (val: boolean) => void;
}

export function HomeDashboard({
  downloadedBooks,
  resumeBooks,
  allHighlights,
  settings,
  onSaveSettings,
  onSelectBook,
  onOpenCbetaCatalog,
  onNavigateToLibrarySection,
  onOpenFolder,
  isLayoutEditMode,
  setIsLayoutEditMode
}: HomeDashboardProps) {
  // 載入自訂版面設定（若無則使用經典預設版面）
  const [widgets, setWidgets] = useState<HomeWidgetConfig[]>(() => {
    if (settings.homeWidgets && settings.homeWidgets.length > 0) {
      return settings.homeWidgets as HomeWidgetConfig[];
    }
    const preset = settings.homeLayoutPreset || 'default';
    return JSON.parse(JSON.stringify(PRESET_LAYOUTS[preset] || PRESET_LAYOUTS.default));
  });

  // 💡 iOS Widget Gallery 狀態 (4大類別，單層直接預覽 + 「<」「>」直接切換加入)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<WidgetCategoryId>('nav');
  const [currentWidgetIndex, setCurrentWidgetIndex] = useState<number>(0);
  const [previewWidgetSize, setPreviewWidgetSize] = useState<HomeWidgetSize>('size-4x1');
  const [previewIconIndex, setPreviewIconIndex] = useState<number>(1);

  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  // 護眼計時器即時狀態訂閱
  const [timerState, setTimerState] = useState<ReadingTimerState>(readingTimer.getState());

  useEffect(() => {
    return readingTimer.subscribe(setTimerState);
  }, []);

  // 觸控拖曳支援 (Mobile Touch Drag)
  const touchStartYRef = useRef<number | null>(null);
  const touchActiveIdRef = useRef<string | null>(null);

  // 當 settings.homeWidgets 或 preset 變更時同步
  useEffect(() => {
    if (settings.homeWidgets && settings.homeWidgets.length > 0) {
      setWidgets(settings.homeWidgets as HomeWidgetConfig[]);
    } else if (settings.homeLayoutPreset && PRESET_LAYOUTS[settings.homeLayoutPreset]) {
      setWidgets(JSON.parse(JSON.stringify(PRESET_LAYOUTS[settings.homeLayoutPreset])));
    }
  }, [settings.homeWidgets, settings.homeLayoutPreset]);

  // 切換卡片尺寸 (依據該組件支援的 ALLOWED_SIZES 輪播切換)
  const handleCycleSize = (widgetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWidgets(prev => prev.map(w => {
      if (w.id !== widgetId) return w;
      const allowed = ALLOWED_SIZES_BY_TYPE[w.type] || ['size-4x1', 'size-2x2', 'size-4x2'];
      const curIdx = allowed.indexOf(w.size);
      const nextIdx = (curIdx + 1) % allowed.length;
      return { ...w, size: allowed[nextIdx] };
    }));
  };

  // 移除卡片
  const handleRemoveWidget = (widgetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  };

  // 加入新卡片 (出現在最上面)
  const handleAddWidget = (type: HomeWidgetType, size?: HomeWidgetSize, iconIndex?: number) => {
    const catalogItem = WIDGET_CATALOG.find(item => item.type === type);
    const chosenSize = size || (catalogItem ? catalogItem.size : 'size-2x2');
    const newWidget: HomeWidgetConfig = {
      id: `w_${type}_${Date.now()}`,
      type,
      size: chosenSize,
      iconIndex: iconIndex || 1
    };
    setWidgets(prev => [newWidget, ...prev]);
    setIsGalleryOpen(false);

    // 💡 確保新加入的小工具立即可見，平滑捲動至頂部
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  // 💡 點擊禪意 App Icon：循環更換 10 款蓮花圖標 (01 -> 02 -> ... -> 10 -> 01)
  const handleCycleZenIcon = (widgetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (widgetId === 'preview-instance') {
      setPreviewIconIndex(prev => (prev % 10) + 1);
      return;
    }
    setWidgets(prev => {
      const updated = prev.map(w => {
        if (w.id !== widgetId) return w;
        const curIcon = w.iconIndex || 1;
        const nextIcon = (curIcon % 10) + 1;
        return { ...w, iconIndex: nextIcon };
      });
      if (!isLayoutEditMode) {
        onSaveSettings({
          ...settings,
          customHomeLayoutEnabled: true,
          homeWidgets: updated
        });
      }
      return updated;
    });
  };

  // 套用預設版面
  const handleApplyPreset = (preset: HomeLayoutPreset) => {
    const presetItems = JSON.parse(JSON.stringify(PRESET_LAYOUTS[preset] || PRESET_LAYOUTS.default));
    setWidgets(presetItems);
    onSaveSettings({
      ...settings,
      homeLayoutPreset: preset,
      homeWidgets: presetItems
    });
  };

  // 儲存並退出編輯模式
  const handleSaveAndExit = () => {
    onSaveSettings({
      ...settings,
      customHomeLayoutEnabled: true,
      homeLayoutPreset: 'custom',
      homeWidgets: widgets
    });
    setIsLayoutEditMode(false);
  };

  const handleSetTimerMinutes = (mins: number | null) => {
    if (mins === null) {
      readingTimer.stopTimer();
    } else {
      readingTimer.setTimer(mins);
    }
  };

  // === HTML5 桌面拖曳處理 (Desktop Drag & Drop) ===
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedWidgetId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverWidgetId !== id) {
      setDragOverWidgetId(id);
    }
  };

  const handleDragLeave = (_e: React.DragEvent, id: string) => {
    if (dragOverWidgetId === id) {
      setDragOverWidgetId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverWidgetId(null);

    if (draggedWidgetId && targetId && draggedWidgetId !== targetId) {
      setWidgets(prev => {
        const fromIdx = prev.findIndex(w => w.id === draggedWidgetId);
        const toIdx = prev.findIndex(w => w.id === targetId);
        if (fromIdx < 0 || toIdx < 0) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next;
      });
    }
    setDraggedWidgetId(null);
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  // === 行動觸控拖曳 (Mobile Touch Drag) ===
  const handleTouchStart = (id: string, e: React.TouchEvent) => {
    if (!isLayoutEditMode) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchActiveIdRef.current = id;
    setDraggedWidgetId(id);
  };

  const handleTouchEnd = () => {
    touchStartYRef.current = null;
    touchActiveIdRef.current = null;
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  // 四大閱讀底色清單與循環切換
  const THEMES_LIST: Array<'ivory' | 'parchment' | 'comfort' | 'ebony'> = ['ivory', 'parchment', 'comfort', 'ebony'];

  const handleCycleTheme = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const curTheme = settings.theme || 'ivory';
    const curIdx = THEMES_LIST.indexOf(curTheme);
    const nextTheme = THEMES_LIST[(curIdx + 1) % THEMES_LIST.length];
    onSaveSettings({ ...settings, theme: nextTheme });
  };

  const handleSelectTheme = (theme: 'ivory' | 'parchment' | 'comfort' | 'ebony', e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveSettings({ ...settings, theme });
  };

  // 渲染四大閱讀小圓圈 (微型底色指示器)
  const renderMiniThemeDots = (extraClass: string = '') => {
    const currentTheme = settings.theme || 'ivory';
    return (
      <div className={`title-mini-theme-dots ${extraClass}`} onClick={(e) => e.stopPropagation()}>
        {THEMES_LIST.map(t => (
          <div
            key={`mini-dot-${t}`}
            className={`mini-theme-dot mini-ball-${t} ${currentTheme === t ? 'active' : ''}`}
            onClick={(e) => handleSelectTheme(t, e)}
            title={`閱讀底色：${t === 'ivory' ? '象牙白' : t === 'parchment' ? '羊皮紙' : t === 'comfort' ? '舒服綠' : '烏木'}`}
          />
        ))}
      </div>
    );
  };

  // 渲染各類型小工具組件
  const renderWidgetContent = (widget: HomeWidgetConfig) => {
    const { type, size } = widget;

    switch (type) {
      // 1. 品牌標題組件 (title_4x2 / title_4x1)
      case 'title_4x2':
      case 'title_4x1': {
        if (size === 'size-2x2') {
          // 💡 2x2：四大閱讀小圓圈放在最下方/置中，文字上移一點
          return (
            <div 
              className="widget-title-2x2"
              onClick={!isLayoutEditMode ? handleCycleTheme : undefined}
              title="點擊切換閱讀底色"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="title-center-content-2x2">
                <h2 className="title-brand-heading" style={{ fontFamily: 'var(--font-rounded)', fontSize: '1.35rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                  <span style={{ color: '#1ea98c' }}>CBETA</span> <span className="title-brand-text">Reader</span>
                </h2>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem', margin: 0 }}>
                  淨心小角落 · 閱讀大藏經
                </p>
              </div>
              {renderMiniThemeDots('pos-bottom-center')}
            </div>
          );
        }
        if (size === 'size-4x1') {
          // 💡 4x1：四大閱讀小圓圈放在右邊文字的地方/置右，「淨心小角落…」刪除
          return (
            <div 
              className="widget-title-4x1"
              onClick={!isLayoutEditMode ? handleCycleTheme : undefined}
              title="點擊切換閱讀底色"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="brand">
                <span style={{ color: '#1ea98c' }}>CBETA</span> <span className="title-brand-text">Reader</span>
              </div>
              {renderMiniThemeDots('pos-right')}
            </div>
          );
        }
        // size-4x2 經典大標題：四大閱讀小圓圈放在右下角，標題文字上移一點
        return (
          <div 
            className="widget-title-4x2"
            onClick={!isLayoutEditMode ? handleCycleTheme : undefined}
            title="點擊切換閱讀底色"
            style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
          >
            <div className="title-center-content-4x2">
              <h1 style={{ fontFamily: 'var(--font-rounded)', letterSpacing: '0.04em' }}>
                <span style={{ color: '#1ea98c' }}>CBETA</span> <span className="title-brand-text">Reader</span>
              </h1>
              <p>淨心小角落．閱讀大藏經</p>
            </div>
            {renderMiniThemeDots('pos-bottom-right')}
          </div>
        );
      }

      // 2. 禪意 App Icon (純淨正方形圓角圖片，點擊循環換圖 01~10，等比 2x2 正方形)
      case 'appicon_2x2': {
        const iconIdx = widget.iconIndex || 1;
        const iconSrc = ZEN_ICONS_LIST[(iconIdx - 1) % ZEN_ICONS_LIST.length];

        return (
          <div 
            className="widget-pure-zen-icon"
            onClick={!isLayoutEditMode ? (e) => handleCycleZenIcon(widget.id, e) : undefined}
            title="點擊切換禪心蓮花圖標 (共 10 款)"
            style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default', width: '100%', height: '100%', padding: 0 }}
          >
            <img 
              src={iconSrc} 
              alt="CBETA Zen Icon"
              className="pure-zen-img"
            />
          </div>
        );
      }

      // 3. 四合一導航 (順序：下載經典 → 我的書櫃 → 重點筆記 → 全文檢索)
      case 'four_nav_4x1': {
        // 💡 圖2：4x4 最大大版面（2x2 大卡四宮格，包含大圖標、大標題與副標題）
        if (size === 'size-4x4') {
          return (
            <div className="widget-four-in-one-4x4">
              {/* 1. 下載經典 */}
              <div 
                className="core-widget-card-embedded"
                onClick={!isLayoutEditMode ? onOpenCbetaCatalog : undefined}
                title="進入 CBETA 藏經庫"
              >
                <div className="core-icon-box">
                  <Plus size={22} color="#ffffff" style={{ strokeWidth: 2.6 }} />
                </div>
                <div className="core-title">下載經典</div>
                <div className="core-sub">從CBETA資料庫下載</div>
              </div>

              {/* 2. 我的書櫃 */}
              <div 
                className="core-widget-card-embedded"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('shelf') : undefined}
                title="我的書櫃"
              >
                <div className="core-icon-box">
                  <Folder size={20} color="#ffffff" />
                </div>
                <div className="core-title">我的書櫃</div>
                <div className="core-sub">共{downloadedBooks.length}本書</div>
              </div>

              {/* 3. 重點筆記 */}
              <div 
                className="core-widget-card-embedded"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
                title="重點筆記"
              >
                <div className="core-icon-box">
                  <Notebook size={20} color="#ffffff" />
                </div>
                <div className="core-title">重點與筆記</div>
                <div className="core-sub">共{allHighlights.length}則筆記</div>
              </div>

              {/* 4. 全文檢索 */}
              <div 
                className="core-widget-card-embedded"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('search') : undefined}
                title="已下載經文搜尋"
              >
                <div className="core-icon-box">
                  <Search size={20} color="#ffffff" style={{ strokeWidth: 2.4 }} />
                </div>
                <div className="core-title">全文檢索</div>
                <div className="core-sub">已下載經典全文檢索</div>
              </div>
            </div>
          );
        }

        // 💡 4x2 寬敞橫排版（4 個大圓角圖標與標籤，垂直置中，空間寬敞不擁擠）
        if (size === 'size-4x2') {
          return (
            <div className="widget-four-in-one-4x2">
              {/* 1. 下載經典 */}
              <div 
                className="compact-nav-item-4x2"
                onClick={!isLayoutEditMode ? onOpenCbetaCatalog : undefined}
                title="進入 CBETA 藏經庫"
              >
                <div className="compact-nav-icon-4x2">
                  <Plus size={24} color="#ffffff" style={{ strokeWidth: 2.6 }} />
                </div>
                <div className="compact-nav-label-4x2">下載經典</div>
              </div>

              {/* 2. 我的書櫃 */}
              <div 
                className="compact-nav-item-4x2"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('shelf') : undefined}
                title="我的書櫃"
              >
                <div className="compact-nav-icon-4x2">
                  <Folder size={22} color="#ffffff" />
                </div>
                <div className="compact-nav-label-4x2">我的書櫃</div>
              </div>

              {/* 3. 重點筆記 */}
              <div 
                className="compact-nav-item-4x2"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
                title="重點筆記"
              >
                <div className="compact-nav-icon-4x2">
                  <Notebook size={22} color="#ffffff" />
                </div>
                <div className="compact-nav-label-4x2">重點筆記</div>
              </div>

              {/* 4. 全文檢索 */}
              <div 
                className="compact-nav-item-4x2"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('search') : undefined}
                title="已下載經文搜尋"
              >
                <div className="compact-nav-icon-4x2">
                  <Search size={22} color="#ffffff" style={{ strokeWidth: 2.4 }} />
                </div>
                <div className="compact-nav-label-4x2">全文檢索</div>
              </div>
            </div>
          );
        }

        // 💡 圖3：如果選擇 2x2，則小圖為 2x2 四宮格上下左右排版
        if (size === 'size-2x2') {
          return (
            <div className="widget-four-in-one-2x2">
              {/* 1. 左上：下載經典 */}
              <div 
                className="compact-nav-item-2x2"
                onClick={!isLayoutEditMode ? onOpenCbetaCatalog : undefined}
                title="進入 CBETA 藏經庫"
              >
                <div className="compact-nav-icon-2x2">
                  <Plus size={15} color="#ffffff" style={{ strokeWidth: 2.6 }} />
                </div>
                <div className="compact-nav-label-2x2">下載經典</div>
              </div>

              {/* 2. 右上：我的書櫃 */}
              <div 
                className="compact-nav-item-2x2"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('shelf') : undefined}
                title="我的書櫃"
              >
                <div className="compact-nav-icon-2x2">
                  <Folder size={14} color="#ffffff" />
                </div>
                <div className="compact-nav-label-2x2">我的書櫃</div>
              </div>

              {/* 3. 左下：重點筆記 */}
              <div 
                className="compact-nav-item-2x2"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
                title="重點筆記"
              >
                <div className="compact-nav-icon-2x2">
                  <Notebook size={14} color="#ffffff" />
                </div>
                <div className="compact-nav-label-2x2">重點筆記</div>
              </div>

              {/* 4. 右下：全文檢索 */}
              <div 
                className="compact-nav-item-2x2"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('search') : undefined}
                title="已下載經文搜尋"
              >
                <div className="compact-nav-icon-2x2">
                  <Search size={14} color="#ffffff" style={{ strokeWidth: 2.4 }} />
                </div>
                <div className="compact-nav-label-2x2">全文檢索</div>
              </div>
            </div>
          );
        }

        // 💡 圖2：4x1 橫排版 (順序：下載經典 → 我的書櫃 → 重點筆記 → 全文檢索，直接跳轉無左右動畫)
        return (
          <div className="widget-four-in-one-4x1">
            <div 
              className="compact-nav-item"
              onClick={!isLayoutEditMode ? onOpenCbetaCatalog : undefined}
              title="進入 CBETA 藏經庫"
            >
              <div className="compact-nav-icon">
                <Plus size={18} color="#ffffff" style={{ strokeWidth: 2.4 }} />
              </div>
              <div className="compact-nav-label">下載經典</div>
            </div>

            <div 
              className="compact-nav-item"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('shelf') : undefined}
              title="我的書櫃"
            >
              <div className="compact-nav-icon">
                <Folder size={16} color="#ffffff" />
              </div>
              <div className="compact-nav-label">我的書櫃</div>
            </div>

            <div 
              className="compact-nav-item"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
              title="重點筆記"
            >
              <div className="compact-nav-icon">
                <Notebook size={16} color="#ffffff" />
              </div>
              <div className="compact-nav-label">重點筆記</div>
            </div>

            <div 
              className="compact-nav-item"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('search') : undefined}
              title="已下載經文搜尋"
            >
              <div className="compact-nav-icon">
                <Search size={16} color="#ffffff" style={{ strokeWidth: 2.2 }} />
              </div>
              <div className="compact-nav-label">全文檢索</div>
            </div>
          </div>
        );
      }

      // 4. 核心大卡：下載經典 (2x2 / 4x1 / 4x2)
      case 'download_2x2': {
        if (size === 'size-4x1') {
          return (
            <div 
              className="core-widget-4x1"
              onClick={!isLayoutEditMode ? onOpenCbetaCatalog : undefined}
              title="前往 CBETA 藏經庫下載經典"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="core-widget-4x1-left">
                <div className="core-icon-box-4x1">
                  <Plus size={16} color="#ffffff" style={{ strokeWidth: 2.6 }} />
                </div>
                <div className="core-info-4x1">
                  <span className="core-title-4x1">下載經典</span>
                  <span className="core-sub-4x1">· 從CBETA資料庫下載</span>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="前往下載">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }
        if (size === 'size-4x2') {
          return (
            <div 
              className="core-widget-4x2"
              onClick={!isLayoutEditMode ? onOpenCbetaCatalog : undefined}
              title="前往 CBETA 藏經庫下載經典"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="core-widget-4x2-left">
                <div className="core-icon-box">
                  <Plus size={24} color="#ffffff" style={{ strokeWidth: 2.6 }} />
                </div>
                <div>
                  <div className="core-title">下載經典</div>
                  <div className="core-sub">從 CBETA 藏經資料庫檢索與下載</div>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="前往下載">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }
        return (
          <div 
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            onClick={!isLayoutEditMode ? onOpenCbetaCatalog : undefined}
            title="前往 CBETA 藏經庫下載經典"
          >
            <div className="core-icon-box">
              <Plus size={22} color="#ffffff" style={{ strokeWidth: 2.6 }} />
            </div>
            <div className="core-title">下載經典</div>
            <div className="core-sub">從CBETA資料庫下載</div>
          </div>
        );
      }

      // 5. 核心大卡：我的書櫃 (2x2 / 4x1 / 4x2)
      case 'shelf_2x2': {
        if (size === 'size-4x1') {
          return (
            <div 
              className="core-widget-4x1"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('shelf') : undefined}
              title="我的書櫃"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="core-widget-4x1-left">
                <div className="core-icon-box-4x1">
                  <Folder size={15} color="#ffffff" />
                </div>
                <div className="core-info-4x1">
                  <span className="core-title-4x1">我的書櫃</span>
                  <span className="core-count-badge">{downloadedBooks.length}</span>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="瀏覽書櫃">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }
        if (size === 'size-4x2') {
          return (
            <div 
              className="core-widget-4x2"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('shelf') : undefined}
              title="我的書櫃"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="core-widget-4x2-left">
                <div className="core-icon-box">
                  <Folder size={22} color="#ffffff" />
                </div>
                <div>
                  <div className="core-title">我的書櫃</div>
                  <div className="core-sub">已收錄 {downloadedBooks.length} 部已下載經典與自訂分類</div>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="進入書櫃">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }
        return (
          <div 
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('shelf') : undefined}
            title="我的書櫃"
          >
            <div className="core-icon-box">
              <Folder size={20} color="#ffffff" />
            </div>
            <div className="core-title">我的書櫃</div>
            <div className="core-sub">共{downloadedBooks.length}本書</div>
          </div>
        );
      }

      // 6. 核心大卡：重點筆記 (2x2 / 4x1 / 4x2)
      case 'notes_2x2': {
        if (size === 'size-4x1') {
          return (
            <div 
              className="core-widget-4x1"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
              title="重點與筆記"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="core-widget-4x1-left">
                <div className="core-icon-box-4x1">
                  <Notebook size={15} color="#ffffff" />
                </div>
                <div className="core-info-4x1">
                  <span className="core-title-4x1">重點與筆記</span>
                  <span className="core-count-badge">{allHighlights.length}</span>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="查看筆記">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }
        if (size === 'size-4x2') {
          return (
            <div 
              className="core-widget-4x2"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
              title="重點與筆記"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="core-widget-4x2-left">
                <div className="core-icon-box">
                  <Notebook size={22} color="#ffffff" />
                </div>
                <div>
                  <div className="core-title">重點與筆記</div>
                  <div className="core-sub">已累積 {allHighlights.length} 條劃線重點與個人筆記</div>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="查看筆記">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }
        return (
          <div 
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
            title="重點與筆記"
          >
            <div className="core-icon-box">
              <Notebook size={20} color="#ffffff" />
            </div>
            <div className="core-title">重點與筆記</div>
            <div className="core-sub">共{allHighlights.length}則筆記</div>
          </div>
        );
      }

      // 7. 核心大卡：全文檢索 (2x2 / 4x1 / 4x2)
      case 'search_2x2': {
        if (size === 'size-4x1') {
          return (
            <div 
              className="core-widget-4x1"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('search') : undefined}
              title="全文檢索"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="core-widget-4x1-left">
                <div className="core-icon-box-4x1">
                  <Search size={15} color="#ffffff" style={{ strokeWidth: 2.4 }} />
                </div>
                <div className="core-info-4x1">
                  <span className="core-title-4x1">全文檢索</span>
                  <span className="core-sub-4x1">· 已下載經典搜尋</span>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="開始檢索">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }
        if (size === 'size-4x2') {
          return (
            <div 
              className="core-widget-4x2"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('search') : undefined}
              title="全文檢索"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="core-widget-4x2-left">
                <div className="core-icon-box">
                  <Search size={22} color="#ffffff" style={{ strokeWidth: 2.4 }} />
                </div>
                <div>
                  <div className="core-title">全文檢索</div>
                  <div className="core-sub">快速檢索已下載經書中之關鍵字句</div>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="開始檢索">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }
        return (
          <div 
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('search') : undefined}
            title="全文檢索"
          >
            <div className="core-icon-box">
              <Search size={20} color="#ffffff" style={{ strokeWidth: 2.4 }} />
            </div>
            <div className="core-title">全文檢索</div>
            <div className="core-sub">已下載經典全文檢索</div>
          </div>
        );
      }

      // 8. 上次閱讀 (4x2 / 4x1 / 4x4)
      case 'lastread_4x2':
      case 'lastread_4x1': {
        const lastBook = resumeBooks[0];
        if (!lastBook) {
          return (
            <div className="lastread-4x1" style={{ justifyContent: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>上次閱讀：尚無閱讀進度</span>
            </div>
          );
        }

        // 💡 4x3（3部經典）與 4x4（4部經典）大版面
        if (size === 'size-4x3' || size === 'size-4x4') {
          const maxBooks = size === 'size-4x3' ? 3 : 4;
          const displayResumeBooks = resumeBooks.slice(0, maxBooks);
          return (
            <div className={`book-list-widget-multi ${size === 'size-4x3' ? 'multi-4x3' : 'multi-4x4'}`}>
              <div 
                className="widget-header-row-4x4"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「近期閱讀」"
              >
                <div className="widget-tag-4x4">上次閱讀進度 ➔</div>
                <div className="widget-count-badge-4x4">共 {resumeBooks.length} 部</div>
              </div>
              <div className="book-stack-4x4">
                {displayResumeBooks.map((item, idx) => (
                  <div 
                    key={`lastread-stack-${item.book.workId}-${idx}`}
                    className="book-stack-item-4x4"
                    onClick={!isLayoutEditMode ? () => onSelectBook(item.book.workId, item.progress?.segmentId, undefined, 'resume') : undefined}
                  >
                    <div className="book-badge" style={{ background: getBookCoverGradient(item.book.workId) }}>
                      {item.book.workId}
                    </div>
                    <div className="book-info">
                      <div className="b-title" title={item.book.title}>{item.book.title}</div>
                      <div className="b-sub">
                        {item.progress?.juan ? `第 ${item.progress.juan} 卷` : '閱讀中'}
                        {item.book.creators ? ` · ${sanitizeCreators(item.book.creators)}` : ''}
                      </div>
                    </div>
                    <button type="button" className="cbeta-read-btn" title="繼續閱讀">
                      <ArrowRight size={17} strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // 💡 4x1 簡約條：統一 4x2 規格 (42px 正方形圖示、經文文字、圓型 →)
        if (size === 'size-4x1') {
          return (
            <div 
              className="lastread-4x1"
              onClick={!isLayoutEditMode ? () => onSelectBook(lastBook.book.workId, lastBook.progress.segmentId, undefined, 'resume') : undefined}
            >
              <div className="left">
                <div className="book-badge" style={{ background: getBookCoverGradient(lastBook.book.workId) }}>
                  {lastBook.book.workId}
                </div>
                <div className="book-info">
                  <div className="b-title" title={lastBook.book.title}>{lastBook.book.title} {lastBook.progress.juan ? `(第${lastBook.progress.juan}卷)` : ''}</div>
                  <div 
                    className="b-sub" 
                    onClick={!isLayoutEditMode ? (e) => { e.stopPropagation(); onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf'); } : undefined}
                    style={{ cursor: 'pointer' }}
                    title="點擊查看所有近期閱讀"
                  >
                    上次閱讀進度 ➔
                  </div>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="繼續閱讀">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }

        // size-4x2
        return (
          <div 
            className="lastread-4x2"
            onClick={!isLayoutEditMode ? () => onSelectBook(lastBook.book.workId, lastBook.progress.segmentId, undefined, 'resume') : undefined}
          >
            <div 
              className="lastread-tag"
              onClick={!isLayoutEditMode ? (e) => { e.stopPropagation(); onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf'); } : undefined}
              style={{ cursor: 'pointer' }}
              title="點擊進入書櫃「近期閱讀」"
            >
              上次閱讀 ➔
            </div>
            <div className="lastread-row">
              <div className="lastread-book-box">
                <div className="book-badge" style={{ background: getBookCoverGradient(lastBook.book.workId) }}>
                  {lastBook.book.workId}
                </div>
                <div className="book-info">
                  <div className="b-title" title={lastBook.book.title}>{lastBook.book.title}</div>
                  <div className="b-sub">
                    {lastBook.progress.juan ? `第 ${lastBook.progress.juan} 卷` : ''}
                    {lastBook.book.creators ? ` · ${sanitizeCreators(lastBook.book.creators)}` : ''}
                  </div>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="繼續閱讀">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        );
      }

      // 8-1. 新增「我的最愛」卡片 (4x2 / 4x1 / 4x3 / 4x4)
      case 'favorites_4x2': {
        const favoriteWorkIds: string[] = (() => {
          try {
            const saved = localStorage.getItem('favorite_work_ids');
            return saved ? JSON.parse(saved) : [];
          } catch (e) {
            return [];
          }
        })();
        const favoriteBooks = downloadedBooks.filter(b => favoriteWorkIds.includes(b.workId));

        if (favoriteBooks.length === 0) {
          return (
            <div 
              className="lastread-4x1" 
              style={{ justifyContent: 'center', cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
            >
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>我的最愛：尚未收藏任何經典 (點擊進入書櫃)</span>
            </div>
          );
        }

        // 4x3（3部）與 4x4（4部）大版面
        if (size === 'size-4x3' || size === 'size-4x4') {
          const maxFavs = size === 'size-4x3' ? 3 : 4;
          const displayFavs = favoriteBooks.slice(0, maxFavs);
          return (
            <div className={`book-list-widget-multi ${size === 'size-4x3' ? 'multi-4x3' : 'multi-4x4'}`}>
              <div 
                className="widget-header-row-4x4"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「我的最愛」"
              >
                <div className="widget-tag-4x4">我的最愛經典 ➔</div>
                <div className="widget-count-badge-4x4">共 {favoriteBooks.length} 部</div>
              </div>
              <div className="book-stack-4x4">
                {displayFavs.map(b => (
                  <div 
                    key={`fav-stack-${b.workId}`}
                    className="book-stack-item-4x4"
                    onClick={!isLayoutEditMode ? () => onSelectBook(b.workId) : undefined}
                  >
                    <div className="book-badge" style={{ background: getBookCoverGradient(b.workId) }}>
                      {b.workId}
                    </div>
                    <div className="book-info">
                      <div className="b-title" title={b.title}>{b.title}</div>
                      <div className="b-sub">
                        {b.juansCount ? `全 ${b.juansCount} 卷` : ''}
                        {b.creators ? ` · ${sanitizeCreators(b.creators)}` : ''}
                      </div>
                    </div>
                    <button type="button" className="cbeta-read-btn" title="閱讀經典">
                      <ArrowRight size={17} strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const firstFav = favoriteBooks[0];

        // 4x1 簡約條：統一 4x2 規格
        if (size === 'size-4x1') {
          return (
            <div 
              className="lastread-4x1"
              onClick={!isLayoutEditMode ? () => onSelectBook(firstFav.workId) : undefined}
            >
              <div className="left">
                <div className="book-badge" style={{ background: getBookCoverGradient(firstFav.workId) }}>
                  {firstFav.workId}
                </div>
                <div className="book-info">
                  <div className="b-title" title={firstFav.title}>{firstFav.title}</div>
                  <div 
                    className="b-sub"
                    onClick={!isLayoutEditMode ? (e) => { e.stopPropagation(); onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf'); } : undefined}
                    style={{ cursor: 'pointer' }}
                    title="點擊查看所有我的最愛"
                  >
                    我的最愛經典 ➔
                  </div>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="閱讀經典">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }

        // size-4x2
        return (
          <div 
            className="lastread-4x2"
            onClick={!isLayoutEditMode ? () => onSelectBook(firstFav.workId) : undefined}
          >
            <div 
              className="lastread-tag"
              onClick={!isLayoutEditMode ? (e) => { e.stopPropagation(); onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf'); } : undefined}
              style={{ cursor: 'pointer' }}
              title="點擊進入書櫃「我的最愛」"
            >
              我的最愛 · 共 {favoriteBooks.length} 本 ➔
            </div>
            <div className="lastread-row">
              <div className="lastread-book-box">
                <div className="book-badge" style={{ background: getBookCoverGradient(firstFav.workId) }}>
                  {firstFav.workId}
                </div>
                <div className="book-info">
                  <div className="b-title" title={firstFav.title}>{firstFav.title}</div>
                  <div className="b-sub">
                    {firstFav.juansCount ? `全 ${firstFav.juansCount} 卷` : ''}
                    {firstFav.creators ? ` · ${sanitizeCreators(firstFav.creators)}` : ''}
                  </div>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="閱讀經典">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        );
      }

      // 8-2. 新增「近期下載」卡片 (4x2 / 4x1 / 4x3 / 4x4)
      case 'recent_downloads_4x2': {
        const recentDownloadedBooks = [...downloadedBooks].reverse();

        if (recentDownloadedBooks.length === 0) {
          return (
            <div 
              className="lastread-4x1" 
              style={{ justifyContent: 'center', cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
            >
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>近期下載：暫無已下載經典 (點擊進入書櫃)</span>
            </div>
          );
        }

        // 4x3（3部）與 4x4（4部）大版面
        if (size === 'size-4x3' || size === 'size-4x4') {
          const maxRecent = size === 'size-4x3' ? 3 : 4;
          const displayRecent = recentDownloadedBooks.slice(0, maxRecent);
          return (
            <div className={`book-list-widget-multi ${size === 'size-4x3' ? 'multi-4x3' : 'multi-4x4'}`}>
              <div 
                className="widget-header-row-4x4"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「近期下載」"
              >
                <div className="widget-tag-4x4">近期下載經典 ➔</div>
                <div className="widget-count-badge-4x4">共 {downloadedBooks.length} 部</div>
              </div>
              <div className="book-stack-4x4">
                {displayRecent.map(b => (
                  <div 
                    key={`recent-stack-${b.workId}`}
                    className="book-stack-item-4x4"
                    onClick={!isLayoutEditMode ? () => onSelectBook(b.workId) : undefined}
                  >
                    <div className="book-badge" style={{ background: getBookCoverGradient(b.workId) }}>
                      {b.workId}
                    </div>
                    <div className="book-info">
                      <div className="b-title" title={b.title}>{b.title}</div>
                      <div className="b-sub">
                        {b.juansCount ? `全 ${b.juansCount} 卷` : ''}
                        {b.creators ? ` · ${sanitizeCreators(b.creators)}` : ''}
                      </div>
                    </div>
                    <button type="button" className="cbeta-read-btn" title="閱讀經典">
                      <ArrowRight size={17} strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const firstRecent = recentDownloadedBooks[0];

        // 4x1 簡約條：統一 4x2 規格
        if (size === 'size-4x1') {
          return (
            <div 
              className="lastread-4x1"
              onClick={!isLayoutEditMode ? () => onSelectBook(firstRecent.workId) : undefined}
            >
              <div className="left">
                <div className="book-badge" style={{ background: getBookCoverGradient(firstRecent.workId) }}>
                  {firstRecent.workId}
                </div>
                <div className="book-info">
                  <div className="b-title" title={firstRecent.title}>{firstRecent.title}</div>
                  <div 
                    className="b-sub"
                    onClick={!isLayoutEditMode ? (e) => { e.stopPropagation(); onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf'); } : undefined}
                    style={{ cursor: 'pointer' }}
                    title="點擊查看所有近期下載經典"
                  >
                    近期下載經典 ➔
                  </div>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="閱讀經典">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          );
        }

        // size-4x2
        return (
          <div 
            className="lastread-4x2"
            onClick={!isLayoutEditMode ? () => onSelectBook(firstRecent.workId) : undefined}
          >
            <div 
              className="lastread-tag"
              onClick={!isLayoutEditMode ? (e) => { e.stopPropagation(); onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf'); } : undefined}
              style={{ cursor: 'pointer' }}
              title="點擊進入書櫃「近期下載經典」"
            >
              近期下載 · 共 {downloadedBooks.length} 本 ➔
            </div>
            <div className="lastread-row">
              <div className="lastread-book-box">
                <div className="book-badge" style={{ background: getBookCoverGradient(firstRecent.workId) }}>
                  {firstRecent.workId}
                </div>
                <div className="book-info">
                  <div className="b-title" title={firstRecent.title}>{firstRecent.title}</div>
                  <div className="b-sub">
                    {firstRecent.juansCount ? `全 ${firstRecent.juansCount} 卷` : ''}
                    {firstRecent.creators ? ` · ${sanitizeCreators(firstRecent.creators)}` : ''}
                  </div>
                </div>
              </div>
              <button type="button" className="cbeta-read-btn" title="閱讀經典">
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>
          </div>
        );
      }

      // 9. 四色主題快捷列 (4x1 / 2x2)
      case 'theme_4x1': {
        if (size === 'size-2x2') {
          // 💡 圖1：四大模式為 2x2 時，圓圈內不要有字，純色圓點，文字標籤寫在圓圈圈的下面
          return (
            <div className="theme-palette-2x2-grid">
              <div 
                className="theme-grid-item-2x2"
                onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'ivory' }) : undefined}
                title="象牙白"
              >
                <div className={`theme-circle-btn ball-ivory ${settings.theme === 'ivory' ? 'active' : ''}`} />
                <span className="theme-circle-label">象牙白</span>
              </div>

              <div 
                className="theme-grid-item-2x2"
                onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'parchment' }) : undefined}
                title="羊皮紙"
              >
                <div className={`theme-circle-btn ball-parchment ${settings.theme === 'parchment' ? 'active' : ''}`} />
                <span className="theme-circle-label">羊皮紙</span>
              </div>

              <div 
                className="theme-grid-item-2x2"
                onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'comfort' }) : undefined}
                title="舒服綠"
              >
                <div className={`theme-circle-btn ball-comfort ${settings.theme === 'comfort' ? 'active' : ''}`} />
                <span className="theme-circle-label">舒服綠</span>
              </div>

              <div 
                className="theme-grid-item-2x2"
                onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'ebony' }) : undefined}
                title="烏木黑"
              >
                <div className={`theme-circle-btn ball-ebony ${settings.theme === 'ebony' ? 'active' : ''}`} />
                <span className="theme-circle-label">烏木</span>
              </div>
            </div>
          );
        }

        // 4x1 橫條版
        return (
          <div className="theme-palette-4x1">
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)' }}>閱讀底色:</span>
            <div 
              className={`theme-ball ball-ivory ${settings.theme === 'ivory' ? 'active' : ''}`}
              onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'ivory' }) : undefined}
              title="象牙白"
            >白</div>
            <div 
              className={`theme-ball ball-parchment ${settings.theme === 'parchment' ? 'active' : ''}`}
              onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'parchment' }) : undefined}
              title="羊皮紙"
            >紙</div>
            <div 
              className={`theme-ball ball-comfort ${settings.theme === 'comfort' ? 'active' : ''}`}
              onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'comfort' }) : undefined}
              title="舒服綠"
            >舒</div>
            <div 
              className={`theme-ball ball-ebony ${settings.theme === 'ebony' ? 'active' : ''}`}
              onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'ebony' }) : undefined}
              title="烏木"
            >木</div>
          </div>
        );
      }

      // 10. 護眼計時器 (💡 圖3：4x2 淺灰色旋轉圓圈圈+其下加「護眼模式設定」+6個時間圓圈；2x2 倒數圓環不用加文字+4個小圓圈)
      case 'timer_2x2': {
        const isRunning = timerState.duration !== null;
        const timeDisplay = isRunning 
          ? formatTimerMMSS(timerState.remainingSeconds)
          : '25m';

        const durations6 = [10, 15, 25, 35, 45, 60];
        const durations4 = [15, 25, 45, 60];

        // 💡 4x2 橫幅大儀表板：左側大倒數圓環其下加「護眼模式設定」，右側 6 個圓形選時按鈕
        if (size === 'size-4x2') {
          return (
            <div className="timer-widget-4x2">
              <div className="timer-4x2-left">
                <div 
                  className={`timer-circle timer-circle-large ${isRunning ? 'is-active' : ''}`}
                  onClick={!isLayoutEditMode ? () => {
                    if (isRunning) handleSetTimerMinutes(null);
                    else handleSetTimerMinutes(25);
                  } : undefined}
                  title={isRunning ? `倒數中：${timeDisplay} (點擊取消)` : '點擊開始計時'}
                  style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                >
                  <span>{timeDisplay}</span>
                </div>
                <div className="timer-mode-sublabel">護眼模式設定</div>
              </div>
              <div className="timer-4x2-right">
                <div className="timer-durations-circles-6">
                  {durations6.map(mins => {
                    const isSelected = timerState.duration === mins;
                    return (
                      <button
                        key={`timer-circle-6-${mins}`}
                        type="button"
                        className={`timer-circle-btn ${isSelected ? 'active' : ''}`}
                        onClick={!isLayoutEditMode ? () => {
                          if (isSelected) {
                            handleSetTimerMinutes(null); // 點選中者取消計時
                          } else {
                            handleSetTimerMinutes(mins);
                          }
                        } : undefined}
                        title={isSelected ? `點擊取消 ${mins} 分鐘計時` : `設定 ${mins} 分鐘`}
                      >
                        {mins}m
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

        // 💡 2x2 方塊：上方倒數圓環 (不加文字)，下方 4 個小圓圈 (15/25/45/60，點選中者即取消)
        return (
          <div className="timer-2x2-wrapper">
            <div 
              className={`timer-circle ${isRunning ? 'is-active' : ''}`}
              onClick={!isLayoutEditMode ? () => {
                if (isRunning) handleSetTimerMinutes(null);
                else handleSetTimerMinutes(25);
              } : undefined}
              title={isRunning ? `倒數中：${timeDisplay} (點擊取消)` : '點擊開始 25 分鐘計時'}
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default', margin: '0 0 6px 0' }}
            >
              <span>{timeDisplay}</span>
            </div>

            {/* 內嵌於 2x2 卡片內的 4 個小圓圈 */}
            <div className="timer-circles-4-row">
              {durations4.map(mins => {
                const isSelected = timerState.duration === mins;
                return (
                  <button
                    key={`inline-circle-${mins}`}
                    type="button"
                    className={`timer-circle-btn-small ${isSelected ? 'active' : ''}`}
                    onClick={!isLayoutEditMode ? (e) => {
                      e.stopPropagation();
                      if (isSelected) {
                        handleSetTimerMinutes(null); // 點選中者取消計時
                      } else {
                        handleSetTimerMinutes(mins);
                      }
                    } : undefined}
                    title={isSelected ? `點擊取消 ${mins} 分鐘計時` : `設定 ${mins} 分鐘`}
                  >
                    {mins}m
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      // 11. 每日閱讀日誌徽章 (2x2 / 2x1 / 1x1)
      case 'stats_2x2': {
        if (size === 'size-1x1') {
          return (
            <div 
              className="core-widget-1x1"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('reading-log') : undefined}
            >
              <CalendarDays size={20} style={{ color: '#1ea98c', marginBottom: 2 }} />
              <div className="core-title-small">閱讀日誌</div>
            </div>
          );
        }
        return (
          <div 
            className="stats-2x2"
            onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('reading-log') : undefined}
            title="點擊查看每日閱讀日誌"
          >
            <div className="stats-num">
              <CalendarDays size={22} style={{ color: '#1ea98c', marginBottom: 2 }} />
            </div>
            <div className="stats-title">每日閱讀日誌</div>
            <div className="stats-sub">點擊查看日曆與記錄</div>
          </div>
        );
      }

      // 12. 佛典精進名句 (固定 4x2，無 4x1)
      case 'zen_4x2': {
        return (
          <div className="zen-quote-4x2">
            <div className="zen-lotus">
              <svg width="22" height="18" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.75, color: 'var(--theme-accent, #8c4b27)' }}>
                <path d="M12 2C12 2 8 8 8 13C8 16 10 18 12 18C14 18 16 16 16 13C16 8 12 2 12 2Z" />
                <path d="M12 18C7.5 18 4 14.5 4 11C4 8.5 6 6 8 5" />
                <path d="M12 18C16.5 18 20 14.5 20 11C20 8.5 18 6 16 5" />
                <path d="M2 18C5 18 8 17.5 12 17.5C16 17.5 19 18 22 18" />
              </svg>
            </div>
            <div className="zen-text">「由聞知諸法，由聞遮眾惡，由聞斷無義，由聞得涅槃。」</div>
            <div className="zen-author">印順導師《成佛之道》Y0040</div>
          </div>
        );
      }

      default:
        return <div>小工具組件</div>;
    }
  };

  // 💡 當前分類下的小工具清單與當前選中之小工具
  const currentCategoryWidgets = WIDGET_CATALOG.filter(w => w.category === activeCategory);
  const currentWidget = currentCategoryWidgets[currentWidgetIndex] || currentCategoryWidgets[0] || WIDGET_CATALOG[0];
  const availableSizes = ALLOWED_SIZES_BY_TYPE[currentWidget.type] || ['size-4x2', 'size-4x1', 'size-2x2'];

  // 切換大類別
  const handleSelectCategory = (catId: WidgetCategoryId) => {
    setActiveCategory(catId);
    setCurrentWidgetIndex(0);
    const catWidgets = WIDGET_CATALOG.filter(w => w.category === catId);
    if (catWidgets.length > 0) {
      const firstW = catWidgets[0];
      const allowed = ALLOWED_SIZES_BY_TYPE[firstW.type] || ['size-4x2', 'size-4x1', 'size-2x2'];
      if (!allowed.includes(previewWidgetSize)) {
        setPreviewWidgetSize(firstW.size);
      }
    }
  };

  // 💡 按「<」切換上一個小工具
  const handlePrevWidget = () => {
    const len = currentCategoryWidgets.length;
    if (len <= 1) return;
    const prevIdx = (currentWidgetIndex - 1 + len) % len;
    setCurrentWidgetIndex(prevIdx);
    const prevW = currentCategoryWidgets[prevIdx];
    const allowed = ALLOWED_SIZES_BY_TYPE[prevW.type] || ['size-4x2', 'size-4x1', 'size-2x2'];
    if (!allowed.includes(previewWidgetSize)) {
      setPreviewWidgetSize(allowed[0]);
    }
  };

  // 💡 按「>」切換下一個小工具
  const handleNextWidget = () => {
    const len = currentCategoryWidgets.length;
    if (len <= 1) return;
    const nextIdx = (currentWidgetIndex + 1) % len;
    setCurrentWidgetIndex(nextIdx);
    const nextW = currentCategoryWidgets[nextIdx];
    const allowed = ALLOWED_SIZES_BY_TYPE[nextW.type] || ['size-4x2', 'size-4x1', 'size-2x2'];
    if (!allowed.includes(previewWidgetSize)) {
      setPreviewWidgetSize(allowed[0]);
    }
  };

  return (
    <div className={`home-custom-dashboard-wrapper ${isLayoutEditMode ? 'edit-mode' : ''}`}>
      {/* 💡 圖1：編輯模式頂部控制列（左上：＋加入小工具(淺灰底虛線) / 右上：✓完成(淺灰底實線)） */}
      {isLayoutEditMode && (
        <div className="home-edit-top-banner animate-fade-in">
          <button 
            type="button" 
            className="home-edit-top-btn btn-add-widget"
            onClick={() => {
              setIsGalleryOpen(true);
            }}
            title="開啟小工具庫加入新組件"
          >
            <Plus size={15} strokeWidth={2.6} />
            <span>加入小工具</span>
          </button>

          <div className="home-edit-top-hint">
            <span>✦ 拖曳卡片即可排序</span>
            <span className="hint-sub">· 點 ⛶ 切換尺寸</span>
          </div>

          <button 
            type="button" 
            className="home-edit-top-btn btn-done"
            onClick={handleSaveAndExit}
            title="儲存自訂版面並退出編輯"
          >
            <Check size={15} strokeWidth={2.6} />
            <span>完成</span>
          </button>
        </div>
      )}

      {/* 4 欄基礎 Widget 網格容器 */}
      <div className="home-grid-container">
        {widgets.map(widget => {
          const isDragging = draggedWidgetId === widget.id;
          const isOver = dragOverWidgetId === widget.id;

          return (
            <div
              key={widget.id}
              className={`widget-card ${widget.size} ${widget.type === 'appicon_2x2' ? 'zen-icon-no-pad' : ''} ${widget.type === 'download_2x2' && widget.size === 'size-4x1' ? 'download-dashed-card-4x1' : ''} ${isDragging ? 'is-dragging' : ''} ${isOver ? 'drag-over-indicator' : ''}`}
              draggable={isLayoutEditMode}
              onDragStart={(e) => handleDragStart(e, widget.id)}
              onDragOver={(e) => handleDragOver(e, widget.id)}
              onDragLeave={(e) => handleDragLeave(e, widget.id)}
              onDrop={(e) => handleDrop(e, widget.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(widget.id, e)}
              onTouchEnd={handleTouchEnd}
            >
              {/* 💡 圖1：編輯模式下方塊右上角小圓灰色「x」與右下角小圓綠色「切換尺寸」 */}
              {isLayoutEditMode && (
                <>
                  {/* 1. 左上角拖曳指示 */}
                  <div className="drag-handle-hint" title="拖曳排序">⠿</div>

                  {/* 2. 右上角小圓灰色「x」刪除按鈕 */}
                  <button
                    type="button"
                    className="edit-btn btn-remove-tr"
                    title="移除小工具"
                    onClick={(e) => handleRemoveWidget(widget.id, e)}
                  >
                    <X size={11} strokeWidth={2.8} />
                  </button>

                  {/* 3. 右下角小圓綠色「切換尺寸」按鈕 */}
                  <button 
                    type="button" 
                    className="edit-btn btn-size-br" 
                    title="切換尺寸" 
                    onClick={(e) => handleCycleSize(widget.id, e)}
                  >
                    <Maximize2 size={11} strokeWidth={2.4} />
                  </button>

                  {/* 4. 左下角尺寸標籤 */}
                  <div className="size-indicator">
                    {widget.size.replace('size-', '')}
                  </div>
                </>
              )}

              {renderWidgetContent(widget)}
            </div>
          );
        })}
      </div>

      {/* 💡 非編輯模式且啟用自訂版面時：底部提供簡潔的「📐 自訂排版」按鈕 */}
      {!isLayoutEditMode && settings.customHomeLayoutEnabled && (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '1.2rem' }}>
          <button
            type="button"
            className="home-layout-edit-trigger-btn"
            onClick={() => setIsLayoutEditMode(true)}
          >
            <Sliders size={14} style={{ color: '#1ea98c' }} />
            <span>自訂首頁排版</span>
          </button>
        </div>
      )}

      {/* ==========================================================================
          iOS Widget Gallery Modal (圖 2 & 圖 3：4 大類別 + 「<」「>」直接切換加入，單層無下一層)
          ========================================================================== */}
      {isGalleryOpen && (
        <div className="ios-gallery-overlay animate-fade-in" onClick={() => setIsGalleryOpen(false)}>
          <div className="ios-gallery-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* 1. Sheet Grabber */}
            <div className="ios-gallery-grabber" />

            {/* 2. Top Navigation Bar */}
            <div className="ios-gallery-nav-bar">
              <div className="ios-gallery-title">加入小工具</div>

              <button
                type="button"
                className="ios-gallery-close-btn"
                onClick={() => setIsGalleryOpen(false)}
                title="關閉"
              >
                <X size={18} />
              </button>
            </div>

            {/* 3. 圖3：4 大類別選單 (無左側圖示，純文字藥丸按鈕) */}
            <div className="ios-gallery-category-tabs">
              {WIDGET_CATEGORIES.map(cat => (
                <button
                  key={`cat-pill-${cat.id}`}
                  type="button"
                  className={`ios-category-tab-btn ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => handleSelectCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* 4. 預設範本快捷選單 */}
            <div className="ios-gallery-presets-bar">
              <span className="presets-label">範本:</span>
              <button type="button" className="preset-pill-btn" onClick={() => { handleApplyPreset('default'); setIsGalleryOpen(false); }}>經典原味</button>
              <button type="button" className="preset-pill-btn" onClick={() => { handleApplyPreset('compact'); setIsGalleryOpen(false); }}>極簡精巧</button>
              <button type="button" className="preset-pill-btn" onClick={() => { handleApplyPreset('focus'); setIsGalleryOpen(false); }}>每日精進</button>
              <button type="button" className="preset-pill-btn" onClick={() => { handleApplyPreset('zen'); setIsGalleryOpen(false); }}>禪修護眼</button>
            </div>

            {/* 5. 單層直接預覽主舞台 (圖 3：按「<」「>」選擇卡片直接加到主頁，不用進入下一層) */}
            <div className="ios-gallery-preview-stage custom-scrollbar">
              {/* Widget Title & Indicator */}
              <div className="ios-preview-info-header">
                <div className="ios-preview-title-row">
                  <h3 className="ios-preview-title">{currentWidget.name}</h3>
                  <span className="ios-preview-counter-badge">
                    {currentWidgetIndex + 1} / {currentCategoryWidgets.length}
                  </span>
                </div>
                <p className="ios-preview-desc">{currentWidget.description}</p>
              </div>

              {/* 💡 Preview Showcase Box with < and > Navigation */}
              <div className="ios-preview-showcase-row">
                <button
                  type="button"
                  className="ios-preview-nav-arrow-btn prev"
                  onClick={handlePrevWidget}
                  title="切換上一個小工具"
                  disabled={currentCategoryWidgets.length <= 1}
                >
                  <ChevronLeft size={22} />
                </button>

                <div className="ios-live-preview-viewport">
                  <div className={`widget-card preview-card-mode ${previewWidgetSize} ${currentWidget.type === 'appicon_2x2' ? 'zen-icon-no-pad' : ''} ${currentWidget.type === 'download_2x2' && previewWidgetSize === 'size-4x1' ? 'download-dashed-card-4x1' : ''}`}>
                    {renderWidgetContent({
                      id: 'preview-instance',
                      type: currentWidget.type,
                      size: previewWidgetSize,
                      iconIndex: previewIconIndex
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  className="ios-preview-nav-arrow-btn next"
                  onClick={handleNextWidget}
                  title="切換下一個小工具"
                  disabled={currentCategoryWidgets.length <= 1}
                >
                  <ChevronRight size={22} />
                </button>
              </div>

              {/* 💡 Size Selector & Pagination Dots (圖 2：小類別尺寸規格切換 4x1/4x2/2x2/4x4) */}
              <div className="ios-preview-size-controls">
                {/* Pagination Dots */}
                <div className="ios-pagination-dots">
                  {availableSizes.map(sizeKey => (
                    <div
                      key={`dot-${sizeKey}`}
                      className={`ios-page-dot ${previewWidgetSize === sizeKey ? 'active' : ''}`}
                      onClick={() => setPreviewWidgetSize(sizeKey)}
                      title={`切換為 ${sizeKey.replace('size-', '')}`}
                    />
                  ))}
                </div>

                {/* Size Chips */}
                <div className="ios-size-chips-row">
                  {availableSizes.map(sizeKey => (
                    <button
                      key={`size-chip-${sizeKey}`}
                      type="button"
                      className={`ios-size-chip-btn ${previewWidgetSize === sizeKey ? 'active' : ''}`}
                      onClick={() => setPreviewWidgetSize(sizeKey)}
                    >
                      {sizeKey.replace('size-', '').replace('x', '×')}
                    </button>
                  ))}
                </div>
              </div>

              {/* 💡 Bottom Action Button (直接加入主頁) */}
              <div className="ios-preview-bottom-action">
                <button
                  type="button"
                  className="ios-add-widget-confirm-btn"
                  onClick={() => handleAddWidget(currentWidget.type, previewWidgetSize, previewIconIndex)}
                >
                  <Plus size={19} strokeWidth={2.6} />
                  <span>加入小工具</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
