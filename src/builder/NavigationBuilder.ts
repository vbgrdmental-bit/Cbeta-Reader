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
    const treeItems: TOCItem[] = [];
    const allFlatItems: TOCItem[] = [];
    let idCounter = 0;

    // 遞迴映射 mulu 節點成帶有 children 的 TOCItem 樹
    const processMuluNode = (mulu: any): TOCItem => {
      const index = idCounter++;
      const tocId = `${workId}_toc_${index}`;
      const title = mulu.title || `目錄 ${index + 1}`;
      const juan = mulu.juan || 1;

      const juanData = content.juans.find(j => j.juan === juan);
      let startSegmentId = mulu.startSegmentId || '';

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
        const segWithTocId = juanData.segments.find(seg => seg.tocId === tocId);
        if (segWithTocId) {
          startSegmentId = segWithTocId.id;
        }
      }

      const item: TOCItem = {
        id: tocId,
        title,
        juan,
        startSegmentId
      };

      allFlatItems.push(item);

      // 回標段落的 tocId
      if (juanData && startSegmentId) {
        const seg = juanData.segments.find(s => s.id === startSegmentId);
        if (seg && !seg.tocId) {
          seg.tocId = tocId;
        }
      }

      if (mulu.children && Array.isArray(mulu.children) && mulu.children.length > 0) {
        item.children = mulu.children.map((child: any) => processMuluNode(child));
      }

      return item;
    };

    if (!rawTocs || rawTocs.length === 0) {
      content.juans.forEach(juanData => {
        juanData.segments.forEach(seg => {
          const match = seg.content.match(/^([^\s]{1,10}(品|章)第[一二三四五六七八九十百]+|[一二三四五六七八九十]+[、\s]+[^\s]{1,10}(品|章))/) || 
                        seg.content.match(/^第[一二三四五六七八九十]+(品|章)\s+([^\s]+)/) ||
                        seg.content.match(/^(自序|後序|偈頌|序言|導言)$/);
          
          if (match) {
            const index = idCounter++;
            const tocId = `${workId}_toc_${index}`;
            const item: TOCItem = {
              id: tocId,
              title: match[0].trim(),
              juan: juanData.juan,
              startSegmentId: seg.id
            };
            allFlatItems.push(item);
            treeItems.push(item);
            seg.tocId = tocId;
          }
        });
      });
    } else {
      rawTocs.forEach((muluNode: any) => {
        treeItems.push(processMuluNode(muluNode));
      });
    }

    // 補齊 TextSegment 中的 tocId (往下擴散直到下一個 tocId 出現)
    content.juans.forEach(juanData => {
      let activeTocId = '';
      
      const firstToc = allFlatItems.find(item => item.juan === juanData.juan);
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

    allFlatItems.forEach(item => {
      if (!juanToTocs[item.juan]) {
        juanToTocs[item.juan] = [];
      }
      juanToTocs[item.juan].push(item.id);
      tocToJuan[item.id] = item.juan;
    });

    return {
      toc: {
        workId,
        items: treeItems
      },
      navigation: {
        juanToTocs,
        tocToJuan
      }
    };
  }
}
