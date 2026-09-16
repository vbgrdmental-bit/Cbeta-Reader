import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarDays, ChevronLeft, ChevronRight, X, Trash2, 
  Play, BookOpen, Clock, AlertCircle
} from 'lucide-react';
import { 
  getAllReadingLogs, 
  deleteReadingLog, 
  clearAllReadingLogs,
  type ReadingLogEntry 
} from '../../utils/db';

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

  // 載入日誌紀錄
  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await getAllReadingLogs();
      // 依時間由新到舊排序
      data.sort((a, b) => b.startTime - a.startTime);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load reading logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // 刪除單筆紀錄
  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteReadingLog(id);
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error('Failed to delete reading log:', err);
    }
  };

  // 清空所有紀錄
  const handleClearAll = async () => {
    try {
      await clearAllReadingLogs();
      setLogs([]);
      setShowClearConfirm(false);
    } catch (err) {
      console.error('Failed to clear reading logs:', err);
    }
  };

  // ── 統計計算 ──────────────────────────────────────────────
  const totalActiveDays = useMemo(() => {
    const daySet = new Set<string>();
    logs.forEach(l => {
      if (l.date) daySet.add(l.date);
    });
    return daySet.size;
  }, [logs]);

  // 本月紀錄與統計
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

  // 日期 -> 當日總分鐘數映射（用於月曆熱力標記）
  const dateMinutesMap = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach(l => {
      if (l.date) {
        map.set(l.date, (map.get(l.date) || 0) + (l.durationMinutes || 0));
      }
    });
    return map;
  }, [logs]);

  // 選中日期的記錄列表
  const selectedDateLogs = useMemo(() => {
    return logs.filter(l => l.date === selectedDate);
  }, [logs, selectedDate]);

  const selectedDateTotalMinutes = useMemo(() => {
    return selectedDateLogs.reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);
  }, [selectedDateLogs]);

  // ── 月曆網格計算（以星期一為每週首日）──────────────────────────
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayRaw = new Date(currentYear, currentMonth, 1).getDay(); // 0(Sun) ~ 6(Sat)
  // 週一為 0，週日為 6
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
          {/* 💡 1. 頂部三大統計看板 */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '0.6rem' 
          }}>
            {/* 累計閱讀天數 */}
            <div style={{
              backgroundColor: 'var(--theme-accent-light, rgba(139, 90, 43, 0.06))',
              border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
              borderRadius: '12px',
              padding: '0.75rem 0.4rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>累計閱讀天數</span>
              <span style={{ 
                fontSize: '1.25rem', 
                fontWeight: 700, 
                color: 'var(--theme-accent, #8b5a2b)',
                fontFamily: 'var(--font-serif)'
              }}>
                {totalActiveDays} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>天</span>
              </span>
            </div>

            {/* 本月閱讀時數 */}
            <div style={{
              backgroundColor: 'var(--theme-accent-light, rgba(139, 90, 43, 0.06))',
              border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
              borderRadius: '12px',
              padding: '0.75rem 0.4rem',
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
              padding: '0.75rem 0.4rem',
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
                className="icon-button"
                style={{ padding: '6px', borderRadius: '8px' }}
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
                    border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                    backgroundColor: 'var(--bg-card, #fff)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  title="切換回今天"
                >
                  今天
                </button>
              </div>

              <button 
                onClick={handleNextMonth}
                className="icon-button"
                style={{ padding: '6px', borderRadius: '8px' }}
                title="下個月"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* 星期表頭（週一 ~ 週日） */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: '0.4rem'
            }}>
              <div>一</div>
              <div>二</div>
              <div>三</div>
              <div>四</div>
              <div>五</div>
              <div>六</div>
              <div>日</div>
            </div>

            {/* 月曆日期網格 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px',
              textAlign: 'center'
            }}>
              {/* 前置空格 */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} style={{ height: '46px' }} />
              ))}

              {/* 當月日期 */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const minutes = dateMinutesMap.get(dateStr) || 0;
                const hasRecord = minutes > 0;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    style={{
                      height: '46px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      border: isSelected 
                        ? '2px solid var(--theme-accent, #8b5a2b)' 
                        : isToday 
                        ? '1px dashed var(--theme-accent, #8b5a2b)' 
                        : '1px solid transparent',
                      backgroundColor: isSelected
                        ? 'var(--theme-accent-light, rgba(139, 90, 43, 0.15))'
                        : hasRecord
                        ? 'var(--theme-accent-light, rgba(139, 90, 43, 0.08))'
                        : 'transparent',
                      color: isSelected 
                        ? 'var(--theme-accent, #8b5a2b)' 
                        : 'var(--text-primary)',
                      cursor: 'pointer',
                      padding: '2px',
                      position: 'relative',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ 
                      fontSize: '0.86rem', 
                      fontWeight: isSelected || isToday || hasRecord ? 700 : 400 
                    }}>
                      {dayNum}
                    </span>
                    {hasRecord && (
                      <span style={{ 
                        fontSize: '0.62rem', 
                        color: 'var(--theme-accent, #8b5a2b)',
                        fontWeight: 600,
                        lineHeight: 1,
                        marginTop: '1px'
                      }}>
                        {minutes < 60 ? `${minutes}m` : `${(minutes / 60).toFixed(1)}h`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 💡 3. 當日閱讀明細清單 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {/* 明細清單標題 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '0 0.2rem' 
            }}>
              <span style={{ 
                fontSize: '0.92rem', 
                fontWeight: 700, 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-serif)'
              }}>
                📜 {selectedDate} 閱讀記錄
              </span>
              {selectedDateLogs.length > 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  共 {selectedDateLogs.length} 筆 • 累計 {formatDuration(selectedDateTotalMinutes)}
                </span>
              )}
            </div>

            {/* 明細項目列表 */}
            {selectedDateLogs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                backgroundColor: 'var(--bg-primary, rgba(0,0,0,0.02))',
                borderRadius: '12px',
                border: '1px dashed var(--border-color, rgba(0,0,0,0.1))',
                color: 'var(--text-muted)',
                fontSize: '0.86rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <BookOpen size={24} style={{ opacity: 0.4 }} />
                <span>
                  {selectedDate === todayStr 
                    ? '今日尚未有閱讀紀錄(閱讀滿 1 分鐘將開始記錄)' 
                    : '此日尚未有閱讀紀錄'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedDateLogs.map(log => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-card, #fff)',
                      border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      gap: '0.6rem'
                    }}
                  >
                    {/* 左側資訊 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: '0.92rem', 
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
                        fontSize: '0.78rem', 
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Clock size={12} />
                        <span>{formatTime(log.startTime)} ~ {formatTime(log.endTime)}</span>
                        <span>•</span>
                        <span style={{ 
                          color: 'var(--theme-accent, #8b5a2b)', 
                          fontWeight: 600,
                          backgroundColor: 'var(--theme-accent-light, rgba(139, 90, 43, 0.08))',
                          padding: '1px 6px',
                          borderRadius: '6px'
                        }}>
                          {formatDuration(log.durationMinutes)}
                        </span>
                      </div>
                    </div>

                    {/* 右側操作按鈕群 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {/* 接續閱讀 */}
                      <button
                        onClick={() => {
                          onClose?.();
                          onSelectBook(log.workId, '', '', 'resume');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#fff',
                          backgroundColor: 'var(--theme-accent, #8b5a2b)',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                        title="進入經典接續閱讀"
                      >
                        <Play size={12} fill="#fff" />
                        <span>接續閱讀</span>
                      </button>

                      {/* 刪除紀錄 */}
                      <button
                        onClick={(e) => handleDeleteSingle(log.id, e)}
                        className="icon-button"
                        style={{ 
                          padding: '6px', 
                          color: 'var(--text-muted)',
                          borderRadius: '6px' 
                        }}
                        title="刪除此筆記錄"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* 底部功能與清空列 */}
        <div 
          style={{ 
            padding: '0.8rem 1.2rem',
            borderTop: isPageMode ? 'none' : '1px solid var(--border-color, rgba(0,0,0,0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isPageMode ? 'center' : 'space-between',
            backgroundColor: isPageMode ? 'transparent' : 'var(--bg-card, #fff)'
          }}
        >
          {showClearConfirm ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', color: '#e53e3e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertCircle size={14} /> 確定清空全部閱讀日誌？
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handleClearAll}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    backgroundColor: '#e53e3e',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  確認清空
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-primary, #f0f0f0)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={logs.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.8rem',
                  color: logs.length === 0 ? 'var(--text-muted)' : '#e53e3e',
                  opacity: logs.length === 0 ? 0.5 : 0.85,
                  background: 'none',
                  border: 'none',
                  cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
                  padding: '4px 6px'
                }}
              >
                <Trash2 size={14} />
                <span>清空所有閱讀記錄</span>
              </button>

              {!isPageMode && onClose && (
                <button
                  onClick={onClose}
                  className="dialog-btn-cancel"
                  style={{ 
                    padding: '5px 16px', 
                    fontSize: '0.82rem', 
                    borderRadius: '8px' 
                  }}
                >
                  關閉
                </button>
              )}
            </>
          )}
        </div>
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
          maxWidth: '480px', 
          width: '94vw',
          maxHeight: '88vh',
          borderRadius: '16px',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card, #fff)'
        }}
      >
        {/* 頂部標題列 */}
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
              每日閱讀日誌
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
