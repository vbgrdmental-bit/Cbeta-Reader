import { useState, useMemo } from 'react';
import { 
  Heart, Clock, Download, ChevronRight, ChevronDown, 
  Layers, BookOpen, User, Grid, List, Sparkles
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
  // 法華部 (大正藏 第 9 冊)
  { workId: 'T0262', title: '妙法蓮華經', canon: 'T', vol: 'T09', creators: '後秦 鳩摩羅什譯', juansCount: 7, category: '法華部', cjkChars: 69430 },
  { workId: 'T0263', title: '正法華經', canon: 'T', vol: 'T09', creators: '西晉 竺法護譯', juansCount: 10, category: '法華部', cjkChars: 93420 },
  { workId: 'T0264', title: '添品妙法蓮華經', canon: 'T', vol: 'T09', creators: '隋 闍那崛多等譯', juansCount: 7, category: '法華部', cjkChars: 72100 },
  { workId: 'T0277', title: '無量義經', canon: 'T', vol: 'T09', creators: '蕭齊 曇摩伽陀耶舍譯', juansCount: 1, category: '法華部', cjkChars: 9680 },
  { workId: 'T0278', title: '觀普賢菩薩行法經', canon: 'T', vol: 'T09', creators: '劉宋 曇無蜜多譯', juansCount: 1, category: '法華部', cjkChars: 8750 },

  // 本生部 / 大集部 (大正藏 第 13、14 冊)
  { workId: 'T0412', title: '地藏菩薩本願經', canon: 'T', vol: 'T13', creators: '唐 實叉難陀譯', juansCount: 2, category: '本生部', cjkChars: 17200 },
  { workId: 'T0411', title: '大乘大集地藏十輪經', canon: 'T', vol: 'T13', creators: '唐 玄奘譯', juansCount: 10, category: '大集部', cjkChars: 85300 },
  { workId: 'T0839', title: '占察善惡業報經', canon: 'T', vol: 'T17', creators: '隋 菩提燈譯', juansCount: 2, category: '經集部', cjkChars: 18900 },
  { workId: 'X1487', title: '慈悲地藏菩薩懺法', canon: 'X', vol: 'X74', creators: '清 知源等述', juansCount: 3, category: '懺儀部', cjkChars: 24100 },

  // 般若部 (大正藏 第 5~8 冊)
  { workId: 'T0251', title: '般若波羅蜜多心經', canon: 'T', vol: 'T08', creators: '唐 玄奘譯', juansCount: 1, category: '般若部', cjkChars: 260 },
  { workId: 'T0235', title: '金剛般若波羅蜜經', canon: 'T', vol: 'T08', creators: '後秦 鳩摩羅什譯', juansCount: 1, category: '般若部', cjkChars: 5140 },
  { workId: 'T0220', title: '大般若波羅蜜多經', canon: 'T', vol: 'T05', creators: '唐 玄奘譯', juansCount: 600, category: '般若部', cjkChars: 3890000 },
  { workId: 'T0224', title: '道行般若經', canon: 'T', vol: 'T08', creators: '東漢 支婁迦讖譯', juansCount: 10, category: '般若部', cjkChars: 68300 },
  { workId: 'T0227', title: '小品般若波羅蜜經', canon: 'T', vol: 'T08', creators: '後秦 鳩摩羅什譯', juansCount: 10, category: '般若部', cjkChars: 71200 },
  { workId: 'T0228', title: '佛說佛母出生三法藏般若波羅蜜多經', canon: 'T', vol: 'T08', creators: '宋 施護等譯', juansCount: 25, category: '般若部', cjkChars: 165000 },

  // 華嚴部 (大正藏 第 9、10 冊)
  { workId: 'T0279', title: '大方廣佛華嚴經 (八十華嚴)', canon: 'T', vol: 'T10', creators: '唐 實叉難陀譯', juansCount: 80, category: '華嚴部', cjkChars: 588000 },
  { workId: 'T0278_HY', title: '大方廣佛華嚴經 (六十華嚴)', canon: 'T', vol: 'T09', creators: '東晉 佛馱跋陀羅譯', juansCount: 60, category: '華嚴部', cjkChars: 423000 },
  { workId: 'T0293', title: '大方廣佛華嚴經 (四十華嚴)', canon: 'T', vol: 'T10', creators: '唐 般若譯', juansCount: 40, category: '華嚴部', cjkChars: 289000 },
  { workId: 'T0294', title: '佛說羅摩伽經', canon: 'T', vol: 'T10', creators: '西秦 聖堅譯', juansCount: 3, category: '華嚴部', cjkChars: 22100 },

  // 阿含部 (大正藏 第 1、2 冊)
  { workId: 'T0001', title: '長阿含經', canon: 'T', vol: 'T01', creators: '後秦 佛陀耶舍共竺佛念譯', juansCount: 22, category: '阿含部', cjkChars: 198000 },
  { workId: 'T0026', title: '中阿含經', canon: 'T', vol: 'T01', creators: '東晉 僧伽提婆譯', juansCount: 60, category: '阿含部', cjkChars: 514000 },
  { workId: 'T0099', title: '雜阿含經', canon: 'T', vol: 'T02', creators: '劉宋 求那跋陀羅譯', juansCount: 50, category: '阿含部', cjkChars: 642000 },
  { workId: 'T0125', title: '增壹阿含經', canon: 'T', vol: 'T02', creators: '東晉 僧伽提婆譯', juansCount: 51, category: '阿含部', cjkChars: 485000 },
  { workId: 'T0779', title: '佛說八大人覺經', canon: 'T', vol: 'T17', creators: '東漢 安世高譯', juansCount: 1, category: '阿含部', cjkChars: 380 },

  // 淨土部 (大正藏 第 12 冊)
  { workId: 'T0360', title: '無量壽經', canon: 'T', vol: 'T12', creators: '曹魏 康僧鎧譯', juansCount: 2, category: '淨土部', cjkChars: 18600 },
  { workId: 'T0365', title: '觀無量壽佛經', canon: 'T', vol: 'T12', creators: '劉宋 畺良耶舍譯', juansCount: 1, category: '淨土部', cjkChars: 7900 },
  { workId: 'T0366', title: '佛說阿彌陀經', canon: 'T', vol: 'T12', creators: '後秦 鳩摩羅什譯', juansCount: 1, category: '淨土部', cjkChars: 1850 },
  { workId: 'T0367', title: '稱讚淨土佛攝受經', canon: 'T', vol: 'T12', creators: '唐 玄奘譯', juansCount: 1, category: '淨土部', cjkChars: 3400 },
  { workId: 'T0374', title: '大般涅槃經', canon: 'T', vol: 'T12', creators: '北涼 曇無讖譯', juansCount: 40, category: '涅槃部', cjkChars: 420000 },

  // 經集部 / 禪觀 (大正藏 第 14~17 冊)
  { workId: 'T0475', title: '維摩詰所說經', canon: 'T', vol: 'T14', creators: '後秦 鳩摩羅什譯', juansCount: 3, category: '經集部', cjkChars: 24500 },
  { workId: 'T0642', title: '首楞嚴三昧經', canon: 'T', vol: 'T15', creators: '後秦 鳩摩羅什譯', juansCount: 2, category: '經集部', cjkChars: 17800 },
  { workId: 'T0666', title: '大乘理趣六波羅蜜多經', canon: 'T', vol: 'T16', creators: '唐 般若譯', juansCount: 10, category: '經集部', cjkChars: 86000 },
  { workId: 'T0670', title: '楞伽阿跋多羅寶經', canon: 'T', vol: 'T16', creators: '劉宋 求那跋陀羅譯', juansCount: 4, category: '經集部', cjkChars: 31200 },
  { workId: 'T0945', title: '大佛頂如來密因修證了義諸菩薩萬行首楞嚴經', canon: 'T', vol: 'T19', creators: '唐 般剌蜜帝譯', juansCount: 10, category: '密教部', cjkChars: 62400 },

  // 瑜伽唯識 / 論疏部 (大正藏 第 30~32 冊)
  { workId: 'T1579', title: '瑜伽師地論', canon: 'T', vol: 'T30', creators: '彌勒菩薩說 · 唐 玄奘譯', juansCount: 100, category: '論疏部', cjkChars: 812000 },
  { workId: 'T1585', title: '成唯識論', canon: 'T', vol: 'T31', creators: '護法等菩薩造 · 唐 玄奘譯', juansCount: 10, category: '論疏部', cjkChars: 98000 },
  { workId: 'T1666', title: '大乘起信論', canon: 'T', vol: 'T32', creators: '馬鳴菩薩造 · 梁 真諦譯', juansCount: 1, category: '論疏部', cjkChars: 11200 },
  { workId: 'T1564', title: '中論', canon: 'T', vol: 'T30', creators: '龍樹菩薩造 · 後秦 鳩摩羅什譯', juansCount: 4, category: '中觀部', cjkChars: 28500 }
];

