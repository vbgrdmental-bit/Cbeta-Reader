import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, Menu, Settings, Volume2, Square, ExternalLink, X, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import type { ReaderPackage, TextSegment } from '../../types/book';
import { getBook, saveBook } from '../../utils/db';
import type { AppSettings } from '../../utils/db';
import { NavigationBuilder } from '../../builder/NavigationBuilder';
import { useTTS } from '../hooks/useTTS';
import { SettingsView } from './SettingsView';
import '../styles/reader.css';

interface ReaderViewProps {
  workId: string;
  initialSegmentId?: string; // 外部傳入要跳轉的段落 ID
  settings: AppSettings;
  onBackToLibrary: (resetToRoot?: boolean) => void;
  onSaveSettings: (settings: AppSettings) => void;
  searchQuery?: string;
}

// 💡 取得某個段落對應的 TOC 品名，若無 TOC 則退化為「第 X 卷」
const getMuluTitleForSegment = (book: any, juanNum: number, segmentId: string): string => {
  if (!book || !book.toc || !book.toc.items || book.toc.items.length === 0) {
    return `第 ${juanNum} 卷`;
  }

  const activeJuan = book.content.juans.find((j: any) => j.juan === juanNum);
  if (!activeJuan) return `第 ${juanNum} 卷`;

  const currentSegIdx = activeJuan.segments.findIndex((s: any) => s.id === segmentId);
  if (currentSegIdx === -1) return `第 ${juanNum} 卷`;

  const juanTocs = book.toc.items
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

export function ReaderView({ 
  workId, 
  initialSegmentId, 
  settings, 
  onBackToLibrary, 
  onSaveSettings,
  searchQuery
}: ReaderViewProps) {
  const [book, setBook] = useState<ReaderPackage | null>(null);
  const [currentJuanNum, setCurrentJuanNum] = useState<number>(1);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  
  // UI 覆蓋層（工具列）狀態
  const [showToolbar, setShowToolbar] = useState(true);
  const toolbarTimeoutRef = useRef<number | null>(null);

  // 導航抽屜 (Drawer) 狀態
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [navTab, setNavTab] = useState<'juan' | 'toc'>('toc');
  const [isCopyrightExpanded, setIsCopyrightExpanded] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [showSettingsView, setShowSettingsView] = useState(false);

  // 💡 全文檢索跳轉高亮支援
  const renderHighlightedContent = (text: string) => {
    if (!searchQuery) return text;
    const keywords = searchQuery.trim().split(/\s+/).filter(Boolean);
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

  // 校勘側邊欄狀態
  const [selectedNotes, setSelectedNotes] = useState<TextSegment['notes']>(undefined);
  const [selectedNotesTitle, setSelectedNotesTitle] = useState<string>('');

  // 💡 同一經書內「上一個／下一個」檢索定位
  const [matchedSegments, setMatchedSegments] = useState<Array<{ segmentId: string; juan: number }>>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);

  // 💡 歷史進度接續閱讀 Dialog 狀態
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [pendingProgress, setPendingProgress] = useState<{ juan: number; segmentId: string; displayTitle: string; percent: number } | null>(null);

  const handleConfirmResume = () => {
    if (pendingProgress) {
      setCurrentJuanNum(pendingProgress.juan);
      setTimeout(() => {
        if (pendingProgress.segmentId) {
          scrollToSegment(pendingProgress.segmentId);
          setActiveSegmentId(pendingProgress.segmentId);
        }
      }, 300);
    }
    setShowResumeDialog(false);
  };

  const handleDeclineResume = () => {
    setCurrentJuanNum(1);
    setShowResumeDialog(false);
  };

  useEffect(() => {
    if (!book || !searchQuery) {
      setMatchedSegments([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const keywords = searchQuery.trim().split(/\s+/).filter(Boolean);
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
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [book, searchQuery, initialSegmentId]);

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

  // 跨卷目次跳轉：在卷數切換且 DOM 渲染完成後自動滾動到該品起點
  useEffect(() => {
    if (pendingScrollSegmentIdRef.current) {
      const targetId = pendingScrollSegmentIdRef.current;
      setTimeout(() => {
        scrollToSegment(targetId);
      }, 150);
      pendingScrollSegmentIdRef.current = null;
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
        let bookData = await getBook(workId);
        if (bookData) {
          // 💡 全自動目次修復與 Mock 同步邏輯
          // 只有當書籍的目錄結構毀損、遺失（如退化為預設的 "第 X 卷"）時，才在背景修復
          const needsTocFix = !bookData.toc || !bookData.toc.items || bookData.toc.items.length === 0 || 
                              (bookData.toc.items.length > 0 && bookData.toc.items[0].title === '第 1 卷');

          if (needsTocFix) {
            try {
              const isOfflineMock = workId === 'T0412' || workId === 'T0262';
              if (isOfflineMock) {
                const res = await fetch(`/mock/${workId}.json`);
                if (res.ok) {
                  const preBuilt = await res.json();
                  // 僅修正卷數，不覆蓋使用者已下載的完整經文內容
                  if (workId === 'T0412') {
                    bookData.metadata.juansCount = 3;
                  } else {
                    bookData.metadata.juansCount = preBuilt.content.juans.length;
                  }
                  const { toc, navigation } = NavigationBuilder.buildNavigation(
                    workId,
                    bookData.content,
                    preBuilt.rawToc || []
                  );
                  bookData.toc = toc;
                  bookData.navigation = navigation;
                  await saveBook(bookData);
                }
              } else {
                console.log(`[TOC AutoFix] Silently repairing TOC for online work: ${workId}...`);
                const { ReaderBuilder } = await import('../../builder/ReaderBuilder');
                const { content, rawToc } = await ReaderBuilder.buildContent(workId, bookData.metadata.juansCount);
                const { toc, navigation } = NavigationBuilder.buildNavigation(
                  workId,
                  content,
                  rawToc
                );
                bookData.toc = toc;
                bookData.navigation = navigation;
                bookData.content = content;
                await saveBook(bookData);
                console.log(`[TOC AutoFix] TOC repaired successfully for ${workId}`);
              }
            } catch (err) {
              console.warn('[TOC AutoFix] Failed to sync or repair TOC:', err);
            }
          }
          // 💡 已知內建經典 Metadata 自動修正（修正本地儲存的舊錯誤資料）
          const KNOWN_METADATA_FIXES: Record<string, Partial<typeof bookData.metadata>> = {
            'T0412': { category: '大集部類', creators: '唐 實叉難陀譯' },
            'T0262': { category: '法華部類',   creators: '姚秦 鳩摩羅什譯' }
          };
          const fix = KNOWN_METADATA_FIXES[workId];
          if (fix) {
            let needsSave = false;
            for (const [key, val] of Object.entries(fix) as [keyof typeof bookData.metadata, any][]) {
              if (bookData.metadata[key] !== val) {
                (bookData.metadata as any)[key] = val;
                needsSave = true;
              }
            }
            if (needsSave) {
              await saveBook(bookData);
              console.log(`[MetaFix] Auto-corrected metadata for ${workId}`);
            }
          }

          setBook(bookData);
          
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
            // 💡 嘗試從 localStorage 載入此書的歷史閱讀進度
            const savedProgressStr = localStorage.getItem(`reader_progress_${workId}`);
            if (savedProgressStr) {
              try {
                const progress = JSON.parse(savedProgressStr);
                if (progress.juan || progress.segmentId) {
                  // 💡 計算該段落對應的品名
                  const displayTitle = getMuluTitleForSegment(bookData, progress.juan || 1, progress.segmentId || '');
                  
                  // 暫存歷史進度，並彈出確認 Dialog 詢問
                  setPendingProgress({
                    juan: progress.juan || 1,
                    segmentId: progress.segmentId || '',
                    displayTitle: displayTitle,
                    percent: progress.percent !== undefined ? progress.percent : 0
                  });
                  setShowResumeDialog(true);
                }
                // 預設先進入卷 1
                setCurrentJuanNum(1);
              } catch (err) {
                console.warn('Failed to parse saved progress, fallback to juan 1:', err);
                setCurrentJuanNum(1);
              }
            } else {
              setCurrentJuanNum(1);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load book content:', e);
      }
    };

    loadBookData();
    // 預設展示工具列，一段時間後自動隱藏
    resetToolbarTimeout();

    return () => {
      if (toolbarTimeoutRef.current) clearTimeout(toolbarTimeoutRef.current);
      stopTTS();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId, initialSegmentId]);

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

  const handleCycleLineHeight = () => {
    const heights = [1.6, 1.8, 2.0, 2.2];
    const currentIndex = heights.indexOf(settings.lineHeight);
    // 如果不在列表中，預設到下一個
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % heights.length;
    onSaveSettings({ ...settings, lineHeight: heights[nextIndex] });
  };

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


  // 點擊空白處切換工具列，防範文字或註解點擊干擾
  const handleContentAreaClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'P' || 
      target.closest('.reader-paragraph') ||
      target.closest('.note-anchor') ||
      target.closest('button') ||
      target.closest('a')
    ) {
      return;
    }
    
    // 勾選「永遠顯示控制列」時，點擊不切換工具列
    if (settings.customVisibleElements?.showReaderControls) {
      setShowNavDrawer(false);
      return;
    }
    
    setShowToolbar(prev => !prev);
    setShowNavDrawer(false); // 點擊空白處自動隱藏目次 Drawer 面板
    if (!showToolbar) {
      resetToolbarTimeout();
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
    setShowNavDrawer(false);
    setActiveSegmentId(tocItem.startSegmentId);
    resetToolbarTimeout();
    
    if (tocItem.juan === currentJuanNum) {
      // 同一卷：直接滾動
      scrollToSegment(tocItem.startSegmentId);
    } else {
      // 跨卷：記錄待跳轉段落 ID，切換卷數，讓 useEffect 處理滾動
      pendingScrollSegmentIdRef.current = tocItem.startSegmentId;
      setCurrentJuanNum(tocItem.juan);
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
      text: seg.content
    }));

    // 尋找開始的段落
    let startIndex = 0;
    if (activeSegmentId) {
      const index = juanData.segments.findIndex(s => s.id === activeSegmentId);
      if (index !== -1) startIndex = index;
    }

    playTTS(ttsPlaylist, startIndex);
  };

  const handleToggleTTS = () => {
    if (isPlaying) {
      stopTTS();
    } else {
      handleStartTTS();
    }
  };

  const handleScroll = () => {
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
    resetToolbarTimeout();

    // 暫時關閉：段落有校勘註解時，點擊不再彈出校勘邊欄
    /*
    if (seg.notes && seg.notes.length > 0) {
      setSelectedNotes(seg.notes);
      setSelectedNotesTitle(seg.content.substring(0, 8) + '...');
    }
    */
  };

  if (!book) {
    return (
      <div 
        className={`reader-container theme-${settings.theme}`} 
        style={{ display: 'flex', height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--reader-text)', background: 'var(--reader-bg)' }}
      >
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem' }}>經典載入中...</p>
      </div>
    );
  }

  // 套用 Reading Settings 對內文左右留白
  const paddingStyle = {
    '--reader-padding': `${settings.padding}%`,
    '--reader-font-size': `${settings.fontSize}px`,
    '--reader-line-height': settings.lineHeight
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
        <button className="icon-button" onClick={() => onBackToLibrary(true)} title="首頁">
          <Home size={20} />
        </button>

        <div className="control-divider" />

        <button 
          className="reader-text-btn" 
          onClick={() => onBackToLibrary(false)} 
          title="返回前一頁"
          style={{ fontStyle: 'normal', fontWeight: 'bold', fontSize: '1.2rem', padding: '0 0.4rem', fontFamily: 'monospace' }}
        >
          &lt;
        </button>

        {searchQuery && (
          <>
            <div className="control-divider" />
            <button 
              className="icon-button" 
              onClick={() => onBackToLibrary(false)} 
              title="返回搜尋結果" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '6px', 
                background: 'var(--theme-accent-light, rgba(242, 163, 27, 0.08))', 
                border: '1px solid var(--theme-accent-border, rgba(242, 163, 27, 0.2))', 
                color: 'var(--theme-accent)',
                cursor: 'pointer'
              }}
            >
              <Search size={16} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>返回搜尋</span>
            </button>
          </>
        )}

        <div className="control-divider" />

        <button 
          className="reader-text-btn" 
          onClick={() => {
            const newSize = Math.max(16, settings.fontSize - 2);
            onSaveSettings({ ...settings, fontSize: newSize });
          }}
          title="縮小字型"
        >
          A-
        </button>
        <button 
          className="reader-text-btn" 
          onClick={() => {
            const newSize = Math.min(40, settings.fontSize + 2);
            onSaveSettings({ ...settings, fontSize: newSize });
          }}
          title="放大字型"
        >
          A+
        </button>
        <button 
          className="reader-text-btn lh-btn" 
          onClick={handleCycleLineHeight}
          title="循環切換行高"
        >
          <span>↕️ {settings.lineHeight.toFixed(1)}</span>
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
          <button className="icon-button" onClick={() => setShowNavDrawer(prev => !prev)} title="目次">
            <Menu size={20} />
          </button>
          <button className="icon-button" onClick={() => setShowSettingsView(true)} title="其他閱讀設定">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* 搜尋結果同一書內導航懸浮條 */}
      {searchQuery && matchedSegments.length > 0 && (
        <div className={`search-nav-bar ${showToolbar ? 'visible' : 'hidden'}`}>
          <span className="search-nav-query" title={searchQuery}>檢索: {searchQuery}</span>
          <div className="search-nav-controls">
            <button className="search-nav-btn" onClick={handlePrevMatch} title="上一個匹配">
              <ChevronLeft size={16} />
            </button>
            <span className="search-nav-stats">
              {currentMatchIndex !== -1 ? currentMatchIndex + 1 : '?'} / {matchedSegments.length}
            </span>
            <button className="search-nav-btn" onClick={handleNextMatch} title="下一個匹配">
              <ChevronRight size={16} />
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
              <h1 className="reader-book-title">{book.metadata.title}</h1>
              <div className="reader-book-author">{book.metadata.creators}</div>
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

            return (
              <>
                {sutraSegments.map((seg) => {
                  const isTtsActive = settings.customVisibleElements.ttsHighlight && ttsSegmentId === seg.id;
                  const isClicked = activeSegmentId === seg.id;

                  return (
                    <div 
                      key={seg.id}
                      ref={el => { segmentsMapRef.current[seg.id] = el; }}
                      className={`reader-paragraph-wrapper`}
                    >
                      <p 
                        className={`reader-paragraph ${seg.isHead ? 'paragraph-head' : ''} ${seg.isVerse ? 'verse' : ''} ${isTtsActive ? 'tts-active' : ''} ${isClicked ? 'clicked' : ''}`}
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
                        {renderHighlightedContent(seg.content)}

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
                {copyrightSegments.length > 0 && (
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
                        {copyrightSegments.map((seg) => (
                          <p key={seg.id} style={{ marginBottom: '0.8rem', textIndent: '0' }}>
                            {seg.content}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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

      {/* 底部工具列 */}
      <div className={`reader-overlay-bar reader-bottom-bar ${showToolbar ? 'visible' : 'hidden'}`}>
        <div className="bar-left-controls">
          <span>{currentMuluTitle} 的閱讀進度 ({scrollPercent}%)</span>
        </div>

        <div className="bar-right-controls">
          <button className="icon-button" onClick={handleToggleTTS} title={isPlaying ? "停止朗讀" : "語音朗讀"}>
            {isPlaying ? <Square size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>

      {/* 雙導航目錄 Drawer */}
      {showNavDrawer && (
        <div className="reader-nav-drawer">
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

          <div className="drawer-list custom-scrollbar">
            {navTab === 'juan' ? (
              /* 按卷目錄 (若為 Y 藏等不分卷著述則顯示為空以吻合 CBETA) */
              book.metadata.workId.startsWith('Y') ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--reader-text-muted)', fontFamily: 'var(--font-serif)', opacity: 0.7 }}>
                  無卷/篇章
                </div>
              ) : (
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
              /* 按品目錄 (目次) */
              book.toc.items.map((item) => (
                <div 
                  key={item.id} 
                  className={`drawer-item ${activeSegmentId === item.startSegmentId ? 'active' : ''}`}
                  onClick={() => handleSelectTOC(item)}
                >
                  <span>{item.title}</span>
                  {book.metadata.juansCount > 1 && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>卷 {item.juan}</span>
                  )}
                </div>
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
                <div className="info-item"><strong>譯者：</strong>{book.metadata.creators}</div>
                <div className="info-item"><strong>經號：</strong>CBETA No. {book.metadata.workId}</div>
                {book.metadata.vol && (
                  <div className="info-item"><strong>冊別：</strong>{book.metadata.vol}</div>
                )}
                <div className="info-item"><strong>部類：</strong>{book.metadata.category}</div>
                <div className="copyright-text">
                  經典來源：中華電子佛典協會 (CBETA)
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

      {/* 💡 歷史進度接續閱讀詢問 Dialog */}
      {showResumeDialog && pendingProgress && (
        <div 
          className="reader-dialog-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <div 
            className="reader-dialog-box"
            style={{
              background: 'var(--reader-bg)',
              color: 'var(--reader-text)',
              border: '1px solid var(--theme-accent-border, rgba(242, 163, 27, 0.2))',
              borderRadius: '16px',
              padding: '2rem',
              width: '90%',
              maxWidth: '420px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
              fontFamily: 'var(--font-serif)',
              animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--theme-accent)' }}>
              偵測到歷史閱讀進度
            </div>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem', opacity: 0.9 }}>
              您上次閱讀至<strong>《{book.metadata.title}》</strong>的<br />
              <strong>「{pendingProgress.displayTitle} ({pendingProgress.percent}%)」</strong>，是否要接續閱讀？
            </p>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button 
                onClick={handleDeclineResume}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: '1px solid var(--text-muted, #ccc)',
                  background: 'transparent',
                  color: 'var(--reader-text)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                className="resume-dialog-btn-secondary"
              >
                從頭開始
              </button>
              <button 
                onClick={handleConfirmResume}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--theme-accent)',
                  color: settings.theme === 'ebony' ? '#000' : '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
                className="resume-dialog-btn-primary"
              >
                接續閱讀
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
export default ReaderView;
