import type { ReaderPackage } from '../types/book';
import { IndexBuilder, getApiUrl } from './IndexBuilder';
import type { SearchResult } from './IndexBuilder';
import { ReaderBuilder } from './ReaderBuilder';
import { NavigationBuilder } from './NavigationBuilder';
import { ReferenceBuilder } from './ReferenceBuilder';
import { SearchIndexBuilder } from './SearchIndexBuilder';
import { AIIndexBuilder } from './AIIndexBuilder';
import { saveBook } from '../utils/db';

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
    let actualJuansCount = searchResult.juansCount;
    
    try {
      // 1. Metadata 階段
      onProgress({ step: 'metadata', percent: 2, message: '正在向 CBETA 獲取經典最新元資料...' });
      try {
        const metaUrl = getApiUrl(`/stable/works?work=${workId}`);
        const response = await fetch(metaUrl);
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.results) && data.results.length > 0) {
            const workInfo = data.results[0];
            if (workInfo.juan && typeof workInfo.juan === 'number') {
              actualJuansCount = workInfo.juan;
              console.log(`Successfully fetched true juansCount for ${workId}: ${actualJuansCount}`);
            }
          }
        }
      } catch (metaErr) {
        console.warn('Failed to fetch online metadata for juansCount, fallback to searchResult count:', metaErr);
      }

      onProgress({ step: 'metadata', percent: 5, message: '正在建立書籍元資料...' });
      const metadata = IndexBuilder.buildMetadata({
        ...searchResult,
        juansCount: actualJuansCount
      });
      await new Promise(resolve => setTimeout(resolve, 400));

      // 2. Fetch Content 階段 (解析 HTML 卷次)
      onProgress({ step: 'fetch_content', percent: 10, message: '正在從 CBETA 獲取經文內文與標記...' });
      const { content, rawToc } = await ReaderBuilder.buildContent(
        workId, 
        actualJuansCount,
        (p) => {
          onProgress({ 
            step: 'fetch_content', 
            percent: 10 + Math.floor(p * 0.6), // 佔比最大 10% - 70%
            message: `正在載入經文 HTML（卷次下載中: ${Math.floor(p)}%）...` 
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
