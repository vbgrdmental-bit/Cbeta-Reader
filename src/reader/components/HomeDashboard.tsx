import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Folder, Notebook, ChevronRight, ChevronLeft, Check, X,
  Maximize2, Sliders, CalendarDays, ArrowRight, Download, Clock, Heart,
  RotateCcw, FileText, Timer, BookOpen
} from 'lucide-react';
import type { BookMetadata } from '../../types/book';
import { 
  getBook, 
  getAllReadingLogs, 
  type ReadingLogEntry,
  getAllPracticeLogs,
  savePracticeLog,
  type PracticeLogEntry,
  type PracticeCategoryConfig,
  getPracticeCategories
} from '../../utils/db';
import type { AppSettings, BookHighlight } from '../../utils/db';
import { getRecentDownloadedBooks } from '../../utils/recentDownloads';
import { getRecentFavoriteBooks } from '../../utils/favoritesManager';
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
import { getLunarInfo } from '../../utils/lunarCalendar';

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

// 💡 檢查是否為經書外置標題小工具 (上次閱讀之 4x2、4x1，經文進度 4x4，三合一卡 4x4，我的最愛、近期下載之 4x2 與 4x1 規格)
const isBookWidgetOuterHeader = (type: string, size: string) => 
  ((type === 'lastread_4x2' || type === 'lastread_4x1') && (size === 'size-4x2' || size === 'size-4x1')) ||
  ((type === 'favorites_4x2' || type === 'recent_downloads_4x2') && (size === 'size-4x2' || size === 'size-4x1')) ||
  (type === 'lastread_excerpt_4x4') ||
  (type === 'triple_reading_4x4');

// 💡 快捷功能卡片之預設按鍵（圖1預設 10 個格子配置：左上角固定為 CBETA Reader，允許空格）
export const DEFAULT_QUICK_NAV_BUTTONS: string[] = [
  'brand_title',       // 1 (固定)
  'shelf',             // 2 我的書櫃
  'notes',             // 3 我的筆記
  'search',            // 4 全文檢索
  'theme_color',       // 5 自訂色
  'download',          // 6 下載經典
  'recent_downloads',  // 7 近期下載
  'last_read',         // 8 上次閱讀
  'favorites',         // 9 我的最愛
  'stats'              // 10 閱讀日誌
];

// 💡 4x2 快捷卡固定 10 格規格規格化（左上角固定 brand_title，允許空格 'empty'）
export const normalizeQuickNav10Buttons = (buttons?: (string | null | undefined)[]): string[] => {
  const result: string[] = Array(10).fill('empty');
  result[0] = 'brand_title';
  if (!buttons || buttons.length === 0) {
    return [...DEFAULT_QUICK_NAV_BUTTONS];
  }
  for (let i = 0; i < 10; i++) {
    if (i === 0) {
      result[0] = 'brand_title';
    } else if (i < buttons.length && buttons[i]) {
      result[i] = buttons[i] === 'brand_title' ? 'empty' : (buttons[i] || 'empty');
    } else {
      result[i] = 'empty';
    }
  }
  return result;
};

// 💡 下載與書櫃卡之預設快捷按鍵（左邊第 1 個固定為 CBETA Reader 圖4）
export const DEFAULT_SHELF_NAV_BUTTONS_4X2: string[] = [
  'brand_title',
  'recent_downloads',
  'last_read',
  'favorites'
];
export const DEFAULT_SHELF_NAV_BUTTONS_4X3: string[] = [
  'brand_title',
  'recent_downloads',
  'last_read',
  'favorites'
];

// 💡 確保「CBETA Reader」圖4固定為第 1 格且不重複
export const ensureBrandFirst = (buttons?: string[]): string[] => {
  if (!buttons || buttons.length === 0) return ['brand_title'];
  const filtered = buttons.filter(k => k !== 'brand_title');
  return ['brand_title', ...filtered];
};

// 💡 讀者可自由替換/加入之所有按鍵功能池
export const AVAILABLE_NAV_BUTTON_KEYS: string[] = [
  'download',
  'recent_downloads',
  'last_read',
  'favorites',
  'shelf',
  'notes',
  'search',
  'stats',
  'theme_color',
  'timer',
  'zen_icon',
  'brand_title'
];



