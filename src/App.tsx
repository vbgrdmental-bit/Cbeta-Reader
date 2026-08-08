import { useState, useEffect } from 'react';
import { Library } from './reader/components/Library';
import { ReaderView } from './reader/components/ReaderView';
import { SettingsView } from './reader/components/SettingsView';
import { getSettings, saveSettings } from './utils/db';
import type { AppSettings } from './utils/db';
import { getSourceMode, setSourceMode, subscribeSourceMode } from './utils/sourceMode';
import type { SourceMode } from './utils/sourceMode';
import './App.css';

export function App() {
  const [view, setView] = useState<'library' | 'reader'>('library');
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | undefined>(undefined);
  const [lastSearchQuery, setLastSearchQuery] = useState<string | undefined>(undefined);
  const [sourceMode, setSourceModeState] = useState<SourceMode>(getSourceMode());
  
  // 設定狀態
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [booksUpdatedTrigger, setBooksUpdatedTrigger] = useState(0);

  // 監聽模式變更
  useEffect(() => {
    const unsub = subscribeSourceMode(setSourceModeState);
    return unsub;
  }, []);

  // 初始化載入偏好設定
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await getSettings();
        setSettings(stored);
        applyThemeClass(stored.theme);
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };
    loadSettings();
  }, []);

  // 當 settings 改變時套用主題 class 到 body
  const applyThemeClass = (theme: AppSettings['theme']) => {
    const body = document.body;
    // 移除現有的 theme-* 類別
    body.className = body.className
      .split(' ')
      .filter(c => !c.startsWith('theme-'))
      .join(' ');
    
    // 加入新的類別
    body.classList.add(`theme-${theme}`);
  };

  const handleSaveSettings = async (updated: AppSettings) => {
    setSettings(updated);
    applyThemeClass(updated.theme);
    try {
      await saveSettings(updated);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const [resetFolderTrigger, setResetFolderTrigger] = useState(0);

  const handleSelectBook = (workId: string, segmentId?: string, searchQuery?: string) => {
    setActiveBookId(workId);
    setActiveSegmentId(segmentId);
    setLastSearchQuery(searchQuery);
    setView('reader');
  };

  const handleBackToLibrary = (resetToRoot = false) => {
    setView('library');
    setActiveBookId(null);
    setActiveSegmentId(undefined);
    // 觸發書庫重新整理（以防在閱讀器中做了一些變動）
    setBooksUpdatedTrigger(prev => prev + 1);
    if (resetToRoot) {
      setResetFolderTrigger(prev => prev + 1);
    }
  };

  if (!settings) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#150906' }}>
        <p>載入偏好設定中...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 💡 備源專用模式醒目提示橫幅 */}
      {sourceMode === 'backup' && (
        <div style={{
          background: 'linear-gradient(90deg, #7c2d12, #9a3412)',
          color: '#ffedd5',
          padding: '8px 16px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 9999,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡ <strong>備源檢索與下載專用模式</strong> (URL: ?source=backup) — 檢索與下載 100% 由備用鏡像庫提供</span>
          </div>
          <button 
            onClick={() => setSourceMode('primary', true)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
          >
            切換回 CBETA 官方主源 (?source=primary)
          </button>
        </div>
      )}

      <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
        {/* 💡 使用 CSS display 來控制 Library 顯示/隱藏，避免組件銷毀丟失當前資料夾路徑狀態 */}
        <div style={{ display: view === 'library' ? 'block' : 'none', width: '100%', height: '100%' }}>
          <Library 
            onSelectBook={handleSelectBook} 
            booksUpdatedTrigger={booksUpdatedTrigger}
            settings={settings}

            initialSearchQuery={lastSearchQuery}
            resetFolderTrigger={resetFolderTrigger}
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>

        {view === 'reader' && activeBookId && (
          <ReaderView 
            workId={activeBookId}
            initialSegmentId={activeSegmentId}
            settings={settings}
            onBackToLibrary={handleBackToLibrary}
            onSaveSettings={handleSaveSettings}
            searchQuery={lastSearchQuery}
          />
        )}
      </div>

      {/* 全域設定對話框 */}
      {showSettings && (
        <SettingsView 
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
