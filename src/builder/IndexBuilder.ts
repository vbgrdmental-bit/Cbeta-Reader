import type { BookMetadata } from '../types/book';
import { BUILDER_VERSION } from './version';
import { getSourceMode } from '../utils/sourceMode';
import type { SourceMode } from '../utils/sourceMode';

// 輔助函數：處理開發環境與生產環境的 API 請求路由，繞過 CORS 限制
export const getApiUrl = (path: string): string => {
  if (typeof window === 'undefined') {
    return `https://cbdata.dila.edu.tw${path}`;
  }
  return `/api-cbeta${path}`;
};

// 帶超時保護與有禮貌 Client 身份識別的 fetch 輔助函式 (預設 3.5 秒超時)
export const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 3500): Promise<Response | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  // 💡 大義名分與有禮貌身份識別標頭 (Polite Client Identity Headers)
  // 讓 CBETA / Cloudflare 系統管理員能清楚識別流量來源為正統開源 CBETA Reader 閱讀器，避免被誤判為匿名爬蟲
  const clientHeaders = {
    'X-Client-App': 'CBETA-Reader-App',
    'X-Client-Version': BUILDER_VERSION,
    'X-Client-Purpose': 'Scripture Reading (Polite Rate Limited Client)',
    'X-Requested-With': 'CBETA-Reader-WebClient'
  };

  const mergedHeaders = {
    ...clientHeaders,
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers: mergedHeaders, signal: controller.signal });
    clearTimeout(timer);
    return res.ok ? res : null;
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
};

export interface SearchResult {
  workId: string;
  title: string;
  creators: string;
  juansCount: number;
  category: string;
  vol?: string; // 冊別 e.g. T09
  cjkChars?: number; // 字數 e.g. 60222
  juanList?: number[]; // 特殊卷數列表 (例如 [1,2,3,4,5,7,8,...,20])
  isBackupSource?: boolean; // 標示是否來自備用鏡像源
}

export function sanitizeCreators(creators?: string | null): string {
  if (!creators) return '';
  const trimmed = creators.trim();
  if (
    trimmed === 'CBETA' ||
    trimmed === 'CBETA 大藏經' ||
    trimmed === 'CBETA 電子佛典' ||
    trimmed === '未知' ||
    trimmed === 'unknown'
  ) {
    return '';
  }
  return trimmed;
}

