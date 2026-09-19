import { useState, useMemo } from 'react';
import { 
  Folder, Heart, Clock, Download, ChevronRight, ChevronDown, 
  Sparkles, Grid, List
} from 'lucide-react';
import type { BookMetadata } from '../../types/book';

interface BookshelfInteractivePlaygroundProps {
  downloadedBooks: BookMetadata[];
  favoriteWorkIds: string[];
  recentReadsBooks: BookMetadata[];
  onSelectBook: (workId: string) => void;
  onExitDemo?: () => void;
}

// 💡 120 部正統 CBETA 大藏經海量模擬經典資料庫 (涵蓋阿含、般若、法華、華嚴、本生、密教、論疏)
const SIMULATED_120_BOOKS: BookMetadata[] = [
  // 法華部
  { workId: 'T0262', title: '妙法蓮華經', canon: 'T', creators: '後秦 鳩摩羅什譯', juansCount: 7, category: '法華部', cjkChars: 69430 },
  { workId: 'T0263', title: '正法華經', canon: 'T', creators: '西晉 竺法護譯', juansCount: 10, category: '法華部', cjkChars: 93420 },
  { workId: 'T0264', title: '添品妙法蓮華經', canon: 'T', creators: '隋 闍那崛多等譯', juansCount: 7, category: '法華部', cjkChars: 72100 },
  { workId: 'T0277', title: '無量義經', canon: 'T', creators: '蕭齊 曇摩伽陀耶舍譯', juansCount: 1, category: '法華部', cjkChars: 9680 },
  { workId: 'T0278', title: '觀普賢菩薩行法經', canon: 'T', creators: '劉宋 曇無蜜多譯', juansCount: 1, category: '法華部', cjkChars: 8750 },

  // 地藏 / 本生部
  { workId: 'T0412', title: '地藏菩薩本願經', canon: 'T', creators: '唐 實叉難陀譯', juansCount: 2, category: '本生部', cjkChars: 17200 },
  { workId: 'T0411', title: '大乘大集地藏十輪經', canon: 'T', creators: '唐 玄奘譯', juansCount: 10, category: '大集部', cjkChars: 85300 },
  { workId: 'T0839', title: '占察善惡業報經', canon: 'T', creators: '隋 菩提燈譯', juansCount: 2, category: '經集部', cjkChars: 18900 },
  { workId: 'X1487', title: '慈悲地藏菩薩懺法', canon: 'X', creators: '清 知源等述', juansCount: 3, category: '懺儀部', cjkChars: 24100 },

  // 般若部
  { workId: 'T0251', title: '般若波羅蜜多心經', canon: 'T', creators: '唐 玄奘譯', juansCount: 1, category: '般若部', cjkChars: 260 },
  { workId: 'T0235', title: '金剛般若波羅蜜經', canon: 'T', creators: '後秦 鳩摩羅什譯', juansCount: 1, category: '般若部', cjkChars: 5140 },
  { workId: 'T0220', title: '大般若波羅蜜多經', canon: 'T', creators: '唐 玄奘譯', juansCount: 600, category: '般若部', cjkChars: 3890000 },
  { workId: 'T0224', title: '道行般若經', canon: 'T', creators: '後漢 支婁迦讖譯', juansCount: 10, category: '般若部', cjkChars: 68300 },
  { workId: 'T0227', title: '小品般若波羅蜜經', canon: 'T', creators: '後秦 鳩摩羅什譯', juansCount: 10, category: '般若部', cjkChars: 71200 },
  { workId: 'T0228', title: '佛說佛母出生三法藏般若波羅蜜多經', canon: 'T', creators: '宋 施護等譯', juansCount: 25, category: '般若部', cjkChars: 165000 },

  // 華嚴部
  { workId: 'T0279', title: '大方廣佛華嚴經 (八十華嚴)', canon: 'T', creators: '唐 實叉難陀譯', juansCount: 80, category: '華嚴部', cjkChars: 588000 },
  { workId: 'T0278_HY', title: '大方廣佛華嚴經 (六十華嚴)', canon: 'T', creators: '東晉 佛馱跋陀羅譯', juansCount: 60, category: '華嚴部', cjkChars: 423000 },
  { workId: 'T0293', title: '大方廣佛華嚴經 (四十華嚴)', canon: 'T', creators: '唐 般若譯', juansCount: 40, category: '華嚴部', cjkChars: 289000 },
  { workId: 'T0294', title: '佛說羅摩伽經', canon: 'T', creators: '西秦 聖堅譯', juansCount: 3, category: '華嚴部', cjkChars: 22100 },

  // 阿含部
  { workId: 'T0001', title: '長阿含經', canon: 'T', creators: '後秦 佛陀耶舍共竺佛念譯', juansCount: 22, category: '阿含部', cjkChars: 198000 },
  { workId: 'T0026', title: '中阿含經', canon: 'T', creators: '東晉 僧伽提婆譯', juansCount: 60, category: '阿含部', cjkChars: 514000 },
  { workId: 'T0099', title: '雜阿含經', canon: 'T', creators: '劉宋 求那跋陀羅譯', juansCount: 50, category: '阿含部', cjkChars: 642000 },
  { workId: 'T0125', title: '增壹阿含經', canon: 'T', creators: '東晉 僧伽提婆譯', juansCount: 51, category: '阿含部', cjkChars: 485000 },
  { workId: 'T0779', title: '佛說八大人覺經', canon: 'T', creators: '後漢 安世高譯', juansCount: 1, category: '阿含部', cjkChars: 380 },

  // 淨土部
  { workId: 'T0360', title: '無量壽經', canon: 'T', creators: '曹魏 康僧鎧譯', juansCount: 2, category: '淨土部', cjkChars: 18600 },
  { workId: 'T0365', title: '觀無量壽佛經', canon: 'T', creators: '劉宋 畺良耶舍譯', juansCount: 1, category: '淨土部', cjkChars: 7900 },
  { workId: 'T0366', title: '佛說阿彌陀經', canon: 'T', creators: '後秦 鳩摩羅什譯', juansCount: 1, category: '淨土部', cjkChars: 1850 },
  { workId: 'T0367', title: '稱讚淨土佛攝受經', canon: 'T', creators: '唐 玄奘譯', juansCount: 1, category: '淨土部', cjkChars: 3400 },
  { workId: 'T0374', title: '大般涅槃經', canon: 'T', creators: '北涼 曇無讖譯', juansCount: 40, category: '涅槃部', cjkChars: 420000 },

  // 經集部 / 禪觀
  { workId: 'T0475', title: '維摩詰所說經', canon: 'T', creators: '後秦 鳩摩羅什譯', juansCount: 3, category: '經集部', cjkChars: 24500 },
  { workId: 'T0642', title: '首楞嚴三昧經', canon: 'T', creators: '後秦 鳩摩羅什譯', juansCount: 2, category: '經集部', cjkChars: 17800 },
  { workId: 'T0666', title: '大乘理趣六波羅蜜多經', canon: 'T', creators: '唐 般若譯', juansCount: 10, category: '經集部', cjkChars: 86000 },
  { workId: 'T0670', title: '楞伽阿跋多羅寶經', canon: 'T', creators: '劉宋 求那跋陀羅譯', juansCount: 4, category: '經集部', cjkChars: 31200 },
  { workId: 'T0945', title: '大佛頂如來密因修證了義諸菩薩萬行首楞嚴經', canon: 'T', creators: '唐 般剌蜜帝譯', juansCount: 10, category: '經集部', cjkChars: 62400 },

  // 瑜伽唯識 / 論疏部
  { workId: 'T1579', title: '瑜伽師地論', canon: 'T', creators: '彌勒菩薩說 · 唐 玄奘譯', juansCount: 100, category: '瑜伽部', cjkChars: 812000 },
  { workId: 'T1585', title: '成唯識論', canon: 'T', creators: '護法等菩薩造 · 唐 玄奘譯', juansCount: 10, category: '瑜伽部', cjkChars: 98000 },
  { workId: 'T1666', title: '大乘起信論', canon: 'T', creators: '馬鳴菩薩造 · 梁 真諦譯', juansCount: 1, category: '論疏部', cjkChars: 11200 },
  { workId: 'T1564', title: '中論', canon: 'T', creators: '龍樹菩薩造 · 後秦 鳩摩羅什譯', juansCount: 4, category: '中觀部', cjkChars: 28500 }
];

