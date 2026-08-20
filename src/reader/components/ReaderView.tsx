import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, Menu, Settings, ExternalLink, X, ChevronLeft, ChevronRight, Search, Clock, ArrowLeft, Edit3, Trash2, FileText, AlertCircle, Paintbrush, Check
} from 'lucide-react';
import type { ReaderPackage, TextSegment, BookContent, JuanData } from '../../types/book';
import { getBook, saveBook, deleteBook, listHighlights, saveHighlight, deleteHighlight } from '../../utils/db';
import type { AppSettings, BookHighlight } from '../../utils/db';
import { NavigationBuilder } from '../../builder/NavigationBuilder';
import { BUILDER_VERSION } from '../../builder/version';
import { IndexBuilder, sanitizeCreators, FEATURED_BOOKS } from '../../builder/IndexBuilder';
import { PackageBuilder } from '../../builder/PackageBuilder';
import { useTTS } from '../hooks/useTTS';
import { SettingsView } from './SettingsView';
import { readingTimer, formatTimerMMSS } from '../../utils/readingTimer';
import { loadEduKaiFontOnDemand } from '../../utils/fontLoader';
import type { ReadingTimerState } from '../../utils/readingTimer';
import { isBackupMode } from '../../utils/sourceMode';
import '../styles/reader.css';

interface ReaderViewProps {
  workId: string;
  initialSegmentId?: string; // 外部傳入要跳轉的段落 ID
  autoResumeMode?: 'resume' | 'restart' | null;
  settings: AppSettings;
  onBackToLibrary: (resetToRoot?: boolean) => void;
  onSaveSettings: (settings: AppSettings) => void;
  searchQuery?: string;
}

// 💡 展平樹狀 TOC items 陣列，方便進行區間匹配與平舖查詢
const flattenTocItems = (items: any[]): any[] => {
  const result: any[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children && Array.isArray(item.children) && item.children.length > 0) {
      result.push(...flattenTocItems(item.children));
    }
  }
  return result;
};

// 💡 取得某個段落對應的 TOC 品名，若無 TOC 則退化為「第 X 卷」
const getMuluTitleForSegment = (book: any, juanNum: number, segmentId: string): string => {
  if (!book || !book.toc || !book.toc.items || book.toc.items.length === 0) {
    return `第 ${juanNum} 卷`;
  }

  const activeJuan = book.content.juans.find((j: any) => j.juan === juanNum);
  if (!activeJuan) return `第 ${juanNum} 卷`;

  const currentSegIdx = activeJuan.segments.findIndex((s: any) => s.id === segmentId);
  if (currentSegIdx === -1) return `第 ${juanNum} 卷`;

  const allItems = flattenTocItems(book.toc.items);
  const juanTocs = allItems
    .filter((item: any) => item.juan === juanNum)
    .map((item: any) => {
      const startIdx = activeJuan.segments.findIndex((s: any) => s.id === item.startSegmentId);
      return {
        title: item.title,
        startIdx: startIdx !== -1 ? startIdx : 0
      };
    })
    .sort((a: any, b: any) => a.startIdx - b.startIdx);

  if (juanTocs.length === 0) {
    return `第 ${juanNum} 卷`;
  }

  let matchedTitle = `第 ${juanNum} 卷`;
  for (let i = 0; i < juanTocs.length; i++) {
    if (currentSegIdx >= juanTocs[i].startIdx) {
      matchedTitle = juanTocs[i].title;
    } else {
      break;
    }
  }

  return matchedTitle.replace(/-\d+$/, '');
};

// 💡 樹狀目錄單一節點組件 (支援多層級展開/折疊與自動跳轉)
interface TocTreeNodeProps {
  item: any;
  level?: number;
  activeSegmentId: string | null;
  currentJuanNum: number;
  workId: string;
  isMultiJuan: boolean;
  onSelectTOC: (item: any) => void;
}

