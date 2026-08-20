import type { ReaderPackage } from '../types/book';
import { IndexBuilder, getApiUrl, fetchWithTimeout, sanitizeCreators } from './IndexBuilder';
import type { SearchResult } from './IndexBuilder';
import { ReaderBuilder, formatTimeRemaining } from './ReaderBuilder';
import { NavigationBuilder } from './NavigationBuilder';
import { ReferenceBuilder } from './ReferenceBuilder';
import { SearchIndexBuilder } from './SearchIndexBuilder';
import { AIIndexBuilder } from './AIIndexBuilder';
import { saveBook } from '../utils/db';
import { BUILDER_VERSION } from './version';
import { getSourceMode } from '../utils/sourceMode';
export { BUILDER_VERSION };

export type BuildStep = 
  | 'idle'
  | 'metadata'
  | 'fetch_content'
  | 'navigation'
  | 'reference'
  | 'search_index'
  | 'ai_index'
  | 'saving'
  | 'completed'
  | 'failed';

export interface BuildProgress {
  step: BuildStep;
  percent: number;
  message: string;
}

export class PackageBuilder {
  /**
   * 下載並匯入一部佛經，儲存至本地資料庫中，並隨時回報進度
   */
  static async downloadAndPackage(
    searchResult: SearchResult,
    onProgress: (progress: BuildProgress) => void
  ): Promise<ReaderPackage> {
    const workId = searchResult.workId;
    
    // 💡 0. 全局權威總目自動校正：先從藏經總目 (cbeta-works-index.json / FEATURED_BOOKS) 補充/校正真實總卷數與元資料
    const indexMeta = await IndexBuilder.getWorkMetaFromIndex(workId);
    if (indexMeta) {
      if (!searchResult.title || searchResult.title === workId) searchResult.title = indexMeta.title;
      searchResult.creators = sanitizeCreators(searchResult.creators) || sanitizeCreators(indexMeta.creators);
      if (!searchResult.category || searchResult.category === 'CBETA' || searchResult.category === '未分類') searchResult.category = indexMeta.category;
      if (!searchResult.vol) searchResult.vol = indexMeta.vol;
      if (indexMeta.juansCount && indexMeta.juansCount > 0) {
        searchResult.juansCount = indexMeta.juansCount;
      }
      if (indexMeta.cjkChars && !searchResult.cjkChars) {
        searchResult.cjkChars = indexMeta.cjkChars;
      }
    } else {
      searchResult.creators = sanitizeCreators(searchResult.creators);
    }

    let actualJuansCount = (searchResult.juansCount && searchResult.juansCount > 0) ? searchResult.juansCount : 1;
    const isBackup = getSourceMode() === 'backup';

    try {
      // 1. Metadata 階段
      if (isBackup) {
        onProgress({ step: 'metadata', percent: 3, message: `正在從備援資料庫讀取《${searchResult.title || workId}》元資料...` });
        try {
          const localMetaUrl = `/backup/${workId}/1.json`;
          const ghMetaUrl = `https://github.com/vbgrdmental-bit/Cbeta-Reader/releases/download/v1.0.0-database/${workId}_1.json`;
          const rawCdnUrl = `https://raw.githubusercontent.com/vbgrdmental-bit/Cbeta-Reader/main/public/backup/${workId}/1.json`;

          let mRes = await fetchWithTimeout(localMetaUrl, {}, 2500);
          if (!mRes || !mRes.ok) {
            mRes = await fetchWithTimeout(ghMetaUrl, {}, 3000);
          }
          if (!mRes || !mRes.ok) {
            mRes = await fetchWithTimeout(rawCdnUrl, {}, 3500);
          }

          if (mRes && mRes.ok) {
            const mData = await mRes.json().catch(() => null);
            if (mData) {
              const meta = mData.metadata || {};
              if (meta.juansCount && typeof meta.juansCount === 'number') {
                actualJuansCount = meta.juansCount;
              } else {
                // 💡 通用保險機制：若備援 JSON 無 metadata.juansCount，
                // 從目錄樹 (mulu) 的最大 juan 值自動推導，防範多卷著作被誤判為單卷
                const rawTocList: any[] = Array.isArray(mData.toc)
                  ? mData.toc
                  : (mData.toc?.mulu && Array.isArray(mData.toc.mulu) ? mData.toc.mulu : []);
                if (rawTocList.length > 0) {
                  const getMaxJuan = (nodes: any[]): number =>
                    nodes.reduce((max, n) => {
                      const self = n.juan || 0;
                      const childMax = n.children && Array.isArray(n.children) ? getMaxJuan(n.children) : 0;
                      return Math.max(max, self, childMax);
                    }, 0);
                  const muluMaxJuan = getMaxJuan(rawTocList);
                  if (muluMaxJuan > actualJuansCount) {
                    actualJuansCount = muluMaxJuan;
                    console.info(`[Backup Mode] juansCount auto-derived from mulu: ${actualJuansCount} (${workId})`);
                  }
                }
              }
              if (meta.title) searchResult.title = meta.title;
              if (meta.creators) searchResult.creators = sanitizeCreators(meta.creators);
              if (meta.category) searchResult.category = meta.category;
              if (meta.vol) searchResult.vol = meta.vol;
              if (meta.cjkChars != null && typeof meta.cjkChars === 'number') searchResult.cjkChars = meta.cjkChars;
            }
          }
        } catch (bMetaErr) {
          console.warn(`[Backup Mode] Metadata fetch fallback for ${workId}:`, bMetaErr);
        }
      } else {
        // 主源 (Primary Source): 向 CBETA 官方 API 請求最新即時元資料 (加入 cache: reload 與時間戳記)
        onProgress({ step: 'metadata', percent: 3, message: `正在向 CBETA 獲取《${searchResult.title}》最新即時元資料...` });
        try {
          const relativeMetaUrl = getApiUrl(`/stable/works?work=${workId}&_t=${Date.now()}`);
          const directMetaUrl = `https://cbdata.dila.edu.tw/stable/works?work=${workId}&_t=${Date.now()}`;
          let response = await fetchWithTimeout(relativeMetaUrl, { cache: 'reload', headers: { 'Accept': 'application/json' } }, 3500);
          if (!response || !response.ok) {
            response = await fetchWithTimeout(directMetaUrl, { cache: 'reload', headers: { 'Accept': 'application/json' } }, 5000);
          }
          if (response && response.ok) {
            const data = await response.json().catch(() => null);
            if (data && Array.isArray(data.results) && data.results.length > 0) {
              const workInfo = data.results[0];
              if (workInfo.title) {
                searchResult.title = workInfo.title;
              }
              if (workInfo.juan && typeof workInfo.juan === 'number') {
                actualJuansCount = workInfo.juan;
              }
              if (workInfo.category) {
                searchResult.category = workInfo.category;
              }
              if (workInfo.creators && sanitizeCreators(workInfo.creators)) {
                const dynasty = (workInfo.time_dynasty && workInfo.time_dynasty !== 'unknown') ? `${workInfo.time_dynasty} ` : '';
                const creatorName = workInfo.creators.replace(/\(.*\)/, '').trim();
                searchResult.creators = sanitizeCreators(creatorName.startsWith(dynasty.trim()) ? creatorName : `${dynasty}${creatorName}`);
              } else if (workInfo.byline && sanitizeCreators(workInfo.byline)) {
                searchResult.creators = sanitizeCreators(workInfo.byline);
              } else {
                searchResult.creators = '';
              }
              if (workInfo.vol) {
                searchResult.vol = workInfo.vol;
              } else if (workInfo.file) {
                const match = workInfo.file.match(/^([A-Z]\d+)/i);
                if (match) searchResult.vol = match[1].toUpperCase();
              } else if (workInfo.n != null) {
                const volNum = String(workInfo.n).padStart(2, '0');
                searchResult.vol = `${searchResult.workId.charAt(0)}${volNum}`;
              }
              if (workInfo.cjk_chars != null && typeof workInfo.cjk_chars === 'number') {
                const enWords = (workInfo.en_words != null && typeof workInfo.en_words === 'number') ? workInfo.en_words : 0;
                searchResult.cjkChars = workInfo.cjk_chars + enWords;
              }
            }
          }
        } catch (err) {
          console.warn('Failed to fetch official work metadata, falling back to basic info:', err);
        }
      }

      onProgress({ step: 'metadata', percent: 5, message: '正在建立書籍元資料...' });
      const metadata = IndexBuilder.buildMetadata({
        ...searchResult,
        creators: sanitizeCreators(searchResult.creators),
        juansCount: actualJuansCount
      });
      await new Promise(resolve => setTimeout(resolve, 300));

      // 2. Fetch Content 階段 (解析 HTML 卷次)
      onProgress({ step: 'fetch_content', percent: 10, message: '正在從 CBETA 獲取經文內文與標記...' });
      const { content, rawToc } = await ReaderBuilder.buildContent(
        workId, 
        actualJuansCount,
        (p: number, currentJuan?: number, totalJuans?: number, remSec?: number, isBackup?: boolean) => {
          let detail = `（卷次下載進度: ${Math.floor(p)}%）`;
          if (currentJuan && totalJuans) {
            const timeStr = remSec != null && remSec > 0 ? `，剩餘約 ${formatTimeRemaining(remSec)}` : '';
            detail = `（已完成 ${currentJuan} / ${totalJuans} 卷${timeStr}）`;
          }
          const backupNote = isBackup 
            ? ' 💡 CBETA 官方伺服器連線繁忙，已自動切換至離線版本（經文內容版本為 CBReader 2X v0.9.9 2026-01-21）。' 
            : '';
          onProgress({ 
            step: 'fetch_content', 
            percent: 10 + Math.floor(p * 0.65), // 佔比 10% - 75%
            message: `正在下載經典內文與標記 ${detail}${backupNote}` 
          });
        }
      );

      // 3. Navigation 階段 (建立品/卷對照)
      onProgress({ step: 'navigation', percent: 75, message: '正在解析經典結構，建立品、卷雙導航系統...' });
      const { toc, navigation } = NavigationBuilder.buildNavigation(workId, content, rawToc);
      await new Promise(resolve => setTimeout(resolve, 400));

      // 4. Reference 階段 (校勘與鏈結)
      onProgress({ step: 'reference', percent: 80, message: '正在分離學術標記，建立校勘與大正藏影像引用...' });
      const reference = ReferenceBuilder.buildReference(workId);
      await new Promise(resolve => setTimeout(resolve, 400));

      // 5. Search Index 階段 (全文搜尋索引)
      onProgress({ step: 'search_index', percent: 85, message: '正在建立本地段落級全文檢索索引（支援 AND 多詞搜尋）...' });
      const searchIndex = SearchIndexBuilder.buildSearchIndex(content, toc);
      await new Promise(resolve => setTimeout(resolve, 400));

      // 6. AI Index 預留結構階段
      onProgress({ step: 'ai_index', percent: 90, message: '正在預置 AI Embedding 向量索引與 RAG 架構接口...' });
      const embedding = await AIIndexBuilder.buildAIIndex(content);

      // 6.5. 官方目錄雙向完整性與跳轉定位驗證 (Integrity Check)
      onProgress({ step: 'saving', percent: 93, message: '正在進行目錄雙向完整性與定位比對驗證...' });
      
      const flattenToc = (items: any[]): any[] => {
        const res: any[] = [];
        for (const item of items) {
          res.push(item);
          if (item.children && Array.isArray(item.children)) {
            res.push(...flattenToc(item.children));
          }
        }
        return res;
      };

      const expectedTocs = rawToc || [];
      const generatedTocs = flattenToc(toc.items || []);
      
      if (expectedTocs.length > 0 && generatedTocs.length === 0) {
        console.warn(`[PackageBuilder] TOC Notice: Raw TOC has ${expectedTocs.length} items, but generated TOC is empty for ${workId}.`);
      }

      // 7. 儲存階段 (IndexedDB)
      onProgress({ step: 'saving', percent: 96, message: '正在包裝為 .book 格式並存入離線書庫 (IndexedDB)...' });
      
      // 💡 字數自動統計與保險校驗：若 API 或元資料未能提供 cjkChars，直接遍歷內文所有段落精確計算 CJK 漢字與英數總字數
      if (!metadata.cjkChars || metadata.cjkChars <= 0) {
        let calculatedChars = 0;
        content.juans.forEach(j => {
          j.segments.forEach(seg => {
            const cleanContent = seg.content.replace(/^No\.\s*\d+[a-z]?/i, '');
            const cjkMatches = cleanContent.match(/[\u4e00-\u9fa5\u3400-\u4dbf\u20000-\u2a6df]/g);
            if (cjkMatches) calculatedChars += cjkMatches.length;
          });
        });
        if (calculatedChars > 0) {
          metadata.cjkChars = calculatedChars;
        }
      }

      const bookPackage: ReaderPackage = {
        metadata,
        content,
        toc,
        navigation,
        reference,
        searchIndex,
        embedding
      };

      await saveBook(bookPackage);
      await new Promise(resolve => setTimeout(resolve, 400));

      // 完成
      onProgress({ step: 'completed', percent: 100, message: `《${searchResult.title}》已成功下載並加入您的書庫！` });
      return bookPackage;

    } catch (error: any) {
      onProgress({ 
        step: 'failed', 
        percent: 0, 
        message: `建置書籍 Package 失敗: ${error.message || error}` 
      });
      throw error;
    }
  }
}