export const QUICK_NAV_BUTTON_DEFS: Record<string, { name: string; gradient: string; actionTitle: string }> = {
  download: {
    name: '下載經典',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    actionTitle: '前往 CBETA 藏經庫下載經典'
  },
  recent_downloads: {
    name: '近期下載',
    gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    actionTitle: '查看近期下載經典'
  },
  last_read: {
    name: '上次閱讀',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    actionTitle: '接續上次閱讀經典'
  },
  favorites: {
    name: '我的最愛',
    gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)',
    actionTitle: '查看收藏之最愛經典'
  },
  shelf: {
    name: '我的書櫃',
    gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)',
    actionTitle: '直達個人經文書櫃'
  },
  notes: {
    name: '我的筆記',
    gradient: 'linear-gradient(135deg, #059669, #047857)',
    actionTitle: '查看劃線重點與個人筆記'
  },
  search: {
    name: '全文檢索',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    actionTitle: '已下載經典全文檢索'
  },
  stats: {
    name: '閱讀日誌',
    gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    actionTitle: '查看每日閱讀時數與日誌'
  },
  theme_color: {
    name: '主題顏色',
    gradient: 'linear-gradient(135deg, #fefcf8, #e8efe6)',
    actionTitle: '切換閱讀底色 (象牙白→羊皮紙→舒服綠→烏木黑→自訂色)'
  },
  fulltext: {
    name: '全文檢索',
    gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
    actionTitle: '已下載經典全文檢索'
  },
  timer: {
    name: '倒數計時',
    gradient: 'linear-gradient(135deg, #ea580c, #c2410c)',
    actionTitle: '啟動或取消護眼計時'
  },
  zen_icon: {
    name: '主題小卡 (圖片)',
    gradient: 'linear-gradient(135deg, #8c4b27, #6a3418)',
    actionTitle: '點擊輪播切換禪意圖標'
  },
  brand_title: {
    name: 'CBETA Reader',
    gradient: 'linear-gradient(135deg, #3d3530, #221d1a)',
    actionTitle: 'CBETA 經典首頁 (連續點 2 下自訂快捷功能)'
  }
};

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
  { id: 'n_download_shelf_4x2', type: 'download_shelf_4x3', size: 'size-4x2', sizeLabel: '4×2', category: 'nav', title: '下載與書櫃' },
  { id: 'n_shelf_quick_4x2', type: 'shelf_quick_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'nav', title: '書櫃快捷' },
  { id: 'n_system_nav_4x2', type: 'system_nav_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'nav', title: '系統導航' },
  { id: 'n_quick_4x2', type: 'quick_nav_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'nav', title: '快捷功能 (8鍵)' },
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
  { id: 'n_bar_dl_4x1', type: 'bar_dl_4x1', size: 'size-4x1', sizeLabel: '4×1', category: 'nav', title: '下載經典 (長條Bar)' },

  // 3. 我的書櫃 (reading)
  { id: 'r_shelf_bars_4x3', type: 'shelf_bars_4x3', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '書櫃三合一長條卡' },

  { id: 'r_bar_down_4x1', type: 'shelf_down_4x2', size: 'size-4x1', sizeLabel: '4×1', category: 'reading', title: '近期下載 (長條Bar)' },
  { id: 'r_shelf_down_4x2', type: 'shelf_down_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'reading', title: '近期下載 (4本書)' },
  { id: 'r_shelf_down_4x3', type: 'shelf_down_4x2', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '近期下載 (8本書)' },
  { id: 'r_shelf_down_capsule_4x3', type: 'shelf_down_capsule_4x3', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '近期下載 (6膠囊)' },

  { id: 'r_bar_read_4x1', type: 'shelf_read_4x2', size: 'size-4x1', sizeLabel: '4×1', category: 'reading', title: '上次閱讀 (長條Bar)' },
  { id: 'r_shelf_read_4x2', type: 'shelf_read_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'reading', title: '上次閱讀 (4本書)' },
  { id: 'r_shelf_read_4x3', type: 'shelf_read_4x2', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '上次閱讀 (8本書)' },
  { id: 'r_shelf_read_capsule_4x3', type: 'shelf_read_capsule_4x3', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '上次閱讀 (6膠囊)' },

  { id: 'r_bar_fav_4x1', type: 'shelf_fav_4x2', size: 'size-4x1', sizeLabel: '4×1', category: 'reading', title: '我的最愛 (長條Bar)' },
  { id: 'r_shelf_fav_4x2', type: 'shelf_fav_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'reading', title: '我的最愛 (4本書)' },
  { id: 'r_shelf_fav_4x3', type: 'shelf_fav_4x2', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '我的最愛 (8本書)' },
  { id: 'r_shelf_fav_capsule_4x3', type: 'shelf_fav_capsule_4x3', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '我的最愛 (6膠囊)' },
  { id: 'r_last_4x1', type: 'lastread_4x2', size: 'size-4x1', sizeLabel: '4×1', category: 'reading', title: '上次閱讀' },
  { id: 'r_last_4x2', type: 'lastread_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'reading', title: '上次閱讀' },
  { id: 'r_last_4x3', type: 'lastread_4x2', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '上次閱讀' },
  { id: 'r_last_4x4', type: 'lastread_4x2', size: 'size-4x4', sizeLabel: '4×4', category: 'reading', title: '上次閱讀 (4本書)' },
  { id: 'r_last_excerpt_4x4', type: 'lastread_excerpt_4x4', size: 'size-4x4', sizeLabel: '4×4', category: 'reading', title: '上次閱讀 (經文進度)' },
  { id: 'r_triple_4x4', type: 'triple_reading_4x4', size: 'size-4x4', sizeLabel: '4×4', category: 'reading', title: '三合一閱讀卡' },

  { id: 'r_fav_4x1', type: 'favorites_4x2', size: 'size-4x1', sizeLabel: '4×1', category: 'reading', title: '我的最愛' },
  { id: 'r_fav_4x2', type: 'favorites_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'reading', title: '我的最愛' },
  { id: 'r_fav_4x3', type: 'favorites_4x2', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '我的最愛' },
  { id: 'r_fav_4x4', type: 'favorites_4x2', size: 'size-4x4', sizeLabel: '4×4', category: 'reading', title: '我的最愛' },

  { id: 'r_down_4x1', type: 'recent_downloads_4x2', size: 'size-4x1', sizeLabel: '4×1', category: 'reading', title: '近期下載' },
  { id: 'r_down_4x2', type: 'recent_downloads_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'reading', title: '近期下載' },
  { id: 'r_down_4x3', type: 'recent_downloads_4x2', size: 'size-4x3', sizeLabel: '4×3', category: 'reading', title: '近期下載' },
  { id: 'r_down_4x4', type: 'recent_downloads_4x2', size: 'size-4x4', sizeLabel: '4×4', category: 'reading', title: '近期下載' },

  { id: 'r_stats_2x2', type: 'stats_2x2', size: 'size-2x2', sizeLabel: '2×2', category: 'reading', title: '每日閱讀日誌' },
  { id: 'r_stats_4x2', type: 'stats_2x2', size: 'size-4x2', sizeLabel: '4×2', category: 'reading', title: '每日閱讀日誌' },

  // 4. 其他功能 (other)
  { id: 'o_timer_4x2', type: 'timer_2x2', size: 'size-4x2', sizeLabel: '4×2', category: 'other', title: '護眼計時器' },
  { id: 'o_timer_2x2', type: 'timer_2x2', size: 'size-2x2', sizeLabel: '2×2', category: 'other', title: '護眼計時器' },
  { id: 'o_theme_4x1', type: 'theme_4x1', size: 'size-4x1', sizeLabel: '4×1', category: 'other', title: '四色主題' },
  { id: 'o_theme_2x2', type: 'theme_4x1', size: 'size-2x2', sizeLabel: '2×2', category: 'other', title: '四色主題' },
  { id: 'o_zen_4x2', type: 'zen_4x2', size: 'size-4x2', sizeLabel: '4×2', category: 'other', title: '佛典精進名句' },
  { id: 'o_cal_banner_4x1', type: 'calendar_banner_4x1', size: 'size-4x1', sizeLabel: '4×1', category: 'other', title: '今日佛曆小卡' },
  { id: 'o_practice_bead_4x1', type: 'practice_bead_4x1', size: 'size-4x1', sizeLabel: '4×1', category: 'other', title: '隨喜撥珠小卡' },

  { id: 'o_memo_4x2', type: 'custom_memo', size: 'size-4x2', sizeLabel: '4×2', category: 'other', title: '自訂便籤卡' },
  { id: 'o_memo_4x3', type: 'custom_memo', size: 'size-4x3', sizeLabel: '4×3', category: 'other', title: '自訂便籤卡' },
  { id: 'o_memo_4x4', type: 'custom_memo', size: 'size-4x4', sizeLabel: '4×4', category: 'other', title: '自訂便籤卡' },
  { id: 'o_memo_2x2', type: 'custom_memo', size: 'size-2x2', sizeLabel: '2×2', category: 'other', title: '自訂便籤卡' },
  { id: 'o_memo_4x1', type: 'custom_memo', size: 'size-4x1', sizeLabel: '4×1', category: 'other', title: '自訂便籤卡' }
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
  },
  {
    book: {
      workId: 'X1487',
      title: '慈悲地藏菩薩懺法',
      canon: 'X',
      creators: '清 智旭修',
      juansCount: 3,
      category: '禮懺部',
      version: '2.9.11'
    },
    progress: { juan: 1, segmentId: 'p0001a01' }
  },
  {
    book: {
      workId: 'Y0013',
      title: '太虛大師年譜',
      canon: 'Y',
      creators: '民國 印順法師編',
      juansCount: 1,
      category: '傳記部',
      version: '2.9.11'
    },
    progress: { juan: 1, segmentId: 'p0001a01' }
  },
  {
    book: {
      workId: 'X0914',
      title: '普賢菩薩發願文',
      canon: 'X',
      creators: '唐 善導大師集',
      juansCount: 1,
      category: '發願部',
      version: '2.9.11'
    },
    progress: { juan: 1, segmentId: 'p0001a01' }
  },
  {
    book: {
      workId: 'X0913',
      title: '天台智者大師發願文',
      canon: 'X',
      creators: '隋 智顗說',
      juansCount: 1,
      category: '發願部',
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

  // 💡 即時監聽我的最愛更新事件（書櫃點選愛心時秒速響應）
  const [, setFavoritesTrigger] = useState(0);
  useEffect(() => {
    const handleFavUpdated = () => {
      setFavoritesTrigger(prev => prev + 1);
    };
    window.addEventListener('cbeta_favorites_updated', handleFavUpdated);
    window.addEventListener('storage', handleFavUpdated);
    return () => {
      window.removeEventListener('cbeta_favorites_updated', handleFavUpdated);
      window.removeEventListener('storage', handleFavUpdated);
    };
  }, []);

  // 💡 iOS Widget Gallery 狀態 (單層扁平化巡覽 + 「<」「>」全流程切換)
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number>(0);
  const [previewIconIndex, setPreviewIconIndex] = useState<number>(1);

  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  // 💡 八合一快捷功能小卡自訂彈窗狀態與拖曳/雙擊偵測
  const [editingNavWidget, setEditingNavWidget] = useState<HomeWidgetConfig | null>(null);
  const [selectedNavSlotIndex, setSelectedNavSlotIndex] = useState<number>(0);
  const [draggedNavSlotIndex, setDraggedNavSlotIndex] = useState<number | null>(null);
  const [dragOverNavSlotIndex, setDragOverNavSlotIndex] = useState<number | null>(null);
  const lastNavTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const lastBrandNavTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const touchSlotStartIdxRef = useRef<number | null>(null);

  // 💡 版面儲存詢問對話框狀態（詢問儲存於當前版型或另存新版型）
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [saveTargetSlot, setSaveTargetSlot] = useState<'custom1' | 'custom2' | 'custom3'>('custom1');
  const [savePresetNameInput, setSavePresetNameInput] = useState<string>('');

  // 護眼計時器即時狀態訂閱
  const [timerState, setTimerState] = useState<ReadingTimerState>(readingTimer.getState());

  // 💡 閱讀日誌即時紀錄（用於 2x2 / 4x2 iOS 月曆小卡即時展示當日讀經摘要）
  const [todayReadingLogs, setTodayReadingLogs] = useState<ReadingLogEntry[]>([]);

  // 取得本地日期字串 "YYYY-MM-DD"（避免 UTC 時區偏差導致午夜 00:00~08:00 判定為前一日）
  const getTodayDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const refreshTodayLogs = () => {
    getAllReadingLogs().then(logs => {
      const todayStr = getTodayDateStr();
      const todayLogs = (logs || []).filter(l => l.date === todayStr);
      // 依閱讀時間由近到遠排序
      todayLogs.sort((a, b) => (b.endTime || b.startTime || 0) - (a.endTime || a.startTime || 0));
      setTodayReadingLogs(todayLogs);
    }).catch(err => {
      console.warn('Failed to load reading logs for widget', err);
    });
  };

  useEffect(() => {
    refreshTodayLogs();
    const handleUpdate = () => refreshTodayLogs();
    window.addEventListener('cbeta_reading_log_saved', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('cbeta_reading_log_saved', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [resumeBooks]);

  // 💡 修持功課即時紀錄與首頁撥珠小卡狀態
  const [todayPracticeLogs, setTodayPracticeLogs] = useState<PracticeLogEntry[]>([]);
  const [practiceCategories, setPracticeCategories] = useState<Record<string, PracticeCategoryConfig>>(() => {
    return getPracticeCategories();
  });
  const [beadCategory, setBeadCategory] = useState<string>(() => {
    return localStorage.getItem('cbeta_home_bead_cat') || 'fo';
  });
  const [beadName, setBeadName] = useState<string>(() => {
    return localStorage.getItem('cbeta_home_bead_name') || '南無阿彌陀佛';
  });
  const [showBeadCatMenu, setShowBeadCatMenu] = useState(false);
  const [showBeadMidMenu, setShowBeadMidMenu] = useState(false);
  const [beadTapAnim, setBeadTapAnim] = useState(false);


  const refreshPracticeLogs = () => {
    getAllPracticeLogs().then(pLogs => {
      const todayStr = getTodayDateStr();
      const todayP = (pLogs || []).filter(p => p.date === todayStr);
      setTodayPracticeLogs(todayP);
    }).catch(err => {
      console.warn('Failed to load practice logs for widget', err);
    });
  };

  useEffect(() => {
    refreshPracticeLogs();
    const handlePracticeUpdate = () => refreshPracticeLogs();
    const handleCatsChanged = (e: any) => {
      const cats = e.detail || getPracticeCategories();
      setPracticeCategories(cats);
    };
    window.addEventListener('cbeta_practice_log_saved', handlePracticeUpdate);
    window.addEventListener('cbeta-practice-categories-changed', handleCatsChanged);
    return () => {
      window.removeEventListener('cbeta_practice_log_saved', handlePracticeUpdate);
      window.removeEventListener('cbeta-practice-categories-changed', handleCatsChanged);
    };
  }, []);

  const handleSelectBeadCategory = (cat: string) => {
    setBeadCategory(cat);
    localStorage.setItem('cbeta_home_bead_cat', cat);
    setShowBeadCatMenu(false);
    const catItems = practiceCategories[cat]?.items || [];
    if (catItems.length > 0) {
      setBeadName(catItems[0]);
      localStorage.setItem('cbeta_home_bead_name', catItems[0]);
    }
  };

  const handleSelectBeadName = (name: string) => {
    setBeadName(name);
    localStorage.setItem('cbeta_home_bead_name', name);
    setShowBeadMidMenu(false);
  };


  const handleHomeBeadTap = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBeadTapAnim(true);
    setTimeout(() => setBeadTapAnim(false), 600);
    const todayStr = getTodayDateStr();
    const existing = todayPracticeLogs.find(p => p.name === beadName);
    const currentCount = existing ? existing.count : 0;
    const newCount = currentCount + 1;
    let unit = practiceCategories[beadCategory]?.unit || '聲';
    if (beadName === '禮佛大拜') unit = '拜';
    if (beadName === '靜坐禪修') unit = '分鐘';

    const entry: PracticeLogEntry = {
      id: existing ? existing.id : 'p_' + Date.now(),
      date: todayStr,
      timestamp: Date.now(),
      category: beadCategory,
      name: beadName,
      count: newCount,
      unit
    };

    try {
      await savePracticeLog(entry);
      setTodayPracticeLogs(prev => {
        const idx = prev.findIndex(p => p.name === beadName);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = entry;
          return next;
        }
        return [entry, ...prev];
      });
      window.dispatchEvent(new CustomEvent('cbeta_practice_log_saved'));
    } catch (err) {
      console.error('Failed to save bead count:', err);
    }
  };

  // 💡 計算 iOS 月曆小卡所需的讀經摘要（優先顯示今日已讀，無則平滑銜接近日閱讀經典）
  const getCalendarWidgetItems = () => {
    const todayLogs = todayReadingLogs || [];
    
    if (todayLogs.length > 0) {
      // 依 workId 聚合今日閱讀
      const workIdMap = new Map<string, { title: string; totalMinutes: number; latestTime: number; book?: BookMetadata }>();
      todayLogs.forEach(l => {
        const existing = workIdMap.get(l.workId);
        const mins = l.durationMinutes || 0;
        const timeKey = l.endTime || l.startTime || 0;
        if (existing) {
          existing.totalMinutes += mins;
          if (timeKey > existing.latestTime) {
            existing.latestTime = timeKey;
          }
        } else {
          const book = downloadedBooks.find(b => b.workId === l.workId) || 
                       resumeBooks.find(r => r.book.workId === l.workId)?.book;
          workIdMap.set(l.workId, {
            title: l.title || book?.title || l.workId,
            totalMinutes: mins,
            latestTime: timeKey,
            book
          });
        }
      });
      // 依最近閱讀時間遞減排序（最新讀過的排在第 1 則）
      const items = Array.from(workIdMap.entries())
        .sort((a, b) => b[1].latestTime - a[1].latestTime)
        .map(([workId, val]) => {
          const creator = val.book?.creators ? sanitizeCreators(val.book.creators) : '';
          const detailParts = [];
          if (val.totalMinutes > 0) detailParts.push(`已讀 ${val.totalMinutes} 分鐘`);
          if (creator) detailParts.push(creator);
          return {
            workId,
            title: val.title,
            book: val.book,
            detail: detailParts.join(' · ') || '今日已讀',
            isToday: true
          };
        });
      const totalTodayMinutes = todayLogs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
      return { isToday: true, items, totalTodayMinutes };
    }

    // 次之：由 resumeBooks (近日閱讀進度) 提取
    if (resumeBooks && resumeBooks.length > 0) {
      const items = resumeBooks.slice(0, 3).map(r => {
        const creator = r.book.creators ? sanitizeCreators(r.book.creators) : '';
        const juanStr = r.progress?.juan ? `第 ${r.progress.juan} 卷` : (r.book.juansCount ? `全 ${r.book.juansCount} 卷` : '');
        const detail = [juanStr, creator].filter(Boolean).join(' · ') || '近日閱讀';
        return {
          workId: r.book.workId,
          title: r.book.title,
          book: r.book,
          detail,
          isToday: false
        };
      });
      return { isToday: false, items };
    }

    // 再次：由 downloadedBooks (已下載經文) 提取
    if (downloadedBooks && downloadedBooks.length > 0) {
      const items = downloadedBooks.slice(0, 2).map(b => {
        const creator = b.creators ? sanitizeCreators(b.creators) : '';
        const juanStr = b.juansCount ? `全 ${b.juansCount} 卷` : '';
        const detail = [juanStr, creator].filter(Boolean).join(' · ') || '已下載經典';
        return {
          workId: b.workId,
          title: b.title,
          book: b,
          detail,
          isToday: false
        };
      });
      return { isToday: false, items };
    }

    return { isToday: false, items: [] };
  };

  // 💡 自訂便籤小卡（方案 A：Spotlight 原地直編 + Word 單列膠囊控制列）狀態
  const [editingMemoWidget, setEditingMemoWidget] = useState<HomeWidgetConfig | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [hasTextSelection, setHasTextSelection] = useState<boolean>(false);
  const [currentFontLabel, setCurrentFontLabel] = useState<string>('宋/明體 ▾');
  const [currentSpacingLabel, setCurrentSpacingLabel] = useState<string>('適中 ▾');
  const [currentFontSize, setCurrentFontSize] = useState<number>(18);
  const [activePopover, setActivePopover] = useState<'symbol' | 'font' | 'spacing' | null>(null);
  const [selectionToast, setSelectionToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const [toolbarStyle, setToolbarStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const lastMemoClickRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const lastBackdropClickTimeRef = useRef<number>(0);
  const lastLayoutOutsideClickTimeRef = useRef<number>(0);

  const showSelectionToast = (msg: string = '請先反白選取要調整的文字') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setSelectionToast(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setSelectionToast(null);
    }, 1600);
  };

  const checkSelectionState = () => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setHasTextSelection(false);
      return;
    }
    const isInside = editorRef.current && sel.anchorNode && editorRef.current.contains(sel.anchorNode);
    if (!isInside) return;

    if (sel.isCollapsed) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      setHasTextSelection(false);
    } else {
      const text = sel.toString().trim();
      if (text.length > 0) {
        setHasTextSelection(true);
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();

        // 💡 自動偵測目前反白所選文字的實際字級，同步更新步進器顯示
        try {
          const r = sel.getRangeAt(0);
          const el = r.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? r.commonAncestorContainer as HTMLElement
            : r.commonAncestorContainer.parentElement;
          if (el) {
            const comp = window.getComputedStyle(el).fontSize;
            const parsed = parseInt(comp, 10);
            if (!isNaN(parsed) && parsed >= 8 && parsed <= 40) {
              setCurrentFontSize(parsed);
            }
          }
        } catch (_) {}
      } else {
        setHasTextSelection(false);
      }
    }
  };

  const saveSelection = () => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const r = sel.getRangeAt(0);
      if (editorRef.current.contains(r.commonAncestorContainer) || editorRef.current.contains(r.startContainer)) {
        savedRangeRef.current = r.cloneRange();
        if (!sel.isCollapsed && sel.toString().trim().length > 0) {
          setHasTextSelection(true);
        }
      }
    }
  };

  const getActiveOrSavedRange = (): Range | null => {
    if (typeof window === 'undefined') return null;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const r = sel.getRangeAt(0);
      if (editorRef.current.contains(r.commonAncestorContainer) || editorRef.current.contains(r.startContainer)) {
        return r;
      }
    }
    return savedRangeRef.current;
  };

  const updateRangeAndSelection = (newRange: Range) => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    savedRangeRef.current = newRange.cloneRange();
    setHasTextSelection(true);
  };

  // 💡 針對反白選取文字個別套用行內樣式 (字級或字體)，絕不影響卡片內其他未選取的文字
  const applyInlineStyleToSelection = (styleProp: 'fontSize' | 'fontFamily', styleVal: string) => {
    const range = getActiveOrSavedRange();
    if (!range || range.collapsed || !editorRef.current) {
      showSelectionToast();
      return;
    }
    editorRef.current.focus();

    // 檢查選取區之共同祖先是否為單一的 span
    const commonNode = range.commonAncestorContainer;
    const commonEl = (commonNode.nodeType === Node.ELEMENT_NODE ? commonNode as HTMLElement : commonNode.parentElement);

    // 若整段選取剛好就是某個已存在的 span (例如之前套用過字級或字體)
    if (commonEl && commonEl.tagName === 'SPAN' && editorRef.current.contains(commonEl) && commonEl.innerText.trim() === range.toString().trim()) {
      if (styleProp === 'fontSize') commonEl.style.fontSize = styleVal;
      if (styleProp === 'fontFamily') commonEl.style.fontFamily = styleVal;
      const newRange = document.createRange();
      newRange.selectNodeContents(commonEl);
      updateRangeAndSelection(newRange);
      return;
    }

    try {
      const fragment = range.extractContents();
      // 清除提取內容中子 span 的衝突樣式，防止多層巢狀覆蓋無效
      if (fragment.querySelectorAll) {
        fragment.querySelectorAll('span').forEach((s: HTMLSpanElement) => {
          if (styleProp === 'fontSize') s.style.fontSize = '';
          if (styleProp === 'fontFamily') s.style.fontFamily = '';
          if (!s.getAttribute('style') || s.getAttribute('style')?.trim() === '') {
            const parent = s.parentNode;
            if (parent) {
              while (s.firstChild) parent.insertBefore(s.firstChild, s);
              parent.removeChild(s);
            }
          }
        });
      }

      const wrapper = document.createElement('span');
      if (styleProp === 'fontSize') wrapper.style.fontSize = styleVal;
      if (styleProp === 'fontFamily') wrapper.style.fontFamily = styleVal;
      wrapper.appendChild(fragment);

      range.insertNode(wrapper);
      const newRange = document.createRange();
      newRange.selectNodeContents(wrapper);
      updateRangeAndSelection(newRange);
    } catch (err) {
      console.warn('applyInlineStyleToSelection error:', err);
    }
  };

  useEffect(() => {
    const handleGlobalSelectionChange = () => {
      if (editingMemoWidget) {
        checkSelectionState();
      }
    };
    document.addEventListener('selectionchange', handleGlobalSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleGlobalSelectionChange);
    };
  }, [editingMemoWidget]);

  const handleOpenMemoEditor = (widget: HomeWidgetConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isLayoutEditMode) return;
    setEditingMemoWidget(widget);
    setActivePopover(null);
    setHasTextSelection(false);
    setCurrentFontSize(widget.memoFontSize || 18);
    setCurrentSpacingLabel(
      widget.memoLineHeight === 1.4 ? '緊密 ▾' : widget.memoLineHeight === 2.2 ? '寬鬆 ▾' : '適中 ▾'
    );

    // 🌟 一律自動置頂於頂部主控制列(圖2)下方編輯，並初始化 contentEditable 內容
    if (typeof window !== 'undefined') {
      const doScrollToTop = () => {
        const el = document.getElementById(`widget-${widget.id}`) ||
                   document.querySelector(`.widget-card[data-widget-id="${widget.id}"]`) ||
                   document.querySelector('.custom-memo-card.is-editing-target');
        const scrollContainer = document.querySelector('.library-content-area');
        const header = document.querySelector('.library-header');
        const headerHeight = header ? header.getBoundingClientRect().height : 56;

        if (el && scrollContainer) {
          const elRect = el.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          const currentScrollTop = scrollContainer.scrollTop;
          const targetTop = currentScrollTop + (elRect.top - containerRect.top) - 10;
          scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        } else if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.scrollBy({ top: -headerHeight - 10, behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };

      setTimeout(doScrollToTop, 50);
      setTimeout(doScrollToTop, 160);

      setTimeout(() => {
        if (editorRef.current) {
          const initialHtml = widget.memoHtml || (
            widget.memoText
              ? `<p>${widget.memoText.replace(/\n/g, '</p><p>')}</p>${widget.memoAuthor ? `<p class="memo-author-line">${widget.memoAuthor}</p>` : ''}`
              : ''
          );
          editorRef.current.innerHTML = initialHtml;
          editorRef.current.focus();
        }
      }, 100);
    }
  };

  // 💡 防誤觸機制：便籤卡片需連續點 2 下（間隔 < 500ms）方能進入編輯模式
  const handleMemoCardClick = (widget: HomeWidgetConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLayoutEditMode || editingMemoWidget?.id === widget.id) return;
    const now = Date.now();
    const diff = now - lastMemoClickRef.current.time;
    if (lastMemoClickRef.current.id === widget.id && diff > 0 && diff < 500) {
      lastMemoClickRef.current = { id: '', time: 0 };
      handleOpenMemoEditor(widget, e);
    } else {
      lastMemoClickRef.current = { id: widget.id, time: now };
    }
  };

  useEffect(() => {
    if (editingMemoWidget && editorRef.current) {
      const initialHtml = editingMemoWidget.memoHtml || (
        editingMemoWidget.memoText
          ? `<p>${editingMemoWidget.memoText.replace(/\n/g, '</p><p>')}</p>${editingMemoWidget.memoAuthor ? `<p class="memo-author-line">${editingMemoWidget.memoAuthor}</p>` : ''}`
          : ''
      );
      editorRef.current.innerHTML = initialHtml;
    }
  }, [editingMemoWidget?.id]);

  const handleCancelMemoEditor = () => {
    setEditingMemoWidget(null);
    setActivePopover(null);
    setSelectionToast(null);
  };

  const handleSaveMemoEditor = () => {
    if (!editingMemoWidget) return;
    const memoHtml = editorRef.current ? editorRef.current.innerHTML : (editingMemoWidget.memoHtml || '');
    const memoText = editorRef.current ? editorRef.current.innerText : (editingMemoWidget.memoText || '');
    const currentLineHeight = currentSpacingLabel.includes('緊密') ? 1.4 : currentSpacingLabel.includes('寬鬆') ? 2.2 : 1.8;

    const updated = widgets.map(w => {
      if (w.id === editingMemoWidget.id) {
        return {
          ...w,
          memoHtml,
          memoText,
          // 💡 保持卡片預設基準字級不被局部文字選取大小覆蓋
          memoFontSize: editingMemoWidget.memoFontSize || 18,
          memoLineHeight: currentLineHeight
        };
      }
      return w;
    });
    setWidgets(updated);
    onSaveSettings({
      ...settings,
      customHomeLayoutEnabled: true,
      homeWidgets: updated
    });
    setEditingMemoWidget(null);
    setActivePopover(null);
  };

  // 點擊控制列與選單以外的區域時：單擊關閉打開的選單，連續「點 2 下」表示「完成」編輯並自動儲存
  useEffect(() => {
    if (!editingMemoWidget) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('.memo-word-toolbar') || 
        target.closest('.word-popover') || 
        target.closest('.custom-memo-card.is-editing-target')
      ) {
        return;
      }
      setActivePopover(null);

      const now = Date.now();
      const diff = now - lastBackdropClickTimeRef.current;
      if (diff > 0 && diff < 500) {
        lastBackdropClickTimeRef.current = 0;
        handleSaveMemoEditor();
      } else {
        lastBackdropClickTimeRef.current = now;
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDownOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [editingMemoWidget, currentFontSize, currentSpacingLabel, widgets]);

  // 💡 圖3 小工具版面編輯模式：在頁面外連續「點 2 下」表示「✓ 完成」並自動儲存退出
  useEffect(() => {
    if (!isLayoutEditMode) return;

    const handleLayoutOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 若點擊在卡片內部、加入小工具按鈕、尺寸切換按鈕、刪除按鈕、頂部橫幅內部，則不視為頁面外
      if (
        target.closest('.widget-card') ||
        target.closest('.home-edit-top-banner') ||
        target.closest('.ios-gallery-backdrop') ||
        target.closest('.ios-gallery-modal')
      ) {
        return;
      }

      const now = Date.now();
      const diff = now - lastLayoutOutsideClickTimeRef.current;
      if (diff > 0 && diff < 500) {
        lastLayoutOutsideClickTimeRef.current = 0;
        handleSaveAndExit();
      } else {
        lastLayoutOutsideClickTimeRef.current = now;
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleLayoutOutsideClick);
    }, 120);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleLayoutOutsideClick);
    };
  }, [isLayoutEditMode, widgets, settings]);

  // 🌟 動態將文字排版控制列錨定並懸浮於便籤卡片下方邊緣下方（適用 4x1, 4x2, 4x3, 4x4, 2x2 等所有尺寸）
  useEffect(() => {
    if (!editingMemoWidget) {
      setToolbarStyle(null);
      return;
    }

    const updatePosition = () => {
      const widgetCard = document.getElementById(`widget-${editingMemoWidget.id}`) ||
                         document.querySelector(`.widget-card[data-widget-id="${editingMemoWidget.id}"]`);
      if (!widgetCard) return;

      const rect = widgetCard.getBoundingClientRect();
      const screenWidth = window.innerWidth;

      // 控制列寬度：最大 440px，兩側至少各留 12px
      const toolbarWidth = Math.min(screenWidth - 24, 440);

      // 垂直位置：緊靠在便籤卡片下方邊緣下方（間距 10px）
      const top = rect.bottom + 10;

      // 水平位置：以卡片水平中心為基準，並限制在左右安全邊界內（不超出螢幕左右 12px）
      let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
      left = Math.max(12, Math.min(screenWidth - toolbarWidth - 12, left));

      setToolbarStyle({
        top,
        left,
        width: toolbarWidth,
      });
    };

    updatePosition();

    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updatePosition);
      window.visualViewport.addEventListener('scroll', updatePosition);
    }

    const widgetCard = document.getElementById(`widget-${editingMemoWidget.id}`);
    let ro: ResizeObserver | null = null;
    if (widgetCard && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updatePosition());
      ro.observe(widgetCard);
    }

    const interval = setInterval(updatePosition, 60);
    const stopTimer = setTimeout(() => clearInterval(interval), 1000);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updatePosition);
        window.visualViewport.removeEventListener('scroll', updatePosition);
      }
      if (ro) ro.disconnect();
      clearInterval(interval);
      clearTimeout(stopTimer);
    };
  }, [editingMemoWidget]);

  // 🌟 便籤編輯時鎖定背景滾動容器（禁止自由拉升滾軸），並支援在卡片與控制列外「連續點 2 下」自動完成儲存退出
  useEffect(() => {
    if (!editingMemoWidget) return;

    const scrollContainer = document.querySelector('.library-content-area') as HTMLElement | null;
    const originalContainerOverflow = scrollContainer ? scrollContainer.style.overflow : '';
    const originalBodyOverflow = document.body.style.overflow;

    if (scrollContainer) {
      scrollContainer.style.overflow = 'hidden';
    }
    document.body.style.overflow = 'hidden';

    let lastGlobalClickTime = 0;
    const handleGlobalClick = (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      // 點擊在正在編輯的卡片內或排版工具列內，不觸發自動完成
      if (target.closest('.is-editing-memo-widget') || target.closest('.memo-word-toolbar')) {
        return;
      }
      const now = Date.now();
      const diff = now - lastGlobalClickTime;
      if (diff > 0 && diff < 450) {
        lastGlobalClickTime = 0;
        handleSaveMemoEditor();
      } else {
        lastGlobalClickTime = now;
      }
    };

    const handleGlobalDblClick = (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      if (!target.closest('.is-editing-memo-widget') && !target.closest('.memo-word-toolbar')) {
        handleSaveMemoEditor();
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    document.addEventListener('dblclick', handleGlobalDblClick, true);

    return () => {
      if (scrollContainer) {
        scrollContainer.style.overflow = originalContainerOverflow;
      }
      document.body.style.overflow = originalBodyOverflow;
      document.removeEventListener('click', handleGlobalClick, true);
      document.removeEventListener('dblclick', handleGlobalDblClick, true);
    };
  }, [editingMemoWidget, widgets]);

  // 工具列指令處理：使用純原生 Range 操作，徹底解決跨段落與跨瀏覽器樣式失效問題
  // 💡 嚴格限定只放大/縮小反白所選之文字，絕不影響卡片內其他文字
  const handleToolbarFontSizeStep = (delta: number) => {
    const range = getActiveOrSavedRange();
    if (!range || range.collapsed) {
      showSelectionToast();
      return;
    }
    const newSize = Math.min(36, Math.max(8, currentFontSize + delta));
    setCurrentFontSize(newSize);
    applyInlineStyleToSelection('fontSize', `${newSize}px`);
  };

  // 💡 楷體完整相容字體棧 (教育部標準楷書、全字庫標楷體、LXGW WenKai TC、Windows DFKai-SB、Mac Kaiti TC)
  const handleToolbarSetFont = (f: 'serif' | 'sans' | 'kai') => {
    const range = getActiveOrSavedRange();
    if (!range || range.collapsed) {
      showSelectionToast();
      setActivePopover(null);
      return;
    }
    const fontNames = { serif: '宋/明體', sans: '黑體', kai: '楷體' };
    const fontFamilies = {
      serif: 'var(--font-serif, "Noto Serif TC", serif)',
      sans: 'var(--font-sans, "Noto Sans TC", sans-serif)',
      kai: 'var(--font-kai, "TW-Kai", "MOE-EduKai", "TW-Kai-98", "LXGW WenKai TC", "Klee One", "DFKai-SB", "BiauKai", "Kaiti TC", "KaiTi", 楷體, serif)'
    };
    setCurrentFontLabel(`${fontNames[f]} ▾`);
    applyInlineStyleToSelection('fontFamily', fontFamilies[f]);
    setActivePopover(null);
  };

  const handleToolbarBold = () => {
    const range = getActiveOrSavedRange();
    if (!range || range.collapsed) {
      showSelectionToast();
      return;
    }
    if (editorRef.current) {
      editorRef.current.focus();
      const common = range.commonAncestorContainer;
      const parentStrong = (common.nodeType === Node.ELEMENT_NODE ? common as HTMLElement : common.parentElement)?.closest('strong');

      if (parentStrong && editorRef.current.contains(parentStrong)) {
        // 已有 strong：解除加粗
        const fragment = document.createDocumentFragment();
        while (parentStrong.firstChild) {
          fragment.appendChild(parentStrong.firstChild);
        }
        parentStrong.replaceWith(fragment);
        setHasTextSelection(false);
      } else {
        // 加粗
        try {
          const strong = document.createElement('strong');
          strong.appendChild(range.extractContents());
          range.insertNode(strong);
          const newRange = document.createRange();
          newRange.selectNodeContents(strong);
          updateRangeAndSelection(newRange);
        } catch (e) {
          console.warn(e);
        }
      }
    }
  };

  const handleToolbarSetSpacing = (sp: 'tight' | 'medium' | 'loose', lh: number) => {
    const spacingNames = { tight: '緊密', medium: '適中', loose: '寬鬆' };
    setCurrentSpacingLabel(`${spacingNames[sp]} ▾`);
    if (editorRef.current) {
      editorRef.current.style.lineHeight = String(lh);
    }
    setActivePopover(null);
  };

  const handleToolbarInsertSymbol = (sym: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const range = getActiveOrSavedRange();
    const textNode = document.createTextNode(` ${sym} `);
    if (range) {
      range.deleteContents();
      range.insertNode(textNode);
      const newRange = document.createRange();
      newRange.setStartAfter(textNode);
      newRange.collapse(true);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      savedRangeRef.current = newRange.cloneRange();
    } else {
      editorRef.current.appendChild(textNode);
    }
    setActivePopover(null);
  };

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

      // 💡 書櫃小卡群組自動標準化為各自主 type
      if (w.type === 'bar_fav_4x1' || w.type === 'shelf_fav_4x3') {
        w = { ...w, type: 'shelf_fav_4x2' };
      } else if (w.type === 'bar_down_4x1' || w.type === 'shelf_down_4x3') {
        w = { ...w, type: 'shelf_down_4x2' };
      } else if (w.type === 'bar_read_4x1' || w.type === 'shelf_read_4x3') {
        w = { ...w, type: 'shelf_read_4x2' };
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
      iconIndex: iconIndex || 1,
      ...(type === 'custom_memo' ? {
        memoText: '',
        memoHtml: '',
        memoLines: [],
        memoAuthor: '',
        memoFont: 'serif',
        memoFontSize: 18,
        memoIconIndex: 0,
        memoLineHeight: 1.8,
        memoPadding: 10
      } : {}),
      ...(type === 'quick_nav_4x2' ? {
        customNavButtons: [...DEFAULT_QUICK_NAV_BUTTONS]
      } : {}),
      ...(type === 'download_shelf_4x3' ? {
        customNavButtons: size === 'size-4x3' ? [...DEFAULT_SHELF_NAV_BUTTONS_4X3] : [...DEFAULT_SHELF_NAV_BUTTONS_4X2]
      } : {})
    };
    setWidgets(prev => [newWidget, ...prev]);
    setIsGalleryOpen(false);

    // 💡 確保新加入的小工具立即可見，平滑捲動至頂部
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  // 💡 點擊禪意 App Icon：循環更換蓮花圖標 (共 6 款精選小圖)
  const handleCycleZenIcon = (widgetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (widgetId === 'preview-instance') {
      setPreviewIconIndex(prev => (prev % ZEN_ICONS_LIST.length) + 1);
      return;
    }
    setWidgets(prev => {
      const updated = prev.map(w => {
        if (w.id !== widgetId) return w;
        const curIcon = w.iconIndex || 1;
        const nextIcon = (curIcon % ZEN_ICONS_LIST.length) + 1;
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

  // 💡 八合一快捷小卡：點擊各按鈕跳轉/執行對應動作
  const handleNavButtonClick = (btnKey: string, widget: HomeWidgetConfig, e: React.MouseEvent) => {
    if (isLayoutEditMode) return;
    e.stopPropagation();

    switch (btnKey) {
      case 'download':
        onOpenCbetaCatalog();
        break;
      case 'recent_downloads':
        if (onOpenFolder) onOpenFolder('virtual_unclassified');
        else onNavigateToLibrarySection('shelf');
        break;
      case 'last_read':
        if (onOpenFolder) onOpenFolder('virtual_recent_reads');
        else onNavigateToLibrarySection('shelf');
        break;
      case 'favorites':
        if (onOpenFolder) onOpenFolder('virtual_favorites');
        else onNavigateToLibrarySection('shelf');
        break;
      case 'shelf':
        onNavigateToLibrarySection('shelf');
        break;
      case 'notes':
        onNavigateToLibrarySection('notes');
        break;
      case 'search':
      case 'fulltext':
        onNavigateToLibrarySection('search');
        break;
      case 'theme_color': {
        const THEME_CYCLE_KEYS: Array<'ivory' | 'parchment' | 'comfort' | 'ebony' | 'custom'> = ['ivory', 'parchment', 'comfort', 'ebony', 'custom'];
        const currentTheme = settings.theme || 'ivory';
        const curIdx = THEME_CYCLE_KEYS.indexOf(currentTheme as any);
        const nextTheme = THEME_CYCLE_KEYS[(curIdx + 1) % THEME_CYCLE_KEYS.length];
        onSaveSettings({ ...settings, theme: nextTheme });
        break;
      }
      case 'stats':
        onNavigateToLibrarySection('reading-log');
        break;
      case 'timer':
        if (timerState.duration !== null) {
          handleSetTimerMinutes(null);
        } else {
          handleSetTimerMinutes(25);
        }
        break;
      case 'zen_icon':
        handleCycleZenIcon(widget.id, e);
        break;
      case 'brand_title': {
        const now = Date.now();
        if (lastBrandNavTapRef.current.id === widget.id && (now - lastBrandNavTapRef.current.time) < 450) {
          // 💡 連續點 2 下：秒速進入自訂快捷功能編輯抽屜！
          lastBrandNavTapRef.current = { id: '', time: 0 };
          setEditingNavWidget(widget);
          setSelectedNavSlotIndex(1);
          return;
        }
        lastBrandNavTapRef.current = { id: widget.id, time: now };
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      }
      default:
        break;
    }
  };

  // 💡 取得指定快捷小卡之預設按鍵陣列
  const getDefaultNavButtonsForWidget = (w: HomeWidgetConfig): string[] => {
    if (w.type === 'download_shelf_4x3') {
      return w.size === 'size-4x3' ? DEFAULT_SHELF_NAV_BUTTONS_4X3 : DEFAULT_SHELF_NAV_BUTTONS_4X2;
    }
    return DEFAULT_QUICK_NAV_BUTTONS;
  };

  // 💡 儲存並同步更新快捷按鍵
  const saveNavButtons = (updatedButtons: string[]) => {
    if (!editingNavWidget) return;
    const updatedWidgets = widgets.map(w => {
      if (w.id === editingNavWidget.id) {
        return { ...w, customNavButtons: updatedButtons };
      }
      return w;
    });

    setWidgets(updatedWidgets);
    setEditingNavWidget({ ...editingNavWidget, customNavButtons: updatedButtons });

    onSaveSettings({
      ...settings,
      customHomeLayoutEnabled: true,
      homeWidgets: updatedWidgets
    });
  };

  // 💡 調整按鍵位置（拖曳順移/互換：第 1 格固定不可移動；4x2 快捷卡支援拖至空格或兩格互換，其餘按鍵不動）
  const handleSwapNavSlots = (fromIndex: number, toIndex: number) => {
    if (!editingNavWidget) return;
    // ⭐ 第 1 格 (index 0) 固定為 CBETA Reader，不可更換位置
    if (fromIndex === 0 || toIndex === 0) return;
    if (fromIndex === toIndex) return;

    const isShelfNav = editingNavWidget.type === 'download_shelf_4x3';
    if (isShelfNav) {
      // 下載與書櫃卡（上1下5）：維持原本順移行為
      const defaultButtons = getDefaultNavButtonsForWidget(editingNavWidget);
      const rawButtons = editingNavWidget.customNavButtons && editingNavWidget.customNavButtons.length > 0 ? editingNavWidget.customNavButtons : defaultButtons;
      const currentButtons = ensureBrandFirst([...rawButtons]);
      if (fromIndex < 0 || fromIndex >= currentButtons.length || toIndex < 0 || toIndex >= currentButtons.length) return;

      const [movedItem] = currentButtons.splice(fromIndex, 1);
      currentButtons.splice(toIndex, 0, movedItem);
      const updatedButtons = ensureBrandFirst(currentButtons);
      saveNavButtons(updatedButtons);
      setSelectedNavSlotIndex(toIndex);
    } else {
      // ⭐ 4x2 快捷卡 (10 格)：按鍵與空格或按鍵之間互換 (Swap)，其他按鍵維持不動
      const rawButtons = editingNavWidget.customNavButtons && editingNavWidget.customNavButtons.length > 0 ? editingNavWidget.customNavButtons : DEFAULT_QUICK_NAV_BUTTONS;
      const currentButtons = normalizeQuickNav10Buttons(rawButtons);
      if (fromIndex < 0 || fromIndex >= 10 || toIndex < 0 || toIndex >= 10) return;

      const temp = currentButtons[fromIndex];
      currentButtons[fromIndex] = currentButtons[toIndex];
      currentButtons[toIndex] = temp;

      const updatedButtons = normalizeQuickNav10Buttons(currentButtons);
      saveNavButtons(updatedButtons);
      setSelectedNavSlotIndex(toIndex);
    }
  };

  // 💡 替換/填入指定格子的功能按鈕 (第 1 格固定不可替換，其他格不可重複加入 brand_title)
  const handleReplaceNavButton = (slotIndex: number, newButtonKey: string) => {
    if (!editingNavWidget) return;
    if (slotIndex === 0 || newButtonKey === 'brand_title') return;

    const isShelfNav = editingNavWidget.type === 'download_shelf_4x3';
    if (isShelfNav) {
      const defaultButtons = getDefaultNavButtonsForWidget(editingNavWidget);
      const rawButtons = editingNavWidget.customNavButtons && editingNavWidget.customNavButtons.length > 0 ? editingNavWidget.customNavButtons : defaultButtons;
      const currentButtons = ensureBrandFirst([...rawButtons]);
      currentButtons[slotIndex] = newButtonKey;
      const updatedButtons = ensureBrandFirst(currentButtons);
      saveNavButtons(updatedButtons);
    } else {
      // 4x2 快捷卡 (10 格)：填入或替換該格，其他格維持不動
      const rawButtons = editingNavWidget.customNavButtons && editingNavWidget.customNavButtons.length > 0 ? editingNavWidget.customNavButtons : DEFAULT_QUICK_NAV_BUTTONS;
      const currentButtons = normalizeQuickNav10Buttons(rawButtons);
      currentButtons[slotIndex] = newButtonKey;
      const updatedButtons = normalizeQuickNav10Buttons(currentButtons);
      saveNavButtons(updatedButtons);
    }
  };

  // 💡 自由增加按鍵 (下載與書櫃卡最多 5 個；4x2 快捷卡則填入第一個空格)
  const handleAddNavSlot = () => {
    if (!editingNavWidget) return;
    const isShelfNav = editingNavWidget.type === 'download_shelf_4x3';
    if (isShelfNav) {
      const defaultButtons = getDefaultNavButtonsForWidget(editingNavWidget);
      const rawButtons = editingNavWidget.customNavButtons && editingNavWidget.customNavButtons.length > 0 ? editingNavWidget.customNavButtons : defaultButtons;
      const currentButtons = ensureBrandFirst([...rawButtons]);
      if (currentButtons.length >= 5) return;

      const nextKey = AVAILABLE_NAV_BUTTON_KEYS.find(k => {
        if (k === 'brand_title') return false;
        if (k === 'download') return false;
        return !currentButtons.includes(k);
      }) || 'shelf';
      currentButtons.push(nextKey);
      const updatedButtons = ensureBrandFirst(currentButtons);
      saveNavButtons(updatedButtons);
      setSelectedNavSlotIndex(updatedButtons.length - 1);
    } else {
      // 4x2 快捷卡：尋找第一個 'empty' 的格子填入下一個可用功能
      const rawButtons = editingNavWidget.customNavButtons && editingNavWidget.customNavButtons.length > 0 ? editingNavWidget.customNavButtons : DEFAULT_QUICK_NAV_BUTTONS;
      const currentButtons = normalizeQuickNav10Buttons(rawButtons);
      const emptyIdx = currentButtons.findIndex((k, i) => i > 0 && k === 'empty');
      if (emptyIdx === -1) return;

      const nextKey = AVAILABLE_NAV_BUTTON_KEYS.find(k => {
        if (k === 'brand_title') return false;
        return !currentButtons.includes(k);
      }) || 'shelf';
      currentButtons[emptyIdx] = nextKey;
      const updatedButtons = normalizeQuickNav10Buttons(currentButtons);
      saveNavButtons(updatedButtons);
      setSelectedNavSlotIndex(emptyIdx);
    }
  };

  // 💡 移除按鍵 (第 1 格固定不可刪除；4x2 快捷卡刪除後轉為空格 'empty'，其他按鍵不動；下載與書櫃卡維持縮減)
  const handleRemoveNavSlot = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingNavWidget) return;
    if (idx === 0) return; // ⭐ 第 1 格不可刪除

    const isShelfNav = editingNavWidget.type === 'download_shelf_4x3';
    if (isShelfNav) {
      const defaultButtons = getDefaultNavButtonsForWidget(editingNavWidget);
      const rawButtons = editingNavWidget.customNavButtons && editingNavWidget.customNavButtons.length > 0 ? editingNavWidget.customNavButtons : defaultButtons;
      const currentButtons = ensureBrandFirst([...rawButtons]);
      if (currentButtons.length <= 2) return;

      currentButtons.splice(idx, 1);
      const updatedButtons = ensureBrandFirst(currentButtons);
      saveNavButtons(updatedButtons);
      setSelectedNavSlotIndex(Math.max(1, Math.min(selectedNavSlotIndex, updatedButtons.length - 1)));
    } else {
      // ⭐ 4x2 快捷卡：刪除某按鍵時，其他按鍵維持不動，此位置變成空格 'empty' (出現圖2的圖示)
      const rawButtons = editingNavWidget.customNavButtons && editingNavWidget.customNavButtons.length > 0 ? editingNavWidget.customNavButtons : DEFAULT_QUICK_NAV_BUTTONS;
      const currentButtons = normalizeQuickNav10Buttons(rawButtons);
      currentButtons[idx] = 'empty';
      const updatedButtons = normalizeQuickNav10Buttons(currentButtons);
      saveNavButtons(updatedButtons);
      setSelectedNavSlotIndex(idx); // 選定此空格，方便使用者由下方功能庫選取填入
    }
  };

  // 💡 恢復預設快捷按鍵
  const handleResetNavButtons = () => {
    if (!editingNavWidget) return;
    const isShelfNav = editingNavWidget.type === 'download_shelf_4x3';
    const defaultButtons = isShelfNav
      ? ensureBrandFirst(getDefaultNavButtonsForWidget(editingNavWidget))
      : [...DEFAULT_QUICK_NAV_BUTTONS];

    const updatedWidgets = widgets.map(w => {
      if (w.id === editingNavWidget.id) {
        return { ...w, customNavButtons: [...defaultButtons] };
      }
      return w;
    });

    setWidgets(updatedWidgets);
    setEditingNavWidget({ ...editingNavWidget, customNavButtons: [...defaultButtons] });
    setSelectedNavSlotIndex(0);

    onSaveSettings({
      ...settings,
      customHomeLayoutEnabled: true,
      homeWidgets: updatedWidgets
    });
  };

  // 💡 渲染八合一各按鍵專屬圖標
  const renderQuickNavButtonIcon = (btnKey: string, iconSize: number = 18, iconIndex: number = 1) => {
    switch (btnKey) {
      case 'download':
        return <Plus size={iconSize} color="#ffffff" style={{ strokeWidth: 2.6 }} />;
      case 'recent_downloads':
        return <Download size={iconSize} color="#ffffff" strokeWidth={2.4} />;
      case 'last_read':
        return <Clock size={iconSize} color="#ffffff" strokeWidth={2.4} />;
      case 'favorites':
        return <Heart size={iconSize} color="#ffffff" strokeWidth={2.4} />;
      case 'shelf':
        return <Folder size={iconSize} color="#ffffff" strokeWidth={2.2} />;
      case 'notes':
        return <Notebook size={iconSize} color="#ffffff" strokeWidth={2.2} />;
      case 'search':
        return <Search size={iconSize} color="#ffffff" strokeWidth={2.4} />;
      case 'stats':
        return <CalendarDays size={iconSize} color="#ffffff" strokeWidth={2.2} />;
      case 'fulltext':
        return <FileText size={iconSize} color="#ffffff" strokeWidth={2.2} />;
      case 'timer':
        return <Timer size={iconSize} color="#ffffff" strokeWidth={2.4} />;
      case 'zen_icon': {
        const iconSrc = ZEN_ICONS_LIST[(iconIndex - 1) % ZEN_ICONS_LIST.length];
        return <img src={iconSrc} alt="Zen" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />;
      }
      case 'brand_title':
        return <BookOpen size={iconSize} color="#ffffff" strokeWidth={2.2} />;
      default:
        return <Plus size={iconSize} color="#ffffff" />;
    }
  };

  // 💡 渲染八合一各按鍵項目內容（主題小卡圖4純正方形圖片輪播無文字、主題小卡圖5純上下二行文字、其他為圖標+名稱）
  const renderQuickNavItemContent = (btnKey: string, iconSize: number, iconIndex: number, isSlot: boolean = false) => {
    const def = QUICK_NAV_BUTTON_DEFS[btnKey] || QUICK_NAV_BUTTON_DEFS['download'];

    if (btnKey === 'zen_icon') {
      // 4 如果選到「主題小卡」圖4，則不用出現文字「主題小卡」直接是正方型圖片輪播
      const iconSrc = ZEN_ICONS_LIST[(iconIndex - 1) % ZEN_ICONS_LIST.length];
      return (
        <div className={`eight-nav-zen-container ${isSlot ? 'slot-mode' : ''}`}>
          <img 
            src={iconSrc} 
            alt="Zen Icon" 
            className="eight-nav-zen-full-img" 
          />
        </div>
      );
    }

    if (btnKey === 'brand_title') {
      // 5 圖5「cbeta reader」的樣式應為圖4才對（CBETA 綠色 + Reader 深色）
      return (
        <div className={`eight-nav-brand-container ${isSlot ? 'slot-mode' : ''}`}>
          <div className="brand-two-lines-box">
            <span className="brand-line-cbeta">CBETA</span>
            <span className="brand-line-reader">Reader</span>
          </div>
        </div>
      );
    }

    if (btnKey === 'theme_color') {
      // 1 僅出現當前的「主題顏色」樣式 (圓形色塊 + 顏色文字)
      const curTheme = settings.theme || 'ivory';
      const themeInfoMap: Record<string, { name: string; color: string; border: string }> = {
        ivory: { name: '象牙白', color: '#faf7f0', border: 'rgba(0, 0, 0, 0.16)' },
        parchment: { name: '羊皮紙', color: '#f5eedc', border: 'rgba(0, 0, 0, 0.16)' },
        comfort: { name: '舒服綠', color: '#d7e8d5', border: 'rgba(0, 0, 0, 0.16)' },
        ebony: { name: '烏木黑', color: '#23211e', border: 'rgba(255, 255, 255, 0.35)' },
        custom: { name: '自訂色', color: settings.customThemeColor || '#d4a373', border: 'rgba(0, 0, 0, 0.2)' },
      };
      const curInfo = themeInfoMap[curTheme] || themeInfoMap['ivory'];
      return (
        <div className={`eight-nav-theme-container ${isSlot ? 'slot-mode' : ''}`}>
          <div 
            className="eight-nav-theme-circle" 
            style={{ 
              backgroundColor: curInfo.color,
              border: `1.5px solid ${curInfo.border}`
            }} 
          />
          <span className={isSlot ? 'slot-label' : 'eight-nav-label'}>{curInfo.name}</span>
        </div>
      );
    }

    if (btnKey === 'timer') {
      // 圖4倒數計時：直接呈現圓形虛線點點環形與即時時間數字 (不加文字)
      const isRunning = timerState.duration !== null;
      const timeDisplay = isRunning 
        ? formatTimerMMSS(timerState.remainingSeconds)
        : '25:00';
      return (
        <div className={`eight-nav-timer-container ${isSlot ? 'slot-mode' : ''}`}>
          <div className={`eight-nav-timer-circle ${isRunning ? 'is-active' : ''}`}>
            <span className="eight-nav-timer-text">{timeDisplay}</span>
          </div>
        </div>
      );
    }

    return (
      <>
        <div 
          className={isSlot ? 'slot-icon-box' : `eight-nav-icon icon-${btnKey}`}
          style={{ background: def.gradient }}
        >
          {renderQuickNavButtonIcon(btnKey, iconSize, iconIndex)}
        </div>
        <span className={isSlot ? 'slot-label' : 'eight-nav-label'}>{def.name}</span>
      </>
    );
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

  // 點擊「✓ 完成」時：觸發儲存詢問對話框
  const handleSaveAndExit = () => {
    // 預設填入名稱
    const curPresetKey = settings.homeLayoutPreset || 'default';
    if (curPresetKey === 'custom' || curPresetKey === 'custom1') {
      setSaveTargetSlot('custom1');
      setSavePresetNameInput(settings.customPresets?.custom1?.name || settings.customPresetName?.trim() || '自訂1');
    } else if (curPresetKey === 'custom2') {
      setSaveTargetSlot('custom2');
      setSavePresetNameInput(settings.customPresets?.custom2?.name || '自訂2');
    } else if (curPresetKey === 'custom3') {
      setSaveTargetSlot('custom3');
      setSavePresetNameInput(settings.customPresets?.custom3?.name || '自訂3');
    } else {
      // 正在使用系統內建範本（default, calm, compact 等）
      // 優先挑選一個尚未使用的自訂槽位，或預設 custom1
      if (!settings.customPresets?.custom1?.widgets?.length) {
        setSaveTargetSlot('custom1');
        setSavePresetNameInput('自訂1');
      } else if (!settings.customPresets?.custom2?.widgets?.length) {
        setSaveTargetSlot('custom2');
        setSavePresetNameInput('自訂2');
      } else if (!settings.customPresets?.custom3?.widgets?.length) {
        setSaveTargetSlot('custom3');
        setSavePresetNameInput('自訂3');
      } else {
        setSaveTargetSlot('custom1');
        setSavePresetNameInput('自訂1');
      }
    }
    setShowSavePresetModal(true);
  };

  // 直接儲存至指定自訂版型槽位
  const handleConfirmSaveToSlot = (slotKey: 'custom1' | 'custom2' | 'custom3', name: string) => {
    const finalName = name.trim() || (slotKey === 'custom1' ? '自訂1' : slotKey === 'custom2' ? '自訂2' : '自訂3');
    const updatedCustomPresets = {
      ...(settings.customPresets || {}),
      [slotKey]: {
        name: finalName,
        widgets: widgets
      }
    };

    onSaveSettings({
      ...settings,
      customHomeLayoutEnabled: true,
      homeLayoutPreset: slotKey,
      customPresetName: slotKey === 'custom1' ? finalName : settings.customPresetName,
      customPresets: updatedCustomPresets,
      homeWidgets: widgets
    });
    setShowSavePresetModal(false);
    setIsLayoutEditMode(false);
  };

  // 僅儲存至當前首頁（不覆蓋自訂版型）
  const handleApplyOnlyToHome = () => {
    onSaveSettings({
      ...settings,
      customHomeLayoutEnabled: true,
      homeLayoutPreset: 'custom',
      homeWidgets: widgets
    });
    setShowSavePresetModal(false);
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

  // 💡 自訂便籤卡片渲染函數 (方案 A：支援 Spotlight 原地打字直編、即時預覽與富文字持久化)
  const renderCustomMemoCard = (targetWidget: HomeWidgetConfig, isPreview: boolean = false) => {
    const isBeingEdited = !isPreview && editingMemoWidget?.id === targetWidget.id;
    const curSize = targetWidget.size || 'size-4x2';

    // 💡 檢查是否有讀者實際輸入的文字內容（去掉 HTML 標籤後是否為空）
    const hasCustomContent = Boolean(
      (targetWidget.memoHtml && targetWidget.memoHtml.replace(/<[^>]*>/g, '').trim()) ||
      (targetWidget.memoText && targetWidget.memoText.trim())
    );

    // 💡 若無自訂輸入內容（預覽或新小卡），依指示不預帶文字，顯示淺色提示
    const defaultInitialHtml = hasCustomContent
      ? (targetWidget.memoHtml || `<p>${(targetWidget.memoText || '').replace(/\n/g, '</p><p>')}</p>${targetWidget.memoAuthor ? `<p class="memo-author-line">${targetWidget.memoAuthor}</p>` : ''}`)
      : `<p class="memo-placeholder-prompt">可自行輸入文字…</p>`;

    const effectiveLineHeight = isBeingEdited
      ? (currentSpacingLabel.includes('緊密') ? 1.4 : currentSpacingLabel.includes('寬鬆') ? 2.2 : 1.8)
      : (targetWidget.memoLineHeight ?? 1.8);

    return (
      <div 
        className={`custom-memo-card memo-${curSize.replace('size-', '')} ${isPreview ? 'is-preview' : ''} ${isBeingEdited ? 'is-editing-target' : ''}`}
        style={{ 
          cursor: (!isLayoutEditMode && !isPreview && !isBeingEdited) ? 'pointer' : 'text'
        }}
        onClick={(!isLayoutEditMode && !isPreview && !isBeingEdited) ? (e) => handleMemoCardClick(targetWidget, e) : undefined}
        onDoubleClick={(!isLayoutEditMode && !isPreview && !isBeingEdited) ? (e) => {
          e.stopPropagation();
          handleOpenMemoEditor(targetWidget, e);
        } : undefined}
        title={(!isLayoutEditMode && !isPreview && !isBeingEdited) ? '連續點兩下編輯便籤文字與排版' : undefined}
      >
        {isBeingEdited ? (
          /* 🌟 原地直編 contentEditable 畫布 (由 useEffect 單次注入，且字級由選字個別套用，外層維持基準字級) */
          <div
            ref={editorRef}
            className="memo-text-surface"
            contentEditable={true}
            spellCheck={false}
            suppressContentEditableWarning={true}
            style={{
              lineHeight: effectiveLineHeight,
              fontSize: `${targetWidget.memoFontSize || 18}px`
            }}
            onKeyUp={saveSelection}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => {
              e.stopPropagation();
              saveSelection();
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.stopPropagation();
              setTimeout(saveSelection, 50);
            }}
            onBlur={() => {
              checkSelectionState();
            }}
          />
        ) : (
          /* 平時唯讀展示 */
          <div
            className="memo-text-surface"
            style={{
              lineHeight: effectiveLineHeight,
              fontSize: `${targetWidget.memoFontSize || 18}px`
            }}
            dangerouslySetInnerHTML={{ __html: defaultInitialHtml }}
          />
        )}
      </div>
    );
  };

  // 渲染各類型小工具組件
  const renderWidgetContent = (widget: HomeWidgetConfig) => {
    const { type, size, id } = widget;
    const isPreview = id === 'preview-instance';

    // 💡 預覽展示優先：無實際閱讀或下載紀錄時自動套用 CBETA 官方經典示範資料，確保長條Bar與各規格真實排版完全可見
    const effectiveResumeBooks = (isPreview && resumeBooks.length === 0) ? DEMO_PREVIEW_RESUME : resumeBooks;
    const effectiveDownloadedBooks = (isPreview && downloadedBooks.length === 0) ? DEMO_PREVIEW_RESUME.map(d => d.book) : downloadedBooks;
    const effectiveHighlightsCount = (isPreview && allHighlights.length === 0) ? 12 : allHighlights.length;

    // 💡 🌟 依圖2設計之 4x2 與 4x3 書櫃卡片（上方主題快捷 bar + 下方 4 本或 8 本書方塊按鍵）
    const renderBookShelfCard = (
      themeKey: 'favorites' | 'downloads' | 'history',
      topIcon: React.ReactNode,
      topTitle: string,
      topSub: string,
      onTopClick: () => void,
      books: Array<{
        book: BookMetadata;
        subText: string;
        onClick: () => void;
      }>,
      emptySlot: {
        title: string;
        sub: string;
        onClick: () => void;
      },
      mode: '4x2' | '4x3' = '4x2'
    ) => {
      const slotsCount = mode === '4x3' ? 8 : 4;
      const slots = Array.from({ length: slotsCount }, (_, i) => i);

      return (
        <div className={`widget-books-shelf-${mode}`}>
          {/* 上半部：主功能快捷 Bar（依圖2設計，整體置中） */}
          <div 
            className={`books-shelf-top-strip strip-theme-${themeKey}`}
            onClick={!isLayoutEditMode ? onTopClick : undefined}
            title={`點擊直達書櫃「${topTitle}」`}
            style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
          >
            <div className="download-strip-center-group">
              <div className="books-strip-icon-box">
                {topIcon}
              </div>
              <div className="download-strip-text">
                <span className="download-strip-title">{topTitle}</span>
                <span className="download-strip-sub">{topSub}</span>
              </div>
              <div className="books-strip-arrow" title="前往查看">
                <ArrowRight size={14} strokeWidth={2.4} />
              </div>
            </div>
          </div>

          {/* 下半部：4 個（4x2）或 8 個（4x3）等寬正方形圓角按鈕（書名分 2 行大字，高度 100% 齊平） */}
          <div className="books-shelf-bottom-grid">
            {slots.map((idx) => {
              const item = books[idx];
              if (item) {
                return (
                  <div 
                    key={`shelf-book-slot-${mode}-${themeKey}-${idx}-${item.book.workId}`}
                    className="book-nav-item"
                    onClick={!isLayoutEditMode ? item.onClick : undefined}
                    title={`閱讀《${item.book.title}》`}
                  >
                    <div 
                      className="book-nav-badge"
                      style={{ background: getBookCoverGradient(item.book.workId) }}
                    >
                      <span className="book-nav-badge-text">{item.book.workId}</span>
                    </div>
                    <span className="book-nav-title" title={item.book.title}>
                      {item.book.title}
                    </span>
                  </div>
                );
              }

              return (
                <div 
                  key={`shelf-empty-slot-${mode}-${themeKey}-${idx}`}
                  className="book-nav-item item-empty-slot"
                  onClick={!isLayoutEditMode ? emptySlot.onClick : undefined}
                  title={emptySlot.title}
                >
                  <div className="book-nav-badge-empty">
                    <Plus size={16} strokeWidth={2.4} />
                  </div>
                  <span className="book-nav-title">{emptySlot.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    };
    // 💡 🌟 渲染全新 4x3 4膠囊書櫃小卡（上方為圖1長條Bar，下方為4本膠囊條列無箭頭，如圖2、圖3）
    const renderBookShelfCapsuleCard = (
      themeKey: 'favorites' | 'downloads' | 'history',
      topIcon: React.ReactNode,
      topTitle: string,
      topSub: string,
      onTopClick: () => void,
      books: Array<{
        book: BookMetadata;
        subText: string;
        onClick: () => void;
      }>,
      emptySlot: {
        title: string;
        sub: string;
        onClick: () => void;
      }
    ) => {
      const slots = Array.from({ length: 6 }, (_, i) => i);

      return (
        <div className="widget-books-shelf-4x3-capsule">
          {/* 上半部：主功能快捷 Bar（依圖1設計，長條加長加厚，整體置中） */}
          <div 
            className={`books-shelf-top-strip strip-theme-${themeKey}`}
            onClick={!isLayoutEditMode ? onTopClick : undefined}
            title={`點擊直達書櫃「${topTitle}」`}
            style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
          >
            <div className="download-strip-center-group">
              <div className="books-strip-icon-box">
                {topIcon}
              </div>
              <div className="download-strip-text">
                <span className="download-strip-title">{topTitle}</span>
                <span className="download-strip-sub">{topSub}</span>
              </div>
              <div className="books-strip-arrow" title="前往查看">
                <ArrowRight size={14} strokeWidth={2.4} />
              </div>
            </div>
          </div>

          {/* 下半部：4 個水平膠囊條列（如圖2、圖3，無箭頭） */}
          <div className="books-shelf-capsules-list">
            {slots.map((idx) => {
              const item = books[idx];
              if (item) {
                return (
                  <div 
                    key={`shelf-capsule-slot-${themeKey}-${idx}-${item.book.workId}`}
                    className="book-capsule-item"
                    onClick={!isLayoutEditMode ? item.onClick : undefined}
                    title={`閱讀《${item.book.title}》`}
                  >
                    <div 
                      className="book-capsule-badge"
                      style={{ background: getBookCoverGradient(item.book.workId) }}
                    >
                      <span className="book-capsule-badge-text">{item.book.workId}</span>
                    </div>
                    <div className="book-capsule-info">
                      <div className="book-capsule-title" title={item.book.title}>
                        {item.book.title}
                      </div>
                      <div className="book-capsule-sub" title={item.subText}>
                        {item.subText}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={`shelf-capsule-empty-${themeKey}-${idx}`}
                  className="book-capsule-item item-empty-slot"
                  onClick={!isLayoutEditMode ? emptySlot.onClick : undefined}
                  title={emptySlot.title}
                >
                  <div className="book-capsule-badge-empty">
                    <Plus size={15} strokeWidth={2.4} />
                  </div>
                  <div className="book-capsule-info">
                    <div className="book-capsule-title" style={{ opacity: 0.65 }}>
                      {emptySlot.title}
                    </div>
                    <div className="book-capsule-sub">
                      {emptySlot.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    // 💡 🌟 渲染獨立 4x1 長條 Bar（如圖1、圖2、圖3：左側圖示與文字靠左，右側箭頭靠右，嚴格對齊圖2基準）
    const renderStandaloneBar = (
      themeKey: 'favorites' | 'downloads' | 'history' | 'cbeta',
      icon: React.ReactNode,
      title: string,
      sub: string,
      onClick: () => void
    ) => {
      const isCbeta = themeKey === 'cbeta';
      return (
        <div 
          className={`books-shelf-top-strip ${isCbeta ? 'download-shelf-top-strip' : `strip-theme-${themeKey}`} strip-mode-standalone strip-align-between`}
          onClick={!isLayoutEditMode ? onClick : undefined}
          title={`直達「${title}」`}
          style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
        >
          <div className="strip-bar-left-group">
            <div className={isCbeta ? 'download-strip-icon-box' : 'books-strip-icon-box'}>
              {icon}
            </div>
            <div className="download-strip-text">
              <span className="download-strip-title">{title}</span>
              <span className="download-strip-sub">{sub}</span>
            </div>
          </div>
          <div className={isCbeta ? 'download-strip-arrow' : 'books-strip-arrow'} title="前往查看">
            <ArrowRight size={14} strokeWidth={2.4} />
          </div>
        </div>
      );
    };

    // 💡 🌟 渲染 4x3 書櫃三合一長條卡（依序上至下：近期下載、上次閱讀、我的最愛；左側圖示與文字靠左，右側箭頭靠右，嚴格對齊圖2基準）
    const renderTripleShelfBars4x3 = () => {
      return (
        <div className="widget-shelf-triple-bars-4x3">
          {/* 1. 最上方：近期下載（湛藍色） */}
          <div 
            className="books-shelf-top-strip strip-theme-downloads strip-align-between"
            onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
            title="點擊直達書櫃「近期下載」"
            style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
          >
            <div className="strip-bar-left-group">
              <div className="books-strip-icon-box">
                <Download size={16} color="#ffffff" style={{ strokeWidth: 2.6 }} />
              </div>
              <div className="download-strip-text">
                <span className="download-strip-title">近期下載</span>
                <span className="download-strip-sub">· 查看下載書庫</span>
              </div>
            </div>
            <div className="books-strip-arrow" title="前往查看">
              <ArrowRight size={16} strokeWidth={2.4} />
            </div>
          </div>

          {/* 2. 中間：上次閱讀（琥珀橙） */}
          <div 
            className="books-shelf-top-strip strip-theme-history strip-align-between"
            onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
            title="點擊直達書櫃「上次閱讀」"
            style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
          >
            <div className="strip-bar-left-group">
              <div className="books-strip-icon-box">
                <Clock size={16} color="#ffffff" style={{ strokeWidth: 2.6 }} />
              </div>
              <div className="download-strip-text">
                <span className="download-strip-title">上次閱讀</span>
                <span className="download-strip-sub">· 接續讀誦經藏</span>
              </div>
            </div>
            <div className="books-strip-arrow" title="前往查看">
              <ArrowRight size={16} strokeWidth={2.4} />
            </div>
          </div>

          {/* 3. 最下方：我的最愛（緋紅色） */}
          <div 
            className="books-shelf-top-strip strip-theme-favorites strip-align-between"
            onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
            title="點擊直達書櫃「我的最愛」"
            style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
          >
            <div className="strip-bar-left-group">
              <div className="books-strip-icon-box">
                <Heart size={16} color="#ffffff" style={{ strokeWidth: 2.6 }} />
              </div>
              <div className="download-strip-text">
                <span className="download-strip-title">我的最愛</span>
                <span className="download-strip-sub">· 查看所有收藏</span>
              </div>
            </div>
            <div className="books-strip-arrow" title="前往查看">
              <ArrowRight size={16} strokeWidth={2.4} />
            </div>
          </div>
        </div>
      );
    };

    // 💡 🌟 上次閱讀 · 經文進度 (4x4 規格，上部分 4x1 維持圖1樣式，下部分 4x3 經文文字，外置標題列支援 < > 選擇最多 9 本經書)
    const renderLastReadExcerptCard = () => {
      const maxCount = Math.min(effectiveResumeBooks.length, 9);
      if (maxCount === 0) {
        return (
          <>
            <div className="widget-outside-header-row">
              <div 
                className="widget-outside-tag"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「上次閱讀」"
              >
                上次閱讀 ➔
              </div>
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
          {/* 卡片外、上方純粹標題，完全無按鍵 */}
          <div className="widget-outside-header-row">
            <div 
              className="widget-outside-tag"
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
              title="點擊進入書櫃「上次閱讀」"
            >
              上次閱讀 ➔
            </div>
          </div>

          <div className="lastread-excerpt-card-4x4">
            {/* 上部分：頂部獨立橫排（左側為經書獨立長 Bar，右側為獨立「< | >」切換膠囊） */}
            <div className="lastread-excerpt-top-row">
              <div 
                className="lastread-excerpt-book-bar"
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
              </div>

              {/* 右側：獨立「< | >」極簡切換膠囊 (不包在經書 Bar 內) */}
              {maxCount > 1 && (
                <div 
                  className="lastread-excerpt-nav-pill" 
                  onClick={(e) => e.stopPropagation()}
                  title={`切換經書預覽 (${safeIndex + 1}/${maxCount})`}
                >
                  <button 
                    type="button" 
                    className="nav-pill-btn" 
                    title="切換上一部經書預覽"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedExcerptIndex(prev => (prev - 1 + maxCount) % maxCount);
                    }}
                  >
                    <ChevronLeft size={14} strokeWidth={2.4} />
                  </button>
                  <div className="nav-pill-divider" />
                  <button 
                    type="button" 
                    className="nav-pill-btn" 
                    title="切換下一部經書預覽"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedExcerptIndex(prev => (prev + 1) % maxCount);
                    }}
                  >
                    <ChevronRight size={14} strokeWidth={2.4} />
                  </button>
                </div>
              )}
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

    // 💡 🌟 近期下載、上次閱讀、我的最愛 三合一卡片 (4x4 規格，各 1 本書垂直排列，依圖 1 規格)
    const renderTripleReadingCard = () => {
      // 1. 近期下載 (最新 1 本)
      const actualRecent = getRecentDownloadedBooks(downloadedBooks);
      const recentBook = (isPreview && actualRecent.length === 0) 
        ? DEMO_PREVIEW_RESUME[0]?.book 
        : actualRecent[0];

      // 2. 上次閱讀 (最新 1 本)
      const lastReadItem = effectiveResumeBooks[0] || (isPreview ? DEMO_PREVIEW_RESUME[1] : null);

      // 3. 我的最愛 (依最近點選時間排序之最新 1 本)
      const actualFavs = getRecentFavoriteBooks(downloadedBooks);
      const favBook = (isPreview && actualFavs.length === 0) 
        ? DEMO_PREVIEW_RESUME[2]?.book 
        : actualFavs[0];

      return (
        <div className="triple-reading-card-4x4">
          {/* === 1. 近期下載 === */}
          <div className="triple-section-row">
            <div className="widget-outside-header-row">
              <div 
                className="widget-outside-tag"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「近期下載」"
              >
                近期下載 ➔
              </div>
            </div>
            <div className="book-widget-card-box box-4x1">
              {recentBook ? (
                <div 
                  className="book-stack-item-4x4"
                  onClick={!isLayoutEditMode ? () => onSelectBook(recentBook.workId) : undefined}
                  style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                >
                  <div className="book-badge" style={{ background: getBookCoverGradient(recentBook.workId) }}>
                    {recentBook.workId}
                  </div>
                  <div className="book-info">
                    <div className="b-title" title={recentBook.title}>{recentBook.title}</div>
                    <div className="b-sub">
                      {recentBook.juansCount ? `全 ${recentBook.juansCount} 卷` : ''}
                      {recentBook.creators ? ` · ${sanitizeCreators(recentBook.creators)}` : ''}
                    </div>
                  </div>
                  <button type="button" className="cbeta-read-btn" title="閱讀經典">
                    <ArrowRight size={17} strokeWidth={2.4} />
                  </button>
                </div>
              ) : (
                <div 
                  style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                  onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
                >
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>近期下載：暫無已下載經典 (點擊進入書櫃)</span>
                </div>
              )}
            </div>
          </div>

          {/* === 2. 上次閱讀 === */}
          <div className="triple-section-row">
            <div className="widget-outside-header-row">
              <div 
                className="widget-outside-tag"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「上次閱讀」"
              >
                上次閱讀 ➔
              </div>
            </div>
            <div className="book-widget-card-box box-4x1">
              {lastReadItem ? (
                <div 
                  className="book-stack-item-4x4"
                  onClick={!isLayoutEditMode ? () => onSelectBook(lastReadItem.book.workId, lastReadItem.progress?.segmentId, undefined, 'resume') : undefined}
                  style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                >
                  <div className="book-badge" style={{ background: getBookCoverGradient(lastReadItem.book.workId) }}>
                    {lastReadItem.book.workId}
                  </div>
                  <div className="book-info">
                    <div className="b-title" title={lastReadItem.book.title}>{lastReadItem.book.title}</div>
                    <div className="b-sub">
                      {lastReadItem.progress?.juan ? `第 ${lastReadItem.progress.juan} 卷` : (lastReadItem.book.juansCount ? `全 ${lastReadItem.book.juansCount} 卷` : '閱讀中')}
                      {lastReadItem.book.creators ? ` · ${sanitizeCreators(lastReadItem.book.creators)}` : ''}
                    </div>
                  </div>
                  <button type="button" className="cbeta-read-btn" title="繼續閱讀">
                    <ArrowRight size={17} strokeWidth={2.4} />
                  </button>
                </div>
              ) : (
                <div 
                  style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                  onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
                >
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>上次閱讀：尚無閱讀進度 (點擊進入書櫃)</span>
                </div>
              )}
            </div>
          </div>

          {/* === 3. 我的最愛 === */}
          <div className="triple-section-row">
            <div className="widget-outside-header-row">
              <div 
                className="widget-outside-tag"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「我的最愛」"
              >
                我的最愛 ➔
              </div>
            </div>
            <div className="book-widget-card-box box-4x1">
              {favBook ? (
                <div 
                  className="book-stack-item-4x4"
                  onClick={!isLayoutEditMode ? () => onSelectBook(favBook.workId) : undefined}
                  style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                >
                  <div className="book-badge" style={{ background: getBookCoverGradient(favBook.workId) }}>
                    {favBook.workId}
                  </div>
                  <div className="book-info">
                    <div className="b-title" title={favBook.title}>{favBook.title}</div>
                    <div className="b-sub">
                      {favBook.juansCount ? `全 ${favBook.juansCount} 卷` : ''}
                      {favBook.creators ? ` · ${sanitizeCreators(favBook.creators)}` : ''}
                    </div>
                  </div>
                  <button type="button" className="cbeta-read-btn" title="閱讀經典">
                    <ArrowRight size={17} strokeWidth={2.4} />
                  </button>
                </div>
              ) : (
                <div 
                  style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                  onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
                >
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>我的最愛：尚未收藏任何經典 (點擊進入書櫃)</span>
                </div>
              )}
            </div>
          </div>
        </div>
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
                <h2 className="title-brand-heading" style={{ fontFamily: 'var(--font-rounded, sans-serif)', fontSize: '1.45rem', fontWeight: 800, margin: 0, lineHeight: 1.15, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#1ea98c', letterSpacing: '0.04em' }}>CBETA</span>
                  <span className="title-brand-text" style={{ marginTop: '0.2rem', letterSpacing: '0.04em' }}>Reader</span>
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

      // 2. 禪意 App Icon (純淨正方形圓角圖片，點擊循環換圖，等比 2x2 正方形)
      case 'appicon_2x2': {
        const iconIdx = widget.iconIndex || 1;
        const iconSrc = ZEN_ICONS_LIST[(iconIdx - 1) % ZEN_ICONS_LIST.length];

        return (
          <div 
            className="widget-pure-zen-icon"
            onClick={!isLayoutEditMode ? (e) => handleCycleZenIcon(widget.id, e) : undefined}
            title={`點擊切換禪心蓮花圖標 (共 ${ZEN_ICONS_LIST.length} 款)`}
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
                title="已下載經典全文檢索"
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
                title="已下載經典全文檢索"
              >
                <div className="compact-nav-icon-4x2">
                  <Search size={20} color="#ffffff" style={{ strokeWidth: 2.4 }} />
                </div>
                <div className="compact-nav-label-4x2">全文檢索</div>
                <div className="compact-nav-badge-4x2">全文檢索</div>
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
                title="已下載經典全文檢索"
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
              title="已下載經典全文檢索"
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

      // 8-0-1. 🌟 近期下載、上次閱讀、我的最愛 三合一卡片 (4x4 規格)
      case 'triple_reading_4x4': {
        return renderTripleReadingCard();
      }

      // 8. 上次閱讀 (支援 4x1 / 4x2 / 4x3 / 4x4 共 1~4 本經典)
      case 'lastread_4x2':
      case 'lastread_4x1': {
        const lastBook = effectiveResumeBooks[0];
        if (!lastBook) {
          if (size === 'size-4x2' || size === 'size-4x1') {
            return (
              <>
                <div className="widget-outside-header-row">
                  <div 
                    className="widget-outside-tag"
                    onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
                    style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                    title="點擊進入書櫃「上次閱讀」"
                  >
                    上次閱讀 ➔
                  </div>
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
              <div className="widget-outside-header-row">
                <div 
                  className="widget-outside-tag"
                  onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
                  style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                  title="點擊進入書櫃「上次閱讀」"
                >
                  上次閱讀 ➔
                </div>
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
            <div className="widget-header-row-4x4">
              <div 
                className="widget-tag-4x4"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「上次閱讀」"
              >
                上次閱讀 ➔
              </div>
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
        const actualFavs = getRecentFavoriteBooks(downloadedBooks);
        const favoriteBooks = (isPreview && actualFavs.length === 0) ? DEMO_PREVIEW_RESUME.map(d => d.book) : actualFavs;

        if (favoriteBooks.length === 0) {
          if (size === 'size-4x2' || size === 'size-4x1') {
            return (
              <>
                <div className="widget-outside-header-row">
                  <div 
                    className="widget-outside-tag"
                    onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
                    style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                    title="點擊進入書櫃「我的最愛」"
                  >
                    我的最愛 ➔
                  </div>
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
              <div className="widget-outside-header-row">
                <div 
                  className="widget-outside-tag"
                  onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
                  style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                  title="點擊進入書櫃「我的最愛」"
                >
                  我的最愛 ➔
                </div>
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
            <div className="widget-header-row-4x4">
              <div 
                className="widget-tag-4x4"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「我的最愛」"
              >
                我的最愛 ➔
              </div>
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
        const actualRecent = getRecentDownloadedBooks(downloadedBooks);
        const recentDownloadedBooks = (isPreview && actualRecent.length === 0) ? DEMO_PREVIEW_RESUME.map(d => d.book) : actualRecent;

        if (recentDownloadedBooks.length === 0) {
          if (size === 'size-4x2' || size === 'size-4x1') {
            return (
              <>
                <div className="widget-outside-header-row">
                  <div 
                    className="widget-outside-tag"
                    onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
                    style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                    title="點擊進入書櫃「近期下載」"
                  >
                    近期下載 ➔
                  </div>
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
              <div className="widget-outside-header-row">
                <div 
                  className="widget-outside-tag"
                  onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
                  style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                  title="點擊進入書櫃「近期下載」"
                >
                  近期下載 ➔
                </div>
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
            <div className="widget-header-row-4x4">
              <div 
                className="widget-tag-4x4"
                onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
                style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
                title="點擊進入書櫃「近期下載」"
              >
                近期下載 ➔
              </div>
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

      // 11. 每日閱讀日誌 (比照 iOS 月曆樣式：支援 2x2 與 4x2 規格)
      case 'stats_2x2': {
        const { isToday, items, totalTodayMinutes } = getCalendarWidgetItems();
        const now = new Date();
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const currentWeekday = weekdays[now.getDay()];
        const currentDay = now.getDate();
        const lunarInfo = getLunarInfo(now);

        if (size === 'size-1x1') {
          return (
            <div 
              className="core-widget-1x1"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('reading-log') : undefined}
            >
              <CalendarDays size={20} style={{ color: 'var(--color-gold, #c07d2a)', marginBottom: 2 }} />
              <div className="core-title-small">閱讀日誌</div>
            </div>
          );
        }

        // 4x2 規格：iOS 月曆與讀經日程寬版小卡
        if (size === 'size-4x2') {
          return (
            <div 
              className="ios-calendar-widget-4x2"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('reading-log') : undefined}
              title="點擊查看每日閱讀日誌"
            >
              {/* 左側：iOS 經典日曆方塊（已簡化：省略西元年月，突顯星期、當日與農曆） */}
              <div className="cal-left-block">
                <div className="cal-weekday-label">{currentWeekday}</div>
                <div className="cal-day-number">{currentDay}</div>
                <div className="cal-lunar-label" title={lunarInfo.noteDetail}>
                  農曆{lunarInfo.fullStr}{lunarInfo.festival ? ` · ${lunarInfo.cellLabel}` : (lunarInfo.isZhai ? ' · 十齋' : '')}
                </div>
                <div className={`cal-bottom-tag ${isToday ? 'active' : ''}`}>
                  {isToday ? (totalTodayMinutes && totalTodayMinutes > 0 ? `今日 ${totalTodayMinutes}分鐘` : '今日修持') : '每日日誌'}
                </div>
              </div>

              {/* 右側：完整經名與讀經摘要列表 */}
              <div className="cal-right-block">
                <div className="cal-right-header">
                  <div className="cal-right-title">
                    <CalendarDays size={13} style={{ color: 'var(--color-gold, #c07d2a)' }} />
                    <span>{isToday ? '今日讀經' : '近日閱讀'}</span>
                  </div>
                  <div className="cal-right-more">
                    <span>日誌</span>
                    <ArrowRight size={11} />
                  </div>
                </div>

                <div className="cal-events-list">
                  {items.length > 0 ? (
                    items.slice(0, 2).map((item, idx) => (
                      <div key={item.workId + idx} className="cal-event-row">
                        <div className={`cal-event-stripe ${idx % 2 === 1 ? 'stripe-1' : ''}`} />
                        <div className="cal-event-info">
                          <div className="cal-event-name">{item.title}</div>
                          <div className="cal-event-detail">{item.detail}</div>
                        </div>
                        {!isLayoutEditMode && (
                          <button
                            type="button"
                            className="cal-book-action-btn"
                            title="直接開啟此經閱讀"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBook(item.workId, undefined, undefined, 'resume');
                            }}
                          >
                            <ArrowRight size={12} strokeWidth={2.4} />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="cal-empty-state">
                      <div className="cal-event-stripe" />
                      <div className="cal-event-info">
                        <div className="cal-event-name">今日靜心讀經</div>
                        <div className="cal-event-detail">點擊開啟經典修持 ➔</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // 預設 2x2 正方形規格：iOS 月曆小卡樣式 (已簡化：省略月份，當日日期 + 小小字農曆 + 1~2 則經書摘要)
        return (
          <div 
            className="ios-calendar-widget-2x2"
            onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('reading-log') : undefined}
            title="點擊查看每日閱讀日誌"
          >
            {/* 上部：經典 iOS 日期頭部（省略月份，29 旁配置農曆標籤） */}
            <div className="cal-2x2-header">
              <div className="cal-2x2-date-box">
                <div className="cal-2x2-weekday">{currentWeekday}</div>
                <div className="cal-2x2-day-row">
                  <span className="cal-2x2-day">{currentDay}</span>
                  <span className="cal-2x2-lunar-badge" title={lunarInfo.noteDetail}>
                    農曆{lunarInfo.fullStr}{lunarInfo.festival ? ` · ${lunarInfo.cellLabel}` : (lunarInfo.isZhai ? ' · 十齋' : '')}
                  </span>
                </div>
              </div>
              <div className={`cal-2x2-status-pill ${isToday ? 'active' : ''}`}>
                {isToday ? (totalTodayMinutes && totalTodayMinutes > 0 ? `已讀 ${totalTodayMinutes}分` : '今日已讀') : '閱讀日誌'}
              </div>
            </div>

            {/* 下部：1~2 則經書摘要 */}
            <div className="cal-2x2-summary-box">
              {items.length > 0 ? (
                items.slice(0, 2).map((item, idx) => (
                  <div key={item.workId + idx} className="cal-2x2-item">
                    <div className={`cal-2x2-stripe ${idx % 2 === 1 ? 'stripe-1' : ''}`} />
                    <div className="cal-2x2-text">
                      <div className="cal-2x2-title">{item.title}</div>
                      <div className="cal-2x2-sub">{item.detail}</div>
                    </div>
                    {!isLayoutEditMode && (
                      <button
                        type="button"
                        className="cal-book-action-btn"
                        title="直接開啟此經閱讀"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBook(item.workId, undefined, undefined, 'resume');
                        }}
                      >
                        <ArrowRight size={11} strokeWidth={2.4} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="cal-2x2-item">
                  <div className="cal-2x2-stripe" />
                  <div className="cal-2x2-text">
                    <div className="cal-2x2-title">今日靜心讀經</div>
                    <div className="cal-2x2-sub">點擊查看閱讀日誌 ➔</div>
                  </div>
                </div>
              )}
            </div>
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

      // 12-B. 今日佛曆小卡 (4x1 水平膠囊長條，已移除「查看日曆>」)
      case 'calendar_banner_4x1': {
        const now = new Date();
        const lunarInfo = getLunarInfo(now);
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        let iconEmoji = '🌿';
        let title = '今日十齋日';
        let badgeText = '十齋日';
        let badgeClass = 'badge-zhai';
        let subText = `${dateStr} · 農曆${lunarInfo.fullStr} · 持齋念佛，滅罪增福`;

        if (lunarInfo.festival) {
          iconEmoji = '🌸';
          title = lunarInfo.festival;
          badgeText = '聖誕紀念';
          badgeClass = 'badge-festival';
          subText = `${dateStr} · 農曆${lunarInfo.fullStr} · 大悲拔苦，智慧增益`;
        } else if (!lunarInfo.isZhai) {
          iconEmoji = '📜';
          title = '今日佛曆閱藏';
          badgeText = '修持日';
          badgeClass = 'badge-normal';
          subText = `${dateStr} · 農曆${lunarInfo.fullStr} · 深入經藏，智慧如海`;
        }

        return (
          <div 
            className="home-calendar-banner-4x1"
            onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('reading-log') : undefined}
            title="點擊前往閱讀與修持日誌"
          >
            <div className="home-cal-banner-left">
              <div className="home-cal-banner-icon">{iconEmoji}</div>
              <div className="home-cal-banner-content">
                <div className="home-cal-banner-main">
                  <span>{title}</span>
                  <span className={`home-cal-banner-badge ${badgeClass}`}>{badgeText}</span>
                </div>
                <div className="home-cal-banner-sub">{subText}</div>
              </div>
            </div>
          </div>
        );
      }

      // 12-C. 隨喜撥珠小卡 (4x1 左:大類膠囊 中:中類膠囊 右:合十念珠圖案按鈕)
      case 'practice_bead_4x1': {
        const existing = todayPracticeLogs.find(p => p.name === beadName);
        const todayCount = existing ? existing.count : 0;
        let unit = practiceCategories[beadCategory]?.unit || '聲';
        if (beadName === '禮佛大拜') unit = '拜';
        if (beadName === '靜坐禪修') unit = '分鐘';

        return (
          <div 
            className="home-practice-bead-widget-4x1" 
            style={{ position: 'relative', cursor: isLayoutEditMode ? 'default' : 'pointer' }}
            onClick={!isLayoutEditMode ? (e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.bead-combo-capsule') || target.closest('.dropdown-menu-box')) {
                return;
              }
              handleHomeBeadTap(e);
            } : undefined}
          >
            {/* 1. 左側區塊：大類與中類二合一綜合膠囊 (文字放大，左側分立選單) */}
            <div className="bead-combo-capsule">
              {/* 大類子按鈕 */}
              <div 
                className="combo-part-cat"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  if (isLayoutEditMode) return;
                  e.stopPropagation();
                  setShowBeadMidMenu(false);
                  setShowBeadCatMenu(prev => !prev);
                }}
                onClick={!isLayoutEditMode ? (e) => {
                  e.stopPropagation();
                  setShowBeadMidMenu(false);
                  setShowBeadCatMenu(prev => !prev);
                } : undefined}
                title="點擊切換大類"
              >
                <span className="combo-cat-name">{practiceCategories[beadCategory]?.name || '佛號'}</span>
                <span className="combo-arrow-down">▾</span>
              </div>

              {/* 中間精細分割線 */}
              <div className="combo-divider" />

              {/* 中類子按鈕 (文字放大，至少顯示10字) */}
              <div 
                className="combo-part-mid"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  if (isLayoutEditMode) return;
                  e.stopPropagation();
                  setShowBeadCatMenu(false);
                  setShowBeadMidMenu(prev => !prev);
                }}
                onClick={!isLayoutEditMode ? (e) => {
                  e.stopPropagation();
                  setShowBeadCatMenu(false);
                  setShowBeadMidMenu(prev => !prev);
                } : undefined}
                title="點擊切換項目"
              >
                <span className="combo-mid-name">{beadName}</span>
                <span className="combo-arrow-down">▾</span>
              </div>
            </div>

            {/* 2. 右側區塊：今日次數(純數字) + 敲木魚按鈕 (背景色塊合併區塊) */}
            <div className="bead-action-island" title={`今日已念 ${todayCount} ${unit}`}>
              <div className="bead-island-count">
                <span className="bead-island-num">{todayCount.toLocaleString()}</span>
              </div>

              {/* 圓形敲木魚按鈕 (圖1風格) */}
              <button 
                type="button"
                className={`home-bead-tap-btn ${beadTapAnim ? 'tapped' : ''}`}
                title="敲木魚誦念 (+1)"
                onClick={!isLayoutEditMode ? handleHomeBeadTap : undefined}
              >
                {/* 向量敲木魚圖案 (圖1) */}
                <svg className="bead-muyu-svg" viewBox="0 0 100 100" aria-hidden="true">
                  <defs>
                    <linearGradient id="muyu_bg_grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#cce1d2" />
                      <stop offset="100%" stopColor="#accfb8" />
                    </linearGradient>
                    <linearGradient id="muyu_wood_body" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#a36e4b" />
                      <stop offset="100%" stopColor="#7a4625" />
                    </linearGradient>
                  </defs>

                  {/* 圓形淡綠底色 */}
                  <circle cx="50" cy="50" r="47" fill="url(#muyu_bg_grad)" stroke="#ffffff" strokeWidth="2.5" />

                  {/* 敲擊節奏音浪線條 (橙黃光束) */}
                  <line x1="65" y1="33" x2="69" y2="19" stroke="#e69627" strokeWidth="3.6" strokeLinecap="round" />
                  <line x1="77" y1="36" x2="88" y2="26" stroke="#e69627" strokeWidth="3.6" strokeLinecap="round" />

                  {/* 木魚厚圓底座 */}
                  <rect x="22" y="65" width="46" height="13" rx="6.5" fill="#583015" stroke="#361a0a" strokeWidth="2.4" />

                  {/* 木魚主身 (圓拱型) */}
                  <path d="M 23 66 C 22 41 33 28 45 28 C 57 28 69 41 68 66 Z" fill="url(#muyu_wood_body)" stroke="#361a0a" strokeWidth="2.4" />

                  {/* 木魚頂部高光光影 */}
                  <ellipse cx="53" cy="37" rx="4.5" ry="2.6" transform="rotate(-20 53 37)" fill="#ffffff" opacity="0.4" />

                  {/* 木魚開口橫縫 (黑褐色彎道孔) */}
                  <path d="M 27 61 C 37 47 53 49 63 56 C 61 60 45 53 29 63 Z" fill="#301607" stroke="#301607" strokeWidth="0.8" strokeLinejoin="round" />

                  {/* 木魚槌手柄 (斜向右下延伸) */}
                  <line x1="73" y1="51" x2="90" y2="76" stroke="#6e3914" strokeWidth="5.5" strokeLinecap="round" />

                  {/* 木魚槌頭 (圓形象牙白槌球) */}
                  <circle cx="72" cy="49" r="7.5" fill="#fdfaf2" stroke="#361a0a" strokeWidth="2.2" />
                  <circle cx="70" cy="47" r="2.2" fill="#ffffff" />
                </svg>

                {/* 點擊浮現 +1 動畫 */}
                {beadTapAnim && <span className="bead-tap-plus-one">+1</span>}
              </button>
            </div>

            {/* 全螢幕背景遮罩，保證點擊外側平滑關閉 */}
            {(showBeadCatMenu || showBeadMidMenu) && (
              <div 
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 999,
                  backgroundColor: 'transparent'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBeadCatMenu(false);
                  setShowBeadMidMenu(false);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setShowBeadCatMenu(false);
                  setShowBeadMidMenu(false);
                }}
              />
            )}

            {/* 大類下拉選單 (圖2：純文字，無筆無管理) */}
            {showBeadCatMenu && (
              <div className="dropdown-menu-box active bead-cat-dropdown" onClick={e => e.stopPropagation()}>
                {Object.keys(practiceCategories).map(catKey => {
                  const cat = practiceCategories[catKey];
                  return (
                    <div 
                      key={catKey}
                      className={`dropdown-item ${beadCategory === catKey ? 'active' : ''}`}
                      onClick={() => handleSelectBeadCategory(catKey)}
                    >
                      <span>{cat.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 中類下拉選單 (圖3：純項目，無筆無管理) */}
            {showBeadMidMenu && (
              <div className="dropdown-menu-box active bead-mid-dropdown" onClick={e => e.stopPropagation()}>
                {(practiceCategories[beadCategory]?.items || []).length === 0 ? (
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', padding: '6px 12px', textAlign: 'center' }}>
                    尚無項目
                  </div>
                ) : (
                  (practiceCategories[beadCategory]?.items || []).map(item => (
                    <div
                      key={item}
                      className={`dropdown-item ${beadName === item ? 'active' : ''}`}
                      onClick={() => handleSelectBeadName(item)}
                    >
                      <span>{item}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      }

      // 13. 自訂便籤小卡 (支援 2x2 / 4x2 / 4x3 / 4x4 / 4x1)
      case 'custom_memo': {
        return renderCustomMemoCard(widget, isPreview);
      }

      // 14. 下載與書櫃卡（支援 4x2 與 4x3：依圖1編排：下載經典在上且內容整體置中，快捷按鍵在下，支援自由增減與調換左右）
      case 'download_shelf_4x3': {
        const is4x2 = widget.size === 'size-4x2';
        const iconSize = is4x2 ? 18 : 28;
        const plusSize = is4x2 ? 13 : 18;
        const arrowSize = is4x2 ? 14 : 18;
        const defaultButtons = is4x2 ? DEFAULT_SHELF_NAV_BUTTONS_4X2 : DEFAULT_SHELF_NAV_BUTTONS_4X3;
        const rawShelfButtons = (widget.customNavButtons && widget.customNavButtons.length > 0)
          ? widget.customNavButtons
          : defaultButtons;
        const shelfButtons = ensureBrandFirst(rawShelfButtons);

        return (
          <div 
            className={`widget-download-shelf-4x3 ${is4x2 ? 'mode-4x2' : 'mode-4x3'}`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingNavWidget(widget);
              setSelectedNavSlotIndex(1);
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.three-nav-item') || target.closest('.download-shelf-top-strip')) return;
              const now = Date.now();
              if (lastNavTapRef.current.id === widget.id && (now - lastNavTapRef.current.time) < 450) {
                setEditingNavWidget(widget);
                setSelectedNavSlotIndex(1);
                lastNavTapRef.current = { id: '', time: 0 };
              } else {
                lastNavTapRef.current = { id: widget.id, time: now };
              }
            }}
            onTouchEnd={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.three-nav-item') || target.closest('.download-shelf-top-strip')) return;
              const now = Date.now();
              if (lastNavTapRef.current.id === widget.id && (now - lastNavTapRef.current.time) < 450) {
                e.preventDefault();
                setEditingNavWidget(widget);
                setSelectedNavSlotIndex(1);
                lastNavTapRef.current = { id: '', time: 0 };
              } else {
                lastNavTapRef.current = { id: widget.id, time: now };
              }
            }}
            title="點擊左側「CBETA Reader」2 下可自訂快捷功能"
          >
            {/* 上半部：下載經典（符號「+」和文字「下載經典」(及小標)、「→」整體置中） */}
            <div 
              className="download-shelf-top-strip"
              onClick={!isLayoutEditMode ? onOpenCbetaCatalog : undefined}
              title="前往 CBETA 藏經庫下載經典"
              style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
            >
              <div className="download-strip-center-group">
                <div className="download-strip-icon-box">
                  <Plus size={plusSize} color="#ffffff" style={{ strokeWidth: 2.6 }} />
                </div>
                <div className="download-strip-text">
                  <span className="download-strip-title">下載經典</span>
                  <span className="download-strip-sub">· 從CBETA資料庫下載</span>
                </div>
                <div className="download-strip-arrow" title="前往下載">
                  <ArrowRight size={arrowSize} strokeWidth={2.4} />
                </div>
              </div>
            </div>

            {/* 下半部：快捷按鍵列 (第 1 格固定為 CBETA Reader，支援自由增減與調換其餘按鍵) */}
            <div 
              className="download-shelf-bottom-grid"
              style={{ gridTemplateColumns: `repeat(${shelfButtons.length}, minmax(0, 1fr))` }}
            >
              {shelfButtons.map((btnKey, idx) => {
                const def = QUICK_NAV_BUTTON_DEFS[btnKey] || QUICK_NAV_BUTTON_DEFS['download'];
                const isBrandFirst = idx === 0 && btnKey === 'brand_title';
                return (
                  <div 
                    key={`shelf-btn-${widget.id}-${idx}-${btnKey}`}
                    className={`three-nav-item item-${btnKey}`}
                    onClick={(e) => handleNavButtonClick(btnKey, widget, e)}
                    onDoubleClick={isBrandFirst ? (e) => {
                      e.stopPropagation();
                      setEditingNavWidget(widget);
                      setSelectedNavSlotIndex(1);
                    } : undefined}
                    onTouchEnd={isBrandFirst ? (e) => {
                      const now = Date.now();
                      if (lastBrandNavTapRef.current.id === widget.id && (now - lastBrandNavTapRef.current.time) < 450) {
                        e.preventDefault();
                        e.stopPropagation();
                        lastBrandNavTapRef.current = { id: '', time: 0 };
                        setEditingNavWidget(widget);
                        setSelectedNavSlotIndex(1);
                      } else {
                        lastBrandNavTapRef.current = { id: widget.id, time: now };
                      }
                    } : undefined}
                    title={
                      isBrandFirst 
                        ? (!isLayoutEditMode ? 'CBETA Reader (連續點 2 下自訂快捷功能)' : '首頁快捷 (固定第 1 格)')
                        : (!isLayoutEditMode ? def.actionTitle : `按鍵 ${idx + 1}：${def.name}`)
                    }
                  >
                    {renderQuickNavItemContent(btnKey, iconSize, widget.iconIndex || 1, false)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      // 15. 圖1單獨 4x2 卡片：書櫃快捷卡（近期下載、上次閱讀、我的最愛，無滑動直接進入）
      case 'shelf_quick_4x2': {
        return (
          <div className="widget-three-nav-4x2 shelf-quick-card">
            {/* 1. 近期下載 */}
            <div 
              className="three-nav-item item-downloads"
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')) : undefined}
              title="查看近期下載之經典"
            >
              <div className="three-nav-icon icon-downloads">
                <Download size={22} strokeWidth={2.4} />
              </div>
              <span className="three-nav-label">近期下載</span>
            </div>

            {/* 2. 上次閱讀 */}
            <div 
              className="three-nav-item item-history"
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')) : undefined}
              title="查看上次閱讀歷史"
            >
              <div className="three-nav-icon icon-history">
                <Clock size={22} strokeWidth={2.4} />
              </div>
              <span className="three-nav-label">上次閱讀</span>
            </div>

            {/* 3. 我的最愛 */}
            <div 
              className="three-nav-item item-favorites"
              onClick={!isLayoutEditMode ? () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')) : undefined}
              title="查看收藏之最愛經典"
            >
              <div className="three-nav-icon icon-favorites">
                <Heart size={22} strokeWidth={2.4} />
              </div>
              <span className="three-nav-label">我的最愛</span>
            </div>
          </div>
        );
      }

      // 15. 圖2單獨 4x2 卡片：系統導航卡（我的書櫃、我的筆記、全文檢索，秒速直達）
      case 'system_nav_4x2': {
        return (
          <div className="widget-three-nav-4x2 system-nav-card">
            {/* 1. 我的書櫃 */}
            <div 
              className="three-nav-item item-shelf"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('shelf') : undefined}
              title="直達我的書櫃全部經典"
            >
              <div className="three-nav-icon icon-shelf">
                <Folder size={22} strokeWidth={2.4} />
              </div>
              <span className="three-nav-label">我的書櫃</span>
            </div>

            {/* 2. 我的筆記 */}
            <div 
              className="three-nav-item item-notes"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('notes') : undefined}
              title="查看重點劃線與個人筆記"
            >
              <div className="three-nav-icon icon-notes">
                <Notebook size={22} strokeWidth={2.4} />
              </div>
              <span className="three-nav-label">我的筆記</span>
            </div>

            {/* 3. 全文檢索 */}
            <div 
              className="three-nav-item item-search"
              onClick={!isLayoutEditMode ? () => onNavigateToLibrarySection('search') : undefined}
              title="全文檢索已下載經典"
            >
              <div className="three-nav-icon icon-search">
                <Search size={22} strokeWidth={2.4} />
              </div>
              <span className="three-nav-label">全文檢索</span>
            </div>
          </div>
        );
      }

      // 16. 快捷功能卡片（圖1預設 10 個格子配置：固定 5 欄雙排，左上角固定為圖4，允許空格）
      case 'quick_nav_4x2': {
        const is4x3 = widget.size === 'size-4x3';
        const defaultButtons = DEFAULT_QUICK_NAV_BUTTONS;
        const rawNavButtons = widget.customNavButtons && widget.customNavButtons.length > 0
          ? widget.customNavButtons
          : defaultButtons;
        const navButtons = normalizeQuickNav10Buttons(rawNavButtons);
        const iconSize = is4x3 ? 24 : 15;

        return (
          <div 
            className={`widget-eight-nav-4x2 ${is4x3 ? 'mode-4x3' : 'mode-4x2'} mode-5-col`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingNavWidget(widget);
              setSelectedNavSlotIndex(1);
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.eight-nav-item')) return;
              const now = Date.now();
              if (lastNavTapRef.current.id === widget.id && (now - lastNavTapRef.current.time) < 450) {
                setEditingNavWidget(widget);
                setSelectedNavSlotIndex(1);
                lastNavTapRef.current = { id: '', time: 0 };
              } else {
                lastNavTapRef.current = { id: widget.id, time: now };
              }
            }}
            onTouchEnd={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('.eight-nav-item')) return;
              const now = Date.now();
              if (lastNavTapRef.current.id === widget.id && (now - lastNavTapRef.current.time) < 450) {
                e.preventDefault();
                setEditingNavWidget(widget);
                setSelectedNavSlotIndex(1);
                lastNavTapRef.current = { id: '', time: 0 };
              } else {
                lastNavTapRef.current = { id: widget.id, time: now };
              }
            }}
            title="點擊左上角「CBETA Reader」2 下可自訂快捷功能"
          >
            <div 
              className="eight-nav-grid grid-5-col"
              style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
            >
              {navButtons.map((btnKey, idx) => {
                const isBrandFirst = idx === 0 && btnKey === 'brand_title';
                // 💡 空格：保留完整空間佔位，其他按鍵維持不動
                if (btnKey === 'empty' || !btnKey) {
                  return (
                    <div 
                      key={`eight-empty-${widget.id}-${idx}`}
                      className="eight-nav-item item-empty"
                      style={{ opacity: 0, pointerEvents: 'none', visibility: 'hidden' }}
                    />
                  );
                }

                const def = QUICK_NAV_BUTTON_DEFS[btnKey] || QUICK_NAV_BUTTON_DEFS['download'];
                return (
                  <div 
                    key={`eight-btn-${widget.id}-${idx}-${btnKey}`}
                    className={`eight-nav-item item-${btnKey}`}
                    onClick={(e) => handleNavButtonClick(btnKey, widget, e)}
                    onDoubleClick={isBrandFirst ? (e) => {
                      e.stopPropagation();
                      setEditingNavWidget(widget);
                      setSelectedNavSlotIndex(1);
                    } : undefined}
                    onTouchEnd={isBrandFirst ? (e) => {
                      const now = Date.now();
                      if (lastBrandNavTapRef.current.id === widget.id && (now - lastBrandNavTapRef.current.time) < 450) {
                        e.preventDefault();
                        e.stopPropagation();
                        lastBrandNavTapRef.current = { id: '', time: 0 };
                        setEditingNavWidget(widget);
                        setSelectedNavSlotIndex(1);
                      } else {
                        lastBrandNavTapRef.current = { id: widget.id, time: now };
                      }
                    } : undefined}
                    title={
                      isBrandFirst 
                        ? (!isLayoutEditMode ? 'CBETA Reader (連續點 2 下自訂快捷功能)' : '首頁快捷 (固定第 1 格)')
                        : (!isLayoutEditMode ? def.actionTitle : `按鍵 ${idx + 1}：${def.name}`)
                    }
                  >
                    {renderQuickNavItemContent(btnKey, iconSize, widget.iconIndex || 1, false)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      // 17. 依圖示設計之「我的最愛」群組小卡（支援 4x1、4x2、4x3 自由拉伸切換）
      case 'shelf_fav_4x2':
      case 'shelf_fav_4x3':
      case 'bar_fav_4x1': {
        if (size === 'size-4x1') {
          return renderStandaloneBar(
            'favorites',
            <Heart size={15} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
            '我的最愛',
            '· 查看所有收藏',
            () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf'))
          );
        }

        const actualFavs = getRecentFavoriteBooks(downloadedBooks);
        const favBooks = (isPreview && actualFavs.length === 0)
          ? DEMO_PREVIEW_RESUME.map(d => d.book)
          : actualFavs;
        const targetCount = size === 'size-4x3' ? 8 : 4;
        const displayFavs = favBooks.slice(0, targetCount);

        const bookSlots = displayFavs.map(b => ({
          book: b,
          subText: b.juansCount ? `全 ${b.juansCount} 卷` : '經典',
          onClick: () => onSelectBook(b.workId)
        }));

        return renderBookShelfCard(
          'favorites',
          <Heart size={14} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
          '我的最愛',
          '· 查看所有收藏',
          () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')),
          bookSlots,
          {
            title: '收藏經典',
            sub: '前往書櫃',
            onClick: () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf'))
          },
          size === 'size-4x3' ? '4x3' : '4x2'
        );
      }

      // 18. 依圖示設計之「近期下載」群組小卡（支援 4x1、4x2、4x3 自由拉伸切換）
      case 'shelf_down_4x2':
      case 'shelf_down_4x3':
      case 'bar_down_4x1': {
        if (size === 'size-4x1') {
          return renderStandaloneBar(
            'downloads',
            <Download size={15} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
            '近期下載',
            '· 查看下載書庫',
            () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf'))
          );
        }

        const actualRecent = getRecentDownloadedBooks(downloadedBooks);
        const recentDownloadedBooks = (isPreview && actualRecent.length === 0)
          ? DEMO_PREVIEW_RESUME.map(d => d.book)
          : actualRecent;
        const targetCount = size === 'size-4x3' ? 8 : 4;
        const displayDownloads = recentDownloadedBooks.slice(0, targetCount);

        const bookSlots = displayDownloads.map(b => ({
          book: b,
          subText: b.juansCount ? `全 ${b.juansCount} 卷` : '已下載',
          onClick: () => onSelectBook(b.workId)
        }));

        return renderBookShelfCard(
          'downloads',
          <Download size={14} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
          '近期下載',
          '· 查看下載書庫',
          () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')),
          bookSlots,
          {
            title: '下載經典',
            sub: '藏經庫下載',
            onClick: onOpenCbetaCatalog
          },
          size === 'size-4x3' ? '4x3' : '4x2'
        );
      }

      // 19. 依圖示設計之「上次閱讀」群組小卡（支援 4x1、4x2、4x3 自由拉伸切換）
      case 'shelf_read_4x2':
      case 'shelf_read_4x3':
      case 'bar_read_4x1': {
        if (size === 'size-4x1') {
          return renderStandaloneBar(
            'history',
            <Clock size={15} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
            '上次閱讀',
            '· 接續讀誦經藏',
            () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf'))
          );
        }

        const resumeList = (isPreview && effectiveResumeBooks.length === 0)
          ? DEMO_PREVIEW_RESUME
          : effectiveResumeBooks;
        const targetCount = size === 'size-4x3' ? 8 : 4;
        const displayResume = resumeList.slice(0, targetCount);

        const bookSlots = displayResume.map(item => ({
          book: item.book,
          subText: item.progress?.juan ? `第 ${item.progress.juan} 卷` : (item.book.juansCount ? `全 ${item.book.juansCount} 卷` : '已讀'),
          onClick: () => onSelectBook(item.book.workId, item.progress?.segmentId, undefined, 'resume')
        }));

        return renderBookShelfCard(
          'history',
          <Clock size={14} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
          '上次閱讀',
          '· 接續讀誦經藏',
          () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')),
          bookSlots,
          {
            title: '讀誦經典',
            sub: '前往書櫃',
            onClick: () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf'))
          },
          size === 'size-4x3' ? '4x3' : '4x2'
        );
      }

      // 21. 依圖2、圖3設計之 4x3 4膠囊小卡（我的最愛）
      case 'shelf_fav_capsule_4x3': {
        if (size === 'size-4x1') {
          return renderStandaloneBar(
            'favorites',
            <Heart size={15} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
            '我的最愛',
            '· 查看所有收藏',
            () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf'))
          );
        }

        const actualFavs = getRecentFavoriteBooks(downloadedBooks);
        const favBooks = (isPreview && actualFavs.length === 0)
          ? DEMO_PREVIEW_RESUME.map(d => d.book)
          : actualFavs;
        const displayFavs = favBooks.slice(0, 6);

        const bookSlots = displayFavs.map(b => ({
          book: b,
          subText: `${b.juansCount ? `全 ${b.juansCount} 卷` : '經典'}${b.creators ? ` · ${sanitizeCreators(b.creators)}` : ''}`,
          onClick: () => onSelectBook(b.workId)
        }));

        return renderBookShelfCapsuleCard(
          'favorites',
          <Heart size={14} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
          '我的最愛',
          '· 查看所有收藏',
          () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf')),
          bookSlots,
          {
            title: '收藏經典',
            sub: '前往書櫃標記最愛經典',
            onClick: () => (onOpenFolder ? onOpenFolder('virtual_favorites') : onNavigateToLibrarySection('shelf'))
          }
        );
      }

      // 22. 依圖2、圖3設計之 4x3 4膠囊小卡（近期下載）
      case 'shelf_down_capsule_4x3': {
        if (size === 'size-4x1') {
          return renderStandaloneBar(
            'downloads',
            <Download size={15} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
            '近期下載',
            '· 查看下載書庫',
            () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf'))
          );
        }

        const actualRecent = getRecentDownloadedBooks(downloadedBooks);
        const recentDownloadedBooks = (isPreview && actualRecent.length === 0)
          ? DEMO_PREVIEW_RESUME.map(d => d.book)
          : actualRecent;
        const displayDownloads = recentDownloadedBooks.slice(0, 6);

        const bookSlots = displayDownloads.map(b => ({
          book: b,
          subText: `${b.juansCount ? `全 ${b.juansCount} 卷` : '已下載'}${b.creators ? ` · ${sanitizeCreators(b.creators)}` : ''}`,
          onClick: () => onSelectBook(b.workId)
        }));

        return renderBookShelfCapsuleCard(
          'downloads',
          <Download size={14} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
          '近期下載',
          '· 查看下載書庫',
          () => (onOpenFolder ? onOpenFolder('virtual_unclassified') : onNavigateToLibrarySection('shelf')),
          bookSlots,
          {
            title: '下載經典',
            sub: '前往藏經庫下載',
            onClick: onOpenCbetaCatalog
          }
        );
      }

      // 23. 依圖2、圖3設計之 4x3 4膠囊小卡（上次閱讀）
      case 'shelf_read_capsule_4x3': {
        if (size === 'size-4x1') {
          return renderStandaloneBar(
            'history',
            <Clock size={15} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
            '上次閱讀',
            '· 接續讀誦經藏',
            () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf'))
          );
        }

        const resumeList = (isPreview && effectiveResumeBooks.length === 0)
          ? DEMO_PREVIEW_RESUME
          : effectiveResumeBooks;
        const displayResume = resumeList.slice(0, 6);

        const bookSlots = displayResume.map(item => ({
          book: item.book,
          subText: `${item.progress?.juan ? `第 ${item.progress.juan} 卷` : (item.book.juansCount ? `全 ${item.book.juansCount} 卷` : '已讀')}${item.book.creators ? ` · ${sanitizeCreators(item.book.creators)}` : ''}`,
          onClick: () => onSelectBook(item.book.workId, item.progress?.segmentId, undefined, 'resume')
        }));

        return renderBookShelfCapsuleCard(
          'history',
          <Clock size={14} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
          '上次閱讀',
          '· 接續讀誦經藏',
          () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf')),
          bookSlots,
          {
            title: '讀誦經典',
            sub: '前往書櫃接續讀誦',
            onClick: () => (onOpenFolder ? onOpenFolder('virtual_recent_reads') : onNavigateToLibrarySection('shelf'))
          }
        );
      }

      // 20. 依使用者要求新設計之 4x3 書櫃三合一長條卡（上至下：近期下載、上次閱讀、我的最愛）
      case 'shelf_bars_4x3':
        return renderTripleShelfBars4x3();

      // 27. 依圖2設計之 4x1 長條 Bar（下載經典）
      case 'bar_dl_4x1':
        return renderStandaloneBar(
          'cbeta',
          <Plus size={15} color="#ffffff" style={{ strokeWidth: 2.6 }} />,
          '下載經典',
          '· 從CBETA資料庫下載',
          onOpenCbetaCatalog
        );

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
    <div 
      className={`home-custom-dashboard-wrapper ${isLayoutEditMode ? 'edit-mode' : ''} ${editingMemoWidget ? 'has-memo-editing' : ''}`}
      onDoubleClick={(e) => {
        if (!isLayoutEditMode) return;
        const target = e.target as HTMLElement;
        if (!target.closest('.widget-card') && !target.closest('.home-edit-top-banner') && !target.closest('.ios-gallery-backdrop')) {
          handleSaveAndExit();
        }
      }}
    >
      {/* 🌟 Spotlight 聚焦全螢幕半透明遮罩：首頁其他所有卡片與元素柔和暗化模糊，唯獨編輯中的卡片亮起 */}
      {editingMemoWidget && (
        <div 
          className="memo-spotlight-backdrop animate-fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setActivePopover(null);
            const now = Date.now();
            const diff = now - lastBackdropClickTimeRef.current;
            if (diff > 0 && diff < 500) {
              lastBackdropClickTimeRef.current = 0;
              handleSaveMemoEditor();
            } else {
              lastBackdropClickTimeRef.current = now;
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleSaveMemoEditor();
          }}
          title="在頁面外連續點兩下完成編輯並儲存"
        />
      )}

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
            <span className="hint-sub">· 頁面外點2下完成</span>
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
          const isEditingThisMemo = editingMemoWidget?.id === widget.id;

          return (
            <div
              key={widget.id}
              id={`widget-${widget.id}`}
              data-widget-id={widget.id}
              className={`widget-card ${widget.size} ${widget.type === 'custom_memo' ? 'custom-memo-widget' : ''} ${isEditingThisMemo ? 'is-editing-memo-widget' : ''} ${isBookWidgetOuterHeader(widget.type, widget.size) ? 'has-outer-header' : ''} ${widget.type === 'appicon_2x2' ? 'zen-icon-no-pad' : ''} ${widget.type === 'download_2x2' && widget.size === 'size-4x1' ? 'download-dashed-card-4x1' : ''} ${widget.type === 'four_nav_4x1' && widget.size === 'size-4x2' ? 'four-nav-card-4x2' : ''} ${widget.type === 'practice_bead_4x1' ? 'has-practice-bead' : ''} ${isDragging ? 'is-dragging' : ''} ${isOver ? 'drag-over-indicator' : ''}`}
              style={(widget.type === 'practice_bead_4x1' && (showBeadCatMenu || showBeadMidMenu)) ? { zIndex: 1005, overflow: 'visible' } : undefined}
              draggable={isLayoutEditMode}
              onDragStart={(e) => handleDragStart(e, widget.id)}
              onDragOver={(e) => handleDragOver(e, widget.id)}
              onDragLeave={(e) => handleDragLeave(e, widget.id)}
              onDrop={(e) => handleDrop(e, widget.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => {
                if (isEditingThisMemo) return;
                if (isLayoutEditMode) {
                  handleTouchStart(widget.id, e);
                } else {
                  startLongPress(e);
                }
              }}
              onTouchMove={(e) => {
                if (isEditingThisMemo) return;
                if (!isLayoutEditMode) {
                  checkMoveLongPress(e);
                }
              }}
              onTouchEnd={() => {
                if (isEditingThisMemo) return;
                if (isLayoutEditMode) {
                  handleTouchEnd();
                } else {
                  cancelLongPress();
                }
              }}
              onTouchCancel={() => {
                if (isEditingThisMemo) return;
                if (!isLayoutEditMode) {
                  cancelLongPress();
                }
              }}
              onMouseDown={(e) => {
                if (isEditingThisMemo) return;
                if (!isLayoutEditMode && e.button === 0) {
                  startLongPress(e);
                }
              }}
              onMouseMove={(e) => {
                if (isEditingThisMemo) return;
                if (!isLayoutEditMode) {
                  checkMoveLongPress(e);
                }
              }}
              onMouseUp={() => {
                if (isEditingThisMemo) return;
                if (!isLayoutEditMode) {
                  cancelLongPress();
                }
              }}
              onMouseLeave={() => {
                if (isEditingThisMemo) return;
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

      {/* ==========================================================================
          自訂便籤底部排版控制台抽屜 (Bottom Drawer：圖 2 控制台 + 符號選擇 + 多行編輯)
          💡 使用 createPortal 掛載至 document.body，徹底脫離父層 transform/will-change 座標系約束
          ========================================================================== */}
      {/* ==========================================================================
          🌟 方案 A：便籤 Spotlight 原地直編與 Word 單列膠囊控制列
          ========================================================================== */}
      {editingMemoWidget && typeof document !== 'undefined' && createPortal(
        /* 單列 Word 風格控制列 (懸浮並靠在便籤下方邊緣下方) */
        <div 
          className="memo-word-toolbar" 
          style={{
            position: 'fixed',
            top: toolbarStyle ? `${toolbarStyle.top}px` : undefined,
            left: toolbarStyle ? `${toolbarStyle.left}px` : '50%',
            width: toolbarStyle ? `${toolbarStyle.width}px` : undefined,
            bottom: toolbarStyle ? 'auto' : undefined,
            transform: toolbarStyle ? 'none' : 'translateX(-50%)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
        >
            {/* 輕量提示 Toast */}
            <div className={`selection-toast ${selectionToast ? 'show' : ''}`}>
              {selectionToast || '請先反白選取文字'}
            </div>

            {/* 頂部操作：取消、便籤文字排版、完成 */}
            <div className="bar-header">
              <button 
                type="button" 
                className="bar-action-btn cancel" 
                onClick={handleCancelMemoEditor}
              >
                取消
              </button>
              <div className="bar-title">便籤文字排版</div>
              <button 
                type="button" 
                className="bar-action-btn save" 
                onClick={handleSaveMemoEditor}
              >
                完成
              </button>
            </div>

            {/* 單列 5 膠囊按鈕群 (左至右：文字大小、字體、粗體、間距、符號) */}
            {(() => {
              const isSelectionActive = Boolean(hasTextSelection || (savedRangeRef.current && !savedRangeRef.current.collapsed));
              return (
                <div className="bar-row" onMouseDown={(e) => e.preventDefault()}>
                  {/* 1. 文字大小 (A- 18px A+，需選字才生效) */}
                  <div className={`stepper-capsule ${!isSelectionActive ? 'disabled' : ''}`}>
                    <button 
                      type="button" 
                      className="step-btn" 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleToolbarFontSizeStep(-1)}
                      title="縮小字級 (需選取文字)"
                    >
                      A-
                    </button>
                    <span className="step-val">{currentFontSize}px</span>
                    <button 
                      type="button" 
                      className="step-btn" 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleToolbarFontSizeStep(1)}
                      title="放大字級 (需選取文字)"
                    >
                      A+
                    </button>
                  </div>

                  {/* 2. 字體 (後方無任何多餘空白，需選字才生效) */}
                  <button 
                    type="button" 
                    className={`word-tool-btn ${!isSelectionActive ? 'disabled' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isSelectionActive) {
                        showSelectionToast();
                        return;
                      }
                      setActivePopover(prev => prev === 'font' ? null : 'font');
                    }}
                    title="選取文字後切換字體"
                  >
                    <span>{currentFontLabel}</span>
                  </button>
                  {activePopover === 'font' && (
                    <div className="word-popover" onMouseDown={(e) => e.preventDefault()}>
                      <div className="popover-font-list">
                        <button 
                          type="button" 
                          className={`popover-font-item ${currentFontLabel.includes('宋/明') ? 'active' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleToolbarSetFont('serif')}
                        >
                          宋/明體
                        </button>
                        <button 
                          type="button" 
                          className={`popover-font-item ${currentFontLabel.includes('黑體') ? 'active' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleToolbarSetFont('sans')}
                        >
                          黑體
                        </button>
                        <button 
                          type="button" 
                          className={`popover-font-item ${currentFontLabel.includes('楷體') ? 'active' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleToolbarSetFont('kai')}
                        >
                          楷體
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3. 粗體 (文字為「粗體」，需選字才生效) */}
                  <button 
                    type="button" 
                    className={`word-tool-btn bold-btn ${!isSelectionActive ? 'disabled' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleToolbarBold()}
                    title="選取文字後切換粗體"
                  >
                    粗體
                  </button>

                  {/* 4. 間距 (直接顯示文字「寬鬆/適中/緊密」，預設適中) */}
                  <button 
                    type="button" 
                    className="word-tool-btn" 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopover(prev => prev === 'spacing' ? null : 'spacing');
                    }}
                    title="切換行間距"
                  >
                    <span>{currentSpacingLabel}</span>
                  </button>
                  {activePopover === 'spacing' && (
                    <div className="word-popover" onMouseDown={(e) => e.preventDefault()}>
                      <div className="popover-spacing-list">
                        <button 
                          type="button" 
                          className={`popover-spacing-item ${currentSpacingLabel.includes('寬鬆') ? 'active' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleToolbarSetSpacing('loose', 2.2)}
                        >
                          寬鬆
                        </button>
                        <button 
                          type="button" 
                          className={`popover-spacing-item ${currentSpacingLabel.includes('適中') ? 'active' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleToolbarSetSpacing('medium', 1.8)}
                        >
                          適中
                        </button>
                        <button 
                          type="button" 
                          className={`popover-spacing-item ${currentSpacingLabel.includes('緊密') ? 'active' : ''}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleToolbarSetSpacing('tight', 1.4)}
                        >
                          緊密
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 5. 符號 (純文字「符號 ▾」，在游標處插入符號) */}
                  <button 
                    type="button" 
                    className="word-tool-btn" 
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePopover(prev => prev === 'symbol' ? null : 'symbol');
                    }}
                    title="在游標處插入符號"
                  >
                    <span>符號 ▾</span>
                  </button>
                  {activePopover === 'symbol' && (
                    <div className="word-popover" onMouseDown={(e) => e.preventDefault()}>
                      <div className="popover-symbols">
                        <button type="button" className="symbol-opt-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => handleToolbarInsertSymbol('卍')} title="吉祥卍字">卍</button>
                        <button type="button" className="symbol-opt-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => handleToolbarInsertSymbol('☸︎')} title="法輪">☸︎</button>
                        <button type="button" className="symbol-opt-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => handleToolbarInsertSymbol('●')} title="黑圓">●</button>
                        <button type="button" className="symbol-opt-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => handleToolbarInsertSymbol('★')} title="實心星">★</button>
                        <button type="button" className="symbol-opt-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => handleToolbarInsertSymbol('☆')} title="空心星">☆</button>
                        <button type="button" className="symbol-opt-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => handleToolbarInsertSymbol('◌')} title="虛線圓">◌</button>
                        <button type="button" className="symbol-opt-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => handleToolbarInsertSymbol('✿')} title="清淨妙華">✿</button>
                        <button type="button" className="symbol-opt-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => handleToolbarInsertSymbol('✧')} title="菩提心光">✧</button>
                        <button type="button" className="symbol-opt-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => handleToolbarInsertSymbol('◯')} title="禪心圓相">◯</button>
                        <button type="button" className="symbol-opt-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => handleToolbarInsertSymbol('❖')} title="金剛智印">❖</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>,
        document.body
      )}

      {/* ==========================================================================
          自訂 8 合 1 快捷功能按鍵設定彈窗 (Custom Nav Editor Modal)
          ========================================================================== */}
      {editingNavWidget && typeof document !== 'undefined' && createPortal(
        <div className="ios-gallery-overlay animate-fade-in" onClick={() => setEditingNavWidget(null)}>
          <div className="ios-gallery-sheet custom-nav-editor-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="ios-gallery-grabber" />

            <div className="ios-gallery-nav-bar">
              <div className="ios-gallery-title">
                {editingNavWidget.type === 'download_shelf_4x3' ? '自訂快捷功能 (下載與書櫃卡)' : '自訂快捷功能 (方塊按鍵)'}
              </div>
              <button
                type="button"
                className="ios-gallery-close-btn"
                onClick={() => setEditingNavWidget(null)}
                title="完成並關閉"
              >
                <X size={18} />
              </button>
            </div>

            <div className="custom-nav-editor-body">
              <div className="custom-nav-hint">
                {editingNavWidget.type === 'download_shelf_4x3'
                  ? '第 1 格固定為 CBETA Reader；其餘按鍵可直接「拖曳」順移調位；點「＋」最多增加至 5 個按鍵；點「×」可刪除；點選格子由下方替換。'
                  : '第 1 格固定為 CBETA Reader；點「×」刪除按鍵保留空格；空格可由下方功能庫填入或將其他按鍵拖曳至空格；點選格子由下方替換。'}
              </div>

              {/* 格子即時預覽與選定區 (第 1 格固定不可移刪；4x2 快捷卡固定 10 格且允許空格) */}
              {(() => {
                const isShelfNav = editingNavWidget.type === 'download_shelf_4x3';
                const defaultButtons = getDefaultNavButtonsForWidget(editingNavWidget);
                const rawButtons = (editingNavWidget.customNavButtons && editingNavWidget.customNavButtons.length > 0)
                  ? editingNavWidget.customNavButtons
                  : defaultButtons;
                const currentButtons = isShelfNav
                  ? ensureBrandFirst(rawButtons)
                  : normalizeQuickNav10Buttons(rawButtons);
                const curTheme = settings.theme || 'ivory';
                const themeInfoMap: Record<string, { name: string; color: string; border: string }> = {
                  ivory: { name: '象牙白', color: '#faf7f0', border: 'rgba(0, 0, 0, 0.16)' },
                  parchment: { name: '羊皮紙', color: '#f5eedc', border: 'rgba(0, 0, 0, 0.16)' },
                  comfort: { name: '舒服綠', color: '#d7e8d5', border: 'rgba(0, 0, 0, 0.16)' },
                  ebony: { name: '烏木黑', color: '#23211e', border: 'rgba(255, 255, 255, 0.35)' },
                  custom: { name: '自訂色', color: settings.customThemeColor || '#d4a373', border: 'rgba(0, 0, 0, 0.2)' },
                };
                const curThemeInfo = themeInfoMap[curTheme] || themeInfoMap['ivory'];

                // 💡 單一格子渲染元件
                const renderNavSlot = (btnKey: string, idx: number) => {
                  const isSelected = selectedNavSlotIndex === idx;
                  const isFixed = idx === 0 && btnKey === 'brand_title';
                  const isEmpty = !isShelfNav && (btnKey === 'empty' || !btnKey);
                  const def = QUICK_NAV_BUTTON_DEFS[btnKey] || QUICK_NAV_BUTTON_DEFS['download'];

                  return (
                    <div
                      key={`editor-slot-${idx}`}
                      data-slot-idx={idx}
                      className={`custom-nav-slot-box ${isEmpty ? 'is-empty-slot' : ''} ${isSelected ? 'selected' : ''} ${isFixed ? 'is-fixed' : ''} ${draggedNavSlotIndex === idx ? 'is-dragging' : ''} ${dragOverNavSlotIndex === idx ? 'drag-over' : ''}`}
                      draggable={!isFixed && !isEmpty}
                      onDragStart={!isFixed && !isEmpty ? (e) => {
                        setDraggedNavSlotIndex(idx);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(idx));
                      } : undefined}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (isFixed) return;
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverNavSlotIndex !== idx) {
                          setDragOverNavSlotIndex(idx);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverNavSlotIndex === idx) {
                          setDragOverNavSlotIndex(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverNavSlotIndex(null);
                        if (draggedNavSlotIndex !== null && draggedNavSlotIndex > 0 && idx > 0 && draggedNavSlotIndex !== idx) {
                          handleSwapNavSlots(draggedNavSlotIndex, idx);
                          setSelectedNavSlotIndex(idx);
                        }
                        setDraggedNavSlotIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedNavSlotIndex(null);
                        setDragOverNavSlotIndex(null);
                      }}
                      onTouchStart={!isFixed && !isEmpty ? () => {
                        touchSlotStartIdxRef.current = idx;
                      } : undefined}
                      onTouchMove={(e) => {
                        if (touchSlotStartIdxRef.current === null) return;
                        const touch = e.touches[0];
                        const elem = document.elementFromPoint(touch.clientX, touch.clientY);
                        const slotBox = elem?.closest('.custom-nav-slot-box') as HTMLElement | null;
                        if (slotBox && slotBox.dataset.slotIdx !== undefined) {
                          const overIdx = parseInt(slotBox.dataset.slotIdx, 10);
                          if (!isNaN(overIdx) && overIdx > 0 && dragOverNavSlotIndex !== overIdx) {
                            setDragOverNavSlotIndex(overIdx);
                          }
                        }
                      }}
                      onTouchEnd={() => {
                        if (touchSlotStartIdxRef.current !== null && touchSlotStartIdxRef.current > 0 && dragOverNavSlotIndex !== null && dragOverNavSlotIndex > 0 && touchSlotStartIdxRef.current !== dragOverNavSlotIndex) {
                          handleSwapNavSlots(touchSlotStartIdxRef.current, dragOverNavSlotIndex);
                          setSelectedNavSlotIndex(dragOverNavSlotIndex);
                        }
                        touchSlotStartIdxRef.current = null;
                        setDragOverNavSlotIndex(null);
                      }}
                      onClick={() => setSelectedNavSlotIndex(idx)}
                      title={
                        isFixed 
                          ? '第 1 格固定為 CBETA Reader 首頁快捷（點 2 下可進入自訂快捷），不可更換位置與刪除'
                          : isEmpty 
                            ? `第 ${idx + 1} 格為空格，點選由下方功能庫填入，或拖曳其他按鍵至此`
                            : `拖曳可調整位置；點選選定第 ${idx + 1} 格：${def.name}`
                      }
                    >
                      <span className="slot-badge-number">{idx + 1}</span>
                      {isFixed ? (
                        <span className="slot-badge-fixed" title="固定第 1 格">固定</span>
                      ) : isEmpty ? null : (
                        <button
                          type="button"
                          className="slot-delete-btn"
                          onClick={(e) => handleRemoveNavSlot(idx, e)}
                          title="移除此按鍵 (保留空格)"
                        >
                          ×
                        </button>
                      )}

                      {isEmpty ? (
                        /* 💡 圖 2 空格圖示：綠色加號 + 文字「增加按鍵」 */
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.15rem', padding: '0.2rem 0' }}>
                          <Plus size={20} strokeWidth={2.4} style={{ color: '#1ea98c' }} />
                          <span style={{ color: 'var(--theme-accent, #1ea98c)', fontSize: '0.62rem', fontWeight: 600 }}>增加按鍵</span>
                        </div>
                      ) : (
                        renderQuickNavItemContent(btnKey, 18, editingNavWidget.iconIndex || 1, true)
                      )}
                    </div>
                  );
                };

                // 💡 增加按鍵格元件 (下載與書櫃卡專用)
                const renderAddSlotButton = (keySuffix: string) => (
                  <div
                    key={`add-slot-btn-${keySuffix}`}
                    className="custom-nav-slot-box add-slot-btn"
                    onClick={handleAddNavSlot}
                    title="增加一個快捷功能按鍵 (最多 5 個)"
                  >
                    <div className="slot-add-icon">
                      <Plus size={20} strokeWidth={2.4} />
                    </div>
                    <span className="slot-label" style={{ color: 'var(--theme-accent, #1ea98c)', fontSize: '0.62rem' }}>增加按鍵</span>
                  </div>
                );

                return (
                  <>
                    {isShelfNav ? (
                      /* 下載與書櫃卡：單排最多 5 個 */
                      <div 
                        className="custom-nav-current-grid shelf-mode"
                        style={{ gridTemplateColumns: `repeat(${currentButtons.length + (currentButtons.length < 5 ? 1 : 0)}, minmax(0, 1fr))` }}
                      >
                        {currentButtons.map((btnKey, idx) => renderNavSlot(btnKey, idx))}
                        {currentButtons.length < 5 && renderAddSlotButton('shelf')}
                      </div>
                    ) : (
                      /* ⭐ 圖1 快捷卡 (10 格)：固定雙排上 5 格 (idx 0~4)、下 5 格 (idx 5~9)，刪除保留空格 */
                      <div className="custom-nav-current-grid quick-mode" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {/* 上排 (idx 0 ~ 4) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.45rem' }}>
                          {currentButtons.slice(0, 5).map((btnKey, i) => renderNavSlot(btnKey, i))}
                        </div>
                        {/* 下排 (idx 5 ~ 9) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.45rem' }}>
                          {currentButtons.slice(5, 10).map((btnKey, i) => renderNavSlot(btnKey, 5 + i))}
                        </div>
                      </div>
                    )}

                    {/* 替換/填入功能按鍵庫 (第 1 格固定不可替換，其餘已在上方按鍵內的自動反灰) */}
                    <div className="custom-nav-pool-section">
                      <div className="custom-nav-pool-title">
                        {selectedNavSlotIndex === 0 
                          ? '「第 1 格」已固定為 CBETA Reader 首頁快捷，不可更換：'
                          : (currentButtons[selectedNavSlotIndex] === 'empty'
                              ? `點選功能即可填入「第 ${selectedNavSlotIndex + 1} 格」空格：`
                              : `點選功能即可替換「第 ${selectedNavSlotIndex + 1} 格」：`)}
                      </div>
                      <div className="custom-nav-pool-grid">
                        {AVAILABLE_NAV_BUTTON_KEYS.map((key) => {
                          const def = QUICK_NAV_BUTTON_DEFS[key];
                          const isBrandFixed = key === 'brand_title';
                          const isFixedInCard = isShelfNav && key === 'download';
                          const isAlreadyInCurrentSlot = currentButtons[selectedNavSlotIndex] === key;
                          const isUsedInOtherSlots = currentButtons.some((k, i) => i !== selectedNavSlotIndex && k === key && k !== 'empty');
                          const isButtonDisabled = selectedNavSlotIndex === 0 || isBrandFixed || isUsedInOtherSlots || isFixedInCard;

                          return (
                            <button
                              key={`pool-btn-${key}`}
                              type="button"
                              disabled={isButtonDisabled}
                              className={`pool-item-btn ${isAlreadyInCurrentSlot ? 'current-active' : ''} ${isButtonDisabled ? 'is-disabled-used' : ''}`}
                              onClick={() => !isButtonDisabled && handleReplaceNavButton(selectedNavSlotIndex, key)}
                              title={
                                selectedNavSlotIndex === 0
                                  ? '第 1 格固定為 CBETA Reader，不可替換'
                                  : isBrandFixed
                                    ? '「CBETA Reader」已固定於第 1 格，不可重複加入'
                                    : isFixedInCard
                                      ? '「下載經典」已固定在卡片上方，不可重複加入'
                                      : isUsedInOtherSlots 
                                        ? (isAlreadyInCurrentSlot ? `目前第 ${selectedNavSlotIndex + 1} 格已是「${def.name}」` : `「${def.name}」已在上方面板中，不可重複加入`) 
                                        : (currentButtons[selectedNavSlotIndex] === 'empty' ? `填入「${def.name}」` : `替換為「${def.name}」`)
                              }
                            >
                              <div className="pool-icon-box" style={{ background: key === 'brand_title' ? 'rgba(30, 169, 140, 0.08)' : def.gradient, border: key === 'brand_title' ? '1px solid rgba(30, 169, 140, 0.2)' : undefined }}>
                                {key === 'zen_icon' ? (
                                  <img src={ZEN_ICONS_LIST[0]} alt="Zen" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                                ) : key === 'brand_title' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
                                    <span style={{ fontSize: '8px', fontWeight: 800, color: '#1ea98c' }}>CBETA</span>
                                    <span style={{ fontSize: '7px', fontWeight: 800, color: 'var(--text-primary, #2b332b)' }}>Reader</span>
                                  </div>
                                ) : key === 'theme_color' ? (
                                  <div 
                                    style={{ 
                                      width: '18px', 
                                      height: '18px', 
                                      borderRadius: '50%', 
                                      backgroundColor: curThemeInfo.color, 
                                      border: `1.5px solid ${curThemeInfo.border}`,
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)' 
                                    }} 
                                  />
                                ) : key === 'timer' ? (
                                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px dotted #9bb0be', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Clock size={11} color="#ea580c" />
                                  </div>
                                ) : (
                                  renderQuickNavButtonIcon(key, 16, editingNavWidget.iconIndex || 1)
                                )}
                              </div>
                              <span className="pool-item-name">{def.name}</span>
                              {isAlreadyInCurrentSlot && (
                                <span className="pool-item-check">✓ 當前</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* 底部操作：恢復預設、完成 (1:1 對稱等大) */}
            <div className="custom-nav-bottom-actions">
              <button
                type="button"
                className="custom-nav-reset-btn"
                onClick={handleResetNavButtons}
                title="恢復為預設快捷鍵"
              >
                <RotateCcw size={14} />
                <span>恢復預設</span>
              </button>
              <button
                type="button"
                className="custom-nav-done-btn"
                onClick={() => setEditingNavWidget(null)}
              >
                <span>完成</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ==========================================================================
          儲存版型詢問對話框 (Save Preset Confirm Modal)
          ========================================================================== */}
      {showSavePresetModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="ios-gallery-overlay animate-fade-in" 
          onClick={() => setShowSavePresetModal(false)}
          style={{ zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div 
            className="ios-gallery-sheet animate-slide-up" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: '420px', 
              width: '100%', 
              borderRadius: '20px', 
              padding: '1.25rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              background: 'var(--card-bg, #fff)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'rgba(30, 169, 140, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--theme-accent, #1ea98c)'
                }}>
                  <Check size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>儲存版面設定</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>選擇要儲存為自訂版型或直接套用</div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSavePresetModal(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  padding: '4px', 
                  cursor: 'pointer', 
                  color: 'var(--text-muted)',
                  borderRadius: '50%'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 選擇自訂槽位 */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                儲存至自訂版型槽位：
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {(['custom1', 'custom2', 'custom3'] as const).map(slot => {
                  const isSelected = saveTargetSlot === slot;
                  const slotName = slot === 'custom1' 
                    ? (settings.customPresets?.custom1?.name || settings.customPresetName?.trim() || '自訂1')
                    : slot === 'custom2'
                      ? (settings.customPresets?.custom2?.name || '自訂2')
                      : (settings.customPresets?.custom3?.name || '自訂3');
                  
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setSaveTargetSlot(slot);
                        setSavePresetNameInput(slotName);
                      }}
                      style={{
                        padding: '0.55rem 0.3rem',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid var(--theme-accent, #1ea98c)' : '1px solid var(--border-color, rgba(0,0,0,0.12))',
                        background: isSelected ? 'rgba(30, 169, 140, 0.08)' : 'transparent',
                        color: isSelected ? 'var(--theme-accent, #1ea98c)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {slotName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 自訂名稱輸入框 */}
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                版型名稱：
              </div>
              <input
                type="text"
                maxLength={12}
                placeholder="自訂名稱 (例如：淨心早課)"
                value={savePresetNameInput}
                onChange={(e) => setSavePresetNameInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                  background: 'var(--input-bg, rgba(255,255,255,0.7))',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* 操作按鈕群 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handleConfirmSaveToSlot(saveTargetSlot, savePresetNameInput)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--theme-accent, #1ea98c)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Check size={16} strokeWidth={2.4} />
                <span>儲存並套用為「{savePresetNameInput.trim() || (saveTargetSlot === 'custom1' ? '自訂1' : saveTargetSlot === 'custom2' ? '自訂2' : '自訂3')}」</span>
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleApplyOnlyToHome}
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                  title="僅修改當前首頁版面，不寫入自訂版型範本"
                >
                  僅套用至首頁
                </button>
                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(false)}
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  繼續編輯
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}


    </div>
  );
}