// 內建核心經典靜態庫 (做為極速備用 Fallback，確保 100% 搜尋零卡死)
export const FEATURED_BOOKS: SearchResult[] = [
  { workId: 'T0220', title: '大般若波羅蜜多經', creators: '唐 玄奘譯', juansCount: 600, category: '般若部類', vol: 'T05', cjkChars: 4678166 },
  { workId: 'T0221', title: '放光般若經', creators: '西晉 無羅叉譯', juansCount: 20, category: '般若部類', vol: 'T08', cjkChars: 211019 },
  { workId: 'T0222', title: '光讚經', creators: '西晉 竺法護譯', juansCount: 10, category: '般若部類', vol: 'T08', cjkChars: 99689 },
  { workId: 'T0223', title: '摩訶般若波羅蜜經', creators: '姚秦 鳩摩羅什譯', juansCount: 27, category: '般若部類', vol: 'T08', cjkChars: 287174 },
  { workId: 'T0227', title: '小品般若波羅蜜經', creators: '姚秦 鳩摩羅什譯', juansCount: 10, category: '般若部類', vol: 'T08', cjkChars: 72009 },
  { workId: 'T0235', title: '金剛般若波羅蜜經', creators: '姚秦 鳩摩羅什譯', juansCount: 1, category: '般若部類', vol: 'T08', cjkChars: 5191 },
  { workId: 'T0245', title: '佛說仁王般若波羅蜜經', creators: '姚秦 鳩摩羅什譯', juansCount: 2, category: '般若部類', vol: 'T08', cjkChars: 12142 },
  { workId: 'T0251', title: '般若波羅蜜多心經', creators: '唐 玄奘譯', juansCount: 1, category: '般若部類', vol: 'T08', cjkChars: 1097 },
  { workId: 'T0255', title: '般若波羅蜜多心經', creators: '唐 玄奘譯', juansCount: 1, category: '般若部類', vol: 'T08', cjkChars: 612 },
  { workId: 'T0412', title: '地藏菩薩本願經', creators: '唐 實叉難陀譯', juansCount: 2, category: '大集部類', vol: 'T13', cjkChars: 17098 },
  { workId: 'T0411', title: '大乘大集地藏十輪經', creators: '唐 玄奘譯', juansCount: 10, category: '大集部類', vol: 'T13', cjkChars: 75447 },
  { workId: 'T1158', title: '地藏菩薩儀軌', creators: '唐 實叉難陀譯', juansCount: 1, category: '密教部類', vol: 'T20', cjkChars: 754 },
  { workId: 'T1159', title: '占察善惡業報經（地藏占察經）', creators: '隋 菩提燈譯', juansCount: 2, category: '密教部類', vol: 'T20', cjkChars: 13203 },
  { workId: 'T0779', title: '佛說八大人覺經', creators: '後漢 安世高譯', juansCount: 1, category: '經集部類', vol: 'T17', cjkChars: 397 },
  { workId: 'B0080', title: '大唐西域記（校點本）', creators: '唐 玄奘、辯機撰', juansCount: 12, category: '史傳部類', vol: 'B13', cjkChars: 109388 },
  { workId: 'T0262', title: '妙法蓮華經', creators: '姚秦 鳩摩羅什譯', juansCount: 7, category: '法華部類', vol: 'T09', cjkChars: 72072 },
  { workId: 'T1944', title: '禮法華經儀式', creators: '', juansCount: 1, category: '法華部類', vol: 'T46', cjkChars: 470 },
  { workId: 'T0276', title: '無量義經', creators: '蕭齊 曇摩迦陀耶舍譯', juansCount: 1, category: '法華部類', vol: 'T09', cjkChars: 8571 },
  { workId: 'T0366', title: '佛說阿彌陀經', creators: '姚秦 鳩摩羅什譯', juansCount: 1, category: '寶積部類,淨土宗部類', vol: 'T12', cjkChars: 2109 },
  { workId: 'T0279', title: '大方廣佛華嚴經', creators: '唐 實叉難陀譯', juansCount: 80, category: '華嚴部類', vol: 'T10', cjkChars: 593143 },
  { workId: 'T0310', title: '大寶積經', creators: '唐 菩提流志譯', juansCount: 120, category: '寶積部類', vol: 'T11', cjkChars: 895417 },
  { workId: 'T0374', title: '大般涅槃經', creators: '北涼 曇無讖譯', juansCount: 40, category: '涅槃部類', vol: 'T12', cjkChars: 336222 },
  { workId: 'T0397', title: '大方等大集經', creators: '北涼 曇無讖譯', juansCount: 60, category: '大集部類', vol: 'T13', cjkChars: 558392 },
  { workId: 'T0450', title: '藥師琉璃光如來本願功德經', creators: '唐 玄奘譯', juansCount: 1, category: '經集部類', vol: 'T14', cjkChars: 4972 },
  { workId: 'T0475', title: '維摩詰所說經', creators: '姚秦 鳩摩羅什譯', juansCount: 3, category: '經集部類', vol: 'T14', cjkChars: 27239 },
  { workId: 'T0784', title: '四十二章經', creators: '東漢 攝摩騰,竺法蘭譯', juansCount: 1, category: '經集部類', vol: 'T17', cjkChars: 2495 },
  { workId: 'T0801', title: '佛說無常經', creators: '唐 義淨譯', juansCount: 1, category: '經集部類', vol: 'T17', cjkChars: 2096 },
  { workId: 'T0945', title: '大佛頂如來密因修證了義諸菩薩萬行首楞嚴經', creators: '唐 般剌蜜帝譯', juansCount: 10, category: '密教部類', vol: 'T19', cjkChars: 70934 },
  { workId: 'T1428', title: '四分律', creators: '姚秦 佛陀耶舍共竺佛念譯', juansCount: 60, category: '律部類', vol: 'T22', cjkChars: 608001 },
  { workId: 'T1545', title: '阿毘達磨大毘婆沙論', creators: '唐 玄奘譯', juansCount: 200, category: '毘曇部類', vol: 'T27', cjkChars: 1375378 },
  { workId: 'T1558', title: '阿毘達磨俱舍論', creators: '唐 玄奘譯', juansCount: 30, category: '毘曇部類', vol: 'T29', cjkChars: 205983 },
  { workId: 'T1564', title: '中論', creators: '龍樹菩薩造 姚秦 鳩摩羅什譯', juansCount: 4, category: '中觀部類', vol: 'T30', cjkChars: 43616 },
  { workId: 'T1579', title: '瑜伽師地論', creators: '彌勒菩薩說 唐 玄奘譯', juansCount: 100, category: '瑜伽部類', vol: 'T30', cjkChars: 808817 },
  { workId: 'T1586', title: '唯識三十論頌', creators: '世親菩薩造 唐 玄奘譯', juansCount: 1, category: '瑜伽部類', vol: 'T31', cjkChars: 1203 },
  { workId: 'T1666', title: '大乘起信論', creators: '馬鳴菩薩造 梁 真諦譯', juansCount: 1, category: '論集部類', vol: 'T32', cjkChars: 11251 },
  { workId: 'T2008', title: '六祖大師法寶壇經', creators: '唐 釋法海集', juansCount: 1, category: '禪宗部類', vol: 'T48', cjkChars: 26432 },
  { workId: 'Y0001', title: '般若經講記', creators: '民國 釋印順著', juansCount: 3, category: '新編部類', vol: 'Y01', cjkChars: 73164 },
  { workId: 'Y0002', title: '寶積經講記', creators: '民國 釋印順著', juansCount: 2, category: '新編部類', vol: 'Y02', cjkChars: 89078 },
  { workId: 'Y0003', title: '勝鬘經講記', creators: '民國 釋印順著', juansCount: 2, category: '新編部類', vol: 'Y03', cjkChars: 87742 },
  { workId: 'Y0040', title: '成佛之道（增注本）', creators: '民國 釋印順著', juansCount: 5, category: '新編部類', vol: 'Y42', cjkChars: 146784 }
];

