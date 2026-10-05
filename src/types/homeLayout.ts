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
  | 'custom_memo'
  | 'quick_nav_4x2'
  | 'shelf_quick_4x2'
  | 'system_nav_4x2'
  | 'download_shelf_4x3'
  | 'shelf_fav_4x2'
  | 'shelf_down_4x2'
  | 'shelf_read_4x2'
  | 'shelf_fav_4x3'
  | 'shelf_down_4x3'
  | 'shelf_read_4x3'
  | 'bar_fav_4x1'
  | 'bar_down_4x1'
  | 'bar_read_4x1'
  | 'bar_dl_4x1'
  | 'shelf_bars_4x3'
  | 'shelf_fav_capsule_4x3'
  | 'shelf_down_capsule_4x3'
  | 'shelf_read_capsule_4x3';

export type HomeWidgetSize = 
  | 'size-4x1'
  | 'size-2x2'
  | 'size-4x2'
  | 'size-4x3'
  | 'size-2x1'
  | 'size-1x1'
  | 'size-2x4'
  | 'size-4x4';

export interface MemoLineConfig {
  text: string;
  font?: 'serif' | 'sans' | 'kai';
  fontSize?: number;
}

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
  memoIconIndex?: number; // 0: 無符號, 1~6: 禪意小圖標
  memoLines?: MemoLineConfig[]; // 分行獨立字體字級排版
  memoHtml?: string; // 富文本 HTML 格式 (方案 A 原地編輯持久化)
  // 8 合 1 快捷功能卡片自訂按鈕清單（支援上下左右位置調整與功能替換）
  customNavButtons?: string[];
}

export const ZEN_ICONS_LIST = [
  '/zen-icons/zen_01.jpg',
  '/zen-icons/zen_04.png',
  '/zen-icons/zen_05.jpg',
  '/zen-icons/zen_06.jpg',
  '/zen-icons/zen_07.png',
  '/zen-icons/zen_09.png'
];

