import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, X, Trash2,
  Edit3, Plus
} from 'lucide-react';
import {
  getAllReadingLogs,
  deleteReadingLog,
  clearAllReadingLogs,
  getAllPracticeLogs,
  savePracticeLog,
  updatePracticeLogCount,
  deletePracticeLog,
  clearAllPracticeLogs,
  getAllHighlights,
  listBooks,
  type BookHighlight,
  type ReadingLogEntry,
  type PracticeLogEntry,
  type PracticeCategoryConfig,
  getPracticeCategories,
  savePracticeCategories
} from '../../utils/db';
import { FEATURED_BOOKS } from '../../builder/IndexBuilder';
import { getLunarInfo } from '../../utils/lunarCalendar';

interface ReadingLogViewProps {
  onClose?: () => void;
  onSelectBook: (workId: string, segmentId?: string, searchQuery?: string, autoResumeMode?: 'resume' | 'restart') => void;
  mode?: 'page' | 'modal';
}

/** 將 timestamp 格式化為 "HH:MM" */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** 將分鐘數格式化為文字（如 "45 分鐘" 或 "1 小時 15 分"） */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} 分鐘`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} 小時`;
  }
  return `${hours} 小時 ${mins} 分`;
}

/** 將分鐘數轉為時數小數（如 "24.5 小時" 或 "45 分鐘"） */
function formatDurationStat(minutes: number): string {
  if (minutes === 0) return '0 分鐘';
  if (minutes < 60) return `${minutes} 分鐘`;
  const hrs = minutes / 60;
  return Number.isInteger(hrs) ? `${hrs} 小時` : `${hrs.toFixed(1)} 小時`;
}



