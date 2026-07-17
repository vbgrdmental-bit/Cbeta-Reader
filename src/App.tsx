import { useState, useEffect } from 'react';
import { Library } from './reader/components/Library';
import { ReaderView } from './reader/components/ReaderView';
import { SettingsView } from './reader/components/SettingsView';
import { getSettings, saveSettings } from './utils/db';
import type { AppSettings } from './utils/db';
import './App.css';

export function App() {
  const [view, setView] = useState<'library' | 'reader'>('library');
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | undefined>(undefined);
  const [lastSearchQuery, setLastSearchQuery] = useState<string | undefined>(undefined);
  
  // 設定狀態
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [booksUpdatedTrigger, setBooksUpdatedTrigger] = useState(0);

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

  const handleSelectBook = (workId: string, segmentId?: string, searchQuery?: string) => {
    setActiveBookId(workId);
    setActiveSegmentId(segmentId);
    setLastSearchQuery(searchQuery);
    setView('reader');
  };

  const handleBackToLibrary = () => {
    setView('library');
    setActiveBookId(null);
    setActiveSegmentId(undefined);
    // 觸發書庫重新整理（以防在閱讀器中做了一些變動）
    setBooksUpdatedTrigger(prev => prev + 1);
  };

  if (!settings) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#150906' }}>
        <p>載入偏好設定中...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {view === 'library' ? (
        <Library 
          onSelectBook={handleSelectBook} 
          booksUpdatedTrigger={booksUpdatedTrigger}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          initialSearchQuery={lastSearchQuery}
        />
      ) : (
        activeBookId && (
          <ReaderView 
            workId={activeBookId}
            initialSegmentId={activeSegmentId}
            settings={settings}
            onBackToLibrary={handleBackToLibrary}
            onSaveSettings={handleSaveSettings}
            searchQuery={lastSearchQuery}
          />
        )
      )}

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
