export interface BookMetadata {
  workId: string;       // 例如 T0412
  title: string;        // 地藏菩薩本願經
  canon: string;        // T
  vol?: string;         // 冊別 T09 (大正藏第 9 冊)
  category: string;     // 大乘單譯經 / 部類
  creators: string;     // 唐實叉難陀譯
  juansCount: number;   // 卷數
  description?: string;
  cover?: string;       // Base64 或預設圖示 URL
  version?: string;
  packagedAt?: string;  // 匯入時間
}

// 經文的最小段落單位（可以用作全文檢索、AI 問答與經文顯示的基石）
export interface TextSegment {
  id: string;          // 唯一的段落 ID, 例如 T0412_01_p0778a01
  lb: string;          // CBETA 原始頁碼/行號, 例如 T13p0778a01
  juan: number;        // 卷數
  tocId?: string;      // 所屬品 (TOC) 的 ID
  muluTitles?: string[]; // 起始於此段落的品名列表
  isHead?: boolean;    // 是否為品名/標題段落
  isVerse?: boolean;   // 是否為偈頌 (韻文)
  isOrig?: boolean;    // 是否為原始經文/經文引文 (粗體圓體)
  content: string;     // 乾淨的閱讀文字（Reader Model）
  originalContent: string; // 帶有完整 XML 標籤或校勘標記的 HTML（Canonical Model）
  notes?: Array<{      // 本段所屬的校勘/註解（Reference Model）
    id: string;        // 校勘編號, 如 [01]
    content: string;   // 校勘內容
    cbetaUrl?: string; // CBETA Online 對應連結
  }>;
}

// 卷的資料結構
export interface JuanData {
  juan: number;
  segments: TextSegment[];
}

export interface BookContent {
  workId: string;
  juans: JuanData[];
}

// Table of Contents (TOC)
export interface TOCItem {
  id: string;          // 品/章節 ID
  title: string;       // 比如 "第一品 忉利天宮神通品"
  juan: number;        // 所在卷數
  startSegmentId: string; // 啟始段落 ID
  children?: TOCItem[]; // 子章節 (多層級樹狀結構)
}

export interface BookTOC {
  workId: string;
  items: TOCItem[];
}

// 導航對照 (卷 與 品/章節 的雙向對照)
export interface NavigationMap {
  juanToTocs: { [juan: number]: string[] }; // 每一卷包含哪些品
  tocToJuan: { [tocId: string]: number };   // 每一品在第幾卷
}

// 外部引用連結對照 (Reference Model)
export interface ReferenceMap {
  workId: string;
  cbetaOnlineUrl: string;   // 該經典在 CBETA 官網的連結
  pdfUrl?: string;          // PDF 連結
  epubUrl?: string;         // EPUB 連結
  cbetaImageBaseUrl?: string; // 大正藏影像基礎 URL
}

// 本地搜尋索引 (Search Index)
export interface SearchIndexItem {
  segmentId: string;
  juan: number;
  tocTitle: string;
  content: string; // 用於快速搜尋的純文字
}

export interface BookSearchIndex {
  workId: string;
  items: SearchIndexItem[];
}

// [預留 AI RAG] 向量索引
export interface EmbeddingItem {
  segmentId: string;
  vector: number[];
  text: string;
}

export interface BookEmbedding {
  workId: string;
  items: EmbeddingItem[];
}

// 最終匯入的 .book 套件物件
export interface ReaderPackage {
  metadata: BookMetadata;
  content: BookContent;
  toc: BookTOC;
  navigation: NavigationMap;
  reference: ReferenceMap;
  searchIndex: BookSearchIndex;
  embedding: BookEmbedding; // 預留
}
