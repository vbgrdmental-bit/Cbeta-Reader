import { useState } from 'react';
import { X } from 'lucide-react';
import type { AppSettings } from '../../utils/db';
import { BUILDER_VERSION, APP_VERSION } from '../../builder/version';
import '../styles/settings.css';

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export function SettingsView({ settings, onSave, onClose }: SettingsViewProps) {
  const [showChangelog, setShowChangelog] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  
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
          {/* 1. 閱讀主題色彩 (置於最上方，比照筆刷顏色等排版) */}
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

          {/* 2. 排版與邊距 (第二項，圖示按鈕) */}
          <div className="settings-section">
            <div className="settings-section-title">排版與邊距</div>
            <div className="visual-options-row">
              {paddings.map((p) => {
                // 生成不同 padding 對應的 SVG 水平長條寬度
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

          {/* 💡 2.5 行高與行距 (新增，比照排版與邊距的圖像化 4 格按鈕) */}
          <div className="settings-section">
            <div className="settings-section-title">行高與行距</div>
            <div className="visual-options-row">
              {[1.6, 1.8, 2.0, 2.2].map((lh) => {
                // 根據不同行高計算 line 的上下間距偏移
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

          {/* 3. 朗讀速度 (第三項，圖示按鈕) */}
          <div className="settings-section">
            <div className="settings-section-title">朗讀速度</div>
            <div className="visual-options-row">
              {speeds.map((s) => {
                // 根據速度值返回不同的針尖坐標
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

          {/* 💡 畫重點設定 */}
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

          {/* 4. 其他設定 (預設打勾，整併兩個選項) */}
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

          {/* 5. 版本資訊與說明 */}
          <div className="settings-version-row">
            <div className="settings-version-info">
              <span>App: v{APP_VERSION}</span>
              <span className="version-divider">|</span>
              <span>Builder: v{BUILDER_VERSION}</span>
            </div>
            <button 
              type="button"
              className="changelog-trigger-btn"
              onClick={() => setShowChangelog(true)}
            >
              說明
            </button>
          </div>
        </div>
      </div>

      {showChangelog && (
        <div className="changelog-dialog-overlay" onClick={() => setShowChangelog(false)}>
          <div className="changelog-dialog-card animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="changelog-dialog-header">
              <h4>版本更新說明</h4>
              <button className="changelog-dialog-close-btn" onClick={() => setShowChangelog(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="changelog-dialog-body custom-scrollbar" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {/* 1. 最新一次的版本修改記錄 */}
              <div className="changelog-version-section">
                <div className="changelog-version-title">v1.6.0 <span className="changelog-date">(2026-07-23)</span></div>
                <ul className="changelog-list">
                  <li>• 舊經文支援背景無縫修復升級，完全保留劃線與筆記。</li>
                  <li>• 刪除經文時自動抹除舊快取，確保與 CBETA 即時同步。</li>
                  <li>• 獨立 APP_VERSION 與 BUILDER_VERSION 版本號追蹤原則。</li>
                  <li>• 強化原始經文「圓體粗體」跨平台對比與「+ 附文」目次結構。</li>
                </ul>
              </div>

              {/* 2. 小灰字切換按鈕：+ 更多版本修改歷程 */}
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <button 
                  type="button"
                  onClick={() => setShowAllHistory(prev => !prev)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--reader-text-muted, #888)',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    padding: '0.3rem 0.6rem',
                    opacity: 0.8,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
                >
                  {showAllHistory ? '− 收折歷程' : '+ 更多版本修改歷程'}
                </button>
              </div>

              {/* 3. 展開的歷史版本更新紀錄 */}
              {showAllHistory && (
                <div className="changelog-history-wrapper animate-fade-in">
                  <div className="changelog-version-section" style={{ marginTop: '1.2rem' }}>
                    <div className="changelog-version-title">v1.5.0 <span className="changelog-date">(2026-07-23)</span></div>
                    <ul className="changelog-list">
                      <li>• 精確識別論典/講記中的原始經文引用段落。</li>
                      <li>• 原始經文採用圓體粗體渲染，與解說正文優雅區隔。</li>
                    </ul>
                  </div>
                  <div className="changelog-version-section" style={{ marginTop: '1.2rem' }}>
                    <div className="changelog-version-title">v1.4.0 <span className="changelog-date">(2026-07-23)</span></div>
                    <ul className="changelog-list">
                      <li>• 全面升級目次（TOC）樹狀多層級解析算法。</li>
                      <li>• 側邊欄目錄升級為可展開/折疊（+ / −）多層級選單。</li>
                      <li>• 新增畫重點筆刷按鈕、自訂顏色與標註模式。</li>
                    </ul>
                  </div>
                  <div className="changelog-version-section" style={{ marginTop: '1.2rem' }}>
                    <div className="changelog-version-title">v1.3.0 <span className="changelog-date">(2026-07-21)</span></div>
                    <ul className="changelog-list">
                      <li>• 優化Y系列經目次二層簡化與無卷書籍去卷化。</li>
                      <li>• 修復經文列表（LI）層級縮排與置左偈頌排版。</li>
                      <li>• 串接本地檢索無結果時一鍵線上檢索 CBETA。</li>
                    </ul>
                  </div>
                  <div className="changelog-version-section" style={{ marginTop: '1.2rem' }}>
                    <div className="changelog-version-title">v1.2.0 <span className="changelog-date">(2026-07-21)</span></div>
                    <ul className="changelog-list">
                      <li>• 建立開發分支與 Builder v1.2.0 版本控制規範。</li>
                    </ul>
                  </div>
                  <div className="changelog-version-section" style={{ marginTop: '1.2rem' }}>
                    <div className="changelog-version-title">v1.1.0 <span className="changelog-date">(2026-07-20)</span></div>
                    <ul className="changelog-list">
                      <li>• 下載後保持線上搜尋對話框開啟以利批次操作。</li>
                      <li>• 統一閱讀頁面頭部與控制列的高度為 56px。</li>
                    </ul>
                  </div>
                  <div className="changelog-version-section" style={{ marginTop: '1.2rem' }}>
                    <div className="changelog-version-title">v1.0.0 <span className="changelog-date">(2026-07-15)</span></div>
                    <ul className="changelog-list">
                      <li>• 釋出初始核心經典解析、導航與檢索功能。</li>
                    </ul>
                  </div>
                </div>
              )}

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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
