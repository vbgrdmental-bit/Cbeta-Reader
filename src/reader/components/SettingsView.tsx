import { useState, useEffect, useRef } from 'react';
import { X, Database, FileText, Upload, HelpCircle, RotateCw, Archive, Trash2, HardDrive, CheckCircle2 } from 'lucide-react';
import type { AppSettings, StorageStats } from '../../utils/db';
import { getStorageStats, clearHttpCacheStorage, compressAllBooks, clearAllBooks, saveSettings, DEFAULT_SETTINGS } from '../../utils/db';
import { BUILDER_VERSION, APP_VERSION } from '../../builder/version';
import { exportUserData, importUserData } from '../../utils/backup';
import { readingTimer, formatTimerMMSS } from '../../utils/readingTimer';
import { loadEduKaiFontOnDemand } from '../../utils/fontLoader';
import type { ReadingTimerState } from '../../utils/readingTimer';
import { isBackupMode } from '../../utils/sourceMode';
import '../styles/settings.css';

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
  onReplayOnboarding?: () => void;
}

export function SettingsView({ settings, onSave, onClose, onReplayOnboarding }: SettingsViewProps) {
  const [showChangelog, setShowChangelog] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [showAppHistory, setShowAppHistory] = useState(false);
  const [showBuilderHistory, setShowBuilderHistory] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [storageMsg, setStorageMsg] = useState('');

  // 💡 版本紀錄對話框捲動位置重置 Refs
  const changelogBodyRef = useRef<HTMLDivElement>(null);
  const builderSectionRef = useRef<HTMLDivElement>(null);

  // 💡 收起 App 歷程：平滑自動捲動至最頂部 (回到圖 1)
  const handleCollapseAppHistory = () => {
    setShowAppHistory(false);
    if (changelogBodyRef.current) {
      changelogBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 💡 捲動至 Builder 區塊標題（精確計算 relative to scroll container）
  const scrollToBuilderSection = (delay = 50) => {
    setTimeout(() => {
      if (changelogBodyRef.current && builderSectionRef.current) {
        const containerRect = changelogBodyRef.current.getBoundingClientRect();
        const elemRect = builderSectionRef.current.getBoundingClientRect();
        const relativeTop = elemRect.top - containerRect.top + changelogBodyRef.current.scrollTop;
        changelogBodyRef.current.scrollTo({ top: Math.max(0, relativeTop - 8), behavior: 'smooth' });
      }
    }, delay);
  };

  // 💡 收起 Builder 歷程：平滑自動捲動至 Builder 區塊標題 (回到圖 1)
  const handleCollapseBuilderHistory = () => {
    setShowBuilderHistory(false);
    scrollToBuilderSection(80); // 稍長延遲，等 DOM 收合後再捲動
  };

  // 💡 閱讀時間倒數計時狀態
  const [timerState, setTimerState] = useState<ReadingTimerState>(readingTimer.getState());

  useEffect(() => {
    getStorageStats().then(setStorageStats).catch(console.warn);
  }, []);

  useEffect(() => {
    const unsubscribe = readingTimer.subscribe(setTimerState);
    return unsubscribe;
  }, []);

  const handleClearAllBooks = async () => {
    if (!window.confirm('確定要清空所有離線經典並恢復初始設定嗎？\n• 所有離線書庫與劃線將被清除\n• 閱讀設定將回到預設值\n\n此操作無法復原。')) return;
    setStorageMsg('正在清空離線書庫並恢復初始設定...');
    try {
      await clearAllBooks();
      // 重置設定為初始預設值
      await saveSettings(DEFAULT_SETTINGS);
      onSave(DEFAULT_SETTINGS);
      const stats = await getStorageStats();
      setStorageStats(stats);
      setStorageMsg('已成功清空並恢復初始設定！頁面即將自動刷新。');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setStorageMsg('清空失敗：' + (err.message || '未知錯誤'));
    }
  };

  const getEstimatedBackupTime = (usedBytes?: number): string => {
    if (!usedBytes || usedBytes <= 0) return '< 1 分鐘';
    const sizeMB = usedBytes / (1024 * 1024);
    if (sizeMB <= 20) {
      return '< 1 分鐘';
    } else {
      const mins = Math.ceil(sizeMB / 20);
      return `約 ${mins} 分鐘`;
    }
  };

  const handleExport = async (includeBooks: boolean) => {
    try {
      setIsExporting(true);
      await exportUserData({ includeBooks });
      setBackupMsg('');
    } catch (err: any) {
      setBackupMsg('匯出失敗：' + (err.message || '未知錯誤'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCompressAll = async () => {
    setIsCompressing(true);
    setStorageMsg('正在對全庫離線經書執行 Gzip 動態輕量化高壓縮...');
    try {
      const res = await compressAllBooks();
      const stats = await getStorageStats();
      setStorageStats(stats);
      setStorageMsg(`成功壓縮優化 ${res.compressedCount} 本經書，目前佔用 ${stats.formattedUsed}！`);
    } catch (err: any) {
      setStorageMsg('壓縮失敗：' + (err.message || '未知錯誤'));
    } finally {
      setIsCompressing(false);
    }
  };

  const handleClearCache = async () => {
    setStorageMsg('正在清理歷史 HTTP API 網路暫存...');
    try {
      const count = await clearHttpCacheStorage();
      const stats = await getStorageStats();
      setStorageStats(stats);
      setStorageMsg(`成功清理 ${count} 個網路快取區域，釋放部分暫存空間！`);
    } catch (err: any) {
      setStorageMsg('清理失敗：' + (err.message || '未知錯誤'));
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsImporting(true);
      const res = await importUserData(file);
      let msg = '備份還原成功！';
      if (res.booksCount > 0 || res.highlightsCount > 0) {
        msg = `已成功還原 ${res.booksCount > 0 ? `${res.booksCount} 本經文、` : ''}${res.highlightsCount} 筆劃線重點與個人設定！`;
      }
      setBackupMsg(msg);
    } catch (err: any) {
      setBackupMsg('還原失敗：' + (err.message || '請確認備份檔案格式正確。'));
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };
  
  const handleCheckboxChange = (key: keyof AppSettings['customVisibleElements']) => {
    const customElements = {
      ...settings.customVisibleElements,
      [key]: !settings.customVisibleElements[key]
    };
    onSave({
      ...settings,
      profile: 'custom',
      customVisibleElements: customElements
    });
  };

  const paddings = [5, 10, 15, 20];
  // const speeds = [0.5, 1.0, 1.5, 2.0];

  return (
    <div className="settings-panel-overlay" onClick={onClose}>
      <div className="settings-card animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h3>閱讀設定</h3>
          <button className="icon-button close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body custom-scrollbar">
          {/* 1. 閱讀主題色彩 */}
          <div className="settings-section">
            <div className="settings-section-title">閱讀主題色彩</div>
            <div className="visual-options-row">
              {[
                { id: 'ivory', label: '象牙白', bg: 'var(--bg-paper-ivory, #fdfbf7)' },
                { id: 'parchment', label: '羊皮紙', bg: 'var(--bg-paper-parchment, #f4ecd8)' },
                { id: 'comfort', label: '舒服', bg: 'var(--bg-paper-comfort, #c7edcc)' },
                { id: 'ebony', label: '烏木', bg: 'var(--bg-paper-ebony, #1a1a1a)' }
              ].map((t) => {
                const isActive = settings.theme === t.id;
                return (
                  <div
                    key={`theme-${t.id}`}
                    className={`visual-option-card ${isActive ? 'active' : ''}`}
                    onClick={() => onSave({ ...settings, theme: t.id as AppSettings['theme'] })}
                  >
                    <div
                      className="color-circle"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: t.bg,
                        border: isActive ? '2px solid var(--text-primary)' : '1px solid var(--reader-border)',
                        boxShadow: isActive ? '0 0 6px rgba(0,0,0,0.15)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: t.id === 'ebony' ? '#fff' : '#000'
                      }}
                    >
                      {isActive && <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>✓</span>}
                    </div>
                    <span className="visual-option-label" style={{ fontSize: '0.75rem' }}>
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. 內文字體 */}
          <div className="settings-section">
            <div className="settings-section-title">內文字體</div>
            <div className="visual-options-row">
              {[
                { 
                  id: 'default', 
                  name: '宋/明體', 
                  fontFamily: 'var(--font-serif)',
                  sample: '永' 
                },
                { 
                  id: 'jhenghei', 
                  name: '正黑體', 
                  fontFamily: '"Microsoft JhengHei", "PingFang TC", "STHeiti", "Heiti TC", "Noto Sans TC", "CBETASupplement", sans-serif',
                  sample: '永' 
                },
                { 
                  id: 'iansui', 
                  name: '芫荽體', 
                  fontFamily: '"Iansui", "Klee One", "CBETASupplement", serif',
                  sample: '永' 
                },
                { 
                  id: 'kaiti', 
                  name: '標楷體', 
                  fontFamily: '"CBETASupplement", "標楷體", "BiauKai", "DFKai-SB", "TW-Kai", "STKaiti", "KaiTi", serif',
                  sample: '永' 
                }
              ].map((fontItem) => {
                const rawFont = settings.fontFamily || 'default';
                const currentFont = (rawFont === 'yuanti' || rawFont === 'fangsong' || rawFont === 'wenkai' || rawFont === 'iansui-zy' || rawFont === 'iansui-bold') ? 'kaiti' : rawFont;
                const isActive = currentFont === fontItem.id;
                return (
                  <div
                    key={`fontFamily-${fontItem.id}`}
                    className={`visual-option-card ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      if (fontItem.id === 'kaiti') {
                        loadEduKaiFontOnDemand();
                      }
                      onSave({ ...settings, fontFamily: fontItem.id as any });
                    }}
                  >
                    <div 
                      style={{ 
                        fontFamily: fontItem.fontFamily, 
                        fontSize: '1.35rem',
                        fontWeight: fontItem.id === 'iansui-bold' ? '700' : fontItem.id === 'default' ? '600' : 'normal',
                        lineHeight: 1,
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {fontItem.sample}
                    </div>
                    <span 
                      className="visual-option-label" 
                      style={{ 
                        fontSize: fontItem.name.length > 5 ? '0.66rem' : '0.75rem', 
                        letterSpacing: fontItem.name.length > 5 ? '-0.3px' : 'normal'
                      }}
                    >
                      {fontItem.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 畫重點設定 */}
          <div className="settings-section">
            <div className="settings-section-title">畫重點設定</div>
            
            {/* 筆刷顏色選擇 (4個等分項目) */}
            <div className="settings-subsection-title" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>筆刷顏色</div>
            <div className="visual-options-row">
              {(['yellow', 'red', 'gray', 'blue'] as const).map((color) => {
                const colorMap = {
                  yellow: '#fbbf24',
                  red: '#f87171',
                  gray: '#9ca3af',
                  blue: '#60a5fa'
                };
                const labelMap = {
                  yellow: '淺黃',
                  red: '淺紅',
                  gray: '淺灰',
                  blue: '淺藍'
                };
                const isActive = settings.highlightColor === color;
                return (
                  <div
                    key={`hl-color-${color}`}
                    className={`visual-option-card ${isActive ? 'active' : ''}`}
                    onClick={() => onSave({ ...settings, highlightColor: color })}
                  >
                    <div
                      className="color-circle"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: colorMap[color],
                        border: isActive ? '2px solid var(--text-primary)' : '1px solid var(--reader-border)',
                        boxShadow: isActive ? '0 0 6px rgba(0,0,0,0.15)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: settings.theme === 'ebony' ? '#000' : '#fff'
                      }}
                    >
                      {isActive && <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>✓</span>}
                    </div>
                    <span className="visual-option-label" style={{ fontSize: '0.75rem' }}>
                      {labelMap[color]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 粗細模式選擇 (4個等分項目) */}
            <div className="settings-subsection-title" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '1rem 0 0.5rem 0' }}>粗細與標註模式</div>
            <div className="visual-options-row">
              {(['underline', 'bottom-half', 'full', 'border'] as const).map((style) => {
                const labelMap = {
                  underline: '底線',
                  'bottom-half': '半塗',
                  full: '全塗',
                  border: '方框'
                };
                
                const currentHex = 
                  settings.highlightColor === 'yellow' ? '#fbbf24' :
                  settings.highlightColor === 'red' ? '#f87171' :
                  settings.highlightColor === 'gray' ? '#9ca3af' : '#60a5fa';

                const currentRgba = 
                  settings.highlightColor === 'yellow' ? 'rgba(250, 204, 21, 0.65)' :
                  settings.highlightColor === 'red' ? 'rgba(248, 113, 113, 0.65)' :
                  settings.highlightColor === 'gray' ? 'rgba(156, 163, 175, 0.65)' : 'rgba(96, 165, 250, 0.65)';

                const getPreviewStyle = () => {
                  switch (style) {
                    case 'underline':
                      return { borderBottom: `2.5px solid ${currentHex}`, background: 'transparent' };
                    case 'bottom-half':
                      return { background: `linear-gradient(180deg, transparent 55%, ${currentRgba} 55%)` };
                    case 'full':
                      return { backgroundColor: currentRgba, borderRadius: '3px' };
                    case 'border':
                      return { border: `2.2px solid ${currentHex}`, borderRadius: '3px', padding: '0 2px' };
                  }
                };

                const isActive = settings.highlightStyle === style;
                return (
                  <div
                    key={`hl-style-${style}`}
                    className={`visual-option-card ${isActive ? 'active' : ''}`}
                    onClick={() => onSave({ ...settings, highlightStyle: style })}
                  >
                    <div 
                      className="style-preview-text" 
                      style={{ 
                        fontSize: '0.82rem', 
                        fontFamily: 'var(--font-serif)',
                        color: 'var(--text-primary)',
                        padding: '1px 3px',
                        ...getPreviewStyle()
                      }}
                    >
                      經文
                    </div>
                    <span className="visual-option-label" style={{ fontSize: '0.75rem' }}>
                      {labelMap[style]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 💡 設定閱讀時間 (1:1:1:1 4 個按鍵，極簡時鐘繪圖) */}
          <div className="settings-section">
            <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>設定閱讀時間 <span style={{ fontSize: '0.8rem', opacity: 0.75, fontWeight: 'normal' }}>(護眼模式)</span></span>
              {timerState.duration && timerState.remainingSeconds > 0 && (
                <span style={{ fontSize: '0.76rem', color: 'var(--theme-accent, #8c4b27)', fontWeight: 'bold' }}>
                  ⏱ 倒數中: {formatTimerMMSS(timerState.remainingSeconds)}
                </span>
              )}
            </div>
            <div className="visual-options-row">
              {([15, 30, 45, 60] as const).map((mins) => {
                const isActive = timerState.duration === mins && timerState.remainingSeconds > 0;
                
                // 依據 15/30/45/60 繪製專屬扇形與時針 (1/4, 2/4, 3/4, 4/4 灰色區塊與 12點起點指針)
                const renderClockSvg = () => {
                  switch (mins) {
                    case 15:
                      return (
                        <svg className="padding-svg" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="13" className="svg-border" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          <path d="M 18 18 L 18 5 A 13 13 0 0 1 31 18 Z" fill="currentColor" opacity="0.3" />
                          <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <line x1="18" y1="18" x2="26" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      );
                    case 30:
                      return (
                        <svg className="padding-svg" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="13" className="svg-border" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          <path d="M 18 18 L 18 5 A 13 13 0 0 1 18 31 Z" fill="currentColor" opacity="0.3" />
                          <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <line x1="18" y1="18" x2="18" y2="28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      );
                    case 45:
                      return (
                        <svg className="padding-svg" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="13" className="svg-border" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          <path d="M 18 18 L 18 5 A 13 13 0 1 1 5 18 Z" fill="currentColor" opacity="0.3" />
                          <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <line x1="18" y1="18" x2="10" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      );
                    case 60:
                      return (
                        <svg className="padding-svg" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="13" className="svg-border" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          <circle cx="18" cy="18" r="13" fill="currentColor" opacity="0.3" />
                          <line x1="18" y1="18" x2="18" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      );
                  }
                };

                return (
                  <div
                    key={`timer-${mins}`}
                    className={`visual-option-card ${isActive ? 'active' : ''}`}
                    onClick={() => readingTimer.setTimer(mins)}
                    title={isActive ? `取消 ${mins} 分鐘閱讀計時` : `設定 ${mins} 分鐘閱讀計時`}
                  >
                    {renderClockSvg()}
                    <span className="visual-option-label" style={{ fontSize: '0.75rem' }}>
                      {mins}分
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. 行高與行距 */}
          <div className="settings-section">
            <div className="settings-section-title">行高與行距</div>
            <div className="visual-options-row">
              {[1.6, 1.8, 2.0, 2.2].map((lh) => {
                const spacing = lh === 1.6 ? 6 : lh === 1.8 ? 8 : lh === 2.0 ? 10 : 12;
                return (
                  <div
                    key={`lineHeight-${lh}`}
                    className={`visual-option-card ${settings.lineHeight === lh ? 'active' : ''}`}
                    onClick={() => onSave({ ...settings, lineHeight: lh })}
                  >
                    <svg className="padding-svg" viewBox="0 0 36 36">
                      <rect x="3" y="3" width="30" height="30" rx="4" className="svg-border" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="8" y1={18 - spacing} x2="28" y2={18 - spacing} stroke="currentColor" strokeWidth="1.5" />
                      <line x1="8" y1="18" x2="28" y2="18" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="8" y1={18 + spacing} x2="28" y2={18 + spacing} stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span className="visual-option-label">{lh.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. 排版與邊距 */}
          <div className="settings-section">
            <div className="settings-section-title">排版與邊距</div>
            <div className="visual-options-row">
              {paddings.map((p) => {
                const offset = p === 5 ? 6 : p === 10 ? 8 : p === 15 ? 10 : 12;
                return (
                  <div
                    key={`padding-${p}`}
                    className={`visual-option-card ${settings.padding === p ? 'active' : ''}`}
                    onClick={() => onSave({ ...settings, padding: p })}
                  >
                    <svg className="padding-svg" viewBox="0 0 36 36">
                      <rect x="3" y="3" width="30" height="30" rx="4" className="svg-border" />
                      <line x1={offset} y1="9" x2={36 - offset} y2="9" stroke="currentColor" strokeWidth="1.5" />
                      <line x1={offset} y1="15" x2={36 - offset} y2="15" stroke="currentColor" strokeWidth="1.5" />
                      <line x1={offset} y1="21" x2={36 - offset} y2="21" stroke="currentColor" strokeWidth="1.5" />
                      <line x1={offset} y1="27" x2={p === 5 ? 20 : p === 10 ? 18 : 18} y2="27" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span className="visual-option-label">{p}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. 朗讀速度 (暫時隱藏) */}
          {/* <div className="settings-section"> ... </div> */}

          {/* 7. 資料備份與還原 */}
          <div className="settings-section">
            <div className="settings-section-title">資料備份與還原</div>
            <div className="visual-options-row" style={{ alignItems: 'stretch' }}>
              {/* 卡片 1: 完整備份 */}
              <div
                className="visual-option-card"
                onClick={() => !isExporting && setShowBackupConfirm(true)}
                style={{
                  borderColor: isExporting ? undefined : 'rgba(59, 130, 246, 0.35)',
                  backgroundColor: 'rgba(59, 130, 246, 0.04)',
                  opacity: isExporting ? 0.6 : 1,
                  padding: '0.7rem 0.3rem'
                }}
              >
                <div 
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3b82f6'
                  }}
                >
                  <Database size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span className="visual-option-label" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700 }}>
                    完整備份
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    含經文與劃線
                  </span>
                </div>
              </div>

              {/* 卡片 2: 輕量備份 */}
              <div
                className="visual-option-card"
                onClick={() => !isExporting && handleExport(false)}
                style={{
                  borderColor: isExporting ? undefined : 'rgba(16, 185, 129, 0.35)',
                  backgroundColor: 'rgba(16, 185, 129, 0.04)',
                  opacity: isExporting ? 0.6 : 1,
                  padding: '0.7rem 0.3rem'
                }}
              >
                <div 
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981'
                  }}
                >
                  <FileText size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span className="visual-option-label" style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700 }}>
                    輕量備份
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    僅劃線與設定
                  </span>
                </div>
              </div>

              {/* 分隔線 | */}
              <div 
                style={{ 
                  width: '1px', 
                  backgroundColor: 'var(--reader-border, rgba(0,0,0,0.18))', 
                  height: '36px', 
                  alignSelf: 'center',
                  margin: '0 0.15rem',
                  opacity: 0.5
                }} 
              />

              {/* 卡片 3: 還原備份 */}
              <label
                className="visual-option-card"
                style={{
                  borderColor: isImporting ? undefined : 'rgba(245, 158, 11, 0.35)',
                  backgroundColor: 'rgba(245, 158, 11, 0.04)',
                  opacity: isImporting ? 0.6 : 1,
                  cursor: isImporting ? 'default' : 'pointer',
                  padding: '0.7rem 0.3rem'
                }}
              >
                <div 
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#d97706'
                  }}
                >
                  <Upload size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span className="visual-option-label" style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 700 }}>
                    {isImporting ? '還原中...' : '還原備份'}
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    匯入 .json 檔
                  </span>
                </div>
                <input 
                  type="file" 
                  accept=".json" 
                  style={{ display: 'none' }} 
                  onChange={handleImportFile}
                  disabled={isImporting}
                />
              </label>
            </div>

            {backupMsg && (
              <div style={{ fontSize: '0.78rem', color: 'var(--accent-color, #2b6cb0)', marginTop: '0.2rem', textAlign: 'center' }}>
                {backupMsg}
              </div>
            )}
          </div>

          {/* 8. 書籍與儲存空間 */}
          <div className="settings-section">
            <div className="settings-section-title">書籍與儲存空間</div>

            {/* 容量狀態資訊框：小字 / 粗體 / 有方框 / 背景灰色 */}
            <div 
              style={{
                padding: '0.5rem 0.8rem',
                backgroundColor: 'rgba(0, 0, 0, 0.035)',
                border: '1px solid var(--reader-border, rgba(0, 0, 0, 0.12))',
                borderRadius: '8px',
                marginBottom: '0.75rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-main, #333)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <HardDrive size={15} style={{ color: 'var(--text-muted)' }} />
              <span>已下載共 {storageStats ? storageStats.bookCount : 0} 本書，總容量約 {storageStats ? storageStats.formattedUsed : '0 MB'}</span>
            </div>

            {/* 操作按鈕卡片：一鍵壓縮 | 清理快取 | 直立線 | 清空經典 */}
            <div className="visual-options-row">
              {/* 第1個: 一鍵壓縮 */}
              <div 
                className="visual-option-card"
                onClick={() => !isCompressing && handleCompressAll()}
                style={{
                  opacity: isCompressing ? 0.6 : 1,
                  padding: '0.7rem 0.3rem',
                  cursor: isCompressing ? 'default' : 'pointer'
                }}
              >
                <div 
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-main, #333)'
                  }}
                >
                  <Archive size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span className="visual-option-label" style={{ fontSize: '0.8rem', color: 'var(--text-main, #333)', fontWeight: 600 }}>
                    {isCompressing ? '壓縮中...' : '一鍵壓縮'}
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    高比例節省容量
                  </span>
                </div>
              </div>

              {/* 第2個: 清理快取 */}
              <div
                className="visual-option-card"
                onClick={handleClearCache}
                style={{
                  padding: '0.7rem 0.3rem',
                  cursor: 'pointer'
                }}
              >
                <div 
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-main, #333)'
                  }}
                >
                  <RotateCw size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span className="visual-option-label" style={{ fontSize: '0.8rem', color: 'var(--text-main, #333)', fontWeight: 600 }}>
                    清理快取
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    釋放 HTTP 暫存
                  </span>
                </div>
              </div>

              {/* 清理快取與清空經典之間的直立分隔線 | */}
              <div 
                style={{ 
                  width: '1px', 
                  backgroundColor: 'var(--reader-border, rgba(0,0,0,0.18))', 
                  height: '36px', 
                  alignSelf: 'center',
                  margin: '0 0.15rem',
                  opacity: 0.5
                }} 
              />

              {/* 第3個: 清空經典 */}
              <div
                className="visual-option-card"
                onClick={handleClearAllBooks}
                style={{
                  borderColor: 'rgba(239, 68, 68, 0.35)',
                  backgroundColor: 'rgba(239, 68, 68, 0.04)',
                  padding: '0.7rem 0.3rem',
                  cursor: 'pointer'
                }}
              >
                <div 
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626'
                  }}
                >
                  <Trash2 size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span className="visual-option-label" style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 700 }}>
                    清空經典
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    清空並恢復初始設定
                  </span>
                </div>
              </div>
            </div>

            {/* 最下面提示訊息：僅打勾勾小圖與簡潔文字，不用底色和方框 */}
            {storageMsg && (
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8rem', 
                  color: 'var(--text-main, #333)', 
                  marginTop: '0.6rem' 
                }}
              >
                <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                <span>{storageMsg}</span>
              </div>
            )}
          </div>

          {/* 9. 其他設定 */}
          <div className="settings-section">
            <div className="settings-section-title">其他設定</div>
            <div className="custom-elements-list">
              <label className="checkbox-item">
                <input 
                  type="checkbox" 
                  checked={settings.customVisibleElements?.showReaderControls ?? true} 
                  onChange={() => handleCheckboxChange('showReaderControls')}
                />
                顯示閱讀頁上下控制列
              </label>

              <label className="checkbox-item">
                <input 
                  type="checkbox" 
                  checked={settings.customVisibleElements?.autoResumeProgress ?? true} 
                  onChange={() => handleCheckboxChange('autoResumeProgress')}
                />
                開啟經文時自動回到上次閱讀位置 (未勾選則從頭開始閱讀)
              </label>

              <label className="checkbox-item">
                <input 
                  type="checkbox" 
                  checked={settings.customVisibleElements?.showNoteInText ?? false} 
                  onChange={() => handleCheckboxChange('showNoteInText')}
                />
                顯示筆記內容
              </label>
            </div>

            {/* Cbeta Reader 簡易功能導覽 按鈕 */}
            {onReplayOnboarding && (
              <div style={{ marginTop: '0.75rem', width: '100%' }}>
                <button
                  type="button"
                  onClick={onReplayOnboarding}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    border: '1.2px solid var(--theme-accent-border, rgba(140, 75, 39, 0.25))',
                    backgroundColor: 'var(--theme-accent-light, rgba(140, 75, 39, 0.05))',
                    color: 'var(--theme-accent, #8c4b27)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>📖 Cbeta Reader 簡易功能導覽</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. 版本資訊與說明列 */}
          <div className="settings-version-row">
            <div className="settings-version-info">
              {isBackupMode() ? (
                <span>backup App: v1.0.3 <span className="version-divider">|</span> Builder: v1.0.3</span>
              ) : (
                <span>App: v{APP_VERSION} <span className="version-divider">|</span> Builder: v{BUILDER_VERSION}</span>
              )}
              <button 
                type="button"
                className="version-circle-btn version-help-btn"
                onClick={() => setShowChangelog(true)}
                title="說明與版本紀錄"
                aria-label="說明與版本紀錄"
              >
                <HelpCircle size={16} />
              </button>
            </div>
            <button 
              type="button"
              className="version-circle-btn version-reload-btn"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              title="重新整理網頁（同步最新版本）"
              aria-label="重新整理網頁"
            >
              <RotateCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 完整備份確認對話框 */}
      {showBackupConfirm && (
        <div className="changelog-dialog-overlay" onClick={() => setShowBackupConfirm(false)}>
          <div className="changelog-dialog-card animate-slide-up" onClick={e => e.stopPropagation()} style={{ width: '70vw', maxWidth: '280px', borderRadius: '14px' }}>
            <div className="changelog-dialog-header" style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--reader-border, rgba(0,0,0,0.08))' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main, #333)' }}>確認完整備份</h4>
              <button className="changelog-dialog-close-btn" onClick={() => setShowBackupConfirm(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="changelog-dialog-body" style={{ padding: '0.9rem 1rem' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-main, #333)', lineHeight: '1.5', marginBottom: '0.9rem' }}>
                <p style={{ margin: '0 0 0.65rem 0', fontWeight: 500, color: 'var(--text-secondary, #666)' }}>
                  即將進行完整備份匯出（包含全部經文資料、劃線重點與個人閱讀設定）：
                </p>
                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'auto auto', 
                    justifyContent: 'center', 
                    columnGap: '0.6rem', 
                    rowGap: '0.4rem', 
                    backgroundColor: 'rgba(0,0,0,0.03)', 
                    borderRadius: '10px', 
                    padding: '0.6rem 0.7rem' 
                  }}
                >
                  <span style={{ color: 'var(--text-muted, #666)', textAlign: 'right' }}>目前離線經書：</span>
                  <strong style={{ color: 'var(--text-main, #222)', textAlign: 'left' }}>共 {storageStats ? storageStats.bookCount : 0} 本書</strong>

                  <span style={{ color: 'var(--text-muted, #666)', textAlign: 'right' }}>預計備份容量：</span>
                  <strong style={{ color: 'var(--text-main, #222)', textAlign: 'left' }}>共 {storageStats ? storageStats.formattedUsed : '0 MB'}</strong>

                  <span style={{ color: 'var(--text-muted, #666)', textAlign: 'right' }}>預計備份時間：</span>
                  <strong style={{ color: '#2563eb', textAlign: 'left' }}>{getEstimatedBackupTime(storageStats?.usedBytes)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.9rem' }}>
                <button
                  type="button"
                  onClick={() => setShowBackupConfirm(false)}
                  style={{
                    padding: '0.38rem 0.9rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    border: '1px solid var(--reader-border, rgba(0,0,0,0.15))',
                    backgroundColor: 'transparent',
                    color: 'var(--text-main, #444)',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBackupConfirm(false);
                    handleExport(true);
                  }}
                  style={{
                    padding: '0.38rem 1rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--theme-accent, #8c4b27)',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  確認備份
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChangelog && (
        <div className="changelog-dialog-overlay" onClick={() => setShowChangelog(false)}>
          <div className="changelog-dialog-card animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="changelog-dialog-header">
              <h4>版本更新說明</h4>
              <button className="changelog-dialog-close-btn" onClick={() => setShowChangelog(false)}>
                <X size={16} />
              </button>
            </div>
            <div ref={changelogBodyRef} className="changelog-dialog-body custom-scrollbar" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1.2rem' }}>
              {isBackupMode() ? (
                <>
                  {/* 第一部分：App 閱讀器介面更新 (備援專用) */}
                  <div className="changelog-group-section" style={{ marginBottom: '1.8rem' }}>
                    <div style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--theme-accent, #8c4b27)',
                      borderBottom: '1.5px solid var(--theme-accent-border, rgba(140, 75, 39, 0.25))',
                      paddingBottom: '0.4rem',
                      marginBottom: '0.9rem',
                      fontFamily: 'var(--font-serif)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      <FileText size={16} style={{ strokeWidth: 2.2 }} />
                      <span>App 閱讀器介面更新 (備援專用)</span>
                    </div>

                    <div className="changelog-version-section">
                      <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>⭐ backup App: v1.0.3</span>
                        <span className="changelog-date">(2026-08-10)</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• 移除備援模式內建預設熱門經典，完全依賴真實備援資料庫檢索。</li>
                        <li>• 確保備援庫檔完整度精確呈現，利於精準驗證每部經典。</li>
                      </ul>
                    </div>

                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">
                        <span>backup App: v1.0.2</span>
                        <span className="changelog-date">(2026-08-09)</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• 調整閱讀頁「備援」標籤位置，由頂部控制列移至經文正文標題正上方。</li>
                        <li>• 全面升級所有「備援」視覺標籤字型為清新正黑體（sans-serif）。</li>
                      </ul>
                    </div>

                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">
                        <span>backup App: v1.0.1</span>
                        <span className="changelog-date">(2026-08-08)</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• 新增備援閱讀模式視覺識別標籤與獨立 `?source=backup` 網址切換機制。</li>
                        <li>• 支援備援專用閱讀設定與系統版本歷史區隔。</li>
                      </ul>
                    </div>
                  </div>

                  {/* 第二部分：Builder 經文解析引擎更新 (備援專用) */}
                  <div ref={builderSectionRef} className="changelog-group-section" style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--theme-accent, #8c4b27)',
                      borderBottom: '1.5px solid var(--theme-accent-border, rgba(140, 75, 39, 0.25))',
                      paddingBottom: '0.4rem',
                      marginBottom: '0.9rem',
                      fontFamily: 'var(--font-serif)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      <Database size={16} style={{ strokeWidth: 2.2 }} />
                      <span>Builder 經文解析引擎更新 (備援專用)</span>
                    </div>

                    <div className="changelog-version-section">
                      <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>⭐ backup Builder: v1.0.3</span>
                        <span className="changelog-date">(2026-08-10)</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• 停用備援模式 `FEATURED_BOOKS` 後備機制，100% 直連備援索引庫 (`cbeta-works-index.json` / GitHub Releases 資產)。</li>
                        <li>• 支援零補償真實校驗，精確揭露離線備援資料庫經文完整性。</li>
                      </ul>
                    </div>

                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">
                        <span>backup Builder: v1.0.2</span>
                        <span className="changelog-date">(2026-08-09)</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• 修正備援模式線上檢索限制，解鎖全 CBETA 大藏經庫資料大範圍查詢（包含「玄奘」78 本、「地藏」20+ 本等全庫檢索）。</li>
                        <li>• 備援資料摘要註明經文內容版本號 `(CBReader 2X v0.9.9 2026-01-21)`。</li>
                      </ul>
                    </div>

                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">
                        <span>backup Builder: v1.0.1</span>
                        <span className="changelog-date">(2026-08-08 開始)</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• <strong>開始日期</strong>：2026-08-08 正式建立獨立備援解析與靜態鏡像下載機制。</li>
                        <li>• <strong>備援來源地點</strong>：專屬 `/backup` 本地靜態庫與 GitHub CDN / Cloudflare R2 離線預編譯鏡像檔 (`/backup/[workId]/[juan].json`)。</li>
                        <li>• <strong>備援資料摘要</strong>：收錄 CBETA 大藏經全冊全卷（經文內容版本為 CBReader 2X v0.9.9 2026-01-21）離線預編譯 JSON 經文包。</li>
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* 第一部分：App 閱讀器介面更新 */}
              <div className="changelog-group-section" style={{ marginBottom: '1.8rem' }}>
                <div style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--theme-accent, #8c4b27)',
                  borderBottom: '1.5px solid var(--theme-accent-border, rgba(140, 75, 39, 0.25))',
                  paddingBottom: '0.4rem',
                  marginBottom: '0.9rem',
                  fontFamily: 'var(--font-serif)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <FileText size={16} style={{ strokeWidth: 2.2 }} />
                  <span>App 閱讀器介面更新</span>
                </div>

                {/* 最新 App 版本 (v4.2.2) 直接顯示 */}
                <div className="changelog-version-section">
                  <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    <span>⭐ App: v4.2.2</span>
                    <span className="changelog-date">(2026-08-22)</span>
                  </div>
                  <ul className="changelog-list">
                    <li>• 閱讀頁上方控制列「三」選單，全書目固定提供「目次」與「卷/篇章」雙分頁。</li>
                    <li>• 首頁書架全站手勢左右滑動升級為整頁飛出式平滑切換，並加入方向鎖定防垂直位移。</li>
                  </ul>
                </div>

                {/* 置左按鈕：+ 更多 App 修改歷程 (未展開時顯示於最新版下方) */}
                {!showAppHistory && (
                  <div style={{ marginTop: '0.6rem', textAlign: 'left' }}>
                    <button 
                      type="button"
                      className="changelog-history-btn"
                      onClick={() => {
                        setShowAppHistory(true);
                        setShowBuilderHistory(false); // 自動收合 Builder 歷程
                      }}
                    >
                      + 更多 App 修改歷程
                    </button>
                  </div>
                )}

                {/* 展開的 App 歷史版本 */}
                {showAppHistory && (
                  <div className="changelog-history-wrapper animate-fade-in" style={{ marginTop: '0.6rem' }}>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">⭐ App: v4.2.1 <span className="changelog-date">(2026-08-21)</span></div>
                      <ul className="changelog-list">
                        <li>• 首頁書架每本經典顯示「卷數」，印順導師著作/近代編著不顯示（依書目特性自動判斷）。</li>
                        <li>• 下載進度顯示「共X卷，已完成X卷，剩X卷，約剩時間」，即時呈現下載進度。</li>
                        <li>• 下載進度六格方塊調整為 1:1 正方形並新增中英雙語標籤，完整展示 Builder 建構引擎能力。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.2.0 <span className="changelog-date">(2026-08-21)</span></div>
                      <ul className="changelog-list">
                        <li>• 手機版下方浮動膠囊列與護眼計時器緊湊自適應排版，防止超出邊緣。</li>
                        <li>• 「畫重點」與「目次」選單支援滑動、點擊螢幕及按其他鍵時自動隱藏。</li>
                        <li>• 閱讀頁下方浮動膠囊列升級為 20% 半透明毛玻璃質感。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.1.8 <span className="changelog-date">(2026-08-21)</span></div>
                      <ul className="changelog-list">
                        <li>• 點選目次章節跳轉時，精確將該品章節標題置於畫面頂端第一行。</li>
                        <li>• 經文檢索切換時，精確將目標關鍵字置中偏上對齊，解決落在螢幕外之問題。</li>
                        <li>• 閱讀滑動頁面時，動態即時同步檢索 Bar 序號與當前關鍵字位置。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.1.7 <span className="changelog-date">(2026-08-21)</span></div>
                      <ul className="changelog-list">
                        <li>• 完善本地經典檢索淺色主題文字對比度，提示文字清晰呈現。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.1.6 <span className="changelog-date">(2026-08-20)</span></div>
                      <ul className="changelog-list">
                        <li>• 修正子資料夾內經書點選「移出至上一層」時，精確退回上一層資料夾或「我的書櫃」。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.1.5 <span className="changelog-date">(2026-08-20)</span></div>
                      <ul className="changelog-list">
                        <li>• 經書管理對話框支援動態即時計算與自動補齊字數與預計閱讀時間。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.1.4 <span className="changelog-date">(2026-08-20)</span></div>
                      <ul className="changelog-list">
                        <li>• 批量下載經書至指定資料夾完成後，即時同步資料夾與經書歸類，免手動重新整理。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.1.3 <span className="changelog-date">(2026-08-20)</span></div>
                      <ul className="changelog-list">
                        <li>• 經典與版權資訊將「譯者」統一調整為「作譯者」，並完善作譯者顯示。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.1.2 <span className="changelog-date">(2026-08-19)</span></div>
                      <ul className="changelog-list">
                        <li>• 閱讀頁下方控制列升級為「4 色背景快捷切換」與「字體大小 A-/A+ 調整器」。</li>
                        <li>• 新增「開啟經文時自動回到上次閱讀位置」設定，免去每次進入經文時的詢問彈窗。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.1.1 <span className="changelog-date">(2026-08-19)</span></div>
                      <ul className="changelog-list">
                        <li>• 新增「Cbeta Reader 簡易功能導覽」生動互動演示（支援 5 步驟操作教學與手機左右滑動翻頁）。</li>
                        <li>• 於閱讀設定之「其他設定」新增導覽快捷重播按鈕，方便隨時複習上手。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span>App: v4.1.0</span>
                        <span className="changelog-date">(2026-08-17)</span>
                        <span style={{ fontSize: '0.72rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--theme-accent, #8c4b27)', color: 'var(--theme-accent, #8c4b27)', fontWeight: 'bold', marginLeft: '2px' }}>重大更新</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• 全面升級「依作譯者」查詢，100% 對齊 CBETA 官方 1~29 筆劃、首字分組與 2,000+ 位權威作譯者作品目錄。</li>
                        <li>• 經書管理對話框調整為「移至資料夾 | 加入我的最愛 | 刪除經文」等寬三欄配置。</li>
                        <li>• 目次選單帶有折疊項目者預設一律收合。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.0.7 <span className="changelog-date">(2026-08-17)</span></div>
                      <ul className="changelog-list">
                        <li>• 「重點與筆記」收合設定，依內文順序排列。</li>
                        <li>• 調整閱讀頁面上方控制列的「文字大小」、「畫重點」設定。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.0.1 <span className="changelog-date">(2026-08-08)</span></div>
                      <ul className="changelog-list">
                        <li>• 修復散文段落偈頌體誤判折行問題。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span>App: v4.0.0</span>
                        <span className="changelog-date">(2026-08-06)</span>
                        <span style={{ fontSize: '0.72rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--theme-accent, #8c4b27)', color: 'var(--theme-accent, #8c4b27)', fontWeight: 'bold', marginLeft: '2px' }}>重大更新</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• 在首頁新增「重點與筆記」頁面。</li>
                        <li>• 手機不同頁面可用手勢左滑/右滑切換。</li>
                        <li>• 重新調整簡潔首頁，將四大資料夾放在主標之下。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v3.2.0 <span className="changelog-date">(2026-08-02)</span></div>
                      <ul className="changelog-list">
                        <li>• 微調首頁版面，新增「近期閱讀」與「我的最愛」系統資料夾。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v3.1.0 <span className="changelog-date">(2026-08-01)</span></div>
                      <ul className="changelog-list">
                        <li>• 閱讀設定中「畫重點設定」直覺設定。</li>
                        <li>• 新增「設定閱讀時間 (護眼模式)」，時間到了溫馨提醒。</li>
                        <li>• 主頁更名為「CBETA Reader 淨心小角落．閱讀大藏經」。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span>App: v2.3.0</span>
                        <span className="changelog-date">(2026-07-29)</span>
                        <span style={{ fontSize: '0.72rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--theme-accent, #8c4b27)', color: 'var(--theme-accent, #8c4b27)', fontWeight: 'bold', marginLeft: '2px' }}>重大更新</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• 新增「儲存空間與全集壓縮管理」，支援高動態 Gzip 壓縮，大大節省 80% 本地容量。</li>
                        <li>• 新增一鍵「清理 HTTP 網路快取」與動態容量儀表板，輕鬆釋放手機暫存空間。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v2.2.0 <span className="changelog-date">(2026-07-28)</span></div>
                      <ul className="changelog-list">
                        <li>• 新增「內文字體」選擇，提供宋/明體、正黑體、芫荽體與教育部標楷體等四種開放字型。</li>
                        <li>• 修復「烏木」模式畫重點顯示方式</li>
                        <li>• 修復 iOS 閱讀頁面防跑機制。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v2.1.0 <span className="changelog-date">(2026-07-28)</span></div>
                      <ul className="changelog-list">
                        <li>• 支援搜尋經書「整批勾選經典」與「批量下載」。</li>
                        <li>• 批量下載時可自動帶出關鍵字作為資料夾名稱並支援自訂修改。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v2.0.0 <span className="changelog-date">(2026-07-27)</span></div>
                      <ul className="changelog-list">
                        <li>• 設定 PWA / iOS「加入主畫面」的桌面圖示。</li>
                        <li>• 首頁新增經書「批量移動至資料夾」功能。</li>
                        <li>• 調整經書卡片寬度。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v1.8.0 <span className="changelog-date">(2026-07-25)</span></div>
                      <ul className="changelog-list">
                        <li>• 微調偈頌體段落行距。</li>
                        <li>• 大藏經經號依 A~Z 自動分配 26 套典雅經典封面色系。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v1.7.0 <span className="changelog-date">(2026-07-24)</span></div>
                      <ul className="changelog-list">
                        <li>• 新增完整與輕量資料備份與還原功能（.json 匯出匯入）。</li>
                        <li>• 升級雙向導航防錯機制，解決目次跳轉定位問題。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v1.6.0 <span className="changelog-date">(2026-07-23)</span></div>
                      <ul className="changelog-list">
                        <li>•微調經文內排版方式。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v1.4.0 <span className="changelog-date">(2026-07-23)</span></div>
                      <ul className="changelog-list">
                        <li>• 閱讀頁目次調整為可展開/折疊的多層級樹狀選單。</li>
                        <li>• 新增畫重點筆刷功能。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v1.1.0 <span className="changelog-date">(2026-07-20)</span></div>
                      <ul className="changelog-list">
                        <li>• 調整經書下載停留在原頁面。</li>
                        <li>• 統一APP上方控制列高度。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v1.0.0 <span className="changelog-date">(2026-07-15)</span></div>
                      <ul className="changelog-list">
                        <li>• 建置初始首頁設定、閱讀頁設定、經書內文搜尋設定、經書下載設定。</li>
                      </ul>
                    </div>

                    {/* 置左按鈕：− 收起 App 歷史紀錄 (收起後自動捲回頂部) */}
                    <div style={{ marginTop: '0.8rem', textAlign: 'left' }}>
                      <button 
                        type="button"
                        className="changelog-history-btn"
                        onClick={handleCollapseAppHistory}
                      >
                        − 收起 App 歷史紀錄
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 第二部分：Builder 經文解析引擎更新 */}
              <div ref={builderSectionRef} className="changelog-group-section" style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--theme-accent, #8c4b27)',
                  borderBottom: '1.5px solid var(--theme-accent-border, rgba(140, 75, 39, 0.25))',
                  paddingBottom: '0.4rem',
                  marginBottom: '0.9rem',
                  fontFamily: 'var(--font-serif)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <Database size={16} style={{ strokeWidth: 2.2 }} />
                  <span>Builder 經文解析引擎更新</span>
                </div>

                {/* 最新 Builder 版本 (v2.9.10) 直接顯示 */}
                <div className="changelog-version-section">
                  <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⭐ Builder: v2.9.10</span>
                    <span className="changelog-date">(2026-08-21)</span>
                  </div>
                  <ul className="changelog-list">
                    <li>• 重構目錄導航精準度，優先匹配經文內真實標題段落與近鄰 lb 探測，精確錨定品名起點。</li>
                  </ul>
                </div>

                {/* 置左按鈕：+ 更多 Builder 修改歷程 (未展開時顯示於最新版下方) */}
                {!showBuilderHistory && (
                  <div style={{ marginTop: '0.6rem', textAlign: 'left' }}>
                    <button 
                      type="button"
                      className="changelog-history-btn"
                      onClick={() => {
                        setShowBuilderHistory(true);
                        setShowAppHistory(false); // 自動收合 App 歷程
                        scrollToBuilderSection(80); // 捲動至 Builder 區塊標題
                      }}
                    >
                      + 更多 Builder 修改歷程
                    </button>
                  </div>
                )}

                {/* 展開的 Builder 歷史版本 */}
                {showBuilderHistory && (
                  <div className="changelog-history-wrapper animate-fade-in" style={{ marginTop: '0.6rem' }}>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v2.9.9 <span className="changelog-date">(2026-08-20)</span></div>
                      <ul className="changelog-list">
                        <li>• 完善經文書籍打包引擎，全面自動提取並計算 CJK 漢字與英數總字數。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v2.9.7 <span className="changelog-date">(2026-08-17)</span></div>
                      <ul className="changelog-list">
                        <li>• 系統性修復全藏經帶有前綴之 lb 行號識別，修正目次小節精確錨定。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v2.9.6 <span className="changelog-date">(2026-08-16)</span></div>
                      <ul className="changelog-list">
                        <li>• 修正目錄段落標題索引，精準錨定經文起始節點。</li>
                        <li>• 修正巢狀目錄列表文字重複，保留項目獨立段落。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v2.9.1 <span className="changelog-date">(2026-08-11)</span></div>
                      <ul className="changelog-list">
                        <li>• 新增從 HTML cb:div 結構提取多層層次目錄樹引擎，解決目次扁平無層次問題。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v2.4.0 <span className="changelog-date">(2026-07-31)</span> <span style={{ fontSize: '0.72rem', color: 'var(--theme-accent, #8c4b27)', fontWeight: 700, border: '1px solid var(--theme-accent, #8c4b27)', padding: '1px 5px', borderRadius: '4px', marginLeft: '4px' }}>重大更新</span></div>
                      <ul className="changelog-list">
                        <li>• 升級 6 線程防限流下載與自動修復，智慧部類關鍵字智慧自動關聯。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v2.2.0 <span className="changelog-date">(2026-07-28)</span></div>
                      <ul className="changelog-list">
                        <li>• 完整保留 CBETA 異體字與組字標籤（如: [言*(狂-王+主)]），還原缺字表達。</li>
                        <li>• 修正 CJK 空格清理算法，保留「一　」、「二　」等節號縮排全形空格。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v2.1.0 <span className="changelog-date">(2026-07-26)</span></div>
                      <ul className="changelog-list">
                        <li>• 優先讀取 CBETA 規範作譯者名稱（如: 西晉 竺法護），對齊官方名稱。</li>
                        <li>• 升級冊別解析算法，補齊少數經典遺漏的冊別欄位（如: T12）。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v2.0.0 <span className="changelog-date">(2026-07-25)</span></div>
                      <ul className="changelog-list">
                        <li>• 支援印順導師著作附圖與圖表段落（div-figure）解析。</li>
                        <li>• 解決 Y0003 勝鬘經講記等圖表段落單字碎裂斷行問題。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v1.9.0 <span className="changelog-date">(2026-07-25)</span></div>
                      <ul className="changelog-list">
                        <li>• 修正 CBETA 清單與列表標籤（ul/li）段落分割算法，防止文字被拆散。</li>
                        <li>• 徹底消除紙本折行導致的多餘空格，還原 CC0006 清單縮排與 bullet (•)。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v1.5.0 <span className="changelog-date">(2026-07-23)</span></div>
                      <ul className="changelog-list">
                        <li>• 精確解析論典與講記中的原始經文引用（div-orig / p.bold）並標註 isOrig。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v1.3.0 <span className="changelog-date">(2026-07-21)</span></div>
                      <ul className="changelog-list">
                        <li>• 印順導師著作（Y系列）目次結構二層優化與無卷書籍去卷化適應。</li>
                        <li>• 偈頌體置左左縮排排版優化。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v1.2.0 <span className="changelog-date">(2026-07-21)</span></div>
                      <ul className="changelog-list">
                        <li>• 建立 Builder 獨立版號與無縫背景升級修復機制（保留劃線與筆記）。</li>
                      </ul>
                    </div>

                    {/* 置左按鈕：− 收起 Builder 歷史紀錄 (收起後自動捲回 Builder 區塊) */}
                    <div style={{ marginTop: '0.8rem', textAlign: 'left' }}>
                      <button 
                        type="button"
                        className="changelog-history-btn"
                        onClick={handleCollapseBuilderHistory}
                      >
                        − 收起 Builder 歷史紀錄
                      </button>
                    </div>
                  </div>
                )}
              </div>
                </>
              )}


              {/* 4. CBETA Reader 簡介與感言區塊 (隔一條線，小字呈現) */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.2rem', borderTop: '1px dashed var(--reader-border, rgba(0,0,0,0.15))' }}>
                <div style={{ fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--reader-text-muted, #777)', opacity: 0.88, textAlign: 'justify' }}>
                  <p style={{ margin: 0 }}>
                    本網站「CBETA Reader 淨心小角落．閱讀大藏經」(非官方)，以 CBETA 佛典資料庫為基礎，為讀者打造一個舒適、溫暖又簡潔的淨心小角落，讓閱讀大藏經可以成為日常。網站內每一個小角落都有我們的用心，如有任何錯誤、疏漏需要修改或其他的建議，都歡迎不吝指導並來信寄至Email: <a href="mailto:vbgrdmental@gmail.com" style={{ color: 'inherit', textDecoration: 'underline' }}>vbgrdmental@gmail.com</a>。祝福法喜充滿，福慧雙修，無限感恩。
                  </p>
                </div>

                {/* 💡 願文偈頌區塊 (細線之下，置中/粗體/圓體/灰黑/小字/上下間距，出處置右斜體再小一級並留底間距) */}
                <div style={{ marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid var(--reader-border, rgba(0,0,0,0.12))' }}>
                  <div style={{
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    lineHeight: 1.85,
                    color: 'var(--reader-text-muted, #555)',
                    fontFamily: 'var(--font-rounded)',
                    margin: '0.5rem 0'
                  }}>
                    <p style={{ margin: '0 0 0.3rem 0' }}>願諸世界常安隱，無邊福智益群生，</p>
                    <p style={{ margin: '0 0 0.3rem 0' }}>所有罪業並消除，遠離眾苦歸圓寂。</p>
                    <p style={{ margin: '0 0 0.3rem 0' }}>恒用戒香塗瑩體，常持定服以資身，</p>
                    <p style={{ margin: 0 }}>菩提妙華遍莊嚴，隨所住處常安樂。</p>
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontStyle: 'italic',
                    fontSize: '0.72rem',
                    color: 'var(--reader-text-muted, #666)',
                    fontFamily: 'var(--font-rounded)',
                    marginTop: '0.5rem',
                    marginBottom: '0.9rem',
                    opacity: 0.88
                  }}>
                    －－《佛說無常經》T0801
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
