import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, Search, Plus, Settings, ChevronLeft, ChevronRight, 
  Folder, Clock, Heart, Notebook, Download, Check, Sparkles, 
  Edit3, Trash2, Play, PenTool, Menu, Layers, BookMarked, User, Calendar
} from 'lucide-react';
import '../styles/onboarding.css';

interface OnboardingViewProps {
  onComplete: () => void;
}

interface OnboardingStep {
  id: string;
  titleNode: React.ReactNode;
  desc: string;
}

/**
 * 點擊手勢圖標 (對齊用戶提供之深色圓潤粗邊線 + 指尖 5 道點擊光芒短線)
 */
function TouchHandPointerIcon({ size = 42 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="custom-pointer-svg"
    >
      {/* 5 道點擊放射光芒 (Click Radiance Burst Lines) */}
      <g className="click-rays" stroke="currentColor" strokeWidth="5.2" strokeLinecap="round">
        <line x1="20" y1="29" x2="28" y2="29" />
        <line x1="25" y1="16" x2="32" y2="23" />
        <line x1="39" y1="10" x2="39" y2="19" />
        <line x1="53" y1="16" x2="46" y2="23" />
        <line x1="58" y1="29" x2="50" y2="29" />
      </g>

      {/* 手勢主體 (白底 + 圓潤黑色粗描邊) */}
      <path
        d="M 34 32 C 34 26 44 26 44 32 L 44 42 C 44 39 52 39 52 44 L 52 48 C 52 45 60 45 60 50 L 60 54 C 60 51 68 51 68 56 C 68 70 63 80 52 83 L 45 83 C 36 83 31 78 28 72 L 23 65 C 19 60 23 53 29 57 L 34 61 Z"
        fill="#ffffff"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 手指蜷縮關節線 */}
      <path d="M 44 42 L 44 54" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M 52 48 L 52 58" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M 60 54 L 60 62" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function OnboardingView({ onComplete }: OnboardingViewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  // ----------------------------------------------------
  // Step 1 狀態：首頁1s -> 點下載佛典 -> 跳搜尋頁 -> 打字心經 -> 點放大鏡 -> 出現心經卡片 -> 點下載 -> 進入經文正文 (重複2次)
  // ----------------------------------------------------
  const [step1SubView, setStep1SubView] = useState<'home' | 'search-page' | 'reader-view'>('home');
  const [step1TypedQuery, setStep1TypedQuery] = useState('');
  const [step1SearchResultShown, setStep1SearchResultShown] = useState(false);
  const [step1Downloaded, setStep1Downloaded] = useState(false);
  const [step1CursorState, setStep1CursorState] = useState<'idle' | 'on-bar' | 'typing' | 'on-magnifier' | 'on-download-btn' | 'done'>('idle');

  useEffect(() => {
    if (currentStep !== 0) return;
    let isActive = true;
    let cycle = 0;

    const runStep1 = () => {
      if (!isActive) return;
      setStep1SubView('home');
      setStep1TypedQuery('');
      setStep1SearchResultShown(false);
      setStep1Downloaded(false);
      setStep1CursorState('idle');

      // 1. 首頁停留 1 秒
      setTimeout(() => {
        if (!isActive) return;
        // 2. 游標移動到「點此下載佛典」
        setStep1CursorState('on-bar');
        setTimeout(() => {
          if (!isActive) return;
          // 3. 跳至搜尋頁 (圖4)
          setStep1SubView('search-page');
          setStep1CursorState('typing');
          // 4. 打字「心」
          setTimeout(() => {
            if (!isActive) return;
            setStep1TypedQuery('心');
            setTimeout(() => {
              if (!isActive) return;
              setStep1TypedQuery('心經');
              // 5. 游標移動到放大鏡 (圖5)
              setTimeout(() => {
                if (!isActive) return;
                setStep1CursorState('on-magnifier');
                setTimeout(() => {
                  if (!isActive) return;
                  // 6. 出現心經卡片
                  setStep1SearchResultShown(true);
                  // 7. 游標移動到「下載」按鈕
                  setTimeout(() => {
                    if (!isActive) return;
                    setStep1CursorState('on-download-btn');
                    setTimeout(() => {
                      if (!isActive) return;
                      setStep1Downloaded(true);
                      // 8. 進入經文閱讀正文 (圖1)
                      setTimeout(() => {
                        if (!isActive) return;
                        setStep1SubView('reader-view');
                        setStep1CursorState('done');
                        if (cycle < 1) {
                          cycle++;
                          setTimeout(runStep1, 3000);
                        }
                      }, 1000);
                    }, 1000);
                  }, 1000);
                }, 1000);
              }, 1000);
            }, 600);
          }, 600);
        }, 1000);
      }, 1000);
    };

    runStep1();
    return () => { isActive = false; };
  }, [currentStep]);

  // ----------------------------------------------------
  // Step 2 狀態：示範「依類別查詢」，游標逐一點擊 5 個分類 Tab (圖2) (重複2次)
  // ----------------------------------------------------
  const [step2ActiveTab, setStep2ActiveTab] = useState<'featured' | 'bu' | 'ce' | 'author' | 'dynasty'>('featured');
  const [step2CursorTab, setStep2CursorTab] = useState<'featured' | 'bu' | 'ce' | 'author' | 'dynasty' | 'done'>('featured');

  useEffect(() => {
    if (currentStep !== 1) return;
    let isActive = true;
    let cycle = 0;

    const runStep2 = () => {
      if (!isActive) return;
      // 初始：停留在常用經典
      setStep2ActiveTab('featured');
      setStep2CursorTab('featured');

      // 1. 停留在「常用經典」1 秒後，游標滑向「依部類」
      setTimeout(() => {
        if (!isActive) return;
        setStep2CursorTab('bu'); // 游標先移動 (0.45s 位移)
        setTimeout(() => {
          if (!isActive) return;
          setStep2ActiveTab('bu'); // 游標到位後點擊，切換並展開「依部類」內容
          
          // 2. 停留在「依部類」1 秒後，游標滑向「依冊別」
          setTimeout(() => {
            if (!isActive) return;
            setStep2CursorTab('ce'); // 游標先移動
            setTimeout(() => {
              if (!isActive) return;
              setStep2ActiveTab('ce'); // 游標到位後點擊，切換並展開「依冊別」內容

              // 3. 停留在「依冊別」1 秒後，游標滑向「依作譯者」
              setTimeout(() => {
                if (!isActive) return;
                setStep2CursorTab('author'); // 游標先移動
                setTimeout(() => {
                  if (!isActive) return;
                  setStep2ActiveTab('author'); // 游標到位後點擊，切換並展開「依作譯者」內容

                  // 4. 停留在「依作譯者」1 秒後，游標滑向「依朝代」
                  setTimeout(() => {
                    if (!isActive) return;
                    setStep2CursorTab('dynasty'); // 游標先移動
                    setTimeout(() => {
                      if (!isActive) return;
                      setStep2ActiveTab('dynasty'); // 游標到位後點擊，切換並展開「依朝代」內容

                      // 5. 停留在「依朝代」1.2 秒後結束或重播
                      setTimeout(() => {
                        if (!isActive) return;
                        setStep2CursorTab('done');
                        if (cycle < 1) {
                          cycle++;
                          setTimeout(runStep2, 1800);
                        }
                      }, 1200);
                    }, 450);
                  }, 1000);
                }, 450);
              }, 1000);
            }, 450);
          }, 1000);
        }, 450);
      }, 1000);
    };

    runStep2();
    return () => { isActive = false; };
  }, [currentStep]);

  // ----------------------------------------------------
  // Step 3 狀態：4 個顏色模式 (各1秒) -> 點 A- 二次 -> 點 A+ 二次 (重複2次)
  // ----------------------------------------------------
  const [demoTheme, setDemoTheme] = useState<'ivory' | 'parchment' | 'comfort' | 'ebony'>('ivory');
  const [demoFontSize, setDemoFontSize] = useState<number>(16);
  const [step3CursorPos, setStep3CursorPos] = useState<'c-ivory' | 'c-parchment' | 'c-comfort' | 'c-ebony' | 'btn-minus' | 'btn-plus' | 'done'>('c-ivory');

  useEffect(() => {
    if (currentStep !== 2) return;
    let isActive = true;
    let cycle = 0;

    const runStep3 = () => {
      if (!isActive) return;
      setDemoTheme('ivory');
      setDemoFontSize(16);
      setStep3CursorPos('c-ivory');

      // 1. 停留在象牙白 1 秒後，游標滑向「羊皮紙」
      setTimeout(() => {
        if (!isActive) return;
        setStep3CursorPos('c-parchment');
        setTimeout(() => {
          if (!isActive) return;
          setDemoTheme('parchment');
          // 2. 停留在羊皮紙 1 秒後，游標滑向「護眼綠」
          setTimeout(() => {
            if (!isActive) return;
            setStep3CursorPos('c-comfort');
            setTimeout(() => {
              if (!isActive) return;
              setDemoTheme('comfort');
              // 3. 停留在護眼綠 1 秒後，游標滑向「烏木黑」
              setTimeout(() => {
                if (!isActive) return;
                setStep3CursorPos('c-ebony');
                setTimeout(() => {
                  if (!isActive) return;
                  setDemoTheme('ebony');
                  // 4. 停留在烏木黑 1 秒後，游標滑向「A-」
                  setTimeout(() => {
                    if (!isActive) return;
                    setStep3CursorPos('btn-minus');
                    setTimeout(() => {
                      if (!isActive) return;
                      setDemoFontSize(15);
                      // 5. 點 A- 第2次 (停1秒)
                      setTimeout(() => {
                        if (!isActive) return;
                        setDemoFontSize(14);
                        // 6. 游標滑向「A+」並點第1次
                        setTimeout(() => {
                          if (!isActive) return;
                          setStep3CursorPos('btn-plus');
                          setTimeout(() => {
                            if (!isActive) return;
                            setDemoFontSize(15);
                            // 7. 點 A+ 第2次 (停1秒)
                            setTimeout(() => {
                              if (!isActive) return;
                              setDemoFontSize(16);
                              // 8. 點 A+ 第3次 (停1秒)
                              setTimeout(() => {
                                if (!isActive) return;
                                setDemoFontSize(17);
                                // 9. 點 A+ 第4次 (停1秒)
                                setTimeout(() => {
                                  if (!isActive) return;
                                  setDemoFontSize(18);
                                  setStep3CursorPos('done');
                                  if (cycle < 1) {
                                    cycle++;
                                    setTimeout(runStep3, 2200);
                                  }
                                }, 1000);
                              }, 1000);
                            }, 1000);
                          }, 400);
                        }, 1000);
                      }, 1000);
                    }, 400);
                  }, 1000);
                }, 400);
              }, 1000);
            }, 400);
          }, 1000);
        }, 400);
      }, 1000);
    };

    runStep3();
    return () => { isActive = false; };
  }, [currentStep]);

  // ----------------------------------------------------
  // Step 4 狀態：慢速輸入文字感悟 -> 儲存修改 (重複2次)
  // ----------------------------------------------------
  const [step4ModalOpen, setStep4ModalOpen] = useState(false);
  const [step4NoteText, setStep4NoteText] = useState('');
  const [step4Saved, setStep4Saved] = useState(false);
  const [step4CursorPos, setStep4CursorPos] = useState<'idle' | 'btn-edit' | 'typing' | 'btn-save' | 'done'>('idle');

  const fullNoteText = "此是總標，此三句中有人有法，有因有果。觀自在菩薩，是能修般若法門者，行深…";

  useEffect(() => {
    if (currentStep !== 3) return;
    let isActive = true;
    let cycle = 0;

    const runStep4 = () => {
      if (!isActive) return;
      setStep4ModalOpen(false);
      setStep4NoteText('');
      setStep4Saved(false);
      setStep4CursorPos('idle');

      // 1. 停頓1秒後移到「編輯」按鈕
      setTimeout(() => {
        if (!isActive) return;
        setStep4CursorPos('btn-edit');
        setTimeout(() => {
          if (!isActive) return;
          // 2. 彈出編輯彈窗
          setStep4ModalOpen(true);
          setStep4CursorPos('typing');
          
          // 3. 慢速逐字打出感悟
          let charIdx = 0;
          const typingInterval = setInterval(() => {
            if (!isActive) { clearInterval(typingInterval); return; }
            charIdx += 2;
            setStep4NoteText(fullNoteText.slice(0, charIdx));
            if (charIdx >= fullNoteText.length) {
              clearInterval(typingInterval);
              setStep4NoteText(fullNoteText);
              // 4. 游標移到「儲存修改」按鈕
              setTimeout(() => {
                if (!isActive) return;
                setStep4CursorPos('btn-save');
                setTimeout(() => {
                  if (!isActive) return;
                  setStep4ModalOpen(false);
                  setStep4Saved(true);
                  setStep4CursorPos('done');
                  if (cycle < 1) {
                    cycle++;
                    setTimeout(runStep4, 2600);
                  }
                }, 1000);
              }, 1000);
            }
          }, 110);
        }, 1000);
      }, 1000);
    };

    runStep4();
    return () => { isActive = false; };
  }, [currentStep]);

  // ----------------------------------------------------
  // Step 5 狀態：站內書籍搜尋 -> 點頂部搜尋鍵 (圖3) -> 輸入「般若」 (圖4) -> 點放大鏡 -> 出現搜尋段落結果 (圖5) (重複2次)
  // ----------------------------------------------------
  const [step5SubView, setStep5SubView] = useState<'home' | 'input-page' | 'result-page'>('home');
  const [step5TypedQuery, setStep5TypedQuery] = useState('');
  const [step5CursorPos, setStep5CursorPos] = useState<'idle' | 'on-top-search' | 'typing' | 'on-magnifier' | 'done'>('idle');

  useEffect(() => {
    if (currentStep !== 4) return;
    let isActive = true;
    let cycle = 0;

    const runStep5 = () => {
      if (!isActive) return;
      setStep5SubView('home');
      setStep5TypedQuery('');
      setStep5CursorPos('idle');

      // 1. 首頁停留 1 秒
      setTimeout(() => {
        if (!isActive) return;
        // 2. 游標移動到頂部倒數第二個鍵 (🔍 站內搜尋按鈕，圖3)
        setStep5CursorPos('on-top-search');
        setTimeout(() => {
          if (!isActive) return;
          // 3. 進入站內搜尋頁 (圖4)
          setStep5SubView('input-page');
          setStep5CursorPos('typing');
          // 4. 慢速輸入「般若」
          setTimeout(() => {
            if (!isActive) return;
            setStep5TypedQuery('般');
            setTimeout(() => {
              if (!isActive) return;
              setStep5TypedQuery('般若');
              // 5. 游標移動到放大鏡
              setTimeout(() => {
                if (!isActive) return;
                setStep5CursorPos('on-magnifier');
                setTimeout(() => {
                  if (!isActive) return;
                  // 6. 出現站內搜尋 306 處結果頁面 (圖5)
                  setStep5SubView('result-page');
                  setStep5CursorPos('done');
                  if (cycle < 1) {
                    cycle++;
                    setTimeout(runStep5, 2600);
                  }
                }, 1000);
              }, 1000);
            }, 600);
          }, 600);
        }, 1000);
      }, 1000);
    };

    runStep5();
    return () => { isActive = false; };
  }, [currentStep]);

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // 鍵盤快捷鍵切換
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextStep();
      else if (e.key === 'ArrowLeft') prevStep();
      else if (e.key === 'Escape') onComplete();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  const touchStartYRef = useRef<number | null>(null);
  const touchEndYRef = useRef<number | null>(null);

  // 手機觸控左右滑動支援 (下一步 / 上一步)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
    touchStartYRef.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
    touchEndYRef.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null || touchEndXRef.current === null) return;
    const diffX = touchStartXRef.current - touchEndXRef.current;
    const diffY = (touchStartYRef.current !== null && touchEndYRef.current !== null)
      ? Math.abs(touchStartYRef.current - touchEndYRef.current)
      : 0;

    // 水平滑動距離大於 38px 且水平位移明顯大於垂直位移，判定為翻頁
    if (Math.abs(diffX) > 38 && Math.abs(diffX) > diffY) {
      if (diffX > 0) {
        // 向左滑動 -> 下一步
        nextStep();
      } else {
        // 向右滑動 -> 上一步
        prevStep();
      }
    }

    touchStartXRef.current = null;
    touchEndXRef.current = null;
    touchStartYRef.current = null;
    touchEndYRef.current = null;
  };

  // 5 個步驟標題與說明
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      titleNode: (
        <span>
          歡迎來到 <span className="onboarding-cbeta-brand">CBETA</span> <span className="onboarding-reader-brand">Reader</span>
        </span>
      ),
      desc: "以 CBETA 佛典資料庫為基礎，為您打造一個方便閱讀大藏經的數位小角落。"
    },
    {
      id: 'search',
      titleNode: <span>隨時隨地 搜尋下載</span>,
      desc: "可直接輸入關鍵字搜尋，或點選「依類別查詢」挑選常用經典一鍵下載。"
    },
    {
      id: 'customize',
      titleNode: <span>舒適閱讀 自由客製</span>,
      desc: "自訂文字大小不費力，內建 4 種背景模式與 4 種字體隨心切換。"
    },
    {
      id: 'highlights',
      titleNode: <span>畫下重點 抒發領悟</span>,
      desc: "隨手畫重點並寫下修行備註，獨立資料夾集中管理。支援匯出備份，精心筆記永不遺失。"
    },
    {
      id: 'internal-search',
      titleNode: <span>站內搜尋 深入經藏</span>,
      desc: "點擊上方搜尋鍵即可對已下載經文進行全文檢索，精準查找關鍵字段落。"
    }
  ];

  const current = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div 
      className="onboarding-overlay animate-fade-in"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 頂部跳過按鈕 */}
      <button 
        type="button"
        onClick={onComplete} 
        className="onboarding-skip-btn"
        title="跳過導覽，直接進入"
      >
        跳過
      </button>

      {/* 核心內容區 */}
      <div key={currentStep} className="onboarding-content-card onboarding-step-fade">
        
        {/* =========================================================================
            第 1 張：首頁等待1秒 -> 點下載佛典 -> 跳搜尋頁 -> 打字心經 -> 點放大鏡 -> 出現下載卡片 -> 點下載 -> 進入經文閱讀正文 (圖1)
           ========================================================================= */}
        {currentStep === 0 && (
          <div className="onboarding-device-mockup">
            <div className="onboarding-device-inner">
              {/* 頂部控制列 */}
              {step1SubView !== 'reader-view' ? (
                <div className="mock-topbar-row">
                  <div className="mock-topbar-left">
                    <div className="mock-home-btn active"><Home size={15} /></div>
                    <div className="mock-v-line" />
                    <div className="mock-plus-btn"><Plus size={18} strokeWidth={2.4} /></div>
                  </div>
                  <div className="mock-topbar-right">
                    <Search size={16} />
                    <Settings size={16} />
                  </div>
                </div>
              ) : (
                /* 閱讀頁頂部控制列 (圖 1) */
                <div className="mock-topbar-row mock-reader-topbar animate-fade-in">
                  <div className="mock-topbar-left">
                    <div className="mock-home-btn"><Home size={14} /></div>
                    <div className="mock-v-line" />
                    <ChevronLeft size={16} />
                    <div className="mock-tag-icon-btn"><span style={{ fontWeight: 800 }}>A</span></div>
                    <div className="mock-tag-icon-btn highlight-gold"><PenTool size={13} /></div>
                  </div>
                  <div className="mock-topbar-right">
                    <Search size={15} />
                    <Menu size={16} />
                    <Settings size={15} />
                  </div>
                </div>
              )}

              {step1SubView === 'home' && (
                /* 首頁狀態 */
                <div className="mock-home-view-wrap animate-fade-in">
                  <div className="mock-header-center">
                    <div className="mock-brand-title">
                      <span className="onboarding-cbeta-brand">CBETA</span> Reader
                    </div>
                    <div className="mock-brand-sub">淨心小角落 · 閱讀大藏經</div>
                  </div>

                  <div className="mock-system-grid-4">
                    <div className="mock-sys-card">
                      <div className="mock-sys-icon" style={{ backgroundColor: '#8c4b27' }}><Folder size={12} color="#fff" /></div>
                      <div className="mock-sys-title">我的書櫃</div>
                      <div className="mock-sys-count">0個資料夾</div>
                    </div>
                    <div className="mock-sys-card">
                      <div className="mock-sys-icon" style={{ backgroundColor: '#4a2c11' }}><Clock size={12} color="#fff" /></div>
                      <div className="mock-sys-title">近期閱讀</div>
                      <div className="mock-sys-count">0本經書</div>
                    </div>
                    <div className="mock-sys-card">
                      <div className="mock-sys-icon" style={{ backgroundColor: '#e53e3e' }}><Heart size={11} fill="#fff" color="#fff" /></div>
                      <div className="mock-sys-title">我的最愛</div>
                      <div className="mock-sys-count">0本經書</div>
                    </div>
                    <div className="mock-sys-card">
                      <div className="mock-sys-icon" style={{ backgroundColor: '#c07d2a' }}><Notebook size={12} color="#fff" /></div>
                      <div className="mock-sys-title">重點與筆記</div>
                      <div className="mock-sys-count">13條筆記</div>
                    </div>
                  </div>

                  {/* 點此下載佛典 */}
                  <div className={`mock-download-wide-bar ${step1CursorState === 'on-bar' ? 'highlight-active' : ''}`}>
                    <Plus size={16} strokeWidth={2.4} style={{ marginRight: '6px' }} />
                    <span>點此下載佛典</span>
                  </div>
                </div>
              )}

              {step1SubView === 'search-page' && (
                /* 搜尋頁狀態 */
                <div className="mock-catalog-view-wrap animate-fade-in">
                  <div className="mock-feature-box">
                    <div className="mock-box-header">
                      <span>— 搜尋 <span className="onboarding-cbeta-brand" style={{ fontSize: '0.85rem' }}>CBETA</span> 電子佛典</span>
                    </div>
                    <div className="mock-search-input-wrapper">
                      {step1TypedQuery ? (
                        <span className="mock-search-text-val">{step1TypedQuery}<span className="typing-caret" /></span>
                      ) : (
                        <span className="mock-placeholder-text">輸入關鍵字，例如：地藏、鳩摩羅什、T0235</span>
                      )}
                      {/* 右側放大鏡按鈕 */}
                      <span className={`mock-search-icon-btn-wrap ${step1CursorState === 'on-magnifier' ? 'btn-active-search' : ''}`}>
                        <Search size={16} className="mock-search-icon-btn" />
                      </span>
                    </div>
                    
                    {!step1SearchResultShown && (
                      <div className="mock-recent-search-row">
                        <span className="recent-label">近期搜尋：</span>
                        <span className="search-tag-chip">心經</span>
                      </div>
                    )}
                  </div>

                  {/* 點擊放大鏡後展示心經卡片 */}
                  {step1SearchResultShown ? (
                    <div className="mock-cbeta-book-card animate-slide-up" style={{ marginTop: '0.5rem' }}>
                      <div className="mock-book-tag">T0251</div>
                      <div className="mock-book-meta">
                        <div className="mock-book-name">般若波羅蜜多心經</div>
                        <div className="mock-book-byline">唐 玄奘</div>
                      </div>
                      <button type="button" className={`mock-download-icon-btn ${step1Downloaded ? 'success' : ''}`}>
                        {step1Downloaded ? <Check size={14} strokeWidth={3} /> : <Download size={14} />}
                      </button>
                    </div>
                  ) : (
                    <div className="mock-feature-box" style={{ marginTop: '0.4rem' }}>
                      <div className="mock-box-header">
                        <span>＋ 依類別查詢</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step1SubView === 'reader-view' && (
                /* 進入經文閱讀正文 (圖 1) */
                <div className="mock-scripture-reader-body animate-fade-in">
                  <div className="mock-reader-scripture-header">
                    <h1 className="mock-scripture-title">般若波羅蜜多心經</h1>
                    <div className="mock-scripture-author">唐 玄奘</div>
                  </div>
                  <div className="mock-scripture-no">No.251N</div>
                  <div className="mock-scripture-preface-title">大明太祖高皇帝御製般若心經序</div>
                  <p className="mock-scripture-text">
                    二儀久判，萬物備周，子民者君君，育民者法其法也。三綱五常以示天下，亦以五刑輔弼之。有等凶頑不循教者，往往有趨火赴淵之為，終不自省。是凶頑...
                  </p>
                </div>
              )}

              {/* 手部點擊游標 */}
              <div className={`touch-hand-cursor 
                ${step1CursorState === 'on-bar' ? 'pos-step1-bar' : ''} 
                ${step1CursorState === 'typing' ? 'pos-step1-input' : ''} 
                ${step1CursorState === 'on-magnifier' ? 'pos-step1-search-btn' : ''} 
                ${step1CursorState === 'on-download-btn' ? 'pos-step1-download-btn' : ''} 
                ${step1CursorState === 'idle' || step1CursorState === 'done' ? 'hidden' : ''}`
              }>
                <TouchHandPointerIcon />
                <span className="tap-ripple" />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            第 2 張：示範「依類別查詢」，游標逐一點擊 5 個分類 Tab (圖 2)
           ========================================================================= */}
        {currentStep === 1 && (
          <div className="onboarding-device-mockup">
            <div className="onboarding-device-inner">
              {/* 頂部導航列 */}
              <div className="mock-topbar-row">
                <div className="mock-topbar-left">
                  <div className="mock-home-btn"><Home size={15} /></div>
                  <div className="mock-v-line" />
                  <ChevronLeft size={16} className="mock-nav-arrow" />
                  <ChevronRight size={16} className="mock-nav-arrow" />
                </div>
                <div className="mock-topbar-right"><Settings size={16} /></div>
              </div>

              {/* 頂部收合搜尋區 */}
              <div className="mock-collapsed-header-row">
                <span>＋ 搜尋 <span className="onboarding-cbeta-brand" style={{ fontSize: '0.82rem' }}>CBETA</span> 電子佛典</span>
              </div>

              {/* 依類別查詢主要介面 (圖 2) */}
              <div className="mock-category-main-view">
                <div className="mock-box-header" style={{ marginBottom: '0.35rem' }}>
                  <span>— 依類別查詢</span>
                </div>

                {/* 5 個分類 Tab (圖 2 頂部五大類) */}
                <div className="mock-category-tab-strip-5">
                  <div className={`mock-cat-tab ${step2ActiveTab === 'featured' ? 'active' : ''}`} onClick={() => setStep2ActiveTab('featured')}>
                    <Heart size={10} fill={step2ActiveTab === 'featured' ? 'currentColor' : 'none'} />
                    <span>常用經典</span>
                  </div>
                  <div className={`mock-cat-tab ${step2ActiveTab === 'bu' ? 'active' : ''}`} onClick={() => setStep2ActiveTab('bu')}>
                    <Layers size={10} />
                    <span>依部類</span>
                  </div>
                  <div className={`mock-cat-tab ${step2ActiveTab === 'ce' ? 'active' : ''}`} onClick={() => setStep2ActiveTab('ce')}>
                    <BookMarked size={10} />
                    <span>依冊別</span>
                  </div>
                  <div className={`mock-cat-tab ${step2ActiveTab === 'author' ? 'active' : ''}`} onClick={() => setStep2ActiveTab('author')}>
                    <User size={10} />
                    <span>依作譯者</span>
                  </div>
                  <div className={`mock-cat-tab ${step2ActiveTab === 'dynasty' ? 'active' : ''}`} onClick={() => setStep2ActiveTab('dynasty')}>
                    <Calendar size={10} />
                    <span>依朝代</span>
                  </div>
                </div>

                {/* 分類內容容器 (圖 2) */}
                <div className="mock-category-body-container">
                  {step2ActiveTab === 'featured' && (
                    <div className="animate-fade-in">
                      <div className="mock-cat-sub-header">
                        <span className="cat-sub-title">常用經典</span>
                      </div>
                      <div className="mock-batch-bar">
                        <span className="batch-count-info">本層共有 12 本經典</span>
                        <div className="batch-actions-right">
                          <span className="batch-select-all">全選未下載</span>
                          <button type="button" className="batch-btn">
                            <Download size={10} /> 批量下載與收納 (0)
                          </button>
                        </div>
                      </div>

                      {/* 經書清單 (圖 2) */}
                      <div className="mock-book-list-scroll">
                        <div className="mock-cbeta-book-row">
                          <div className="mock-checkbox-box" />
                          <div className="mock-book-tag">T0779</div>
                          <div className="mock-book-meta">
                            <div className="mock-book-name">佛說八大人覺經</div>
                            <div className="mock-book-byline">東漢 安清</div>
                          </div>
                          <div className="mock-row-download-btn"><Download size={13} /></div>
                        </div>

                        <div className="mock-cbeta-book-row">
                          <div className="mock-checkbox-box" />
                          <div className="mock-book-tag">T0784</div>
                          <div className="mock-book-meta">
                            <div className="mock-book-name">四十二章經</div>
                            <div className="mock-book-byline">東漢 攝摩騰,竺法蘭</div>
                          </div>
                          <div className="mock-row-download-btn"><Download size={13} /></div>
                        </div>

                        <div className="mock-cbeta-book-row">
                          <div className="mock-checkbox-box" />
                          <div className="mock-book-tag">T0801</div>
                          <div className="mock-book-meta">
                            <div className="mock-book-name">佛說無常經</div>
                            <div className="mock-book-byline">唐 義淨</div>
                          </div>
                          <div className="mock-row-download-btn"><Download size={13} /></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step2ActiveTab === 'bu' && (
                    <div className="animate-fade-in mock-category-item-grid">
                      <div className="mock-cat-pill">📁 阿含部類 (151部)</div>
                      <div className="mock-cat-pill">📁 般若部類 (42部)</div>
                      <div className="mock-cat-pill">📁 法華部類 (16部)</div>
                      <div className="mock-cat-pill">📁 華嚴部類 (31部)</div>
                    </div>
                  )}

                  {step2ActiveTab === 'ce' && (
                    <div className="animate-fade-in mock-category-item-grid">
                      <div className="mock-cat-pill">📚 大正藏 T01~T85</div>
                      <div className="mock-cat-pill">📚 卍續藏 X01~X88</div>
                      <div className="mock-cat-pill">📚 嘉興藏 J01~J40</div>
                    </div>
                  )}

                  {step2ActiveTab === 'author' && (
                    <div className="animate-fade-in mock-category-item-grid">
                      <div className="mock-cat-pill">👤 唐 玄奘 (32部)</div>
                      <div className="mock-cat-pill">👤 後秦 鳩摩羅什 (28部)</div>
                      <div className="mock-cat-pill">👤 東晉 佛陀跋陀羅 (15部)</div>
                    </div>
                  )}

                  {step2ActiveTab === 'dynasty' && (
                    <div className="animate-fade-in mock-category-item-grid">
                      <div className="mock-cat-pill">🏛️ 唐代 (120部)</div>
                      <div className="mock-cat-pill">🏛️ 東漢 (12部)</div>
                      <div className="mock-cat-pill">🏛️ 宋代 (88部)</div>
                    </div>
                  )}
                </div>
              </div>

              {/* 手部點擊游標 (定位在 5 個分類 Tab 上) */}
              <div className={`touch-hand-cursor 
                ${step2CursorTab === 'featured' ? 'pos-cat-tab-1' : ''} 
                ${step2CursorTab === 'bu' ? 'pos-cat-tab-2' : ''} 
                ${step2CursorTab === 'ce' ? 'pos-cat-tab-3' : ''} 
                ${step2CursorTab === 'author' ? 'pos-cat-tab-4' : ''} 
                ${step2CursorTab === 'dynasty' ? 'pos-cat-tab-5' : ''} 
                ${step2CursorTab === 'done' ? 'hidden' : ''}`
              }>
                <TouchHandPointerIcon />
                <span className="tap-ripple" />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            第 3 張：依序由左至右按4個模式顏色 (各1秒) -> 點 A- 2次 -> 點 A+ 2次
           ========================================================================= */}
        {currentStep === 2 && (
          <div className="onboarding-device-mockup">
            <div className={`onboarding-device-inner mock-reader-frame theme-${demoTheme}`}>
              <div className="mock-reader-body" style={{ fontSize: `${demoFontSize}px` }}>
                <p className="mock-reader-para">
                  「觀自在菩薩，行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。」
                </p>
              </div>

              {/* 主題與字體控制面板 */}
              <div className="mock-reader-controls-bar">
                <div className="mock-theme-swatches">
                  {[
                    { id: 'ivory', bg: '#fefcf8', name: '象牙白' },
                    { id: 'parchment', bg: '#f5eee0', name: '羊皮紙' },
                    { id: 'comfort', bg: '#ecf3e2', name: '護眼綠' },
                    { id: 'ebony', bg: '#12161a', name: '烏木黑' }
                  ].map(t => (
                    <div 
                      key={t.id}
                      className={`mock-theme-dot ${demoTheme === t.id ? 'active' : ''}`}
                      style={{ backgroundColor: t.bg }}
                      onClick={() => setDemoTheme(t.id as any)}
                    >
                      {demoTheme === t.id && <Check size={11} color={t.id === 'ebony' ? '#ffffff' : '#000000'} strokeWidth={3} />}
                    </div>
                  ))}
                </div>

                <div className="mock-font-controls">
                  <button type="button" className={step3CursorPos === 'btn-minus' ? 'btn-active-tap' : ''}>A-</button>
                  <span className="mock-font-size-text">{demoFontSize}px</span>
                  <button type="button" className={step3CursorPos === 'btn-plus' ? 'btn-active-tap' : ''}>A+</button>
                </div>
              </div>

              {/* 手部點擊游標 */}
              <div className={`touch-hand-cursor 
                ${step3CursorPos === 'c-ivory' ? 'pos-theme-ivory' : ''} 
                ${step3CursorPos === 'c-parchment' ? 'pos-theme-parchment' : ''} 
                ${step3CursorPos === 'c-comfort' ? 'pos-theme-comfort' : ''} 
                ${step3CursorPos === 'c-ebony' ? 'pos-theme-ebony' : ''} 
                ${step3CursorPos === 'btn-minus' ? 'pos-font-minus' : ''} 
                ${step3CursorPos === 'btn-plus' ? 'pos-font-plus' : ''} 
                ${step3CursorPos === 'done' ? 'hidden' : ''}`
              }>
                <TouchHandPointerIcon />
                <span className="tap-ripple" />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            第 4 張：點「編輯」(圖2) -> 彈出(圖3) -> 慢速打字(圖4) -> 點「儲存修改」-> (圖5)
           ========================================================================= */}
        {currentStep === 3 && (
          <div className="onboarding-device-mockup">
            <div className="onboarding-device-inner">
              {/* 頂部導航 */}
              <div className="mock-topbar-row">
                <div className="mock-topbar-left">
                  <div className="mock-home-btn"><Home size={15} /></div>
                  <div className="mock-v-line" />
                  <ChevronLeft size={16} className="mock-nav-arrow" />
                  <ChevronRight size={16} className="mock-nav-arrow" />
                </div>
                <div className="mock-topbar-right"><Search size={16} /><Settings size={16} /></div>
              </div>

              {/* 重點與筆記卡片 (圖 2 & 圖 5) */}
              <div className="mock-notes-container-view">
                <div className="mock-notes-folder-banner">
                  <Notebook size={14} color="#c07d2a" style={{ marginRight: '6px' }} />
                  <span>重點與筆記</span>
                </div>

                <div className="mock-note-entry-card">
                  <div className="mock-entry-header">
                    <div className="entry-title-left">
                      <span className="minus-icon">-</span>
                      <span className="work-name">般若波羅蜜多心經，T0251</span>
                    </div>
                    <span className="count-label">1 條重點</span>
                  </div>

                  <div className="mock-entry-body">
                    <div className="entry-meta-row">
                      <span>第 1 卷</span>
                      <span>2026/8/18</span>
                    </div>
                    <div className="entry-quote-text">
                      「觀自在菩薩行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。」
                    </div>

                    {/* 已儲存修改時顯示筆記 (圖 5) */}
                    {step4Saved && (
                      <div className="mock-saved-note-callout animate-slide-up">
                        <div className="note-body-text">{fullNoteText}</div>
                      </div>
                    )}

                    <div className="entry-action-buttons">
                      <span className="action-link"><Play size={10} fill="currentColor" /> 跳至經文</span>
                      <span className={`action-link ${step4CursorPos === 'btn-edit' ? 'highlight-active' : ''}`}><Edit3 size={11} /> 編輯</span>
                      <span className="action-link"><Trash2 size={11} /></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 編輯感悟筆記彈窗 (圖 3 & 圖 4) */}
              {step4ModalOpen && (
                <div className="mock-dialog-overlay animate-fade-in">
                  <div className="mock-note-dialog-box animate-scale-up">
                    <div className="mock-dialog-title">
                      <span>📝 編輯感悟筆記</span>
                      <span className="dialog-close-x">✕</span>
                    </div>

                    <div className="mock-dialog-quote">
                      「觀自在菩薩行深般若波羅蜜多時，照見五蘊皆空，度一切苦厄。」
                    </div>

                    <div className="mock-dialog-textarea-box">
                      {step4NoteText ? (
                        <div className="dialog-entered-text">{step4NoteText}<span className="typing-caret" /></div>
                      ) : (
                        <div className="dialog-placeholder-text">| 寫下您對此句經文的感悟或讀後心得...</div>
                      )}
                    </div>

                    <div className="mock-dialog-actions-row">
                      <button type="button" className={`dialog-save-btn ${step4CursorPos === 'btn-save' ? 'active-tap' : ''}`}>儲存修改</button>
                      <button type="button" className="dialog-cancel-btn">取消</button>
                    </div>
                  </div>
                </div>
              )}

              {/* 手部點擊游標 */}
              <div className={`touch-hand-cursor 
                ${step4CursorPos === 'btn-edit' ? 'pos-step4-edit' : ''} 
                ${step4CursorPos === 'btn-save' ? 'pos-step4-save' : ''} 
                ${step4CursorPos === 'idle' || step4CursorPos === 'typing' || step4CursorPos === 'done' ? 'hidden' : ''}`
              }>
                <TouchHandPointerIcon />
                <span className="tap-ripple" />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            第 5 張：站內書籍關鍵字搜尋 -> 點頂部搜尋鍵 (圖 3) -> 輸入「般若」 (圖 4) -> 點放大鏡 -> 出現 306 處搜尋段落 (圖 5)
           ========================================================================= */}
        {currentStep === 4 && (
          <div className="onboarding-device-mockup">
            <div className="onboarding-device-inner">
              {/* 頂部導覽列 (圖 3) */}
              <div className="mock-topbar-row">
                <div className="mock-topbar-left">
                  <div className="mock-home-btn active"><Home size={15} /></div>
                  <div className="mock-v-line" />
                  <div className="mock-plus-btn"><Plus size={18} strokeWidth={2.4} /></div>
                </div>
                <div className="mock-topbar-right">
                  {/* 倒數第二個鍵：🔍 站內搜尋按鈕 (圖 3) */}
                  <span className={`mock-top-search-btn ${step5CursorPos === 'on-top-search' ? 'active-tap' : ''}`}>
                    <Search size={16} />
                  </span>
                  <Settings size={16} />
                </div>
              </div>

              {step5SubView === 'home' && (
                /* 首頁停留狀態 */
                <div className="mock-home-view-wrap animate-fade-in">
                  <div className="mock-header-center">
                    <div className="mock-brand-title">
                      <span className="onboarding-cbeta-brand">CBETA</span> Reader
                    </div>
                    <div className="mock-brand-sub">淨心小角落 · 閱讀大藏經</div>
                  </div>

                  <div className="mock-system-grid-4">
                    <div className="mock-sys-card">
                      <div className="mock-sys-icon" style={{ backgroundColor: '#8c4b27' }}><Folder size={12} color="#fff" /></div>
                      <div className="mock-sys-title">我的書櫃</div>
                      <div className="mock-sys-count">0個資料夾</div>
                    </div>
                    <div className="mock-sys-card">
                      <div className="mock-sys-icon" style={{ backgroundColor: '#4a2c11' }}><Clock size={12} color="#fff" /></div>
                      <div className="mock-sys-title">近期閱讀</div>
                      <div className="mock-sys-count">8本經書</div>
                    </div>
                    <div className="mock-sys-card">
                      <div className="mock-sys-icon" style={{ backgroundColor: '#e53e3e' }}><Heart size={11} fill="#fff" color="#fff" /></div>
                      <div className="mock-sys-title">我的最愛</div>
                      <div className="mock-sys-count">0本經書</div>
                    </div>
                    <div className="mock-sys-card">
                      <div className="mock-sys-icon" style={{ backgroundColor: '#c07d2a' }}><Notebook size={12} color="#fff" /></div>
                      <div className="mock-sys-title">重點與筆記</div>
                      <div className="mock-sys-count">21條筆記</div>
                    </div>
                  </div>
                </div>
              )}

              {step5SubView === 'input-page' && (
                /* 站內搜尋輸入頁 (圖 4) */
                <div className="mock-internal-search-input-view animate-fade-in">
                  <div className="mock-internal-input-box">
                    {step5TypedQuery ? (
                      <span className="mock-search-text-val">{step5TypedQuery}<span className="typing-caret" /></span>
                    ) : (
                      <span className="mock-placeholder-text">輸入多個關鍵字，例如：地藏</span>
                    )}
                    <Search size={16} className="mock-internal-search-icon" />
                  </div>
                  <div className="mock-internal-sub-hint">站內已下載書籍檢索</div>
                </div>
              )}

              {step5SubView === 'result-page' && (
                /* 站內搜尋結果頁 (圖 5) */
                <div className="mock-internal-results-view animate-fade-in">
                  <div className="mock-internal-input-box" style={{ marginBottom: '0.35rem' }}>
                    <span className="mock-search-text-val">般若</span>
                    <Search size={16} className="mock-internal-search-icon" />
                  </div>
                  <div className="mock-internal-sub-hint" style={{ marginBottom: '0.4rem' }}>站內已下載書籍檢索</div>

                  <div className="mock-results-summary-line">
                    共搜尋到 <strong>306</strong> 處符合的經文段落
                  </div>

                  {/* 經書結果分頁 Chips (圖 5) */}
                  <div className="mock-results-chips-wrap">
                    <span className="mock-result-chip">全部 (306)</span>
                    <span className="mock-result-chip">六度集經 (3)</span>
                    <span className="mock-result-chip">般若波羅蜜多心經 (8)</span>
                    <span className="mock-result-chip">地藏菩薩本願經 (1)</span>
                    <span className="mock-result-chip active">般若經講記 (146)</span>
                    <span className="mock-result-chip">華雨集 (一) (87)</span>
                    <span className="mock-result-chip">成佛之道 (增注本) (61)</span>
                  </div>

                  {/* 搜尋引文卡片清單 (圖 5) */}
                  <div className="mock-search-snippets-scroll">
                    <div className="mock-snippet-card">
                      <div className="snippet-head">
                        <span className="snippet-work-title">般若經講記</span>
                        <span className="snippet-vol-badge">第 1 卷 ·《妙雲集》序目</span>
                      </div>
                      <div className="snippet-text">
                        ...「上編」，是經論的解說。已經整理出版的，共有八部，現編為七冊：一、《<mark className="match-highlight">般若</mark>經講記》，這包含了《金剛經》及《心經》的兩部講記；...
                      </div>
                    </div>

                    <div className="mock-snippet-card">
                      <div className="snippet-head">
                        <span className="snippet-work-title">般若經講記</span>
                        <span className="snippet-vol-badge">第 1 卷 ·《妙雲集》序目</span>
                      </div>
                      <div className="snippet-text">
                        ·上 編一 <mark className="match-highlight">般若</mark>經講記 1 金剛<mark className="match-highlight">般若</mark>波羅蜜經講記 2 <mark className="match-highlight">般若</mark>波羅蜜多心經講記二 寶積經講記三 勝鬘經講記四 藥師經講記五 中...
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 手部點擊游標 */}
              <div className={`touch-hand-cursor 
                ${step5CursorPos === 'on-top-search' ? 'pos-top-search-btn' : ''} 
                ${step5CursorPos === 'typing' ? 'pos-step5-input' : ''} 
                ${step5CursorPos === 'on-magnifier' ? 'pos-step5-magnifier' : ''} 
                ${step5CursorPos === 'idle' || step5CursorPos === 'done' ? 'hidden' : ''}`
              }>
                <TouchHandPointerIcon />
                <span className="tap-ripple" />
              </div>
            </div>
          </div>
        )}

        {/* 標題與說明文字 */}
        <h2 className="onboarding-title">{current.titleNode}</h2>
        <p className="onboarding-desc">{current.desc}</p>
      </div>

      {/* 進度條指示器 */}
      <div className="onboarding-indicators">
        {steps.map((_, index) => (
          <div 
            key={index} 
            onClick={() => setCurrentStep(index)}
            className={`onboarding-dot ${index === currentStep ? 'active' : 'inactive'}`}
            title={`前往第 ${index + 1} 步`}
          />
        ))}
      </div>

      {/* 按鈕控制區 */}
      <div className="onboarding-actions">
        {currentStep > 0 && (
          <button 
            type="button"
            onClick={prevStep} 
            className="onboarding-btn onboarding-btn-prev"
          >
            <ChevronLeft size={18} />
            <span>上一步</span>
          </button>
        )}

        <button 
          type="button"
          onClick={nextStep} 
          className="onboarding-btn onboarding-btn-next"
        >
          <span>{isLastStep ? '開始閱讀之旅' : '下一步'}</span>
          {isLastStep ? <Sparkles size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  );
}
