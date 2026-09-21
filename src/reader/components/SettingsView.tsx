import { useState, useEffect, useRef } from 'react';
import { X, Database, FileText, HelpCircle, RotateCw, CheckCircle2, Check } from 'lucide-react';
import type { AppSettings, StorageStats } from '../../utils/db';
import { getStorageStats, clearHttpCacheStorage, compressAllBooks, clearAllBooks, saveSettings, DEFAULT_SETTINGS } from '../../utils/db';
import { BUILDER_VERSION, APP_VERSION } from '../../builder/version';
import { exportUserData, importUserData } from '../../utils/backup';
import { readingTimer, formatTimerMMSS } from '../../utils/readingTimer';
import { loadEduKaiFontOnDemand } from '../../utils/fontLoader';
import type { ReadingTimerState } from '../../utils/readingTimer';
import { isBackupMode } from '../../utils/sourceMode';
import { PRESET_LAYOUTS } from '../../types/homeLayout';
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

  // 💡 進階功能折疊開關 (預設收合)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // 💡 按需動態加載教育部標楷體 (Lazy-Load WOFF2)
  useEffect(() => {
    if (settings.fontFamily === 'kaiti' || settings.fontFamily === 'yuanti' || settings.fontFamily === 'fangsong' || settings.fontFamily === 'wenkai' || settings.fontFamily === 'iansui-zy' || settings.fontFamily === 'iansui-bold') {
      loadEduKaiFontOnDemand();
    }
  }, [settings.fontFamily]);

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

  const getEstimatedMinutes = (usedBytes?: number): number => {
    if (!usedBytes || usedBytes <= 0) return 0;
    const sizeMB = usedBytes / (1024 * 1024);
    if (sizeMB <= 20) return 1;
    return Math.ceil(sizeMB / 20);
  };

  const getEstimatedBackupTime = (usedBytes?: number): string => {
    const mins = getEstimatedMinutes(usedBytes);
    if (mins <= 1) return '< 1 分鐘';
    return `約 ${mins} 分鐘`;
  };

  const handleTriggerFullBackup = () => {
    if (isExporting) return;
    const mins = getEstimatedMinutes(storageStats?.usedBytes);
    // 依使用者規則：如評估超過三分鐘以上，必須有對話窗跳出提醒
    if (mins >= 3) {
      setShowBackupConfirm(true);
    } else {
      handleExport(true);
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
      const parts = [];
      if (res.booksCount > 0) parts.push(`${res.booksCount} 本經文`);
      if (res.highlightsCount > 0) parts.push(`${res.highlightsCount} 筆重點`);
      if (res.readingLogsCount > 0) parts.push(`${res.readingLogsCount} 筆閱讀日誌`);
      if (parts.length > 0) {
        msg = `已成功還原 ${parts.join('、')} 與個人設定！`;
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
          {/* 💡 閱讀版面預覽標題列與右上角 4 色主題色盤 */}
          <div 
            className="reading-preview-top-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.65rem'
            }}
          >
            <div className="settings-section-title" style={{ margin: 0 }}>閱讀版面預覽</div>
            
            {/* 右上角 4 個圓形質感主題色盤 */}
            <div className="preview-theme-swatches" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {[
                { id: 'ivory', label: '象牙白', bg: '#faf7f0' },
                { id: 'parchment', label: '羊皮紙', bg: '#f1e5c9' },
                { id: 'comfort', label: '舒服', bg: '#e3ebd9' },
                { id: 'ebony', label: '烏木', bg: '#12161a' }
              ].map(t => {
                const isActive = settings.theme === t.id;
                return (
                  <div
                    key={`preview-theme-${t.id}`}
                    onClick={() => onSave({ ...settings, theme: t.id as AppSettings['theme'] })}
                    title={t.label}
                    style={{
                      width: '23px',
                      height: '23px',
                      borderRadius: '50%',
                      backgroundColor: t.bg,
                      border: isActive 
                        ? (settings.theme === 'ebony' ? '2px solid #fbbf24' : '2px solid var(--theme-accent, #8c4b27)') 
                        : (settings.theme === 'ebony' ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid rgba(0,0,0,0.18)'),
                      boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.06)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: isActive ? 'scale(1.12)' : 'scale(1)',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    {isActive && (
                      <Check 
                        size={12} 
                        strokeWidth={3.5} 
                        style={{ color: t.id === 'ebony' ? '#fbbf24' : '#2c2016' }} 
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 閱讀版面預覽與 2x2 對稱分段膠囊工作台 */}
          <div className="reading-layout-card">
            {/* 即時經文預覽框 (完整模擬主題、字體、字級、行高、邊距) */}
            <div 
              className="reading-preview-content-box custom-scrollbar"
              style={{
                display: 'block',
                minHeight: '110px',
                maxHeight: '155px',
                overflowY: 'auto',
                boxSizing: 'border-box',
                backgroundColor: settings.theme === 'ivory' ? '#faf7f0' : settings.theme === 'parchment' ? '#f1e5c9' : settings.theme === 'comfort' ? '#e3ebd9' : '#12161a',
                color: settings.theme === 'ebony' ? '#d8dec9' : settings.theme === 'comfort' ? '#23351d' : settings.theme === 'parchment' ? '#3c2a1a' : '#2c2016',
                fontFamily: (settings.fontFamily === 'jhenghei') ? '"Microsoft JhengHei", "PingFang TC", "STHeiti", sans-serif' : (settings.fontFamily === 'iansui') ? '"Iansui", "Klee One", serif' : (settings.fontFamily === 'kaiti' || settings.fontFamily === 'yuanti' || settings.fontFamily === 'fangsong' || settings.fontFamily === 'wenkai' || settings.fontFamily === 'iansui-zy' || settings.fontFamily === 'iansui-bold') ? '"CBETASupplement", "MOE-EduKai", "TW-Kai-98", "TW-Kai", "標楷體", "BiauKai", "DFKai-SB", "STKaiti", "KaiTi", "Kaiti SC", "Kaiti TC", serif' : 'var(--font-serif)',
                lineHeight: settings.lineHeight || 1.8,
                padding: `0.9rem ${settings.padding || 10}%`,
                fontSize: `${settings.fontSize || 22}px`,
                textAlign: 'justify',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '0.5em' }}>如是我聞：</div>
              <div>
                一時，佛在忉利天，為母說法。爾時，十方無量世界，不可說不可說一切諸佛，及大菩薩摩訶薩，皆來集會。讚歎釋迦牟尼佛，能於五濁惡世，現不可思議大智慧神通之力，調伏剛彊眾生，知苦樂法，各遣侍者，問訊世尊。是時，
              </div>
            </div>

            {/* 2x2 對稱膠囊控制列 */}
            <div className="reading-controls-grid-2x2">
              {/* Row 1, Left: 字體膠囊 [ 宋/明 | 黑體 | 楷體 ] */}
              <div className="segmented-pill-capsule">
                {[
                  { id: 'default', name: '宋/明', fontFamily: 'var(--font-serif)' },
                  { id: 'jhenghei', name: '黑體', fontFamily: '"Microsoft JhengHei", "PingFang TC", "STHeiti", sans-serif' },
                  { id: 'kaiti', name: '楷體', fontFamily: '"CBETASupplement", "MOE-EduKai", "TW-Kai-98", "TW-Kai", "標楷體", "BiauKai", "DFKai-SB", "STKaiti", "KaiTi", serif' }
                ].map(f => {
                  const rawFont = settings.fontFamily || 'default';
                  const currentFont = (rawFont === 'yuanti' || rawFont === 'fangsong' || rawFont === 'wenkai' || rawFont === 'iansui-zy' || rawFont === 'iansui-bold' || rawFont === 'kaiti') ? 'kaiti' : (rawFont === 'jhenghei' ? 'jhenghei' : 'default');
                  const isActive = currentFont === f.id;
                  return (
                    <button
                      key={`pill-font-${f.id}`}
                      type="button"
                      className={`segmented-pill-btn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (f.id === 'kaiti') {
                          loadEduKaiFontOnDemand();
                        }
                        onSave({ ...settings, fontFamily: f.id as any });
                      }}
                      style={{ fontFamily: f.fontFamily }}
                    >
                      {f.name}
                    </button>
                  );
                })}
              </div>

              {/* Row 1, Right: 大小膠囊 [ A- | 24px | A+ ] */}
              <div className="segmented-pill-capsule">
                <button
                  type="button"
                  className="segmented-pill-btn"
                  onClick={() => onSave({ ...settings, fontSize: Math.max(12, (settings.fontSize || 22) - 1) })}
                  title="縮小字體 (A-)"
                  style={{ fontWeight: 700 }}
                >
                  A-
                </button>
                <div className="segmented-pill-val">
                  {settings.fontSize || 22}px
                </div>
                <button
                  type="button"
                  className="segmented-pill-btn"
                  onClick={() => onSave({ ...settings, fontSize: Math.min(36, (settings.fontSize || 22) + 1) })}
                  title="放大字體 (A+)"
                  style={{ fontWeight: 700 }}
                >
                  A+
                </button>
              </div>

              {/* Row 2, Left: 行高膠囊 [ 1.6 | 1.8 | 2.0 ] */}
              <div className="segmented-pill-capsule">
                {[1.6, 1.8, 2.0].map(lh => {
                  const isActive = settings.lineHeight === lh || (lh === 2.0 && settings.lineHeight > 1.9);
                  return (
                    <button
                      key={`pill-lh-${lh}`}
                      type="button"
                      className={`segmented-pill-btn ${isActive ? 'active' : ''}`}
                      onClick={() => onSave({ ...settings, lineHeight: lh })}
                    >
                      {lh.toFixed(1)}
                    </button>
                  );
                })}
              </div>

              {/* Row 2, Right: 邊距膠囊 [ 5% | 10% | 15% ] */}
              <div className="segmented-pill-capsule">
                {[5, 10, 15].map(p => {
                  const isActive = settings.padding === p || (p === 15 && settings.padding >= 15);
                  return (
                    <button
                      key={`pill-pad-${p}`}
                      type="button"
                      className={`segmented-pill-btn ${isActive ? 'active' : ''}`}
                      onClick={() => onSave({ ...settings, padding: p })}
                    >
                      {p}%
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. 畫重點設定 (左右 1:1 對稱分段膠囊 + 即時同步筆刷色) */}
          <div className="settings-section">
            <div className="settings-section-title">畫重點設定</div>
            
            <div 
              className="highlight-controls-grid-2col"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.65rem',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              {/* 左側：4 色圓潤膠囊列 */}
              <div className="segmented-pill-capsule">
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
                    <button
                      key={`hl-pill-color-${color}`}
                      type="button"
                      className={`segmented-pill-btn ${isActive ? 'active' : ''}`}
                      onClick={() => onSave({ ...settings, highlightColor: color })}
                      title={labelMap[color]}
                      style={{ padding: '0.35rem 0.1rem' }}
                    >
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: colorMap[color],
                          border: isActive ? '1.5px solid var(--text-primary)' : '1px solid var(--reader-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.15)' : 'none'
                        }}
                      >
                        {isActive && (
                          <Check 
                            size={10} 
                            strokeWidth={3.5} 
                            style={{ color: color === 'yellow' ? '#2c2016' : '#ffffff' }} 
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 右側：標註模式 4 分段膠囊 (依左側顏色即時同步呈現相應樣式) */}
              <div className="segmented-pill-capsule">
                {(() => {
                  const hlHex = 
                    settings.highlightColor === 'yellow' ? '#fbbf24' :
                    settings.highlightColor === 'red' ? '#f87171' :
                    settings.highlightColor === 'gray' ? '#9ca3af' : '#60a5fa';

                  const hlRgba = 
                    settings.highlightColor === 'yellow' ? 'rgba(250, 204, 21, 0.65)' :
                    settings.highlightColor === 'red' ? 'rgba(248, 113, 113, 0.65)' :
                    settings.highlightColor === 'gray' ? 'rgba(156, 163, 175, 0.65)' : 'rgba(96, 165, 250, 0.65)';

                  return (['underline', 'bottom-half', 'full', 'border'] as const).map((style) => {
                    const labelMap = {
                      underline: '底線',
                      'bottom-half': '半塗',
                      full: '全塗',
                      border: '方框'
                    };
                    const isActive = settings.highlightStyle === style;

                    const renderStyleContent = () => {
                      switch (style) {
                        case 'underline':
                          return (
                            <span style={{ borderBottom: `2.5px solid ${hlHex}`, paddingBottom: '1px' }}>
                              底線
                            </span>
                          );
                        case 'bottom-half':
                          return (
                            <span style={{ background: `linear-gradient(180deg, transparent 52%, ${hlRgba} 52%)`, padding: '0 2px', borderRadius: '2px' }}>
                              半塗
                            </span>
                          );
                        case 'full':
                          return (
                            <span style={{ backgroundColor: hlRgba, borderRadius: '3px', padding: '1px 3px', color: (settings.highlightColor === 'yellow' && settings.theme === 'ebony') ? '#000000' : 'inherit' }}>
                              全塗
                            </span>
                          );
                        case 'border':
                          return (
                            <span style={{ border: `1.8px solid ${hlHex}`, borderRadius: '3px', padding: '0 2px' }}>
                              方框
                            </span>
                          );
                      }
                    };

                    return (
                      <button
                        key={`hl-style-${style}`}
                        type="button"
                        className={`segmented-pill-btn ${isActive ? 'active' : ''}`}
                        onClick={() => onSave({ ...settings, highlightStyle: style })}
                        title={labelMap[style]}
                        style={{
                          padding: '0.42rem 0.1rem',
                          fontSize: '0.8rem',
                          fontWeight: isActive ? 700 : 500
                        }}
                      >
                        {renderStyleContent()}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* 💡 設定閱讀時間 (10~60 分鐘 6 個時段，圓潤膠囊直排時鐘繪圖) */}
          <div className="settings-section">
            <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>設定閱讀時間 <span style={{ fontSize: '0.8rem', opacity: 0.75, fontWeight: 'normal' }}>(護眼模式)</span></span>
              {timerState.duration && timerState.remainingSeconds > 0 && (
                <span style={{ fontSize: '0.76rem', color: 'var(--theme-accent, #8c4b27)', fontWeight: 'bold' }}>
                  ⏱ 倒數中: {formatTimerMMSS(timerState.remainingSeconds)}
                </span>
              )}
            </div>
            <div className="segmented-pill-capsule" style={{ padding: '3px' }}>
              {([10, 20, 30, 40, 50, 60] as const).map((mins) => {
                const isActive = timerState.duration === mins && timerState.remainingSeconds > 0;
                
                // 依據 10/20/30/40/50/60 繪製專屬扇形與時針
                const renderClockSvg = () => {
                  switch (mins) {
                    case 10:
                      return (
                        <svg viewBox="0 0 36 36" style={{ width: '20px', height: '20px', color: 'currentColor' }}>
                          <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
                          <path d="M 18 18 L 18 5 A 13 13 0 0 1 29.26 11.5 Z" fill="currentColor" opacity="0.35" />
                          <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <line x1="18" y1="18" x2="25.8" y2="13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      );
                    case 20:
                      return (
                        <svg viewBox="0 0 36 36" style={{ width: '20px', height: '20px', color: 'currentColor' }}>
                          <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
                          <path d="M 18 18 L 18 5 A 13 13 0 0 1 29.26 24.5 Z" fill="currentColor" opacity="0.35" />
                          <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <line x1="18" y1="18" x2="25.8" y2="22.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      );
                    case 30:
                      return (
                        <svg viewBox="0 0 36 36" style={{ width: '20px', height: '20px', color: 'currentColor' }}>
                          <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
                          <path d="M 18 18 L 18 5 A 13 13 0 0 1 18 31 Z" fill="currentColor" opacity="0.35" />
                          <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <line x1="18" y1="18" x2="18" y2="27" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      );
                    case 40:
                      return (
                        <svg viewBox="0 0 36 36" style={{ width: '20px', height: '20px', color: 'currentColor' }}>
                          <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
                          <path d="M 18 18 L 18 5 A 13 13 0 1 1 6.74 24.5 Z" fill="currentColor" opacity="0.35" />
                          <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <line x1="18" y1="18" x2="10.2" y2="22.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      );
                    case 50:
                      return (
                        <svg viewBox="0 0 36 36" style={{ width: '20px', height: '20px', color: 'currentColor' }}>
                          <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
                          <path d="M 18 18 L 18 5 A 13 13 0 1 1 6.74 11.5 Z" fill="currentColor" opacity="0.35" />
                          <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <line x1="18" y1="18" x2="10.2" y2="13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      );
                    case 60:
                      return (
                        <svg viewBox="0 0 36 36" style={{ width: '20px', height: '20px', color: 'currentColor' }}>
                          <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
                          <circle cx="18" cy="18" r="13" fill="currentColor" opacity="0.35" />
                          <line x1="18" y1="18" x2="18" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      );
                  }
                };

                return (
                  <button
                    key={`timer-${mins}`}
                    type="button"
                    className={`segmented-pill-btn ${isActive ? 'active' : ''}`}
                    onClick={() => readingTimer.setTimer(mins)}
                    title={isActive ? `取消 ${mins} 分鐘閱讀計時` : `設定 ${mins} 分鐘閱讀計時`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      padding: '0.45rem 0.15rem'
                    }}
                  >
                    {renderClockSvg()}
                    <span style={{ fontSize: '0.72rem', fontWeight: isActive ? 700 : 500 }}>
                      {mins}分
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. 其他設定 */}
          <div className="settings-section">
            <div className="settings-section-title">其他設定</div>
            <div className="settings-toggle-group">
              {/* 1. 閱讀頁上下控制列 */}
              <div 
                className="settings-toggle-row"
                onClick={() => handleCheckboxChange('showReaderControls')}
              >
                <div className="settings-toggle-info">
                  <div className="settings-toggle-title">閱讀頁上下控制列</div>
                  <div className="settings-toggle-desc">開啟時顯示頂部與底部工具列，關閉時隱藏以提供全螢幕閱讀體驗</div>
                </div>
                <label className="settings-switch" onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={settings.customVisibleElements?.showReaderControls ?? true} 
                    onChange={() => handleCheckboxChange('showReaderControls')}
                  />
                  <span className="settings-switch-slider" />
                </label>
              </div>

              {/* 2. 自動接續閱讀 */}
              <div 
                className="settings-toggle-row"
                onClick={() => handleCheckboxChange('autoResumeProgress')}
              >
                <div className="settings-toggle-info">
                  <div className="settings-toggle-title">自動接續閱讀</div>
                  <div className="settings-toggle-desc">開啟經文時自動回到上次閱讀段落，關閉時一律從頭開始閱讀</div>
                </div>
                <label className="settings-switch" onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={settings.customVisibleElements?.autoResumeProgress ?? true} 
                    onChange={() => handleCheckboxChange('autoResumeProgress')}
                  />
                  <span className="settings-switch-slider" />
                </label>
              </div>

              {/* 3. 顯示筆記內容 */}
              <div 
                className="settings-toggle-row"
                onClick={() => handleCheckboxChange('showNoteInText')}
              >
                <div className="settings-toggle-info">
                  <div className="settings-toggle-title">顯示筆記內容</div>
                  <div className="settings-toggle-desc">於經文段落下直接顯示您隨文記錄的感悟筆記與心得</div>
                </div>
                <label className="settings-switch" onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={settings.customVisibleElements?.showNoteInText ?? false} 
                    onChange={() => handleCheckboxChange('showNoteInText')}
                  />
                  <span className="settings-switch-slider" />
                </label>
              </div>

              {/* 4. 每日閱讀日誌 */}
              <div 
                className="settings-toggle-row"
                onClick={() => {
                  const updated = {
                    ...settings,
                    readingLogEnabled: !(settings.readingLogEnabled ?? false)
                  };
                  onSave(updated);
                }}
              >
                <div className="settings-toggle-info">
                  <div className="settings-toggle-title">每日閱讀日誌</div>
                  <div className="settings-toggle-desc">自動記錄每日閱讀時長與天數，並於首頁提供行事曆日誌入口</div>
                </div>
                <label className="settings-switch" onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={settings.readingLogEnabled ?? false} 
                    onChange={() => {
                      const updated = {
                        ...settings,
                        readingLogEnabled: !(settings.readingLogEnabled ?? false)
                      };
                      onSave(updated);
                    }}
                  />
                  <span className="settings-switch-slider" />
                </label>
              </div>

              {/* 5. 顯示閱讀頁經文經題 */}
              <div 
                className="settings-toggle-row"
                onClick={() => handleCheckboxChange('showFloatingTitle')}
              >
                <div className="settings-toggle-info">
                  <div className="settings-toggle-title">顯示閱讀頁經文經題</div>
                  <div className="settings-toggle-desc">下滑閱讀時於頂部顯示當前經名膠囊，滑回頂部時自動隱藏</div>
                </div>
                <label className="settings-switch" onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={settings.customVisibleElements?.showFloatingTitle ?? false} 
                    onChange={() => handleCheckboxChange('showFloatingTitle')}
                  />
                  <span className="settings-switch-slider" />
                </label>
              </div>
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

          {/* 7. 進階功能 (可點選 + / - 平滑展開與收合，預設收合) */}
          <div className="settings-section advanced-settings-section">
            <div 
              className="settings-section-title"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
                paddingRight: '0.2rem'
              }}
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            >
              <span>進階功能</span>
              <button
                type="button"
                className="advanced-toggle-btn"
              >
                {isAdvancedOpen ? '− 收合' : '+ 展開'}
              </button>
            </div>

            {isAdvancedOpen && (
              <div className="advanced-cards-container animate-fade-in">
                {/* 第零組：首頁版面自訂 */}
                <div className="advanced-group-card">
                  <div className="advanced-group-header">
                    <div className="advanced-group-title">首頁版面自訂 (4 格 Widget 系統)</div>
                  </div>

                  <div className="advanced-action-list">
                    {/* 項目: 開啟自訂首頁 */}
                    <div 
                      className="advanced-action-item"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const nextEnabled = !settings.customHomeLayoutEnabled;
                        onSave({
                          ...settings,
                          customHomeLayoutEnabled: nextEnabled,
                          homeLayoutPreset: nextEnabled ? (settings.homeLayoutPreset || 'default') : 'default',
                          homeWidgets: nextEnabled ? (settings.homeWidgets || PRESET_LAYOUTS.default) : undefined
                        });
                      }}
                    >
                      <div className="advanced-action-info">
                        <div className="advanced-action-title">自訂首頁版面</div>
                        <div className="advanced-action-desc">支援 4 格卡片自由拖曳排序、切換尺寸 (4x1 / 2x2 / 4x2 / 4x4) 與捷徑配置</div>
                      </div>
                      <label className="settings-switch" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!settings.customHomeLayoutEnabled}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            onSave({
                              ...settings,
                              customHomeLayoutEnabled: enabled,
                              homeLayoutPreset: enabled ? (settings.homeLayoutPreset || 'default') : 'default',
                              homeWidgets: enabled ? (settings.homeWidgets || PRESET_LAYOUTS.default) : undefined
                            });
                          }}
                        />
                        <span className="settings-switch-slider" />
                      </label>
                    </div>

                    {settings.customHomeLayoutEnabled && (
                      <div className="advanced-action-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.6rem' }}>
                        <div className="advanced-action-info">
                          <div className="advanced-action-title">快速套用風格範本</div>
                          <div className="advanced-action-desc">一鍵更換精心調配之首頁版面配置</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                          {(['default', 'compact', 'focus', 'zen'] as const).map(presetKey => {
                            const names = { default: '經典原味', compact: '極簡精巧 (4x1)', focus: '每日精進', zen: '禪修護眼' };
                            const isSelected = (settings.homeLayoutPreset || 'default') === presetKey;
                            return (
                              <button
                                key={presetKey}
                                type="button"
                                className={`advanced-action-pill-btn ${isSelected ? 'active' : ''}`}
                                style={{
                                  background: isSelected ? 'var(--theme-accent, #8c4b27)' : 'transparent',
                                  color: isSelected ? '#ffffff' : 'inherit',
                                  borderColor: isSelected ? 'var(--theme-accent, #8c4b27)' : 'var(--border-color)'
                                }}
                                onClick={() => {
                                  onSave({
                                    ...settings,
                                    customHomeLayoutEnabled: true,
                                    homeLayoutPreset: presetKey,
                                    homeWidgets: PRESET_LAYOUTS[presetKey]
                                  });
                                }}
                              >
                                {names[presetKey]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 第一組：書籍與儲存空間 */}
                <div className="advanced-group-card">
                  <div className="advanced-group-header">
                    <div className="advanced-group-title">書籍與儲存空間</div>
                    <div className="advanced-group-badge">
                      已下載 {storageStats ? storageStats.bookCount : 0} 本書 · 容量 {storageStats ? storageStats.formattedUsed : '0 MB'}
                    </div>
                  </div>

                  <div className="advanced-action-list">
                    {/* 項目 1: 一鍵壓縮 */}
                    <div className="advanced-action-item">
                      <div className="advanced-action-info">
                        <div className="advanced-action-title">一鍵壓縮</div>
                        <div className="advanced-action-desc">採用 Gzip 壓縮本地離線經文，大幅釋放裝置儲存空間</div>
                      </div>
                      <button
                        type="button"
                        className="advanced-action-pill-btn"
                        disabled={isCompressing}
                        onClick={handleCompressAll}
                      >
                        {isCompressing ? '壓縮中...' : '壓縮 >'}
                      </button>
                    </div>

                    {/* 項目 2: 清理快取 */}
                    <div className="advanced-action-item">
                      <div className="advanced-action-info">
                        <div className="advanced-action-title">清理快取</div>
                        <div className="advanced-action-desc">清理 ServiceWorker 與 HTTP 網路快取，釋放暫存空間</div>
                      </div>
                      <button
                        type="button"
                        className="advanced-action-pill-btn"
                        onClick={handleClearCache}
                      >
                        {'清理 >'}
                      </button>
                    </div>

                    {/* 項目 3: 清空經典 */}
                    <div className="advanced-action-item">
                      <div className="advanced-action-info">
                        <div className="advanced-action-title" style={{ color: '#dc2626' }}>清空經典</div>
                        <div className="advanced-action-desc">清空所有已下載經文並將閱讀設定恢復為初始預設值</div>
                      </div>
                      <button
                        type="button"
                        className="advanced-action-pill-btn danger"
                        onClick={handleClearAllBooks}
                      >
                        {'清空 >'}
                      </button>
                    </div>
                  </div>

                  {storageMsg && (
                    <div className="advanced-status-msg">
                      <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                      <span>{storageMsg}</span>
                    </div>
                  )}
                </div>

                {/* 第二組：資料備份與還原 */}
                <div className="advanced-group-card">
                  <div className="advanced-group-header">
                    <div className="advanced-group-title">資料備份與還原</div>
                  </div>

                  <div className="advanced-action-list">
                    {/* 項目 1: 完整備份 */}
                    <div className="advanced-action-item">
                      <div className="advanced-action-info">
                        <div className="advanced-action-title">完整備份</div>
                        <div className="advanced-action-desc">匯出包含全經文快取、讀者劃線筆記與設定之 .json 檔案</div>
                      </div>
                      <button
                        type="button"
                        className="advanced-action-pill-btn"
                        disabled={isExporting}
                        onClick={handleTriggerFullBackup}
                      >
                        {isExporting ? '備份中...' : '備份 >'}
                      </button>
                    </div>

                    {/* 項目 2: 輕量備份 */}
                    <div className="advanced-action-item">
                      <div className="advanced-action-info">
                        <div className="advanced-action-title">輕量備份</div>
                        <div className="advanced-action-desc">僅備份讀者劃線重點、閱讀日誌與個人設定（不含經文本文）</div>
                      </div>
                      <button
                        type="button"
                        className="advanced-action-pill-btn"
                        disabled={isExporting}
                        onClick={() => !isExporting && handleExport(false)}
                      >
                        {isExporting ? '備份中...' : '備份 >'}
                      </button>
                    </div>

                    {/* 項目 3: 還原備份 */}
                    <div className="advanced-action-item">
                      <div className="advanced-action-info">
                        <div className="advanced-action-title">還原備份</div>
                        <div className="advanced-action-desc">匯入先前備份之 .json 檔案以恢復經文、筆記與設定</div>
                      </div>
                      <label 
                        className="advanced-action-pill-btn" 
                        style={{ cursor: isImporting ? 'default' : 'pointer' }}
                      >
                        {isImporting ? '還原中...' : '匯入 >'}
                        <input
                          type="file"
                          accept=".json"
                          style={{ display: 'none' }}
                          onChange={handleImportFile}
                          disabled={isImporting}
                        />
                      </label>
                    </div>
                  </div>

                  {backupMsg && (
                    <div className="advanced-status-msg">
                      <CheckCircle2 size={14} style={{ color: '#2563eb', flexShrink: 0 }} />
                      <span>{backupMsg}</span>
                    </div>
                  )}
                </div>
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

                  <span style={{ color: 'var(--text-muted, #666)', textAlign: 'right' }}>預估備份時間：</span>
                  <strong style={{ color: '#2563eb', textAlign: 'left' }}>{getEstimatedBackupTime(storageStats?.usedBytes)}</strong>
                </div>
                <p style={{ margin: '0.75rem 0 0 0', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-main, #333)', fontWeight: 600 }}>
                  備份共 {storageStats ? storageStats.bookCount : 0} 本經書，共 {storageStats ? storageStats.formattedUsed : '0 MB'}，時間約 {getEstimatedMinutes(storageStats?.usedBytes)} 分鐘，請問是否繼續？
                </p>
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

                    {/* 最新 App 版本 (v4.4.9) 直接顯示 */}
                    <div className="changelog-version-section">
                      <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span>⭐ App: v4.4.9</span>
                        <span className="changelog-date">(2026-09-22)</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• 首頁四合一導航 4×2 取消 4 個按鍵外圍細邊框。</li>
                        <li>• 「下載經典」按鍵下方新增「從cbeta下載」標籤。</li>
                        <li>• 「全文檢索」按鍵下方新增「關鍵字搜尋」標籤。</li>
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
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.4.8</span>
                            <span className="changelog-date">(2026-09-22)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 書櫃 4 大分類與過濾膠囊升級吸頂浮動，下滑時常駐頂部控制列下方。</li>
                            <li>• 書櫃依冊別排序先英文字母前綴（TX... 先於 Y...）再依序號由小到大排。</li>
                            <li>• 書櫃依作譯者排序修正為按經典編號由小到大順序排列（01、02、03...）。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.4.7</span>
                            <span className="changelog-date">(2026-09-22)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 深色模式下每本書外框升級細白邊框，視覺邊界更分明清晰。</li>
                            <li>• 書櫃「依冊別」修正太虛大師全書（TX）歸類，精準納入近代新編文獻。</li>
                            <li>• 書櫃 4 膠囊升級單行精緻小膠囊，點選反灰深底白字。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.4.6</span>
                            <span className="changelog-date">(2026-09-21)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 書櫃「依部類」全面套用 01~23 權威部類編號並嚴格順序排列。</li>
                            <li>• 書櫃「依冊別」依 CBETA 官方 6 大藏經分類，精準歸納經本。</li>
                            <li>• 書櫃 4 膠囊升級上下雙行 1:1:1:1 等寬，書籍右側選項改為精緻淺灰。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.4.5</span>
                            <span className="changelog-date">(2026-09-20)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 「加入小工具」左右切換「&lt;」「&gt;」按鈕與邊界留白優化，徹底消除手機貼邊擠壓。</li>
                            <li>• 4×2 卡片「4」長度完全舒展拉長（長寬比 2.28:1），1:1 等比呈現首頁修長長條感，經文字句與「→」按鈕間距充沛。</li>
                            <li>• 四色主題 2×2 優化圓圈與字級排版，「象牙白、羊皮紙、舒服綠、烏木」4 個文字標籤 100% 完整露出。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.4.4</span>
                            <span className="changelog-date">(2026-09-20)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 「加入小工具」視窗框加高（255px）且尺寸恆定，卡片統一比例縮放，徹底杜絕長條Bar大小不一。</li>
                            <li>• 外置標題「上次閱讀/我的最愛/近期閱讀」字體、顏色、大小在 4×1/4×2/4×3/4×4 完全統一。</li>
                            <li>• 四大分類更名為「主題圖卡、快捷功能、我的書櫃、其他功能」，取消分層，全由「&lt;」「&gt;」巡覽。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">
                            <span>App: v4.4.3</span>
                            <span className="changelog-date">(2026-09-19)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 經書 4×2 與 4×1 小工具標題移至卡片外上方，卡片內維持 1/2 本書，高度齊平且下緣不切邊。</li>
                            <li>• 四合一導航 4×2 規格之 4 個按鍵間距加寬，標籤字體升級為清晰現代黑體(粗)。</li>
                            <li>• 首頁卡片支援長按 2 秒自動直覺進入「自訂首頁排版」編輯模式（相容觸控與滑鼠）。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.4.2 <span className="changelog-date">(2026-09-19)</span></div>
                          <ul className="changelog-list">
                            <li>• 上次閱讀、我的最愛、近期下載 4×2 規格改為 2 本書，形成 1/2/3/4 本完整規律。</li>
                            <li>• 四大顏色主題卡片底色依象牙白、羊皮紙、舒服綠進行鄰近色細緻微調。</li>
                            <li>• 四合一導航 4×2 升級為精緻資訊磁貼，新增書櫃本數與筆記則數即時徽章。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.4.1 <span className="changelog-date">(2026-09-19)</span></div>
                          <ul className="changelog-list">
                            <li>• 預設加入小工具改為置於最上方，新增後平滑滾動至頂部。</li>
                            <li>• 上次閱讀、我的最愛、近期下載新增 4×3 規格（顯示 3 部經典），4×4 顯示 4 部經典。</li>
                            <li>• 首頁圓型「→」統一像素級置右對齊與淺色底色；書櫃專區頂部返回鍵升級為圓型「&lt;」並與卡片左側對齊。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.4.0 <span className="changelog-date">(2026-09-19)</span></div>
                          <ul className="changelog-list">
                            <li>• 導入 iOS 原生小工具庫 (Widget Gallery)：支援大類別瀏覽、關鍵字搜尋與風格範本快捷套用。</li>
                            <li>• 支援小工具各規格真實外觀即時預覽（4×1/4×2/2×2/4×4），隨選即看、一鍵直覺加入。</li>
                            <li>• 編輯模式升級：頂部「加入小工具」與「完成」控制列，卡片左上角配置「➖」刪除小工具按鈕。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.3.9 <span className="changelog-date">(2026-09-18)</span></div>
                          <ul className="changelog-list">
                            <li>• 「+ 下載經典」與「我的書櫃」、「重點筆記」、「全文搜尋」、「閱讀日誌」、「家」統合共用 Header Bar。</li>
                            <li>• 徹底消除切換時的 1 幀白屏與螢幕閃爍，實現全畫面 0 閃動流暢切換。</li>
                            <li>• 「+ 下載經典」膠囊獲得 100% 絲滑平滑彈跳展開與收合 transition 動態效果。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.3.8 <span className="changelog-date">(2026-09-18)</span></div>
                          <ul className="changelog-list">
                            <li>• 護眼計時器僅外圍虛線圈旋轉，倒數數字保持端正不轉；選定時間改以淺灰底呈現。</li>
                            <li>• 四合一導航新增 4x2 寬敞大版面，排版舒適大方不擁擠。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.3.6 <span className="changelog-date">(2026-09-18)</span></div>
                          <ul className="changelog-list">
                            <li>• 頂部控制列左右翼微膠囊合體為正中央單一微膠囊，視覺統合平穩不跳動。</li>
                            <li>• 品牌標題文字與小標垂直上移；淺色模式加強 Reader 高對比度；2x2 閱讀底色小圓點改為最下方置中。</li>
                            <li>• 4x4 卡片支援顯示 4 部經書並可點擊跳轉對應書櫃專區；護眼倒數圓環改為點點虛線優雅淺灰色旋轉。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.3.5 <span className="changelog-date">(2026-09-17)</span></div>
                          <ul className="changelog-list">
                            <li>• 統一首頁所有 2x2 小工具高度（148px）與規格比例，排版齊整無高低落差。</li>
                            <li>• 上次閱讀支援 4x1（書本樣式圖標）、4x2 與 4x4，新增「我的最愛」與「近期下載」小工具。</li>
                            <li>• 四色主題 2x2 改為上圓圈下文字排版；護眼計時器旋轉圓環改為淺灰色並於 4x2 增加「護眼模式設定」標籤。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.3.4 <span className="changelog-date">(2026-09-17)</span></div>
                          <ul className="changelog-list">
                            <li>• 首頁導入 iOS 4 格 Widget 自訂版面系統，支援 4x1、2x2、4x2、1x1 多種規格卡片。</li>
                            <li>• 支援全功能滑鼠與觸控直接拖曳排序（Drag & Drop）及點選即時切換卡片尺寸。</li>
                            <li>• 進階功能新增自訂首頁開關與 4 組風格範本（經典原味、極簡精巧、每日精進、禪修護眼）。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.3.3 <span className="changelog-date">(2026-09-17)</span></div>
                          <ul className="changelog-list">
                            <li>• 頂部控制列統一首頁與藏經庫結構樣式，點擊「+ 下載」時家、膠囊與齒輪位置恆定零位移。</li>
                            <li>• 全文搜尋若已有「近期搜尋」標籤則自動隱藏下方多餘提示文字，版面更為簡潔純粹。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.3.2 <span className="changelog-date">(2026-09-17)</span></div>
                          <ul className="changelog-list">
                            <li>• 頂部控制列手機窄螢幕自適應排版，徹底解決加入閱讀日誌時右側齒輪跑出畫面問題。</li>
                            <li>• 「我的書櫃」將新建資料夾併入右側「…」按鈕，改為「我的書櫃分類管理」並支援新增分類。</li>
                            <li>• 「全文搜尋」新增近期 5 個搜尋關鍵字膠囊標籤，支援點擊立即檢索已下載書籍。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.3.1 <span className="changelog-date">(2026-09-17)</span></div>
                          <ul className="changelog-list">
                            <li>• 「每日閱讀日誌」改為原生分頁，延用頂部微膠囊控制列並支援跨視圖無縫切換。</li>
                            <li>• 控制列最右側「齒輪」配置圓型主題底圖，與首頁「家」按鈕左右完美平衡對稱。</li>
                            <li>• 藏經庫背景色對齊全站消除色差；書櫃與筆記移除頂層「&lt;」並恆常顯示「…」管理鈕。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.3.0 <span className="changelog-date">(2026-09-16)</span></div>
                          <ul className="changelog-list">
                            <li>• 頂部控制列升級「雙翼對稱展開微膠囊」，左翼整合下載與書櫃，右翼整合筆記與搜尋。</li>
                            <li>• 選中項目自動向外展開標籤文字，未選中項收合為精緻圓形圖示，手機窄螢幕零溢出。</li>
                            <li>• 支援全站跨視圖 0 秒即時切換，保持左側「家」與右側「齒輪」永恆黃金錨定。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.2.9 <span className="changelog-date">(2026-09-14)</span></div>
                          <ul className="changelog-list">
                            <li>• 新增「顯示閱讀頁經文經題」設定，下滑閱讀時頂部浮現經名膠囊，滑回頂部自動隱藏。</li>
                            <li>• 藏經庫與搜尋「閱讀按鈕」調整為等寬正圓「→」圖示，底色隨四大主題自適應。</li>
                            <li>• 護眼倒數膠囊位置自適應面板高度，支援手機端教育部標楷體按需載入。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.2.8 <span className="changelog-date">(2026-09-14)</span></div>
                          <ul className="changelog-list">
                            <li>• 閱讀設定新增「進階功能」收折面板，空間管理與備份還原分組呈現。</li>
                            <li>• 首頁風格動作膠囊按鈕（壓縮、清理、清空、備份、匯入），移除冗餘圖示。</li>
                            <li>• 完整備份新增耗時預估提示，超過 3 分鐘跳窗確認，極速模式直接匯出。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title">App: v4.2.7 <span className="changelog-date">(2026-09-13)</span></div>
                          <ul className="changelog-list">
                            <li>• 閱讀設定升級「閱讀版面預覽」工作台，即時連動主題/字體/字級/行高/邊距。</li>
                            <li>• 其他設定全面改版為 iOS 風格直覺開關（Toggle Switches）與雙層說明。</li>
                            <li>• 新增每日閱讀日誌（閱讀天數、閱讀時數、閱讀本數與每日精進日曆）。</li>
                          </ul>
                        </div>
<div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.2.6 <span className="changelog-date">(2026-08-25)</span></div>
                      <ul className="changelog-list">
                        <li>• 首頁調整為四大核心入口：「下載經典」、「我的書櫃」、「重點與筆記」與「關鍵字搜尋」。</li>
                        <li>• 「我的書櫃」自訂資料夾標題保持極簡純淨，頂部配置高對比清晰資料夾管理按鈕。</li>
                        <li>• 資料夾管理支援原地即時重新命名，過渡專區內經典選項自動防呆保護。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.2.5 <span className="changelog-date">(2026-08-25)</span></div>
                      <ul className="changelog-list">
                        <li>• 全面加入防下拉重整保護（overscroll-behavior），防止手機滑動時閃爍跳回首頁。</li>
                        <li>• 支援 URL Hash 路由與瀏覽器歷史紀錄，手機邊緣側滑返回與背景喚醒精準復原。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.2.4 <span className="changelog-date">(2026-08-23)</span></div>
                      <ul className="changelog-list">
                        <li>• 閱讀頁上方「三」選單左右寬度再縮小窄化，減少版面佔用。</li>
                        <li>• 目次或卷次為空時，取消佔位提示文字並僅保留單行空白。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.2.3 <span className="changelog-date">(2026-08-23)</span></div>
                      <ul className="changelog-list">
                        <li>• 修正手機版經文下載進度卡片 6 個方塊網格在窄螢幕寬度下超出邊界的問題，加入自適應防溢出縮放。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v4.2.2 <span className="changelog-date">(2026-08-22)</span></div>
                      <ul className="changelog-list">
                        <li>• 閱讀頁上方控制列「三」選單，全書目固定提供「目次」與「卷/篇章」雙分頁。</li>
                        <li>• 首頁書架全站手勢左右滑動升級為整頁飛出式平滑切換，並加入方向鎖定防垂直位移。</li>
                      </ul>
                    </div>
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

                {/* 最新 Builder 版本 (v2.9.12) 直接顯示 */}
                <div className="changelog-version-section">
                  <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⭐ Builder: v2.9.12</span>
                    <span className="changelog-date">(2026-09-22)</span>
                  </div>
                  <ul className="changelog-list">
                    <li>• 支援 CBETA 雙字母前綴代碼（TX、GA、GB、LC 等），精確識別藏經冊別。</li>
                    <li>• 修正經典建構 Metadata 時雙字母代碼被截斷為單字母之問題。</li>
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
                      <div className="changelog-version-title">Builder: v2.9.11 <span className="changelog-date">(2026-08-23)</span></div>
                      <ul className="changelog-list">
                        <li>• 支援非連續卷數與特殊分卷經典下載（如 U1418），智慧對齊 CBETA 官方真實卷次清單。</li>
                        <li>• 升級防限流下載與自動重試機制，提高多卷經典下載穩定性。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">Builder: v2.9.10 <span className="changelog-date">(2026-08-21)</span></div>
                      <ul className="changelog-list">
                        <li>• 重構目錄導航精準度，優先匹配經文內真實標題段落與近鄰 lb 探測，精確錨定品名起點。</li>
                      </ul>
                    </div>
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
