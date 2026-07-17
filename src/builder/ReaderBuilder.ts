import type { BookContent, JuanData, TextSegment } from '../types/book';
import { getApiUrl } from './IndexBuilder';

export class ReaderBuilder {
  /**
   * 抓取並解析特定經典的所有卷
   * @param workId 經典ID (例如 T0412)
   * @param juansCount 總卷數
   * @param onProgress 進度回報 callback (0 到 100)
   */
  static async buildContent(
    workId: string, 
    juansCount: number,
    onProgress?: (progress: number) => void
  ): Promise<{ content: BookContent; rawToc: any[] }> {
    
    const juans: JuanData[] = [];
    let allRawTocs: any[] = [];

    try {
      // 優先從線上 API 獲取全文
      for (let j = 1; j <= juansCount; j++) {
        if (onProgress) {
          onProgress(Math.floor(((j - 1) / juansCount) * 90));
        }

        const url = getApiUrl(`/stable/juans?work=${workId}&juan=${j}&work_info=1&toc=1`);
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch juan ${j}`);
        }

        const data = await response.json();
        
        // 💡 官方 API 級別的高精細 TOC 提取 (遞迴扁平化與自適應去重)
        if (data && data.toc && Array.isArray(data.toc.mulu) && data.toc.mulu.length > 0 && allRawTocs.length === 0) {
          const flattenMulus = (muluList: any[], parentTitle = '', depth = 0): any[] => {
            const result: any[] = [];
            for (const m of muluList) {
              const currentTitle = parentTitle ? `${parentTitle}-${m.title}` : m.title;
              
              // 判定是否為虛擬資料夾 (如 "附文")
              const isFolder = m.isFolder || m.type === '附文' || m.title === '附文';
              const hasChildren = m.children && Array.isArray(m.children) && m.children.length > 0;
              
              if (isFolder && hasChildren) {
                // 資料夾本身點點無效，將其名稱作為 prefix 與子項目以 "-" 連接，且自己不單獨推入
                result.push(...flattenMulus(m.children, m.title, depth + 1));
              } else {
                result.push({
                  title: currentTitle || '',
                  juan: m.juan || 1,
                  lb: m.lb || '',
                  depth
                });
                if (hasChildren) {
                  result.push(...flattenMulus(m.children, '', depth + 1));
                }
              }
            }
            return result;
          };
          
          const flatList = flattenMulus(data.toc.mulu);
          // 找出所有最外層 (depth === 0) 的標題集
          const outerTitles = new Set(flatList.filter(item => item.depth === 0).map(item => item.title));
          
          // 過濾重複：只有當子項 (depth > 0) 的標題不在外層中重複時，才予以保留
          allRawTocs = flatList.filter(item => {
            if (item.depth > 0 && outerTitles.has(item.title)) {
              return false; // 重複了，過濾掉這個多餘的子章節
            }
            return true;
          }).map(item => ({
            title: item.title,
            juan: item.juan,
            lb: item.lb
          }));
          
          console.log(`[ReaderBuilder] Successfully extracted ${allRawTocs.length} TOC items (with folder merging & deduplication) for ${workId}`);
        }
        
        if (data && Array.isArray(data.results) && data.results.length > 0) {
          const rawResult = data.results[0];
          // CBETA API results[0] 在真實環境下直接就是 HTML 字串
          const html = typeof rawResult === 'string' ? rawResult : (rawResult.html || '');
          
          // 解析 HTML 段落。如果已經有官方高精度 TOC，就不必在 parseHtml 裡收集
          const segments = this.parseHtmlToSegments(
            html, 
            workId, 
            j, 
            allRawTocs.length > 0 ? undefined : allRawTocs
          );
          juans.push({
            juan: j,
            segments
          });
        } else {
          throw new Error(`Empty results from API for juan ${j}`);
        }
      }

      if (onProgress) {
        onProgress(100);
      }

      return {
        content: {
          workId,
          juans
        },
        rawToc: allRawTocs
      };

    } catch (onlineError) {
      console.warn(`Online fetch failed for ${workId}, trying fallback:`, onlineError);
      
      // Fallback: 如果是地藏經或法華經，載入預設的 Mock 檔案
      if (workId === 'T0412' || workId === 'T0262') {
        try {
          console.log(`Loading fallback local package for ${workId}...`);
          const response = await fetch(`/mock/${workId}.json`);
          if (response.ok) {
            const preBuilt = await response.json();
            if (onProgress) {
              onProgress(100);
            }
            return {
              content: preBuilt.content,
              rawToc: preBuilt.rawToc || []
            };
          }
        } catch (fallbackError) {
          console.error(`Local fallback also failed for ${workId}:`, fallbackError);
        }
      }

      // 如果不是預設經書，或者 Mock 載入也失敗，則產生模擬的 Fallback 資料以防止程式崩潰
      const fallbackJuans: JuanData[] = [];
      for (let j = 1; j <= juansCount; j++) {
        fallbackJuans.push({
          juan: j,
          segments: this.generateFallbackSegments(workId, j)
        });
      }

      if (onProgress) {
        onProgress(100);
      }

      return {
        content: {
          workId,
          juans: fallbackJuans
        },
        rawToc: []
      };
    }
  }

  /**
   * 使用瀏覽器 DOMParser 解析 CBETA HTML 經文，分離成 Canonical 與 Reader Model
   * 並在遍歷過程中線性捕獲行號 (lb) 與 目錄品名 (mulu)，建立高精度的 TOC 映射。
   */
  private static parseHtmlToSegments(
    html: string, 
    workId: string, 
    juan: number,
    allRawTocs?: any[]
  ): TextSegment[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 解析校勘註腳 (擴展以匹配 CBETA 中的 class='footnote' 與 id='cb_note_x')
    const noteMap = new Map<string, string>();
    const noteElements = doc.querySelectorAll('.note-text, .footnote, [id^="note"], [id^="cb_note"]');
    noteElements.forEach(el => {
      const id = el.id || '';
      if (id) {
        noteMap.set(id, el.textContent?.trim() || '');
      }
    });

    const hasParagraphAncestor = (element: HTMLElement): boolean => {
      let parent = element.parentElement;
      while (parent) {
        const pTagName = parent.tagName.toUpperCase();
        if (
          pTagName === 'P' || 
          parent.classList.contains('p') || 
          parent.classList.contains('head') || 
          parent.classList.contains('lg') || 
          pTagName === 'L' ||
          parent.classList.contains('l')
        ) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    const segments: TextSegment[] = [];
    let segmentIndex = 0;

    // 線性掃描狀態
    let activeLb = `${workId}_${juan.toString().padStart(2, '0')}_p000a01`;
    const unlinkedTocs: Array<{ title: string; juan: number; startSegmentId: string }> = [];

    // 線性遍歷所有 DOM 元素，保證深度優先的文檔順序 (Document Order)
    const iterator = doc.createNodeIterator(
      doc.body || doc.documentElement,
      NodeFilter.SHOW_ELEMENT
    );

    let currentNode = iterator.nextNode();
    while (currentNode) {
      const el = currentNode as HTMLElement;
      const tagName = el.tagName.toUpperCase();

      // 1. 遇到行頭標籤，更新當前最鄰近的行號
      if (tagName === 'SPAN' && (el.classList.contains('lb') || el.id.includes('p') || el.id.includes('lb'))) {
        activeLb = el.id || el.getAttribute('data-lb') || activeLb;
      }

      // 2. 遇到目錄品名標籤 (相容自訂 <mulu> 標籤或 class="mulu" 的 HTML 元素)
      if (tagName === 'MULU' || el.classList.contains('mulu')) {
        const titleAttr = el.getAttribute('s') || el.getAttribute('data-mulu') || el.textContent || '';
        const title = titleAttr.trim();
        if (title) {
          // 💡 防重機制：如果與上一個收集到的 TOC 品名相同，則忽略（防範 span.mulu 與其內嵌 a.mulu 重複觸發）
          const isDuplicate = allRawTocs && allRawTocs.length > 0 && 
                              allRawTocs[allRawTocs.length - 1].title === title &&
                              allRawTocs[allRawTocs.length - 1].juan === juan;
          
          if (!isDuplicate) {
            const tocItem = {
              title,
              juan,
              startSegmentId: '' // 預設為空，如果之後沒遇到段落就保持空
            };
            if (allRawTocs) {
              allRawTocs.push(tocItem);
            }
            unlinkedTocs.push(tocItem);
          }
        }
      }

      // 3. 遇到經文段落標籤 (p, div.p, 標題 class, 以及偈頌行 l)
      // 偈頌處理原則：
      //   - <lg> 若有 <l> 子行 → 跳過容器本身，讓 <l> 各自生成段落（與 CBETA 分行顯示一致）
      //   - <lg> 無 <l> 子行 → 維持原本整塊處理（向下相容）
      //   - <l> 元素 → 各自建立 isVerse 段落
      const isVerseContainer = el.classList.contains('lg');
      const hasVerseLineChildren = isVerseContainer && !!el.querySelector('l, .l');
      const isVerseLine = tagName === 'L' || (el.classList.contains('l') && !el.classList.contains('lb') && !el.classList.contains('lb-line'));

      // 若為有 <l> 子行的 <lg> 容器，直接跳過（不要把全部 <l> 合成一段）
      if (hasVerseLineChildren) {
        currentNode = iterator.nextNode();
        continue;
      }

      const isBareTextSpan = tagName === 'SPAN' && el.classList.contains('t') && !hasParagraphAncestor(el);

      if (
        tagName === 'P' ||
        el.classList.contains('p') ||
        el.classList.contains('head') ||
        el.classList.contains('lg') ||
        isBareTextSpan ||
        isVerseLine
      ) {
        const textContent = el.textContent?.trim() || '';
        
        // 即使 textContent 為空，但若有待綁定的 TOC 項目，我們也生成一個空的段落來做為它的起點
        if (textContent || unlinkedTocs.length > 0) {
          // 優先提取段落內部的 lb。如果沒有，使用當前最新的外部 activeLb
          let lb = activeLb;
          const lbEl = el.querySelector('[id*="p"], [class*="lb"]');
          if (lbEl) {
            lb = lbEl.id || lbEl.getAttribute('data-lb') || lb;
          }

          const segmentId = `${workId}_${juan.toString().padStart(2, '0')}_seg${segmentIndex.toString().padStart(4, '0')}`;
          const originalContent = el.innerHTML;

          // 2. Reference Model: 找出本段落內的所有校勘參考 (擴展以匹配 href='#cb_note_x')
          const notes: TextSegment['notes'] = [];
          const noteRefs = el.querySelectorAll('a[href^="#note"], a[href^="#cb_note"], .note, [class*="anchor"]');
          noteRefs.forEach((ref) => {
            const href = ref.getAttribute('href') || '';
            const noteId = href.replace('#', '');
            const refText = ref.textContent || '';
            
            if (noteId && noteMap.has(noteId)) {
              notes.push({
                id: refText || `[註]`,
                content: noteMap.get(noteId) || '',
                cbetaUrl: `https://cbetaonline.dila.edu.tw/stable/${lb}`
              });
            }
          });

          // 3. Reader Model (乾淨的純文字)
          const cleanClone = el.cloneNode(true) as HTMLElement;
          cleanClone.querySelectorAll('a, .lb, .note, [class*="note"], [class*="lb"]').forEach(child => child.remove());
          const cleanContent = cleanClone.textContent?.trim() || textContent;

          const isHead = el.tagName.toUpperCase() === 'HEAD' || el.classList.contains('head') || el.hasAttribute('data-head-level');
          const isVerse = el.classList.contains('lg') || isVerseLine;

          const seg: TextSegment = {
            id: segmentId,
            lb,
            juan,
            isHead: isHead ? true : undefined,
            isVerse: isVerse ? true : undefined,
            content: cleanContent,
            originalContent,
            notes: notes.length > 0 ? notes : undefined
          };

          // 💡 為當前所有待綁定的 TOC 項目，寫入精確的 startSegmentId 起始段落
          if (unlinkedTocs.length > 0) {
            seg.muluTitles = unlinkedTocs.map(t => t.title);
            unlinkedTocs.forEach(tocItem => {
              tocItem.startSegmentId = segmentId;
            });
            unlinkedTocs.length = 0; // 清空暫存
          }

          segments.push(seg);
          segmentIndex++;
        }
      }

      currentNode = iterator.nextNode();
    }

    // 如果沒有解析出段落，回傳 fallback
    if (segments.length === 0) {
      return this.generateFallbackSegments(workId, juan);
    }

    return segments;
  }

  /**
   * 生成 Fallback 模擬段落以確保容錯
   */
  private static generateFallbackSegments(workId: string, juan: number): TextSegment[] {
    return [
      {
        id: `${workId}_${juan.toString().padStart(2, '0')}_seg0001`,
        lb: `${workId}p0001a01`,
        juan,
        content: `（經典載入中，或目前為離線閱讀模式。此處為《${workId}》第 ${juan} 卷經文預設段落）`,
        originalContent: `<p>（經典載入中，或目前為離線閱讀模式。此處為《${workId}》第 ${juan} 卷經文預設段落）</p>`
      }
    ];
  }
}
