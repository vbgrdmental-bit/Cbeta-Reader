import type { BookContent, BookTOC, NavigationMap, TOCItem } from '../types/book';

export class NavigationBuilder {
  /**
   * 建立 Table of Contents (TOC) 與 雙向導航 Map
   */
  static buildNavigation(
    workId: string, 
    content: BookContent, 
    rawTocs: any[]
  ): { toc: BookTOC; navigation: NavigationMap } {
    const items: TOCItem[] = [];

    // 如果沒有提供原始 TOC 或者它是空的，我們根據經文內容做簡易的自動章節偵測
    if (!rawTocs || rawTocs.length === 0) {
      // 搜尋段落中帶有 "第" ... "品" 或 "卷" 等關鍵字的行作為目錄項目
      content.juans.forEach(juanData => {
        juanData.segments.forEach(seg => {
          // 例如 "第...品", "第一章", "自序", "偈頌" 等常見章節格式
          const match = seg.content.match(/^([^\s]{1,10}(品|章)第[一二三四五六七八九十百]+|[一二三四五六七八九十]+[、\s]+[^\s]{1,10}(品|章))/) || 
                        seg.content.match(/^第[一二三四五六七八九十]+(品|章)\s+([^\s]+)/) ||
                        seg.content.match(/^(自序|後序|偈頌|序言|導言)$/);
          
          if (match) {
            items.push({
              id: `${workId}_toc_${items.length}`,
              title: match[0].trim(),
              juan: juanData.juan,
              startSegmentId: seg.id
            });
            seg.tocId = `${workId}_toc_${items.length - 1}`;
          }
        });
      });
    } else {
      // 如果有 CBETA API 提供的高精細 TOC 結構
      rawTocs.forEach((mulu: any, index: number) => {
        // 從 raw mulu (品名、卷數) 映射成 TOCItem
        const title = mulu.title || `目錄 ${index + 1}`;
        const juan = mulu.juan || 1;
        
        // 尋找這一卷中第一個最接近此品名稱的段落作為起始段落
        const juanData = content.juans.find(j => j.juan === juan);
        let startSegmentId = mulu.startSegmentId || '';
        // 💡 優先方法 1：利用官方提供的 lb 行號進行高精確段落匹配
        if (!startSegmentId && mulu.lb && juanData) {
          const cleanMuluLb = mulu.lb.replace(/[^a-zA-Z0-9]/g, '');
          const segWithLb = juanData.segments.find(seg => {
            const cleanSegLb = seg.lb ? seg.lb.replace(/[^a-zA-Z0-9]/g, '') : '';
            return cleanSegLb.endsWith(cleanMuluLb) || cleanSegLb.includes(cleanMuluLb);
          });
          if (segWithLb) {
            startSegmentId = segWithLb.id;
          }
        }
        
        if (!startSegmentId && juanData && juanData.segments.length > 0) {
          const tocId = `${workId}_toc_${index}`;
          // 💡 備用方法 2：直接根據段落中已標記的 tocId 尋找起始段落
          const segWithTocId = juanData.segments.find(seg => seg.tocId === tocId);
          
          if (segWithTocId) {
            startSegmentId = segWithTocId.id;
          } else {
            // 匹配不到時，直接保持為空，不隨意填入其他文字，以維持嚴謹參考價值
            startSegmentId = '';
          }
        }

        const tocId = `${workId}_toc_${index}`;
        items.push({
          id: tocId,
          title,
          juan,
          startSegmentId
        });

        // 回標段落的 tocId
        if (juanData) {
          let currentTocId = tocId;
          juanData.segments.forEach(seg => {
            if (seg.id === startSegmentId) {
              seg.tocId = currentTocId;
            }
          });
        }
      });
    }

    // 補齊 TextSegment 中的 tocId (往下擴散直到下一個 tocId 出現)
    content.juans.forEach(juanData => {
      let activeTocId = '';
      
      // 先找出這卷中第一個被分配到的 tocId 作為預設
      const firstToc = items.find(item => item.juan === juanData.juan);
      if (firstToc) {
        activeTocId = firstToc.id;
      }

      juanData.segments.forEach(seg => {
        if (seg.tocId) {
          activeTocId = seg.tocId;
        } else if (activeTocId) {
          seg.tocId = activeTocId;
        }
      });
    });

    // 建立雙向對照 NavigationMap
    const juanToTocs: { [juan: number]: string[] } = {};
    const tocToJuan: { [tocId: string]: number } = {};

    items.forEach(item => {
      if (!juanToTocs[item.juan]) {
        juanToTocs[item.juan] = [];
      }
      juanToTocs[item.juan].push(item.id);
      tocToJuan[item.id] = item.juan;
    });

    return {
      toc: {
        workId,
        items
      },
      navigation: {
        juanToTocs,
        tocToJuan
      }
    };
  }
}