export type HomeLayoutPreset = 'default' | 'calm' | 'many_books' | 'compact' | 'focus' | 'zen' | 'custom' | 'custom1' | 'custom2' | 'custom3';

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
  { type: 'appicon_2x2', category: 'brand', name: '禪意 App Icon', size: 'size-2x2', icon: '🪷', description: '點擊可循環切換 6 款精選禪心蓮花圖標' },

  { type: 'download_shelf_4x3', category: 'nav', name: '下載與書櫃卡 (4×2)', size: 'size-4x2', icon: '📥', description: '上排：下載經典；下排：CBETA Reader + 近期下載 + 上次閱讀 + 我的最愛 4 快捷鍵（支援自訂 2~5 鍵）' },
  { type: 'shelf_quick_4x2', category: 'nav', name: '書櫃快捷卡 (4×2)', size: 'size-4x2', icon: '📥', description: '三合一書櫃快捷鍵（近期下載、上次閱讀、我的最愛），直接進入無滑動' },
  { type: 'system_nav_4x2', category: 'nav', name: '系統導航卡 (4×2)', size: 'size-4x2', icon: '🧭', description: '三合一系統導航鍵（我的書櫃、我的筆記、全文檢索），秒速直達' },
  { type: 'quick_nav_4x2', category: 'nav', name: '快捷功能卡 (4×2)', size: 'size-4x2', icon: '⚡', description: '八合一快捷按鍵（上4個+下4個正方形按鍵），支援自訂上下左右位置與替換功能' },
  { type: 'four_nav_4x1', category: 'nav', name: '四合一導航列', size: 'size-4x1', icon: '🧭', description: '下載+書櫃+筆記+全文檢索四合一呈現（支援 4x1/4x2/2x2/4x4）' },
  { type: 'download_2x2', category: 'nav', name: '下載經典卡', size: 'size-2x2', icon: '＋', description: '前往 CBETA 藏經庫下載經文（支援 2x2/4x1/4x2）' },
  { type: 'shelf_2x2', category: 'nav', name: '我的書櫃卡', size: 'size-2x2', icon: '📁', description: '直達已下載的個人經文書櫃（支援 2x2/4x1/4x2）' },
  { type: 'notes_2x2', category: 'nav', name: '我的筆記卡', size: 'size-2x2', icon: '📖', description: '集中查看劃線重點與個人筆記（支援 2x2/4x1/4x2）' },
  { type: 'search_2x2', category: 'nav', name: '全文檢索卡', size: 'size-2x2', icon: '🔍', description: '已下載經文全文快速檢索（支援 2x2/4x1/4x2）' },

  // 3. 閱讀與進度
  { type: 'shelf_bars_4x3', category: 'reading', name: '書櫃三合一長條卡 (4×3)', size: 'size-4x3', icon: '📑', description: '上至下依序整合「近期下載」、「上次閱讀」、「我的最愛」3 個快捷長條 Bar，點擊秒速直達' },
  { type: 'bar_dl_4x1', category: 'nav', name: '下載經典 (長條Bar)', size: 'size-4x1', icon: '＋', description: '4×1 水平長條快捷 Bar：直達 CBETA 藏經庫下載' },
  { type: 'shelf_fav_4x2', category: 'reading', name: '我的最愛卡', size: 'size-4x2', icon: '❤️', description: '依圖示規格設計：支援 4×1（長條Bar）、4×2（4本書）、4×3（8本書）自由拉伸切換' },
  { type: 'shelf_down_4x2', category: 'reading', name: '近期下載卡', size: 'size-4x2', icon: '📥', description: '依圖示規格設計：支援 4×1（長條Bar）、4×2（4本書）、4×3（8本書）自由拉伸切換' },
  { type: 'shelf_read_4x2', category: 'reading', name: '上次閱讀卡', size: 'size-4x2', icon: '📕', description: '依圖示規格設計：支援 4×1（長條Bar）、4×2（4本書）、4×3（8本書）自由拉伸切換' },
  { type: 'bar_down_4x1', category: 'reading', name: '近期下載 (長條Bar)', size: 'size-4x1', icon: '📥', description: '4×1 水平長條快捷 Bar：直達近期下載書庫' },
  { type: 'bar_read_4x1', category: 'reading', name: '上次閱讀 (長條Bar)', size: 'size-4x1', icon: '📕', description: '4×1 水平長條快捷 Bar：直達上次閱讀經藏' },
  { type: 'bar_fav_4x1', category: 'reading', name: '我的最愛 (長條Bar)', size: 'size-4x1', icon: '❤️', description: '4×1 水平長條快捷 Bar：直達我的最愛收藏' },
  { type: 'shelf_fav_4x3', category: 'reading', name: '我的最愛 (8本書)', size: 'size-4x3', icon: '❤️', description: '上方快捷橫條，下方 8 本經典方塊按鍵（4×2 雙排佈局）' },
  { type: 'shelf_down_4x3', category: 'reading', name: '近期下載 (8本書)', size: 'size-4x3', icon: '📥', description: '上方快捷橫條，下方 8 本經典方塊按鍵（4×2 雙排佈局）' },
  { type: 'shelf_read_4x3', category: 'reading', name: '上次閱讀 (8本書)', size: 'size-4x3', icon: '📕', description: '上方快捷橫條，下方 8 本經典方塊按鍵（4×2 雙排佈局）' },
  { type: 'shelf_fav_capsule_4x3', category: 'reading', name: '我的最愛 (6膠囊)', size: 'size-4x3', icon: '❤️', description: '依圖示規格：上方快捷橫條，下方 6 本經典膠囊條列（左3本右3本雙欄佈局無箭頭）' },
  { type: 'shelf_down_capsule_4x3', category: 'reading', name: '近期下載 (6膠囊)', size: 'size-4x3', icon: '📥', description: '依圖示規格：上方快捷橫條，下方 6 本經典膠囊條列（左3本右3本雙欄佈局無箭頭）' },
  { type: 'shelf_read_capsule_4x3', category: 'reading', name: '上次閱讀 (6膠囊)', size: 'size-4x3', icon: '📕', description: '依圖示規格：上方快捷橫條，下方 6 本經典膠囊條列（左3本右3本雙欄佈局無箭頭）' },
  { type: 'lastread_4x2', category: 'reading', name: '上次閱讀卡', size: 'size-4x2', icon: '📕', description: '上次閱讀經典列表（支援 4x1/4x2/4x3/4x4 共 1~4 本）' },
  { type: 'lastread_excerpt_4x4', category: 'reading', name: '上次閱讀經文進度卡', size: 'size-4x4', icon: '📜', description: '上次閱讀經典與當前段落經文摘錄（4x4 規格）' },
  { type: 'triple_reading_4x4', category: 'reading', name: '三合一閱讀卡', size: 'size-4x4', icon: '📚', description: '集合「近期下載」、「上次閱讀」、「我的最愛」各 1 本經典之三合一卡片（4×4 規格）' },
  { type: 'favorites_4x2', category: 'reading', name: '我的最愛卡', size: 'size-4x2', icon: '❤️', description: '收藏於我的最愛之經典（支援 4x1/4x2/4x3/4x4）' },
  { type: 'recent_downloads_4x2', category: 'reading', name: '近期下載卡', size: 'size-4x2', icon: '📥', description: '最新下載之經典清單（支援 4x1/4x2/4x3/4x4）' },
  { type: 'stats_2x2', category: 'reading', name: '每日閱讀日誌', size: 'size-2x2', icon: '📅', description: '比照 iOS 月曆樣式，顯示當日日期與讀經摘要（支援 2x2/4x2 規格）' },

  // 4. 其他功能
  { type: 'timer_2x2', category: 'other', name: '護眼計時器', size: 'size-2x2', icon: '⏱️', description: '閱讀時間倒數與溫馨提醒（支援 4x2/2x2）' },
  { type: 'theme_4x1', category: 'other', name: '四色主題快捷列', size: 'size-4x1', icon: '🎨', description: '白、紙、舒、木 4 色背景一鍵切換' },
  { type: 'zen_4x2', category: 'other', name: '佛典精進名句', size: 'size-4x2', icon: '🪷', description: '每日輪播佛典名言與法義精粹' },
  { type: 'custom_memo', category: 'other', name: '自訂便籤小卡', size: 'size-4x2', icon: '📝', description: '讀者可自由輸入自選文字、法義或座右銘，支援自訂字體、字級、行高與邊距' }
];