export function ReadingLogView({ onClose, onSelectBook, mode = 'page' }: ReadingLogViewProps) {
  const [logs, setLogs] = useState<ReadingLogEntry[]>([]);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLogEntry[]>([]);
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [booksMap, setBooksMap] = useState<Record<string, string>>({});
  const [, setLoading] = useState(true);

  // 取得經書標題 Helper
  const getBookTitle = (workId: string): string => {
    if (!workId) return '';
    const cleanId = workId.trim().toUpperCase();
    const title = booksMap[cleanId] || booksMap[workId] || '';
    if (title) return title;
    const feat = FEATURED_BOOKS.find(b => b.workId.toUpperCase() === cleanId);
    return feat?.title || '';
  };

  // 當前日曆顯示的年月
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth()); // 0 ~ 11

  // 當前選中的日期 (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 功課彈窗狀態
  const [practiceCategories, setPracticeCategories] = useState<Record<string, PracticeCategoryConfig>>(() => {
    return getPracticeCategories();
  });
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [modalCategory, setModalCategory] = useState<string>('fo');
  const [modalName, setModalName] = useState('南無阿彌陀佛');
  const [modalCount, setModalCount] = useState(1080);
  const [modalMuyuAnim, setModalMuyuAnim] = useState(false);

  useEffect(() => {
    const handleCatsChanged = (e: any) => {
      const cats = e.detail || getPracticeCategories();
      setPracticeCategories(cats);
    };
    window.addEventListener('cbeta-practice-categories-changed', handleCatsChanged);
    return () => {
      window.removeEventListener('cbeta-practice-categories-changed', handleCatsChanged);
    };
  }, []);

  // 編輯功課數量彈窗狀態
  const [editingPractice, setEditingPractice] = useState<PracticeLogEntry | null>(null);
  const [editCountInput, setEditCountInput] = useState<number>(0);

  // 載入日誌紀錄
  const loadData = async () => {
    try {
      setLoading(true);
      const [readData, pracData, highlightData, booksMeta] = await Promise.all([
        getAllReadingLogs(),
        getAllPracticeLogs(),
        getAllHighlights(),
        listBooks()
      ]);
      readData.sort((a, b) => b.startTime - a.startTime);
      pracData.sort((a, b) => b.timestamp - a.timestamp);
      highlightData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setLogs(readData);
      setPracticeLogs(pracData);
      setHighlights(highlightData);

      // 建立經書名稱對照表 (本地資料庫 + 閱讀紀錄 + 內建經典)
      const bMap: Record<string, string> = {};
      if (Array.isArray(booksMeta)) {
        booksMeta.forEach(b => {
          if (b.workId && b.title) {
            bMap[b.workId] = b.title;
            bMap[b.workId.toUpperCase()] = b.title;
          }
        });
      }
      if (Array.isArray(readData)) {
        readData.forEach(l => {
          if (l.workId && l.title) {
            if (!bMap[l.workId]) bMap[l.workId] = l.title;
            if (!bMap[l.workId.toUpperCase()]) bMap[l.workId.toUpperCase()] = l.title;
          }
        });
      }
      if (Array.isArray(FEATURED_BOOKS)) {
        FEATURED_BOOKS.forEach(b => {
          if (b.workId && b.title) {
            if (!bMap[b.workId]) bMap[b.workId] = b.title;
            if (!bMap[b.workId.toUpperCase()]) bMap[b.workId.toUpperCase()] = b.title;
          }
        });
      }
      setBooksMap(bMap);

      // 💡 自動收錄歷史功課名稱至常用選擇（例如讀者之前記錄過的「滅定業真言」自動同步收錄）
      const currentCats = getPracticeCategories();
      let hasUpdate = false;
      const updatedCats = { ...currentCats };
      let deletedSet = new Set<string>();
      try {
        const deletedRaw = localStorage.getItem('cbeta_practice_deleted_presets');
        if (deletedRaw) {
          deletedSet = new Set<string>(JSON.parse(deletedRaw));
        }
      } catch (e) {
        // ignore
      }

      pracData.forEach(p => {
        const catKey = p.category;
        if (updatedCats[catKey] && p.name && p.name.trim()) {
          const trimmed = p.name.trim();
          if (!deletedSet.has(trimmed) && !updatedCats[catKey].items.includes(trimmed)) {
            updatedCats[catKey] = {
              ...updatedCats[catKey],
              items: [...updatedCats[catKey].items, trimmed]
            };
            hasUpdate = true;
          }
        }
      });
      if (hasUpdate) {
        savePracticeCategories(updatedCats);
        setPracticeCategories(updatedCats);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('cbeta_reading_log_saved', handleUpdate);
    window.addEventListener('cbeta_practice_log_saved', handleUpdate);
    window.addEventListener('cbeta_highlights_updated', handleUpdate);
    return () => {
      window.removeEventListener('cbeta_reading_log_saved', handleUpdate);
      window.removeEventListener('cbeta_practice_log_saved', handleUpdate);
      window.removeEventListener('cbeta_highlights_updated', handleUpdate);
    };
  }, []);

  // 刪除單筆閱讀紀錄
  const handleDeleteReading = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteReadingLog(id);
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error('Failed to delete reading log:', err);
    }
  };

  // 刪除單筆功課紀錄
  const handleDeletePractice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deletePracticeLog(id);
      setPracticeLogs(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Failed to delete practice log:', err);
    }
  };

  // 清空所有紀錄
  const handleClearAll = async () => {
    try {
      await Promise.all([
        clearAllReadingLogs(),
        clearAllPracticeLogs()
      ]);
      setLogs([]);
      setPracticeLogs([]);
      setShowClearConfirm(false);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  // ── 統計計算 ──────────────────────────────────────────────
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const currentMonthLogs = useMemo(() => {
    return logs.filter(l => l.date && l.date.startsWith(currentMonthPrefix));
  }, [logs, currentMonthPrefix]);

  const monthTotalMinutes = useMemo(() => {
    return currentMonthLogs.reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);
  }, [currentMonthLogs]);

  const monthUniqueBooksCount = useMemo(() => {
    const bookSet = new Set<string>();
    currentMonthLogs.forEach(l => {
      if (l.workId) bookSet.add(l.workId);
    });
    return bookSet.size;
  }, [currentMonthLogs]);

  // 🏆 需求 4：本月最常閱讀書籍 前3名以及時數榜單
  const monthTop3Books = useMemo(() => {
    const bookMap = new Map<string, { workId: string; title: string; totalMinutes: number }>();
    currentMonthLogs.forEach(l => {
      if (!l.workId) return;
      const existing = bookMap.get(l.workId) || {
        workId: l.workId,
        title: l.title || l.workId,
        totalMinutes: 0
      };
      existing.totalMinutes += (l.durationMinutes || 0);
      bookMap.set(l.workId, existing);
    });

    const list = Array.from(bookMap.values());
    list.sort((a, b) => b.totalMinutes - a.totalMinutes);
    return list.slice(0, 3);
  }, [currentMonthLogs]);

  // 📿 需求 3：依照「本月最常閱讀書籍」邏輯製作前3名的「本月常修功課」
  const monthTop3Practices = useMemo(() => {
    const practiceMap = new Map<string, { 
      name: string; 
      category: string; 
      unit: string; 
      totalCount: number;
    }>();

    practiceLogs.forEach(p => {
      if (!p.date || !p.date.startsWith(currentMonthPrefix) || !p.name) return;
      const key = `${p.name}__${p.unit || ''}`;
      const existing = practiceMap.get(key) || {
        name: p.name,
        category: p.category,
        unit: p.unit || '遍',
        totalCount: 0
      };
      existing.totalCount += (p.count || 0);
      practiceMap.set(key, existing);
    });

    const list = Array.from(practiceMap.values());
    list.sort((a, b) => b.totalCount - a.totalCount);
    return list.slice(0, 3);
  }, [practiceLogs, currentMonthPrefix]);

  // 選中日期的閱讀記錄列表
  const selectedDateLogs = useMemo(() => {
    return logs.filter(l => l.date === selectedDate);
  }, [logs, selectedDate]);

  const selectedDateTotalMinutes = useMemo(() => {
    return selectedDateLogs.reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);
  }, [selectedDateLogs]);

  // 選中日期的功課記錄列表
  const selectedDatePractices = useMemo(() => {
    return practiceLogs.filter(p => p.date === selectedDate);
  }, [practiceLogs, selectedDate]);

  // 選中日期的重點與筆記列表 (思)
  const selectedDateHighlights = useMemo(() => {
    return highlights.filter(h => {
      if (!h.createdAt) return false;
      const d = new Date(h.createdAt);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}` === selectedDate;
    });
  }, [highlights, selectedDate]);

  // 日期 -> 有無閱讀(聞)、有無筆記(思)與有無功課(修)標記
  const dateStatusMap = useMemo(() => {
    const map = new Map<string, { hasRead: boolean; hasNotes: boolean; hasPractice: boolean }>();
    logs.forEach(l => {
      if (l.date) {
        const item = map.get(l.date) || { hasRead: false, hasNotes: false, hasPractice: false };
        item.hasRead = true;
        map.set(l.date, item);
      }
    });
    highlights.forEach(h => {
      if (h.createdAt) {
        const d = new Date(h.createdAt);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        const item = map.get(dateStr) || { hasRead: false, hasNotes: false, hasPractice: false };
        item.hasNotes = true;
        map.set(dateStr, item);
      }
    });
    practiceLogs.forEach(p => {
      if (p.date) {
        const item = map.get(p.date) || { hasRead: false, hasNotes: false, hasPractice: false };
        item.hasPractice = true;
        map.set(p.date, item);
      }
    });
    return map;
  }, [logs, practiceLogs, highlights]);

  // 選中日期的農曆與佛教資訊
  const selectedDateLunar = useMemo(() => {
    if (!selectedDate) return null;
    const parts = selectedDate.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
    return getLunarInfo(new Date(parts[0], parts[1] - 1, parts[2]));
  }, [selectedDate]);
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayRaw = new Date(currentYear, currentMonth, 1).getDay(); // 0(Sun) ~ 6(Sat)
  const firstDayOffset = (firstDayRaw + 6) % 7;

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleGoToToday = () => {
    const t = new Date();
    setCurrentYear(t.getFullYear());
    setCurrentMonth(t.getMonth());
    setSelectedDate(todayStr);
  };

  // ── 新增功課功能 ──────────────────────────────────────────────
  const handleOpenPracticeModal = () => {
    setModalCategory('fo');
    setModalName('南無阿彌陀佛');
    setModalCount(1080);
    setShowPracticeModal(true);
  };

  const handleSwitchCategory = (cat: string) => {
    setModalCategory(cat);
    const cfg = practiceCategories[cat];
    const items = cfg?.items || [];
    if (items.length > 0) {
      setModalName(items[0]);
    } else {
      setModalName('');
    }
    if (cat === 'fo') setModalCount(1080);
    else if (cat === 'zhou') setModalCount(21);
    else if (cat === 'jing') setModalCount(1);
    else setModalCount(108);
  };

  const handleSelectPresetItem = (name: string) => {
    setModalName(name);
    if (name === '禮佛大拜') {
      setModalCount(108);
    } else if (name === '靜坐禪修') {
      setModalCount(45);
    }
  };

  // 💡 讀者自由刪除常用膠囊項目
  const handleDeletePresetItem = (catKey: string, itemToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentCat = practiceCategories[catKey];
    if (!currentCat) return;
    const updatedItems = currentCat.items.filter(it => it !== itemToDelete);
    const updatedCats = {
      ...practiceCategories,
      [catKey]: {
        ...currentCat,
        items: updatedItems
      }
    };
    try {
      const deletedRaw = localStorage.getItem('cbeta_practice_deleted_presets');
      const deletedSet = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);
      deletedSet.add(itemToDelete);
      localStorage.setItem('cbeta_practice_deleted_presets', JSON.stringify(Array.from(deletedSet)));
    } catch (err) {
      // ignore
    }
    savePracticeCategories(updatedCats);
    setPracticeCategories(updatedCats);
    if (modalName === itemToDelete) {
      setModalName(updatedItems[0] || '');
    }
  };

  const handleSavePractice = async () => {
    const trimmed = modalName.trim();
    if (!trimmed) return;
    let unit = practiceCategories[modalCategory]?.unit || '次';
    if (trimmed === '禮佛大拜') unit = '拜';
    if (trimmed === '靜坐禪修') unit = '分鐘';

    // 💡 自動收錄：若讀者自行輸入或修改之修持名稱尚未在該大類清單中，自動加入「常用選擇」
    const currentCat = practiceCategories[modalCategory];
    if (currentCat && !currentCat.items.includes(trimmed)) {
      const updatedCats = {
        ...practiceCategories,
        [modalCategory]: {
          ...currentCat,
          items: [...currentCat.items, trimmed]
        }
      };
      savePracticeCategories(updatedCats);
      setPracticeCategories(updatedCats);
    }

    const newEntry: PracticeLogEntry = {
      id: 'p_' + Date.now(),
      date: selectedDate,
      timestamp: Date.now(),
      category: modalCategory,
      name: trimmed,
      count: Math.max(1, modalCount),
      unit
    };

    try {
      await savePracticeLog(newEntry);
      setPracticeLogs(prev => [newEntry, ...prev]);
      setShowPracticeModal(false);
      window.dispatchEvent(new CustomEvent('cbeta_practice_log_saved'));
    } catch (e) {
      console.error('Failed to save practice log:', e);
    }
  };

  // ── 讀經一鍵轉入持經功課 ─────────────────────────────────────
  const handleSyncReadingToPractice = async (reading: ReadingLogEntry) => {
    const newEntry: PracticeLogEntry = {
      id: 'p_sync_' + Date.now(),
      date: selectedDate,
      timestamp: Date.now(),
      category: 'jing',
      name: reading.title || reading.workId,
      count: 1,
      unit: '部',
      note: `讀經同步 (${formatDuration(reading.durationMinutes || 0)})`
    };

    try {
      await savePracticeLog(newEntry);
      setPracticeLogs(prev => [newEntry, ...prev]);
    } catch (e) {
      console.error('Failed to sync reading to practice:', e);
    }
  };

  // ── 編輯功課數量功能 ──────────────────────────────────────────
  const handleOpenEditCount = (p: PracticeLogEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPractice(p);
    setEditCountInput(p.count);
  };

  const handleSaveEditCount = async () => {
    if (!editingPractice) return;
    const newCount = Math.max(0, editCountInput);
    try {
      await updatePracticeLogCount(editingPractice.id, newCount);
      setPracticeLogs(prev => prev.map(item => item.id === editingPractice.id ? { ...item, count: newCount } : item));
      setEditingPractice(null);
    } catch (e) {
      console.error('Failed to update practice count:', e);
    }
  };

  const isPageMode = mode === 'page';

  const bodyContent = (
    <div
      className="reading-log-body-content custom-scrollbar"
      style={{
        padding: isPageMode ? '0' : '1.1rem',
        overflowY: isPageMode ? 'visible' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem',
        overscrollBehavior: 'contain'
      }}
    >
      {/* ========================================================================= */}
      {/* 💡 1. 禪意月曆檢視 ＋ 選中日期資訊卡片 (圖 2：置頂呈現)                   */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {/* 禪意月曆卡片 */}
        <div style={{
          border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
          borderRadius: '14px',
          padding: '0.8rem 0.6rem',
          backgroundColor: 'var(--bg-primary, rgba(0,0,0,0.02))'
        }}>
          {/* 月份導航列 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
            padding: '0 0.3rem'
          }}>
            <button
              onClick={handlePrevMonth}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '6px'
              }}
              title="上個月"
            >
              <ChevronLeft size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '1rem',
                fontWeight: 700,
                fontFamily: 'var(--font-serif)',
                color: 'var(--text-primary)'
              }}>
                {currentYear} 年 {currentMonth + 1} 月
              </span>
              <button
                onClick={handleGoToToday}
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, rgba(0,0,0,0.12))',
                  backgroundColor: 'var(--theme-accent-light, rgba(139, 90, 43, 0.08))',
                  color: 'var(--theme-accent, #8b5a2b)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                今天
              </button>
            </div>

            <button
              onClick={handleNextMonth}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '6px'
              }}
              title="下個月"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 星期一 ~ 星期日 標頭 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            fontSize: '0.76rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: '0.4rem',
            paddingBottom: '4px',
            borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.06))'
          }}>
            <span>一</span>
            <span>二</span>
            <span>三</span>
            <span>四</span>
            <span>五</span>
            <span>六</span>
            <span>日</span>
          </div>

          {/* 日期網格 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '3px'
          }}>
            {/* 前月留白 */}
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`offset-${i}`} style={{ minHeight: '52px' }} />
            ))}

            {/* 當月天數 */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const status = dateStatusMap.get(dateStr) || { hasRead: false, hasNotes: false, hasPractice: false };
              const lunarInfo = getLunarInfo(new Date(currentYear, currentMonth, dayNum));

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    minHeight: '52px',
                    borderRadius: '9px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '3px 1px',
                    cursor: 'pointer',
                    position: 'relative',
                    backgroundColor: isSelected
                      ? 'var(--surface-capsule-active, var(--theme-accent-light, rgba(139, 90, 43, 0.18)))'
                      : isToday
                        ? 'var(--surface-capsule, rgba(139, 90, 43, 0.08))'
                        : 'transparent',
                    border: isSelected
                      ? '1.5px solid var(--theme-accent, #8b5a2b)'
                      : '1px solid transparent',
                    boxShadow: isSelected ? '0 1px 4px rgba(139, 90, 43, 0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* 國曆公曆日期數字 */}
                  <span style={{
                    fontSize: '0.86rem',
                    fontWeight: isSelected || isToday ? 700 : 500,
                    color: isSelected
                      ? 'var(--theme-accent, #8b5a2b)'
                      : isToday
                        ? 'var(--theme-accent, #8b5a2b)'
                        : 'var(--text-primary)',
                    fontFamily: 'var(--font-serif)',
                    lineHeight: 1.1
                  }}>
                    {dayNum}
                  </span>

                  {/* 今日圓點微指示 */}
                  {isToday && (
                    <div style={{
                      position: 'absolute',
                      top: '3px',
                      right: '3px',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--theme-accent, #8b5a2b)'
                    }} />
                  )}

                  {/* 農曆 / 佛誕 / 十齋標籤 */}
                  <span style={{
                    fontSize: '0.62rem',
                    lineHeight: 1.1,
                    marginTop: '1px',
                    whiteSpace: 'nowrap',
                    fontWeight: (lunarInfo.festival || lunarInfo.isZhai || lunarInfo.specialMoon) ? 700 : 400,
                    color: lunarInfo.festival
                      ? '#c0392b'
                      : lunarInfo.specialMoon
                        ? '#b45309'
                        : lunarInfo.isZhai
                          ? '#2d6a4f'
                          : 'var(--text-muted)'
                  }}>
                    {lunarInfo.cellLabel}
                  </span>

                  {/* 底部三慧微圓點：綠點(聞)、藍點(思) 與金點(修)，最多 3 個點點，外圍帶細小光暈 */}
                  <div style={{ display: 'flex', gap: '3.5px', marginTop: 'auto', alignItems: 'center', minHeight: '6px', justifyContent: 'center' }}>
                    {status.hasRead && (
                      <span 
                        title="聞：當日有閱讀經文"
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: '#2e7d32',
                          boxShadow: '0 0 4px rgba(46, 125, 50, 0.75)',
                          display: 'inline-block',
                          flexShrink: 0
                        }} 
                      />
                    )}
                    {status.hasNotes && (
                      <span 
                        title="思：當日有劃線筆記"
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: '#1976d2',
                          boxShadow: '0 0 4px rgba(25, 118, 210, 0.75)',
                          display: 'inline-block',
                          flexShrink: 0
                        }} 
                      />
                    )}
                    {status.hasPractice && (
                      <span 
                        title="修：當日有修持功課"
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: '#d4a017',
                          boxShadow: '0 0 4px rgba(212, 160, 23, 0.85)',
                          display: 'inline-block',
                          flexShrink: 0
                        }} 
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 選中日期資訊卡片 (深色模式底色) */}
        <div style={{
          backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.08))',
          border: '1px solid var(--border-subtle, var(--border-color, rgba(255, 255, 255, 0.14)))',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{
              fontSize: '0.94rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)'
            }}>
              <span>{selectedDate}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{selectedDateLunar ? selectedDateLunar.fullStr : '農曆吉日'}</span>
              {selectedDateLunar?.specialMoon && (
                <span style={{ color: '#8c6000', fontWeight: 700 }}>
                  · {selectedDateLunar.specialMoon}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            {selectedDateLunar?.specialMoon && (
              <span style={{
                backgroundColor: 'rgba(184, 134, 11, 0.12)',
                color: '#8c6000',
                border: '1px solid rgba(184, 134, 11, 0.3)',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                {selectedDateLunar.specialMoon === '白月' ? (
                  /* 🌕 白月：白色圓圈月亮，表示即將滿月的樣子 */
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="6" fill="#ffffff" stroke="#b45309" strokeWidth="1.2" />
                  </svg>
                ) : (
                  /* 🌑 黑月：白色細細弦月的月亮，表示即將看不到月亮的樣子 */
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="6" stroke="#b45309" strokeWidth="0.75" strokeDasharray="1.5 1.5" opacity="0.35" />
                    <path d="M 8 2 A 6 6 0 0 0 8 14 A 5.3 5.3 0 0 1 8 2 Z" fill="#ffffff" stroke="#b45309" strokeWidth="0.8" />
                  </svg>
                )}
                <span>{selectedDateLunar.specialMoon} · 南無地藏菩薩</span>
              </span>
            )}
            {selectedDateLunar?.festival && (
              <span 
                className="festival-status-badge"
                style={{
                  backgroundColor: 'rgba(192, 57, 43, 0.12)',
                  color: '#dc2626',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}
              >
                🌸 {selectedDateLunar.festival}
              </span>
            )}
            {selectedDateLunar?.isZhai && (
              <span 
                className="zhai-status-badge"
                style={{
                  backgroundColor: 'rgba(22, 101, 52, 0.1)',
                  color: 'var(--zhai-badge-text, #15803d)',
                  border: '1px solid rgba(22, 101, 52, 0.3)',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}
              >
                🌿 十齋日 · 茹素修善
              </span>
            )}
            {!selectedDateLunar?.festival && !selectedDateLunar?.isZhai && !selectedDateLunar?.specialMoon && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                深入經藏 · 智慧如海
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 💡 2. 選中日期的專區 (聞·思·修) (圖 1)                                   */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* 區塊 B：📖 經文閱讀記錄 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2px'
          }}>
            <div style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#2e7d32',
                boxShadow: '0 0 5px rgba(46, 125, 50, 0.75)',
                display: 'inline-block',
                flexShrink: 0
              }} />
              <span>聞：閱讀記錄</span>
            </div>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {selectedDateLogs.length > 0
                ? `共 ${selectedDateLogs.length} 筆 • 累計 ${formatDuration(selectedDateTotalMinutes)}`
                : '無閱讀紀錄'}
            </span>
          </div>

          {selectedDateLogs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '1.4rem 1rem',
              backgroundColor: 'var(--bg-primary, rgba(0,0,0,0.02))',
              borderRadius: '10px',
              border: '1px dashed var(--border-color, rgba(0,0,0,0.1))',
              color: 'var(--text-muted)',
              fontSize: '0.82rem'
            }}>
              此日尚無經文閱讀紀錄
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedDateLogs.map(log => (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-card, #fff)',
                    border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
                    borderLeft: '3.5px solid var(--tag-listen-border, #2d6a4f)',
                    gap: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-serif)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {log.title || log.workId}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>⏱ {formatTime(log.startTime)} ~ {formatTime(log.endTime)}</span>
                      <span>•</span>
                      <span style={{
                        color: 'var(--tag-listen-text, #2d6a4f)',
                        fontWeight: 600,
                        backgroundColor: 'var(--tag-listen-bg, rgba(45, 106, 79, 0.08))',
                        border: '1px solid var(--tag-listen-border, transparent)',
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}>
                        {formatDuration(log.durationMinutes)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {/* 接續閱讀：改為「>」圓圈 */}
                    <button
                      type="button"
                      onClick={() => onSelectBook(log.workId, undefined, undefined, 'resume')}
                      title="接續閱讀此經"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: '#15803d',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        padding: 0,
                        boxSizing: 'border-box',
                        boxShadow: '0 2px 4px rgba(21, 128, 61, 0.25)',
                        transition: 'transform 0.12s ease'
                      }}
                    >
                      <ChevronRight size={15} strokeWidth={2.8} />
                    </button>

                    {/* 讀經一鍵轉持經：改為精緻「+修」圓圈 */}
                    <button
                      type="button"
                      onClick={() => handleSyncReadingToPractice(log)}
                      title="轉持經 · 將此閱讀紀錄納入今日功課"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--tag-practice-bg, rgba(184, 134, 11, 0.12))',
                        color: 'var(--tag-practice-text, #8c6000)',
                        border: '1px solid var(--tag-practice-border, rgba(184, 134, 11, 0.32))',
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        padding: 0,
                        boxSizing: 'border-box',
                        transition: 'transform 0.12s ease'
                      }}
                    >
                      +修
                    </button>

                    {/* 刪除紀錄：圓圈垃圾桶 */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteReading(log.id, e)}
                      title="刪除紀錄"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--surface-capsule, rgba(0,0,0,0.04))',
                        border: '1px solid var(--border-color, rgba(0,0,0,0.06))',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        padding: 0,
                        boxSizing: 'border-box',
                        transition: 'transform 0.12s ease'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 區塊 C：✍️ 今日筆記與重點標註 (思) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2px'
          }}>
            <div style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#1976d2',
                boxShadow: '0 0 5px rgba(25, 118, 210, 0.75)',
                display: 'inline-block',
                flexShrink: 0
              }} />
              <span>思：我的筆記</span>
            </div>

            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              共 {selectedDateHighlights.length} 則標註
            </span>
          </div>

          {selectedDateHighlights.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: 'var(--bg-primary, rgba(0,0,0,0.02))',
              borderRadius: '10px',
              border: '1px dashed var(--border-color, rgba(0,0,0,0.1))',
              color: 'var(--text-muted)',
              fontSize: '0.8rem'
            }}>
              此日尚無經文劃線或心得筆記
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedDateHighlights.map((hl) => {
                const rawTitle = getBookTitle(hl.workId);
                const cleanTitle = (rawTitle || '').replace(/[《》]/g, '').trim();

                return (
                  <div
                    key={hl.id}
                    style={{
                      padding: '0.7rem 0.85rem',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-card, #fff)',
                      border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
                      borderLeft: '3.5px solid var(--tag-think-border, #1e4b6e)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                        {cleanTitle && (
                          <span 
                            title={cleanTitle}
                            style={{
                              fontSize: '0.84rem',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-serif)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            《{cleanTitle}》
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'var(--tag-think-text, #1e4b6e)',
                          backgroundColor: 'var(--tag-think-bg, rgba(30, 75, 110, 0.08))',
                          border: '1px solid var(--tag-think-border, transparent)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          flexShrink: 0
                        }}>
                          {hl.workId} · 第 {hl.juan} 卷
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectBook(hl.workId, hl.segmentId, undefined, 'resume')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--theme-accent, #8b5a2b)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          flexShrink: 0
                        }}
                        title="直接開啟此段經文"
                      >
                        <span>直達經文</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>

                  <div style={{
                    fontSize: '0.84rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-serif)',
                    lineHeight: 1.45,
                    fontStyle: 'italic'
                  }}>
                    「{hl.text}」
                  </div>

                  {hl.note && (
                    <div style={{
                      marginTop: '2px',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'rgba(184, 134, 11, 0.08)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      lineHeight: 1.35
                    }}>
                      <span style={{ fontWeight: 600, marginRight: '4px' }}>💭 心得：</span>
                      {hl.note}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 區塊 D：📿 我的功課記錄 (修) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2px'
          }}>
            <div style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#d4a017',
                boxShadow: '0 0 5px rgba(212, 160, 23, 0.85)',
                display: 'inline-block',
                flexShrink: 0
              }} />
              <span>修：我的功課</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                共 {selectedDatePractices.length} 項功課
              </span>
              <button
                onClick={handleOpenPracticeModal}
                style={{
                  background: 'linear-gradient(135deg, #b8860b 0%, #8b5a2b 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '3px 10px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <Plus size={13} />
                <span>記錄功課</span>
              </button>
            </div>
          </div>

          {selectedDatePractices.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '1.4rem 1rem',
              backgroundColor: 'var(--bg-primary, rgba(0,0,0,0.02))',
              borderRadius: '10px',
              border: '1px dashed var(--border-color, rgba(0,0,0,0.1))',
              color: 'var(--text-muted)',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>此日尚未有念佛、持咒或持經紀錄</span>
              <button
                onClick={handleOpenPracticeModal}
                style={{
                  background: 'none',
                  border: '1px solid var(--theme-accent, #8b5a2b)',
                  color: 'var(--theme-accent, #8b5a2b)',
                  borderRadius: '12px',
                  padding: '3px 10px',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                ＋ 馬上記錄今日功課
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedDatePractices.map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-card, #fff)',
                    border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
                    borderLeft: '3.5px solid #b8860b',
                    gap: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-serif)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(184, 134, 11, 0.12)',
                        color: '#925800'
                      }}>
                        {practiceCategories[p.category]?.name || '修持'}
                      </span>
                      <span>{p.name}</span>
                    </div>

                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap'
                    }}>
                      <span>累計完成</span>
                      {/* 可點選修改數量 */}
                      <span
                        onClick={(e) => handleOpenEditCount(p, e)}
                        title="點擊修改數量"
                        style={{
                          color: 'var(--theme-accent, #d97706)',
                          fontWeight: 700,
                          backgroundColor: 'var(--surface-capsule, rgba(184, 134, 11, 0.16))',
                          padding: '1px 8px',
                          borderRadius: '12px',
                          border: '1px dashed var(--theme-accent, rgba(184, 134, 11, 0.45))',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <span>{p.count.toLocaleString()} {p.unit}</span>
                      </span>
                      <span style={{ color: '#2d6a4f', fontWeight: 600 }}>✓ 圓滿</span>
                      {p.note && (
                        <span style={{ color: '#8c6000', fontSize: '0.72rem' }}>[{p.note}]</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {/* 編輯數量按鈕 */}
                    <button
                      onClick={(e) => handleOpenEditCount(p, e)}
                      title="編輯數量"
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        border: '1px solid var(--border-subtle, var(--border-color, rgba(255, 255, 255, 0.15)))',
                        backgroundColor: 'var(--surface-capsule, var(--bg-card-subtle, rgba(255, 255, 255, 0.08)))',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Edit3 size={13} />
                    </button>

                    <button
                      onClick={(e) => handleDeletePractice(p.id, e)}
                      title="刪除修持"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 💡 3. 本月看板：雙核心指標 + 本月最常閱讀書籍 + 本月常修功課 (圖 2 置於圖 1 下方) */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {/* 上排兩大指標看板 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.6rem'
        }}>
          {/* 本月閱讀時數 */}
          <div style={{
            backgroundColor: 'var(--theme-accent-light, rgba(139, 90, 43, 0.06))',
            border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
            borderRadius: '12px',
            padding: '0.75rem 0.6rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>本月閱讀時數</span>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--theme-accent, #8b5a2b)',
              fontFamily: 'var(--font-serif)'
            }}>
              {formatDurationStat(monthTotalMinutes)}
            </span>
          </div>

          {/* 本月閱讀本數 */}
          <div style={{
            backgroundColor: 'var(--theme-accent-light, rgba(139, 90, 43, 0.06))',
            border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
            borderRadius: '12px',
            padding: '0.75rem 0.6rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>本月閱讀本數</span>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--theme-accent, #8b5a2b)',
              fontFamily: 'var(--font-serif)'
            }}>
              {monthUniqueBooksCount} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>本</span>
            </span>
          </div>
        </div>

        {/* 下排：🏆 本月最常閱讀書籍 前3名以及時數 (含「繼續閱讀 ›」) */}
        <div style={{
          backgroundColor: 'var(--bg-card, #fff)',
          border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
          borderRadius: '14px',
          padding: '0.85rem 0.95rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.06))',
            paddingBottom: '6px'
          }}>
            <div style={{
              fontSize: '0.86rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🏆</span>
              <span>本月最常閱讀書籍</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              累積時數榜單
            </span>
          </div>

          {monthTop3Books.length === 0 ? (
            <div style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              本月尚無閱讀累計時數
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {monthTop3Books.map((book, idx) => {
                const medalColors = [
                  { bg: '#ffd700', color: '#7a5800' }, // 1
                  { bg: '#dcdde1', color: '#474747' }, // 2
                  { bg: '#e0a96d', color: '#4a2800' }  // 3
                ];
                const medal = medalColors[idx] || medalColors[2];

                return (
                  <div
                    key={book.workId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card-subtle, rgba(0,0,0,0.02))',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <span style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: medal.bg,
                        color: medal.color,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-serif)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {book.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--theme-accent, #d97706)',
                        backgroundColor: 'var(--surface-capsule, var(--bg-card-subtle, rgba(255, 255, 255, 0.08)))',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-subtle, var(--border-color, rgba(255, 255, 255, 0.12)))'
                      }}>
                        {formatDurationStat(book.totalMinutes)}
                      </span>
                      <button
                        onClick={() => onSelectBook(book.workId, undefined, undefined, 'resume')}
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: 'var(--theme-accent-contrast, #ffffff)',
                          backgroundColor: 'var(--theme-accent, #8c4b27)',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '3px 10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
                          transition: 'all 0.15s ease'
                        }}
                        title="接續閱讀此經典"
                      >
                        <span>繼續閱讀</span>
                        <span style={{ fontWeight: 800 }}>›</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 📿 需求 3：🏆 本月常修功課 前3名以及修持數量 (放置於「本月最常閱讀書籍」之後) */}
        <div style={{
          backgroundColor: 'var(--bg-card, #fff)',
          border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
          borderRadius: '14px',
          padding: '0.85rem 0.95rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.06))',
            paddingBottom: '6px'
          }}>
            <div style={{
              fontSize: '0.86rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📿</span>
              <span>本月常修功課</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              累積修持榜單
            </span>
          </div>

          {monthTop3Practices.length === 0 ? (
            <div style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              本月尚無修持功課紀錄
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {monthTop3Practices.map((practice, idx) => {
                const medalColors = [
                  { bg: '#ffd700', color: '#7a5800' }, // 1
                  { bg: '#dcdde1', color: '#474747' }, // 2
                  { bg: '#e0a96d', color: '#4a2800' }  // 3
                ];
                const medal = medalColors[idx] || medalColors[2];

                return (
                  <div
                    key={`${practice.name}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card-subtle, rgba(0,0,0,0.02))',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <span style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: medal.bg,
                        color: medal.color,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-serif)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {practice.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--theme-accent, #d97706)',
                        backgroundColor: 'var(--surface-capsule, var(--bg-card-subtle, rgba(255, 255, 255, 0.08)))',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-subtle, var(--border-color, rgba(255, 255, 255, 0.12)))'
                      }}>
                        {practice.totalCount.toLocaleString()} {practice.unit}
                      </span>
                      <button
                        onClick={() => {
                          setModalCategory(practice.category || 'fo');
                          setModalName(practice.name);
                          if (practice.category === 'fo') setModalCount(1080);
                          else if (practice.category === 'zhou') setModalCount(21);
                          else if (practice.category === 'jing') setModalCount(1);
                          else setModalCount(108);
                          setShowPracticeModal(true);
                        }}
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: 'var(--theme-accent-contrast, #ffffff)',
                          backgroundColor: 'var(--theme-accent, #8c4b27)',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '3px 10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
                          transition: 'all 0.15s ease'
                        }}
                        title={`記錄 ${practice.name}`}
                      >
                        <span>+ 記錄</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 底部功能按鈕 */}
      <div style={{
        marginTop: '0.6rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '0.8rem',
        borderTop: '1px solid var(--border-color, rgba(0,0,0,0.06))'
      }}>
        {showClearConfirm ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#c0392b', fontWeight: 600 }}>
              確定清空所有紀錄嗎？
            </span>
            <button
              onClick={handleClearAll}
              style={{
                padding: '4px 10px',
                fontSize: '0.76rem',
                backgroundColor: '#c0392b',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              確定清空
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              style={{
                padding: '4px 10px',
                fontSize: '0.76rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowClearConfirm(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 6px',
                opacity: 0.7
              }}
            >
              <Trash2 size={13} />
              <span>清空所有日誌紀錄</span>
            </button>

            {!isPageMode && onClose && (
              <button
                onClick={onClose}
                style={{ 
                  padding: '5px 16px', 
                  fontSize: '0.82rem', 
                  borderRadius: '8px',
                  backgroundColor: 'var(--theme-accent-light, rgba(139, 90, 43, 0.08))',
                  border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
                  color: 'var(--theme-accent, #8b5a2b)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                關閉
              </button>
            )}
          </>
        )}
      </div>

      {/* ── 彈窗 1：新增功課彈窗 ── */}
      {showPracticeModal && (
        <div 
          className="practice-modal-backdrop"
          onClick={() => setShowPracticeModal(false)}
        >
          <div 
            className="practice-modal-window"
            onClick={e => e.stopPropagation()}
          >
            <div className="practice-modal-header">
              <span className="practice-modal-title">
                📿 今日修持功課記數
              </span>
              <button 
                type="button"
                className="practice-modal-close-btn"
                onClick={() => setShowPracticeModal(false)}
                title="關閉"
              >
                <X size={18} />
              </button>
            </div>

            <div className="practice-modal-body">
              {/* 大類切換標籤 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span className="practice-section-label">選擇修持大類</span>
                <div className="practice-cat-tabs">
                  {Object.keys(practiceCategories).map(catKey => {
                    const cat = practiceCategories[catKey];
                    const isCatSelected = modalCategory === catKey;
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => handleSwitchCategory(catKey)}
                        className={`practice-cat-tab-btn ${isCatSelected ? 'active' : ''}`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 中類快捷選擇（圖5膠囊型式 + 右上方/右側可刪除 x） */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="practice-section-label">
                    {practiceCategories[modalCategory]?.label || `常用${practiceCategories[modalCategory]?.name || '修持'}選擇`}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>點擊選取 · 點「×」刪除</span>
                </div>
                <div className="practice-preset-pills-wrap">
                  {(practiceCategories[modalCategory]?.items || []).map(item => {
                    const isSelected = modalName === item;
                    return (
                      <div
                        key={item}
                        className={`practice-preset-pill ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectPresetItem(item)}
                        title={`點擊選取「${item}」`}
                      >
                        <span className="practice-pill-text">{item}</span>
                        <button
                          type="button"
                          className="practice-pill-del-btn"
                          onClick={(e) => handleDeletePresetItem(modalCategory, item, e)}
                          title={`刪除「${item}」常用項目`}
                          aria-label={`刪除「${item}」常用項目`}
                        >
                          <X size={11} strokeWidth={2.4} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 自訂修持名稱 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="practice-section-label">
                    修持名稱 (可直接自訂修改)
                  </span>
                  {modalName.trim() && !(practiceCategories[modalCategory]?.items || []).includes(modalName.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = modalName.trim();
                        if (!trimmed) return;
                        const currentCat = practiceCategories[modalCategory];
                        if (currentCat && !currentCat.items.includes(trimmed)) {
                          const updated = {
                            ...practiceCategories,
                            [modalCategory]: {
                              ...currentCat,
                              items: [...currentCat.items, trimmed]
                            }
                          };
                          savePracticeCategories(updated);
                          setPracticeCategories(updated);
                        }
                      }}
                      style={{
                        background: 'rgba(184, 134, 11, 0.12)',
                        border: '1px dashed #b8860b',
                        color: '#925800',
                        borderRadius: '6px',
                        padding: '1px 8px',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                      title="立即加入常用選擇清單"
                    >
                      ＋ 加入常用
                    </button>
                  )}
                </div>
                <input 
                  type="text" 
                  className="practice-modal-input"
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  placeholder="輸入佛號、咒語或經名（儲存時自動收錄）"
                />
              </div>

              {/* 數量輸入與快捷加數 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span className="practice-section-label">
                    {practiceCategories[modalCategory]?.countLabel || '修持數量'}
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--theme-accent, #8b5a2b)', fontWeight: 600 }}>
                    單位：{practiceCategories[modalCategory]?.unit || '次'}
                  </span>
                </div>
                <input 
                  type="number" 
                  className="practice-modal-input"
                  value={modalCount}
                  onChange={e => setModalCount(parseInt(e.target.value, 10) || 0)}
                  min={1}
                />
                
                {/* 圖 3：5 個等級小膠囊 (100, 200, 500, 800, 1000) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {[100, 200, 500, 800, 1000].map(levelVal => {
                    const isSelected = modalCount === levelVal;
                    return (
                      <button
                        key={levelVal}
                        type="button"
                        onClick={() => setModalCount(levelVal)}
                        style={{
                          padding: '6px 0',
                          borderRadius: '16px',
                          border: isSelected ? '1.5px solid var(--theme-accent, #8b5a2b)' : '1px solid var(--border-color, rgba(0,0,0,0.12))',
                          backgroundColor: isSelected ? 'var(--theme-accent-light, rgba(139, 90, 43, 0.12))' : 'var(--bg-card-subtle, rgba(0,0,0,0.03))',
                          color: isSelected ? 'var(--theme-accent, #8b5a2b)' : 'var(--text-primary)',
                          fontSize: '0.84rem',
                          fontWeight: isSelected ? 700 : 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title={`設定修持數量為 ${levelVal}`}
                      >
                        {levelVal}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 圖 4 & 圖 5：隨喜撥珠計數器提示框 (改為圖5 敲木魚圖標) */}
              <div className="practice-modal-bead-hint">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, fontFamily: 'var(--font-serif)' }}>
                    隨喜撥珠計數器
                  </span>
                  <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                    點擊右側木魚即時 +1 累計
                  </span>
                </div>
                <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setModalCount(prev => prev + 1);
                      setModalMuyuAnim(true);
                      setTimeout(() => setModalMuyuAnim(false), 500);
                    }}
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      transition: 'transform 0.1s ease',
                      display: 'block'
                    }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    title="敲木魚誦念 (+1)"
                  >
                    <svg className="bead-muyu-svg" viewBox="0 0 100 100" aria-hidden="true">
                      <defs>
                        <linearGradient id="modal_muyu_bg" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#cce1d2" />
                          <stop offset="100%" stopColor="#accfb8" />
                        </linearGradient>
                        <linearGradient id="modal_muyu_wood" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#a36e4b" />
                          <stop offset="100%" stopColor="#7a4625" />
                        </linearGradient>
                      </defs>

                      {/* 圓形淡綠底色 */}
                      <circle cx="50" cy="50" r="47" fill="url(#modal_muyu_bg)" stroke="#ffffff" strokeWidth="2.5" />

                      {/* 敲擊音浪 */}
                      <line x1="65" y1="33" x2="69" y2="19" stroke="#e69627" strokeWidth="3.6" strokeLinecap="round" />
                      <line x1="77" y1="36" x2="88" y2="26" stroke="#e69627" strokeWidth="3.6" strokeLinecap="round" />

                      {/* 木魚厚圓底座 */}
                      <rect x="22" y="65" width="46" height="13" rx="6.5" fill="#583015" stroke="#361a0a" strokeWidth="2.4" />

                      {/* 木魚主身 */}
                      <path d="M 23 66 C 22 41 33 28 45 28 C 57 28 69 41 68 66 Z" fill="url(#modal_muyu_wood)" stroke="#361a0a" strokeWidth="2.4" />

                      {/* 木魚高光 */}
                      <ellipse cx="53" cy="37" rx="4.5" ry="2.6" transform="rotate(-20 53 37)" fill="#ffffff" opacity="0.4" />

                      {/* 木魚開口橫縫 */}
                      <path d="M 27 61 C 37 47 53 49 63 56 C 61 60 45 53 29 63 Z" fill="#301607" stroke="#301607" strokeWidth="0.8" strokeLinejoin="round" />

                      {/* 木魚槌手柄 */}
                      <line x1="73" y1="51" x2="90" y2="76" stroke="#6e3914" strokeWidth="5.5" strokeLinecap="round" />

                      {/* 木魚槌頭 */}
                      <circle cx="72" cy="49" r="7.5" fill="#fdfaf2" stroke="#361a0a" strokeWidth="2.2" />
                      <circle cx="70" cy="47" r="2.2" fill="#ffffff" />
                    </svg>
                  </button>
                  {modalMuyuAnim && <span className="bead-tap-plus-one">+1</span>}
                </div>
              </div>
            </div>

            <div className="practice-modal-footer">
              <button
                type="button"
                className="practice-modal-btn-cancel"
                onClick={() => setShowPracticeModal(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="practice-modal-btn-submit"
                onClick={handleSavePractice}
              >
                儲存今日功課
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 彈窗 2：編輯功課數量彈窗 ── */}
      {editingPractice && (
        <div 
          className="practice-modal-backdrop"
          onClick={() => setEditingPractice(null)}
        >
          <div 
            className="practice-modal-window"
            style={{ maxWidth: '340px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="practice-modal-header">
              <span className="practice-modal-title">
                編輯：{editingPractice.name}
              </span>
              <button 
                type="button"
                className="practice-modal-close-btn"
                onClick={() => setEditingPractice(null)}
                title="關閉"
              >
                <X size={16} />
              </button>
            </div>

            <div className="practice-modal-body" style={{ gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="practice-section-label">今日完成數量</span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--theme-accent, #8b5a2b)', fontWeight: 600 }}>
                    單位：{editingPractice.unit}
                  </span>
                </div>
                <input 
                  type="number" 
                  className="practice-modal-input"
                  value={editCountInput}
                  onChange={e => setEditCountInput(parseInt(e.target.value, 10) || 0)}
                  min={0}
                />
              </div>

              {/* 圖 2 編輯數量：同步改為圖 3 的 5 個膠囊 (100, 200, 500, 800, 1000) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {[100, 200, 500, 800, 1000].map(levelVal => {
                  const isSelected = editCountInput === levelVal;
                  return (
                    <button
                      key={levelVal}
                      type="button"
                      onClick={() => setEditCountInput(levelVal)}
                      style={{
                        padding: '6px 0',
                        borderRadius: '16px',
                        border: isSelected ? '1.5px solid var(--theme-accent, #8b5a2b)' : '1px solid var(--border-color, rgba(0,0,0,0.12))',
                        backgroundColor: isSelected ? 'var(--theme-accent-light, rgba(139, 90, 43, 0.12))' : 'var(--bg-card-subtle, rgba(0,0,0,0.03))',
                        color: isSelected ? 'var(--theme-accent, #8b5a2b)' : 'var(--text-primary)',
                        fontSize: '0.84rem',
                        fontWeight: isSelected ? 700 : 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title={`設定修持數量為 ${levelVal}`}
                    >
                      {levelVal}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="practice-modal-footer">
              <button
                type="button"
                className="practice-modal-btn-cancel"
                onClick={() => setEditingPractice(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="practice-modal-btn-submit"
                onClick={handleSaveEditCount}
              >
                儲存數量
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

if (isPageMode) {
  return (
    <div
      className="reading-log-page-container animate-fade-in custom-scrollbar"
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        padding: '1.2rem 1rem 3.5rem',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ maxWidth: '840px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {bodyContent}
      </div>
    </div>
  );
}

return (
  <div className="search-dialog-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
    <div
      className="search-dialog-card animate-slide-up"
      onClick={e => e.stopPropagation()}
      style={{
        maxWidth: '520px',
        width: '94vw',
        maxHeight: '90vh',
        borderRadius: '16px',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-card, #fff)'
      }}
    >
      <div
        className="dialog-header"
        style={{
          padding: '0.9rem 1.2rem',
          borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-card, #fff)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarDays size={20} style={{ color: 'var(--theme-accent, #8b5a2b)' }} />
          <h3 style={{
            margin: 0,
            fontSize: '1.15rem',
            fontWeight: 700,
            fontFamily: 'var(--font-serif)',
            color: 'var(--text-primary)'
          }}>
            閱讀與修持日誌
          </h3>
        </div>
        {onClose && (
          <button
            className="icon-button close-btn"
            onClick={onClose}
            title="關閉"
            style={{ padding: '4px' }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {bodyContent}
    </div>
  </div>
);
}

export default ReadingLogView;
