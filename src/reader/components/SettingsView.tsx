import { useState, useEffect, useRef } from 'react';
import { X, Database, FileText, HelpCircle, RotateCw, CheckCircle2, Check, Plus, Minus, SlidersHorizontal, PanelTop, FileEdit, History, Calendar, LayoutGrid, Sparkles, Edit2 } from 'lucide-react';
import type { AppSettings, StorageStats } from '../../utils/db';
import { getStorageStats, clearHttpCacheStorage, compressAllBooks, clearAllBooks, saveSettings, DEFAULT_SETTINGS } from '../../utils/db';
import { BUILDER_VERSION, APP_VERSION } from '../../builder/version';
import { exportUserData, importUserData } from '../../utils/backup';
import { readingTimer, formatTimerMMSS } from '../../utils/readingTimer';
import { loadEduKaiFontOnDemand } from '../../utils/fontLoader';
import type { ReadingTimerState } from '../../utils/readingTimer';
import { isBackupMode } from '../../utils/sourceMode';
import { PRESET_LAYOUTS } from '../../types/homeLayout';
import { SACRED_THEME_PALETTE, isDarkColor } from '../../utils/themeManager';
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
  const [showCustomThemeDrawer, setShowCustomThemeDrawer] = useState(false);
  
  // 💡 自訂閱讀時間狀態（以 5 分鐘為單位，預設 60 分鐘，記憶於 localStorage）
  const [customTimerMinutes, setCustomTimerMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cbeta_custom_timer_mins');
      const parsed = saved ? parseInt(saved, 10) : 60;
      return !isNaN(parsed) && parsed > 0 ? parsed : 60;
    } catch {
      return 60;
    }
  });
  const [showCustomTimerDrawer, setShowCustomTimerDrawer] = useState(false);
  
  // 💡 自訂版型名稱編輯狀態（僅按「筆」編輯時才展開畫面）
  const [editingPresetSlot, setEditingPresetSlot] = useState<'custom1' | 'custom2' | 'custom3' | null>(null);
  const [editingPresetName, setEditingPresetName] = useState<string>('');

  // 💡 自訂主題名稱：若選取 6 大佛光色之一則自動帶入名稱，否則顯示「自訂色」
  const matchedSacred = SACRED_THEME_PALETTE.find(
    c => c.hex.toLowerCase() === (settings.customThemeColor || '#ebdcd9').toLowerCase()
  );
  const customColorLabel = matchedSacred ? matchedSacred.name : '自訂色';

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

  // 💡 當讀者上下滑動/捲動設定面板時，自動收合主題顏色與自訂時間抽屜（回復簡潔頁面）
  const lastScrollTopRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    const diff = Math.abs(currentScrollTop - lastScrollTopRef.current);
    if (diff > 8) {
      if (showCustomThemeDrawer) setShowCustomThemeDrawer(false);
      if (showCustomTimerDrawer) setShowCustomTimerDrawer(false);
      lastScrollTopRef.current = currentScrollTop;
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY;
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null || touchStartXRef.current === null) return;
    if (e.touches.length === 1) {
      const deltaY = Math.abs(e.touches[0].clientY - touchStartYRef.current);
      const deltaX = Math.abs(e.touches[0].clientX - touchStartXRef.current);
      // 確保是上下滑動（垂直位移 > 10px 且垂直位移大於水平位移，防止讀者水平滑動時間條時誤觸收合）
      if (deltaY > 10 && deltaY > deltaX * 1.15) {
        if (showCustomThemeDrawer) setShowCustomThemeDrawer(false);
        if (showCustomTimerDrawer) setShowCustomTimerDrawer(false);
      }
    }
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

        <div 
          className="settings-body custom-scrollbar"
          onScroll={handleBodyScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          {/* 💡 1. 獨立的主題顏色模式分區：一體化卡片 (上下對齊，預設收起下半部，按「+自訂」整卡打開) */}
          <div className="settings-theme-palette-section">
            <div className="settings-section-title" style={{ marginBottom: '0.45rem' }}>主題顏色</div>

            {/* 一體化卡片：上下完全垂直對齊 */}
            <div className="settings-theme-unified-card">
              {/* 上半部：6 欄常態列 (上圓圈、下字，上下精準對齊，自訂圓圈對齊青松黛) */}
              <div className="theme-swatches-grid-6col">
                {/* 1. 象牙白 */}
                <div
                  className={`theme-color-card ${settings.theme === 'ivory' ? 'selected' : ''}`}
                  onClick={() => onSave({ ...settings, theme: 'ivory' })}
                  title="象牙白"
                >
                  <div className="theme-color-swatch" style={{ backgroundColor: '#faf7f0' }}>
                    {settings.theme === 'ivory' && (
                      <Check size={13} strokeWidth={3.5} style={{ color: '#2c2016' }} />
                    )}
                  </div>
                  <div className="theme-color-name">象牙白</div>
                </div>

                {/* 2. 羊皮紙 */}
                <div
                  className={`theme-color-card ${settings.theme === 'parchment' ? 'selected' : ''}`}
                  onClick={() => onSave({ ...settings, theme: 'parchment' })}
                  title="羊皮紙"
                >
                  <div className="theme-color-swatch" style={{ backgroundColor: '#f1e5c9' }}>
                    {settings.theme === 'parchment' && (
                      <Check size={13} strokeWidth={3.5} style={{ color: '#2c2016' }} />
                    )}
                  </div>
                  <div className="theme-color-name">羊皮紙</div>
                </div>

                {/* 3. 舒服綠 */}
                <div
                  className={`theme-color-card ${settings.theme === 'comfort' ? 'selected' : ''}`}
                  onClick={() => onSave({ ...settings, theme: 'comfort' })}
                  title="舒服綠"
                >
                  <div className="theme-color-swatch" style={{ backgroundColor: '#e3ebd9' }}>
                    {settings.theme === 'comfort' && (
                      <Check size={13} strokeWidth={3.5} style={{ color: '#2c2016' }} />
                    )}
                  </div>
                  <div className="theme-color-name">舒服綠</div>
                </div>

                {/* 4. 烏木黑 */}
                <div
                  className={`theme-color-card ${settings.theme === 'ebony' ? 'selected' : ''}`}
                  onClick={() => onSave({ ...settings, theme: 'ebony' })}
                  title="烏木黑"
                >
                  <div className="theme-color-swatch" style={{ backgroundColor: '#12161a' }}>
                    {settings.theme === 'ebony' && (
                      <Check size={13} strokeWidth={3.5} style={{ color: '#fbbf24' }} />
                    )}
                  </div>
                  <div className="theme-color-name">烏木黑</div>
                </div>

                {/* 5. 分隔線「|」 (居中區隔經典色與自訂色) */}
                <div className="theme-divider-cell" title="區隔線">
                  <span className="theme-divider-text">|</span>
                </div>

                {/* 6. 自訂主題圓圈 (取代原先的「+自訂」按鈕，預設顯示「+」，選定後顯示「✓」，選中佛光色帶入名稱，自由微調帶入「自訂」) */}
                <div
                  className={`theme-color-card ${settings.theme === 'custom' ? 'selected' : ''}`}
                  onClick={() => {
                    onSave({ ...settings, theme: 'custom', customThemeColor: settings.customThemeColor || '#ebdcd9' });
                    setShowCustomThemeDrawer(prev => !prev);
                  }}
                  title={`自訂底色：${customColorLabel} (點擊切換並展開/收合色盤)`}
                >
                  <div
                    className="theme-color-swatch"
                    style={{ backgroundColor: settings.customThemeColor || '#ebdcd9' }}
                  >
                    {settings.theme === 'custom' ? (
                      <Check 
                        size={13} 
                        strokeWidth={3.5} 
                        style={{ color: isDarkColor(settings.customThemeColor || '#ebdcd9') ? '#ffffff' : '#2c2016' }} 
                      />
                    ) : (
                      <Plus 
                        size={13} 
                        strokeWidth={2.8} 
                        style={{ color: isDarkColor(settings.customThemeColor || '#ebdcd9') ? '#ffffff' : '#2c2016' }} 
                      />
                    )}
                  </div>
                  <div className="theme-color-name">{customColorLabel}</div>
                </div>
              </div>

              {/* 💡 下半部：展開的自訂佛光光譜抽屜 (預設收合，按「+自訂」整個打開來) */}
              {showCustomThemeDrawer && (
                <div className="theme-unified-drawer-section animate-fade-in">
                  {/* 細膩虛線分隔線 */}
                  <div className="theme-unified-divider" />

                  {/* 6 大尊貴修行佛光色票 (6 欄，與上半部 1:1 像素級垂直對齊) */}
                  <div className="sacred-palette-grid">
                    {SACRED_THEME_PALETTE.map(c => {
                      const isSelected = settings.theme === 'custom' && settings.customThemeColor === c.hex;
                      return (
                        <div
                          key={`sacred-${c.id}`}
                          className={`sacred-color-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => onSave({ ...settings, theme: 'custom', customThemeColor: c.hex })}
                          title={`${c.name} (${c.sub})`}
                        >
                          <div className="sacred-color-swatch" style={{ backgroundColor: c.hex }}>
                            {isSelected && <Check size={13} strokeWidth={3.5} color={isDarkColor(c.hex) ? '#ffffff' : '#261c14'} />}
                          </div>
                          <div className="sacred-color-name">{c.name}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 虛線分隔線 */}
                  <div className="theme-unified-subdivider" />

                  {/* 自由光譜微調：提供全光譜取色微調 */}
                  <div className="custom-color-picker-row">
                    <label className="custom-picker-label">
                      <span>自由光譜微調：</span>
                      <div className="custom-color-input-wrapper" style={{ backgroundColor: settings.customThemeColor || '#ebdcd9' }}>
                        <input
                          type="color"
                          className="custom-native-color-picker"
                          value={settings.customThemeColor || '#ebdcd9'}
                          onChange={(e) => onSave({ ...settings, theme: 'custom', customThemeColor: e.target.value })}
                          title="點擊展開全光譜取色盤"
                        />
                      </div>
                    </label>
                    <span className="custom-color-hex-tag">{settings.customThemeColor || '#ebdcd9'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* 💡 設定閱讀時間 (護眼模式) - 6 欄一體化卡片，與上方主題顏色卡片 1:1 像素級垂直對齊 */}
          <div className="settings-section">
            <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>設定閱讀時間 <span style={{ fontSize: '0.8rem', opacity: 0.75, fontWeight: 'normal' }}>(護眼模式)</span></span>
              {timerState.duration && timerState.remainingSeconds > 0 && (
                <span style={{ fontSize: '0.76rem', color: 'var(--theme-accent, #8c4b27)', fontWeight: 'bold' }}>
                  ⏱ 倒數中: {formatTimerMMSS(timerState.remainingSeconds)}
                </span>
              )}
            </div>

            {/* 💡 一體化卡片：外觀、高度與背景比照圖 1 主題顏色 */}
            <div className="settings-theme-unified-card">
              {/* 💡 上半部 6 欄 Grid (10分、20分、30分、40分、|、自訂時間) */}
              <div className="theme-swatches-grid-6col">
                {([10, 20, 30, 40] as const).map((mins) => {
                  const isActive = timerState.duration === mins && timerState.remainingSeconds > 0;
                  
                  // 依據 10/20/30/40 繪製專屬扇形與時針
                  const renderClockSvg = () => {
                    switch (mins) {
                      case 10:
                        return (
                          <svg viewBox="0 0 36 36" style={{ width: '18px', height: '18px', color: 'currentColor' }}>
                            <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
                            <path d="M 18 18 L 18 5 A 13 13 0 0 1 29.26 11.5 Z" fill="currentColor" opacity="0.35" />
                            <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="18" y1="18" x2="25.8" y2="13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                          </svg>
                        );
                      case 20:
                        return (
                          <svg viewBox="0 0 36 36" style={{ width: '18px', height: '18px', color: 'currentColor' }}>
                            <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
                            <path d="M 18 18 L 18 5 A 13 13 0 0 1 29.26 24.5 Z" fill="currentColor" opacity="0.35" />
                            <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="18" y1="18" x2="25.8" y2="22.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                          </svg>
                        );
                      case 30:
                        return (
                          <svg viewBox="0 0 36 36" style={{ width: '18px', height: '18px', color: 'currentColor' }}>
                            <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
                            <path d="M 18 18 L 18 5 A 13 13 0 0 1 18 31 Z" fill="currentColor" opacity="0.35" />
                            <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="18" y1="18" x2="18" y2="27" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                          </svg>
                        );
                      case 40:
                        return (
                          <svg viewBox="0 0 36 36" style={{ width: '18px', height: '18px', color: 'currentColor' }}>
                            <circle cx="18" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
                            <path d="M 18 18 L 18 5 A 13 13 0 1 1 6.74 24.5 Z" fill="currentColor" opacity="0.35" />
                            <line x1="18" y1="18" x2="18" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="18" y1="18" x2="10.2" y2="22.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <circle cx="18" cy="18" r="1.5" fill="currentColor" />
                          </svg>
                        );
                    }
                  };

                  return (
                    <div
                      key={`timer-${mins}`}
                      className={`theme-color-card ${isActive ? 'selected' : ''}`}
                      onClick={() => readingTimer.setTimer(mins)}
                      title={isActive ? `取消 ${mins} 分鐘閱讀計時` : `設定 ${mins} 分鐘閱讀計時`}
                    >
                      <div className="theme-color-swatch timer-clock-swatch">
                        {renderClockSvg()}
                      </div>
                      <div className="theme-color-name">
                        {mins}分
                      </div>
                    </div>
                  );
                })}

                {/* 5. 分隔線「|」 (居中區隔預設時間與自訂時間，對齊上方主題區隔線) */}
                <div className="theme-divider-cell" title="區隔線">
                  <span className="theme-divider-text">|</span>
                </div>

                {/* 6. 自訂時間圓圈 (預設顯示「+」，選定後顯示「✓」，點擊切換並展開/收合時間自訂抽屜) */}
                {(() => {
                  const isCustomActive = timerState.duration !== null && 
                    timerState.remainingSeconds > 0 && 
                    ![10, 20, 30, 40].includes(timerState.duration);
                  const displayMins = isCustomActive && timerState.duration 
                    ? timerState.duration 
                    : customTimerMinutes;

                  return (
                    <div
                      className={`theme-color-card ${isCustomActive ? 'selected' : ''}`}
                      onClick={() => {
                        if (!isCustomActive) {
                          readingTimer.setTimer(customTimerMinutes);
                          setShowCustomTimerDrawer(true);
                        } else {
                          setShowCustomTimerDrawer(prev => !prev);
                        }
                      }}
                      title={`自訂時間：${displayMins}分鐘 (點擊設定並展開/收合抽屜)`}
                    >
                      <div className="theme-color-swatch timer-clock-swatch">
                        {isCustomActive ? (
                          <Check size={13} strokeWidth={3.5} />
                        ) : (
                          <Plus size={13} strokeWidth={2.8} />
                        )}
                      </div>
                      <div className="theme-color-name">{displayMins}分</div>
                    </div>
                  );
                })()}
              </div>

              {/* 💡 下半部：展開的自訂時間抽屜 (以 5 分鐘為單位，支援上下按與手機滑動) */}
              {showCustomTimerDrawer && (
                <div className="theme-unified-drawer-section animate-fade-in">
                  {/* 細膩虛線分隔線 */}
                  <div className="theme-unified-divider" />

                  {/* 1. 上下按步進器 (Stepper Row，支援 5 分鐘步進) */}
                  <div className="custom-timer-stepper-row">
                    <button
                      type="button"
                      className="custom-timer-step-btn"
                      onClick={() => {
                        const newMins = Math.max(5, customTimerMinutes - 5);
                        setCustomTimerMinutes(newMins);
                        try { localStorage.setItem('cbeta_custom_timer_mins', String(newMins)); } catch {}
                        if (timerState.duration !== null && ![10, 20, 30, 40].includes(timerState.duration) && timerState.remainingSeconds > 0) {
                          readingTimer.extendTimer(newMins);
                        }
                      }}
                      disabled={customTimerMinutes <= 5}
                      title="減少 5 分鐘"
                    >
                      <Minus size={13} strokeWidth={2.8} />
                      <span>5分</span>
                    </button>

                    <div className="custom-timer-display-pill">
                      <span className="custom-timer-number">{customTimerMinutes}</span>
                      <span className="custom-timer-unit">分鐘</span>
                    </div>

                    <button
                      type="button"
                      className="custom-timer-step-btn"
                      onClick={() => {
                        const newMins = Math.min(180, customTimerMinutes + 5);
                        setCustomTimerMinutes(newMins);
                        try { localStorage.setItem('cbeta_custom_timer_mins', String(newMins)); } catch {}
                        if (timerState.duration !== null && ![10, 20, 30, 40].includes(timerState.duration) && timerState.remainingSeconds > 0) {
                          readingTimer.extendTimer(newMins);
                        }
                      }}
                      disabled={customTimerMinutes >= 180}
                      title="增加 5 分鐘"
                    >
                      <Plus size={13} strokeWidth={2.8} />
                      <span>5分</span>
                    </button>
                  </div>

                  {/* 2. 手機/觸控滑動條 (Range Slider Row，以 5 分鐘為單位) */}
                  <div className="custom-timer-slider-row">
                    <span className="custom-timer-slider-bound">5分</span>
                    <input
                      type="range"
                      min={5}
                      max={180}
                      step={5}
                      value={customTimerMinutes}
                      onChange={(e) => {
                        const newMins = parseInt(e.target.value, 10);
                        setCustomTimerMinutes(newMins);
                        try { localStorage.setItem('cbeta_custom_timer_mins', String(newMins)); } catch {}
                        if (timerState.duration !== null && ![10, 20, 30, 40].includes(timerState.duration) && timerState.remainingSeconds > 0) {
                          readingTimer.extendTimer(newMins);
                        }
                      }}
                      className="custom-timer-range-slider"
                      title={`滑動調整時間：${customTimerMinutes}分鐘`}
                    />
                    <span className="custom-timer-slider-bound">180分</span>
                  </div>

                  {/* 3. 快捷時長膠囊與結束按鈕 */}
                  <div className="custom-timer-quick-capsules">
                    {[15, 30, 45, 60, 75, 90, 120].map((quickMins) => {
                      const isQuickSelected = customTimerMinutes === quickMins;
                      return (
                        <button
                          key={`quick-${quickMins}`}
                          type="button"
                          className={`custom-timer-quick-chip ${isQuickSelected ? 'active' : ''}`}
                          onClick={() => {
                            setCustomTimerMinutes(quickMins);
                            try { localStorage.setItem('cbeta_custom_timer_mins', String(quickMins)); } catch {}
                            readingTimer.setTimer(quickMins);
                          }}
                        >
                          {quickMins}分
                        </button>
                      );
                    })}

                    {timerState.duration !== null && timerState.remainingSeconds > 0 && (
                      <button
                        type="button"
                        className="custom-timer-stop-chip"
                        onClick={() => readingTimer.setTimer(null)}
                        title="結束當前閱讀計時"
                      >
                        結束計時
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6. 其他設定 (方案 1：雙分組一體化卡片，採用簡潔線條符號與清晰標題小標) */}
          <div className="settings-section">
            <div className="settings-section-title">其他設定</div>

            <div className="settings-other-groups-container">
              {/* 分組一：閱讀介面與顯示 */}
              <div className="settings-theme-unified-card settings-grouped-card">
                <div className="settings-group-card-header">
                  <span>閱讀介面與顯示</span>
                </div>

                <div className="settings-grouped-list">
                  {/* 1. 上方控制工具列 */}
                  <div 
                    className="settings-grouped-item"
                    onClick={() => handleCheckboxChange('showReaderControls')}
                  >
                    <div className="settings-item-left">
                      <div className="settings-symbol-badge">
                        <SlidersHorizontal size={15} strokeWidth={2.2} />
                      </div>
                      <div className="settings-item-texts">
                        <div className="settings-item-title">上方控制工具列</div>
                        <div className="settings-item-subtitle">開啟顯示頂部控制列，關閉即全螢幕讀經</div>
                      </div>
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

                  {/* 2. 頂部浮動經題 */}
                  <div 
                    className="settings-grouped-item"
                    onClick={() => handleCheckboxChange('showFloatingTitle')}
                  >
                    <div className="settings-item-left">
                      <div className="settings-symbol-badge">
                        <PanelTop size={15} strokeWidth={2.2} />
                      </div>
                      <div className="settings-item-texts">
                        <div className="settings-item-title">頂部浮動經題</div>
                        <div className="settings-item-subtitle">下滑閱讀時於頂部浮動顯示經題膠囊</div>
                      </div>
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

                  {/* 3. 經文隨文筆記 */}
                  <div 
                    className="settings-grouped-item"
                    onClick={() => handleCheckboxChange('showNoteInText')}
                  >
                    <div className="settings-item-left">
                      <div className="settings-symbol-badge">
                        <FileEdit size={15} strokeWidth={2.2} />
                      </div>
                      <div className="settings-item-texts">
                        <div className="settings-item-title">經文隨文筆記</div>
                        <div className="settings-item-subtitle">經文段落下方直接顯示手寫感悟心得</div>
                      </div>
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
                </div>
              </div>

              {/* 分組二：進度與閱讀日誌 */}
              <div className="settings-theme-unified-card settings-grouped-card">
                <div className="settings-group-card-header">
                  <span>進度與閱讀日誌</span>
                </div>

                <div className="settings-grouped-list">
                  {/* 4. 自動接續進度 */}
                  <div 
                    className="settings-grouped-item"
                    onClick={() => handleCheckboxChange('autoResumeProgress')}
                  >
                    <div className="settings-item-left">
                      <div className="settings-symbol-badge">
                        <History size={15} strokeWidth={2.2} />
                      </div>
                      <div className="settings-item-texts">
                        <div className="settings-item-title">自動接續進度</div>
                        <div className="settings-item-subtitle">開啟經典自動精確跳轉至上次閱讀段落</div>
                      </div>
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

                  {/* 5. 每日閱讀日誌 */}
                  <div 
                    className="settings-grouped-item"
                    onClick={() => {
                      const updated = {
                        ...settings,
                        readingLogEnabled: !(settings.readingLogEnabled ?? false)
                      };
                      onSave(updated);
                    }}
                  >
                    <div className="settings-item-left">
                      <div className="settings-symbol-badge">
                        <Calendar size={15} strokeWidth={2.2} />
                      </div>
                      <div className="settings-item-texts">
                        <div className="settings-item-title">每日閱讀日誌</div>
                        <div className="settings-item-subtitle">記錄每日閱讀時間與修行天數足跡</div>
                      </div>
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
                </div>
              </div>

              {/* 分組三：首頁版面自訂 (4 格 Widget 系統) */}
              <div className="settings-theme-unified-card settings-grouped-card">
                <div className="settings-group-card-header">
                  <span>首頁版面自訂 (4 格 Widget 系統)</span>
                </div>

                <div className="settings-grouped-list">
                  {/* 1. 自訂首頁版面 */}
                  <div 
                    className="settings-grouped-item"
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
                    <div className="settings-item-left">
                      <div className="settings-symbol-badge">
                        <LayoutGrid size={15} strokeWidth={2.2} />
                      </div>
                      <div className="settings-item-texts">
                        <div className="settings-item-title">自訂首頁版面</div>
                        <div className="settings-item-subtitle">自由排序、調整卡片尺寸與快捷功能</div>
                      </div>
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

                  {/* 2. 快速套用風格範本 */}
                  {settings.customHomeLayoutEnabled && (
                    <div className="settings-grouped-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.65rem', cursor: 'default' }} onClick={e => e.stopPropagation()}>
                      <div className="settings-item-left" style={{ width: '100%', paddingRight: 0 }}>
                        <div className="settings-symbol-badge">
                          <Sparkles size={15} strokeWidth={2.2} />
                        </div>
                        <div className="settings-item-texts">
                          <div className="settings-item-title">快速套用風格範本</div>
                          <div className="settings-item-subtitle">一鍵快速更換首頁版面風格</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%', paddingLeft: '2.4rem' }}>
                        {(['default', 'calm', 'many_books', 'compact', 'focus', 'zen', 'custom1', 'custom2', 'custom3'] as const).map(presetKey => {
                          const isSelected = (settings.homeLayoutPreset || 'default') === presetKey ||
                            (presetKey === 'custom1' && settings.homeLayoutPreset === 'custom');
                          
                          // 讀取名稱
                          let displayName = '';
                          if (presetKey === 'default') displayName = '版型1 極簡';
                          else if (presetKey === 'calm') displayName = '版型2 淨心閱讀';
                          else if (presetKey === 'many_books') displayName = '版型3 很多書';
                          else if (presetKey === 'compact') displayName = '極簡精巧 (4x1)';
                          else if (presetKey === 'focus') displayName = '每日精進';
                          else if (presetKey === 'zen') displayName = '禪修護眼';
                          else if (presetKey === 'custom1') {
                            displayName = settings.customPresets?.custom1?.name || settings.customPresetName?.trim() || '自訂1';
                          } else if (presetKey === 'custom2') {
                            displayName = settings.customPresets?.custom2?.name || '自訂2';
                          } else if (presetKey === 'custom3') {
                            displayName = settings.customPresets?.custom3?.name || '自訂3';
                          }

                          const isCustomPreset = presetKey === 'custom1' || presetKey === 'custom2' || presetKey === 'custom3';

                          return (
                            <button
                              key={presetKey}
                              type="button"
                              className={`advanced-action-pill-btn ${isSelected ? 'active' : ''}`}
                              style={{
                                background: isSelected ? 'var(--theme-accent, #8c4b27)' : 'transparent',
                                color: isSelected ? '#ffffff' : 'inherit',
                                borderColor: isSelected ? 'var(--theme-accent, #8c4b27)' : 'var(--border-color)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onClick={() => {
                                let nextWidgets: any[];
                                if (isCustomPreset) {
                                  const savedCustom = settings.customPresets?.[presetKey];
                                  if (savedCustom?.widgets && savedCustom.widgets.length > 0) {
                                    nextWidgets = savedCustom.widgets;
                                  } else if (presetKey === 'custom1' && settings.homeWidgets && settings.homeWidgets.length > 0) {
                                    nextWidgets = settings.homeWidgets;
                                  } else {
                                    nextWidgets = PRESET_LAYOUTS.calm || PRESET_LAYOUTS.default;
                                  }
                                } else {
                                  nextWidgets = PRESET_LAYOUTS[presetKey] || PRESET_LAYOUTS.default;
                                }

                                onSave({
                                  ...settings,
                                  customHomeLayoutEnabled: true,
                                  homeLayoutPreset: presetKey,
                                  homeWidgets: nextWidgets
                                });
                              }}
                            >
                              <span>{displayName}</span>
                              {isCustomPreset && isSelected && (
                                <span
                                  style={{ display: 'inline-flex', alignItems: 'center', padding: '2px', cursor: 'pointer', borderRadius: '4px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (editingPresetSlot === presetKey) {
                                      setEditingPresetSlot(null);
                                    } else {
                                      setEditingPresetSlot(presetKey);
                                      setEditingPresetName(displayName);
                                    }
                                  }}
                                  title="點擊編輯自訂版型名稱"
                                >
                                  <Edit2 size={11} style={{ opacity: 0.9 }} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* 💡 按「筆」編輯時才出現自訂名稱編輯列 */}
                      {editingPresetSlot && (
                        <div className="animate-fade-in" style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          paddingLeft: '2.4rem',
                          marginTop: '2px',
                          fontSize: '0.82rem'
                        }}>
                          <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>自訂名稱：</span>
                          <input
                            type="text"
                            maxLength={12}
                            placeholder="自訂名稱 (例如：淨心早課)"
                            value={editingPresetName}
                            onChange={(e) => setEditingPresetName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const newName = editingPresetName.trim() || (editingPresetSlot === 'custom1' ? '自訂1' : editingPresetSlot === 'custom2' ? '自訂2' : '自訂3');
                                const existingCustom = settings.customPresets?.[editingPresetSlot];
                                onSave({
                                  ...settings,
                                  customPresetName: editingPresetSlot === 'custom1' ? newName : settings.customPresetName,
                                  customPresets: {
                                    ...(settings.customPresets || {}),
                                    [editingPresetSlot]: {
                                      name: newName,
                                      widgets: existingCustom?.widgets || settings.homeWidgets || PRESET_LAYOUTS.calm
                                    }
                                  }
                                });
                                setEditingPresetSlot(null);
                              }
                            }}
                            autoFocus
                            style={{
                              flex: 1,
                              maxWidth: '180px',
                              padding: '4px 8px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
                              background: 'var(--input-bg, rgba(255,255,255,0.7))',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem',
                              outline: 'none'
                            }}
                          />
                          <button
                            type="button"
                            className="advanced-action-pill-btn active"
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.75rem',
                              background: 'var(--theme-accent, #8c4b27)',
                              color: '#fff',
                              borderRadius: '6px'
                            }}
                            onClick={() => {
                              const newName = editingPresetName.trim() || (editingPresetSlot === 'custom1' ? '自訂1' : editingPresetSlot === 'custom2' ? '自訂2' : '自訂3');
                              const existingCustom = settings.customPresets?.[editingPresetSlot];
                              onSave({
                                ...settings,
                                customPresetName: editingPresetSlot === 'custom1' ? newName : settings.customPresetName,
                                customPresets: {
                                  ...(settings.customPresets || {}),
                                  [editingPresetSlot]: {
                                    name: newName,
                                    widgets: existingCustom?.widgets || settings.homeWidgets || PRESET_LAYOUTS.calm
                                  }
                                }
                              });
                              setEditingPresetSlot(null);
                            }}
                          >
                            儲存
                          </button>
                          <button
                            type="button"
                            className="advanced-action-pill-btn"
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.75rem',
                              borderRadius: '6px'
                            }}
                            onClick={() => setEditingPresetSlot(null)}
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
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

          {/* 💡 📖 Cbeta Reader 簡易功能導覽 (精緻膠囊型式，移至「進階功能」之下) */}
          {onReplayOnboarding && (
            <div className="settings-guide-pill-wrapper">
              <button
                type="button"
                className="settings-guide-pill-btn"
                onClick={onReplayOnboarding}
                title="開啟 Cbeta Reader 簡易功能導覽"
              >
                <span className="guide-pill-icon">📖</span>
                <span>Cbeta Reader 簡易功能導覽</span>
              </button>
            </div>
          )}

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

                    {/* 最新 App 版本 (v4.10.6) 直接顯示 */}
                    <div className="changelog-version-section">
                      <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span>⭐ App: v4.10.6</span>
                        <span className="changelog-date">(2026-10-06)</span>
                      </div>
                      <ul className="changelog-list">
                        <li>• 調整「版型3 很多書」：頂部日曆與近日閱讀，接續18本經書膠囊，底置佛典名句與品牌橫條。</li>
                        <li>• 調整「版型1 極簡」：頂部下載經典虛線條、系統三合一導航、近期下載與最愛雙經書及品牌橫條。</li>
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
                            <span>App: v4.10.5</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 新增範本「版型3 很多書」：一鍵套用圖1圖2全套配置，涵蓋下載、近期、上次、最愛、佛典與護眼。</li>
                            <li>• 整合三大主題18本經書膠囊：以 2×3 雙欄格局收納完整藏經熱門進度，排版充實大氣。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.10.4</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 我的最愛依最近點選排序：首頁與書櫃最愛書籍依點選時間倒序排列，最新點選排第一位。</li>
                            <li>• 書櫃「…」左側淺淺色愛心：經典右側新增淺色愛心，讀者可秒速自由點選加入或取消最愛。</li>
                            <li>• 全站最愛秒速即時連動：在書櫃點選愛心即時同步至首頁所有小卡，無需重新整理。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.10.3</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 書櫃膠囊升級左3本右3本：下排膠囊由4本升級為2×3雙欄雙排共6本書，容量更充裕。</li>
                            <li>• 微調書籍膠囊緊湊高度：高度適度緊縮至48~56px，3排條列垂直佈局勻稱不擁擠。</li>
                            <li>• 經號字體統一為古典襯線體：經號徽章文字統一為高識別serif字型，字跡端正厚實。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.10.2</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 4膠囊改為左2本右2本：下排4本書升級為2×2雙欄雙排網格排版，空間大氣勻稱。</li>
                            <li>• 經題升級圖2楷宋體：採用古典有筆鋒之明體/宋體，字體端莊典雅、古風韻味濃郁。</li>
                            <li>• 經號徽章加大至38px：加大居中排版，徹底消除經號文字切邊問題，字跡清晰醒目。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.10.1</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 新增 3 款 4×3 4膠囊書櫃小卡：我的最愛、近期下載、上次閱讀全新膠囊版型。</li>
                            <li>• 典雅無箭頭水平膠囊：上方長條Bar，下方4本經書膠囊帶卷數與朝代譯者。</li>
                            <li>• 4×3 版面緊湊飽滿：上方Bar加長加厚至56px，方塊加大至86px，留白剛剛好。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.10.0</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 書櫃小卡群組可拉伸：我的最愛、近期下載、上次閱讀全面整合為可自由拉伸群組。</li>
                            <li>• 4×1/4×2/4×3 秒速切換：點擊卡片切換按鈕，於長條Bar、4本書、8本書間無縫循環。</li>
                            <li>• 自由定制與雙排對稱：書本正方形按鍵與居中排版保持嚴整，滿足不同藏經容量需求。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.9.9</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 新增 4×1 獨立長條 Bar：全新「近期下載」、「上次閱讀」、「我的最愛」水平長條快捷卡。</li>
                            <li>• 新增 4×3 書櫃三合一長條卡：由上至下依序整合「近期下載」、「上次閱讀」、「我的最愛」三大主題。</li>
                            <li>• 大氣觸控與秒速直達：各長條 Bar 支援飽滿高度與高辨識度色彩圖標，點擊直達書櫃專區。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.9.8</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 新增 3 款 4×3 書櫃小卡：新增「我的最愛」、「近期下載」、「上次閱讀」8 本書規格，滿足大容量藏經需求。</li>
                            <li>• 上 1 橫條下 8 本書佈局：上方置中主題快捷條，下方 2 排共 8 個大氣經書方塊按鍵，點擊秒速直達。</li>
                            <li>• 齊平對稱與全正方形化：8本書方塊與經號徽章全面升級1:1正方形，經題鎖定2行空間高度齊平。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.9.7</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 統一經號方塊水平高度：徹底消除按鈕上上下下錯落，所有經號徽章 100% 齊平同一水平線。</li>
                            <li>• 單行經題鎖定雙行佔位：單行書名亦維持 2 行空間，第一行文字與上方方塊高度完全一致。</li>
                            <li>• 四鍵排版嚴整統一：微調頂部起始間距，各主題模式下經書方塊對稱大氣、賞心悅目。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.9.6</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 書本方塊書名升級雙行：刪除第二行經卷資訊，書名支援 2 行自然折行，容納更完整經題。</li>
                            <li>• 經名易讀性大幅提升：長經題不再過早省略截斷，字形飽滿且居中排版極具質感。</li>
                            <li>• 空槽位視覺居中優化：收藏/下載導引按鍵排版微調，垂直節奏更俐落大器。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.9.5</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 依圖2設計全新3款4×2小卡：我的最愛、近期下載、上次閱讀上方配置快捷主Bar，下方自動呈現最新4本書。</li>
                            <li>• 4本書大氣按鍵排版：比照圖2圓角方塊按鍵，經號色塊徽章搭配書名與卷數，點擊秒速直達經文讀誦。</li>
                            <li>• 暫時刪除圖1的4×3小卡：快捷功能卡片全面聚焦精簡 4×2 格局，小工具庫巡覽更乾淨流暢。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.9.4</span>
                            <span className="changelog-date">(2026-10-05)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 新增版型2淨心閱讀：整合開經偈、上次閱讀進度、回向偈與三皈依等全套莊嚴配置。</li>
                            <li>• 支援3組自訂風格版型：開放讀者自由設定 3 個版型與名稱，點擊「筆」才展開編輯。</li>
                            <li>• 完成編輯彈窗另存：編輯版面按「✓ 完成」彈出詢問，支援覆蓋當前或另存新版型。</li>
                          </ul>
                        </div>

                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.9.3</span>
                            <span className="changelog-date">(2026-10-04)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 10格固定配置：預設 10 按鍵配置，左上角固定，4×2 快捷卡固定 5 欄雙排。</li>
                            <li>• 刪除保留空格：按「×」刪除按鍵時其他按鍵不動，該位置呈現圖2增加按鍵圖示。</li>
                            <li>• 空格拖曳與填入：空格可由下方功能庫選取填入，其他按鍵亦可直接拖曳至空格。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.9.2</span>
                            <span className="changelog-date">(2026-10-04)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 快捷卡雙排自適應排版：自訂抽屜升級為動態雙排，8 鍵排上4下4、6 鍵排上3下3，上下一體工整直覺。</li>
                            <li>• 雙側增加按鍵便利入口：上排右邊與下排右邊皆配置「+增加按鍵」，直覺順手隨點隨加。</li>
                            <li>• 首頁卡片完美等比映射：首頁快捷卡與抽屜雙排佈局 100% 一致映射，徹底告別單排硬擠失衡問題。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.9.1</span>
                            <span className="changelog-date">(2026-10-04)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 主題自訂名稱優化：主題顏色之自訂色標籤全面改為「自訂色」，未選中與選定狀態更直觀清晰。</li>
                            <li>• 主題圖片滿版大氣呈現：主題小卡 (圖片) 升級為如 CBETA Reader 圖4般滿版填滿按鈕，飽滿無黑邊留白。</li>
                            <li>• 快捷卡左上角固定與雙擊自訂：快捷功能卡與下載書櫃卡左首鍵固定為圖4不可移刪，手機連點 2 下秒速進入自訂功能。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.9.0</span>
                            <span className="changelog-date">(2026-10-04)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 4×2 下載與書櫃卡預設重設：上排下載經典，下排預設主題(CBETA Reader)+近期下載+上次閱讀+我的最愛 4 鍵。</li>
                            <li>• 按鍵拖曳排序順移優化：調整順序改為自動順移插入（如 4 移至 1 自動順移為 4→1→2→3），告別單純兩兩對調。</li>
                            <li>• 功能庫下載經典防重複反灰：下載與書櫃卡內因上方已有置頂下載經典，功能庫內「下載經典」自動反灰且上限設為 5 鍵。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.8.9</span>
                            <span className="changelog-date">(2026-10-04)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 全文檢索替換為主題顏色：點一下依序換色（象牙白→羊皮紙→舒服綠→烏木黑→自訂），呈現當前色塊圓形與名稱。</li>
                            <li>• 倒數計時升級圓形計算環：直接呈現圖4圓形虛線點點環形與即時倒數時間（如 17:20），不加多餘文字。</li>
                            <li>• 4×2 快捷卡擴充支援最多 10 鍵：支援點擊「＋」增加按鍵（最多 10 個，上 5 個、下 5 個），並支援「×」刪除與拖曳調位。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.8.8</span>
                            <span className="changelog-date">(2026-10-03)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 近期下載規則檢修：精準依48小時內下載與最近下載10本書篩選，最新下載經文100%排在最前。</li>
                            <li>• 4×2 規格按鍵防切底：下排 4 鍵底部留白優化不切底，比例接近正方形；頂部 bar 佔約 1/3。</li>
                            <li>• 4×3 規格大氣升級：維持上 1 鍵下 3 鍵，頂部 bar 加高大氣，下排配置 3 個完美正方形按鈕。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.8.7</span>
                            <span className="changelog-date">(2026-10-03)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 新增 4*3 下載與書櫃卡：上排下載經典整體置中、下排近期下載/閱讀/最愛 3 快捷鍵。</li>
                            <li>• 下載經典精簡列整體置中：徽章「+」、文字「下載經典 · 從CBETA資料庫下載」與箭頭「→」完美置中。</li>
                            <li>• 書櫃 3 快捷直達無縫切換：下排 3 按鈕充足大器，點擊直接進入對應書櫃專區無滑動。</li>
                          </ul>
                        </div>

                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.8.6</span>
                            <span className="changelog-date">(2026-10-03)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 近期/最愛點擊直接進入：點入書櫃專區時全面移除滑動動畫，零延遲直接切換進入。</li>
                            <li>• 新增單獨 4*2 書櫃快捷卡：單排 3 按鈕（近期下載、近期閱讀、我的最愛），空間極致舒展。</li>
                            <li>• 新增單獨 4*2 系統導航卡：單排 3 按鈕（我的書櫃、我的筆記、關鍵字搜尋），秒速直達。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.8.5</span>
                            <span className="changelog-date">(2026-10-03)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 快捷功能升級 4*3 規格：6 快捷鍵垂直空間大幅擴充，文字與圖標大方舒展，絕不遮擋。</li>
                            <li>• 便籤編輯置頂與鎖定滾軸：編輯時卡片以 fixed 精準置頂於主控制列正下方，滾軸鎖定不可拉升。</li>
                            <li>• 外部雙擊自動完成退出：在便籤卡片或控制條外連續點 2 下，自動完成儲存並退出編輯。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.8.4</span>
                            <span className="changelog-date">(2026-10-03)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 新增 4*2 快捷功能卡片：雙排 6 快捷鍵（近期下載/閱讀/最愛、書櫃/筆記/搜尋）。</li>
                            <li>• 便籤編輯一律自動置頂：進入編輯時卡片一律置頂於主控制列下方，輸入法完全不遮擋。</li>
                            <li>• 外部雙擊自動完成：便籤與小工具編輯模式下，頁面外連續點2下均自動儲存並退出。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.8.3</span>
                            <span className="changelog-date">(2026-10-03)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 便籤編輯一律自動置頂：進入編輯時卡片一律置頂於主控制列下方，輸入法完全不遮擋。</li>
                            <li>• 便籤外部雙擊自動完成：在便籤頁面外連續點2下表示完成編輯，自動儲存並退出。</li>
                            <li>• 首頁版面雙擊自動完成：在小工具版面編輯時，於頁面外連續點2下即自動儲存並退出。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.8.2</span>
                            <span className="changelog-date">(2026-10-03)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 便籤排版懸浮靠合：文字控制列懸浮緊靠便籤下方邊緣，支援全尺寸，輸入法不遮擋。</li>
                            <li>• 雙重防誤觸機制：便籤連續點兩下才進入編輯，必須按「取消」或「完成」離開。</li>
                            <li>• 符號選單精簡更新：符號鈕改為純文字，移除舊符號，加入「☸︎」「●」「★」「☆」「◌」。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.8.1</span>
                            <span className="changelog-date">(2026-10-02)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 便籤 Spotlight 聚焦升級：全螢幕半透明景深模糊，唯獨編輯中的卡片亮起凸顯。</li>
                            <li>• 局部字級與楷體完整修復：縮放嚴格限定反白文字不影響全卡，完整相容標楷體。</li>
                            <li>• 清雅線條蓮花與極簡介面：移除卡片角落符號，導入圖1三瓣線條清蓮 SVG。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.8.0</span>
                            <span className="changelog-date">(2026-10-01)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 原地直編模式：點擊卡片直接打字與修改出處，按 Enter 換行，即時預覽。</li>
                            <li>• Word 膠囊列升級：依序整合文字大小、字體、粗體、間距與符號（含卍字）。</li>
                            <li>• 反白防呆保護：必須選取文字時字級、字體與粗體才生效，未選字時安全防誤觸。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.7.9</span>
                            <span className="changelog-date">(2026-10-01)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 升級便籤 Spotlight 卡片直接編輯：灰黑背景唯獨卡片亮起，直接在卡片上打字修改與預覽。</li>
                            <li>• Word 風格單列膠囊控制列：由左至右整合符號標誌、字體、文字大小、間距四鍵彈出選單。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.7.8</span>
                            <span className="changelog-date">(2026-09-30)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 修復淺色系書櫃與筆記膠囊文字對比度：修正未選定膠囊文字為高對比深褐色。</li>
                            <li>• 徹底根除淺色系下未選膠囊呈現淡藍白底吃字問題，文字清晰明瞭易讀。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.7.7</span>
                            <span className="changelog-date">(2026-09-30)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 優化紫柑木（紫紺木）模式經書標籤對比度：採用經典泥金底色（#d4a373）配純黑字體。</li>
                            <li>• 徹底根除亮黃底配白字吃字問題，書櫃與筆記經典編號徽章清晰明亮易讀。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.7.6</span>
                            <span className="changelog-date">(2026-09-30)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 修復首頁便籤編輯抽屜：導入 createPortal 直掛 body，解除父層 transform 座標系約束。</li>
                            <li>• 點擊編輯抽屜自螢幕下方向上滑出，卡片自動平滑置中，達成 100% 毫秒級即時預覽。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.7.5</span>
                            <span className="changelog-date">(2026-09-30)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 刪除筆記法義多維度頂部「共 X 組跨經共通關鍵字……客觀交叉對照」統計說明列。</li>
                            <li>• 刪除法義多維度關鍵字卡片前方之「🏷️」標籤符號，保持純文字簡約優雅樣式。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.7.4</span>
                            <span className="changelog-date">(2026-09-30)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 修復書櫃「• 依部類 ▾」因 overflow 裁切無法彈出之問題，選單浮於最上層。</li>
                            <li>• 修復筆記「依書籍檢視 ▾」無法彈出之問題，並徹底刪除按鈕文字左側圖示符號。</li>
                            <li>• 膠囊列改由左側按鈕區自適應水平滑動，確保右側彈出選單完整呈現不被遮切。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.7.3</span>
                            <span className="changelog-date">(2026-09-30)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 編輯便籤由螢幕下向上滑出控制抽屜，卡片本體即時預覽，配置「取消」與「完成」膠囊。</li>
                            <li>• 新增 6 款禪意蓮花符號與無符號切換；便籤分符號、文字本體與出處 3 部份（出處選填）。</li>
                            <li>• 文字支援分行獨立字體字級；4 規格（4×1/2×2/4×2/4×3）設字級臨界點，達極限自動停按。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.7.2</span>
                            <span className="changelog-date">(2026-09-30)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 書櫃與筆記頂部膠囊列適配窄版手機：微調字級與內距，確保全部排在同一行。</li>
                            <li>• 「我的筆記」全面對齊「我的書櫃」卡片尺寸、38px 綠色標籤與間距，視覺完全一致。</li>
                            <li>• 法義多維度語詞演算法升級：排除非語詞碎片，新增「全部展開/收合」符號，並隱藏 4 分類。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.7.1</span>
                            <span className="changelog-date">(2026-09-29)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 「每日閱讀日誌」小卡比照 iOS 月曆升級：2×2 與 4×2 醒目大日期搭配今日/近日讀經摘要。</li>
                            <li>• 窄螢幕手機自適應換行：書櫃與筆記膠囊列彈性換行，首頁點擊直達書櫃篩選視圖。</li>
                            <li>• 禪意圖標輪播精簡為 6 款精選小圖，支援點擊即時循環切換。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.7.0</span>
                            <span className="changelog-date">(2026-09-28)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 「我的書櫃」升級單行極致精簡列：左側快捷過濾，最右側「• 依部類 ▾」點擊切換 4 分類。</li>
                            <li>• 「我的筆記」升級單行精簡流：刪除心得/重點膠囊，支援點選切換書籍檢視與法義交叉。</li>
                            <li>• 徹底消除雙分段與大卡片堆疊，垂直節省 70% 空間，開啟頁面直擊經文與筆記。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.6.9</span>
                            <span className="changelog-date">(2026-09-28)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 主題顏色升級一體化卡片：第 5 欄為「|」區隔線，第 6 欄自訂圓圈（未選「+」、選中「✓」）。</li>
                            <li>• 閱讀時間升級一體化卡片：上下 6 欄像素級對稱對齊，前 4 個為時鐘，第 5 欄為「|」，第 6 欄為自訂。</li>
                            <li>• 時間抽屜支援 ±5 分步進器與手機滑動條：以 5 分鐘為單位自訂調節，提供快捷時間膠囊。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.6.8</span>
                            <span className="changelog-date">(2026-09-27)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 簡化閱讀設定面板，暫時隱藏版面預覽與劃線樣式，聚焦閱讀頁核心控制。</li>
                            <li>• 升級主題顏色 5 色圓圈精緻雙環光澤，第 5 圓圈與「+自訂」緊鄰靠攏。</li>
                            <li>• 「Cbeta Reader 簡易功能導覽」升級為精緻膠囊並移至進階功能之下。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.6.7</span>
                            <span className="changelog-date">(2026-09-27)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 首頁新增「自訂便籤小卡」，支援 2×2、4×2、4×3、4×4、4×1 自由規格。</li>
                            <li>• 讀者可自由填寫經文佳句、自選法義或修行座右銘與署名出處。</li>
                            <li>• 點擊卡片彈出排版控制台，支援自訂字體、字級、行高與邊距並即時預覽。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.6.6</span>
                            <span className="changelog-date">(2026-09-27)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 主題顏色面板「+ 自訂」預設為收合狀態，排版更精巧俐落。</li>
                            <li>• 快速套用風格範本設定「版型1 極簡」（橫幅+下載+三合一卡）。</li>
                            <li>• 將「版型1 極簡」設為讀者首次進入時之首頁權威預設版型。</li>
                          </ul>
                        </div>

                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.6.5</span>
                            <span className="changelog-date">(2026-09-27)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 新增「三合一閱讀卡」(4×4)，集合近期下載、上次閱讀、我的最愛各 1 本經典。</li>
                            <li>• 各區塊獨立配置外置標題列與直達按鈕，點擊標題直接進入書櫃對應分類。</li>
                            <li>• 各經書長條 Bar 支援即時開啟閱讀與進度接續，全尺寸適配四大主題色。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.6.4</span>
                            <span className="changelog-date">(2026-09-27)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 閱讀頁經典與版權資訊新增「時代：」欄位，忠實呈現經文著述朝代。</li>
                            <li>• 作譯者智慧分離朝代與作者，若僅有朝代無作譯者（如 X1487）作譯者顯示為空。</li>
                            <li>• 書櫃與筆記分類修正純朝代經典，杜絕將朝代名稱誤歸為作者群組。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.6.3</span>
                            <span className="changelog-date">(2026-09-27)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 書櫃「依冊別」點擊藏經名稱（如大正藏），秒速直達對應冊別目錄。</li>
                            <li>• 書櫃「依作譯者」優先完全精確匹配（如竺法護與法護精確區隔），直達 4 層經文庫。</li>
                            <li>• 書櫃「依朝代」點擊歷史朝代，無縫直達著述年代經典目錄。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.6.2</span>
                            <span className="changelog-date">(2026-09-27)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 書櫃「依部類」文字支援直接點擊，秒速直達對應 CBETA 部類藏經目錄。</li>
                            <li>• 支援 23 大部類點擊跳轉並自動展開類別與麵包屑，返回導航無縫順暢。</li>
                            <li>• 分組標題點擊與卡片折疊箭頭精確分離，兼具流暢閱讀與探索體驗。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.6.1</span>
                            <span className="changelog-date">(2026-09-26)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 4×4 經文卡片外置標題列全面去除按鍵，排版純粹乾淨。</li>
                            <li>• 經書切換器「‹ 1/6 ›」無縫整合至經書 Bar 內，操作聚焦自然。</li>
                            <li>• 徹底根除多卡片堆疊時箭頭過多之混亂感，視覺協調美觀。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.6.0</span>
                            <span className="changelog-date">(2026-09-26)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 2×2「CBETA」字體顏色與字距完全對齊 4×1 與 4×2 翡翠綠與圓體規範。</li>
                            <li>• 四合一導航 4×2 按鍵淡色背景上下長度縮減，視覺呈現精緻端正正方形。</li>
                            <li>• 上次閱讀、近期閱讀與我的最愛移除右上角部數徽章，限定點文字進入書櫃。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.5.9</span>
                            <span className="changelog-date">(2026-09-26)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 全站統一更名為「我的筆記」，包含頂部膠囊、首頁卡片與資料夾導航。</li>
                            <li>• 「我的筆記」對齊書櫃排版：雙分段切換、4 大維度分類與 4 快捷膠囊。</li>
                            <li>• 支援部類/冊別/作譯者/朝代折疊卡分組，與客觀文字法義多維度交叉聚合。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.5.8</span>
                            <span className="changelog-date">(2026-09-26)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 重點與筆記升級「依書籍檢視」與「法義多維度」雙分段切換。</li>
                            <li>• 導入純客觀關鍵字交叉聚合演算法，跨經出現 ≥ 3 次自動成群對照。</li>
                            <li>• 支援全部/有心得/純重點/近期標註 4 快捷過濾與命中詞柔和高亮。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.5.7</span>
                            <span className="changelog-date">(2026-09-25)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 紫紺木全面升級泥金佛光高對比字色，根治深底吃字問題。</li>
                            <li>• 主題顏色圓圈間距加大，手機手指極易精準點擊。</li>
                            <li>• 「+ 自訂」膠囊像素級對齊預覽框右邊線，排版協調俐落。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.5.5</span>
                            <span className="changelog-date">(2026-09-25)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 加入小工具預覽框上下左右加大，兩側「&lt;」「&gt;」按鈕精巧化，版面更開闊。</li>
                            <li>• 尺寸徽章「4×4」等外置提到預覽框外部的上面，不佔用框內畫面。</li>
                            <li>• 4×2 經書長條 Bar 依首頁圖 4 嚴格維持細長長寬比，等比縮放納入框內。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.5.4</span>
                            <span className="changelog-date">(2026-09-24)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 首頁卡片「上次閱讀」與「近期下載」右上角徽章數量對齊書櫃最多 9 本。</li>
                            <li>• 小工具庫 4×3 與 4×4 預覽升級等比自適應縮放，徹底消除邊緣切邊。</li>
                            <li>• 尺寸切換依序輪播，上次閱讀支援 4 本書與經文進度雙 4×4，標籤統一為「上次閱讀」。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.5.3</span>
                            <span className="changelog-date">(2026-09-24)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 「上次閱讀」小工具支援 4×4 經文進度預覽（16px明體，前後省略號）。</li>
                            <li>• 書櫃「上次閱讀」與「近期下載」設定最多 9 本，最愛不限。</li>
                            <li>• 書櫃書籍列表移除右側「&gt;」符號，點選整條 Bar 即進入閱讀。</li>
                          </ul>
                        </div>

                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.5.2</span>
                            <span className="changelog-date">(2026-09-24)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 首頁四大導航 4×2 升級網格等寬自適應，徹底解決手機端右側按鍵切邊。</li>
                            <li>• 書櫃「依作譯者」修正印順導師跨冊經典（Y0030）跳號問題。</li>
                            <li>• 書櫃「依作譯者」修正太虛大師全書跨冊排序，按 TX0001~TX0020 連續遞增。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.5.1</span>
                            <span className="changelog-date">(2026-09-22)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 閱讀頁中央膠囊新增「版面設定」、「畫重點」、「本書搜尋」標籤。</li>
                            <li>• 點選本書搜尋取消彈出視窗，直接於頂部控制列下方展開即時檢索列。</li>
                            <li>• 支援原地直接輸入與隨時修改關鍵字，上下切換匹配與高亮。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.5.0</span>
                            <span className="changelog-date">(2026-09-22)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 1 本書與 2 本書小工具取消書籍外圍細小邊框，消除視覺重覆感。</li>
                            <li>• 閱讀頁上方控制列全站統一，左「家」右「齒輪」位置與首頁精確對齊。</li>
                            <li>• 閱讀頁「字/筆刷/搜尋」整合為中央微膠囊，目次與齒輪配置圓型背景。</li>
                          </ul>
                        </div>
                        <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                          <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>App: v4.4.9</span>
                            <span className="changelog-date">(2026-09-22)</span>
                          </div>
                          <ul className="changelog-list">
                            <li>• 首頁四合一導航 4×2 取消 4 個按鍵外圍細邊框。</li>
                            <li>• 「下載經典」按鍵下方新增「從cbeta下載」標籤。</li>
                            <li>• 「全文檢索」按鍵下方新增「關鍵字搜尋」標籤。</li>
                          </ul>
                        </div>
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

                {/* 最新 Builder 版本 (v2.9.13) 直接顯示 */}
                <div className="changelog-version-section">
                  <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⭐ Builder: v2.9.13</span>
                    <span className="changelog-date">(2026-09-28)</span>
                  </div>
                  <ul className="changelog-list">
                    <li>• 根除清單段落雙重重複，修復《太虛大師年譜》等經典相同段落重複出現問題。</li>
                    <li>• 升級深度回溯演算法，徹底杜絕內文中途換行被誤判為縮排而產生多餘空格。</li>
                    <li>• 完善清單段落層級繼承，忠實呈現 CBETA 權威編者附言與條列式註解。</li>
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
                      <div className="changelog-version-title">Builder: v2.9.12 <span className="changelog-date">(2026-09-22)</span></div>
                      <ul className="changelog-list">
                        <li>• 支援 CBETA 雙字母前綴代碼（TX、GA、GB、LC 等），精確識別藏經冊別。</li>
                        <li>• 修正經典建構 Metadata 時雙字母代碼被截斷為單字母之問題。</li>
                      </ul>
                    </div>
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
