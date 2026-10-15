import React, { useState, useEffect } from 'react';
import {
  getAllPracticeLogs,
  savePracticeLog,
  type PracticeLogEntry,
  type PracticeCategoryConfig,
  getPracticeCategories
} from '../../../utils/db';

export interface CounterBeadsWidgetProps {
  isLayoutEditMode?: boolean;
}

/**
 * 取得本地日期字串 "YYYY-MM-DD"
 */
function getLocalDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * CounterBeadsWidget - 4x1 隨喜撥珠/念佛誦經計數小卡
 * 特色：
 * 1. 大類與中類選單，清晰向量箭頭
 * 2. 木魚圓形按鈕，敲擊浮現 +1 動畫
 * 3. 獨立持久化於 IndexedDB 與 localStorage
 */
export function CounterBeadsWidget({ isLayoutEditMode = false }: CounterBeadsWidgetProps) {
  const [practiceCategories, setPracticeCategories] = useState<Record<string, PracticeCategoryConfig>>(() => {
    return getPracticeCategories();
  });
  const [beadCategory, setBeadCategory] = useState<string>(() => {
    return localStorage.getItem('cbeta_home_bead_cat') || 'fo';
  });
  const [beadName, setBeadName] = useState<string>(() => {
    return localStorage.getItem('cbeta_home_bead_name') || '南無阿彌陀佛';
  });
  const [todayPracticeLogs, setTodayPracticeLogs] = useState<PracticeLogEntry[]>([]);
  const [showBeadCatMenu, setShowBeadCatMenu] = useState(false);
  const [showBeadMidMenu, setShowBeadMidMenu] = useState(false);
  const [beadTapAnim, setBeadTapAnim] = useState(false);

  const refreshPracticeLogs = () => {
    getAllPracticeLogs().then(pLogs => {
      const todayStr = getLocalDateStr();
      const todayP = (pLogs || []).filter(p => p.date === todayStr);
      setTodayPracticeLogs(todayP);
    }).catch(err => {
      console.warn('Failed to load practice logs for widget', err);
    });
  };

  useEffect(() => {
    refreshPracticeLogs();
    const handlePracticeUpdate = () => refreshPracticeLogs();
    const handleCatsChanged = (e: any) => {
      const cats = e.detail || getPracticeCategories();
      setPracticeCategories(cats);
    };
    window.addEventListener('cbeta_practice_log_saved', handlePracticeUpdate);
    window.addEventListener('cbeta-practice-categories-changed', handleCatsChanged);
    return () => {
      window.removeEventListener('cbeta_practice_log_saved', handlePracticeUpdate);
      window.removeEventListener('cbeta-practice-categories-changed', handleCatsChanged);
    };
  }, []);

  const handleSelectBeadCategory = (cat: string) => {
    setBeadCategory(cat);
    localStorage.setItem('cbeta_home_bead_cat', cat);
    setShowBeadCatMenu(false);
    const catItems = practiceCategories[cat]?.items || [];
    if (catItems.length > 0) {
      setBeadName(catItems[0]);
      localStorage.setItem('cbeta_home_bead_name', catItems[0]);
    }
  };

  const handleSelectBeadName = (name: string) => {
    setBeadName(name);
    localStorage.setItem('cbeta_home_bead_name', name);
    setShowBeadMidMenu(false);
  };

  const handleHomeBeadTap = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBeadTapAnim(true);
    setTimeout(() => setBeadTapAnim(false), 600);
    const todayStr = getLocalDateStr();
    const existing = todayPracticeLogs.find(p => p.name === beadName);
    const currentCount = existing ? existing.count : 0;
    const newCount = currentCount + 1;
    let unit = practiceCategories[beadCategory]?.unit || '聲';
    if (beadName === '禮佛大拜') unit = '拜';
    if (beadName === '靜坐禪修') unit = '分鐘';

    const entry: PracticeLogEntry = {
      id: existing ? existing.id : 'p_' + Date.now(),
      date: todayStr,
      timestamp: Date.now(),
      category: beadCategory,
      name: beadName,
      count: newCount,
      unit
    };

    try {
      await savePracticeLog(entry);
      setTodayPracticeLogs(prev => {
        const idx = prev.findIndex(p => p.name === beadName);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = entry;
          return next;
        }
        return [entry, ...prev];
      });
      window.dispatchEvent(new CustomEvent('cbeta_practice_log_saved'));
    } catch (err) {
      console.error('Failed to save bead count:', err);
    }
  };

  const existing = todayPracticeLogs.find(p => p.name === beadName);
  const todayCount = existing ? existing.count : 0;
  let unit = practiceCategories[beadCategory]?.unit || '聲';
  if (beadName === '禮佛大拜') unit = '拜';
  if (beadName === '靜坐禪修') unit = '分鐘';

  return (
    <div 
      className="home-practice-bead-widget-4x1" 
      style={{ position: 'relative', cursor: isLayoutEditMode ? 'default' : 'pointer' }}
      onClick={!isLayoutEditMode ? (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.bead-combo-capsule') || target.closest('.dropdown-menu-box')) {
          return;
        }
        handleHomeBeadTap(e);
      } : undefined}
    >
      {/* 1. 左側區塊：大類與中類二合一綜合膠囊 */}
      <div className="bead-combo-capsule">
        {/* 大類子按鈕 */}
        <div 
          className="combo-part-cat"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            if (isLayoutEditMode) return;
            e.stopPropagation();
            setShowBeadMidMenu(false);
            setShowBeadCatMenu(prev => !prev);
          }}
          onClick={!isLayoutEditMode ? (e) => {
            e.stopPropagation();
            setShowBeadMidMenu(false);
            setShowBeadCatMenu(prev => !prev);
          } : undefined}
          title="點擊切換大類"
        >
          <span className="combo-cat-name">{practiceCategories[beadCategory]?.name || '佛號'}</span>
          <svg className="combo-arrow-down" width="8" height="6" viewBox="0 0 8 6" fill="currentColor" aria-hidden="true">
            <path d="M0 1.5L4 5.5L8 1.5H0Z" />
          </svg>
        </div>

        {/* 中間分割線 */}
        <div className="combo-divider" />

        {/* 中類子按鈕 */}
        <div 
          className="combo-part-mid"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => {
            if (isLayoutEditMode) return;
            e.stopPropagation();
            setShowBeadCatMenu(false);
            setShowBeadMidMenu(prev => !prev);
          }}
          onClick={!isLayoutEditMode ? (e) => {
            e.stopPropagation();
            setShowBeadCatMenu(false);
            setShowBeadMidMenu(prev => !prev);
          } : undefined}
          title="點擊切換項目"
        >
          <span className="combo-mid-name">{beadName}</span>
          <svg className="combo-arrow-down" width="8" height="6" viewBox="0 0 8 6" fill="currentColor" aria-hidden="true">
            <path d="M0 1.5L4 5.5L8 1.5H0Z" />
          </svg>
        </div>
      </div>

      {/* 2. 右側區塊：今日次數 + 敲木魚按鈕 */}
      <div className="bead-action-island" title={`今日已念 ${todayCount} ${unit}`}>
        <div className="bead-island-count">
          <span className="bead-island-num">{todayCount.toLocaleString()}</span>
        </div>

        {/* 圓形敲木魚按鈕 */}
        <button 
          type="button"
          className={`home-bead-tap-btn ${beadTapAnim ? 'tapped' : ''}`}
          title="敲木魚誦念 (+1)"
          onClick={!isLayoutEditMode ? handleHomeBeadTap : undefined}
        >
          <svg className="bead-muyu-svg" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <linearGradient id="muyu_bg_grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#cce1d2" />
                <stop offset="100%" stopColor="#accfb8" />
              </linearGradient>
              <linearGradient id="muyu_wood_body" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#a36e4b" />
                <stop offset="100%" stopColor="#7a4625" />
              </linearGradient>
            </defs>

            {/* 圓形淡綠底色 */}
            <circle cx="50" cy="50" r="47" fill="url(#muyu_bg_grad)" stroke="#ffffff" strokeWidth="2.5" />

            {/* 敲擊音浪 */}
            <line x1="65" y1="33" x2="69" y2="19" stroke="#e69627" strokeWidth="3.6" strokeLinecap="round" />
            <line x1="77" y1="36" x2="88" y2="26" stroke="#e69627" strokeWidth="3.6" strokeLinecap="round" />

            {/* 木魚厚圓底座 */}
            <rect x="22" y="65" width="46" height="13" rx="6.5" fill="#583015" stroke="#361a0a" strokeWidth="2.4" />

            {/* 木魚主身 */}
            <path d="M 23 66 C 22 41 33 28 45 28 C 57 28 69 41 68 66 Z" fill="url(#muyu_wood_body)" stroke="#361a0a" strokeWidth="2.4" />

            {/* 木魚高光 */}
            <ellipse cx="53" cy="37" rx="4.5" ry="2.6" transform="rotate(-20 53 37)" fill="#ffffff" opacity="0.4" />

            {/* 木魚開口橫縫 */}
            <path d="M 27 61 C 37 47 53 49 63 56 C 61 60 45 53 29 63 Z" fill="#301607" stroke="#301607" strokeWidth="0.8" strokeLinejoin="round" />

            {/* 木魚槌手柄 */}
            <line x1="73" y1="51" x2="90" y2="76" stroke="#6e3914" strokeWidth="5.5" strokeLinecap="round" />

            {/* 木魚槌頭 */}
            <circle cx="72" cy="49" r="7.5" fill="#fdfaf2" stroke="#361a0a" strokeWidth="2.2" />
            <circle cx="70" cy="47" r="2.2" fill="#ffffff" />
          </svg>

          {/* 點擊浮現 +1 動畫 */}
          {beadTapAnim && <span className="bead-tap-plus-one">+1</span>}
        </button>
      </div>

      {/* 全螢幕背景遮罩 */}
      {(showBeadCatMenu || showBeadMidMenu) && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
            backgroundColor: 'transparent'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowBeadCatMenu(false);
            setShowBeadMidMenu(false);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            setShowBeadCatMenu(false);
            setShowBeadMidMenu(false);
          }}
        />
      )}

      {/* 大類下拉選單 */}
      {showBeadCatMenu && (
        <div className="dropdown-menu-box active bead-cat-dropdown" onClick={e => e.stopPropagation()}>
          {Object.keys(practiceCategories).map(catKey => {
            const cat = practiceCategories[catKey];
            return (
              <div 
                key={catKey}
                className={`dropdown-item ${beadCategory === catKey ? 'active' : ''}`}
                onClick={() => handleSelectBeadCategory(catKey)}
              >
                <span>{cat.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 中類下拉選單 */}
      {showBeadMidMenu && (
        <div className="dropdown-menu-box active bead-mid-dropdown" onClick={e => e.stopPropagation()}>
          {(practiceCategories[beadCategory]?.items || []).length === 0 ? (
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', padding: '6px 12px', textAlign: 'center' }}>
              尚無項目
            </div>
          ) : (
            (practiceCategories[beadCategory]?.items || []).map(item => (
              <div
                key={item}
                className={`dropdown-item ${beadName === item ? 'active' : ''}`}
                onClick={() => handleSelectBeadName(item)}
              >
                <span>{item}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
