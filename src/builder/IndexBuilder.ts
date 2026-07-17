import type { BookMetadata } from '../types/book';

// 輔助函數：處理開發環境與生產環境的 API 請求路由，繞過 CORS 限制
export const getApiUrl = (path: string): string => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173')) {
    return `/api-cbeta${path}`;
  }
  return `https://cbdata.dila.edu.tw${path}`;
};

export interface SearchResult {
  workId: string;
  title: string;
  creators: string;
  juansCount: number;
  category: string;
  vol?: string; // 冊別 e.g. T09
}

// 內建的重點經典靜態資訊，作為預設或 Fallback
export const FEATURED_BOOKS: SearchResult[] = [
  {
    workId: 'T0235',
    title: '金剛般若波羅蜜經',
    creators: '姚秦 鳩摩羅什譯',
    juansCount: 1,
    category: '般若部類'
  },
  {
    workId: 'T0412',
    title: '地藏菩薩本願經',
    creators: '唐 實叉難陀譯',
    juansCount: 3,
    category: '大集部類'
  },
  {
    workId: 'T0262',
    title: '妙法蓮華經',
    creators: '姚秦 鳩摩羅什譯',
    juansCount: 7,
    category: '法華部類'
  },
  {
    workId: 'Y0040',
    title: '成佛之道（增注本）',
    creators: '釋印順著',
    juansCount: 1,
    category: '新編部類'
  }
];

export class IndexBuilder {
  /**
   * 搜尋經典名稱
   */
  static async searchTitle(query: string): Promise<SearchResult[]> {
    if (!query || query.trim() === '') {
      return FEATURED_BOOKS;
    }

    const trimmedQuery = query.trim();

    // 優先匹配內建經典（本地匹配）
    const matchedFeatured = FEATURED_BOOKS.filter(
      book => 
        book.title.includes(trimmedQuery) || 
        book.workId.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
        book.creators.includes(trimmedQuery)
    );

    try {
      // 同時向經名/編號 API（search/title）與譯作者 API（works?creator=）發出高並行請求
      const titleUrl = getApiUrl(`/stable/search/title?q=${encodeURIComponent(trimmedQuery)}`);
      const creatorUrl = getApiUrl(`/stable/works?creator=${encodeURIComponent(trimmedQuery)}`);
      
      const [titleRes, creatorRes] = await Promise.all([
        fetch(titleUrl, { headers: { 'Accept': 'application/json' } })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        fetch(creatorUrl, { headers: { 'Accept': 'application/json' } })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      ]);

      const apiResults: SearchResult[] = [];

      // 1. 解析以經名/經號為主的 API 結果
      if (titleRes && Array.isArray(titleRes.results)) {
        titleRes.results.forEach((item: any) => {
          apiResults.push({
            workId: item.work || item.work_info?.work || '',
            title: item.content || item.title || item.work_info?.title || '未命名經典',
            creators: item.byline || item.work_info?.byline || '未知譯者',
            juansCount: item.juans || item.work_info?.juans || 1,
            category: item.category || item.work_info?.category || '未分類'
          });
        });
      }

      // 2. 解析以譯作者為主的 API 結果
      if (creatorRes && Array.isArray(creatorRes.results)) {
        creatorRes.results.forEach((item: any) => {
          apiResults.push({
            workId: item.work || item.file || '',
            title: item.title || '未命名經典',
            creators: item.byline || item.creators || '未知譯者',
            juansCount: item.juan || 1,
            category: item.category || '未分類'
          });
        });
      }

      // 3. 背景並行獲取前 15 筆結果的精確總卷數與分類資訊（防範 title API 遺失 juan 總數）
      await Promise.all(
        apiResults.slice(0, 15).map(async (res) => {
          try {
            const metaUrl = getApiUrl(`/stable/works?work=${res.workId}`);
            const response = await fetch(metaUrl);
            if (response.ok) {
              const data = await response.json();
              if (data && Array.isArray(data.results) && data.results.length > 0) {
                const workInfo = data.results[0];
                if (workInfo.juan && typeof workInfo.juan === 'number') {
                  res.juansCount = workInfo.juan;
                }
                if (workInfo.category) {
                  res.category = workInfo.category;
                }
                if (workInfo.byline) {
                  res.creators = workInfo.byline;
                }
                // 冊別：CBETA works API 的 n 欄位為冊號數字，組合如 T09
                if (workInfo.n != null) {
                  const volNum = String(workInfo.n).padStart(2, '0');
                  res.vol = `${res.workId.charAt(0)}${volNum}`;
                }
              }
            }
          } catch {
            // 容錯跳過
          }
        })
      );

      // 合併本地與線上結果（進行去重，並優先保留具體經典名稱）
      const resultsMap = new Map<string, SearchResult>();
      matchedFeatured.forEach(b => resultsMap.set(b.workId, b));
      
      apiResults.forEach((b: SearchResult) => {
        if (b.workId) {
          const existing = resultsMap.get(b.workId);
          if (!existing || existing.title === '未命名經典') {
            resultsMap.set(b.workId, b);
          }
        }
      });

      return Array.from(resultsMap.values());
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
      category: searchResult.category,
      creators: searchResult.creators,
      juansCount: searchResult.juansCount,
      packagedAt: new Date().toISOString(),
      version: '1.0'
    };
  }
}
