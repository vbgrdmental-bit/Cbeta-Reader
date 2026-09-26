export type HomeWidgetType = 
  | 'title_4x2'
  | 'title_4x1'
  | 'appicon_2x2'
  | 'four_nav_4x1'
  | 'download_2x2'
  | 'shelf_2x2'
  | 'notes_2x2'
  | 'search_2x2'
  | 'lastread_4x2'
  | 'lastread_4x1'
  | 'lastread_excerpt_4x4'
  | 'triple_reading_4x4'
  | 'favorites_4x2'
  | 'recent_downloads_4x2'
  | 'stats_2x2'
  | 'theme_4x1'
  | 'timer_2x2'
  | 'zen_4x2'
  | 'custom_memo';

export type HomeWidgetSize = 
  | 'size-4x1'
  | 'size-2x2'
  | 'size-4x2'
  | 'size-4x3'
  | 'size-2x1'
  | 'size-1x1'
  | 'size-2x4'
  | 'size-4x4';

export interface HomeWidgetConfig {
  id: string;
  type: HomeWidgetType;
  size: HomeWidgetSize;
  iconIndex?: number; // 1 ~ 10
  // 自訂座右銘便籤相關排版設定
  memoText?: string;
  memoAuthor?: string;
  memoFont?: 'serif' | 'sans' | 'kai';
  memoFontSize?: number;
  memoLineHeight?: number;
  memoPadding?: number;
}

export const ZEN_ICONS_LIST = [
  '/zen-icons/zen_01.jpg',
  '/zen-icons/zen_02.png',
  '/zen-icons/zen_03.png',
  '/zen-icons/zen_04.png',
  '/zen-icons/zen_05.jpg',
  '/zen-icons/zen_06.jpg',
  '/zen-icons/zen_07.png',
  '/zen-icons/zen_08.jpg',
  '/zen-icons/zen_09.png',
  '/zen-icons/zen_10.png'
];

export type HomeLayoutPreset = 'default' | 'compact' | 'focus' | 'zen' | 'custom';

export type WidgetCategoryId = 'brand' | 'nav' | 'reading' | 'other';

export interface WidgetCategoryMeta {
  id: WidgetCategoryId;
  name: string;
  sub: string;
}

export const WIDGET_CATEGORIES: WidgetCategoryMeta[] = [
  { id: 'brand', name: '主題圖卡', sub: '經典大標題、簡約橫幅、禪意圖標' },
  { id: 'nav', name: '快捷功能', sub: '四合一導航、下載經典、我的書櫃、我的筆記、全文檢索' },
  { id: 'reading', name: '我的書櫃', sub: '上次閱讀、我的最愛、近期下載、閱讀日誌' },
  { id: 'other', name: '其他功能', sub: '護眼計時器、四色主題快捷列、佛典精進名句' }
];

export interface WidgetCatalogItem {
  type: HomeWidgetType;
  category: WidgetCategoryId;
  name: string;
  size: HomeWidgetSize;
  icon: string;
  description: string;
}

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  // 1. 品牌標題
  { type: 'title_4x2', category: 'brand', name: '經典大標題', size: 'size-4x2', icon: '🏷️', description: 'CBETA Reader 經典大標題與副標' },
  { type: 'title_4x1', category: 'brand', name: '簡約橫幅標題', size: 'size-4x1', icon: '🔖', description: '水平單行緊湊品牌標題' },
  { type: 'appicon_2x2', category: 'brand', name: '禪意 App Icon', size: 'size-2x2', icon: '🪷', description: '點擊可循環切換 10 款精選禪心蓮花圖標 (01~10)' },

  // 2. 系統導航
  { type: 'four_nav_4x1', category: 'nav', name: '四合一導航列', size: 'size-4x1', icon: '🧭', description: '下載+書櫃+筆記+搜尋四合一呈現（支援 4x1/4x2/2x2/4x4）' },
  { type: 'download_2x2', category: 'nav', name: '下載經典卡', size: 'size-2x2', icon: '＋', description: '前往 CBETA 藏經庫下載經文（支援 2x2/4x1/4x2）' },
  { type: 'shelf_2x2', category: 'nav', name: '我的書櫃卡', size: 'size-2x2', icon: '📁', description: '直達已下載的個人經文書櫃（支援 2x2/4x1/4x2）' },
  { type: 'notes_2x2', category: 'nav', name: '我的筆記卡', size: 'size-2x2', icon: '📖', description: '集中查看劃線重點與個人筆記（支援 2x2/4x1/4x2）' },
  { type: 'search_2x2', category: 'nav', name: '全文檢索卡', size: 'size-2x2', icon: '🔍', description: '已下載經文全文快速檢索（支援 2x2/4x1/4x2）' },

  // 3. 閱讀與進度
  { type: 'lastread_4x2', category: 'reading', name: '上次閱讀卡', size: 'size-4x2', icon: '📕', description: '上次閱讀經典列表（支援 4x1/4x2/4x3/4x4 共 1~4 本）' },
  { type: 'lastread_excerpt_4x4', category: 'reading', name: '上次閱讀經文進度卡', size: 'size-4x4', icon: '📜', description: '上次閱讀經典與當前段落經文摘錄（4x4 規格）' },
  { type: 'triple_reading_4x4', category: 'reading', name: '三合一閱讀卡', size: 'size-4x4', icon: '📚', description: '集合「近期下載」、「上次閱讀」、「我的最愛」各 1 本經典之三合一卡片（4×4 規格）' },
  { type: 'favorites_4x2', category: 'reading', name: '我的最愛卡', size: 'size-4x2', icon: '❤️', description: '收藏於我的最愛之經典（支援 4x1/4x2/4x3/4x4）' },
  { type: 'recent_downloads_4x2', category: 'reading', name: '近期下載卡', size: 'size-4x2', icon: '📥', description: '最新下載之經典清單（支援 4x1/4x2/4x3/4x4）' },
  { type: 'stats_2x2', category: 'reading', name: '每日閱讀日誌徽章', size: 'size-2x2', icon: '📅', description: '連續閱讀天數與累積時數統計' },

  // 4. 其他功能
  { type: 'timer_2x2', category: 'other', name: '護眼計時器', size: 'size-2x2', icon: '⏱️', description: '閱讀時間倒數與溫馨提醒（支援 4x2/2x2）' },
  { type: 'theme_4x1', category: 'other', name: '四色主題快捷列', size: 'size-4x1', icon: '🎨', description: '白、紙、舒、木 4 色背景一鍵切換' },
  { type: 'zen_4x2', category: 'other', name: '佛典精進名句', size: 'size-4x2', icon: '🪷', description: '每日輪播佛典名言與法義精粹' },
  { type: 'custom_memo', category: 'other', name: '自訂便籤小卡', size: 'size-4x2', icon: '📝', description: '讀者可自由輸入自選文字、法義或座右銘，支援自訂字體、字級、行高與邊距' }
];

