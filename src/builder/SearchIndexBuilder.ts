import type { BookContent, BookSearchIndex, BookTOC, SearchIndexItem } from '../types/book';

export class SearchIndexBuilder {
  /**
   * 建立本經典的段落級全文檢索索引
   */
  static buildSearchIndex(content: BookContent, toc: BookTOC): BookSearchIndex {
    const items: SearchIndexItem[] = [];

    content.juans.forEach(juanData => {
      juanData.segments.forEach(seg => {
        // 找到此段落對應的 TOC 品名
        const tocItem = toc.items.find(t => t.id === seg.tocId);
        const tocTitle = tocItem ? tocItem.title : `第 ${juanData.juan} 卷`;

        items.push({
          segmentId: seg.id,
          juan: juanData.juan,
          tocTitle,
          content: seg.content // 用於本地極速檢索的乾淨純文字
        });
      });
    });

    return {
      workId: content.workId,
      items
    };
  }

  /**
   * 執行本地多關鍵字 AND 搜尋
   * @param index 搜尋索引
   * @param query 用戶輸入關鍵字，多個關鍵字以空格分隔
   * @returns 搜尋結果清單
   */
  static search(index: BookSearchIndex, query: string): Array<SearchIndexItem & { highlightRanges: Array<{start: number, end: number}> }> {
    if (!query || query.trim() === '') return [];

    // 以空格分割多個關鍵字，並過濾掉空字串
    const keywords = query.split(/\s+/).filter(kw => kw.trim().length > 0);
    if (keywords.length === 0) return [];

    const results: Array<SearchIndexItem & { highlightRanges: Array<{start: number, end: number}> }> = [];

    index.items.forEach(item => {
      const text = item.content;
      
      // AND 邏輯：所有關鍵字都必須包含在內容中
      const isMatch = keywords.every(kw => text.includes(kw));

      if (isMatch) {
        // 計算每個關鍵字在文字中的位置以利前端進行高亮
        const highlightRanges: Array<{start: number, end: number}> = [];
        
        keywords.forEach(kw => {
          let pos = text.indexOf(kw);
          while (pos !== -1) {
            highlightRanges.push({
              start: pos,
              end: pos + kw.length
            });
            pos = text.indexOf(kw, pos + 1);
          }
        });

        // 合併重疊的高亮區間以利正確渲染
        highlightRanges.sort((a, b) => a.start - b.start);
        const mergedRanges: Array<{start: number, end: number}> = [];
        
        if (highlightRanges.length > 0) {
          let currentRange = highlightRanges[0];
          for (let i = 1; i < highlightRanges.length; i++) {
            const nextRange = highlightRanges[i];
            if (nextRange.start <= currentRange.end) {
              // 有重疊，合併
              currentRange.end = Math.max(currentRange.end, nextRange.end);
            } else {
              mergedRanges.push(currentRange);
              currentRange = nextRange;
            }
          }
          mergedRanges.push(currentRange);
        }

        results.push({
          ...item,
          highlightRanges: mergedRanges
        });
      }
    });

    return results;
  }
}
