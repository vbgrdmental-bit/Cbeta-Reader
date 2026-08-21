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
    const usedSegmentIds = new Set<string>();

    // 遞迴映射 mulu 節點成帶有 children 的 TOCItem 樹
    const processMuluNode = (mulu: any): TOCItem => {
      const index = idCounter++;
      const tocId = `${workId}_toc_${index}`;
      const title = mulu.title || `目錄 ${index + 1}`;
      let targetJuan = mulu.juan || 1;

      let juanData = content.juans.find(j => j.juan === targetJuan);
      let startSegmentId = mulu.startSegmentId || '';

      const cleanTitle = title.replace(/[\s\u3000]/g, '');
      const strippedTitle = cleanTitle.replace(/^[一二三四五六七八九十百千萬0-9１２３４５６７８９０上下中第]+[、.．\s\u3000]*/, '');

      // 0. 優先使用 HTML 解析階段所紀錄的精確 seg.muluTitles 文字順序比對 (順序排重防誤判)
      if (!startSegmentId && juanData) {
        const segWithMuluTitle = juanData.segments.find(seg => {
          if (!seg.muluTitles || seg.muluTitles.length === 0) return false;
          if (usedSegmentIds.has(seg.id)) return false;
          return seg.muluTitles.some(t => {
            const cleanT = t.replace(/[\s\u3000]/g, '');
            const strippedT = cleanT.replace(/^[一二三四五六七八九十百千萬0-9１２３４５６７８九０上下中第]+[、.．\s\u3000]*/, '');
            return cleanT === cleanTitle || (strippedTitle && strippedT === strippedTitle);
          });
        });
        if (segWithMuluTitle) {
          startSegmentId = segWithMuluTitle.id;
          usedSegmentIds.add(segWithMuluTitle.id);
        }
      }

      // 1. 高精確度標題全文字比對：優先在目標卷中搜尋文字完全吻合的章節標題段落 (如「忉利天宮神通品第一」、「觀眾生業緣品第三」)
      if (!startSegmentId && juanData) {
        const exactSeg = juanData.segments.find(seg => {
          if (usedSegmentIds.has(seg.id)) return false;
          const cleanSeg = seg.content.replace(/[\s\u3000]/g, '');
          return cleanSeg === cleanTitle || (strippedTitle.length >= 3 && cleanSeg === strippedTitle);
        });
        if (exactSeg) {
          startSegmentId = exactSeg.id;
          usedSegmentIds.add(exactSeg.id);
        }
      }

      // 2. Near-lb 範圍搜尋：若帶有 mulu.lb，找到該 lb 所在位置並向下探測 0..15 個段落，搜尋真實章節標題段
      if (!startSegmentId && mulu.lb && juanData) {
        const cleanMuluLb = mulu.lb.replace(/[^a-zA-Z0-9]/g, '');
        const lbIdx = juanData.segments.findIndex(seg => {
          const cleanSegLb = seg.lb ? seg.lb.replace(/[^a-zA-Z0-9]/g, '') : '';
          return cleanSegLb === cleanMuluLb || cleanSegLb.endsWith(cleanMuluLb) || cleanMuluLb.endsWith(cleanSegLb);
        });

        if (lbIdx !== -1) {
          // 向下探測 15 個段落尋找匹配標題的段落
          for (let offset = 0; offset <= 15 && lbIdx + offset < juanData.segments.length; offset++) {
            const seg = juanData.segments[lbIdx + offset];
            if (usedSegmentIds.has(seg.id)) continue;
            const cleanSeg = seg.content.replace(/[\s\u3000]/g, '');
            if (
              cleanSeg === cleanTitle || 
              (cleanTitle.length >= 3 && (cleanSeg.startsWith(cleanTitle) || cleanSeg.includes(cleanTitle))) ||
              (strippedTitle.length >= 3 && (cleanSeg.startsWith(strippedTitle) || cleanSeg.includes(strippedTitle)))
            ) {
              startSegmentId = seg.id;
              usedSegmentIds.add(seg.id);
              break;
            }
          }

          // 若下游未探測到獨立標題段，退回使用 lb 所在段落
          if (!startSegmentId) {
            const segAtLb = juanData.segments[lbIdx];
            if (!usedSegmentIds.has(segAtLb.id)) {
              startSegmentId = segAtLb.id;
              usedSegmentIds.add(segAtLb.id);
            } else {
              startSegmentId = segAtLb.id;
            }
          }
        }
      }

      // 3. 跨所有卷全局比對 lb 與標題
      if (!startSegmentId && mulu.lb) {
        const cleanMuluLb = mulu.lb.replace(/[^a-zA-Z0-9]/g, '');
        for (const jData of content.juans) {
          const lbIdx = jData.segments.findIndex(seg => {
            const cleanSegLb = seg.lb ? seg.lb.replace(/[^a-zA-Z0-9]/g, '') : '';
            return cleanSegLb === cleanMuluLb || cleanSegLb.endsWith(cleanMuluLb) || cleanMuluLb.endsWith(cleanSegLb);
          });
          if (lbIdx !== -1) {
            for (let offset = 0; offset <= 15 && lbIdx + offset < jData.segments.length; offset++) {
              const seg = jData.segments[lbIdx + offset];
              if (usedSegmentIds.has(seg.id)) continue;
              const cleanSeg = seg.content.replace(/[\s\u3000]/g, '');
              if (
                cleanSeg === cleanTitle || 
                (cleanTitle.length >= 3 && (cleanSeg.startsWith(cleanTitle) || cleanSeg.includes(cleanTitle))) ||
                (strippedTitle.length >= 3 && (cleanSeg.startsWith(strippedTitle) || cleanSeg.includes(strippedTitle)))
              ) {
                startSegmentId = seg.id;
                targetJuan = jData.juan;
                juanData = jData;
                usedSegmentIds.add(seg.id);
                break;
              }
            }
            if (!startSegmentId) {
              const segAtLb = jData.segments[lbIdx];
              startSegmentId = segAtLb.id;
              targetJuan = jData.juan;
              juanData = jData;
              usedSegmentIds.add(segAtLb.id);
            }
            break;
          }
        }
      }

      // 4. 前綴與包含比對 (Prefix / Includes fallback)
      if (!startSegmentId && juanData) {
        const prefixSeg = juanData.segments.find(seg => {
          if (usedSegmentIds.has(seg.id)) return false;
          const cleanSeg = seg.content.replace(/[\s\u3000]/g, '');
          return (
            (cleanTitle.length >= 3 && (cleanSeg.startsWith(cleanTitle) || cleanSeg.includes(cleanTitle))) ||
            (strippedTitle.length >= 3 && (cleanSeg.startsWith(strippedTitle) || cleanSeg.includes(strippedTitle)))
          );
        });
        if (prefixSeg) {
          startSegmentId = prefixSeg.id;
          usedSegmentIds.add(prefixSeg.id);
        }
      }

      // 5. 嘗試在目標卷中搜尋已標記此 tocId 的段落
      if (!startSegmentId && juanData && juanData.segments.length > 0) {
        const segWithTocId = juanData.segments.find(seg => seg.tocId === tocId);
        if (segWithTocId) {
          startSegmentId = segWithTocId.id;
        }
      }

      // 6. 極致保險：若仍未找到，預設綁定該卷第一個段落，防止出現不可點擊的空項目
      if (!startSegmentId) {
        const validJuanData = juanData || content.juans.find(j => j.juan === targetJuan) || content.juans[0];
        if (validJuanData && validJuanData.segments.length > 0) {
          startSegmentId = validJuanData.segments[0].id;
          targetJuan = validJuanData.juan;
          juanData = validJuanData;
        }
      }

      const item: TOCItem = {
        id: tocId,
        title,
        juan: targetJuan,
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
