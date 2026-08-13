import type { BookContent, JuanData, TextSegment } from '../types/book';
import { getApiUrl, fetchWithTimeout } from './IndexBuilder';
import { getSourceMode } from '../utils/sourceMode';

export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '即將完成';
  if (seconds < 60) return `${seconds} 秒`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins} 分鐘`;
  return `${mins} 分 ${secs} 秒`;
}

/**
 * 💡 CBETA 常見組字式 / 異體字 / 缺字對照表與自動解析引擎
 */
const CBETA_GAIJI_ASSEMBLY_MAP: Record<string, string> = {
  '[言*(狂-王+主)]': '詶',
  '[圭*頁]': '頯',
  '[億-亻+金]': '億',
  '[口*[(口*口)/土]]': '噐',
  '[日*頁]': '暊',
  '[目*頁]': '眭',
  '[身*寸]': '躬',
  '[月*正]': '覇',
  '[言*成]': '訏',
  '[目*黃]': '瞚',
  '[王*利]': '俐',
  '[束*力]': '勅',
  '[立*立]': '竝',
  '[禾*少]': '秒',
};

export function resolveCbetaGaijiAssembly(input: string): string {
  if (!input) return input;
  let text = input;
  for (const [assembly, normChar] of Object.entries(CBETA_GAIJI_ASSEMBLY_MAP)) {
    if (text.includes(assembly)) {
      text = text.replaceAll(assembly, normChar);
    }
  }
  text = text.replace(/\[([^\]]+)\]/g, (match, inner) => {
    const chineseChars = inner.match(/[\u4e00-\u9fa5\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf\u2ceb0-\u2ebf0]/g);
    if (chineseChars && chineseChars.length > 0) {
      return chineseChars[0];
    }
    return match;
  });
  return text;
}

export class ReaderBuilder {
  /**
   * 抓取並解析特定經典的所有卷 (支援 6 線程併行流下載 + 自動重試 3 次，防止 CBETA 429 限流與預設空白段落)
   * @param workId 經典ID (例如 T0412)
   * @param juansCount 總卷數
   * @param onProgress 進度回報 callback (0 到 100)
   */
  static async buildContent(
    workId: string, 
    juansCountInput: number,
    onProgress?: (progress: number, currentJuan?: number, totalJuans?: number, remSec?: number, isBackup?: boolean) => void
  ): Promise<{ content: BookContent; rawToc: any[] }> {
    const juansCount = (juansCountInput && juansCountInput > 0) ? juansCountInput : 1;
    const juans: JuanData[] = [];
    const juansMap = new Map<number, TextSegment[]>();
    let allRawTocs: any[] = [];
    let completedJuansCount = 0;
    const startTime = Date.now();

    try {
      const CONCURRENCY = 6;
      const queue = Array.from({ length: juansCount }, (_, idx) => idx + 1);

      const worker = async () => {
        while (queue.length > 0) {
          const j = queue.shift();
          if (!j) break;

          let success = false;

          // 1. 檢查是否處於備援模式或優先嘗試備援鏡像庫
          const isBackup = getSourceMode() === 'backup';

          if (isBackup) {
            try {
              const localBackupUrl = `/backup/${workId}/${j}.json`;
              const ghReleaseUrl = `https://github.com/vbgrdmental-bit/Cbeta-Reader/releases/download/v1.0.0-database/${workId}_${j}.json`;
              const ghCdnUrl = `https://raw.githubusercontent.com/vbgrdmental-bit/Cbeta-Reader/main/public/backup/${workId}/${j}.json`;
              const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/vbgrdmental-bit/Cbeta-Reader@main/public/backup/${workId}/${j}.json`;
              const r2Url = `https://pub-e2ea6fc068554e16b348032c3d5c10cd.r2.dev/${workId}/${j}.json`;

              let backupRes = await fetchWithTimeout(localBackupUrl, {}, 2500);
              if (!backupRes || !backupRes.ok) {
                backupRes = await fetchWithTimeout(ghReleaseUrl, {}, 3000);
              }
              if (!backupRes || !backupRes.ok) {
                backupRes = await fetchWithTimeout(ghCdnUrl, {}, 3500);
              }
              if (!backupRes || !backupRes.ok) {
                backupRes = await fetchWithTimeout(jsdelivrUrl, {}, 3500);
              }
              if (!backupRes || !backupRes.ok) {
                backupRes = await fetchWithTimeout(r2Url, {}, 4000);
              }

              if (backupRes && backupRes.ok) {
                const bData = await backupRes.json().catch(() => null);
                if (bData) {
                  const rawTocList = Array.isArray(bData.toc)
                    ? bData.toc
                    : (bData.toc?.mulu && Array.isArray(bData.toc.mulu) ? bData.toc.mulu : []);

                  const juanHtml = typeof bData.html === 'string' ? bData.html : (bData.results && bData.results[0] ? (bData.results[0].html || bData.results[0]) : '');

                  // 💡 TOC 建構策略：
                  // 第一步：如果 allRawTocs 還是空的，用 toc.mulu 建立全書項層骨架（包含全部卷次的頂層目錄）
                  if (allRawTocs.length === 0 && rawTocList.length > 0) {
                    allRawTocs = rawTocList.map((n: any) => ({ ...n }));
                  }

                  // 第二步：對此 juan 的 HTML 提取深層次子節點，補充到對應的頂層骨架節點
                  if (juanHtml) {
                    const htmlTocTree = ReaderBuilder.extractTocTreeFromHtml(juanHtml, j);
                    if (htmlTocTree.length > 0) {
                      // 找到對應此 juan 的頂層骨架節點並補充 children
                      const juanMuluNode = allRawTocs.find((n: any) => n.juan === j);
                      if (juanMuluNode && !(juanMuluNode.children && juanMuluNode.children.length > 0)) {
                        // HTML 提取的子層次：如果只有 1 個頂層節點且標題與骨架頂層相同，則展開其 children
                        const singleTopNode = htmlTocTree.length === 1 ? htmlTocTree[0] : null;
                        if (singleTopNode && singleTopNode.children && singleTopNode.children.length > 0) {
                          juanMuluNode.children = singleTopNode.children;
                        } else if (htmlTocTree.length > 1) {
                          // 多個頂層節點：直接將 HTML 提取的子層次加入
                          juanMuluNode.children = htmlTocTree;
                        }
                      }
                    }
                  }

                  if (juanHtml) {
                    const segments = this.parseHtmlToSegments(juanHtml, workId, j, allRawTocs);
                    if (segments && segments.length > 0) {
                      juansMap.set(j, segments);
                      success = true;
                    }
                  }
                }
              }
            } catch (bErr) {
              console.warn(`[Juan ${j}] Backup fetch attempt failed:`, bErr);
            }
          }

          if (!success) {
            // 2. 向 CBETA 官方 API 請求 (最多重試 2 次，防範無效等待)
            const cleanPath = `/stable/juans?work=${workId}&juan=${j}&work_info=1&toc=1`;
            const relativeUrl = getApiUrl(cleanPath);
            const directUrl = `https://cbdata.dila.edu.tw${cleanPath}`;

            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                const timeoutMs = attempt === 1 ? 2500 : 4000;
                const fetchOptions = attempt === 1 ? {} : { cache: 'reload' as RequestCache };
                const currentRelUrl = attempt === 1 ? relativeUrl : `${relativeUrl}&_t=${Date.now()}`;
                const currentDirUrl = attempt === 1 ? directUrl : `${directUrl}&_t=${Date.now()}`;

                let response = await fetchWithTimeout(currentRelUrl, fetchOptions, timeoutMs);
                if (!response || !response.ok) {
                  response = await fetchWithTimeout(currentDirUrl, fetchOptions, timeoutMs);
                }

                if (response && response.ok) {
                  const data = await response.json().catch(() => null);

                  if (data && Array.isArray(data.results) && data.results.length > 0) {
                    const rawResult = data.results[0];
                    const juanHtml = typeof rawResult === 'string' ? rawResult : (rawResult.html || '');

                    // 💡 主線模式：
                    // 第一步：如果 allRawTocs 還是空的，用 toc.mulu 建立全書項層骨架
                    if (allRawTocs.length === 0 && data.toc && Array.isArray(data.toc.mulu) && data.toc.mulu.length > 0) {
                      allRawTocs = data.toc.mulu.map((n: any) => ({ ...n }));
                    }

                    // 第二步：對此 juan 的 HTML 提取深層次子節點，補充到對應頂層骨架節點
                    if (juanHtml) {
                      const htmlTocTree = ReaderBuilder.extractTocTreeFromHtml(juanHtml, j);
                      if (htmlTocTree.length > 0) {
                        const juanMuluNode = allRawTocs.find((n: any) => n.juan === j);
                        if (juanMuluNode && !(juanMuluNode.children && juanMuluNode.children.length > 0)) {
                          const singleTopNode = htmlTocTree.length === 1 ? htmlTocTree[0] : null;
                          if (singleTopNode && singleTopNode.children && singleTopNode.children.length > 0) {
                            juanMuluNode.children = singleTopNode.children;
                          } else if (htmlTocTree.length > 1) {
                            juanMuluNode.children = htmlTocTree;
                          }
                        }
                      }
                    }

                    const segments = this.parseHtmlToSegments(
                      juanHtml, 
                      workId, 
                      j, 
                      allRawTocs
                    );
                    if (segments && segments.length > 0) {
                      juansMap.set(j, segments);
                      success = true;
                      break;
                    }
                  }
                }
              } catch (e) {
                console.warn(`[Juan ${j}] Fetch attempt ${attempt} failed:`, e);
              }
              await new Promise(r => setTimeout(r, 150));
            }
          }

          // 3. 若主源失敗，再嘗試離線備援鏡像 (Secondary Backup Fallback)
          if (!success && !isBackup) {
            try {
              const localBackupUrl = `/backup/${workId}/${j}.json`;
              const ghReleaseUrl = `https://github.com/vbgrdmental-bit/Cbeta-Reader/releases/download/v1.0.0-database/${workId}_${j}.json`;
              const ghCdnUrl = `https://raw.githubusercontent.com/vbgrdmental-bit/Cbeta-Reader/main/public/backup/${workId}/${j}.json`;
              const r2Url = `https://pub-e2ea6fc068554e16b348032c3d5c10cd.r2.dev/${workId}/${j}.json`;

              let backupRes = await fetchWithTimeout(localBackupUrl, {}, 2500);
              if (!backupRes || !backupRes.ok) {
                backupRes = await fetchWithTimeout(ghReleaseUrl, {}, 3000);
              }
              if (!backupRes || !backupRes.ok) {
                backupRes = await fetchWithTimeout(ghCdnUrl, {}, 3500);
              }
              if (!backupRes || !backupRes.ok) {
                backupRes = await fetchWithTimeout(r2Url, {}, 4000);
              }

              if (backupRes && backupRes.ok) {
                const bData = await backupRes.json().catch(() => null);
                if (bData) {
                  const html = typeof bData.html === 'string' ? bData.html : (bData.results && bData.results[0] ? (bData.results[0].html || bData.results[0]) : '');
                  if (html) {
                    const segments = this.parseHtmlToSegments(html, workId, j, allRawTocs);
                    if (segments && segments.length > 0) {
                      juansMap.set(j, segments);
                      success = true;
                    }
                  }
                }
              }
            } catch (fbErr) {
              console.warn(`[Juan ${j}] Secondary backup fallback attempt failed:`, fbErr);
            }
          }

          if (!success) {
            console.error(`[Juan ${j}] All attempts (Official API + R2 Backup) failed to fetch.`);
            throw new Error(`無法向 CBETA 伺服器獲取《${workId}》第 ${j} 卷正統經文。本 App 堅持 100% CBETA 原文正統，絕不提供任何簡化或摘要內容。請檢查網路連線後重試。`);
          }

          completedJuansCount++;
          if (onProgress) {
            const elapsed = (Date.now() - startTime) / 1000;
            const avgPerJuan = elapsed / completedJuansCount;
            const remainingSeconds = Math.ceil((juansCount - completedJuansCount) * avgPerJuan);
            const percent = Math.floor((completedJuansCount / juansCount) * 100);
            
            onProgress(percent, completedJuansCount, juansCount, remainingSeconds);
          }
        }
      };

      // 併行啟動 6 個 worker 管道
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      // 按卷數 1 ~ juansCount 正確順序排列
      for (let j = 1; j <= juansCount; j++) {
        const segs = juansMap.get(j);
        if (!segs || segs.length === 0) {
          throw new Error(`《${workId}》第 ${j} 卷經文內容為空，未能成功取得 CBETA 官方原版正文。`);
        }
        juans.push({
          juan: j,
          segments: segs
        });
      }

      if (onProgress) {
        onProgress(100, juansCount, juansCount, 0);
      }

      return {
        content: {
          workId,
          juans
        },
        rawToc: allRawTocs
      };

    } catch (onlineError) {
      console.warn(`Online fetch failed for ${workId}:`, onlineError);

      // 💡 遵循最高核心原則：絕不產生任何「假段落」、「預設段落」或「摘要文字」！
      // 寧可跳出網路連線超時提示，也絕對不提供任何非 CBETA 官方原版的文字內容。
      throw new Error(`無法連線至 CBETA 伺服器獲取《${workId}》正統經文。本 App 堅持 100% CBETA 原版原汁原味，絕不提供任何簡化、摘要或替代文字。請檢查網路連線後重試。`);
    }
  }

  /**
   * 從 CBETA HTML 中以 cb:div 嵌套結構提取完整的多層次 TOC 樹。
   * 適用於備援 JSON 的 toc.mulu 只有扁平頂層節點，但 HTML 內有豐富嵌套目錄的書籍
   * （例如印順導師講記 Y 系列，如 Y0001 般若經講記，最深可達 11 層）。
   * 提取的每個節點包含：title（品名）、lb（行號定位）、juan（卷次）、children（子節點陣列）。
   */
  static extractTocTreeFromHtml(
    html: string,
    juanNum: number
  ): any[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 改用更可靠的遞迴建樹方式
    const buildTree = (el: Element): any[] => {
      const children: any[] = [];
      for (const child of Array.from(el.children)) {
        const childTag = child.tagName ? child.tagName.toLowerCase() : '';
        if (childTag === 'cb:div') {
          const subtree = buildCbDivNode(child as Element);
          if (subtree) children.push(subtree);
        } else {
          // 找非 cb:div 元素裡的 cb:div 子孫
          const nested = buildTree(child as Element);
          children.push(...nested);
        }
      }
      return children;
    };

    const buildCbDivNode = (cbDivEl: Element): any | null => {
      // 先掃描此 cb:div 內的 lb 和 cb-mulu（只取直接子節點）
      let title = '';
      let lb = '';
      const childNodes = Array.from(cbDivEl.childNodes);

      for (const child of childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childEl = child as Element;
          const cTag = childEl.tagName ? childEl.tagName.toLowerCase() : '';

          // 取第一個 lb（位於此 cb:div 開始位置的行號）
          if (!lb && cTag === 'span' && childEl.classList.contains('lb')) {
            const lbId = childEl.id || '';
            if (lbId && /^p[0-9]/.test(lbId)) lb = lbId;
          }

          // 取第一個 cb-mulu 標題
          if (!title && childEl.classList.contains('cb-mulu')) {
            title = childEl.textContent?.trim() || '';
          }

          // 如果兩者都找到，可提前結束
          if (title && lb) break;
        }
      }

      if (!title) return null; // 沒有品名的 cb:div 忽略

      // 遞迴收集子 cb:div
      const childCbDivs: any[] = [];
      for (const child of Array.from(cbDivEl.children)) {
        const cTag = child.tagName ? child.tagName.toLowerCase() : '';
        if (cTag === 'cb:div') {
          const sub = buildCbDivNode(child as Element);
          if (sub) childCbDivs.push(sub);
        } else {
          // 找嵌套在非 cb:div 元素中的 cb:div
          for (const grandchild of Array.from(child.children)) {
            if (grandchild.tagName && grandchild.tagName.toLowerCase() === 'cb:div') {
              const sub = buildCbDivNode(grandchild as Element);
              if (sub) childCbDivs.push(sub);
            }
          }
        }
      }

      const treeNode: any = { title, lb, juan: juanNum };
      if (childCbDivs.length > 0) treeNode.children = childCbDivs;
      return treeNode;
    };

    const body = doc.body || doc.documentElement;
    const result = buildTree(body);
    return result;
  }

  /**
   * 使用瀏覽器 DOMParser 解析 CBETA HTML 經文，分離成 Canonical 與 Reader Model
   * 並在遍歷過程中線性捕獲行號 (lb) 與 目錄品名 (mulu)，建立高精度的 TOC 映射。
   */
  private static parseHtmlToSegments(
    html: string, 
    workId: string, 
    juan: number,
    _allRawTocs?: any[]
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
          parent.classList.contains('l') ||
          pTagName === 'LI' ||
          parent.classList.contains('li') ||
          pTagName === 'ITEM' ||
          parent.classList.contains('item') ||
          pTagName === 'FIGURE' ||
          parent.classList.contains('figure') ||
          parent.classList.contains('div-figure') ||
          parent.classList.contains('div-other') ||
          parent.classList.contains('div-byline') ||
          parent.classList.contains('div-entry')
        ) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    // 💡 取得當前元素前面兄弟節點中的縮排尺寸
    const getPrecedingLineSpaceSize = (node: HTMLElement): number => {
      let current: HTMLElement | null = node;
      while (current && current.tagName !== 'P' && current.tagName !== 'BODY') {
        let sibling = current.previousSibling;
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE) {
            const sibEl = sibling as HTMLElement;
            if (sibEl.classList.contains('line_space')) {
              const sizeAttr = sibEl.getAttribute('data-size');
              return sizeAttr ? parseInt(sizeAttr, 10) : 0;
            }
          }
          sibling = sibling.previousSibling;
        }
        current = current.parentElement;
      }
      return 0;
    };
    const isAtStartOfContainer = (container: HTMLElement, target: HTMLElement): boolean => {
      const childNodes = Array.from(container.childNodes);
      const targetIdx = childNodes.findIndex(node => node === target || node.contains(target));
      if (targetIdx <= 0) return true;
      
      for (let i = 0; i < targetIdx; i++) {
        const node = childNodes[i];
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent?.trim() !== '') {
            return false;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const htmlEl = node as HTMLElement;
          if (htmlEl.classList.contains('noteAnchor') || htmlEl.classList.contains('note') || htmlEl.tagName === 'A') {
            continue;
          }
          if (htmlEl.textContent?.trim() !== '') {
            return false;
          }
        }
      }
      return true;
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

    const isFootnoteContainer = (element: HTMLElement): boolean => {
      let parent: HTMLElement | null = element;
      while (parent && parent.tagName !== 'BODY') {
        const id = parent.id || '';
        const className = typeof parent.className === 'string' ? parent.className : '';
        
        if (
          id === 'back' || 
          id === 'footnotes' ||
          id.startsWith('note') || 
          id.startsWith('cb_note') ||
          className.includes('footnote') ||
          className.includes('note-text')
        ) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    let currentNode = iterator.nextNode();
    while (currentNode) {
      const el = currentNode as HTMLElement;
      const tagName = el.tagName.toUpperCase();

      // 💡 跳過頁尾/腳註區塊 (div#back, .footnote, [id^="cb_note"]) 內部的所有 DOM 元素
      // 防範腳註段落 (例如 <p>參見《印順導師著作總目...》</p>) 被誤判為經文正文段落
      if (isFootnoteContainer(el)) {
        currentNode = iterator.nextNode();
        continue;
      }

      // 1. 遇到行頭標籤，更新當前最鄰近的行號
      // 💡 只採用 p-開頭 lb (如 p0001a01)，忽略 pb-開頭 (紙本頁碼) 避免錯誤 lb 覆蓋
      if (tagName === 'SPAN' && el.classList.contains('lb')) {
        const lbId = el.id || el.getAttribute('data-lb') || '';
        if (lbId && /^p[0-9]/.test(lbId)) {
          activeLb = lbId;
        } else if (lbId && !lbId.startsWith('pb') && !activeLb) {
          activeLb = lbId;
        }
      }

      // 2. 遇到目錄品名標籤，相容：
      //    a) 自訂 <mulu> 標籤
      //    b) class="mulu" 的 HTML 元素
      //    c) class="cb-mulu" 的 div (CBETA 官方 HTML 格式)
      const isMuluEl = tagName === 'MULU' || el.classList.contains('mulu') || el.classList.contains('cb-mulu');
      if (isMuluEl) {
        const titleAttr = el.getAttribute('s') || el.getAttribute('data-mulu') || el.textContent || '';
        const title = titleAttr.trim();
        if (title) {
          // 💡 防重機制：如果與上一個 unlinkedTocs 品名相同，則忽略（防範重複觸發）
          const lastUnlinked = unlinkedTocs.length > 0 ? unlinkedTocs[unlinkedTocs.length - 1] : null;
          const isDuplicate = lastUnlinked && lastUnlinked.title === title && lastUnlinked.juan === juan;
          
          if (!isDuplicate) {
            const tocItem = {
              title,
              juan,
              startSegmentId: '' // 預設為空，由後續段落來填入
            };
            unlinkedTocs.push(tocItem);
          }
        }
      }

      // 3. 遇到經文段落標籤 (p, div.p, 標題 class, 偈頌行 l, 列表項 li, 以及附圖/圖表 div.div-figure)
      // 偈頌處理原則：
      //   - <lg> 若有 <l> 子行 → 跳過容器本身，讓 <l> 各自生成段落（與 CBETA 分行顯示一致）
      //   - <lg> 無 <l> 子行 → 維持原本整塊處理（向下相容）
      //   - <l> 元素 → 各自建立 isVerse 段落
      const isVerseContainer = el.classList.contains('lg') || tagName === 'LG';
      const hasVerseLineChildren = isVerseContainer && (!!el.querySelector('l, .l') || !!el.querySelector('.lg-row') || (el.querySelectorAll('p.lg, .lg').length > 1));
      const isVerseLine = tagName === 'L' || (el.classList.contains('l') && !el.classList.contains('lb') && !el.classList.contains('lb-line')) || el.classList.contains('lg-row') || el.classList.contains('lg') || el.parentElement?.classList.contains('lg');

      // 列表 (UL/OL/LI/ITEM/P.lg) 處理原則：
      //   - <ul/ol/p.lg/item> 若有 <li>/<item>/<p.lg> 子行 → 跳過容器本身，讓子項目各自生成段落
      //   - <li>/<item> 元素 → 各自建立獨立的清單段落，完整保留內嵌註解與標籤
      const isListContainer = tagName === 'UL' || tagName === 'OL' || tagName === 'LIST' || (tagName === 'P' && el.classList.contains('lg')) || (tagName === 'DIV' && el.classList.contains('lg')) || ((tagName === 'ITEM' || el.classList.contains('item')) && !!el.querySelector('item, .item, p.lg, .lg, list, ul, ol'));
      const hasListItemChildren = isListContainer && (!!el.querySelector('li, .li, item, .item') || (el.querySelectorAll('p.lg, .lg').length > 0));
      const isListItem = tagName === 'LI' || el.classList.contains('li') || tagName === 'ITEM' || el.classList.contains('item');

      // 附圖/圖表/雜項 (div-figure, figure, div-other) 處理原則：
      //   - 若內部有 <p>, <li>, <lg> 等段落子行 → 跳過容器本身，讓子行各自生成段落
      //   - 若內部無段落子行 → 將 div-figure/div-other 容器本身建立為獨立的經文段落
      const isFigureContainer = tagName === 'FIGURE' || el.classList.contains('figure') || el.classList.contains('div-figure') || el.classList.contains('div-other');
      const hasChildParagraphs = isFigureContainer && (!!el.querySelector('p, .p, lg, .lg, l, .l, li, .li, item, .item, figure, .figure, .div-figure'));

      // 若為有子項目的容器，直接跳過容器本身（讓子項目各自生成段落）
      if (hasVerseLineChildren || hasListItemChildren || hasChildParagraphs) {
        currentNode = iterator.nextNode();
        continue;
      }

      const isBareTextSpan = tagName === 'SPAN' && el.classList.contains('t') && !hasParagraphAncestor(el);
      const isFigureParagraph = isFigureContainer && !hasChildParagraphs;

      if (
        tagName === 'P' ||
        el.classList.contains('p') ||
        el.classList.contains('head') ||
        el.classList.contains('lg') ||
        el.classList.contains('juan') ||
        el.classList.contains('docnumber') ||
        isBareTextSpan ||
        isVerseLine ||
        isListItem ||
        isFigureParagraph
      ) {
        const textContent = el.textContent?.trim() || '';
        
        // 即使 textContent 為空，但若有待綁定的 TOC 項目，我們也生成一個空的段落來做為它的起點
        if (textContent || unlinkedTocs.length > 0) {
          // 優先提取段落內部的 lb。只有當它位於段落起點時才採用，防範跨行段落的後半行行號誤覆蓋起點行號
          let lb = activeLb;
          const lbEl = el.querySelector('[id*="p"], [class*="lb"]') as HTMLElement | null;
          if (lbEl && isAtStartOfContainer(el, lbEl)) {
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

          // 💡 3. Reader Model (乾淨的純文字)
          const cleanClone = el.cloneNode(true) as HTMLElement;

          // 💡 如果本 <item> 內部還嵌套有子項 <item> 或 <p.lg>，必須將子項容器從 cleanClone 中移除
          // 否則父項 <item> 會一口氣包含底下所有子項文字的大合集，導致文字重複並全擠在同一段落
          if (tagName === 'ITEM' || el.classList.contains('item')) {
            cleanClone.querySelectorAll('item, .item, p.lg, .lg, list, ul, ol').forEach(child => child.remove());
          }

          // 💡 解析縮排標籤：將 <span class='line_space' data-size='X'> 替換成對應數量的全形空格，以保留印順導師著作中的層級縮排
          // 只有位於段落/容器最前端的 line_space 才是真正的段落縮排；段落中間出現的 line_space 為大藏經紙本折行與版面對齊遺跡，應直接移除，防止文字中途出現惱人空格
          cleanClone.querySelectorAll('.line_space, [class*="line_space"]').forEach(spaceEl => {
            const isStart = isAtStartOfContainer(cleanClone, spaceEl as HTMLElement);
            if (isStart) {
              const sizeAttr = spaceEl.getAttribute('data-size');
              const size = sizeAttr ? parseInt(sizeAttr, 10) : 0;
              if (size > 0) {
                const spaces = '　'.repeat(size);
                const textNode = doc.createTextNode(spaces);
                spaceEl.parentNode?.replaceChild(textNode, spaceEl);
              } else {
                spaceEl.remove();
              }
            } else {
              spaceEl.remove();
            }
          });
          
          // 💡 線上小註/雙行小註轉換：將其文字內容加上全形括號，防止被後續 footnote 清除，並便於 Reader 渲染與搜尋
          cleanClone.querySelectorAll('small, .inline-note, [class*="inline-note"], [place="inline"]').forEach(noteEl => {
            // 先清除小註內部可能夾帶的行號（.lb）與錨點（a），防範行號文字（例如 T19n0945_p0106b04）混入小註內容中
            noteEl.querySelectorAll('a, .lb, [class*="lb"]').forEach(child => child.remove());
            
            const noteText = noteEl.textContent?.trim() || '';
            if (noteText) {
              const cleanNote = noteText.replace(/^[（(]\s*/, '').replace(/\s*[）)]$/, '').trim();
              const textNode = doc.createTextNode(`（${cleanNote}）`);
              noteEl.parentNode?.replaceChild(textNode, noteEl);
            } else {
              noteEl.remove();
            }
          });

          // 💡 1.0 展平 CBETA 書名號標記 <title level="m"> 標籤：
          // HTML5 DOMParser 將 <title> 視為 <head> 的 title，導致內部 HTML 標籤（如 span.lb）以純文字外漏
          // 解決：取其 textContent 並以文字節點替換整個 title 元素
          cleanClone.querySelectorAll('title').forEach(titleEl => {
            const text = titleEl.textContent || '';
            if (text.trim()) {
              const textNode = doc.createTextNode(text);
              titleEl.parentNode?.replaceChild(textNode, titleEl);
            } else {
              titleEl.remove();
            }
          });

          // 💡 1. 移除所有行號標籤 (.lb, [class*="lb"]) 與 目錄標籤 (mulu)
          cleanClone.querySelectorAll('.lb, [class*="lb"], mulu, cb\\:mulu, .cb-mulu').forEach(lbEl => {
            if (!lbEl.classList.contains('gaiji') && !lbEl.classList.contains('gaijiAnchor') && !lbEl.classList.contains('gaiji_note')) {
              lbEl.remove();
            }
          });
          cleanClone.querySelectorAll('*').forEach(child => {
            const tName = child.tagName.toLowerCase();
            if (tName.includes('mulu') || child.classList.contains('cb-mulu')) {
              child.remove();
            }
          });

          // 💡 1.5 優先解析所有 CBETA 異體字 / 缺字 / 組字標籤 (gaiji, gaijiAnchor, data-norm, data-uni)
          cleanClone.querySelectorAll('.gaiji, .gaijiAnchor, .gaiji_note, gaiji, [data-norm], [data-uni]').forEach(gaijiEl => {
            let resolvedChar = gaijiEl.getAttribute('data-norm') || '';
            if (!resolvedChar) {
              const uniAttr = gaijiEl.getAttribute('data-uni') || gaijiEl.getAttribute('data-unicode');
              if (uniAttr && /^U\+[0-9A-Fa-f]+$/i.test(uniAttr.trim())) {
                try {
                  const hex = parseInt(uniAttr.trim().replace(/^U\+/i, ''), 16);
                  resolvedChar = String.fromCodePoint(hex);
                } catch {}
              }
            }
            if (!resolvedChar) {
              resolvedChar = gaijiEl.textContent || '';
            }
            if (resolvedChar) {
              resolvedChar = resolveCbetaGaijiAssembly(resolvedChar);
            }
            const textNode = doc.createTextNode(resolvedChar);
            gaijiEl.parentNode?.replaceChild(textNode, gaijiEl);
          });

          // 💡 2. 處理連結標籤 (a) 與 校勘腳註標籤 (.noteAnchor, .note)
          cleanClone.querySelectorAll('a, .note, [class*="noteAnchor"]').forEach(anchorEl => {
            const isFootnoteAnchor = anchorEl.classList.contains('noteAnchor') || 
                                     anchorEl.classList.contains('note') ||
                                     anchorEl.getAttribute('href')?.startsWith('#note') || 
                                     anchorEl.getAttribute('href')?.startsWith('#cb_note') || 
                                     anchorEl.classList.contains('anchor') ||
                                     anchorEl.getAttribute('class')?.includes('anchor');
            if (isFootnoteAnchor) {
              const text = anchorEl.textContent || '';
              const isPureLabel = /^\[?\d+\]?$/.test(text.trim()) || /^\[?[＊*]\]?$/.test(text.trim()) || text.trim() === '註' || text.trim() === '校' || text.trim() === '';
              if (isPureLabel) {
                anchorEl.remove();
              } else {
                const textNode = doc.createTextNode(resolveCbetaGaijiAssembly(text));
                anchorEl.parentNode?.replaceChild(textNode, anchorEl);
              }
            } else {
              const text = anchorEl.textContent || '';
              const isLineAnchor = /^[A-Za-z0-9]+_p\d+[a-z]?\d*/i.test(text.trim()) || anchorEl.id.includes('p') || anchorEl.classList.contains('lb') || anchorEl.getAttribute('href')?.includes('_p');
              if (isLineAnchor) {
                anchorEl.remove();
              } else {
                const textNode = doc.createTextNode(resolveCbetaGaijiAssembly(text));
                anchorEl.parentNode?.replaceChild(textNode, anchorEl);
              }
            }
          });
          
          let cleanContent = '';
          if (el.classList.contains('lg-row')) {
            const cells = Array.from(cleanClone.querySelectorAll('.lg-cell'));
            if (cells.length > 0) {
              const cellTexts = cells.map(cell => cell.textContent?.trim() || '');
              cleanContent = cellTexts.filter(Boolean).join('　');
            } else {
              cleanContent = cleanClone.textContent?.trim() || textContent;
            }
          } else {
            cleanContent = cleanClone.textContent?.trim() || textContent;
          }

          // 💡 經文中途多餘空格清理、完全抹除殘留行號標籤 (如 T05n0220_p0001a07) 與缺字自動對照轉換
          cleanContent = cleanContent.replace(/[A-Za-z0-9]+_p\d+[a-z]?\d*/gi, '');
          cleanContent = cleanContent.replace(/[ \t\r\n]+/g, '');
          // 💡 清除因 CBETA <title level="m"> 書名號標記在 HTML5 DOMParser 解析後殘留的 HTML 標籤字符串
          // (如 <spanclass="lb" id="p0168a08"></span>)，這是 RCDATA 元素內部標籤以純文字保留的副作用
          cleanContent = cleanContent.replace(/<[^>]{1,200}>/g, '');
          cleanContent = resolveCbetaGaijiAssembly(cleanContent);

          // 💡 取得當前元素前面兄弟節點中的縮排尺寸，並補上全形空格
          const precedingIndentSize = getPrecedingLineSpaceSize(el);
          if (precedingIndentSize > 0 && !cleanContent.startsWith('　')) {
            cleanContent = '　'.repeat(precedingIndentSize) + cleanContent;
          }

          // 💡 清單 (LI/ITEM) 項目縮排與標籤樣式優化 (層級遞進全形空格縮排)
          if (isListItem) {
            const trimmed = cleanContent.replace(/^[ 　\t]+/, '');
            
            // 計算當前 <item>/<li> 在 HTML 結構中的嵌套層級 depth
            let depth = 0;
            let curr = el.parentElement;
            while (curr && curr.tagName.toUpperCase() !== 'BODY') {
              const tag = curr.tagName.toUpperCase();
              if (tag === 'UL' || tag === 'OL' || tag === 'LIST' || tag === 'ITEM' || (tag === 'P' && curr.classList.contains('lg')) || curr.classList.contains('lg')) {
                depth++;
              }
              curr = curr.parentElement;
            }

            const indentLevel = Math.max(0, depth - 1);
            const baseIndent = '　　'.repeat(indentLevel);

            // 判斷是否自帶中文/阿拉伯數字或特定標題標頭 (如 "一　般若經講記", "1　金剛般若波羅蜜經講記", "上　編" 等)
            const hasNumeralOrHeader = /^[一二三四五六七八九十百千萬0-9１２３４５６７８９０上下中第]+/.test(trimmed) || 
                                       /^[•◦\-－(（]/.test(trimmed);

            if (hasNumeralOrHeader) {
              cleanContent = `${baseIndent}${trimmed}`;
            } else if (trimmed) {
              cleanContent = `${baseIndent}• ${trimmed}`;
            }
          }

          const isHead = el.tagName.toUpperCase() === 'HEAD' || el.classList.contains('head') || el.hasAttribute('data-head-level');
          const isVerse = (el.tagName.toUpperCase() === 'LG' && !hasVerseLineChildren) || isVerseLine || el.classList.contains('lg') || el.parentElement?.classList.contains('lg');
          const isByline = el.classList.contains('byline') || el.tagName.toUpperCase() === 'BYLINE';

          // 💡 經文引文/粗體經文判斷 (div-orig, p.bold, orig 等標籤，表示為金剛經等論典中所引用的原始經文)
          const isOrig = !isByline && !isHead && (
            el.classList.contains('bold') ||
            el.classList.contains('div-orig') ||
            el.classList.contains('orig') ||
            el.classList.contains('sutra') ||
            el.parentElement?.classList.contains('div-orig') ||
            Boolean(el.closest?.('.div-orig, .orig'))
          );

          const seg: TextSegment = {
            id: segmentId,
            lb,
            juan,
            isHead: isHead ? true : undefined,
            isVerse: isVerse ? true : undefined,
            isOrig: isOrig ? true : undefined,
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
      throw new Error(`無法解析《${workId}》第 ${juan} 卷之 CBETA HTML 內文。`);
    }

    return segments;
  }
}