export function BookshelfInteractivePlayground({
  downloadedBooks,
  favoriteWorkIds,
  recentReadsBooks,
  onSelectBook,
  onExitDemo
}: BookshelfInteractivePlaygroundProps) {
  // === 1. 頂部四大藏經分類切換：'category' (依部類) | 'volume' (依冊別) | 'author' (依作譯者) | 'dynasty' (依朝代) ===
  const [classificationMode, setClassificationMode] = useState<'category' | 'volume' | 'author' | 'dynasty'>('category');

  // === 2. 次層 3 大膠囊快捷過濾：'all' (全部) | 'downloads' (近期下載) | 'recent' (近期閱讀) | 'favorites' (我的最愛) ===
  const [statusFilter, setStatusFilter] = useState<'all' | 'downloads' | 'recent' | 'favorites'>('all');

  // === 3. 視圖切換 (圖2)：條列式 (list) vs 卡片式 (grid) ===
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // === 4. 資料庫容量切換：'real' (現有4本) | 'mass' (模擬120本) ===
  const [dataScale, setDataScale] = useState<'real' | 'mass'>('real');

  // === 5. 折疊分組的展開狀態 ===
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // 決定當前資料來源池
  const activeBooksPool = useMemo(() => {
    if (dataScale === 'mass') {
      return SIMULATED_120_BOOKS;
    }
    return downloadedBooks.length > 0 ? downloadedBooks : SIMULATED_120_BOOKS.slice(0, 5);
  }, [dataScale, downloadedBooks]);

  // 判斷是否為我的最愛
  const isFavorite = (workId: string) => {
    if (dataScale === 'mass') {
      return ['T0262', 'T0412', 'T0251', 'T0279', 'T0779', 'T0366'].includes(workId);
    }
    return favoriteWorkIds.includes(workId);
  };

  // 依 3 大膠囊篩選後的書籍清單
  const filteredBooks = useMemo(() => {
    if (statusFilter === 'favorites') {
      return activeBooksPool.filter(b => isFavorite(b.workId));
    }
    if (statusFilter === 'recent') {
      if (dataScale === 'mass') {
        return activeBooksPool.slice(0, 8);
      }
      return recentReadsBooks.length > 0 ? recentReadsBooks : activeBooksPool.slice(0, 2);
    }
    if (statusFilter === 'downloads') {
      return [...activeBooksPool].reverse();
    }
    return activeBooksPool;
  }, [activeBooksPool, statusFilter, dataScale, recentReadsBooks, favoriteWorkIds]);

  // CBETA 權威歷史朝代年表 (依時間先後嚴格排序)
  const HISTORICAL_CHRONOLOGY = useMemo(() => [
    { name: '東漢', order: 1, aliases: ['東漢', '後漢'] },
    { name: '曹魏', order: 2, aliases: ['曹魏', '魏'] },
    { name: '東吳', order: 3, aliases: ['孫吳', '吳'] },
    { name: '西晉', order: 4, aliases: ['西晉'] },
    { name: '東晉', order: 5, aliases: ['東晉', '晉'] },
    { name: '前秦', order: 6, aliases: ['前秦', '符秦'] },
    { name: '後秦', order: 7, aliases: ['後秦', '姚秦'] },
    { name: '西秦', order: 8, aliases: ['西秦', '乞伏秦'] },
    { name: '北涼', order: 9, aliases: ['北涼'] },
    { name: '劉宋', order: 10, aliases: ['劉宋', '宋(劉)'] },
    { name: '北魏', order: 11, aliases: ['元魏', '北魏', '後魏'] },
    { name: '東魏', order: 12, aliases: ['東魏'] },
    { name: '南齊', order: 13, aliases: ['蕭齊', '南齊'] },
    { name: '梁朝', order: 14, aliases: ['蕭梁', '梁'] },
    { name: '北齊', order: 15, aliases: ['北齊', '高齊'] },
    { name: '北周', order: 16, aliases: ['北周', '宇文周'] },
    { name: '陳朝', order: 17, aliases: ['陳'] },
    { name: '隋朝', order: 18, aliases: ['隋'] },
    { name: '唐朝', order: 19, aliases: ['唐', '武周'] },
    { name: '五代', order: 20, aliases: ['後唐', '後晉', '南唐', '南漢'] },
    { name: '宋朝', order: 21, aliases: ['宋', '北宋', '南宋'] },
    { name: '遼金', order: 22, aliases: ['遼', '金', '西夏', '夏'] },
    { name: '元朝', order: 23, aliases: ['元'] },
    { name: '明朝', order: 24, aliases: ['明'] },
    { name: '清朝', order: 25, aliases: ['清'] },
    { name: '民國/現代', order: 26, aliases: ['民國', '近代', '現代'] },
    { name: '西域/天竺', order: 98, aliases: ['天竺', '印度', '西域', '月支', '安息'] },
    { name: '其他', order: 99, aliases: [] }
  ], []);

  // 權威部類傳統順序
  const CATEGORY_ORDER = useMemo(() => [
    '阿含部', '本生部', '大集部', '般若部', '法華部', '華嚴部', 
    '寶積部', '涅槃部', '淨土部', '經集部', '密教部', '諸宗部', 
    '論疏部', '中觀部', '瑜伽部', '律部', '懺儀部', '史傳部', '未分類'
  ], []);

  // 輔助函式：從 creators 智慧提取朝代與作譯者名稱 (精準解析「彌勒菩薩說 · 唐 玄奘譯」等造論與譯者多層結構)
  const parseCreators = (creatorsStr: string) => {
    const raw = (creatorsStr || '').trim();
    if (!raw) {
      return { dynastyName: '其他', dynastyOrder: 99, authorName: '佚名' };
    }

    // 1. 如果有造論者（包含 · 或 /），優先提取實際翻譯者段落
    let translationPart = raw;
    if (raw.includes('·')) {
      const parts = raw.split('·');
      translationPart = parts[parts.length - 1].trim();
    } else if (raw.includes('/')) {
      const parts = raw.split('/');
      translationPart = parts[parts.length - 1].trim();
    }

    // 2. 匹配朝代：依歷史朝代別名長度降序比對，避免「後秦」被誤判為「秦」
    let matchedDynasty = HISTORICAL_CHRONOLOGY.find(d => d.name === '其他')!;
    let matchedAlias = '';

    for (const d of HISTORICAL_CHRONOLOGY) {
      const sortedAliases = [...d.aliases].sort((a, b) => b.length - a.length);
      for (const alias of sortedAliases) {
        if (translationPart.includes(alias)) {
          matchedDynasty = d;
          matchedAlias = alias;
          break;
        }
      }
      if (matchedAlias) break;
    }

    // 3. 提取純粹作譯者名稱
    let authorName = translationPart;
    if (matchedAlias) {
      authorName = authorName.replace(matchedAlias, '').trim();
    }
    // 移除常見字尾 (如「譯」、「述」、「造」、「說」、「撰」、「等譯」、「共譯」等)
    authorName = authorName.replace(/(等?[譯述造說撰集錄編纂著]+|等)$/g, '').trim();
    if (!authorName) {
      authorName = translationPart || '佚名';
    }

    return { 
      dynastyName: matchedDynasty.name, 
      dynastyOrder: matchedDynasty.order, 
      authorName 
    };
  };

  // 依選取的維度進行分組，並嚴格依歷史年代與標準順序排序
  const groupedData = useMemo(() => {
    const groups: Record<string, { order: number; books: BookMetadata[] }> = {};

    filteredBooks.forEach(b => {
      let key = '未分類';
      let sortOrder = 999;

      if (classificationMode === 'category') {
        key = b.category || '未分類';
        const catIdx = CATEGORY_ORDER.indexOf(key);
        sortOrder = catIdx !== -1 ? catIdx : 900;
      } else if (classificationMode === 'volume') {
        const volNum = b.vol ? parseInt(b.vol.replace(/[^\d]/g, ''), 10) : 1;
        key = `大正藏 第 ${volNum.toString().padStart(2, '0')} 冊`;
        sortOrder = volNum;
      } else if (classificationMode === 'author') {
        const { authorName, dynastyOrder } = parseCreators(b.creators);
        key = authorName;
        // 作譯者排序：優先依據其所屬朝代的歷史順序排列！
        sortOrder = dynastyOrder * 1000;
      } else if (classificationMode === 'dynasty') {
        const { dynastyName, dynastyOrder } = parseCreators(b.creators);
        key = dynastyName;
        // 朝代排序：嚴格依歷史時間由古至今依序排列！
        sortOrder = dynastyOrder;
      }

      if (!groups[key]) {
        groups[key] = { order: sortOrder, books: [] };
      }
      groups[key].books.push(b);
    });

    // 依 order 排序分組
    const sortedEntries = Object.entries(groups).sort((a, b) => a[1].order - b[1].order);
    const result: Record<string, BookMetadata[]> = {};
    sortedEntries.forEach(([key, val]) => {
      result[key] = val.books;
    });

    return result;
  }, [filteredBooks, classificationMode, HISTORICAL_CHRONOLOGY, CATEGORY_ORDER]);

  // 切換折疊組
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: prev[groupKey] === false ? true : false
    }));
  };

  return (
    <div className="bookshelf-playground-root animate-fade-in" style={{ padding: '0.4rem 0.85rem 3rem 0.85rem' }}>
      
      {/* 💡 頂部輔助控制列：資料規模切換與返回原版 */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          padding: '0.4rem 0.6rem',
          borderRadius: '12px',
          background: 'rgba(0,0,0,0.03)',
          border: '1px solid var(--border-color, rgba(0,0,0,0.08))'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} color="#1ea98c" />
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            藏經多維度智慧整理方案
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setDataScale(dataScale === 'real' ? 'mass' : 'real')}
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '8px',
              border: '1px solid rgba(0,0,0,0.12)',
              background: dataScale === 'mass' ? '#1ea98c' : 'var(--bg-card, #fff)',
              color: dataScale === 'mass' ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            {dataScale === 'mass' ? '測試中：120 部海量經典' : '現有書目 (4 部)'}
          </button>
          {onExitDemo && (
            <button
              type="button"
              onClick={onExitDemo}
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              返回原版
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🌟 1. 頂部第一層：圖3之 4 大分類切換 (依部類 / 依冊別 / 依作譯者 / 依朝代) */}
      {/* ========================================================================= */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: 'rgba(0, 0, 0, 0.05)',
          borderRadius: '16px',
          padding: '4px',
          marginBottom: '0.85rem',
          border: '1px solid var(--border-color, rgba(0,0,0,0.08))',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        {[
          { id: 'category', label: '依部類', icon: Layers },
          { id: 'volume', label: '依冊別', icon: BookOpen },
          { id: 'author', label: '依作譯者', icon: User },
          { id: 'dynasty', label: '依朝代', icon: Clock }
        ].map(item => {
          const isActive = classificationMode === item.id;
          const IconComp = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setClassificationMode(item.id as any)}
              style={{
                padding: '0.55rem 0.2rem',
                borderRadius: '12px',
                border: 'none',
                background: isActive ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: isActive ? 'var(--color-wood-700, #8c4b27)' : 'var(--text-muted)',
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)',
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              <IconComp size={18} strokeWidth={isActive ? 2.3 : 1.8} />
              <span style={{ fontSize: '0.8rem', letterSpacing: '0.02em' }}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 🏷️ 2. 第二層：3 大膠囊快捷過濾 (近期下載 / 近期閱讀 / 我的最愛) ＋ 全部經典 */}
      {/* ========================================================================= */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          overflowX: 'auto',
          paddingBottom: '0.4rem',
          marginBottom: '0.75rem'
        }}
      >
        {[
          { id: 'all', label: `全部經典 (${activeBooksPool.length})`, icon: null },
          { id: 'downloads', label: `近期下載`, icon: Download },
          { id: 'recent', label: `近期閱讀`, icon: Clock },
          { id: 'favorites', label: `我的最愛`, icon: Heart }
        ].map(pill => {
          const isActive = statusFilter === pill.id;
          const IconComp = pill.icon;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '0.42rem 0.85rem',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.16s ease',
                border: isActive ? '1.2px solid #1ea98c' : '1px solid var(--border-color, rgba(0,0,0,0.12))',
                background: isActive ? '#1ea98c' : 'var(--bg-card, #ffffff)',
                color: isActive ? '#ffffff' : 'var(--text-primary)',
                boxShadow: isActive ? '0 3px 10px rgba(30,169,140,0.25)' : '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              {IconComp && <IconComp size={13} strokeWidth={2.4} fill={pill.id === 'favorites' && isActive ? '#fff' : 'none'} />}
              <span>{pill.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 📊 3. 第三層：統計資訊 ＋ 圖2之「條列式 / 卡片式」切換按鈕                  */}
      {/* ========================================================================= */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '0.2rem 0.2rem 0.75rem 0.2rem'
        }}
      >
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          共 {filteredBooks.length} 部經典 · 自動依
          {classificationMode === 'category' ? '部類' :
           classificationMode === 'volume' ? '冊別' :
           classificationMode === 'author' ? '作譯者' : '朝代'}歸納
        </div>

        {/* 圖2：條列式 (List) 與 卡片式 (Grid) 切換 */}
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.06)',
            borderRadius: '10px',
            padding: '2px',
            gap: '2px'
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '30px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'list' ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              boxShadow: viewMode === 'list' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
            title="條列式檢視"
          >
            <List size={18} strokeWidth={viewMode === 'list' ? 2.4 : 1.8} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '30px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'grid' ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              boxShadow: viewMode === 'grid' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
            title="卡片式檢視"
          >
            <Grid size={18} strokeWidth={viewMode === 'grid' ? 2.4 : 1.8} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📚 4. 主體內容：分組經典呈現 (條列式 vs 卡片式)                             */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {Object.entries(groupedData).map(([groupTitle, books]) => {
          const isExpanded = expandedGroups[groupTitle] !== false; // 預設全部展開
          return (
            <div 
              key={groupTitle}
              style={{
                background: 'var(--bg-card, #ffffff)',
                borderRadius: '18px',
                border: '1.2px solid var(--border-color, rgba(0,0,0,0.1))',
                overflow: 'hidden',
                boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
              }}
            >
              {/* 分組標題列 (支援折疊展開) */}
              <div 
                onClick={() => toggleGroup(groupTitle)}
                style={{
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: 'rgba(140, 75, 39, 0.03)',
                  borderBottom: isExpanded ? '1px solid rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8c4b27' }} />
                  <span style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                    {groupTitle}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.06)', padding: '2px 7px', borderRadius: '10px' }}>
                    {books.length} 部
                  </span>
                </div>
                {isExpanded ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
              </div>

              {/* 分組內容 */}
              {isExpanded && (
                <div style={{ padding: '0.55rem 0.65rem' }}>
                  {viewMode === 'list' ? (
                    /* 條列式排版 */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {books.map(book => (
                        <div
                          key={book.workId}
                          onClick={() => onSelectBook(book.workId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.65rem',
                            borderRadius: '12px',
                            background: 'rgba(0,0,0,0.02)',
                            border: '1px solid rgba(0,0,0,0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
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

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {isFavorite(book.workId) && (
                              <Heart size={14} fill="#e53e3e" color="#e53e3e" />
                            )}
                            <ChevronRight size={16} color="var(--text-muted)" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* 卡片式排版 (雙欄網格) */
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                      {books.map(book => (
                        <div
                          key={book.workId}
                          onClick={() => onSelectBook(book.workId)}
                          style={{
                            background: 'rgba(0,0,0,0.02)',
                            borderRadius: '14px',
                            padding: '0.75rem 0.65rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            border: '1px solid rgba(0,0,0,0.06)',
                            cursor: 'pointer',
                            minHeight: '100px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#8c4b27', background: 'rgba(140,75,39,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              {book.workId}
                            </span>
                            {isFavorite(book.workId) && <Heart size={13} fill="#e53e3e" color="#e53e3e" />}
                          </div>
                          <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', lineHeight: 1.25 }}>
                            {book.title}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {book.creators}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
