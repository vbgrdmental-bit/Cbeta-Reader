import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarDays, ChevronLeft, ChevronRight, X, Trash2, 
  Play, BookOpen, Edit3, Plus
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
  type ReadingLogEntry,
  type PracticeLogEntry,
  type PracticeCategoryConfig,
  getPracticeCategories,
  savePracticeCategories
} from '../../utils/db';
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
  const [, setLoading] = useState(true);

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
      const [readData, pracData] = await Promise.all([
        getAllReadingLogs(),
        getAllPracticeLogs()
      ]);
      readData.sort((a, b) => b.startTime - a.startTime);
      pracData.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(readData);
      setPracticeLogs(pracData);

      // 💡 自動收錄歷史功課名稱至常用選擇（例如讀者之前記錄過的「滅定業真言」自動同步收錄）
      const currentCats = getPracticeCategories();
      let hasUpdate = false;
      const updatedCats = { ...currentCats };
      pracData.forEach(p => {
        const catKey = p.category;
        if (updatedCats[catKey] && p.name && p.name.trim()) {
          const trimmed = p.name.trim();
          if (!updatedCats[catKey].items.includes(trimmed)) {
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

  // 日期 -> 有無閱讀與有無功課標記（用於月曆微標記）
  const dateStatusMap = useMemo(() => {
    const map = new Map<string, { hasRead: boolean; hasPractice: boolean }>();
    logs.forEach(l => {
      if (l.date) {
        const item = map.get(l.date) || { hasRead: false, hasPractice: false };
        item.hasRead = true;
        map.set(l.date, item);
      }
    });
    practiceLogs.forEach(p => {
      if (p.date) {
        const item = map.get(p.date) || { hasRead: false, hasPractice: false };
        item.hasPractice = true;
        map.set(p.date, item);
      }
    });
    return map;
  }, [logs, practiceLogs]);

  // 選中日期的農曆與佛教資訊
  const selectedDateLunar = useMemo(() => {
    if (!selectedDate) return null;
    const parts = selectedDate.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
    return getLunarInfo(new Date(parts[0], parts[1] - 1, parts[2]));
  }, [selectedDate]);

  // ── 月曆網格計算（以星期一為每週首日）──────────────────────────
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
      {/* 💡 1. 頂部看板：雙核心指標 + 本月最常閱讀 TOP 3 */}
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
                        color: 'var(--theme-accent, #8b5a2b)',
                        backgroundColor: '#fff',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color, rgba(0,0,0,0.08))'
                      }}>
                        {formatDurationStat(book.totalMinutes)}
                      </span>
                      <button
                        onClick={() => onSelectBook(book.workId, undefined, undefined, 'resume')}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: '#2d5a3f',
                          backgroundColor: '#eaf2ed',
                          border: '1px solid rgba(45, 90, 63, 0.25)',
                          borderRadius: '12px',
                          padding: '2px 8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        <span>繼續閱讀</span>
                        <span>›</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 💡 2. 禪意月曆檢視 */}
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
            const status = dateStatusMap.get(dateStr) || { hasRead: false, hasPractice: false };
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
                    ? '#fdfaf3' 
                    : isToday 
                      ? 'rgba(139, 90, 43, 0.05)' 
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
                  fontWeight: (lunarInfo.festival || lunarInfo.isZhai) ? 700 : 400,
                  color: lunarInfo.festival 
                    ? '#c0392b' 
                    : lunarInfo.isZhai 
                      ? '#2d6a4f' 
                      : 'var(--text-muted)'
                }}>
                  {lunarInfo.cellLabel}
                </span>

                {/* 底部雙微標籤：綠「讀」與金「📿」 */}
                <div style={{ display: 'flex', gap: '2px', marginTop: 'auto', alignItems: 'center' }}>
                  {status.hasRead && (
                    <span style={{
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      color: '#2d6a4f',
                      backgroundColor: 'rgba(45, 106, 79, 0.12)',
                      padding: '0 3px',
                      borderRadius: '3px',
                      lineHeight: 1.2
                    }}>
                      讀
                    </span>
                  )}
                  {status.hasPractice && (
                    <span style={{
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      color: '#b8860b',
                      backgroundColor: 'rgba(184, 134, 11, 0.14)',
                      padding: '0 3px',
                      borderRadius: '3px',
                      lineHeight: 1.2
                    }}>
                      📿
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 💡 3. 選中日期的三大獨立專區（圖 2 徹底重構分區） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* 區塊 A：🌟 重要日期獨立宣紙卡片 */}
        <div style={{
          background: 'linear-gradient(135deg, #fdfbf7 0%, #f6efe2 100%)',
          border: '1px solid rgba(139, 90, 43, 0.2)',
          borderRadius: '12px',
          padding: '11px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 6px rgba(139, 90, 43, 0.05)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{
              fontSize: '0.94rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📜</span>
              <span>{selectedDate}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {selectedDateLunar ? selectedDateLunar.fullStr : '農曆吉日'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            {selectedDateLunar?.festival && (
              <span style={{
                backgroundColor: '#c0392b',
                color: '#fff',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(192, 57, 43, 0.3)'
              }}>
                🌸 {selectedDateLunar.festival}
              </span>
            )}
            {selectedDateLunar?.isZhai && (
              <span style={{
                backgroundColor: '#2d6a4f',
                color: '#fff',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(45, 106, 79, 0.3)'
              }}>
                🌿 十齋日 · 茹素修善
              </span>
            )}
            {!selectedDateLunar?.festival && !selectedDateLunar?.isZhai && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                深入經藏 · 智慧如海
              </span>
            )}
          </div>
        </div>

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
              <BookOpen size={16} style={{ color: '#2d6a4f' }} />
              <span>經文閱讀記錄</span>
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
                    borderLeft: '3.5px solid #2d6a4f',
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
                        color: '#2d6a4f',
                        fontWeight: 600,
                        backgroundColor: 'rgba(45, 106, 79, 0.08)',
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}>
                        {formatDuration(log.durationMinutes)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {/* 讀經一鍵轉持經 */}
                    <button
                      onClick={() => handleSyncReadingToPractice(log)}
                      title="將此閱讀紀錄轉為今日持經功課"
                      style={{
                        backgroundColor: 'rgba(184, 134, 11, 0.1)',
                        color: '#8c6000',
                        border: '1px solid rgba(184, 134, 11, 0.25)',
                        borderRadius: '14px',
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      📿 轉持經
                    </button>

                    <button
                      onClick={() => onSelectBook(log.workId, undefined, undefined, 'resume')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '14px',
                        backgroundColor: '#2d5a3f',
                        color: '#fff',
                        border: 'none',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <Play size={11} fill="#fff" />
                      <span>接續閱讀</span>
                    </button>

                    <button
                      onClick={(e) => handleDeleteReading(log.id, e)}
                      title="刪除紀錄"
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

        {/* 區塊 C：📿 我的功課記錄 */}
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
              <span>📿</span>
              <span>我的功課記錄</span>
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
                          color: '#925800',
                          fontWeight: 700,
                          backgroundColor: '#fff3d6',
                          padding: '1px 8px',
                          borderRadius: '5px',
                          border: '1px dashed rgba(184, 134, 11, 0.4)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <span>{p.count.toLocaleString()} {p.unit}</span>
                        <span style={{ fontSize: '0.66rem', opacity: 0.6 }}>✏️</span>
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
                        border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
                        backgroundColor: '#fff',
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
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowPracticeModal(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--bg-card, #fff)',
              borderRadius: '16px',
              border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
              boxShadow: '0 16px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-card-subtle, #faf7f2)'
            }}>
              <span style={{ fontSize: '0.94rem', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>
                📿 今日修持功課記數
              </span>
              <button 
                onClick={() => setShowPracticeModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '72vh', overflowY: 'auto' }}>
              {/* 大類切換標籤 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>選擇修持大類</span>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(Object.keys(practiceCategories).length, 4)}, 1fr)`,
                  gap: '6px',
                  backgroundColor: 'var(--bg-card-subtle, rgba(0,0,0,0.03))',
                  padding: '4px',
                  borderRadius: '10px'
                }}>
                  {Object.keys(practiceCategories).map(catKey => {
                    const cat = practiceCategories[catKey];
                    return (
                      <button
                        key={catKey}
                        onClick={() => handleSwitchCategory(catKey)}
                        style={{
                          padding: '6px 0',
                          border: 'none',
                          borderRadius: '7px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: modalCategory === catKey ? '#fff' : 'transparent',
                          color: modalCategory === catKey ? 'var(--theme-accent, #8b5a2b)' : 'var(--text-secondary)',
                          boxShadow: modalCategory === catKey ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
                        }}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 中類快捷選擇 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {practiceCategories[modalCategory]?.label || `${practiceCategories[modalCategory]?.name || '修持'}選擇`}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(practiceCategories[modalCategory]?.items || []).map(item => (
                    <button
                      key={item}
                      onClick={() => handleSelectPresetItem(item)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        border: modalName === item 
                          ? '1px solid var(--theme-accent, #8b5a2b)' 
                          : '1px solid var(--border-color, rgba(0,0,0,0.1))',
                        backgroundColor: modalName === item 
                          ? 'var(--theme-accent-light, rgba(139, 90, 43, 0.1))' 
                          : 'var(--bg-card, #fff)',
                        color: modalName === item 
                          ? 'var(--theme-accent, #8b5a2b)' 
                          : 'var(--text-primary)',
                        fontWeight: modalName === item ? 700 : 500,
                        fontFamily: 'var(--font-serif)'
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* 自訂修持名稱 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
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
                        background: 'rgba(184, 134, 11, 0.1)',
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
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  placeholder="輸入佛號、咒語或經名（儲存時自動收錄）"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                    backgroundColor: '#fff'
                  }}
                />
              </div>

              {/* 數量輸入與快捷加數 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {practiceCategories[modalCategory]?.countLabel || '修持數量'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--theme-accent, #8b5a2b)' }}>
                    單位：{practiceCategories[modalCategory]?.unit || '次'}
                  </span>
                </div>
                <input 
                  type="number" 
                  value={modalCount}
                  onChange={e => setModalCount(parseInt(e.target.value, 10) || 0)}
                  min={1}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                    fontSize: '0.88rem',
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                    backgroundColor: '#fff'
                  }}
                />
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {[1, 7, 21, 108, 1000].map(addVal => (
                    <button
                      key={addVal}
                      onClick={() => setModalCount(prev => prev + addVal)}
                      style={{
                        padding: '6px 0',
                        backgroundColor: 'var(--bg-card-subtle, rgba(0,0,0,0.03))',
                        border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: 'var(--theme-accent, #8b5a2b)',
                        cursor: 'pointer'
                      }}
                    >
                      +{addVal}
                    </button>
                  ))}
                </div>
              </div>

              {/* 隨喜撥珠計數器 */}
              <div style={{
                background: 'linear-gradient(135deg, #f8f2e7 0%, #eee4d3 100%)',
                border: '1px dashed #b8860b',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#704b08', fontFamily: 'var(--font-serif)' }}>
                    📿 隨喜撥珠計數器
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    點擊右側佛珠即時 +1 累計
                  </span>
                </div>
                <button
                  onClick={() => setModalCount(prev => prev + 1)}
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #d4a373 0%, #a26b38 100%)',
                    border: '2px solid #fff',
                    boxShadow: '0 3px 8px rgba(162, 107, 56, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '1.2rem',
                    cursor: 'pointer'
                  }}
                >
                  📿
                </button>
              </div>
            </div>

            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fff',
              borderTop: '1px solid var(--border-color, rgba(0,0,0,0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setShowPracticeModal(false)}
                style={{
                  padding: '7px 14px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleSavePractice}
                style={{
                  padding: '7px 18px',
                  backgroundColor: 'var(--theme-accent, #8b5a2b)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(139, 90, 43, 0.25)'
                }}
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
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setEditingPractice(null)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '320px',
              backgroundColor: '#fff',
              borderRadius: '14px',
              padding: '16px',
              border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
              boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>
                編輯：{editingPractice.name}
              </span>
              <button 
                onClick={() => setEditingPractice(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>今日完成數量</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--theme-accent, #8b5a2b)' }}>
                  單位：{editingPractice.unit}
                </span>
              </div>
              <input 
                type="number" 
                value={editCountInput}
                onChange={e => setEditCountInput(parseInt(e.target.value, 10) || 0)}
                min={0}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                  fontSize: '0.92rem',
                  fontFamily: 'inherit',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
              {[-108, -10, 10, 108, 1000].map(delta => (
                <button
                  key={delta}
                  onClick={() => setEditCountInput(prev => Math.max(0, prev + delta))}
                  style={{
                    padding: '5px 0',
                    backgroundColor: 'var(--bg-card-subtle, rgba(0,0,0,0.03))',
                    border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--theme-accent, #8b5a2b)',
                    cursor: 'pointer'
                  }}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => setEditingPractice(null)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={handleSaveEditCount}
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'var(--theme-accent, #8b5a2b)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
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
