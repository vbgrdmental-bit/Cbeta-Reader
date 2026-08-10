import type { ReaderPackage } from '../types/book';
import { IndexBuilder, getApiUrl, fetchWithTimeout } from './IndexBuilder';
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
    let actualJuansCount = (searchResult.juansCount && searchResult.juansCount > 0) ? searchResult.juansCount : 1;
    const isBackup = getSourceMode() === 'backup';
    
    try {
      // 1. Metadata 階段
      if (isBackup) {
        onProgress({ step: 'metadata', percent: 3, message: `正在從備援資料庫讀取《${searchResult.title}》元資料...` });
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
              }
              if (meta.creators) searchResult.creators = meta.creators;
              if (meta.category) searchResult.category = meta.category;
              if (meta.vol) searchResult.vol = meta.vol;
              if (meta.cjkChars != null && typeof meta.cjkChars === 'number') searchResult.cjkChars = meta.cjkChars;
            }
          }
        } catch (bMetaErr) {
          console.warn(`[Backup Mode] Metadata fetch fallback for ${workId}:`, bMetaErr);
        }
      } else {
        // 主源 (Primary Source): 向 CBETA 官方 API 請求 (加入 3.5 秒超時保護，防範 CBETA API 伺服器掛起)
        onProgress({ step: 'metadata', percent: 3, message: `正在向 CBETA 獲取《${searchResult.title}》最新元資料...` });
        try {
          const relativeMetaUrl = getApiUrl(`/stable/works?work=${workId}`);
          const directMetaUrl = `https://cbdata.dila.edu.tw/stable/works?work=${workId}`;
          let response = await fetchWithTimeout(relativeMetaUrl, { headers: { 'Accept': 'application/json' } }, 3500);
          if (!response || !response.ok) {
            response = await fetchWithTimeout(directMetaUrl, { headers: { 'Accept': 'application/json' } }, 5000);
          }
          if (response && response.ok) {
            const data = await response.json().catch(() => null);
            if (data && Array.isArray(data.results) && data.results.length > 0) {
              const workInfo = data.results[0];
              if (workInfo.juan && typeof workInfo.juan === 'number') {
                actualJuansCount = workInfo.juan;
              }
              if (workInfo.category) {
                searchResult.category = workInfo.category;
              }
              if (workInfo.creators) {
                const dynasty = workInfo.time_dynasty ? `${workInfo.time_dynasty} ` : '';
                const creatorName = workInfo.creators.replace(/\(.*\)/, '').trim();
                searchResult.creators = creatorName.startsWith(dynasty.trim()) ? creatorName : `${dynasty}${creatorName}`;
              } else if (workInfo.byline) {
                searchResult.creators = workInfo.byline;
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
            }
          }
        } catch (err) {
          console.warn('Failed to fetch official work metadata, falling back to basic info:', err);
        }
      }

      onProgress({ step: 'metadata', percent: 5, message: '正在建立書籍元資料...' });
      const metadata = IndexBuilder.buildMetadata({
        ...searchResult,
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

      // 6.5. 官方目錄雙向完整性與跳轉定位嚴謹比對驗證 (Assertion Integrity Check)
      onProgress({ step: 'saving', percent: 93, message: '正在與 CBETA 官方原始目錄進行雙向完整性與定位比對驗證...' });
      
      const expectedTocs = rawToc || [];
      const generatedTocs = toc.items || [];
      
      // 驗證 1：品目數量是否相符
      if (expectedTocs.length !== generatedTocs.length) {
        throw new Error(`目錄完整性驗證失敗：官方原始目錄有 ${expectedTocs.length} 項，但產生的導航目錄有 ${generatedTocs.length} 項，品目數量不相符！`);
      }
      
      // 驗證 2：品名與卷次是否一致，且起點段落定位是否成功
      for (let i = 0; i < expectedTocs.length; i++) {
        const exp = expectedTocs[i];
        const gen = generatedTocs[i];
        
        // 整理標題文字後比對（去除所有空白與標點干擾）
        const expTitle = exp.title.replace(/[\s\u3000]/g, '');
        const genTitle = gen.title.replace(/[\s\u3000]/g, '');
        
        if (expTitle !== genTitle && !genTitle.includes(expTitle) && !expTitle.includes(genTitle)) {
          throw new Error(`目錄完整性驗證失敗：第 ${i + 1} 項品名不匹配！期望: "${exp.title}"，實際生成: "${gen.title}"`);
        }
        
        // 驗證 3：定位起點段落
        // 如果該品目在 CBETA 原始行號 (lb) 存在，但我們最終生成的 startSegmentId 卻是空字串，且正文中有對應的行號
        // 這說明高精度匹配出錯，需予以報錯阻斷。
        if (exp.lb && !gen.startSegmentId) {
          const cleanLb = exp.lb.replace(/[^a-zA-Z0-9]/g, '');
          let lbExistsInBody = false;
          for (const juanData of content.juans) {
            const found = juanData.segments.some(seg => {
              const cleanSegLb = seg.lb ? seg.lb.replace(/[^a-zA-Z0-9]/g, '') : '';
              return cleanSegLb.endsWith(cleanLb) || cleanSegLb.includes(cleanLb);
            });
            if (found) {
              lbExistsInBody = true;
              break;
            }
          }
          if (lbExistsInBody) {
            throw new Error(`目錄定位驗證失敗：品目 "${exp.title}" (行號: ${exp.lb}) 在正文中存在，但導航起點定位失敗 (未綁定段落)！`);
          }
        }
      }

      // 7. 儲存階段 (IndexedDB)
      onProgress({ step: 'saving', percent: 96, message: '正在包裝為 .book 格式並存入離線書庫 (IndexedDB)...' });
      
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