export function isFuzzyTitleMatch(title: string, query: string): boolean {
  if (!title || !query) return false;
  const cleanTitle = title.toLowerCase();
  const cleanQuery = query.toLowerCase().trim();

  if (cleanTitle.includes(cleanQuery)) return true;

  // 若查詢以「經」結尾（例如「大般若經」、「地藏經」），去掉尾字「經」進行子字串匹配
  if (cleanQuery.endsWith('經') && cleanQuery.length > 1) {
    const stem = cleanQuery.slice(0, -1);
    if (cleanTitle.includes(stem)) return true;
  }

  // 順序字元比對 (例如 「大般若經」-> 「大...般若...經」)
  let tIdx = 0;
  for (let qIdx = 0; qIdx < cleanQuery.length; qIdx++) {
    const char = cleanQuery[qIdx];
    tIdx = cleanTitle.indexOf(char, tIdx);
    if (tIdx === -1) return false;
    tIdx++;
  }
  return true;
}

const CATEGORY_KEYWORDS_MAP: Record<string, string> = {
  '般若': '般若部類',
  '阿含': '阿含部類',
  '本緣': '本緣部類',
  '法華': '法華部類',
  '華嚴': '華嚴部類',
  '寶積': '寶積部類',
  '涅槃': '涅槃部類',
  '大集': '大集部類',
  '經集': '經集部類',
  '密教': '密教部類',
  '律': '律部類',
  '毘曇': '毘曇部類',
  '中觀': '中觀部類',
  '瑜伽': '瑜伽部類',
  '論集': '論集部類',
  '禪': '禪宗部類',
};