export function BookshelfInteractivePlayground({
  downloadedBooks,
  favoriteWorkIds,
  recentReadsBooks,
  onSelectBook,
  onExitDemo
}: BookshelfInteractivePlaygroundProps) {
  // === 提案切換狀態：'planA' (微膠囊) | 'planB' (折疊抽屜) | 'planC' (部類矩陣) ===
  const [selectedPlan, setSelectedPlan] = useState<'planA' | 'planB' | 'planC'>('planA');
  
  // === 資料來源模擬：'real' (現有4本) | 'mass' (模擬120本) ===
  const [dataScale, setDataScale] = useState<'real' | 'mass'>('real');

  // === 視圖模式：清單 (list) | 網格書架 (grid) ===
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // === 方案 A 狀態：當前選取的膠囊過濾項目 ===
  const [activeCapsuleFilter, setActiveCapsuleFilter] = useState<string>('all');

  // === 方案 B 狀態：折疊抽屜展開的資料夾 ID 陣列 ===
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>(['folder_jizang']);
  const [selectedTileSmartView, setSelectedTileSmartView] = useState<'recent' | 'favorites' | 'downloads' | null>(null);

  // === 方案 C 狀態：矩陣維度 ===
  const [matrixDimension, setMatrixDimension] = useState<'category' | 'author' | 'custom'>('category');

  // 決定當前運作的書籍資料池
  const activeBooksPool = useMemo(() => {
    if (dataScale === 'mass') {
      return SIMULATED_120_BOOKS;
    }
    return downloadedBooks.length > 0 ? downloadedBooks : SIMULATED_120_BOOKS.slice(0, 5);
  }, [dataScale, downloadedBooks]);

  // 判斷是否為我的最愛
  const isFavorite = (workId: string) => {
    if (dataScale === 'mass') {
      return ['T0262', 'T0412', 'T0251', 'T0279', 'T0779'].includes(workId);
    }
    return favoriteWorkIds.includes(workId);
  };

  // 方案 B 切換資料夾展開
  const toggleFolder = (folderId: string) => {
    setExpandedFolderIds(prev => 
      prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
    );
  };

  // 方案 A 膠囊標籤清單
  const capsuleTabs = useMemo(() => {
    const totalCount = activeBooksPool.length;
    const favCount = activeBooksPool.filter(b => isFavorite(b.workId)).length;
    
    // 統計各部類
    const categoryCounts: Record<string, number> = {};
    activeBooksPool.forEach(b => {
      const cat = b.category || '未分類';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const tabs = [
      { id: 'all', label: `全部 (${totalCount})` },
      { id: 'fav', label: `★ 我的最愛 (${favCount})` },
    ];

    Object.keys(categoryCounts).slice(0, 6).forEach(cat => {
      tabs.push({ id: `cat_${cat}`, label: `📁 ${cat} (${categoryCounts[cat]})` });
    });

    return tabs;
  }, [activeBooksPool, favoriteWorkIds, dataScale]);

  // 方案 A 依當前膠囊過濾出的書籍
  const planAFilteredBooks = useMemo(() => {
    if (activeCapsuleFilter === 'all') return activeBooksPool;
    if (activeCapsuleFilter === 'fav') return activeBooksPool.filter(b => isFavorite(b.workId));
    if (activeCapsuleFilter.startsWith('cat_')) {
      const targetCat = activeCapsuleFilter.replace('cat_', '');
      return activeBooksPool.filter(b => (b.category || '未分類') === targetCat);
    }
    return activeBooksPool;
  }, [activeCapsuleFilter, activeBooksPool]);

  // 方案 B 自訂資料夾分組清單
  const planBFolders = useMemo(() => {
    const jizangBooks = activeBooksPool.filter(b => 
      b.title.includes('地藏') || b.category === '本生部' || b.category === '懺儀部'
    );
    const prajnaBooks = activeBooksPool.filter(b => 
      b.title.includes('般若') || b.title.includes('心經') || b.title.includes('金剛') || b.category === '般若部'
    );
    const lotusBooks = activeBooksPool.filter(b => 
      b.title.includes('法華') || b.category === '法華部' || b.category === '淨土部'
    );
    const others = activeBooksPool.filter(b => 
      !jizangBooks.includes(b) && !prajnaBooks.includes(b) && !lotusBooks.includes(b)
    );

    return [
      { id: 'folder_jizang', name: '地藏專修部', count: jizangBooks.length, books: jizangBooks },
      { id: 'folder_prajna', name: '般若空宗部', count: prajnaBooks.length, books: prajnaBooks },
      { id: 'folder_lotus', name: '法華淨土部', count: lotusBooks.length, books: lotusBooks },
      { id: 'folder_others', name: '其他待整理經典', count: others.length, books: others }
    ];
  }, [activeBooksPool]);

  // 方案 C 依 CBETA 部類分組
  const planCCategories = useMemo(() => {
    const groups: Record<string, BookMetadata[]> = {};
    activeBooksPool.forEach(b => {
      const cat = b.category || '阿含部';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(b);
    });
    return groups;
  }, [activeBooksPool]);

  return (
    <div className="bookshelf-playground-root animate-fade-in" style={{ padding: '0.5rem 0.85rem 3rem 0.85rem' }}>
      
      {/* 💡 1. 互動實驗台控制頂部：提案選擇微膠囊 + 海量資料切換 */}
      <div 
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '18px',
          padding: '0.75rem 0.9rem',
          marginBottom: '1rem',
          border: '1.2px solid var(--border-color, rgba(0,0,0,0.12))',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="#1ea98c" />
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              新書櫃互動提案展示
            </span>
          </div>
          {onExitDemo && (
            <button
              type="button"
              onClick={onExitDemo}
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                padding: '3px 8px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              返回原版
            </button>
          )}
        </div>

        {/* 3 大方案切換標籤 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.6rem' }}>
          {[
            { id: 'planA', label: '方案 A：微膠囊', desc: 'Apple Books 清爽' },
            { id: 'planB', label: '方案 B：折疊抽屜', desc: '現代資料夾' },
            { id: 'planC', label: '方案 C：部類矩陣', desc: '正統藏經大排版' }
          ].map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlan(p.id as any)}
              style={{
                padding: '0.45rem 0.2rem',
                borderRadius: '12px',
                border: selectedPlan === p.id ? '1.5px solid #1ea98c' : '1px solid rgba(0,0,0,0.1)',
                background: selectedPlan === p.id ? '#1ea98c' : 'rgba(0,0,0,0.03)',
                color: selectedPlan === p.id ? '#ffffff' : 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{p.label}</div>
              <div style={{ fontSize: '0.66rem', opacity: 0.85, marginTop: '2px' }}>{p.desc}</div>
            </button>
          ))}
        </div>

        {/* 規模模擬開關 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.4rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>經典容量切換測試：</span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setDataScale('real')}
              style={{
                padding: '3px 9px',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: dataScale === 'real' ? '1.2px solid #8c4b27' : '1px solid rgba(0,0,0,0.1)',
                background: dataScale === 'real' ? '#8c4b27' : 'transparent',
                color: dataScale === 'real' ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              現有書籍 (4本)
            </button>
            <button
              type="button"
              onClick={() => setDataScale('mass')}
              style={{
                padding: '3px 9px',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: dataScale === 'mass' ? '1.2px solid #1ea98c' : '1px solid rgba(0,0,0,0.1)',
                background: dataScale === 'mass' ? '#1ea98c' : 'transparent',
                color: dataScale === 'mass' ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              模擬海量 (120本)
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 🌟 方案 A：頂部智慧微膠囊篩選 + 沉浸清爽書架 (首選推薦)     */}
      {/* ========================================================= */}
      {selectedPlan === 'planA' && (
        <div className="plan-a-container animate-slide-up">
          {/* 1. 頂部「上次閱讀」精選橫卡 (一鍵接續) */}
          <div 
            onClick={() => onSelectBook('T0262')}
            style={{
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '18px',
              padding: '0.85rem 1rem',
              marginBottom: '0.85rem',
              border: '1.2px solid var(--border-color, rgba(0,0,0,0.12))',
              boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div 
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#8c4b27',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  flexShrink: 0
                }}
              >
                T0262
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#1ea98c', fontWeight: 700 }}>
                  上次閱讀 · 卷三 譬喻品 [ 68% ]
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                  妙法蓮華經
                </div>
              </div>
            </div>
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(30, 169, 140, 0.1)',
                color: '#1ea98c',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 700
              }}
            >
              <span>繼續</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* 2. 水平滑動微膠囊過濾 Bar (Sticky Capsule Row) */}
          <div 
            className="custom-scrollbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              overflowX: 'auto',
              paddingBottom: '0.5rem',
              marginBottom: '0.65rem'
            }}
          >
            {capsuleTabs.map(tab => {
              const isActive = activeCapsuleFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCapsuleFilter(tab.id)}
                  style={{
                    padding: '0.36rem 0.8rem',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.16s ease',
                    border: isActive ? '1.2px solid #1ea98c' : '1px solid var(--border-color, rgba(0,0,0,0.12))',
                    background: isActive ? '#1ea98c' : 'var(--bg-card, #ffffff)',
                    color: isActive ? '#ffffff' : 'var(--text-primary)',
                    boxShadow: isActive ? '0 3px 10px rgba(30,169,140,0.25)' : 'none'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
            <button
              type="button"
              style={{
                padding: '0.36rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                border: '1px dashed var(--border-color, rgba(0,0,0,0.25))',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              ＋ 新增分類
            </button>
          </div>

          {/* 3. 書籍列表頂部資訊條 (總數 + 網格/清單切換) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.3rem 0.2rem 0.65rem 0.2rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              共 {planAFilteredBooks.length} 部經典 · 不重複呈現
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  background: viewMode === 'list' ? 'rgba(0,0,0,0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 6px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)'
                }}
                title="清單檢視"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  background: viewMode === 'grid' ? 'rgba(0,0,0,0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 6px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)'
                }}
                title="網格書架檢視"
              >
                <Grid size={16} />
              </button>
            </div>
          </div>

          {/* 4. 清爽書籍列表 / 網格 (每部經典只出現 1 次！) */}
          {viewMode === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {planAFilteredBooks.map(book => {
                const isFav = isFavorite(book.workId);
                return (
                  <div
                    key={book.workId}
                    onClick={() => onSelectBook(book.workId)}
                    style={{
                      background: 'var(--bg-card, #ffffff)',
                      borderRadius: '14px',
                      padding: '0.55rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                      <div 
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          background: '#8c4b27',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          flexShrink: 0
                        }}
                      >
                        {book.workId}
                      </div>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '6px' }}>
                        <div style={{ 
                          fontSize: '0.94rem', 
                          fontWeight: 700, 
                          color: 'var(--text-primary)', 
                          fontFamily: 'var(--font-serif)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {book.title}
                        </div>
                        <div style={{ 
                          fontSize: '0.72rem', 
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px'
                        }}>
                          {book.creators} · {book.juansCount}卷
                        </div>
                      </div>
                    </div>

                    {/* 右側膠囊標記 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {isFav && (
                        <span style={{ fontSize: '0.68rem', background: 'rgba(229, 62, 62, 0.1)', color: '#e53e3e', padding: '2px 6px', borderRadius: '6px', fontWeight: 700 }}>
                          ★ 最愛
                        </span>
                      )}
                      <span style={{ fontSize: '0.68rem', background: 'rgba(140, 75, 39, 0.08)', color: '#8c4b27', padding: '2px 6px', borderRadius: '6px', fontWeight: 600 }}>
                        {book.category || '法華部'}
                      </span>
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 網格書架模式 */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
              {planAFilteredBooks.map(book => (
                <div
                  key={book.workId}
                  onClick={() => onSelectBook(book.workId)}
                  style={{
                    background: 'var(--bg-card, #ffffff)',
                    borderRadius: '14px',
                    padding: '0.85rem 0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    cursor: 'pointer',
                    minHeight: '105px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#8c4b27', background: 'rgba(140,75,39,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      {book.workId}
                    </span>
                    {isFavorite(book.workId) && <Heart size={14} fill="#e53e3e" color="#e53e3e" />}
                  </div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', lineHeight: 1.3 }}>
                    {book.title}
                  </div>
                  <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {book.creators}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 📁 方案 B：3 大智慧磁貼 ＋ 現代折疊抽屜資料夾 (層次鮮明)   */}
      {/* ========================================================= */}
      {selectedPlan === 'planB' && (
        <div className="plan-b-container animate-slide-up">
          {/* 1. 頂部 3 大精緻大圓角磁貼 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
            <div 
              onClick={() => setSelectedTileSmartView(selectedTileSmartView === 'recent' ? null : 'recent')}
              style={{
                background: selectedTileSmartView === 'recent' ? '#1ea98c' : 'var(--bg-card, #ffffff)',
                color: selectedTileSmartView === 'recent' ? '#ffffff' : 'var(--text-primary)',
                padding: '0.75rem 0.5rem',
                borderRadius: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1.2px solid var(--border-color, rgba(0,0,0,0.1))',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              <Clock size={20} style={{ margin: '0 auto 4px auto', display: 'block' }} />
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>最近閱讀</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.85, marginTop: '2px' }}>
                {dataScale === 'mass' ? '14 部' : `${recentReadsBooks.length} 部`}
              </div>
            </div>

            <div 
              onClick={() => setSelectedTileSmartView(selectedTileSmartView === 'favorites' ? null : 'favorites')}
              style={{
                background: selectedTileSmartView === 'favorites' ? '#e53e3e' : 'var(--bg-card, #ffffff)',
                color: selectedTileSmartView === 'favorites' ? '#ffffff' : 'var(--text-primary)',
                padding: '0.75rem 0.5rem',
                borderRadius: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1.2px solid var(--border-color, rgba(0,0,0,0.1))',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              <Heart size={20} style={{ margin: '0 auto 4px auto', display: 'block' }} />
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>我的最愛</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.85, marginTop: '2px' }}>
                {dataScale === 'mass' ? '28 部' : '4 部'}
              </div>
            </div>

            <div 
              onClick={() => setSelectedTileSmartView(selectedTileSmartView === 'downloads' ? null : 'downloads')}
              style={{
                background: selectedTileSmartView === 'downloads' ? '#2b6cb0' : 'var(--bg-card, #ffffff)',
                color: selectedTileSmartView === 'downloads' ? '#ffffff' : 'var(--text-primary)',
                padding: '0.75rem 0.5rem',
                borderRadius: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1.2px solid var(--border-color, rgba(0,0,0,0.1))',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              <Download size={20} style={{ margin: '0 auto 4px auto', display: 'block' }} />
              <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>近期下載</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.85, marginTop: '2px' }}>
                {dataScale === 'mass' ? '6 部' : '1 部'}
              </div>
            </div>
          </div>

          {/* 2. 自訂分類折疊抽屜列表 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>自訂專題資料夾 ({planBFolders.length})</span>
            <span style={{ fontSize: '0.74rem', color: '#1ea98c', cursor: 'pointer', fontWeight: 700 }}>＋ 新增分類</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {planBFolders.map(folder => {
              const isExpanded = expandedFolderIds.includes(folder.id);
              return (
                <div 
                  key={folder.id}
                  style={{
                    background: 'var(--bg-card, #ffffff)',
                    borderRadius: '16px',
                    border: '1.2px solid var(--border-color, rgba(0,0,0,0.1))',
                    overflow: 'hidden',
                    boxShadow: '0 3px 10px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* 資料夾標題欄 (點選可展開/收合) */}
                  <div 
                    onClick={() => toggleFolder(folder.id)}
                    style={{
                      padding: '0.8rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(140, 75, 39, 0.04)' : 'transparent',
                      borderBottom: isExpanded ? '1px solid rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Folder size={18} color="#8c4b27" />
                      <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {folder.name}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.06)', padding: '2px 7px', borderRadius: '10px' }}>
                        {folder.count} 部
                      </span>
                    </div>
                    {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                  </div>

                  {/* 展開時顯示經書內容 */}
                  {isExpanded && (
                    <div style={{ padding: '0.4rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {folder.books.map(b => (
                        <div
                          key={b.workId}
                          onClick={() => onSelectBook(b.workId)}
                          style={{
                            padding: '0.5rem 0.65rem',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(0,0,0,0.02)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8c4b27' }}>{b.workId}</span>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{b.title}</span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.juansCount}卷 ➔</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🏷️ 方案 C：CBETA 正統大藏經部類矩陣 (權威學術自動歸類)       */}
      {/* ========================================================= */}
      {selectedPlan === 'planC' && (
        <div className="plan-c-container animate-slide-up">
          {/* 三維度分段膠囊切換 */}
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              background: 'rgba(0,0,0,0.06)',
              borderRadius: '14px',
              padding: '3px',
              marginBottom: '1rem'
            }}
          >
            {[
              { id: 'category', label: 'CBETA 部類' },
              { id: 'author', label: '依作譯者' },
              { id: 'custom', label: '自訂書架' }
            ].map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => setMatrixDimension(d.id as any)}
                style={{
                  padding: '0.4rem 0.2rem',
                  border: 'none',
                  borderRadius: '11px',
                  background: matrixDimension === d.id ? 'var(--bg-card, #ffffff)' : 'transparent',
                  color: matrixDimension === d.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: matrixDimension === d.id ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', padding: '0 4px' }}>
            💡 依照 CBETA 大藏經正統編纂架構自動分組，下載千部經典亦無需手動搬移分類：
          </div>

          {/* 自動分組列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(planCCategories).map(([catName, books]) => (
              <div 
                key={catName}
                style={{
                  background: 'var(--bg-card, #ffffff)',
                  borderRadius: '16px',
                  padding: '0.85rem',
                  border: '1.2px solid var(--border-color, rgba(0,0,0,0.1))',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1ea98c' }} />
                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>{catName}</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.05)', padding: '2px 7px', borderRadius: '8px' }}>
                    {books.length} 部
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {books.map(b => (
                    <div
                      key={b.workId}
                      onClick={() => onSelectBook(b.workId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.6rem',
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.02)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8c4b27' }}>{b.workId}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{b.title}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.creators}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
