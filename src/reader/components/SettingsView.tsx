import { useState, useEffect } from 'react';
import { X, Database, FileText, Upload, HelpCircle, RotateCw, Archive, Trash2, HardDrive, CheckCircle2 } from 'lucide-react';
import type { AppSettings, StorageStats } from '../../utils/db';
import { getStorageStats, clearHttpCacheStorage, compressAllBooks, clearAllBooks } from '../../utils/db';
import { BUILDER_VERSION, APP_VERSION } from '../../builder/version';
import { exportUserData, importUserData } from '../../utils/backup';
import '../styles/settings.css';

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export function SettingsView({ settings, onSave, onClose }: SettingsViewProps) {
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

  useEffect(() => {
    getStorageStats().then(setStorageStats).catch(console.warn);
  }, []);

  const handleClearAllBooks = async () => {
    if (!window.confirm('確定要刪除本地所有離線經典嗎？此操作將清空離線書庫並還原為乾淨狀態。')) return;
    setStorageMsg('正在刪除本地所有離線經書與快取...');
    try {
      await clearAllBooks();
      const stats = await getStorageStats();
      setStorageStats(stats);
      setStorageMsg('已成功清空本地所有離線經典！頁面即將自動刷新。');
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
  const speeds = [0.5, 1.0, 1.5, 2.0];

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
                  fontFamily: '"Iansui", "Klee One", "LXGW WenKai TC", "LXGW WenKai", "DFKai-SB", "CBETASupplement", serif',
                  sample: '永' 
                },
                { 
                  id: 'iansui-bold', 
                  name: '芫荽體(粗)', 
                  fontFamily: '"Iansui", "Klee One", "LXGW WenKai TC", "LXGW WenKai", "DFKai-SB", "CBETASupplement", serif',
                  sample: '永' 
                }
              ].map((fontItem) => {
                const rawFont = settings.fontFamily || 'default';
                const currentFont = (rawFont === 'yuanti' || rawFont === 'fangsong' || rawFont === 'kaiti' || rawFont === 'wenkai' || rawFont === 'iansui-zy') ? 'iansui-bold' : rawFont;
                const isActive = currentFont === fontItem.id;
                return (
                  <div
                    key={`fontFamily-${fontItem.id}`}
                    className={`visual-option-card ${isActive ? 'active' : ''}`}
                    onClick={() => onSave({ ...settings, fontFamily: fontItem.id as any })}
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
                
                const getPreviewStyle = () => {
                  const previewColor = 'rgba(250, 204, 21, 0.65)';
                  switch (style) {
                    case 'underline':
                      return { borderBottom: '2.5px solid #fbbf24', background: 'transparent' };
                    case 'bottom-half':
                      return { background: `linear-gradient(180deg, transparent 55%, ${previewColor} 55%)` };
                    case 'full':
                      return { backgroundColor: previewColor };
                    case 'border':
                      return { border: '2.5px solid #fbbf24', borderRadius: '3px', padding: '0 1px' };
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

          {/* 6. 朗讀速度 */}
          <div className="settings-section">
            <div className="settings-section-title">朗讀速度</div>
            <div className="visual-options-row">
              {speeds.map((s) => {
                const needleX = s === 0.5 ? 11 : s === 1.0 ? 18 : s === 1.5 ? 25 : 28;
                const needleY = s === 0.5 ? 15 : s === 1.0 ? 10 : s === 1.5 ? 15 : 22;
                return (
                  <div
                    key={`speed-${s}`}
                    className={`visual-option-card ${settings.ttsSpeed === s ? 'active' : ''}`}
                    onClick={() => onSave({ ...settings, ttsSpeed: s })}
                  >
                    <svg className="speed-svg" viewBox="0 0 36 36">
                      <path d="M 8 26 A 12 12 0 1 1 28 26" className="svg-arc" />
                      <line x1="8" y1="26" x2="10" y2="24" />
                      <line x1="18" y1="6" x2="18" y2="9" />
                      <line x1="28" y1="26" x2="26" y2="24" />
                      <circle cx="18" cy="22" r="2.5" className="svg-center" />
                      <line x1="18" y1="22" x2={needleX} y2={needleY} className="svg-needle" />
                    </svg>
                    <span className="visual-option-label">{s.toFixed(1)}x</span>
                  </div>
                );
              })}
            </div>
          </div>

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
                    一鍵清空離線書庫
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
                  checked={settings.customVisibleElements?.ttsHighlight ?? true} 
                  onChange={() => handleCheckboxChange('ttsHighlight')}
                />
                語音朗讀時高亮顯示當前段落
              </label>
            </div>
          </div>

          {/* 5. 版本資訊與說明列 */}
          <div className="settings-version-row">
            <div className="settings-version-info">
              <span>App: v{APP_VERSION}</span>
              <span className="version-divider">|</span>
              <span>Builder: v{BUILDER_VERSION}</span>
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
            <div className="changelog-dialog-body custom-scrollbar" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1.2rem' }}>
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

                {/* 最新 App 版本 (v3.0.0 重大更新) 直接顯示 */}
                <div className="changelog-version-section">
                  <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>App: v3.0.0</span>
                    <span className="changelog-date">(2026-07-31)</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--theme-accent, #8c4b27)', fontWeight: 700, border: '1px solid var(--theme-accent, #8c4b27)', padding: '1px 5px', borderRadius: '4px', marginLeft: '4px' }}>重大更新</span>
                  </div>
                  <ul className="changelog-list">
                    <li>• 提升 CBETA Reader 藏經庫搜尋功能，導入 CBETA 原有的四大檢索方式「依部類查詢」、「依冊別查詢」、「依作譯者查詢」、「依朝代查詢」等，並加入「常用經典」，更方便讀者搜尋經典。</li>
                  </ul>
                </div>

                {/* 置左按鈕：+ 更多 App 修改歷程 */}
                <div style={{ marginTop: '0.8rem', textAlign: 'left' }}>
                  <button 
                    type="button"
                    onClick={() => setShowAppHistory(prev => !prev)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--reader-text-muted, #777)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      padding: '0.2rem 0',
                      opacity: 0.85,
                      fontWeight: 500,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
                  >
                    {showAppHistory ? '− 收起 App 歷史紀錄' : '+ 更多 App 修改歷程'}
                  </button>
                </div>

                {/* 展開的 App 歷史版本 */}
                {showAppHistory && (
                  <div className="changelog-history-wrapper animate-fade-in" style={{ marginTop: '0.6rem' }}>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v2.3.0 <span className="changelog-date">(2026-07-29)</span></div>
                      <ul className="changelog-list">
                        <li>• 閱讀設定新增「| 內文字體」選擇，提供宋/明體、正黑體、芫荽體與芫荽體(粗) 4 種開放字型。</li>
                        <li>• 新增「儲存空間與全集壓縮管理」，支援高動態 Gzip 壓縮，全集經文節省 80% 本地容量。</li>
                        <li>• 新增一鍵「清理 HTTP 網路快取」與動態容量儀表板，輕鬆釋放手機暫存空間。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v2.2.0 <span className="changelog-date">(2026-07-28)</span></div>
                      <ul className="changelog-list">
                        <li>• 閱讀設定新增「| 內文字體」選擇，提供宋/明體、正黑體、芫荽體與芫荽體(粗) 4 種開放字型。</li>
                        <li>• 內文字體切換僅影響經典正文段落，保持篇章節段與書名標題字體不變。</li>
                        <li>• 修復「烏木」模式劃線高對比字體與 iOS 點擊輸入框自動放大防跑版機制。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v2.1.0 <span className="changelog-date">(2026-07-28)</span></div>
                      <ul className="changelog-list">
                        <li>• 支援線上搜尋「整批勾選經典與一鍵批量下載」。</li>
                        <li>• 批量下載自動帶出關鍵字作為資料夾名稱，支援自訂修改。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v2.0.0 <span className="changelog-date">(2026-07-27)</span></div>
                      <ul className="changelog-list">
                        <li>• 配置 PWA / iOS「加入主畫面」蓮花經典桌面圖示。</li>
                        <li>• 首頁新增經書批量勾選與一鍵「批量移動至資料夾」功能。</li>
                        <li>• 優化編輯模式卡片寬度、灰色豎條手把與 6 色主題資料夾。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v1.8.0 <span className="changelog-date">(2026-07-25)</span></div>
                      <ul className="changelog-list">
                        <li>• 縮減偈頌體（韻文）段落上下間距與行高，閱讀更緊湊。</li>
                        <li>• 大藏經經號依 A~Z 自動分配 26 套典雅經典封面色系。</li>
                        <li>• 優化手機版編輯模式排版，限制標題單行省略。</li>
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
                        <li>• 強化原始經文「圓體粗體」跨平台高對比排版。</li>
                        <li>• 隱藏閱讀器底部百分比進度，專注目前品名與閱讀狀態。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v1.4.0 <span className="changelog-date">(2026-07-23)</span></div>
                      <ul className="changelog-list">
                        <li>• 閱讀器側邊欄目錄升級為可展開/折疊的多層級樹狀選單。</li>
                        <li>• 新增劃線重點筆刷按鈕與個人劃線標註功能。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v1.1.0 <span className="changelog-date">(2026-07-20)</span></div>
                      <ul className="changelog-list">
                        <li>• 下載後保持線上搜尋對話框開啟，便利連續下載操作。</li>
                        <li>• 統一閱讀頁面頂部控制列高度為 56px 視覺基準。</li>
                      </ul>
                    </div>
                    <div className="changelog-version-section" style={{ marginTop: '1rem' }}>
                      <div className="changelog-version-title">App: v1.0.0 <span className="changelog-date">(2026-07-15)</span></div>
                      <ul className="changelog-list">
                        <li>• 釋出初始核心經典閱讀、搜尋與劃線標籤功能。</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* 第二部分：Builder 經文解析引擎更新 */}
              <div className="changelog-group-section" style={{ marginBottom: '1.5rem' }}>
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

                {/* 最新 Builder 版本 (v2.4.0 重大更新) 直接顯示 */}
                <div className="changelog-version-section">
                  <div className="changelog-version-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Builder: v2.4.0</span>
                    <span className="changelog-date">(2026-07-31)</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--theme-accent, #8c4b27)', fontWeight: 700, border: '1px solid var(--theme-accent, #8c4b27)', padding: '1px 5px', borderRadius: '4px', marginLeft: '4px' }}>重大更新</span>
                  </div>
                  <ul className="changelog-list">
                    <li>• 全面升級 6 線程防限流下載串流池與自動修復引擎 (Auto-Healing Engine)，保證正文 100% 完整零丟包。</li>
                    <li>• 導入部類關鍵字智慧自動關聯 (Category Keyword Auto-Mapping)，解決大範圍檢索伺服器斷線難題。</li>
                  </ul>
                </div>

                {/* 置左按鈕：+ 更多 Builder 修改歷程 */}
                <div style={{ marginTop: '0.8rem', textAlign: 'left' }}>
                  <button 
                    type="button"
                    onClick={() => setShowBuilderHistory(prev => !prev)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--reader-text-muted, #777)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      padding: '0.2rem 0',
                      opacity: 0.85,
                      fontWeight: 500,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
                  >
                    {showBuilderHistory ? '− 收起 Builder 歷史紀錄' : '+ 更多 Builder 修改歷程'}
                  </button>
                </div>

                {/* 展開的 Builder 歷史版本 */}
                {showBuilderHistory && (
                  <div className="changelog-history-wrapper animate-fade-in" style={{ marginTop: '0.6rem' }}>
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
                  </div>
                )}
              </div>

              {/* 4. CBETA 與 CBETA Reader 簡介與感言區塊 (隔一條線，小字呈現) */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.2rem', borderTop: '1px dashed var(--reader-border, rgba(0,0,0,0.15))' }}>
                <div style={{ fontSize: '0.8rem', lineHeight: 1.7, color: 'var(--reader-text-muted, #777)', opacity: 0.88, textAlign: 'justify' }}>
                  <p style={{ marginBottom: '0.8rem' }}>
                    CBETA（佛教電子佛典基金會）成立於1998年，由佛教界與學術界共同推動，致力於漢文佛典數位化工程。收錄《大正藏》、《卍續藏》等重要佛典，提供全文檢索、線上閱讀與研究資料，目前已成為全球最重要的漢傳佛教數位典藏平台之一。
                  </p>
                  <p style={{ marginBottom: '0.8rem' }}>
                    本網站CBETA Reader，完全以 CBETA 佛典資料為基礎，試圖打造適合手機與平板閱讀的佛典閱讀器。希望透過簡潔介面，協助使用者更容易閱讀大藏經經文。
                  </p>
                  <p style={{ margin: 0 }}>
                    如有任何建議，歡迎不吝指導，來信寄至創作者Email: <a href="mailto:vbgrdmental@gmail.com" style={{ color: 'inherit', textDecoration: 'underline' }}>vbgrdmental@gmail.com</a>，無限感恩，並祝福法喜充滿，福慧雙修。
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