const searchCacheMap = new Map<string, SearchResult[]>();
let fullWorksIndexCache: SearchResult[] | null = null;

async function loadFullWorksIndex(): Promise<SearchResult[]> {
  if (fullWorksIndexCache) return fullWorksIndexCache;
  try {
    const urls = [
      '/cbeta-works-index.json',
      '/backup/works-index.json',
      'https://github.com/vbgrdmental-bit/Cbeta-Reader/releases/download/v1.0.0-database/cbeta-works-index.json',
      'https://raw.githubusercontent.com/vbgrdmental-bit/Cbeta-Reader/main/public/cbeta-works-index.json'
    ];
    for (const url of urls) {
      const res = await fetchWithTimeout(url, {}, 3500);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.works) && data.works.length > 0) {
          fullWorksIndexCache = data.works.map((w: any) => ({
            ...w,
            isBackupSource: true
          }));
          return fullWorksIndexCache!;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to fetch cbeta-works-index.json:', e);
  }
  return [];
}

export function calculateSearchMatchScore(
  w: { title?: string; creators?: string; byline?: string; workId?: string; work?: string; category?: string; vol?: string }, 
  query: string
): number {
  if (!query) return 0;
  const q = query.trim().toLowerCase();
  const title = (w.title || '').toLowerCase();
  const creator = (w.creators || (w as any).byline || '').toLowerCase();
  const workId = (w.workId || (w as any).work || '').toLowerCase();
  const category = (w.category || '').toLowerCase();
  const vol = (w.vol || '').toLowerCase();
  const fullText = `${title} ${creator} ${workId} ${category} ${vol}`.toLowerCase();

  // 1. 完全或前綴吻合 (Exact / Prefix Match)
  if (title === q || workId === q) return 100;
  if (title.startsWith(q)) return 96;
  if (title.includes(q)) return 94;
  if (creator.includes(q) || workId.includes(q)) return 92;

  // 2. 多關鍵字空白分隔 (Multi-word space separated AND search: 例如 "地藏 註"、"地藏 靈椉")
  const tokens = q.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length > 1 && tokens.every(t => fullText.includes(t))) {
    return 88;
  }

  // 3. 順序字元萬用匹配 (Characters sequential wildcard matching: 例如 "地藏經註" -> /地.*?藏.*?經.*?註/i)
  const cleanQ = q.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  if (cleanQ.length >= 3) {
    const chars = cleanQ.split('');
    const pattern = new RegExp(chars.join('.*?'), 'i');
    if (pattern.test(title)) return 85;
  }

  // 4. 佛典註疏與常見簡稱智慧關聯 (Commentaries & Abbreviations: 例如 "地藏經註" -> 關聯 "地藏本願經科註"、"地藏本願經科文")
  const commentKeywords = ['註', '注', '科註', '疏', '科', '科文', '綸貫', '解', '記', '音義', '讚', '儀', '懺', '論'];
  for (const ck of commentKeywords) {
    if (q.includes(ck)) {
      const base = q.replace(new RegExp(ck, 'g'), '').replace(/經$/, '');
      if (base.length >= 2 && title.includes(base)) {
        if (title.includes(ck) || title.includes('科註') || title.includes('科文') || title.includes('疏') || title.includes('註') || title.includes('注')) {
          return 80;
        }
      }
    }
  }

  // 5. 若查詢以「經」結尾，匹配核心經名 (例如 "地藏經" -> "地藏菩薩本願經")
  if (q.endsWith('經') && q.length > 2) {
    const base = q.slice(0, -1);
    if (title.includes(base)) return 75;
  }

  // 6. 雙字分詞子字串交集 (Bigram Stem matching)
  if (cleanQ.length >= 4) {
    const subTokens: string[] = [];
    for (let i = 0; i <= cleanQ.length - 2; i += 2) {
      subTokens.push(cleanQ.slice(i, i + 2));
    }
    const matchedTokensCount = subTokens.filter(st => title.includes(st)).length;
    if (subTokens.length >= 2 && matchedTokensCount === subTokens.length) {
      return 70;
    }
  }

  // 7. 其它欄位模糊匹配 (Category, vol, creators)
  if (fullText.includes(q)) return 65;

  return 0;
}

