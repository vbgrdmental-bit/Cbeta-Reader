import type { BookMetadata } from '../types/book';
import { BUILDER_VERSION } from './version';
import { getSourceMode } from '../utils/sourceMode';
import type { SourceMode } from '../utils/sourceMode';

// 輔助函數：處理開發環境與生產環境的 API 請求路由，繞過 CORS 限制
export const getApiUrl = (path: string): string => {
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
  isBackupSource?: boolean; // 標示是否來自備用鏡像源
}

// 內建核心經典靜態庫 (做為極速備用 Fallback，確保 100% 搜尋零卡死)
// 內建核心經典靜態庫 (做為極速備用 Fallback，確保 100% 搜尋零卡死)
export const FEATURED_BOOKS: SearchResult[] = [
  { workId: 'T0220', title: '大般若波羅蜜多經', creators: '唐 玄奘譯', juansCount: 600, category: '般若部類', vol: 'T05', cjkChars: 4850000 },
  { workId: 'T0221', title: '光讚般若波羅蜜經', creators: '西晉 竺法護譯', juansCount: 10, category: '般若部類', vol: 'T08' },
  { workId: 'T0222', title: '放光般若波羅蜜經', creators: '西晉 無羅叉譯', juansCount: 20, category: '般若部類', vol: 'T08' },
  { workId: 'T0223', title: '摩訶般若波羅蜜經', creators: '姚秦 鳩摩羅什譯', juansCount: 27, category: '般若部類', vol: 'T08' },
  { workId: 'T0227', title: '小品般若波羅蜜經', creators: '姚秦 鳩摩羅什譯', juansCount: 10, category: '般若部類', vol: 'T08' },
  { workId: 'T0235', title: '金剛般若波羅蜜經', creators: '姚秦 鳩摩羅什譯', juansCount: 1, category: '般若部類', vol: 'T08', cjkChars: 5165 },
  { workId: 'T0245', title: '仁王般若波羅蜜經', creators: '姚秦 鳩摩羅什譯', juansCount: 2, category: '般若部類', vol: 'T08' },
  { workId: 'T0251', title: '般若波羅蜜多心經', creators: '唐 玄奘譯', juansCount: 1, category: '般若部類', vol: 'T08', cjkChars: 260 },
  { workId: 'T0255', title: '勝天王般若波羅蜜經', creators: '陳 月婆首那譯', juansCount: 7, category: '般若部類', vol: 'T08' },
  { workId: 'T0412', title: '地藏菩薩本願經', creators: '唐 實叉難陀譯', juansCount: 2, category: '大集部類', vol: 'T13', cjkChars: 17926 },
  { workId: 'T0411', title: '大乘大集地藏十輪經', creators: '唐 玄奘譯', juansCount: 10, category: '大集部類', vol: 'T13' },
  { workId: 'T1158', title: '地藏菩薩陀羅尼經', creators: '唐 實叉難陀譯', juansCount: 1, category: '密教部類', vol: 'T20' },
  { workId: 'T1159', title: '占察善惡業報經（地藏占察經）', creators: '隋 菩提燈譯', juansCount: 2, category: '密教部類', vol: 'T20' },
  { workId: 'T0779', title: '佛說八大人覺經', creators: '後漢 安世高譯', juansCount: 1, category: '經集部類', vol: 'T17' },
  { workId: 'B0080', title: '大唐西域記（校文本）', creators: '唐 玄奘、辯機撰', juansCount: 12, category: '史傳部類', vol: 'B10' },
  { workId: 'T0262', title: '妙法蓮華經', creators: '姚秦 鳩摩羅什譯', juansCount: 7, category: '法華部類', vol: 'T09', cjkChars: 69400 },
  { workId: 'T1944', title: '禮法華經儀式', creators: 'CBETA 大藏經', juansCount: 1, category: '法華部類', vol: 'T46', cjkChars: 470 },
  { workId: 'T0279', title: '大方廣佛華嚴經', creators: '唐 實叉難陀譯', juansCount: 80, category: '華嚴部類', vol: 'T10', cjkChars: 587000 },
  { workId: 'T0310', title: '大寶積經', creators: '唐 菩提流志譯', juansCount: 120, category: '寶積部類', vol: 'T11' },
  { workId: 'T0374', title: '大般涅槃經', creators: '北涼 曇無讖譯', juansCount: 40, category: '涅槃部類', vol: 'T12', cjkChars: 380000 },
  { workId: 'T0397', title: '大方廣大集經', creators: '北涼 曇無讖譯', juansCount: 60, category: '大集部類', vol: 'T13' },
  { workId: 'T0450', title: '藥師琉璃光如來本願功德經', creators: '唐 玄奘譯', juansCount: 1, category: '經集部類', vol: 'T14', cjkChars: 5328 },
  { workId: 'T0475', title: '維摩詰所說經', creators: '姚秦 鳩摩羅什譯', juansCount: 3, category: '經集部類', vol: 'T14', cjkChars: 24500 },
  { workId: 'T0945', title: '大佛頂如來密因修證了義諸菩薩萬行首楞嚴經', creators: '唐 般剌蜜帝譯', juansCount: 10, category: '密教部類', vol: 'T19', cjkChars: 60222 },
  { workId: 'T1428', title: '四分律', creators: '姚秦 佛陀耶舍共竺佛念譯', juansCount: 60, category: '律部類', vol: 'T22' },
  { workId: 'T1545', title: '阿毘達磨大毘婆沙論', creators: '唐 玄奘譯', juansCount: 200, category: '毘曇部類', vol: 'T27' },
  { workId: 'T1558', title: '阿毘達磨俱舍論', creators: '唐 玄奘譯', juansCount: 30, category: '毘曇部類', vol: 'T29' },
  { workId: 'T1564', title: '中論', creators: '龍樹菩薩造 姚秦 鳩摩羅什譯', juansCount: 4, category: '中觀部類', vol: 'T30' },
  { workId: 'T1579', title: '瑜伽師地論', creators: '彌勒菩薩說 唐 玄奘譯', juansCount: 100, category: '瑜伽部類', vol: 'T30' },
  { workId: 'T1586', title: '唯識三十論頌', creators: '世親菩薩造 唐 玄奘譯', juansCount: 1, category: '瑜伽部類', vol: 'T31' },
  { workId: 'T1666', title: '大乘起信論', creators: '馬鳴菩薩造 梁 真諦譯', juansCount: 1, category: '論集部類', vol: 'T32' },
  { workId: 'T2005', title: '六祖大師法寶壇經', creators: '唐 釋法海集', juansCount: 1, category: '禪宗部類', vol: 'T48', cjkChars: 20400 },
  { workId: 'Y0001', title: '印度之佛教', creators: '印順法師著', juansCount: 1, category: '新編部類', vol: 'Y01' },
  { workId: 'Y0002', title: '印度佛教思想史', creators: '印順法師著', juansCount: 1, category: '新編部類', vol: 'Y01' },
  { workId: 'Y0003', title: '勝鬘經講記', creators: '印順法師著', juansCount: 1, category: '新編部類', vol: 'Y01' },
  { workId: 'Y0040', title: '成佛之道（增注本）', creators: '釋印順著', juansCount: 5, category: '新編部類', vol: 'Y01' }
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

export class IndexBuilder {
  /**
   * 搜尋經典名稱 (高效快取 + 模糊比對 + 4.5秒強效超時保護)
   */
  static async searchTitle(query: string, options?: { sourceMode?: SourceMode }): Promise<SearchResult[]> {
    const activeMode = options?.sourceMode || getSourceMode();

    // 💡 1. 備援模式 (Backup Mode)：絕對不使用硬編碼 FEATURED_BOOKS，100% 純淨讀取真實備援藏經庫
    if (activeMode === 'backup') {
      const allBackupWorks = await loadFullWorksIndex();
      if (!query || query.trim() === '') {
        return allBackupWorks.slice(0, 35);
      }

      const trimmedQuery = query.trim();
      const cacheKey = `${activeMode}_${trimmedQuery.toLowerCase()}`;

      if (searchCacheMap.has(cacheKey)) {
        return searchCacheMap.get(cacheKey)!;
      }

      const lowerQuery = trimmedQuery.toLowerCase();
      const matched = allBackupWorks.filter(b => 
        b.title.includes(trimmedQuery) ||
        isFuzzyTitleMatch(b.title, trimmedQuery) ||
        b.workId.toLowerCase().includes(lowerQuery) ||
        (b.creators && b.creators.includes(trimmedQuery)) ||
        (b.category && b.category.includes(trimmedQuery)) ||
        (b.vol && b.vol.toLowerCase().includes(lowerQuery))
      ).map(b => ({ ...b, isBackupSource: true }));

      searchCacheMap.set(cacheKey, matched);
      return matched;
    }

    if (!query || query.trim() === '') {
      return FEATURED_BOOKS.map(b => ({ ...b, isBackupSource: false }));
    }

    const trimmedQuery = query.trim();
    const cacheKey = `${activeMode}_${trimmedQuery.toLowerCase()}`;

    // 💡 0. 記憶體快取：若曾搜尋過該關鍵字，立場秒回結果
    if (searchCacheMap.has(cacheKey)) {
      return searchCacheMap.get(cacheKey)!;
    }

    // 優先匹配內建經典（本地模糊比對，精確支援簡稱如「大般若經」、「地藏經」、「華嚴經」）
    const matchedFeatured = FEATURED_BOOKS.filter(
      book => 
        isFuzzyTitleMatch(book.title, trimmedQuery) || 
        book.workId.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
        book.creators.includes(trimmedQuery)
    ).map(b => ({ ...b, isBackupSource: false }));

    try {
      const queriesToSearch = new Set<string>([trimmedQuery]);

      // 雙向詞幹自動衍生 (Bidirectional Stemming):
      // 1. 若查詢以「經」結尾 (如 勝鬘經)，加入去尾字「勝鬘」
      if (trimmedQuery.endsWith('經') && trimmedQuery.length > 1) {
        queriesToSearch.add(trimmedQuery.slice(0, -1));
      }
      // 2. 若查詢不以「經」結尾 (如 勝鬘)，自動補「經」 (如 勝鬘經) 並行檢索
      else if (!trimmedQuery.endsWith('經') && trimmedQuery.length >= 2) {
        queriesToSearch.add(`${trimmedQuery}經`);
      }

      const promises: Array<{ key: string; promise: Promise<Response | null> }> = [];

      for (const q of queriesToSearch) {
        const titleUrl = getApiUrl(`/stable/search/title?q=${encodeURIComponent(q)}`);
        const directTitleUrl = `https://cbdata.dila.edu.tw/stable/search/title?q=${encodeURIComponent(q)}`;

        // 優先嘗試本地代理路由，失敗或逾時則自動降級直連 CBETA 官方伺服器 (6.5秒超時保護)
        const fetchTitle = async () => {
          let res = await fetchWithTimeout(titleUrl, { headers: { 'Accept': 'application/json' } }, 6500);
          if (!res) {
            res = await fetchWithTimeout(directTitleUrl, { headers: { 'Accept': 'application/json' } }, 6500);
          }
          return res;
        };

        promises.push({ key: `title_${q}`, promise: fetchTitle() });
      }

      const creatorUrl = getApiUrl(`/stable/works?creator=${encodeURIComponent(trimmedQuery)}`);
      const directCreatorUrl = `https://cbdata.dila.edu.tw/stable/works?creator=${encodeURIComponent(trimmedQuery)}`;
      const fetchCreator = async () => {
        let res = await fetchWithTimeout(creatorUrl, { headers: { 'Accept': 'application/json' } }, 6500);
        if (!res) {
          res = await fetchWithTimeout(directCreatorUrl, { headers: { 'Accept': 'application/json' } }, 6500);
        }
        return res;
      };
      promises.push({ key: 'creator', promise: fetchCreator() });

      // 💡 部類關鍵字自動對應與 API 查詢 (例如: 「般若」-> 查詢 /stable/works?category=般若部類)
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
          let res = await fetchWithTimeout(catUrl, { headers: { 'Accept': 'application/json' } }, 6500);
          if (!res) {
            res = await fetchWithTimeout(directCatUrl, { headers: { 'Accept': 'application/json' } }, 6500);
          }
          return res;
        };
        promises.push({ key: 'category', promise: fetchCat() });
      }

      // 如果查詢字串符合經典編號格式 (例如 T0220)，額外查詢 works?work=
      const isWorkId = /^[a-zA-Z]\d+/.test(trimmedQuery);
      if (isWorkId) {
        const workUrl = getApiUrl(`/stable/works?work=${trimmedQuery.toUpperCase()}`);
        const directWorkUrl = `https://cbdata.dila.edu.tw/stable/works?work=${trimmedQuery.toUpperCase()}`;
        const fetchWork = async () => {
          let res = await fetchWithTimeout(workUrl, { headers: { 'Accept': 'application/json' } }, 6500);
          if (!res) {
            res = await fetchWithTimeout(directWorkUrl, { headers: { 'Accept': 'application/json' } }, 6500);
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

      const apiResults: SearchResult[] = [];

      resultsList.forEach(item => {
        if (item.data && Array.isArray(item.data.results)) {
          item.data.results.forEach((r: any) => {
            apiResults.push({
              workId: r.work || r.file || r.work_info?.work || '',
              title: r.title || r.content || r.work_info?.title || '未命名經典',
              creators: r.creators || r.byline || r.work_info?.byline || 'CBETA 電子佛典',
              juansCount: r.juan || r.juans || r.work_info?.juans || 1,
              category: r.category || r.work_info?.category || (item.key === 'category' ? matchedCategoryName : '未分類')
            });
          });
        }
      });

      // 合併本地與線上結果（進行去重）
      const resultsMap = new Map<string, SearchResult>();
      matchedFeatured.forEach(b => resultsMap.set(b.workId, b));
      
      apiResults.forEach((b: SearchResult) => {
        if (b.workId) {
          const existing = resultsMap.get(b.workId);
          if (!existing || existing.title === '未命名經典') {
            resultsMap.set(b.workId, { ...b, isBackupSource: (activeMode as string) === 'backup' });
          }
        }
      });

      const finalResults = Array.from(resultsMap.values()).map(b => ({
        ...b,
        isBackupSource: (activeMode as string) === 'backup'
      }));
      if (finalResults.length > 0) {
        searchCacheMap.set(cacheKey, finalResults);
      }

      // 非阻塞背景補全：非同步在背景完善前 15 筆結果的精確總卷數與作譯者細節
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
                if (workInfo.creators) {
                  const dynasty = workInfo.time_dynasty ? `${workInfo.time_dynasty} ` : '';
                  const creatorName = workInfo.creators.replace(/\(.*\)/, '').trim();
                  res.creators = creatorName.startsWith(dynasty.trim()) ? creatorName : `${dynasty}${creatorName}`;
                } else if (workInfo.byline) {
                  res.creators = workInfo.byline;
                }
                if (workInfo.vol) {
                  res.vol = workInfo.vol;
                } else if (workInfo.file) {
                  const match = workInfo.file.match(/^([A-Z]\d+)/i);
                  if (match) res.vol = match[1].toUpperCase();
                }
                if (workInfo.cjk_chars != null && typeof workInfo.cjk_chars === 'number') {
                  res.cjkChars = workInfo.cjk_chars;
                }
              }
            }
          } catch {
            // 容錯跳過
          }
        })
      ).catch(() => {});

      return finalResults.length > 0 ? finalResults : matchedFeatured;
    } catch (error) {
      console.warn('IndexBuilder search online failed, fallback to local match:', error);
    }

    return matchedFeatured;
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
      creators: searchResult.creators,
      juansCount: searchResult.juansCount,
      packagedAt: new Date().toISOString(),
      version: BUILDER_VERSION
    };
  }
}
