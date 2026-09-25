import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Folder, Notebook, ChevronRight, ChevronLeft, Check, X,
  Maximize2, Sliders, CalendarDays, ArrowRight
} from 'lucide-react';
import type { BookMetadata } from '../../types/book';
import { getBook } from '../../utils/db';
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

// 💡 檢查是否為經書外置標題小工具 (上次閱讀之 4x2、4x1，經文進度 4x4，我的最愛、近期下載之 4x2 與 4x1 規格)
const isBookWidgetOuterHeader = (type: string, size: string) => 
  ((type === 'lastread_4x2' || type === 'lastread_4x1') && (size === 'size-4x2' || size === 'size-4x1')) ||
  ((type === 'favorites_4x2' || type === 'recent_downloads_4x2') && (size === 'size-4x2' || size === 'size-4x1')) ||
  (type === 'lastread_excerpt_4x4');

// 💡 扁平化全小工具線性巡覽清單 (全由「<」「>」依序瀏覽所有分類與規格)
interface FlatGalleryItem {
  id: string;
  type: HomeWidgetType;
  size: HomeWidgetSize;
  sizeLabel: string;
  category: WidgetCategoryId;
  title: string;
}

const FLAT_GALLERY_ITEMS: FlatGalleryItem[] = [
  // 1. 主題圖卡 (brand)
  { id: 'b_title_4x1', type: 'title_4x1', size: 'size-4x1', sizeLabel: '4×1', category: 'brand', title: '簡約橫幅標題' },
  { id: 'b_title_4x2', type: 'title_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'brand', title: '經典大標題' },
  { id: 'b_title_2x2', type: 'title_4x2', size: 'size-2x2', sizeLabel: '2×2', category: 'brand', title: '正方標題' },
  { id: 'b_icon_2x2', type: 'appicon_2x2', size: 'size-2x2', sizeLabel: '2×2', category: 'brand', title: '禪意圖標' },

  // 2. 快捷功能 (nav)
  { id: 'n_four_4x1', type: 'four_nav_4x1', size: 'size-4x1', sizeLabel: '4×1', category: 'nav', title: '四合一導航' },
  { id: 'n_four_4x2', type: 'four_nav_4x1', size: 'size-4x2', sizeLabel: '4×2', category: 'nav', title: '四合一導航' },
  { id: 'n_four_4x4', type: 'four_nav_4x1', size: 'size-4x4', sizeLabel: '4×4', category: 'nav', title: '四合一導航' },
  { id: 'n_four_2x2', type: 'four_nav_4x1', size: 'size-2x2', sizeLabel: '2×2', category: 'nav', title: '四合一導航' },

  { id: 'n_dl_4x1', type: 'download_2x2', size: 'size-4x1', sizeLabel: '4×1', category: 'nav', title: '下載經典' },
  { id: 'n_dl_4x2', type: 'download_2x2', size: 'size-4x2', sizeLabel: '4×2', category: 'nav', title: '下載經典' },
  { id: 'n_dl_2x2', type: 'download_2x2', size: 'size-2x2', sizeLabel: '2×2', category: 'nav', title: '下載經典' },

  { id: 'n_shelf_4x1', type: 'shelf_2x2', size: 'size-4x1', sizeLabel: '4×1', category: 'nav', title: '我的書櫃' },
  { id: 'n_shelf_4x2', type: 'shelf_2x2', size: 'size-4x2', sizeLabel: '4×2', category: 'nav', title: '我的書櫃' },
  { id: 'n_shelf_2x2', type: 'shelf_2x2', size: 'size-2x2', sizeLabel: '2×2', category: 'nav', title: '我的書櫃' },

  { id: 'n_notes_4x1', type: 'notes_2x2', size: 'size-4x1', sizeLabel: '4×1', category: 'nav', title: '我的筆記' },
  { id: 'n_notes_4x2', type: 'notes_2x2', size: 'size-4x2', sizeLabel: '4×2', category: 'nav', title: '我的筆記' },
  { id: 'n_notes_2x2', type: 'notes_2x2', size: 'size-2x2', sizeLabel: '2×2', category: 'nav', title: '我的筆記' },

  { id: 'n_search_4x1', type: 'search_2x2', size: 'size-4x1', sizeLabel: '4×1', category: 'nav', title: '全文檢索' },
  { id: 'n_search_4x2', type: 'search_2x2', size: 'size-4x2', sizeLabel: '4×2', category: 'nav', title: '全文檢索' },
  { id: 'n_search_2x2', type: 'search_2x2', size: 'size-2x2', sizeLabel: '2×2', category: 'nav', title: '全文檢索' },

  // 3. 我的書櫃 (reading)
  { id: 'r_last_4x1', type: 'lastread_4x2', size: 'size-4x1', sizeLabel: '4×1', category: 'reading', title: '上次閱讀' },
  { id: 'r_last_4x2', type: 'lastread_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'reading', title: '上次閱讀' },
  { id: 'r_last_4x3', type: 'lastread_4x2', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '上次閱讀' },
  { id: 'r_last_4x4', type: 'lastread_4x2', size: 'size-4x4', sizeLabel: '4×4', category: 'reading', title: '上次閱讀 (4本書)' },
  { id: 'r_last_excerpt_4x4', type: 'lastread_excerpt_4x4', size: 'size-4x4', sizeLabel: '4×4', category: 'reading', title: '上次閱讀 (經文進度)' },

  { id: 'r_fav_4x1', type: 'favorites_4x2', size: 'size-4x1', sizeLabel: '4×1', category: 'reading', title: '我的最愛' },
  { id: 'r_fav_4x2', type: 'favorites_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'reading', title: '我的最愛' },
  { id: 'r_fav_4x3', type: 'favorites_4x2', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '我的最愛' },
  { id: 'r_fav_4x4', type: 'favorites_4x2', size: 'size-4x4', sizeLabel: '4×4', category: 'reading', title: '我的最愛' },

  { id: 'r_down_4x1', type: 'recent_downloads_4x2', size: 'size-4x1', sizeLabel: '4×1', category: 'reading', title: '近期下載' },
  { id: 'r_down_4x2', type: 'recent_downloads_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'reading', title: '近期下載' },
  { id: 'r_down_4x3', type: 'recent_downloads_4x2', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '近期下載' },
  { id: 'r_down_4x4', type: 'recent_downloads_4x2', size: 'size-4x4', sizeLabel: '4×4', category: 'reading', title: '近期下載' },

  { id: 'r_stats_2x2', type: 'stats_2x2', size: 'size-2x2', sizeLabel: '2×2', category: 'reading', title: '每日閱讀日誌' },

  // 4. 其他功能 (other)
  { id: 'o_timer_4x2', type: 'timer_2x2', size: 'size-4x2', sizeLabel: '4×2', category: 'other', title: '護眼計時器' },
  { id: 'o_timer_2x2', type: 'timer_2x2', size: 'size-2x2', sizeLabel: '2×2', category: 'other', title: '護眼計時器' },
  { id: 'o_theme_4x1', type: 'theme_4x1', size: 'size-4x1', sizeLabel: '4×1', category: 'other', title: '四色主題' },
  { id: 'o_theme_2x2', type: 'theme_4x1', size: 'size-2x2', sizeLabel: '2×2', category: 'other', title: '四色主題' },
  { id: 'o_zen_4x2', type: 'zen_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'other', title: '佛典精進名句' }
];

// 💡 預覽展示專用之 CBETA 官方經典示範資料 (確保在無歷史進度時亦能真實預覽卡片排版與長條Bar)
const DEMO_PREVIEW_RESUME: Array<{ book: BookMetadata; progress?: any }> = [
  {
    book: {
      workId: 'T0262',
      title: '妙法蓮華經',
      canon: 'T',
      creators: '後秦 鳩摩羅什譯',
      juansCount: 7,
      category: '大乘法華部',
      version: '2.9.11'
    },
    progress: { juan: 1, segmentId: 'p0001a01' }
  },
  {
    book: {
      workId: 'T0779',
      title: '佛說八大人覺經',
      canon: 'T',
      creators: '東漢 安世高譯',
      juansCount: 1,
      category: '阿含部',
      version: '2.9.11'
    },
    progress: { juan: 1, segmentId: 'p0001a01' }
  },
  {
    book: {
      workId: 'T0411',
      title: '大乘大集地藏十輪經',
      canon: 'T',
      creators: '唐 玄奘譯',
      juansCount: 10,
      category: '大乘大集部',
      version: '2.9.11'
    },
    progress: { juan: 1, segmentId: 'p0001a01' }
  },
  {
    book: {
      workId: 'T0412',
      title: '地藏菩薩本願經',
      canon: 'T',
      creators: '唐 實叉難陀譯',
      juansCount: 2,
      category: '大乘本生部',
      version: '2.9.11'
    },
    progress: { juan: 1, segmentId: 'p0001a01' }
  }
];


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

  // 💡 iOS Widget Gallery 狀態 (單層扁平化巡覽 + 「<」「>」全流程切換)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number>(0);
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

  // 💡 全局尺寸標準優先輪播順序：4*1 -> 4*2 -> 4*3 -> 4*4 -> 2*2 -> 4*1...
  const PREFERRED_SIZE_CYCLE_ORDER: HomeWidgetSize[] = ['size-4x1', 'size-4x2', 'size-4x3', 'size-4x4', 'size-2x2', 'size-2x1', 'size-1x1'];

  // 切換卡片尺寸 (依據 4x1 -> 4x2 -> 4x3 -> 4x4 -> 2x2 順序輪播切換)
  const handleCycleSize = (widgetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWidgets(prev => prev.map(w => {
      if (w.id !== widgetId) return w;

      // 💡 上次閱讀專屬：4*1 -> 4*2 -> 4*3 -> 4*4 (4本書) -> 4*4 (經文進度) -> 4*1
      if (w.type === 'lastread_4x2' || w.type === 'lastread_excerpt_4x4') {
        if (w.type === 'lastread_4x2') {
          if (w.size === 'size-4x1') return { ...w, size: 'size-4x2' };
          if (w.size === 'size-4x2') return { ...w, size: 'size-4x3' };
          if (w.size === 'size-4x3') return { ...w, size: 'size-4x4' };
          if (w.size === 'size-4x4') {
            // 從 4x4 (4本書) 切換至 4x4 (經文進度卡片)
            return { ...w, type: 'lastread_excerpt_4x4', size: 'size-4x4' };
          }
        } else if (w.type === 'lastread_excerpt_4x4') {
          // 從 4x4 (經文進度卡片) 循環回到 4x1 (1本書)
          return { ...w, type: 'lastread_4x2', size: 'size-4x1' };
        }
      }

      const allowed = ALLOWED_SIZES_BY_TYPE[w.type] || ['size-4x1', 'size-4x2', 'size-2x2'];
      // 依 PREFERRED_SIZE_CYCLE_ORDER 嚴格排序
      const sortedAllowed = [...allowed].sort((a, b) => {
        const idxA = PREFERRED_SIZE_CYCLE_ORDER.indexOf(a);
        const idxB = PREFERRED_SIZE_CYCLE_ORDER.indexOf(b);
        return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
      });
      const curIdx = sortedAllowed.indexOf(w.size);
      const nextIdx = (curIdx + 1) % sortedAllowed.length;
      return { ...w, size: sortedAllowed[nextIdx] };
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

  // 套用預設版面 (暫時保留供未來範本使用)
  const handleApplyPreset = (preset: HomeLayoutPreset) => {
    const presetItems = JSON.parse(JSON.stringify(PRESET_LAYOUTS[preset] || PRESET_LAYOUTS.default));
    setWidgets(presetItems);
    onSaveSettings({
      ...settings,
      homeLayoutPreset: preset,
      homeWidgets: presetItems
    });
  };
  void handleApplyPreset;

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

  // === 長按卡片 2-3 秒自動進入自訂首頁排版 (圖4/圖5) ===
  const longPressTimerRef = useRef<any>(null);
  const longPressTriggeredRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const startLongPress = (e: React.TouchEvent | React.MouseEvent) => {
    if (isLayoutEditMode) return;
    longPressTriggeredRef.current = false;

    if ('touches' in e && e.touches.length > 0) {
      touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if ('clientX' in e) {
      touchStartPosRef.current = { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
    }

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    // 2 秒（2000ms）長按觸發自訂首頁排版
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([40, 60, 40]);
        } catch (_) {}
      }
      setIsLayoutEditMode(true);
    }, 2000);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  const checkMoveLongPress = (e: React.TouchEvent | React.MouseEvent) => {
    if (!longPressTimerRef.current || !touchStartPosRef.current) return;
    let currentX = 0;
    let currentY = 0;
    if ('touches' in e && e.touches.length > 0) {
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      currentX = (e as React.MouseEvent).clientX;
      currentY = (e as React.MouseEvent).clientY;
    }
    const dist = Math.hypot(currentX - touchStartPosRef.current.x, currentY - touchStartPosRef.current.y);
    if (dist > 10) {
      cancelLongPress();
    }
  };

  // 閱讀底色清單與循環切換 (若有自訂佛光色則包含在循環內)
  const THEMES_LIST: Array<'ivory' | 'parchment' | 'comfort' | 'ebony'> = ['ivory', 'parchment', 'comfort', 'ebony'];

  const handleCycleTheme = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const curTheme = settings.theme || 'ivory';
    const allThemes: Array<'ivory' | 'parchment' | 'comfort' | 'ebony' | 'custom'> = settings.customThemeColor ? [...THEMES_LIST, 'custom'] : THEMES_LIST;
    const curIdx = allThemes.indexOf(curTheme as any);
    const nextTheme = allThemes[(curIdx + 1) % allThemes.length];
    onSaveSettings({ ...settings, theme: nextTheme });
  };

  const handleSelectTheme = (theme: 'ivory' | 'parchment' | 'comfort' | 'ebony' | 'custom', e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveSettings({ ...settings, theme });
  };

  // 渲染閱讀小圓圈 (微型底色指示器，若有自訂底色則額外呈現專屬自訂修行佛光圓圈)
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
        {settings.customThemeColor && (
          <div
            key="mini-dot-custom"
            className={`mini-theme-dot ${currentTheme === 'custom' ? 'active' : ''}`}
            style={{ backgroundColor: settings.customThemeColor }}
            onClick={(e) => handleSelectTheme('custom', e)}
            title="閱讀底色：自訂修行佛光"
          />
        )}
      </div>
    );
  };

  // 💡 4x4 經文進度卡片：當前選中經書索引 (0 ~ 8，最多9本) 與經文段落文字快取
  const [selectedExcerptIndex, setSelectedExcerptIndex] = useState<number>(0);
  const [excerptCache, setExcerptCache] = useState<Record<string, string>>({});

  useEffect(() => {
    const list = resumeBooks.length > 0 ? resumeBooks : DEMO_PREVIEW_RESUME;
    const maxCount = Math.min(list.length, 9);
    if (maxCount === 0) return;

    const safeIdx = selectedExcerptIndex < maxCount ? selectedExcerptIndex : 0;
    const targetItem = list[safeIdx];
    if (!targetItem) return;

    const workId = targetItem.book.workId;
    if (excerptCache[workId]) return;

    // 1. 若 progress 中已內建儲存 text，直接使用
    if (targetItem.progress?.text) {
      setExcerptCache(prev => ({ ...prev, [workId]: targetItem.progress.text }));
      return;
    }

    // 2. 若 progress 尚無 text，嘗試從 localStorage 取
    try {
      const stored = localStorage.getItem(`reader_progress_${workId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.text) {
          setExcerptCache(prev => ({ ...prev, [workId]: parsed.text }));
          return;
        }
      }
    } catch {}

    // 3. 非同步從 IndexedDB getBook 讀取段落文字
    let cancelled = false;
    getBook(workId).then(pkg => {
      if (cancelled || !pkg || !pkg.content || !pkg.content.juans) return;
      const targetJuanNum = targetItem.progress?.juan || 1;
      const juan = pkg.content.juans.find(j => j.juan === targetJuanNum) || pkg.content.juans[0];
      if (!juan || !juan.segments || juan.segments.length === 0) return;

      const targetSegId = targetItem.progress?.segmentId;
      const segIdx = targetSegId ? juan.segments.findIndex(s => s.id === targetSegId) : 0;
      const startIdx = segIdx !== -1 ? segIdx : 0;
      const text = juan.segments.slice(startIdx, startIdx + 5).map(s => s.content.trim()).filter(Boolean).join('\n\n');
      if (text && !cancelled) {
        setExcerptCache(prev => ({ ...prev, [workId]: text }));
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [resumeBooks, selectedExcerptIndex, excerptCache]);

  // 渲染各類型小工具組件
  const renderWidgetContent = (widget: HomeWidgetConfig) => {
    const { type, size, id } = widget;
    const isPreview = id === 'preview-instance';

    // 💡 預覽展示優先：無實際閱讀或下載紀錄時自動套用 CBETA 官方經典示範資料，確保長條Bar與各規格真實排版完全可見
    const effectiveResumeBooks = (isPreview && resumeBooks.length === 0) ? DEMO_PREVIEW_RESUME : resumeBooks;
    const effectiveDownloadedBooks = (isPreview && downloadedBooks.length === 0) ? DEMO_PREVIEW_RESUME.map(d => d.book) : downloadedBooks;
    const effectiveHighlightsCount = (isPreview && allHighlights.length === 0) ? 12 : allHighlights.length;

    // 💡 🌟 上次閱讀 · 經文進度 (4x4 規格，上部分 4x1 維持圖1樣式，下部分 4x3 經文文字，外置標題列支援 < > 選擇最多 9 本經書)
    const renderLastReadExcerptCard = () => {
      const maxCount = Math.min(effectiveResumeBooks.length, 9);
      if (maxCount === 0) {
        return (
          <>
            <div 
              className="widget-outside-header-row"
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
              title="點擊進入書櫃「上次閱讀」"
            >
              <div className="widget-outside-tag">上次閱讀 ➔</div>
              <div className="widget-outside-badge">共 0 部</div>
            </div>
            <div 
              className="lastread-excerpt-card-4x4 empty"
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="lastread-excerpt-empty-text">
                📖 尚無閱讀進度（進入書櫃點選經文開始閱讀）
              </div>
            </div>
          </>
        );
      }

      const safeIndex = selectedExcerptIndex < maxCount ? selectedExcerptIndex : 0;
      const currentBook = effectiveResumeBooks[safeIndex] || effectiveResumeBooks[0];

      const handleContinueRead = () => {
        if (!isLayoutEditMode && currentBook) {
          onSelectBook(currentBook.book.workId, currentBook.progress?.segmentId, undefined, 'resume');
        }
      };

      const cachedText = excerptCache[currentBook.book.workId];
      const rawText = cachedText || currentBook.progress?.text || '如是我聞。一時佛在忉利天，為母說法。爾時十方無量世界，不可說不可說一切諸佛，及大菩薩摩訶薩，皆來集會。讚歎釋迦牟尼佛，能於五濁惡世，現不可思議大智慧神通之力，調伏剛強眾生，知苦樂法……';
      const cleanText = rawText.replace(/^[…\s]+/, '').replace(/[…\s]+$/, '');
      const excerptText = `… ${cleanText} …`;

      return (
        <>
          {/* 卡片外、上方加上「上次閱讀→」，右邊為「<」「>」切換按鍵與「共 X 部」徽章 */}
          <div 
            className="widget-outside-header-row"
            onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
            style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            title="點擊進入書櫃「上次閱讀」"
          >
            <div className="widget-outside-tag">上次閱讀 ➔</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {maxCount > 1 && (
                <div 
                  className="excerpt-nav-btn-group" 
                  onClick={(e) => e.stopPropagation()}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <button 
                    type="button" 
                    className="excerpt-nav-btn" 
                    title="切換上一部經書預覽"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedExcerptIndex(prev => (prev - 1 + maxCount) % maxCount);
                    }}
                  >
                    <ChevronLeft size={13} strokeWidth={2.4} />
                  </button>
                  <button 
                    type="button" 
                    className="excerpt-nav-btn" 
                    title="切換下一部經書預覽"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedExcerptIndex(prev => (prev + 1) % maxCount);
                    }}
                  >
                    <ChevronRight size={13} strokeWidth={2.4} />
                  </button>
                </div>
              )}
              <div className="widget-outside-badge">共 {maxCount} 部</div>
            </div>
          </div>

          <div className="lastread-excerpt-card-4x4">
            {/* 上部分 4*1：維持如圖1樣式（經號徽章 + 經名與作譯者 + 圓形「➔」按鈕） */}
            <div 
              className="lastread-excerpt-header-4x1"
              onClick={handleContinueRead}
              title="點擊繼續閱讀"
            >
              <div className="lastread-excerpt-header-left">
                <div 
                  className="book-badge" 
                  style={{ background: getBookCoverGradient(currentBook.book.workId) }}
                >
                  {currentBook.book.workId}
                </div>
                <div className="book-info">
                  <div className="b-title" title={currentBook.book.title}>
                    {currentBook.book.title}
                  </div>
                  <div className="b-sub">
                    {currentBook.progress?.juan ? `第 ${currentBook.progress.juan} 卷` : (currentBook.book.juansCount ? `全 ${currentBook.book.juansCount} 卷` : '閱讀中')}
                    {currentBook.book.creators ? ` · ${sanitizeCreators(currentBook.book.creators)}` : ''}
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                className="cbeta-read-btn" 
                title="繼續閱讀"
                onClick={(e) => {
                  e.stopPropagation();
                  handleContinueRead();
                }}
              >
                <ArrowRight size={17} strokeWidth={2.4} />
              </button>
            </div>

            {/* 下部分 4*3：直接是上次閱讀到的經文文字（16px、宋/明體、間距1.8，隨四大主題色變更，閱讀預覽不顯示滾動條） */}
            <div 
              className="lastread-excerpt-body-4x3"
              onClick={handleContinueRead}
              title="點擊從上次讀到的段落繼續閱讀"
            >
              <div className="lastread-excerpt-content">
                {excerptText}
              </div>
            </div>
          </div>
        </>
      );
    };

    switch (type) {
      // 1. 品牌標題組件 (title_4x2 / title_4x1)
      case 'title_4x2':
      case 'title_4x1': {
        if (size === 'size-2x2') {
          // 💡 2x2：cbeta 在上，reader 在下，小圓圈放在最下方置中
          return (
            <div 
              className="widget-title-2x2"
              onClick={!isLayoutEditMode ? handleCycleTheme : undefined}
              title="點擊切換閱讀底色"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="title-center-content-2x2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h2 className="title-brand-heading" style={{ fontFamily: 'var(--font-rounded)', fontSize: '1.45rem', fontWeight: 800, margin: 0, lineHeight: 1.15, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: 'var(--theme-accent, #1ea98c)' }}>CBETA</span>
                  <span className="title-brand-text" style={{ marginTop: '0.2rem' }}>Reader</span>
                </h2>
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
                <div className="core-sub">共{effectiveDownloadedBooks.length}本書</div>
              </div>

              {/* 3. 我的筆記 */}
              <div 
                className="core-widget-card-embedded"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
                title="我的筆記"
              >
                <div className="core-icon-box">
                  <Notebook size={20} color="#ffffff" />
                </div>
                <div className="core-title">我的筆記</div>
                <div className="core-sub">共{effectiveHighlightsCount}則筆記</div>
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
                <div className="compact-nav-badge-4x2">從cbeta下載</div>
              </div>

              {/* 2. 我的書櫃 */}
              <div 
                className="compact-nav-item-4x2"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('shelf') : undefined}
                title="我的書櫃"
              >
                <div className="compact-nav-icon-4x2">
                  <Folder size={20} color="#ffffff" />
                </div>
                <div className="compact-nav-label-4x2">我的書櫃</div>
                <div className="compact-nav-badge-4x2">{effectiveDownloadedBooks.length} 本</div>
              </div>

              {/* 3. 我的筆記 */}
              <div 
                className="compact-nav-item-4x2"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
                title="我的筆記"
              >
                <div className="compact-nav-icon-4x2">
                  <Notebook size={20} color="#ffffff" />
                </div>
                <div className="compact-nav-label-4x2">我的筆記</div>
                <div className="compact-nav-badge-4x2">{effectiveHighlightsCount} 則</div>
              </div>

              {/* 4. 全文檢索 */}
              <div 
                className="compact-nav-item-4x2"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('search') : undefined}
                title="已下載經文搜尋"
              >
                <div className="compact-nav-icon-4x2">
                  <Search size={20} color="#ffffff" style={{ strokeWidth: 2.4 }} />
                </div>
                <div className="compact-nav-label-4x2">全文檢索</div>
                <div className="compact-nav-badge-4x2">關鍵字搜尋</div>
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

              {/* 3. 左下：我的筆記 */}
              <div 
                className="compact-nav-item-2x2"
                onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
                title="我的筆記"
              >
                <div className="compact-nav-icon-2x2">
                  <Notebook size={14} color="#ffffff" />
                </div>
                <div className="compact-nav-label-2x2">我的筆記</div>
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

        // 💡 圖2：4x1 橫排版 (順序：下載經典 → 我的書櫃 → 我的筆記 → 全文檢索，直接跳轉無左右動畫)
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
              title="我的筆記"
            >
              <div className="compact-nav-icon">
                <Notebook size={16} color="#ffffff" />
              </div>
              <div className="compact-nav-label">我的筆記</div>
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
                  <div className="core-sub">已收錄 {effectiveDownloadedBooks.length} 部已下載經典與自訂分類</div>
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
            <div className="core-sub">共{effectiveDownloadedBooks.length}本書</div>
          </div>
        );
      }

      // 6. 核心大卡：我的筆記 (2x2 / 4x1 / 4x2)
      case 'notes_2x2': {
        if (size === 'size-4x1') {
          return (
            <div 
              className="core-widget-4x1"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
              title="我的筆記"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="core-widget-4x1-left">
                <div className="core-icon-box-4x1">
                  <Notebook size={15} color="#ffffff" />
                </div>
                <div className="core-info-4x1">
                  <span className="core-title-4x1">我的筆記</span>
                  <span className="core-count-badge">{effectiveHighlightsCount}</span>
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
              title="我的筆記"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="core-widget-4x2-left">
                <div className="core-icon-box">
                  <Notebook size={22} color="#ffffff" />
                </div>
                <div>
                  <div className="core-title">我的筆記</div>
                  <div className="core-sub">已累積 {effectiveHighlightsCount} 條劃線重點與個人心得</div>
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
            title="我的筆記"
          >
            <div className="core-icon-box">
              <Notebook size={20} color="#ffffff" />
            </div>
            <div className="core-title">我的筆記</div>
            <div className="core-sub">共{effectiveHighlightsCount}則筆記</div>
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



      // 8-0. 🌟 上次閱讀 · 經文進度獨立組件 (4x4 規格)
      case 'lastread_excerpt_4x4': {
        return renderLastReadExcerptCard();
      }

      // 8. 上次閱讀 (支援 4x1 / 4x2 / 4x3 / 4x4 共 1~4 本經典)
      case 'lastread_4x2':
      case 'lastread_4x1': {
        const lastBook = effectiveResumeBooks[0];
        if (!lastBook) {
          if (size === 'size-4x2' || size === 'size-4x1') {
            return (
              <>
                <div 
                  className="widget-outside-header-row"
                  onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
                  style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                  title="點擊進入書櫃「上次閱讀」"
                >
                  <div className="widget-outside-tag">上次閱讀 ➔</div>
                  <div className="widget-outside-badge">共 0 部</div>
                </div>
                <div className={`book-widget-card-box box-${size.replace('size-', '')}`} style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>上次閱讀：尚無閱讀進度</span>
                </div>
              </>
            );
          }
          return (
            <div className="lastread-4x1" style={{ justifyContent: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>上次閱讀：尚無閱讀進度</span>
            </div>
          );
        }

        // 💡 4x2 (2部) 與 4x1 (1部)：外置標題列 + 卡片本體 (下緣完美不切邊，左右 100% 垂直對齊 4x3)
        if (size === 'size-4x2' || size === 'size-4x1') {
          const count = size === 'size-4x2' ? 2 : 1;
          const displayResumeBooks = effectiveResumeBooks.slice(0, count);
          return (
            <>
              {/* 1. 卡片外面的上方標題列 */}
              <div 
                className="widget-outside-header-row"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「上次閱讀」"
              >
                <div className="widget-outside-tag">上次閱讀 ➔</div>
                <div className="widget-outside-badge">共 {Math.min(effectiveResumeBooks.length, 9)} 部</div>
              </div>

              {/* 2. 卡片本體 (4x2 高度 148px 放 2 本書；4x1 高度 68px 放 1 本書) */}
              <div className={`book-widget-card-box box-${size.replace('size-', '')}`}>
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
            </>
          );
        }

        // 💡 4x3 (3部) / 4x4 (4部) 規格 (4本書)
        const maxResume = size === 'size-4x4' ? 4 : 3;
        const displayResumeBooks = effectiveResumeBooks.slice(0, maxResume);
        return (
          <div className={`book-list-widget-multi multi-${size.replace('size-', '')}`}>
            <div 
              className="widget-header-row-4x4"
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
              title="點擊進入書櫃「上次閱讀」"
            >
              <div className="widget-tag-4x4">上次閱讀 ➔</div>
              <div className="widget-count-badge-4x4">共 {Math.min(effectiveResumeBooks.length, 9)} 部</div>
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
        const actualFavs = downloadedBooks.filter(b => favoriteWorkIds.includes(b.workId));
        const favoriteBooks = (isPreview && actualFavs.length === 0) ? DEMO_PREVIEW_RESUME.map(d => d.book) : actualFavs;

        if (favoriteBooks.length === 0) {
          if (size === 'size-4x2' || size === 'size-4x1') {
            return (
              <>
                <div 
                  className="widget-outside-header-row"
                  onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
                  style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                  title="點擊進入書櫃「我的最愛」"
                >
                  <div className="widget-outside-tag">我的最愛 ➔</div>
                  <div className="widget-outside-badge">共 0 部</div>
                </div>
                <div className={`book-widget-card-box box-${size.replace('size-', '')}`} style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>我的最愛：尚未收藏任何經典 (點擊進入書櫃)</span>
                </div>
              </>
            );
          }
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

        // 💡 4x2 (2部) 與 4x1 (1部)：外置標題列 + 卡片本體 (下緣完美不切邊，左右 100% 垂直對齊 4x3)
        if (size === 'size-4x2' || size === 'size-4x1') {
          const count = size === 'size-4x2' ? 2 : 1;
          const displayFavs = favoriteBooks.slice(0, count);
          return (
            <>
              {/* 1. 卡片外面的上方標題列 */}
              <div 
                className="widget-outside-header-row"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「我的最愛」"
              >
                <div className="widget-outside-tag">我的最愛 ➔</div>
                <div className="widget-outside-badge">共 {favoriteBooks.length} 部</div>
              </div>

              {/* 2. 卡片本體 (4x2 高度 148px 放 2 本書；4x1 高度 68px 放 1 本書) */}
              <div className={`book-widget-card-box box-${size.replace('size-', '')}`}>
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
            </>
          );
        }

        // 💡 4x3 (3部) / 4x4 (4部) 規格
        const maxFavs = size === 'size-4x3' ? 3 : 4;
        const displayFavs = favoriteBooks.slice(0, maxFavs);
        return (
          <div className={`book-list-widget-multi multi-${size.replace('size-', '')}`}>
            <div 
              className="widget-header-row-4x4"
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
              title="點擊進入書櫃「我的最愛」"
            >
              <div className="widget-tag-4x4">我的最愛 ➔</div>
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

      // 8-2. 新增「近期下載」卡片 (4x2 / 4x1 / 4x3 / 4x4)
      case 'recent_downloads_4x2': {
        const actualRecent = [...downloadedBooks].reverse();
        const recentDownloadedBooks = (isPreview && actualRecent.length === 0) ? DEMO_PREVIEW_RESUME.map(d => d.book) : actualRecent;

        if (recentDownloadedBooks.length === 0) {
          if (size === 'size-4x2' || size === 'size-4x1') {
            return (
              <>
                <div 
                  className="widget-outside-header-row"
                  onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
                  style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                  title="點擊進入書櫃「近期下載」"
                >
                  <div className="widget-outside-tag">近期下載 ➔</div>
                  <div className="widget-outside-badge">共 0 部</div>
                </div>
                <div className={`book-widget-card-box box-${size.replace('size-', '')}`} style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>近期下載：暫無已下載經典 (點擊進入書櫃)</span>
                </div>
              </>
            );
          }
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

        // 💡 4x2 (2部) 與 4x1 (1部)：外置標題列 + 卡片本體 (下緣完美不切邊，左右 100% 垂直對齊 4x3)
        if (size === 'size-4x2' || size === 'size-4x1') {
          const count = size === 'size-4x2' ? 2 : 1;
          const displayRecent = recentDownloadedBooks.slice(0, count);
          return (
            <>
              {/* 1. 卡片外面的上方標題列 */}
              <div 
                className="widget-outside-header-row"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「近期下載」"
              >
                <div className="widget-outside-tag">近期下載 ➔</div>
                <div className="widget-outside-badge">共 {Math.min(recentDownloadedBooks.length, 9)} 部</div>
              </div>

              {/* 2. 卡片本體 (4x2 高度 148px 放 2 本書；4x1 高度 68px 放 1 本書) */}
              <div className={`book-widget-card-box box-${size.replace('size-', '')}`}>
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
            </>
          );
        }

        // 💡 4x3 (3部) / 4x4 (4部) 規格
        const maxRecent = size === 'size-4x3' ? 3 : 4;
        const displayRecent = recentDownloadedBooks.slice(0, maxRecent);
        return (
          <div className={`book-list-widget-multi multi-${size.replace('size-', '')}`}>
            <div 
              className="widget-header-row-4x4"
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
              title="點擊進入書櫃「近期下載」"
            >
              <div className="widget-tag-4x4">近期下載 ➔</div>
              <div className="widget-count-badge-4x4">共 {Math.min(recentDownloadedBooks.length, 9)} 部</div>
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

        // 4x1 橫條版 (5 個顏色圓圈：4 個經典主題 + 1 個自訂色，移除文字)
        return (
          <div className="theme-palette-4x1">
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)' }}>閱讀底色:</span>
            <div 
              className={`theme-ball ball-ivory ${settings.theme === 'ivory' ? 'active' : ''}`}
              onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'ivory' }) : undefined}
              title="象牙白"
            />
            <div 
              className={`theme-ball ball-parchment ${settings.theme === 'parchment' ? 'active' : ''}`}
              onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'parchment' }) : undefined}
              title="羊皮紙"
            />
            <div 
              className={`theme-ball ball-comfort ${settings.theme === 'comfort' ? 'active' : ''}`}
              onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'comfort' }) : undefined}
              title="舒服綠"
            />
            <div 
              className={`theme-ball ball-ebony ${settings.theme === 'ebony' ? 'active' : ''}`}
              onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'ebony' }) : undefined}
              title="烏木黑"
            />
            <div 
              className={`theme-ball ball-custom ${settings.theme === 'custom' ? 'active' : ''}`}
              style={{ backgroundColor: settings.customThemeColor || '#ebdcd9' }}
              onClick={!isLayoutEditMode ? () => onSaveSettings({ ...settings, theme: 'custom', customThemeColor: settings.customThemeColor || '#ebdcd9' }) : undefined}
              title="自訂底色"
            />
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

  // 💡 取得當前扁平巡覽項目與對應之大類別
  const currentItem = FLAT_GALLERY_ITEMS[galleryIndex] || FLAT_GALLERY_ITEMS[0];
  const activeCategory = currentItem.category;

  // 切換大類別（直接跳至該大類別的第一個小工具）
  const handleSelectCategory = (catId: WidgetCategoryId) => {
    const targetIdx = FLAT_GALLERY_ITEMS.findIndex(item => item.category === catId);
    if (targetIdx !== -1) {
      setGalleryIndex(targetIdx);
    }
  };

  // 💡 按「<」切換上一個小工具（跨類別與尺寸全流程巡覽）
  const handlePrevWidget = () => {
    setGalleryIndex(prev => (prev - 1 + FLAT_GALLERY_ITEMS.length) % FLAT_GALLERY_ITEMS.length);
  };

  // 💡 按「>」切換下一個小工具（跨類別與尺寸全流程巡覽）
  const handleNextWidget = () => {
    setGalleryIndex(prev => (prev + 1) % FLAT_GALLERY_ITEMS.length);
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
              className={`widget-card ${widget.size} ${isBookWidgetOuterHeader(widget.type, widget.size) ? 'has-outer-header' : ''} ${widget.type === 'appicon_2x2' ? 'zen-icon-no-pad' : ''} ${widget.type === 'download_2x2' && widget.size === 'size-4x1' ? 'download-dashed-card-4x1' : ''} ${widget.type === 'four_nav_4x1' && widget.size === 'size-4x2' ? 'four-nav-card-4x2' : ''} ${isDragging ? 'is-dragging' : ''} ${isOver ? 'drag-over-indicator' : ''}`}
              draggable={isLayoutEditMode}
              onDragStart={(e) => handleDragStart(e, widget.id)}
              onDragOver={(e) => handleDragOver(e, widget.id)}
              onDragLeave={(e) => handleDragLeave(e, widget.id)}
              onDrop={(e) => handleDrop(e, widget.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => {
                if (isLayoutEditMode) {
                  handleTouchStart(widget.id, e);
                } else {
                  startLongPress(e);
                }
              }}
              onTouchMove={(e) => {
                if (!isLayoutEditMode) {
                  checkMoveLongPress(e);
                }
              }}
              onTouchEnd={() => {
                if (isLayoutEditMode) {
                  handleTouchEnd();
                } else {
                  cancelLongPress();
                }
              }}
              onTouchCancel={() => {
                if (!isLayoutEditMode) {
                  cancelLongPress();
                }
              }}
              onMouseDown={(e) => {
                if (!isLayoutEditMode && e.button === 0) {
                  startLongPress(e);
                }
              }}
              onMouseMove={(e) => {
                if (!isLayoutEditMode) {
                  checkMoveLongPress(e);
                }
              }}
              onMouseUp={() => {
                if (!isLayoutEditMode) {
                  cancelLongPress();
                }
              }}
              onMouseLeave={() => {
                if (!isLayoutEditMode) {
                  cancelLongPress();
                }
              }}
              onClickCapture={(e) => {
                if (longPressTriggeredRef.current) {
                  e.stopPropagation();
                  e.preventDefault();
                  setTimeout(() => {
                    longPressTriggeredRef.current = false;
                  }, 350);
                }
              }}
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
            onClick={() => {
              setIsLayoutEditMode(true);
              const scrollToTop = () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                const scrollContainers = document.querySelectorAll(
                  '.library-content-area, .home-dashboard-container, .home-custom-dashboard-wrapper, html, body'
                );
                scrollContainers.forEach(el => el.scrollTo({ top: 0, behavior: 'smooth' }));
              };
              scrollToTop();
              setTimeout(scrollToTop, 60);
              setTimeout(scrollToTop, 180);
            }}
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

            {/* 4. 預設範本快捷選單 (暫時隱藏) */}
            {/* <div className="ios-gallery-presets-bar">
              <span className="presets-label">範本:</span>
              <button type="button" className="preset-pill-btn" onClick={() => { handleApplyPreset('default'); setIsGalleryOpen(false); }}>經典原味</button>
              <button type="button" className="preset-pill-btn" onClick={() => { handleApplyPreset('compact'); setIsGalleryOpen(false); }}>極簡精巧</button>
              <button type="button" className="preset-pill-btn" onClick={() => { handleApplyPreset('focus'); setIsGalleryOpen(false); }}>每日精進</button>
              <button type="button" className="preset-pill-btn" onClick={() => { handleApplyPreset('zen'); setIsGalleryOpen(false); }}>禪修護眼</button>
            </div> */}

            {/* 5. 單層直接預覽主舞台 (全依「<」「>」巡覽所有小工具及尺寸) */}
            <div className="ios-gallery-preview-stage custom-scrollbar">
              {/* 💡 提到圖2視窗框外的上面：尺寸徽章 (黑色字 / 淺灰方框) */}
              <div className="ios-preview-badge-header">
                <span className="preview-size-badge-outer">
                  {currentItem.sizeLabel}
                </span>
              </div>

              {/* 💡 Preview Showcase Box with < and > Navigation (按鈕再小一點，中間視窗框上下左右再加大) */}
              <div className="ios-preview-showcase-row">
                <button
                  type="button"
                  className="ios-preview-nav-arrow-btn prev"
                  onClick={handlePrevWidget}
                  title="切換上一個小工具"
                >
                  <ChevronLeft size={14} strokeWidth={2.4} />
                </button>

                <div className="ios-live-preview-viewport">
                  {/* 等比自我縮放容器 (視窗框維持固定大小) */}
                  <div className={`preview-card-stage-container scale-${currentItem.size.replace('size-', '')}`}>
                    <div className={`widget-card preview-card-mode ${currentItem.size} ${isBookWidgetOuterHeader(currentItem.type, currentItem.size) ? 'has-outer-header' : ''} ${currentItem.type === 'appicon_2x2' ? 'zen-icon-no-pad' : ''} ${currentItem.type === 'download_2x2' && currentItem.size === 'size-4x1' ? 'download-dashed-card-4x1' : ''}`}>
                      {renderWidgetContent({
                        id: 'preview-instance',
                        type: currentItem.type,
                        size: currentItem.size,
                        iconIndex: previewIconIndex
                      })}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="ios-preview-nav-arrow-btn next"
                  onClick={handleNextWidget}
                  title="切換下一個小工具"
                >
                  <ChevronRight size={14} strokeWidth={2.4} />
                </button>
              </div>

              {/* 💡 Bottom Action Button (直接加入主頁) */}
              <div className="ios-preview-bottom-action">
                <button
                  type="button"
                  className="ios-add-widget-confirm-btn"
                  onClick={() => handleAddWidget(currentItem.type, currentItem.size, previewIconIndex)}
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