export const PRESET_LAYOUTS: Record<string, HomeWidgetConfig[]> = {
  // 1. 版型1 極簡 (圖3、圖4全套配置：下載經典4x1 + 系統導航4x2 + 近期下載4x2 + 我的最愛4x2 + 品牌橫條4x1)
  default: [
    { id: 'w_download', type: 'download_2x2', size: 'size-4x1' },
    { id: 'w_system_nav', type: 'system_nav_4x2', size: 'size-4x2' },
    { id: 'w_recent_downloads', type: 'recent_downloads_4x2', size: 'size-4x2' },
    { id: 'w_favorites', type: 'favorites_4x2', size: 'size-4x2' },
    { id: 'w_title', type: 'title_4x1', size: 'size-4x1' }
  ],
  // 2. 版型2 淨心閱讀 (圖1、圖2全套配置)
  calm: [
    {
      id: 'w_calm_memo_1',
      type: 'custom_memo',
      size: 'size-4x1',
      memoHtml: '<p style="text-align: center; font-size: 19px; font-weight: 500; letter-spacing: 0.08em; margin: 0;">卍&nbsp;&nbsp;南無本師釋迦牟尼佛&nbsp;&nbsp;卍</p>'
    },
    {
      id: 'w_calm_memo_2',
      type: 'custom_memo',
      size: 'size-4x2',
      memoHtml: '<p style="text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 8px;">開經偈</p><p style="text-align: center; font-size: 16px; margin: 4px 0; line-height: 1.6;">無上甚深微妙法，百千萬劫難遭遇，</p><p style="text-align: center; font-size: 16px; margin: 4px 0; line-height: 1.6;">我今見聞得受持，願解如來真實義。</p>'
    },
    {
      id: 'w_calm_lastread_excerpt',
      type: 'lastread_excerpt_4x4',
      size: 'size-4x4'
    },
    {
      id: 'w_calm_memo_3',
      type: 'custom_memo',
      size: 'size-4x2',
      memoHtml: '<p style="text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 8px;">回向偈</p><p style="text-align: center; font-size: 16px; margin: 4px 0; line-height: 1.6;">願消三障諸煩惱，願得智慧真明瞭，</p><p style="text-align: center; font-size: 16px; margin: 4px 0; line-height: 1.6;">普願罪障悉消除，世世常行菩薩道。</p>'
    },
    {
      id: 'w_calm_memo_4',
      type: 'custom_memo',
      size: 'size-4x2',
      memoHtml: '<p style="text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 8px;">三皈依</p><p style="text-align: center; font-size: 15px; margin: 3px 0; line-height: 1.5;">自皈依佛，當願眾生，體解大道，發無上心。</p><p style="text-align: center; font-size: 15px; margin: 3px 0; line-height: 1.5;">自皈依法，當願眾生，深入經藏，智慧如海。</p><p style="text-align: center; font-size: 15px; margin: 3px 0; line-height: 1.5;">自皈依僧，當願眾生，統理大眾，一切無礙。</p>'
    },
    {
      id: 'w_calm_memo_5',
      type: 'custom_memo',
      size: 'size-4x1',
      memoHtml: '<p style="text-align: center; font-size: 19px; font-weight: 500; letter-spacing: 0.08em; margin: 0;">卍&nbsp;&nbsp;南無護法韋陀尊天菩薩&nbsp;&nbsp;卍</p>'
    },
    {
      id: 'w_calm_title',
      type: 'title_4x1',
      size: 'size-4x1'
    }
  ],
  // 3. 版型3 很多書 (圖1、圖2全套配置：日曆與近日閱讀4x2、近期下載6本、上次閱讀6本、我的最愛6本、佛典精選4x2、品牌橫條4x1)
  many_books: [
    { id: 'w_books_calendar', type: 'stats_2x2', size: 'size-4x2' },
    { id: 'w_books_shelf_down', type: 'shelf_down_capsule_4x3', size: 'size-4x3' },
    { id: 'w_books_shelf_read', type: 'shelf_read_capsule_4x3', size: 'size-4x3' },
    { id: 'w_books_shelf_fav', type: 'shelf_fav_capsule_4x3', size: 'size-4x3' },
    { id: 'w_books_zen', type: 'zen_4x2', size: 'size-4x2' },
    { id: 'w_books_title', type: 'title_4x1', size: 'size-4x1' }
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
  custom: [],
  custom1: [],
  custom2: [],
  custom3: []
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

  stats_2x2: ['size-2x2', 'size-4x2', 'size-1x1'],
  theme_4x1: ['size-4x1', 'size-2x2'],
  // 護眼模式：僅支援 4x2 與 2x2
  timer_2x2: ['size-4x2', 'size-2x2'],
  // 佛典精進名句：固定為 4x2
  zen_4x2: ['size-4x2'],
  // 自訂便籤小卡：限定尺寸 2x2 / 4x2 / 4x3 / 4x4 / 4x1
  custom_memo: ['size-4x2', 'size-4x3', 'size-4x4', 'size-2x2', 'size-4x1'],
  // 快捷功能卡片：4x2（圖1 4*3 規格暫時移除）
  quick_nav_4x2: ['size-4x2'],
  // 書櫃快捷卡：4x2
  shelf_quick_4x2: ['size-4x2'],
  // 系統導航卡：4x2
  system_nav_4x2: ['size-4x2'],
  // 下載與書櫃卡：4x2
  download_shelf_4x3: ['size-4x2'],
  // 依圖示規格設計之書櫃卡片群組：支援 4x1 (長條Bar) / 4x2 (4本書) / 4x3 (8本書) 自由拉伸切換
  shelf_fav_4x2: ['size-4x1', 'size-4x2', 'size-4x3'],
  shelf_down_4x2: ['size-4x1', 'size-4x2', 'size-4x3'],
  shelf_read_4x2: ['size-4x1', 'size-4x2', 'size-4x3'],
  // 兼容舊版與獨立宣告
  shelf_fav_4x3: ['size-4x1', 'size-4x2', 'size-4x3'],
  shelf_down_4x3: ['size-4x1', 'size-4x2', 'size-4x3'],
  shelf_read_4x3: ['size-4x1', 'size-4x2', 'size-4x3'],
  bar_down_4x1: ['size-4x1', 'size-4x2', 'size-4x3'],
  bar_read_4x1: ['size-4x1', 'size-4x2', 'size-4x3'],
  bar_fav_4x1: ['size-4x1', 'size-4x2', 'size-4x3'],
  // 3 款全新 4x3 4膠囊書櫃小卡
  shelf_fav_capsule_4x3: ['size-4x3', 'size-4x2', 'size-4x1'],
  shelf_down_capsule_4x3: ['size-4x3', 'size-4x2', 'size-4x1'],
  shelf_read_capsule_4x3: ['size-4x3', 'size-4x2', 'size-4x1'],
  // 3 款獨立 4x1 長條 Bar 與 4x3 三合一長條卡
  shelf_bars_4x3: ['size-4x3'],
  bar_dl_4x1: ['size-4x1']
};