export class IndexBuilder {
  /**
   * 從藏經總目 (cbeta-works-index.json / FEATURED_BOOKS) 中取得指定經典的權威 Metadata 與真實總卷數
   */
  static async getWorkMetaFromIndex(workId: string): Promise<SearchResult | null> {
    if (!workId) return null;
    const cleanId = workId.trim().toUpperCase();
    
    // 1. 優先從 fullWorksIndex 中尋找 (涵蓋 CBETA 全部 4,882 部經典)
    const fullIndex = await loadFullWorksIndex();
    if (fullIndex && fullIndex.length > 0) {
      const found = fullIndex.find(w => 
        (w.workId && w.workId.toUpperCase() === cleanId) || 
        ((w as any).work && String((w as any).work).toUpperCase() === cleanId)
      );
      if (found && found.juansCount) {
        return found;
      }
    }

    // 2. 備用：從 FEATURED_BOOKS 尋找
    const featured = FEATURED_BOOKS.find(b => b.workId.toUpperCase() === cleanId);
    return featured || null;
  }

  /**
   * 搜尋經典名稱 (全藏 4,882 部經典本機極速索引 + 模糊註疏語意關聯 + 線上即時補充)
   */
  static async searchTitle(query: string, options?: { sourceMode?: SourceMode }): Promise<SearchResult[]> {
    const activeMode = options?.sourceMode || getSourceMode();
    const isBackup = activeMode === 'backup';

    if (!query || query.trim() === '') {
      if (isBackup) {
        const allBackupWorks = await loadFullWorksIndex();
        return allBackupWorks.slice(0, 35);
      }
      return FEATURED_BOOKS.map(b => ({ ...b, isBackupSource: false }));
    }

    const trimmedQuery = query.trim();
    const cacheKey = `${activeMode}_${trimmedQuery.toLowerCase()}`;

    // 💡 0. 記憶體快取：若曾搜尋過該關鍵字，即時秒回
    if (searchCacheMap.has(cacheKey)) {
      return searchCacheMap.get(cacheKey)!;
    }

    // 💡 1. 載入全藏經 4,882 部完整總目進行智慧評分比對 (涵蓋全部大正藏、卍續藏、印順著作等)
    const allWorks = await loadFullWorksIndex();
    const localPool: SearchResult[] = (allWorks.length > 0 ? allWorks : FEATURED_BOOKS).map(b => ({
      workId: b.workId || (b as any).work || '',
      title: b.title || '',
      creators: sanitizeCreators(b.creators || (b as any).byline),
      juansCount: b.juansCount || 1,
      category: b.category || 'CBETA',
      vol: b.vol,
      cjkChars: b.cjkChars,
      isBackupSource: isBackup
    }));

    // 本地 4,882 經典評分匹配
    const scoredLocalResults = localPool
      .map(b => ({ book: b, score: calculateSearchMatchScore(b, trimmedQuery) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const resultsMap = new Map<string, { book: SearchResult; score: number }>();
    scoredLocalResults.forEach(item => {
      if (item.book.workId) {
        resultsMap.set(item.book.workId, item);
      }
    });

    // 💡 2. 主源模式 (Primary Source)：同時並行向 CBETA 官方 API 發起請求 (4.5秒超時保護)，補充最新線上收錄
    if (!isBackup) {
      try {
        const queriesToSearch = new Set<string>([trimmedQuery]);
        if (trimmedQuery.endsWith('經') && trimmedQuery.length > 1) {
          queriesToSearch.add(trimmedQuery.slice(0, -1));
        }

        const promises: Array<{ key: string; promise: Promise<Response | null> }> = [];

        for (const q of queriesToSearch) {
          const titleUrl = getApiUrl(`/stable/search/title?q=${encodeURIComponent(q)}`);
          const directTitleUrl = `https://cbdata.dila.edu.tw/stable/search/title?q=${encodeURIComponent(q)}`;
          const fetchTitle = async () => {
            let res = await fetchWithTimeout(titleUrl, { headers: { 'Accept': 'application/json' } }, 4500);
            if (!res) {
              res = await fetchWithTimeout(directTitleUrl, { headers: { 'Accept': 'application/json' } }, 4500);
            }
            return res;
          };
          promises.push({ key: `title_${q}`, promise: fetchTitle() });
        }

        const creatorUrl = getApiUrl(`/stable/works?creator=${encodeURIComponent(trimmedQuery)}`);
        const directCreatorUrl = `https://cbdata.dila.edu.tw/stable/works?creator=${encodeURIComponent(trimmedQuery)}`;
        const fetchCreator = async () => {
          let res = await fetchWithTimeout(creatorUrl, { headers: { 'Accept': 'application/json' } }, 4500);
          if (!res) {
            res = await fetchWithTimeout(directCreatorUrl, { headers: { 'Accept': 'application/json' } }, 4500);
          }
          return res;
        };
        promises.push({ key: 'creator', promise: fetchCreator() });

        // 部類關鍵字自動對應
        let matchedCategoryName = '';
        for (const [kw, cat] of Object.entries(CATEGORY_KEYWORDS_MAP)) {
          if (trimmedQuery.includes(kw)) {
            matchedCategoryName = cat;
            break;
          }
        }
        if (matchedCategoryName) {
          const catUrl = getApiUrl(`/stable/works?category=${encodeURIComponent(matchedCategoryName)}`);
          const directCatUrl = `https://cbdata.dila.edu.tw/stable/works?category=${encodeURIComponent(matchedCategoryName)}`;
          const fetchCat = async () => {
            let res = await fetchWithTimeout(catUrl, { headers: { 'Accept': 'application/json' } }, 4500);
            if (!res) {
              res = await fetchWithTimeout(directCatUrl, { headers: { 'Accept': 'application/json' } }, 4500);
            }
            return res;
          };
          promises.push({ key: 'category', promise: fetchCat() });
        }

        // 若為經號 (如 T0235)
        if (/^[a-zA-Z]\d+/.test(trimmedQuery)) {
          const workUrl = getApiUrl(`/stable/works?work=${trimmedQuery.toUpperCase()}`);
          const directWorkUrl = `https://cbdata.dila.edu.tw/stable/works?work=${trimmedQuery.toUpperCase()}`;
          const fetchWork = async () => {
            let res = await fetchWithTimeout(workUrl, { headers: { 'Accept': 'application/json' } }, 4500);
            if (!res) {
              res = await fetchWithTimeout(directWorkUrl, { headers: { 'Accept': 'application/json' } }, 4500);
            }
            return res;
          };
          promises.push({ key: 'work', promise: fetchWork() });
        }

        const resultsList = await Promise.all(
          promises.map(async p => {
            const res = await p.promise;
            if (!res) return { key: p.key, data: null };
            const data = await res.json().catch(() => null);
            return { key: p.key, data };
          })
        );

        resultsList.forEach(item => {
          if (item.data && Array.isArray(item.data.results)) {
            item.data.results.forEach((r: any) => {
              const wId = r.work || r.file || r.work_info?.work || '';
              if (!wId) return;
              const onlineBook: SearchResult = {
                workId: wId,
                title: r.title || r.content || r.work_info?.title || '未命名經典',
                creators: sanitizeCreators(r.creators || r.byline || r.work_info?.byline),
                juansCount: r.juan || r.juans || r.work_info?.juans || 1,
                category: r.category || r.work_info?.category || (item.key === 'category' ? matchedCategoryName : '未分類'),
                vol: r.vol,
                cjkChars: r.cjk_chars,
                isBackupSource: false
              };
              const score = calculateSearchMatchScore(onlineBook, trimmedQuery) || 75;
              const existing = resultsMap.get(wId);
              if (!existing || score > existing.score) {
                resultsMap.set(wId, { book: onlineBook, score });
              }
            });
          }
        });
      } catch (onlineErr) {
        console.warn('[IndexBuilder] Online search query fallback to full works index:', onlineErr);
      }
    }

    const finalResults = Array.from(resultsMap.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // 同分時優先顯示大正藏 (T) 與印順著作 (Y)
        const idA = a.book.workId || '';
        const idB = b.book.workId || '';
        const isPriA = idA.startsWith('T0') || idA.startsWith('Y0');
        const isPriB = idB.startsWith('T0') || idB.startsWith('Y0');
        if (isPriA && !isPriB) return -1;
        if (!isPriA && isPriB) return 1;
        return idA.localeCompare(idB);
      })
      .map(item => item.book);

    if (finalResults.length > 0) {
      searchCacheMap.set(cacheKey, finalResults);
    }

    // 非阻塞背景補全：非同步在背景完善前 15 筆結果的精確總卷數與作譯者細節
    if (!isBackup) {
      Promise.all(
        finalResults.slice(0, 15).map(async (res) => {
          try {
            const metaUrl = getApiUrl(`/stable/works?work=${res.workId}`);
            const response = await fetchWithTimeout(metaUrl, {}, 2500);
            if (response && response.ok) {
              const data = await response.json();
              if (data && Array.isArray(data.results) && data.results.length > 0) {
                const workInfo = data.results[0];
                if (workInfo.juan && typeof workInfo.juan === 'number') {
                  res.juansCount = workInfo.juan;
                }
                if (workInfo.category) {
                  res.category = workInfo.category;
                }
                if (workInfo.creators && sanitizeCreators(workInfo.creators)) {
                  const dynasty = (workInfo.time_dynasty && workInfo.time_dynasty !== 'unknown') ? `${workInfo.time_dynasty} ` : '';
                  const creatorName = workInfo.creators.replace(/\(.*\)/, '').trim();
                  res.creators = sanitizeCreators(creatorName.startsWith(dynasty.trim()) ? creatorName : `${dynasty}${creatorName}`);
                } else if (workInfo.byline && sanitizeCreators(workInfo.byline)) {
                  res.creators = sanitizeCreators(workInfo.byline);
                }
                if (workInfo.vol) {
                  res.vol = workInfo.vol;
                } else if (workInfo.file) {
                  const match = workInfo.file.match(/^([A-Z]\d+)/i);
                  if (match) res.vol = match[1].toUpperCase();
                }
                if (workInfo.cjk_chars != null && typeof workInfo.cjk_chars === 'number') {
                  const enWords = (workInfo.en_words != null && typeof workInfo.en_words === 'number') ? workInfo.en_words : 0;
                  res.cjkChars = workInfo.cjk_chars + enWords;
                }
              }
            }
          } catch {
            // 容錯跳過
          }
        })
      ).catch(() => {});
    }

    return finalResults;
  }

  /**
   * 建立經典基本 Metadata
   */
  static buildMetadata(searchResult: SearchResult): BookMetadata {
    return {
      workId: searchResult.workId,
      title: searchResult.title,
      canon: searchResult.workId.charAt(0),
      vol: searchResult.vol,
      cjkChars: searchResult.cjkChars,
      category: searchResult.category,
      creators: sanitizeCreators(searchResult.creators),
      juansCount: searchResult.juansCount,
      packagedAt: new Date().toISOString(),
      version: BUILDER_VERSION
    };
  }
}
