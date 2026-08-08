import { useState, useEffect } from 'react';
import { Library } from './reader/components/Library';
import { ReaderView } from './reader/components/ReaderView';
import { CbetaCatalogView } from './reader/components/CbetaCatalogView';
import { SettingsView } from './reader/components/SettingsView';
import { getSettings, saveSettings } from './utils/db';
import type { AppSettings } from './utils/db';
import { readingTimer, formatTimerMMSS } from './utils/readingTimer';
import type { ReadingTimerState } from './utils/readingTimer';
import './App.css';

export function App() {
  const [view, setView] = useState<'library' | 'cbeta' | 'reader'>('library');
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | undefined>(undefined);
  const [lastSearchQuery, setLastSearchQuery] = useState<string | undefined>(undefined);
  
  // 設定狀態
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [booksUpdatedTrigger, setBooksUpdatedTrigger] = useState(0);

  // 💡 全域閱讀計時器狀態
  const [timerState, setTimerState] = useState<ReadingTimerState>(readingTimer.getState());

  useEffect(() => {
    const unsubscribe = readingTimer.subscribe(setTimerState);
    return unsubscribe;
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
  const [autoResumeMode, setAutoResumeMode] = useState<'resume' | 'restart' | null>(null);

  const handleSelectBook = (workId: string, segmentId?: string, searchQuery?: string, autoResume?: 'resume' | 'restart') => {
    setActiveBookId(workId);
    setActiveSegmentId(segmentId);
    setLastSearchQuery(searchQuery);
    setAutoResumeMode(autoResume || null);
    setView('reader');
  };

  const handleBackToLibrary = (resetToRoot = false) => {
    setView('library');
    setActiveBookId(null);
    setActiveSegmentId(undefined);
    setAutoResumeMode(null);
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
    <div style={{ width: '100%', height: '100%' }}>
      {/* 💡 使用 CSS display 來控制 Library 顯示/隱藏，避免組件銷毀丟失當前資料夾路徑狀態 */}
      <div style={{ display: view === 'library' ? 'block' : 'none', width: '100%', height: '100%' }}>
        <Library 
          onSelectBook={handleSelectBook} 
          booksUpdatedTrigger={booksUpdatedTrigger}
          settings={settings}
          initialSearchQuery={lastSearchQuery}
          resetFolderTrigger={resetFolderTrigger}
          onOpenSettings={() => setShowSettings(true)}
          onOpenCbetaCatalog={() => setView('cbeta')}
        />
      </div>

      {view === 'cbeta' && (
        <CbetaCatalogView
          onBackToLibrary={() => {
            setView('library');
            setBooksUpdatedTrigger(prev => prev + 1);
          }}
          onOpenSettings={() => setShowSettings(true)}
          onSelectBook={handleSelectBook}
          settings={settings}
        />
      )}

      {view === 'reader' && activeBookId && (
        <ReaderView 
          workId={activeBookId}
          initialSegmentId={activeSegmentId}
          autoResumeMode={autoResumeMode}
          settings={settings}
          onBackToLibrary={handleBackToLibrary}
          onSaveSettings={handleSaveSettings}
          searchQuery={lastSearchQuery}
        />
      )}

      {/* 全域設定對話框 */}
      {showSettings && (
        <SettingsView 
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* 💡 全域閱讀時間「1 分鐘溫馨提醒 Modal (第一個對話框)」 */}
      {timerState.isWarningShown && timerState.remainingSeconds > 0 && (
        <div 
          className="reading-timer-modal-overlay animate-fade-in"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.2rem'
          }}
        >
          <div 
            className="reading-timer-card animate-slide-up"
            style={{
              backgroundColor: 'var(--reader-bg, #fcfaf2)',
              color: 'var(--reader-text, #2c221e)',
              border: '1.5px solid var(--theme-accent-border, rgba(140, 75, 39, 0.4))',
              borderRadius: '18px',
              padding: '1.8rem 1.5rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
              textAlign: 'center',
              fontFamily: 'var(--font-serif)'
            }}
          >
            <div style={{ fontSize: '2.4rem', marginBottom: '0.6rem' }}>🧘‍♂️</div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.6rem 0', color: 'var(--theme-accent, #8c4b27)' }}>
              閱讀時間即將到達（剩餘 {formatTimerMMSS(timerState.remainingSeconds)}）
            </h4>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--reader-text-muted, #555)', margin: '0 0 1.3rem 0' }}>
              您的閱讀時間即將到達，要適當休息一下，身體動一動，眼睛眨一眨…
            </p>

            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--reader-text-muted, #777)', marginBottom: '0.6rem', textAlign: 'left' }}>
              繼續閱讀：
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.2rem' }}>
              {([15, 30, 45, 60] as const).map(mins => (
                <button
                  key={`extend-${mins}`}
                  type="button"
                  onClick={() => readingTimer.extendTimer(mins)}
                  style={{
                    padding: '0.55rem 0',
                    border: '1px solid var(--theme-accent, #8c4b27)',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(140, 75, 39, 0.08)',
                    color: 'var(--theme-accent, #8c4b27)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  +{mins}分
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => readingTimer.chooseRestOnTime()}
              style={{
                width: '100%',
                padding: '0.65rem 0',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: 'var(--theme-accent, #8c4b27)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              時間到就休息
            </button>
          </div>
        </div>
      )}

      {/* 💡 全域閱讀時間「時間到黑幕 Modal (第二個對話框)」 */}
      {timerState.isTimeUpShown && (
        <div 
          className="reading-timer-modal-overlay animate-fade-in"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#0a0a0c',
            color: '#e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1.5rem'
          }}
        >
          <div 
            className="reading-timer-card animate-scale-up"
            style={{
              backgroundColor: '#18181b',
              color: '#f4f4f5',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '22px',
              padding: '2.4rem 1.8rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
              textAlign: 'center',
              fontFamily: 'var(--font-serif)'
            }}
          >
            <div style={{ fontSize: '3.2rem', marginBottom: '0.8rem' }}>🌙</div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.8rem 0', color: '#fbbf24' }}>
              時間到了，請適當休息
            </h3>
            <p style={{ fontSize: '0.92rem', lineHeight: 1.75, color: '#a1a1aa', margin: '0 0 1.6rem 0' }}>
              您已完成預定的閱讀時間。請放鬆雙眼，活動身心，常保健康。
            </p>

            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.6rem', textAlign: 'left' }}>
              繼續閱讀：
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '1.4rem' }}>
              {([15, 30, 45, 60] as const).map(mins => (
                <button
                  key={`restart-${mins}`}
                  type="button"
                  onClick={() => readingTimer.extendTimer(mins)}
                  style={{
                    padding: '0.6rem 0',
                    border: '1px solid #fbbf24',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(251, 191, 36, 0.12)',
                    color: '#fbbf24',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  +{mins}分
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => readingTimer.exitBlackout()}
              style={{
                width: '100%',
                padding: '0.75rem 0',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#3f3f46',
                color: '#fff',
                fontSize: '0.92rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              關閉並休息
            </button>
          </div>
        </div>
      )}

      {/* 💡 全黑幕純極簡 OLED 睡眠狀態 (已選擇時間到就休息、或第二對話框已 30 秒自動隱藏) */}
      {timerState.isBlackoutMode && !timerState.isTimeUpShown && (
        <div 
          className="reading-timer-modal-overlay animate-fade-in"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000000',
            color: '#777',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onClick={() => readingTimer.exitBlackout()}
        >
          <div style={{ fontSize: '3rem', opacity: 0.25, marginBottom: '1rem' }}>🌙</div>
          <div style={{ fontSize: '0.85rem', color: '#555', fontFamily: 'var(--font-serif)', letterSpacing: '1px' }}>
            閱讀時間已結束，休養身心
          </div>
          <div style={{ fontSize: '0.75rem', color: '#444', marginTop: '1.2rem', padding: '6px 14px', borderRadius: '20px', border: '1px solid #222' }}>
            點擊螢幕任意處恢復閱讀
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