export const PRESET_LAYOUTS: Record<HomeLayoutPreset, HomeWidgetConfig[]> = {
  default: [
    { id: 'w_title', type: 'title_4x1', size: 'size-4x1' },
    { id: 'w_download', type: 'download_2x2', size: 'size-4x1' },
    { id: 'w_triple', type: 'triple_reading_4x4', size: 'size-4x4' }
  ],
  compact: [
    { id: 'w_title', type: 'title_4x1', size: 'size-4x1' },
    { id: 'w_nav', type: 'four_nav_4x1', size: 'size-4x1' },
    { id: 'w_lastread', type: 'lastread_4x1', size: 'size-4x1' },
    { id: 'w_theme', type: 'theme_4x1', size: 'size-4x1' },
    { id: 'w_stats', type: 'stats_2x2', size: 'size-2x2' },
    { id: 'w_timer', type: 'timer_2x2', size: 'size-2x2' },
    { id: 'w_zen', type: 'zen_4x2', size: 'size-4x2' }
  ],
  focus: [
    { id: 'w_icon', type: 'appicon_2x2', size: 'size-2x2' },
    { id: 'w_stats', type: 'stats_2x2', size: 'size-2x2' },
    { id: 'w_nav', type: 'four_nav_4x1', size: 'size-4x1' },
    { id: 'w_lastread', type: 'lastread_4x2', size: 'size-4x2' },
    { id: 'w_timer', type: 'timer_2x2', size: 'size-2x2' },
    { id: 'w_shelf', type: 'shelf_2x2', size: 'size-2x2' },
    { id: 'w_theme', type: 'theme_4x1', size: 'size-4x1' }
  ],
  zen: [
    { id: 'w_zen', type: 'zen_4x2', size: 'size-4x2' },
    { id: 'w_timer', type: 'timer_2x2', size: 'size-2x2' },
    { id: 'w_icon', type: 'appicon_2x2', size: 'size-2x2' },
    { id: 'w_nav', type: 'four_nav_4x1', size: 'size-4x1' },
    { id: 'w_lastread', type: 'lastread_4x2', size: 'size-4x2' },
    { id: 'w_theme', type: 'theme_4x1', size: 'size-4x1' }
  ],
  custom: []
};

// 💡 依組件特性定義允許的合適尺寸規格，統一順序：4x1 -> 4x2 -> 4x3 -> 4x4 -> 2x2
export const ALLOWED_SIZES_BY_TYPE: Record<HomeWidgetType, HomeWidgetSize[]> = {
  title_4x2: ['size-4x1', 'size-4x2', 'size-2x2'],
  title_4x1: ['size-4x1', 'size-4x2', 'size-2x2'],
  // 禪意圖標：固定為 2x2 長寬等比正方形（無 1x1）
  appicon_2x2: ['size-2x2'],

  four_nav_4x1: ['size-4x1', 'size-4x2', 'size-4x4', 'size-2x2'],

  // 四大核心功能卡：支援 4x1、4x2、2x2
  download_2x2: ['size-4x1', 'size-4x2', 'size-2x2'],
  shelf_2x2: ['size-4x1', 'size-4x2', 'size-2x2'],
  notes_2x2: ['size-4x1', 'size-4x2', 'size-2x2'],
  search_2x2: ['size-4x1', 'size-4x2', 'size-2x2'],

  // 上次閱讀、我的最愛、近期下載：支援 4x1、4x2、4x3、4x4
  lastread_4x2: ['size-4x1', 'size-4x2', 'size-4x3', 'size-4x4'],
  lastread_4x1: ['size-4x1', 'size-4x2', 'size-4x3', 'size-4x4'],
  lastread_excerpt_4x4: ['size-4x4'],
  triple_reading_4x4: ['size-4x4'],
  favorites_4x2: ['size-4x1', 'size-4x2', 'size-4x3', 'size-4x4'],
  recent_downloads_4x2: ['size-4x1', 'size-4x2', 'size-4x3', 'size-4x4'],

  stats_2x2: ['size-2x2', 'size-2x1', 'size-1x1'],
  theme_4x1: ['size-4x1', 'size-2x2'],
  // 護眼模式：僅支援 4x2 與 2x2
  timer_2x2: ['size-4x2', 'size-2x2'],
  // 佛典精進名句：固定為 4x2
  zen_4x2: ['size-4x2'],
  // 自訂便籤小卡：限定尺寸 2x2 / 4x2 / 4x3 / 4x4 / 4x1
  custom_memo: ['size-4x2', 'size-4x3', 'size-4x4', 'size-2x2', 'size-4x1']
};
