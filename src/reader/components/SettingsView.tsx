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
          {/* 1. 閱讀主題色彩 (置於最上方) */}
          <div className="settings-section">
            <div className="settings-section-title">閱讀主題色彩</div>
            <div className="theme-selector-grid">
              {/* 象牙白 */}
              <div
                className={`theme-circle-wrapper ${settings.theme === 'ivory' ? 'active' : ''}`}
                onClick={() => onSave({ ...settings, theme: 'ivory' })}
              >
                <div className="theme-circle bg-ivory" />
                <span className="theme-circle-label">象牙白</span>
              </div>
              {/* 羊皮紙 */}
              <div
                className={`theme-circle-wrapper ${settings.theme === 'parchment' ? 'active' : ''}`}
                onClick={() => onSave({ ...settings, theme: 'parchment' })}
              >
                <div className="theme-circle bg-parchment" />
                <span className="theme-circle-label">羊皮紙</span>
              </div>
              {/* 舒服 */}
              <div
                className={`theme-circle-wrapper ${settings.theme === 'comfort' ? 'active' : ''}`}
                onClick={() => onSave({ ...settings, theme: 'comfort' })}
              >
                <div className="theme-circle bg-comfort" />
                <span className="theme-circle-label">舒服</span>
              </div>
              {/* 烏木 */}
              <div
                className={`theme-circle-wrapper ${settings.theme === 'ebony' ? 'active' : ''}`}
                onClick={() => onSave({ ...settings, theme: 'ebony' })}
              >
                <div className="theme-circle bg-ebony" />
                <span className="theme-circle-label">烏木</span>
              </div>
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
            <div className="changelog-dialog-body">
              <ul className="changelog-list">
                <li>1. 優化Y系列經目次二層簡化與無卷書籍去卷化。</li>
                <li>2. 修復經文列表（LI）層級縮排與置左偈頌排版。</li>
                <li>3. 串接本地檢索無結果時一鍵線上檢索 CBETA。</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