const TocTreeNode: React.FC<TocTreeNodeProps> = ({
  item,
  level = 0,
  activeSegmentId,
  currentJuanNum,
  workId,
  isMultiJuan,
  onSelectTOC
}) => {
  const hasChildren = Boolean(item.children && Array.isArray(item.children) && item.children.length > 0);

  // 檢查此節點及其子樹是否包含當前活躍段落
  const containsActiveSegment = (node: any): boolean => {
    if (!activeSegmentId) return false;
    if (node.startSegmentId === activeSegmentId) return true;
    if (node.children && Array.isArray(node.children)) {
      return node.children.some((child: any) => containsActiveSegment(child));
    }
    return false;
  };

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const isSelfActive = activeSegmentId === item.startSegmentId;

  return (
    <div className="toc-tree-node-wrapper">
      <div 
        className={`drawer-item toc-tree-item ${isSelfActive ? 'active' : ''}`}
        onClick={() => onSelectTOC(item)}
        style={{
          paddingLeft: `${level * 1.0 + 0.8}rem`,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer'
        }}
      >
        {/* [+] / [−] 折疊按鈕 */}
        {hasChildren ? (
          <button
            type="button"
            className="toc-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(prev => !prev);
            }}
            title={isExpanded ? '收折' : '展開'}
            style={{
              width: '18px',
              height: '18px',
              border: '1px solid var(--reader-border)',
              borderRadius: '3px',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              lineHeight: 1,
              color: 'var(--reader-text)',
              flexShrink: 0,
              padding: 0
            }}
          >
            {isExpanded ? '−' : '+'}
          </button>
        ) : (
          <span style={{ width: '18px', flexShrink: 0 }} />
        )}

        {/* 章節標題 */}
        <span 
          style={{ 
            flexGrow: 1, 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            fontWeight: level === 0 ? '600' : 'normal'
          }}
        >
          {item.title}
        </span>

        {isMultiJuan && (
          <span style={{ fontSize: '0.75rem', opacity: 0.6, flexShrink: 0 }}>
            卷 {item.juan}
          </span>
        )}
      </div>

      {/* 子章節 */}
      {hasChildren && isExpanded && (
        <div className="toc-tree-children">
          {item.children.map((child: any) => (
            <TocTreeNode
              key={child.id}
              item={child}
              level={level + 1}
              activeSegmentId={activeSegmentId}
              currentJuanNum={currentJuanNum}
              workId={workId}
              isMultiJuan={isMultiJuan}
              onSelectTOC={onSelectTOC}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function ReaderView({ 
  workId, 
  initialSegmentId, 
  autoResumeMode,
  settings, 
  onBackToLibrary, 
  onSaveSettings,
  searchQuery
}: ReaderViewProps) {
  const [book, setBook] = useState<ReaderPackage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentJuanNum, setCurrentJuanNum] = useState<number>(1);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  
  // 💡 閱讀時間倒數計時狀態
  const [timerState, setTimerState] = useState<ReadingTimerState>(readingTimer.getState());

  // 💡 按需動態加載教育部標楷體 (Lazy-Load WOFF2)
  useEffect(() => {
    if (settings.fontFamily === 'kaiti') {
      loadEduKaiFontOnDemand();
    }
  }, [settings.fontFamily]);

  useEffect(() => {
    const unsubscribe = readingTimer.subscribe(setTimerState);
    return unsubscribe;
  }, []);

  // UI 覆蓋層（工具列）狀態
  const [showToolbar, setShowToolbar] = useState(true);
  const toolbarTimeoutRef = useRef<number | null>(null);

  // 導航抽屜 (Drawer) 狀態
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [navTab, setNavTab] = useState<'juan' | 'toc'>('toc');
  const [isCopyrightExpanded, setIsCopyrightExpanded] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [showSettingsView, setShowSettingsView] = useState(false);

  // 💡 畫重點相關狀態
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [pendingHighlights, setPendingHighlights] = useState<BookHighlight[]>([]);
  const [activeHighlightForDelete, setActiveHighlightForDelete] = useState<BookHighlight | null>(null);
  const [deleteMenuPosition, setDeleteMenuPosition] = useState<{ top: number; left: number } | null>(null);
  
  // 💡 控制列：畫重點設定浮動選單 (整合筆刷顏色與粗細標註模式)
  const [showHighlightPopover, setShowHighlightPopover] = useState(false);
  // 💡 筆刷畫重點模式狀態 (點進選顏色/粗細時為 true 帶框，再點筆刷時為 false 解除框框可複製內文)
  const [isHighlightMode, setIsHighlightMode] = useState(false);

  // 💡 心得筆記編輯 Modal 狀態
  const [editingNoteHighlight, setEditingNoteHighlight] = useState<BookHighlight | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // 💡 本書內動態關鍵字檢索
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [showInBookSearchModal, setShowInBookSearchModal] = useState(false);
  const [inBookSearchInput, setInBookSearchInput] = useState('');

  // 最終採用的檢索關鍵字 (優先採用閱讀器內部主動搜尋的關鍵字，否則退回外部帶入的 searchQuery)
  const activeSearchQuery = internalSearchQuery.trim() || searchQuery?.trim() || '';

  // 💡 全文檢索跳轉高亮支援
  const renderHighlightedContent = (text: string) => {
    if (!activeSearchQuery) return text;
    const keywords = activeSearchQuery.trim().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return text;

    // 將關鍵字轉義並建立 regex
    const escapedKeywords = keywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');

    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="search-highlight">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // 💡 渲染經文段落，結合括號小註與 DB 畫重點標記，保證 HTML 嵌套安全
  const renderParagraphContent = (text: string, segmentId: string) => {
    // 1. 篩選出目前段落的畫重點資料
    const segHighlights = highlights.filter(
      h => h.segmentId === segmentId && h.juan === currentJuanNum
    );

    // 2. 尋找所有括號小註的索引區間
    const bracketRanges: Array<{ start: number; end: number }> = [];
    const bracketRegex = /（[^）]*）/g;
    let match;
    while ((match = bracketRegex.exec(text)) !== null) {
      bracketRanges.push({ start: match.index, end: bracketRegex.lastIndex });
    }

    // 3. 建立字元狀態陣列，標記每個字元是否為小註、是否被畫重點
    const charStates = Array.from({ length: text.length }, (_, i) => {
      const isNote = bracketRanges.some(r => i >= r.start && i < r.end);
      const hl = segHighlights.find(h => {
        if (i >= h.startOffset && i < h.endOffset) return true;
        // 💡 防護修復：若舊畫重點 offset 因顯示筆記等 UI 元素發生偏差，根據正文內容比對自動校正
        if (h.text && (h.startOffset >= text.length || text.substring(h.startOffset, h.endOffset) !== h.text)) {
          const matchIdx = text.indexOf(h.text);
          if (matchIdx !== -1 && i >= matchIdx && i < matchIdx + h.text.length) {
            return true;
          }
        }
        return false;
      });
      return {
        isNote,
        highlightId: hl ? hl.id : null,
        highlight: hl || null
      };
    });

    // 4. 將相同狀態的連續字元分組為 Runs
    const runs: Array<{ start: number; end: number; isNote: boolean; highlight: BookHighlight | null }> = [];
    if (text.length > 0) {
      let runStart = 0;
      let currentState = charStates[0];
      for (let i = 1; i < text.length; i++) {
        const state = charStates[i];
        if (state.isNote !== currentState.isNote || state.highlightId !== currentState.highlightId) {
          runs.push({
            start: runStart,
            end: i,
            isNote: currentState.isNote,
            highlight: currentState.highlight
          });
          runStart = i;
          currentState = state;
        }
      }
      runs.push({
        start: runStart,
        end: text.length,
        isNote: currentState.isNote,
        highlight: currentState.highlight
      });
    }

    // 5. 渲染成 React Elements
    return (
      <>
        {runs.map((run, idx) => {
          const runText = text.substring(run.start, run.end);
          
          // 全文檢索高亮
          let element: React.ReactNode = renderHighlightedContent(runText);
          
          if (run.isNote) {
            element = (
              <small className="reader-inline-note">
                {element}
              </small>
            );
          }

          if (run.highlight) {
            const colorClass = `hl-color-${run.highlight.color || 'yellow'}`;
            const styleClass = `hl-style-${run.highlight.style || 'bottom-half'}`;
            const hasNote = !!(run.highlight.note && run.highlight.note.trim());
            const showNoteInText = !!settings.customVisibleElements?.showNoteInText;

            element = (
              <React.Fragment key={idx}>
                <mark 
                  className={`reader-text-highlight ${colorClass} ${styleClass}`}
                  data-highlight-id={run.highlight.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHighlightClick(run.highlight!, e);
                  }}
                >
                  {element}
                  {/* 💡 劃重點右側小黃點：100% 精確垂直對齊劃重點第一行文字當行，並緊貼右側邊緣 Bar */}
                  {run.start === run.highlight.startOffset && (
                    <span className="highlight-right-accent-dot" data-reader-ui="true" title="重點位置指示標" />
                  )}
                </mark>
                {hasNote && showNoteInText && (
                  <span 
                    className="reader-ui-note-text"
                    data-reader-ui="true"
                    style={{ 
                      fontSize: '0.68em', 
                      color: 'var(--text-muted, #718096)', 
                      fontFamily: '"Yuanti SC", "YouYuan", "圓體", "Quicksand", sans-serif',
                      fontWeight: 'normal',
                      fontStyle: 'normal',
                      marginLeft: '4px',
                      opacity: 0.85,
                      background: 'none',
                      textDecoration: 'none',
                      display: 'inline-block'
                    }}
                  >
                    ({run.highlight.note})
                  </span>
                )}
              </React.Fragment>
            );
          } else {
            element = <React.Fragment key={idx}>{element}</React.Fragment>;
          }

          return element;
        })}
      </>
    );
  };

  // 校勘側邊欄狀態
  const [selectedNotes, setSelectedNotes] = useState<TextSegment['notes']>(undefined);
  const [selectedNotesTitle, setSelectedNotesTitle] = useState<string>('');

  // 💡 同一經書內「上一個／下一個」檢索定位
  const [matchedSegments, setMatchedSegments] = useState<Array<{ segmentId: string; juan: number }>>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);

  useEffect(() => {
    if (!book || !activeSearchQuery) {
      setMatchedSegments([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const keywords = activeSearchQuery.trim().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) {
      setMatchedSegments([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const matches: Array<{ segmentId: string; juan: number }> = [];
    book.content.juans.forEach((juanData) => {
      juanData.segments.forEach((seg) => {
        // 多關鍵字 AND 檢索
        const isMatch = keywords.every(kw => 
          seg.content.toLowerCase().includes(kw.toLowerCase())
        );
        if (isMatch) {
          matches.push({
            segmentId: seg.id,
            juan: juanData.juan
          });
        }
      });
    });

    setMatchedSegments(matches);

    // 如果從外部跳轉進來，設為對應的 index，否則預設為第一筆 (0)
    if (initialSegmentId) {
      const idx = matches.findIndex(m => m.segmentId === initialSegmentId);
      setCurrentMatchIndex(idx !== -1 ? idx : 0);
    } else if (matches.length > 0) {
      setCurrentMatchIndex(0);
      // 自動滾動至第一筆匹配處
      const firstTarget = matches[0];
      if (firstTarget) {
        if (firstTarget.juan !== currentJuanNum) {
          pendingScrollSegmentIdRef.current = firstTarget.segmentId;
          setCurrentJuanNum(firstTarget.juan);
        } else {
          scrollToSegment(firstTarget.segmentId);
          setActiveSegmentId(firstTarget.segmentId);
        }
      }
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [book, activeSearchQuery, initialSegmentId]);

  const navigateToMatch = (index: number) => {
    const target = matchedSegments[index];
    if (!target) return;

    setCurrentMatchIndex(index);
    setActiveSegmentId(target.segmentId);

    if (target.juan !== currentJuanNum) {
      // 跨卷，由已有的 pendingScrollSegmentIdRef 處理自動滾動
      pendingScrollSegmentIdRef.current = target.segmentId;
      setCurrentJuanNum(target.juan);
    } else {
      // 同一卷直接滾動
      scrollToSegment(target.segmentId);
    }
  };

  const handleNextMatch = () => {
    if (matchedSegments.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchedSegments.length;
    navigateToMatch(nextIdx);
  };

  const handlePrevMatch = () => {
    if (matchedSegments.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matchedSegments.length) % matchedSegments.length;
    navigateToMatch(prevIdx);
  };

  // 💡 計算當前閱讀位置所屬的目次品名，若無目次則 fallback 顯示為卷次
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentMuluTitle = React.useMemo(() => {
    if (!book) return `卷 ${currentJuanNum}`;

    const activeJuan = book.content.juans.find(j => j.juan === currentJuanNum);
    if (!activeJuan) return `卷 ${currentJuanNum}`;

    const savedProgressStr = localStorage.getItem(`reader_progress_${workId}`);
    let currentSegId = '';
    if (savedProgressStr) {
      try {
        const progress = JSON.parse(savedProgressStr);
        if (progress.juan === currentJuanNum && progress.segmentId) {
          currentSegId = progress.segmentId;
        }
      } catch {}
    }
    if (!currentSegId) {
      currentSegId = activeSegmentId || (activeJuan.segments.length > 0 ? activeJuan.segments[0].id : '');
    }

    return getMuluTitleForSegment(book, currentJuanNum, currentSegId);
  }, [book, currentJuanNum, activeSegmentId, workId, scrollPercent]);

  useEffect(() => {
    setIsCopyrightExpanded(false);
  }, [currentJuanNum, workId]);

  // 引用 DOM 節點用於自動滾動與事件偵測
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const segmentsMapRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const pendingScrollSegmentIdRef = useRef<string | null>(null);

  // 跨卷目次跳轉：在卷數切換且 DOM 渲染完成後自動滾動到該品起點 (加入 retry 重試機制防範 DOM 未掛載)
  useEffect(() => {
    if (pendingScrollSegmentIdRef.current) {
      const targetId = pendingScrollSegmentIdRef.current;
      pendingScrollSegmentIdRef.current = null;

      let attempts = 0;
      const tryScroll = () => {
        const el = segmentsMapRef.current[targetId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActiveSegmentId(targetId);
        } else if (attempts < 20) {
          attempts++;
          setTimeout(tryScroll, 50);
        }
      };
      setTimeout(tryScroll, 30);
    }
  }, [currentJuanNum]);
  // 💡 自動儲存點選段落與卷次進度
  useEffect(() => {
    if (book) {
      const progress = {
        juan: currentJuanNum,
        segmentId: activeSegmentId || '',
        percent: scrollPercent, // 💡 儲存百分比
        timestamp: Date.now()
      };
      localStorage.setItem(`reader_progress_${workId}`, JSON.stringify(progress));
      localStorage.setItem('last_read_work_id', workId);
      try {
        const historyStr = localStorage.getItem('recent_read_work_ids');
        let history: string[] = historyStr ? JSON.parse(historyStr) : [];
        history = [workId, ...history.filter(id => id !== workId)].slice(0, 5);
        localStorage.setItem('recent_read_work_ids', JSON.stringify(history));
      } catch {}
    }
  }, [currentJuanNum, activeSegmentId, book, workId, scrollPercent]);
  const {
    isPlaying,
    currentSegmentId: ttsSegmentId,
    play: playTTS,
    stop: stopTTS
  } = useTTS({
    onSegmentChange: (segId) => {
      // 朗讀到新段落時，將該段落滾動到畫面中央
      scrollToSegment(segId);
    },
    speed: settings.ttsSpeed,
    voiceName: settings.ttsVoice,
    pitch: settings.ttsPitch,
    mode: settings.ttsMode
  });

  // 讀取書籍資料
  useEffect(() => {
    const loadBookData = async () => {
      try {
        if (isBackupMode()) {
          // 💡 備援模式下 100% 讀取實時離線鏡像 JSON，不使用與刪除 IndexedDB 舊快取，避免讀者/開發者測試誤判
          deleteBook(workId).catch(() => {});
          const freshBook = await PackageBuilder.downloadAndPackage(
            { workId, title: '', creators: '', juansCount: 1, category: '' },
            (progress: any) => console.log(`[Backup Progress] ${progress.message}`)
          );
          if (freshBook) {
            setBook(freshBook);
            return;
          }
        }

        let bookData = await getBook(workId);
        if (bookData) {
          // 💡 自動清理舊有快取的「CBETA 大藏經 / 電子佛典」作譯者佔位字樣
          if (bookData.metadata) {
            const sanitized = sanitizeCreators(bookData.metadata.creators);
            if (bookData.metadata.creators !== sanitized) {
              bookData.metadata.creators = sanitized;
              await saveBook(bookData).catch(() => {});
            }
          }

          // 💡 權威字數、冊別與部類自動校勘 (全面對齊 CBETA 官方權威資料)
          const featBook = FEATURED_BOOKS.find(b => b.workId === workId);
          if (featBook) {
            let needsSave = false;
            if (featBook.cjkChars && featBook.cjkChars > 0 && bookData.metadata.cjkChars !== featBook.cjkChars) {
              bookData.metadata.cjkChars = featBook.cjkChars;
              needsSave = true;
            }
            if (featBook.vol && !bookData.metadata.vol) {
              bookData.metadata.vol = featBook.vol;
              needsSave = true;
            }
            if (featBook.category && !bookData.metadata.category) {
              bookData.metadata.category = featBook.category;
              needsSave = true;
            }
            if (needsSave) {
              await saveBook(bookData).catch(() => {});
            }
          }

          // 💡 自動檢測：本地書的 TOC 是否包含重複綁定在同一個 seg0001 的舊版無效導航鏈結
          const hasInvalidTocLinks = (() => {
            if (!bookData.toc || !bookData.toc.items || bookData.toc.items.length <= 1) return false;
            const segIds = bookData.toc.items.map((i: any) => i.startSegmentId).filter(Boolean);
            if (segIds.length <= 2) return false;
            const uniqueSegIds = new Set(segIds);
            return uniqueSegIds.size === 1 || uniqueSegIds.size < Math.min(3, segIds.length);
          })();

          if (hasInvalidTocLinks && bookData.content) {
            console.log(`[ReaderView] Book ${workId} has old invalid TOC links. Rebuilding navigation tree with title matching...`);
            const { toc, navigation } = NavigationBuilder.buildNavigation(workId, bookData.content, []);
            bookData = {
              ...bookData,
              toc,
              navigation
            };
            await saveBook(bookData);
          }

          // 💡 核心極速體驗：只要本地已有經書，立即 0 秒開書！絕不因版號更新或網路延遲阻斷開書
          setBook(bookData);

          // 💡 全自動背景目次修復與經文修復邏輯
          const needsTocFix = !bookData.toc || !bookData.toc.items || bookData.toc.items.length === 0 || 
                              (bookData.toc.items.length > 0 && bookData.toc.items[0].title === '第 1 卷');
          const hasFallbackContent = bookData.content.juans.some(j => 
            j.segments.some(s => s.content.includes('經文預設段落'))
          );
          const isOutdatedVersion = !bookData.metadata.version || bookData.metadata.version !== BUILDER_VERSION;

          if (hasFallbackContent || needsTocFix || isOutdatedVersion) {
            try {
              console.log(`[AutoHeal] Book ${workId} needs refresh. Auto-healing real text in background...`);
              const safeJuansCount = (bookData.metadata.juansCount && bookData.metadata.juansCount > 0)
                ? bookData.metadata.juansCount 
                : (bookData.content.juans.length > 0 ? bookData.content.juans.length : 1);
              
              let fetchedContent: BookContent | null = null;
              let fetchedRawToc: any[] = [];

              // 1. 優先嘗試讀取本地 pre-built mock 經典檔案（如 /mock/T0779.json, /mock/T0251.json, /mock/T0412.json, /mock/T0262.json）
              try {
                const mockRes = await fetch(`/mock/${workId}.json`);
                if (mockRes.ok) {
                  const mockData = await mockRes.json();
                  if (mockData && mockData.content && mockData.content.juans && mockData.content.juans.length > 0) {
                    fetchedContent = mockData.content;
                    fetchedRawToc = mockData.rawToc || [];
                  }
                }
              } catch {}

              // 2. 若無本地 mock 且需更新，向 CBETA 發起線上抓取
              if (!fetchedContent) {
                const { ReaderBuilder } = await import('../../builder/ReaderBuilder');
                const { content, rawToc } = await ReaderBuilder.buildContent(workId, safeJuansCount);
                fetchedContent = content;
                fetchedRawToc = rawToc;
              }

              // 💡 3. 關鍵數據保護安全防護：如果抓取結果為預設占位文字，絕不蓋掉原本資料！
              const fetchedHasFallback = fetchedContent.juans.some((j: JuanData) => 
                j.segments.some((s: TextSegment) => s.content.includes('經文預設段落'))
              );

              if (fetchedHasFallback) {
                console.warn(`[AutoHeal] Fetched content for ${workId} still has fallback placeholder. Aborting save to protect existing data!`);
                return;
              }

              // 4. 取得真實完整正文，安全更新 IndexedDB 並渲染畫面
              const { toc, navigation } = NavigationBuilder.buildNavigation(workId, fetchedContent, fetchedRawToc);
              const updatedBook: ReaderPackage = {
                ...bookData,
                content: fetchedContent,
                toc,
                navigation,
                metadata: {
                  ...bookData.metadata,
                  juansCount: fetchedContent.juans.length,
                  version: BUILDER_VERSION
                }
              };
              await saveBook(updatedBook);
              setBook(updatedBook);
              console.log(`[AutoHeal] Successfully auto-healed real content for ${workId}`);
            } catch (err) {
              console.warn('[AutoHeal] Background refresh failed, keeping current local content:', err);
              setBook(bookData);
            }
          }
          
          // 如果有傳入特定跳轉段落
          if (initialSegmentId) {
            // 解析出段落屬於哪一卷 (T0412_01_seg0002 -> 01)
            const parts = initialSegmentId.split('_');
            if (parts.length >= 2) {
              const juan = parseInt(parts[1], 10);
              setCurrentJuanNum(juan);
            }
            // 延遲跳轉以確保 DOM 已經渲染完成
            setTimeout(() => {
              scrollToSegment(initialSegmentId);
              setActiveSegmentId(initialSegmentId);
            }, 300);
          } else {
            // 💡 依據「每次經文開啟時自動回到上次閱讀位置」設定進行無感自動導航 (免彈窗打擾)
            const shouldAutoResume = (autoResumeMode === 'resume') || 
              (autoResumeMode !== 'restart' && (settings.customVisibleElements?.autoResumeProgress ?? true));

            if (shouldAutoResume) {
              const savedProgressStr = localStorage.getItem(`reader_progress_${workId}`);
              if (savedProgressStr) {
                try {
                  const progress = JSON.parse(savedProgressStr);
                  const targetJuan = progress.juan || 1;
                  setCurrentJuanNum(targetJuan);
                  if (progress.segmentId) {
                    setTimeout(() => {
                      scrollToSegment(progress.segmentId);
                      setActiveSegmentId(progress.segmentId);
                    }, 350);
                  }
                } catch (err) {
                  console.warn('Failed to parse saved progress for auto resume:', err);
                  setCurrentJuanNum(1);
                }
              } else {
                setCurrentJuanNum(1);
              }
            } else {
              // 💡 未勾選或手動選擇從頭開始：直接從第 1 卷開頭閱讀
              setCurrentJuanNum(1);
            }
          }
        } else {
          // 💡 若 IndexedDB 中尚無此經書數據（如直接點擊未下載的經典或剛重置快取），線上動態構建並渲染經典
          console.log(`[ReaderView] Book ${workId} not found in IndexedDB. Building package...`);
          let bookTitle = workId;
          try {
            const { ReferenceBuilder } = await import('../../builder/ReferenceBuilder');
            const { SearchIndexBuilder } = await import('../../builder/SearchIndexBuilder');
            const { AIIndexBuilder } = await import('../../builder/AIIndexBuilder');

            const searchRes = await IndexBuilder.searchTitle(workId).catch(() => []);
            const targetMeta = searchRes && searchRes.length > 0 ? searchRes[0] : null;
            const juansCount = targetMeta?.juansCount || 1;
            const title = targetMeta?.title || workId;
            bookTitle = title;
            const creators = sanitizeCreators(targetMeta?.creators);

            const { ReaderBuilder } = await import('../../builder/ReaderBuilder');
            const res = await ReaderBuilder.buildContent(workId, juansCount);
            const content = res.content;
            const rawToc = res.rawToc;

            const { toc, navigation } = NavigationBuilder.buildNavigation(workId, content, rawToc);
            const reference = ReferenceBuilder.buildReference(workId);
            const searchIndex = SearchIndexBuilder.buildSearchIndex(content, toc);
            const embedding = await AIIndexBuilder.buildAIIndex(content);

            const newBook: ReaderPackage = {
              metadata: {
                workId,
                title,
                canon: workId.charAt(0),
                creators,
                category: targetMeta?.category || 'CBETA',
                juansCount: content.juans.length,
                packagedAt: new Date().toISOString(),
                version: BUILDER_VERSION
              },
              content,
              toc,
              navigation,
              reference,
              searchIndex,
              embedding
            };

            await saveBook(newBook);
            setBook(newBook);
            setLoadError(null);
            setCurrentJuanNum(1);
            console.log(`[ReaderView] Successfully built and loaded package for ${workId}`);
          } catch (buildErr: any) {
            console.error(`[ReaderView] Failed to build package on-the-fly for ${workId}:`, buildErr);
            setLoadError(buildErr?.message || `無法載入《${bookTitle}》經文。本 App 堅持 100% CBETA 原文正統，絕不提供任何簡化或摘要內容。請檢查網路連線後重試。`);
          }
        }
      } catch (e: any) {
        console.error('Failed to load book content:', e);
        setLoadError(e?.message || `載入經文發生錯誤，請檢查網路連線或重試。`);
      }
    };

    loadBookData();
    resetToolbarTimeout();

    return () => {
      if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
      stopTTS();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId, initialSegmentId]);

  // 💡 載入此書的所有畫重點記錄
  const loadBookHighlights = async () => {
    try {
      const list = await listHighlights(workId);
      setHighlights(list);
    } catch (e) {
      console.error('Failed to load highlights:', e);
    }
  };

  useEffect(() => {
    loadBookHighlights();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId]);



  // 💡 Helper: 取得 DOM 節點/Fragment 扣除 UI 覆蓋元件 (如筆記內容、頁碼標籤) 後的真實經文正文文字
  const getPureTextFromNodeOrFrag = (nodeOrFrag: Node): string => {
    const clone = nodeOrFrag.cloneNode(true);
    if (clone instanceof Element || clone instanceof DocumentFragment) {
      clone.querySelectorAll('[data-reader-ui="true"]').forEach(el => el.remove());
      if (clone instanceof Element && clone.getAttribute('data-reader-ui') === 'true') {
        return '';
      }
    }
    return clone.textContent || '';
  };

  // 💡 計算選取 Range 涵蓋的所有段落與劃線資料（支援單段落與跨段落全選）
  const calculateHighlightsFromRange = (range: Range): BookHighlight[] => {
    const container = range.commonAncestorContainer;
    const root = container.nodeType === Node.ELEMENT_NODE 
      ? (container as HTMLElement) 
      : container.parentElement;
    if (!root) return [];

    let segments: HTMLElement[] = [];
    if (root.classList.contains('reader-paragraph')) {
      segments = [root];
    } else {
      const all = Array.from(root.querySelectorAll<HTMLElement>('.reader-paragraph'));
      segments = all.filter(el => {
        try {
          return range.intersectsNode(el);
        } catch {
          return false;
        }
      });
      if (segments.length === 0) {
        let p: HTMLElement | null = root;
        while (p) {
          if (p.classList.contains('reader-paragraph')) {
            segments = [p];
            break;
          }
          p = p.parentElement;
        }
      }
    }

    if (segments.length === 0) return [];

    const results: BookHighlight[] = [];

    segments.forEach((segEl, index) => {
      const segmentId = segEl.getAttribute('data-segment-id');
      if (!segmentId) return;

      // 💡 取得段落中真實經文純文字 (過濾掉「顯示筆記內容」等 UI 注入節點)
      const segText = getPureTextFromNodeOrFrag(segEl);
      if (!segText) return;

      let startOffset = 0;
      let endOffset = segText.length;

      if (segments.length === 1) {
        const preRange = range.cloneRange();
        preRange.selectNodeContents(segEl);
        preRange.setEnd(range.startContainer, range.startOffset);
        startOffset = getPureTextFromNodeOrFrag(preRange.cloneContents()).length;

        const selRange = range.cloneRange();
        selRange.setStart(range.startContainer, range.startOffset);
        selRange.setEnd(range.endContainer, range.endOffset);
        const selLength = getPureTextFromNodeOrFrag(selRange.cloneContents()).length;

        endOffset = startOffset + selLength;
      } else {
        if (index === 0) {
          const preRange = range.cloneRange();
          preRange.selectNodeContents(segEl);
          preRange.setEnd(range.startContainer, range.startOffset);
          startOffset = getPureTextFromNodeOrFrag(preRange.cloneContents()).length;
          endOffset = segText.length;
        } else if (index === segments.length - 1) {
          startOffset = 0;
          const endRange = range.cloneRange();
          endRange.selectNodeContents(segEl);
          endRange.setEnd(range.endContainer, range.endOffset);
          endOffset = getPureTextFromNodeOrFrag(endRange.cloneContents()).length;
        } else {
          startOffset = 0;
          endOffset = segText.length;
        }
      }

      if (endOffset > startOffset) {
        const text = segText.substring(startOffset, endOffset);
        if (text.trim()) {
          results.push({
            id: `${workId}_${currentJuanNum}_${segmentId}_${startOffset}_${endOffset}`,
            workId,
            juan: currentJuanNum,
            segmentId,
            startOffset,
            endOffset,
            text,
            createdAt: Date.now(),
            color: settings.highlightColor,
            style: settings.highlightStyle
          });
        }
      }
    });

    return results;
  };

  // 監聽全局選取事件，暫存選取區間
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPendingHighlights([]);
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      if (!selectedText) {
        setPendingHighlights([]);
        return;
      }

      const hls = calculateHighlightsFromRange(range);
      setPendingHighlights(hls);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId, currentJuanNum]);



  // 💡 監聽內文框選文字手勢結束動作 (pointerup/mouseup/touchend)，自動套用設定好的筆刷模式劃線！
  useEffect(() => {
    let timer: any = null;
    const handleGestureEnd = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('.reader-overlay-bar') ||
        target?.closest('.reader-popover') ||
        target?.closest('.highlight-popover-container') ||
        target?.closest('.highlight-delete-menu') ||
        target?.closest('.notes-floating-toolbar') ||
        target?.closest('.note-edit-modal-card') ||
        target?.closest('.inbook-search-modal-card')
      ) {
        return;
      }

      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const selectedText = selection.toString().trim();
        if (!selectedText) return;

        // 💡 只有在讀者開啟「筆刷畫重點模式 (isHighlightMode)」時，才自動儲存劃重點
        // 若未開啟筆刷模式，則不劃重點、不清除選取狀態，讓讀者可以自由複製經文
        if (!isHighlightMode) {
          return;
        }

        const range = selection.getRangeAt(0);
        const hls = calculateHighlightsFromRange(range);

        if (hls.length > 0) {
          try {
            for (const newHl of hls) {
              await saveHighlight({
                ...newHl,
                color: settings.highlightColor || 'yellow',
                style: settings.highlightStyle || 'bottom-half',
                createdAt: Date.now()
              });
            }
            window.getSelection()?.removeAllRanges();
            setPendingHighlights([]);
            await loadBookHighlights();
          } catch (err) {
            console.error('Failed to auto create highlight on selection end:', err);
          }
        }
      }, 120);
    };

    document.addEventListener('pointerup', handleGestureEnd);
    document.addEventListener('mouseup', handleGestureEnd);
    document.addEventListener('touchend', handleGestureEnd);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('pointerup', handleGestureEnd);
      document.removeEventListener('mouseup', handleGestureEnd);
      document.removeEventListener('touchend', handleGestureEnd);
    };
  }, [workId, currentJuanNum, settings.highlightColor, settings.highlightStyle, isHighlightMode]);

  // 監聽全局點擊事件，點擊空白處時隱藏畫重點選單與刪除選單
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.highlight-popover-container')) {
        setShowHighlightPopover(false);
      }
      if (!target.closest('.reader-text-highlight') && !target.closest('.highlight-delete-menu')) {
        setActiveHighlightForDelete(null);
        setDeleteMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('touchstart', handleGlobalClick);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick);
    };
  }, []);

  const handleHighlightClick = (hl: BookHighlight, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setActiveHighlightForDelete(hl);
    setDeleteMenuPosition({
      top: Math.max(10, rect.top - 46),
      left: rect.left + rect.width / 2
    });
  };

  // 💡 自動將目前在內文框選的文字劃記為重點 (套用指定的顏色與標註模式)
  const applyHighlightToCurrentSelection = async (
    targetColor: 'yellow' | 'red' | 'blue' | 'gray',
    targetStyle: 'underline' | 'bottom-half' | 'full' | 'border'
  ) => {
    let targetHls: BookHighlight[] = pendingHighlights;
    
    // 如果 pendingHighlights 尚未捕捉，從當前 DOM selection 即時取得
    const selection = window.getSelection();
    if ((!targetHls || targetHls.length === 0) && selection && !selection.isCollapsed) {
      const selectedText = selection.toString().trim();
      if (selectedText) {
        const range = selection.getRangeAt(0);
        const calculated = calculateHighlightsFromRange(range);
        if (calculated.length > 0) {
          targetHls = calculated;
        }
      }
    }

    if (targetHls && targetHls.length > 0) {
      try {
        for (const hl of targetHls) {
          await saveHighlight({
            ...hl,
            color: targetColor,
            style: targetStyle,
            createdAt: Date.now()
          });
        }
        window.getSelection()?.removeAllRanges();
        setPendingHighlights([]);
        await loadBookHighlights();
      } catch (err) {
        console.error('Failed to auto-apply highlight on color/style select:', err);
      }
    }
  };

  const handleSelectHighlightColor = async (color: 'yellow' | 'red' | 'blue' | 'gray') => {
    const newSettings = { ...settings, highlightColor: color };
    onSaveSettings(newSettings);
    await applyHighlightToCurrentSelection(color, settings.highlightStyle || 'bottom-half');
  };

  const handleSelectHighlightStyle = async (style: 'underline' | 'bottom-half' | 'full' | 'border') => {
    const newSettings = { ...settings, highlightStyle: style };
    onSaveSettings(newSettings);
    await applyHighlightToCurrentSelection(settings.highlightColor || 'yellow', style);
  };



  const handleDeleteHighlight = async () => {
    if (!activeHighlightForDelete) return;
    const targetHl = activeHighlightForDelete;
    setActiveHighlightForDelete(null);
    setDeleteMenuPosition(null);
    try {
      await deleteHighlight(targetHl.id);
      await loadBookHighlights();
    } catch (err) {
      console.error('Failed to delete highlight:', err);
    }
  };

  const handleOpenNoteEditor = (hl: BookHighlight) => {
    setActiveHighlightForDelete(null);
    setDeleteMenuPosition(null);
    setEditingNoteHighlight(hl);
    setEditingNoteText(hl.note || '');
  };

  const handleSaveNote = async () => {
    if (!editingNoteHighlight) return;
    const updated: BookHighlight = {
      ...editingNoteHighlight,
      note: editingNoteText.trim()
    };
    try {
      await saveHighlight(updated);
      await loadBookHighlights();
      setEditingNoteHighlight(null);
      setEditingNoteText('');
    } catch (err) {
      console.error('Failed to save highlight note:', err);
    }
  };

  // 當「顯示閱讀頁上下控制列」設定變更時，即時同步工具列狀態
  useEffect(() => {
    if (settings.customVisibleElements?.showReaderControls) {
      // 勾選→永遠顯示，清除自動隱藏計時器
      if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
      setShowToolbar(true);
    } else {
      // 取消勾選→恢復原本自動隱藏行為，頂部先顯示 4 秒
      setShowToolbar(true);
      resetToolbarTimeout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.customVisibleElements?.showReaderControls]);



  // 監聽鍵盤與手勢，隱藏工具列
  const resetToolbarTimeout = () => {
    // 勾選「永遠顯示控制列」時，不需計時，學工具列始終可見
    if (settings.customVisibleElements?.showReaderControls) {
      setShowToolbar(true);
      return;
    }
    if (!settings.autoHideToolbar) {
      setShowToolbar(true);
      return;
    }
    if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
    
    toolbarTimeoutRef.current = window.setTimeout(() => {
      // 只有在導航抽屎或校勘面板未開啟時，才自動隱藏工具列
      if (!showNavDrawer && !selectedNotes) {
        setShowToolbar(false);
      }
    }, 4000); // 4秒後無操作自動隱藏
  };


  // 💡 點選經文排版內文區或全版面處（含段落文字與空白處）：切換上下控制列的顯示/隱藏 (若正在劃線選字則不切換)
  const handleContentAreaClick = (e: React.MouseEvent) => {
    // 💡 勾選「顯示閱讀頁上下控制列」時，上下控制列始終保持顯示，點擊不隱藏
    if (settings.customVisibleElements?.showReaderControls) {
      if (showNavDrawer) setShowNavDrawer(false);
      if (showHighlightPopover) setShowHighlightPopover(false);
      return;
    }

    // 💡 若側邊欄抽屜開啟，自動收合隱藏
    if (showNavDrawer) {
      setShowNavDrawer(false);
      return;
    }
    // 若劃重點浮動選單開啟，點擊時關閉
    if (showHighlightPopover) {
      setShowHighlightPopover(false);
    }
    // 若點擊的是按鈕、輸入框、筆記或劃線刪除選單、浮動控制列等，不切換控制列
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('input') || 
      target.closest('textarea') || 
      target.closest('.highlight-delete-menu') || 
      target.closest('.search-dialog-card') ||
      target.closest('.reader-nav-drawer') ||
      target.closest('.settings-dialog') ||
      target.closest('.reader-floating-bottom-bar') ||
      target.closest('.reader-top-bar')
    ) {
      return;
    }
    // 檢查是否有正在選取的文字（劃線中），若無選取文字，切換上下控制列顯示/隱藏
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) {
      setShowToolbar(prev => !prev);
      if (!showToolbar) {
        resetToolbarTimeout();
      }
    }
  };

  // 滾動到特定經文段落
  const scrollToSegment = (segmentId: string) => {
    const el = segmentsMapRef.current[segmentId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // 跳轉卷次
  const handleSelectJuan = (juanNum: number) => {
    setCurrentJuanNum(juanNum);
    setShowNavDrawer(false);
    // 滾動到第一段
    setTimeout(() => {
      const juanData = book?.content.juans.find(j => j.juan === juanNum);
      if (juanData && juanData.segments.length > 0) {
        scrollToSegment(juanData.segments[0].id);
      }
    }, 100);
    resetToolbarTimeout();
  };

  // 跳轉品名 (TOC)
  const handleSelectTOC = (tocItem: any) => {
    const getTargetSegmentId = (node: any): string => {
      if (node.startSegmentId) return node.startSegmentId;
      if (node.children && Array.isArray(node.children) && node.children.length > 0) {
        for (const child of node.children) {
          const segId = getTargetSegmentId(child);
          if (segId) return segId;
        }
      }
      return '';
    };

    const targetSegId = getTargetSegmentId(tocItem);
    if (!targetSegId) return;

    setShowNavDrawer(false);
    setActiveSegmentId(targetSegId);
    resetToolbarTimeout();

    // 💡 核心極速修復：從 targetSegId 中精確解析出所屬卷號 (例: T0412_02_seg0001 -> 卷 2)
    let targetJuan = tocItem.juan;
    const parts = targetSegId.split('_');
    if (parts.length >= 2) {
      const parsedJuan = parseInt(parts[1], 10);
      if (!isNaN(parsedJuan) && parsedJuan > 0) {
        targetJuan = parsedJuan;
      }
    }
    if (!targetJuan) targetJuan = currentJuanNum;

    if (targetJuan === currentJuanNum) {
      let attempts = 0;
      const tryScroll = () => {
        const el = segmentsMapRef.current[targetSegId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (attempts < 15) {
          attempts++;
          setTimeout(tryScroll, 40);
        }
      };
      setTimeout(tryScroll, 30);
    } else {
      // 跨卷：記錄待跳轉段落 ID，重置滾動位置，切換卷數，由 useEffect 處理自動滾動
      if (contentAreaRef.current) {
        contentAreaRef.current.scrollTop = 0;
      }
      pendingScrollSegmentIdRef.current = targetSegId;
      setCurrentJuanNum(targetJuan);
    }
  };

  // 啟動語音朗讀
  const handleStartTTS = () => {
    if (!book) return;
    
    // 蒐集目前卷次的所有經文段落文字
    const juanData = book.content.juans.find(j => j.juan === currentJuanNum);
    if (!juanData) return;

    const ttsPlaylist = juanData.segments.map(seg => ({
      id: seg.id,
      text: seg.content.replace(/（[^）]*）/g, '')
    }));

    // 尋找開始的段落
    let startIndex = 0;
    if (activeSegmentId) {
      const index = juanData.segments.findIndex(s => s.id === activeSegmentId);
      if (index !== -1) startIndex = index;
    }

    playTTS(ttsPlaylist, startIndex);
  };

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleToggleTTS = () => {
    if (isPlaying) {
      stopTTS();
    } else {
      handleStartTTS();
    }
  };

  const handleScroll = () => {
    // 💡 滑動或滾動內文時，若側邊欄抽屜開啟，自動收合隱藏
    if (showNavDrawer) {
      setShowNavDrawer(false);
    }
    const el = contentAreaRef.current;
    if (!el) return;
    const totalHeight = el.scrollHeight - el.clientHeight;
    if (totalHeight <= 0) {
      setScrollPercent(0);
      return;
    }

    // 💡 滾動時靜默自動記錄當前最頂端可見的段落進度
    if (book) {
      const juanData = book.content.juans.find(j => j.juan === currentJuanNum);
      if (juanData) {
        const containerRect = el.getBoundingClientRect();
        // 💡 視線焦點基準線設定為螢幕上方 35% 處，當下一章節滾動越過此線時，進度條會立即切換品名，極度符合直覺
        const triggerLine = containerRect.top + containerRect.height * 0.35;
        let visibleSegId = '';
        let visibleSegIdx = -1;

        for (let i = 0; i < juanData.segments.length; i++) {
          const seg = juanData.segments[i];
          const segEl = segmentsMapRef.current[seg.id];
          if (segEl) {
            const rect = segEl.getBoundingClientRect();
            if (rect.bottom > triggerLine) {
              visibleSegId = seg.id;
              visibleSegIdx = i;
              break;
            }
          }
        }

        if (visibleSegId && visibleSegIdx !== -1) {
          // 💡 計算該段落在當前品/目次內部的精確百分比進度
          let calculatedPercent = 0;
          
          if (!book.toc || !book.toc.items || book.toc.items.length === 0) {
            // 無目次：fallback 使用整卷物理百分比
            calculatedPercent = Math.round((visibleSegIdx / (juanData.segments.length - 1)) * 100);
          } else {
            const juanTocs = book.toc.items
              .filter((item: any) => item.juan === currentJuanNum)
              .map((item: any) => {
                const startIdx = juanData.segments.findIndex(s => s.id === item.startSegmentId);
                return {
                  title: item.title,
                  startIdx: startIdx !== -1 ? startIdx : 0
                };
              })
              .sort((a: any, b: any) => a.startIdx - b.startIdx);

            if (juanTocs.length === 0) {
              // 本卷無目錄項目，fallback 使用整卷物理百分比
              calculatedPercent = Math.round((visibleSegIdx / (juanData.segments.length - 1)) * 100);
            } else {
              // 尋找當前段落所屬的 TOC 目錄項
              let matchedTocIdx = -1;
              for (let i = 0; i < juanTocs.length; i++) {
                if (visibleSegIdx >= juanTocs[i].startIdx) {
                  matchedTocIdx = i;
                } else {
                  break;
                }
              }

              if (matchedTocIdx === -1) {
                calculatedPercent = Math.round((visibleSegIdx / (juanData.segments.length - 1)) * 100);
              } else {
                const startIdx = juanTocs[matchedTocIdx].startIdx;
                const endIdx = (matchedTocIdx + 1 < juanTocs.length)
                  ? juanTocs[matchedTocIdx + 1].startIdx - 1
                  : juanData.segments.length - 1;

                const totalSegs = endIdx - startIdx + 1;
                const relativeIdx = visibleSegIdx - startIdx;

                calculatedPercent = totalSegs <= 1 
                  ? 100 
                  : Math.round((relativeIdx / (totalSegs - 1)) * 100);
              }
            }
          }

          // 限制百分比在 0 ~ 100
          calculatedPercent = Math.max(0, Math.min(100, calculatedPercent));
          setScrollPercent(calculatedPercent);

          const progress = {
            juan: currentJuanNum,
            segmentId: visibleSegId,
            percent: calculatedPercent, // 💡 儲存品內百分比
            timestamp: Date.now()
          };
          localStorage.setItem(`reader_progress_${workId}`, JSON.stringify(progress));
        }
      }
    }
  };

  // 點選經文段落（一般或學術模式）
  const handleSegmentClick = (seg: TextSegment) => {
    setActiveSegmentId(seg.id);
  };

  if (!book) {
    return (
      <div 
        className={`reader-container theme-${settings.theme} animate-fade-in`} 
        style={{ 
          display: 'flex', 
          flexDirection: 'column',
          height: '100%', 
          width: '100%', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'var(--reader-text, #333)', 
          background: 'var(--reader-bg, #fdfbf7)',
          gap: '1.2rem',
          padding: '2rem',
          textAlign: 'center'
        }}
      >
        {loadError ? (
          <>
            <AlertCircle size={40} style={{ color: '#bd3a3a' }} />
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', color: 'var(--text-primary)', margin: 0, maxWidth: '420px', lineHeight: 1.6 }}>
              {loadError}
            </p>
            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
              <button 
                className="batch-btn batch-btn-primary"
                onClick={() => {
                  setLoadError(null);
                  window.location.reload();
                }}
                style={{ fontSize: '0.85rem', padding: '0.4rem 1rem', borderRadius: '16px' }}
              >
                重新嘗試連線
              </button>
              <button 
                className="batch-btn batch-btn-secondary"
                onClick={() => onBackToLibrary(true)}
                style={{ fontSize: '0.85rem', padding: '0.4rem 1rem', borderRadius: '16px' }}
              >
                返回書架
              </button>
            </div>
          </>
        ) : (
          <>
            <div 
              className="loading-spinner"
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(140, 75, 39, 0.15)',
                borderTopColor: 'var(--theme-accent, #8b7355)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}
            />
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', color: 'var(--text-primary)', margin: 0 }}>
              經典載入中，請稍候...
            </p>
            <button 
              className="batch-btn batch-btn-secondary"
              onClick={() => onBackToLibrary(true)}
              style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem', marginTop: '0.5rem', borderRadius: '16px', opacity: 0.85 }}
            >
              返回書架
            </button>
          </>
        )}
      </div>
    );
  }

  // 💡 套用 Reading Settings 對內文左右留白、字體大小、行高與內文字體 (加入 CBETASupplement 自動補缺字)
  const getBodyFontFamily = (fontFamily?: string) => {
    switch (fontFamily) {
      case 'jhenghei':
        return '"Microsoft JhengHei", "PingFang TC", "STHeiti", "Heiti TC", "Noto Sans TC", "CBETASupplement", sans-serif';
      case 'iansui':
        return '"Iansui", "Klee One", "CBETASupplement", serif';
      case 'kaiti':
      case 'iansui-bold':
      case 'iansui-zy':
      case 'wenkai':
      case 'yuanti':
      case 'fangsong':
        return '"CBETASupplement", "標楷體", "BiauKai", "DFKai-SB", "TW-Kai", "STKaiti", "KaiTi", serif';
      case 'default':
      default:
        return 'var(--font-serif)';
    }
  };

  const paddingStyle = {
    '--reader-padding': `${settings.padding}%`,
    '--reader-font-size': `${settings.fontSize}px`,
    '--reader-line-height': settings.lineHeight,
    '--reader-body-font': getBodyFontFamily(settings.fontFamily),
    '--reader-body-weight': settings.fontFamily === 'iansui-bold' ? '700' : 'normal'
  } as React.CSSProperties;

  const activeJuan = book.content.juans.find(j => j.juan === currentJuanNum);

  return (
    <div 
      className={`reader-container theme-${settings.theme}`} 
      style={paddingStyle}
      onMouseMove={resetToolbarTimeout}
    >
      
      {/* 頂部工具列 */}
      <div className={`reader-overlay-bar reader-top-bar ${showToolbar ? 'visible' : 'hidden'}`}>
        <button className="library-header-btn" onClick={() => onBackToLibrary(true)} title="首頁">
          <Home size={20} />
        </button>

        <div className="control-divider" />

        <button className="library-header-btn" onClick={() => onBackToLibrary(false)} title="返回上一頁">
          <ArrowLeft size={20} />
        </button>



        {/* 💡 畫重點設定按鈕 (整合筆刷顏色與粗細標註模式為單一按鍵) */}
        {(() => {
          const colorHex = 
            settings.highlightColor === 'yellow' ? '#fbbf24' :
            settings.highlightColor === 'red' ? '#f87171' :
            settings.highlightColor === 'gray' ? '#9ca3af' : '#60a5fa';

          const currentRgba = 
            settings.highlightColor === 'yellow' ? 'rgba(250, 204, 21, 0.65)' :
            settings.highlightColor === 'red' ? 'rgba(248, 113, 113, 0.65)' :
            settings.highlightColor === 'gray' ? 'rgba(156, 163, 175, 0.65)' : 'rgba(96, 165, 250, 0.65)';

          const getIndicatorStyle = (): React.CSSProperties => {
            const currentStyle = settings.highlightStyle || 'bottom-half';
            switch (currentStyle) {
              case 'underline':
                return {
                  position: 'absolute',
                  bottom: '2px',
                  width: '14px',
                  height: '3px',
                  borderRadius: '1.5px',
                  backgroundColor: colorHex,
                  boxSizing: 'border-box'
                };
              case 'bottom-half':
                return {
                  position: 'absolute',
                  bottom: '2px',
                  width: '16px',
                  height: '7px',
                  borderRadius: '2px',
                  backgroundColor: colorHex,
                  opacity: 0.85,
                  boxSizing: 'border-box'
                };
              case 'full':
                return {
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '26px',
                  height: '26px',
                  borderRadius: '5px',
                  backgroundColor: colorHex,
                  opacity: 0.45,
                  boxSizing: 'border-box',
                  zIndex: 1
                };
              case 'border':
                return {
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '26px',
                  height: '26px',
                  borderRadius: '5px',
                  border: `2.2px solid ${colorHex}`,
                  backgroundColor: 'transparent',
                  boxSizing: 'border-box',
                  zIndex: 1
                };
            }
          };

          return (
            <div className="highlight-popover-container" style={{ position: 'relative' }}>
              <button 
                className={`reader-text-btn highlight-btn ${isHighlightMode ? 'active' : ''}`}
                onClick={() => {
                  if (isHighlightMode) {
                    // 💡 當讀者再次點擊「筆刷」時，解除框框，關閉畫重點模式，此時可以自由複製內文
                    setIsHighlightMode(false);
                    setShowHighlightPopover(false);
                  } else {
                    // 💡 點擊「筆刷」開啟畫重點模式並彈出顏色/粗細選單
                    setIsHighlightMode(true);
                    setShowHighlightPopover(true);
                  }
                }}
                title={isHighlightMode ? "畫重點模式中 (點擊解除框框，可複製內文)" : "開啟畫重點模式 (選顏色/粗細)"}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 0.4rem',
                  position: 'relative',
                  borderRadius: '6px',
                  height: '32px'
                }}
              >
                <Paintbrush 
                  size={20} 
                  style={{
                    color: 'currentColor',
                    zIndex: 2
                  }}
                />
                <div className="brush-color-indicator" style={getIndicatorStyle()} />
              </button>

              {showHighlightPopover && (
                <div 
                  className="reader-popover animate-fade-in"
                  style={{
                    padding: '0.6rem 0.7rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  {/* 左右兩欄佈局：左欄顏色、右欄標註模式 */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>

                    {/* 左欄：4 個筆刷顏色 (縱向排列) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      {(['yellow', 'red', 'blue', 'gray'] as const).map(c => {
                        const cHex = c === 'yellow' ? '#fbbf24' : c === 'red' ? '#f87171' : c === 'blue' ? '#60a5fa' : '#9ca3af';
                        const isSelected = settings.highlightColor === c;

                        return (
                          <div
                            key={c}
                            onClick={() => handleSelectHighlightColor(c)}
                            title={c === 'yellow' ? '淺黃' : c === 'red' ? '淺紅' : c === 'blue' ? '淺藍' : '淺灰'}
                            style={{
                              width: '40px',
                              height: '26px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                          >
                            <div 
                              className={`popover-color-dot ${isSelected ? 'selected' : ''}`}
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: cHex,
                                border: isSelected ? '2px solid var(--theme-accent, #8c4b27)' : '1.5px solid rgba(0,0,0,0.18)',
                                boxShadow: isSelected ? '0 0 0 2.5px rgba(140, 75, 39, 0.25)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'transform 0.15s, box-shadow 0.15s',
                                transform: isSelected ? 'scale(1.15)' : 'scale(1)'
                              }}
                            >
                              {isSelected && (
                                <span style={{ fontSize: '0.6rem', fontWeight: 'bold', color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.5)', lineHeight: 1 }}>
                                  ✓
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 垂直分隔線 */}
                    <div className="popover-divider-v" style={{ width: '1px', backgroundColor: 'var(--border-color, rgba(0,0,0,0.08))', alignSelf: 'stretch' }} />

                    {/* 右欄：4 個粗細與標註模式 (縱向排列) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      {(['full', 'bottom-half', 'underline', 'border'] as const).map(s => {
                        const isSelected = (settings.highlightStyle || 'bottom-half') === s;

                        const getStyleItemPreview = () => {
                          switch (s) {
                            case 'underline':
                              return { borderBottom: `2.5px solid ${colorHex}`, background: 'transparent' };
                            case 'bottom-half':
                              return { background: `linear-gradient(180deg, transparent 55%, ${currentRgba} 55%)` };
                            case 'full':
                              return { backgroundColor: currentRgba, borderRadius: '3px' };
                            case 'border':
                              return { border: `2px solid ${colorHex}`, borderRadius: '3px', padding: '0 2px' };
                          }
                        };

                        return (
                          <div
                            key={s}
                            className={`popover-style-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectHighlightStyle(s)}
                            title={s === 'full' ? '全塗' : s === 'bottom-half' ? '半塗' : s === 'underline' ? '底線' : '方框'}
                            style={{
                              width: '40px',
                              height: '26px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              flexShrink: 0,
                              border: isSelected ? '1.5px solid var(--theme-accent, #8c4b27)' : '1px solid var(--border-color, rgba(0,0,0,0.12))',
                              backgroundColor: isSelected ? 'var(--theme-accent-light, rgba(140, 75, 39, 0.1))' : 'var(--input-bg, rgba(0,0,0,0.02))',
                              transition: 'all 0.15s',
                              transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                            }}
                          >
                            <span 
                              style={{ 
                                fontSize: '0.78rem',
                                fontFamily: 'var(--font-serif)',
                                fontWeight: 'bold',
                                color: 'var(--text-primary)',
                                padding: '1px 2px',
                                ...getStyleItemPreview()
                              }}
                            >
                              經文
                            </span>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              )}
            </div>
          );
        })()}


        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* 💡 頂部列：「三」左邊新增搜尋鍵，樣式 100% 統一 */}
          <button 
            className={`icon-button ${activeSearchQuery ? 'active' : ''}`} 
            onClick={() => {
              setInBookSearchInput(activeSearchQuery);
              setShowInBookSearchModal(true);
            }} 
            title="搜尋本書關鍵字"
          >
            <Search size={20} />
          </button>
          <button className="icon-button" onClick={() => setShowNavDrawer(prev => !prev)} title="目次">
            <Menu size={20} />
          </button>
          <button className="icon-button" onClick={() => setShowSettingsView(true)} title="其他閱讀設定">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* 💡 本書內關鍵字搜尋對話框 */}
      {showInBookSearchModal && (
        <div className="inbook-search-modal-backdrop" onClick={() => setShowInBookSearchModal(false)}>
          <div className="inbook-search-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '0.8rem', color: 'var(--theme-accent, #8c4b27)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Search size={18} />
              <span>搜尋本書經文關鍵字</span>
            </div>
            <div className="inbook-search-input-wrapper">
              <input 
                type="text" 
                className="inbook-search-input"
                placeholder="請輸入關鍵字，例如：地藏、勝鬘" 
                value={inBookSearchInput}
                onChange={e => setInBookSearchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setInternalSearchQuery(inBookSearchInput.trim());
                    setShowInBookSearchModal(false);
                  }
                }}
                autoFocus
              />
              {inBookSearchInput && (
                <button 
                  type="button" 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} 
                  onClick={() => setInBookSearchInput('')}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.9rem' }}>
              {activeSearchQuery && (
                <button 
                  className="inbook-search-btn-cancel" 
                  style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                  onClick={() => {
                    setInternalSearchQuery('');
                    setInBookSearchInput('');
                    setShowInBookSearchModal(false);
                  }}
                >
                  清除搜尋
                </button>
              )}
              <button 
                className="inbook-search-btn-cancel" 
                onClick={() => setShowInBookSearchModal(false)}
              >
                取消
              </button>
              <button 
                className="inbook-search-btn-submit" 
                onClick={() => {
                  setInternalSearchQuery(inBookSearchInput.trim());
                  setShowInBookSearchModal(false);
                }}
              >
                搜尋經文
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 搜尋結果同一書內導航懸浮條 (Image 2) */}
      {activeSearchQuery && matchedSegments.length > 0 && (
        <div className={`search-nav-bar ${showToolbar ? 'visible' : 'hidden'}`}>
          <span className="search-nav-query" title={activeSearchQuery}>檢索: {activeSearchQuery}</span>
          <div className="search-nav-controls">
            <button className="search-nav-btn" onClick={handlePrevMatch} title="上一個匹配">
              <ChevronLeft size={16} />
            </button>
            <span className="search-nav-stats">
              {currentMatchIndex !== -1 ? currentMatchIndex + 1 : 0} / {matchedSegments.length}
            </span>
            <button className="search-nav-btn" onClick={handleNextMatch} title="下一個匹配">
              <ChevronRight size={16} />
            </button>
            <button 
              className="search-nav-btn" 
              onClick={() => {
                setInternalSearchQuery('');
              }} 
              title="關閉檢索"
              style={{ marginLeft: '0.3rem' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* 經文排版內文區 (點擊空白處切換工具列，且無 absolute 蓋板，支持滑動滾動與文字點選) */}
      <div 
        className="reader-content-area custom-scrollbar" 
        ref={contentAreaRef}
        onClick={handleContentAreaClick}
        onScroll={handleScroll}
      >
        <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>
          
          {/* 書名與標題 */}
          {currentJuanNum === 1 && (
            <>
              {isBackupMode() && (
                <div className="reader-text-backup-badge" title="目前處於備援閱讀模式 (?source=backup)">
                  備援
                </div>
              )}
              <h1 className="reader-book-title">{book.metadata.title}</h1>
              {sanitizeCreators(book.metadata.creators) && (
                <div className="reader-book-author">{sanitizeCreators(book.metadata.creators)}</div>
              )}
            </>
          )}

          {book.metadata.juansCount > 1 && (
            <div style={{ textAlign: 'center', marginBottom: '2rem', fontFamily: 'var(--font-serif)', color: 'var(--reader-text-muted)', fontSize: '1.1rem' }}>
              —— 第 {currentJuanNum} 卷 ——
            </div>
          )}

          {/* 經文內容段落 */}
          {(() => {
            const sutraSegments: TextSegment[] = [];
            const copyrightSegments: TextSegment[] = [];
            let foundCopyright = false;
            
            activeJuan?.segments.forEach(seg => {
              if (
                seg.content.includes('【經文資訊】') || 
                seg.content.includes('【版本記錄】') || 
                seg.content.includes('【編輯說明】') ||
                seg.content.startsWith('【') && (seg.content.includes('版權') || seg.content.includes('說明') || seg.content.includes('記錄'))
              ) {
                foundCopyright = true;
              }
              if (foundCopyright) {
                copyrightSegments.push(seg);
              } else {
                sutraSegments.push(seg);
              }
            });

            const displayCopyrightSegments = copyrightSegments.length > 0 ? copyrightSegments : [
              { id: `${book.metadata.workId}_copy_1`, lb: '', content: `【經文資訊】${book.metadata.vol || ''} No. ${book.metadata.workId.replace(/^[A-Z]/, '')} ${book.metadata.title}` },
              { id: `${book.metadata.workId}_copy_2`, lb: '', content: '【版本記錄】發行日期：2026-04，最後更新：2025-01-30' },
              { id: `${book.metadata.workId}_copy_3`, lb: '', content: '【編輯說明】本資料庫由 財團法人佛教電子佛典基金會（CBETA）依「大正新脩大藏經」所編輯' },
              { id: `${book.metadata.workId}_copy_4`, lb: '', content: '【其他事項】詳細說明請參閱【財團法人佛教電子佛典基金會資料庫版權宣告】' }
            ];

            return (
              <>
                {sutraSegments.map((seg) => {
                  const isTtsActive = settings.customVisibleElements.ttsHighlight && ttsSegmentId === seg.id;
                  const isClicked = activeSegmentId === seg.id;

                  return (
                    <div 
                      key={seg.id}
                      ref={el => { segmentsMapRef.current[seg.id] = el; }}
                      className={`reader-paragraph-wrapper ${seg.isVerse ? 'verse-wrapper' : ''}`}
                    >
                      <p 
                        data-segment-id={seg.id}
                        className={`reader-paragraph ${seg.isHead ? 'paragraph-head' : ''} ${seg.isVerse ? 'verse' : ''} ${seg.isOrig ? 'is-orig' : ''} ${isTtsActive ? 'tts-active' : ''} ${isClicked ? 'clicked' : ''}`}
                        onClick={() => handleSegmentClick(seg)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* 學術模式：顯示大藏經原始頁碼 (暫時停用，留待日後開啟) */}
                        {/* eslint-disable-next-line no-constant-binary-expression */}
                        {false && settings.customVisibleElements.pageNumber && (
                          <span className="lb-marker" title="大藏經原始頁碼">
                            {seg.lb.includes('_p') ? seg.lb.split('_')[1] : (seg.lb.includes('p') ? 'p' + seg.lb.split('p')[1] : seg.lb)}
                          </span>
                        )}

                        {/* 經文主體文字 */}
                        {renderParagraphContent(seg.content, seg.id)}

                        {/* 學術模式：顯示校勘標記 (暫時停用，留待日後開啟) */}
                        {/* eslint-disable-next-line no-constant-binary-expression */}
                        {false && settings.customVisibleElements.notes && seg.notes?.map((_, idx) => (
                          <span 
                            key={`${seg.id}-n-${idx}`} 
                            className="note-anchor"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (seg.notes) {
                                setSelectedNotes(seg.notes);
                                setSelectedNotesTitle(seg.content.substring(0, 8) + '...');
                              }
                            }}
                          >
                            [{idx + 1}]
                          </span>
                        ))}
                      </p>
                    </div>
                  );
                })}

                {/* 摺疊版權資訊面板 */}
                <div className="copyright-collapse-section" style={{ marginTop: '2rem', padding: '1rem 0', borderTop: '1px dashed var(--reader-border)' }}>
                  <button 
                    className="copyright-toggle-btn"
                    onClick={() => setIsCopyrightExpanded(!isCopyrightExpanded)}
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.4rem', 
                      fontFamily: 'var(--font-serif)', 
                      fontSize: '0.95rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--reader-text-muted)',
                      cursor: 'pointer',
                      padding: '0.5rem 0'
                    }}
                  >
                    <span style={{ fontWeight: 'bold' }}>{isCopyrightExpanded ? '-' : '+'}</span>
                    <span>顯示版權資訊</span>
                  </button>
                  
                  {isCopyrightExpanded && (
                    <div className="copyright-content-box animate-fade-in" style={{ marginTop: '1rem', fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--reader-text-muted)', opacity: 0.85 }}>
                      {displayCopyrightSegments.map((seg) => (
                        <p key={seg.id} style={{ marginBottom: '0.8rem', textIndent: '0' }}>
                          {seg.content}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* 換卷提示 */}
          {book.metadata.juansCount > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4rem', padding: '1rem 0', borderTop: '1px solid var(--reader-border)' }}>
              <button 
                style={{ fontFamily: 'var(--font-serif)', color: currentJuanNum > 1 ? 'var(--reader-text)' : 'var(--reader-text-muted)', cursor: currentJuanNum > 1 ? 'pointer' : 'default' }}
                onClick={() => currentJuanNum > 1 && handleSelectJuan(currentJuanNum - 1)}
                disabled={currentJuanNum <= 1}
              >
                ◀ 上一卷
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--reader-text-muted)' }}>
                卷 {currentJuanNum} / {book.metadata.juansCount}
              </span>
              <button 
                style={{ fontFamily: 'var(--font-serif)', color: currentJuanNum < book.metadata.juansCount ? 'var(--reader-text)' : 'var(--reader-text-muted)', cursor: currentJuanNum < book.metadata.juansCount ? 'pointer' : 'default' }}
                onClick={() => currentJuanNum < book.metadata.juansCount && handleSelectJuan(currentJuanNum + 1)}
                disabled={currentJuanNum >= book.metadata.juansCount}
              >
                下一卷 ▶
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 💡 浮動膠囊控制列 (Floating Capsule Bottom Bar) */}
      <div className={`reader-floating-bottom-bar ${showToolbar ? 'visible' : 'hidden'}`}>
        {/* 左側：4 種顏色模式 (象牙白, 羊皮紙, 護眼綠, 烏木黑) */}
        <div className="floating-bar-theme-group">
          {(['ivory', 'parchment', 'comfort', 'ebony'] as const).map((t) => {
            const isSelected = settings.theme === t;
            return (
              <div
                key={t}
                className={`floating-theme-circle ${t} ${isSelected ? 'active' : ''}`}
                onClick={() => onSaveSettings({ ...settings, theme: t })}
                title={t === 'ivory' ? '象牙白' : t === 'parchment' ? '羊皮紙' : t === 'comfort' ? '舒服護眼' : '烏木暗色'}
              >
                {isSelected && <Check size={14} strokeWidth={3.5} className="theme-check-icon" />}
              </div>
            );
          })}
        </div>

        {/* ⏱️ 閱讀時間倒數計時 (若有設定閱讀時間) */}
        {timerState.duration && timerState.remainingSeconds > 0 && (
          <>
            <div className="floating-bar-divider" />
            <div 
              className="floating-bar-timer"
              onClick={() => setShowSettingsView(true)}
              title="閱讀時間倒數中 (點擊開啟設定)"
            >
              <Clock size={13} style={{ strokeWidth: 2.2 }} />
              <span>{formatTimerMMSS(timerState.remainingSeconds)}</span>
            </div>
          </>
        )}

        {/* 細細豎線垂直分隔線 */}
        <div className="floating-bar-divider" />

        {/* 右側：字體大小調整器 [A-] 22px [A+] */}
        <div className="floating-bar-font-group">
          <button 
            type="button" 
            className="floating-font-btn" 
            onClick={() => onSaveSettings({ ...settings, fontSize: Math.max(12, settings.fontSize - 1) })}
            title="縮小字體 (A-)"
          >
            A-
          </button>
          <span className="floating-font-val">{settings.fontSize}px</span>
          <button 
            type="button" 
            className="floating-font-btn" 
            onClick={() => onSaveSettings({ ...settings, fontSize: Math.min(36, settings.fontSize + 1) })}
            title="放大字體 (A+)"
          >
            A+
          </button>
        </div>
      </div>

      {/* 雙導航目錄 Drawer */}
      {showNavDrawer && (
        <div className="reader-nav-drawer">
          {/* 💡 當卷數 > 1 時，顯示頂部「目次」與「卷/篇章」Tab 選項 */}
          {book.metadata.juansCount > 1 && (
            <div className="drawer-tab-header">
              <div 
                className={`drawer-tab ${navTab === 'toc' ? 'active' : ''}`}
                onClick={() => setNavTab('toc')}
              >
                目次
              </div>
              <div 
                className={`drawer-tab ${navTab === 'juan' ? 'active' : ''}`}
                onClick={() => setNavTab('juan')}
              >
                卷/篇章
              </div>
            </div>
          )}

          <div className="drawer-list custom-scrollbar">
            {navTab === 'juan' && book.metadata.juansCount > 1 ? (
              book.metadata.workId.startsWith('Y') ? null : (
                Array.from({ length: book.metadata.juansCount }).map((_, idx) => (
                  <div 
                    key={`juan-${idx + 1}`} 
                    className={`drawer-item ${currentJuanNum === idx + 1 ? 'active' : ''}`}
                    onClick={() => handleSelectJuan(idx + 1)}
                  >
                    <span>第 {idx + 1} 卷</span>
                  </div>
                ))
              )
            ) : (
              /* 按品目錄 (目次 - 支援多層級樹狀 Collapsible Tree) */
              book.toc.items.map((item) => (
                <TocTreeNode
                  key={item.id}
                  item={item}
                  level={0}
                  activeSegmentId={activeSegmentId}
                  currentJuanNum={currentJuanNum}
                  workId={book.metadata.workId}
                  isMultiJuan={book.metadata.juansCount > 1 && !book.metadata.workId.startsWith('Y')}
                  onSelectTOC={handleSelectTOC}
                />
              ))
            )}
          </div>

          {/* 經典與版權資訊固定常駐於抽屜底部 */}
          <div className="drawer-footer">
            <div 
              className="drawer-footer-toggle" 
              onClick={() => setIsCopyrightExpanded(prev => !prev)}
            >
              <span>經典與版權資訊</span>
              <span className="toggle-symbol">{isCopyrightExpanded ? '−' : '+'}</span>
            </div>
            
            {isCopyrightExpanded && (
              <div className="drawer-footer-content animate-fade-in">
                <div className="info-item"><strong>經名：</strong>{book.metadata.title}</div>
                <div className="info-item"><strong>作譯者：</strong>{sanitizeCreators(book.metadata.creators)}</div>
                <div className="info-item"><strong>經號：</strong>CBETA No. {book.metadata.workId}</div>
                <div className="info-item"><strong>部類：</strong>{book.metadata.category}</div>
                {book.metadata.vol && (
                  <div className="info-item"><strong>冊別：</strong>{book.metadata.vol}</div>
                )}
                {(() => {
                  const feat = FEATURED_BOOKS.find(b => b.workId === book.metadata.workId);
                  const count = (feat?.cjkChars && feat.cjkChars > 0) 
                    ? feat.cjkChars 
                    : (book.metadata.cjkChars || 0);

                  if (count > 0) {
                    return (
                      <div className="info-item"><strong>字數：</strong>{count.toLocaleString()}</div>
                    );
                  }
                  let totalCount = 0;
                  book.content.juans.forEach(j => {
                    j.segments.forEach(seg => {
                      // 排除經號標頭中的 No. 1944 等英數詮釋標記
                      const cleanContent = seg.content.replace(/^No\.\s*\d+[a-z]?/i, '');
                      const cjkMatches = cleanContent.match(/[\u4e00-\u9fa5\u3400-\u4dbf\u20000-\u2a6df]/g);
                      if (cjkMatches) {
                        totalCount += cjkMatches.length;
                      }
                    });
                  });
                  return totalCount > 0 ? (
                    <div className="info-item"><strong>字數：</strong>{totalCount.toLocaleString()}</div>
                  ) : null;
                })()}
                <div className="copyright-text">
                  經典來源：財團法人佛教電子佛典基金會(CBETA)
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 校勘/學術引用 側邊欄 (暫時停用，留待日後開啟) */}
      {/* eslint-disable-next-line no-constant-binary-expression */}
      {selectedNotes && false && (
        <>
          <div className="notes-sidebar-overlay" onClick={() => setSelectedNotes(undefined)} />
          <div className="notes-sidebar">
            <div className="notes-header">
              <h4>校勘註解對照</h4>
              <button className="icon-button" style={{ color: '#3c2a1a' }} onClick={() => setSelectedNotes(undefined)}>
                <X size={20} />
              </button>
            </div>
            <div className="notes-list custom-scrollbar">
              <p style={{ fontSize: '0.8rem', color: 'var(--color-wood-700)', fontStyle: 'italic', marginBottom: '1rem' }}>
                段落: "{selectedNotesTitle}" 的學術比對版本
              </p>
              {selectedNotes?.map((note, idx) => (
                <div key={`note-${idx}`} className="note-item">
                  <div className="note-item-id">校勘標籤 {note.id}</div>
                  <div style={{ fontSize: '0.95rem', fontFamily: 'var(--font-serif)' }}>{note.content}</div>
                  
                  {note.cbetaUrl && (
                    <a 
                      href={note.cbetaUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="note-item-cbeta"
                    >
                      <ExternalLink size={12} />
                      在 CBETA Online 上驗證引文
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 其他閱讀設定對話框 */}
      {showSettingsView && (
        <SettingsView 
          settings={settings}
          onSave={onSaveSettings}
          onClose={() => setShowSettingsView(false)}
        />
      )}

      {/* 💡 劃線懸浮操作工具列（寫心得 + 刪除重點） */}
      {activeHighlightForDelete && deleteMenuPosition && (
        <div 
          className="highlight-delete-menu"
          style={{
            position: 'fixed',
            top: `${Math.max(10, deleteMenuPosition.top)}px`,
            left: `${Math.min(
              Math.max(70, deleteMenuPosition.left),
              window.innerWidth - 70
            )}px`,
            transform: 'translateX(-50%)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'stretch',
            background: 'var(--reader-bg)',
            border: '1px solid var(--theme-accent-border, var(--reader-border))',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
            borderRadius: '14px',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 寫筆記按鈕：圖示在上、文字在下 */}
          <button
            type="button"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: '8px 14px',
              minWidth: '60px',
              flex: '1 1 0'
            }}
            onClick={() => handleOpenNoteEditor(activeHighlightForDelete)}
          >
            <Edit3 size={15} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'var(--font-serif)', whiteSpace: 'nowrap' }}>
              {activeHighlightForDelete.note ? '編輯筆記' : '寫筆記'}
            </span>
          </button>

          {/* 分隔線 */}
          <div style={{ width: '1px', backgroundColor: 'var(--reader-border, rgba(0,0,0,0.12))', margin: '6px 0' }} />

          {/* 刪除按鈕：圖示在上、文字在下 */}
          <button
            type="button"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              border: 'none',
              background: 'transparent',
              color: '#bd3a3a',
              cursor: 'pointer',
              padding: '8px 14px',
              minWidth: '60px',
              flex: '1 1 0'
            }}
            onClick={() => handleDeleteHighlight()}
          >
            <Trash2 size={15} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', fontFamily: 'var(--font-serif)', whiteSpace: 'nowrap' }}>刪除</span>
          </button>
        </div>
      )}

      {/* 💡 筆記寫作 Modal */}
      {editingNoteHighlight && (
        <div className="search-dialog-overlay" onClick={() => setEditingNoteHighlight(null)}>
          <div className="search-dialog-card animate-slide-up" style={{ maxWidth: '420px', borderRadius: '16px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} />
                <span>隨手記筆記</span>
              </h3>
              <button className="icon-button close-btn" onClick={() => setEditingNoteHighlight(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="dialog-body" style={{ gap: '1rem', padding: '1.2rem' }}>
              <div 
                style={{ 
                  fontSize: '0.85rem', 
                  color: 'var(--text-muted)', 
                  backgroundColor: 'var(--theme-accent-light, rgba(0,0,0,0.04))', 
                  padding: '0.6rem 0.8rem', 
                  borderRadius: '8px',
                  borderLeft: '3px solid var(--theme-accent)'
                }}
              >
                「{editingNoteHighlight.text}」
              </div>

              <textarea
                className="note-textarea"
                placeholder="寫下您對此句經文的感悟或讀後心得..."
                value={editingNoteText}
                onChange={(e) => setEditingNoteText(e.target.value)}
                rows={4}
                autoFocus
              />

              <div style={{ display: 'flex', gap: '0.8rem', width: '100%', marginTop: '0.2rem' }}>
                <button 
                  className="dialog-btn-confirm"
                  onClick={handleSaveNote}
                  style={{ flex: 1 }}
                >
                  儲存心得
                </button>
                <button 
                  className="dialog-btn-cancel"
                  onClick={() => setEditingNoteHighlight(null)}
                  style={{ flex: 1 }}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReaderView;
