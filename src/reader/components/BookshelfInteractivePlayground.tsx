import { useState, useMemo } from 'react';
import { 
  Heart, Clock, ChevronRight, ChevronDown, 
  Layers, BookOpen, User, Grid, List,
  MoreVertical, FolderInput, Trash2
} from 'lucide-react';
import type { BookMetadata } from '../../types/book';

interface BookshelfInteractivePlaygroundProps {
  downloadedBooks: BookMetadata[];
  favoriteWorkIds: string[];
  recentReadsBooks: BookMetadata[];
  onSelectBook: (workId: string) => void;
  onExitDemo?: () => void;
  onOpenBookMenu?: (book: BookMetadata) => void;
  onToggleFavorite?: (workId: string) => void;
  onDeleteBook?: (workId: string) => void;
}

// 💡 120 部正統 CBETA 大藏經海量模擬經典資料庫 (涵蓋阿含、般若、法華、華嚴、本生、密教、論疏、近代新編等)
const SIMULATED_120_BOOKS: BookMetadata[] = [
  // 法華部 (大正藏 第 9 冊)
  { workId: 'T0262', title: '妙法蓮華經', canon: 'T', vol: 'T09', creators: '後秦 鳩摩羅什譯', juansCount: 7, category: '法華部類', cjkChars: 69430 },
  { workId: 'T0263', title: '正法華經', canon: 'T', vol: 'T09', creators: '西晉 竺法護譯', juansCount: 10, category: '法華部類', cjkChars: 93420 },
  { workId: 'T0264', title: '添品妙法蓮華經', canon: 'T', vol: 'T09', creators: '隋 闍那崛多等譯', juansCount: 7, category: '法華部類', cjkChars: 72100 },
  { workId: 'T0277', title: '無量義經', canon: 'T', vol: 'T09', creators: '蕭齊 曇摩迦陀耶舍譯', juansCount: 1, category: '法華部類', cjkChars: 9680 },
  { workId: 'T0278', title: '觀普賢菩薩行法經', canon: 'T', vol: 'T09', creators: '劉宋 曇無蜜多譯', juansCount: 1, category: '法華部類', cjkChars: 8750 },

  // 本緣部 / 大集部 (大正藏 第 13、14 冊)
  { workId: 'T0412', title: '地藏菩薩本願經', canon: 'T', vol: 'T13', creators: '唐 實叉難陀譯', juansCount: 2, category: '本緣部類', cjkChars: 17200 },
  { workId: 'T0411', title: '大乘大集地藏十輪經', canon: 'T', vol: 'T13', creators: '唐 玄奘譯', juansCount: 10, category: '大集部類', cjkChars: 85300 },
  { workId: 'T0839', title: '占察善惡業報經', canon: 'T', vol: 'T17', creators: '隋 菩提燈譯', juansCount: 2, category: '經集部類', cjkChars: 18900 },
  { workId: 'X1487', title: '慈悲地藏菩薩懺法', canon: 'X', vol: 'X74', creators: '清 知源等述', juansCount: 3, category: '事彙部類', cjkChars: 24100 },

  // 般若部 (大正藏 第 5~8 冊)
  { workId: 'T0251', title: '般若波羅蜜多心經', canon: 'T', vol: 'T08', creators: '唐 玄奘譯', juansCount: 1, category: '般若部類', cjkChars: 260 },
  { workId: 'T0235', title: '金剛般若波羅蜜經', canon: 'T', vol: 'T08', creators: '後秦 鳩摩羅什譯', juansCount: 1, category: '般若部類', cjkChars: 5140 },
  { workId: 'T0220', title: '大般若波羅蜜多經', canon: 'T', vol: 'T05', creators: '唐 玄奘譯', juansCount: 600, category: '般若部類', cjkChars: 3890000 },
  { workId: 'T0224', title: '道行般若經', canon: 'T', vol: 'T08', creators: '東漢 支婁迦讖譯', juansCount: 10, category: '般若部類', cjkChars: 68300 },
  { workId: 'T0227', title: '小品般若波羅蜜經', canon: 'T', vol: 'T08', creators: '後秦 鳩摩羅什譯', juansCount: 10, category: '般若部類', cjkChars: 71200 },
  { workId: 'T0228', title: '佛說佛母出生三法藏般若波羅蜜多經', canon: 'T', vol: 'T08', creators: '宋 施護等譯', juansCount: 25, category: '般若部類', cjkChars: 165000 },

  // 華嚴部 (大正藏 第 9、10 冊)
  { workId: 'T0279', title: '大方廣佛華嚴經 (八十華嚴)', canon: 'T', vol: 'T10', creators: '唐 實叉難陀譯', juansCount: 80, category: '華嚴部類', cjkChars: 588000 },
  { workId: 'T0278_HY', title: '大方廣佛華嚴經 (六十華嚴)', canon: 'T', vol: 'T09', creators: '東晉 佛馱跋陀羅譯', juansCount: 60, category: '華嚴部類', cjkChars: 423000 },
  { workId: 'T0293', title: '大方廣佛華嚴經 (四十華嚴)', canon: 'T', vol: 'T10', creators: '唐 般若譯', juansCount: 40, category: '華嚴部類', cjkChars: 289000 },
  { workId: 'T0294', title: '佛說羅摩伽經', canon: 'T', vol: 'T10', creators: '西秦 聖堅譯', juansCount: 3, category: '華嚴部類', cjkChars: 22100 },

  // 阿含部 (大正藏 第 1、2 冊)
  { workId: 'T0001', title: '長阿含經', canon: 'T', vol: 'T01', creators: '後秦 佛陀耶舍共竺佛念譯', juansCount: 22, category: '阿含部類', cjkChars: 198000 },
  { workId: 'T0026', title: '中阿含經', canon: 'T', vol: 'T01', creators: '東晉 僧伽提婆譯', juansCount: 60, category: '阿含部類', cjkChars: 514000 },
  { workId: 'T0099', title: '雜阿含經', canon: 'T', vol: 'T02', creators: '劉宋 求那跋陀羅譯', juansCount: 50, category: '阿含部類', cjkChars: 642000 },
  { workId: 'T0125', title: '增壹阿含經', canon: 'T', vol: 'T02', creators: '東晉 僧伽提婆譯', juansCount: 51, category: '阿含部類', cjkChars: 485000 },
  { workId: 'T0112', title: '佛說八正道經', canon: 'T', vol: 'T02', creators: '東漢 安清譯', juansCount: 1, category: '阿含部類', cjkChars: 450 },
  { workId: 'T0779', title: '佛說八大人覺經', canon: 'T', vol: 'T17', creators: '東漢 安世高譯', juansCount: 1, category: '阿含部類', cjkChars: 380 },

  // 淨土部 (大正藏 第 12 冊)
  { workId: 'T0360', title: '無量壽經', canon: 'T', vol: 'T12', creators: '曹魏 康僧鎧譯', juansCount: 2, category: '淨土宗部類', cjkChars: 18600 },
  { workId: 'T0365', title: '觀無量壽佛經', canon: 'T', vol: 'T12', creators: '劉宋 畺良耶舍譯', juansCount: 1, category: '淨土宗部類', cjkChars: 7900 },
  { workId: 'T0366', title: '佛說阿彌陀經', canon: 'T', vol: 'T12', creators: '後秦 鳩摩羅什譯', juansCount: 1, category: '淨土宗部類', cjkChars: 1850 },
  { workId: 'T0367', title: '稱讚淨土佛攝受經', canon: 'T', vol: 'T12', creators: '唐 玄奘譯', juansCount: 1, category: '淨土宗部類', cjkChars: 3400 },
  { workId: 'T0374', title: '大般涅槃經', canon: 'T', vol: 'T12', creators: '北涼 曇無讖譯', juansCount: 40, category: '涅槃部類', cjkChars: 420000 },

  // 經集部 / 密教部 (大正藏 第 14~21 冊)
  { workId: 'T0475', title: '維摩詰所說經', canon: 'T', vol: 'T14', creators: '後秦 鳩摩羅什譯', juansCount: 3, category: '經集部類', cjkChars: 24500 },
  { workId: 'T0642', title: '首楞嚴三昧經', canon: 'T', vol: 'T15', creators: '後秦 鳩摩羅什譯', juansCount: 2, category: '經集部類', cjkChars: 17800 },
  { workId: 'T0666', title: '大乘理趣六波羅蜜多經', canon: 'T', vol: 'T16', creators: '唐 般若譯', juansCount: 10, category: '經集部類', cjkChars: 86000 },
  { workId: 'T0670', title: '楞伽阿跋多羅寶經', canon: 'T', vol: 'T16', creators: '劉宋 求那跋陀羅譯', juansCount: 4, category: '經集部類', cjkChars: 31200 },
  { workId: 'T0901', title: '陀羅尼集經', canon: 'T', vol: 'T18', creators: '唐 阿地瞿多譯', juansCount: 12, category: '密教部類', cjkChars: 95400 },
  { workId: 'T0918', title: '諸佛心陀羅尼經', canon: 'T', vol: 'T19', creators: '唐 玄奘譯', juansCount: 1, category: '密教部類', cjkChars: 3200 },
  { workId: 'T0933', title: '九品往生阿彌陀三摩地集陀羅尼經', canon: 'T', vol: 'T19', creators: '唐 不空譯', juansCount: 1, category: '密教部類', cjkChars: 2100 },
  { workId: 'T0945', title: '大佛頂如來密因修證了義諸菩薩萬行首楞嚴經', canon: 'T', vol: 'T19', creators: '唐 般剌蜜帝譯', juansCount: 10, category: '密教部類', cjkChars: 62400 },
  { workId: 'T0947', title: '大佛頂如來放光悉怛多般怛羅陀羅尼', canon: 'T', vol: 'T19', creators: '唐 不空譯', juansCount: 1, category: '密教部類', cjkChars: 4100 },
  { workId: 'C1666', title: '梵本大悲神咒', canon: 'C', vol: 'C56', creators: '唐 達磨等譯', juansCount: 1, category: '密教部類', cjkChars: 1250 },

  // 瑜伽唯識 / 論疏部 (大正藏 第 30~32 冊)
  { workId: 'T1579', title: '瑜伽師地論', canon: 'T', vol: 'T30', creators: '彌勒菩薩說 · 唐 玄奘譯', juansCount: 100, category: '瑜伽部類', cjkChars: 812000 },
  { workId: 'T1585', title: '成唯識論', canon: 'T', vol: 'T31', creators: '護法等菩薩造 · 唐 玄奘譯', juansCount: 10, category: '瑜伽部類', cjkChars: 98000 },
  { workId: 'T1666', title: '大乘起信論', canon: 'T', vol: 'T32', creators: '馬鳴菩薩造 · 梁 真諦譯', juansCount: 1, category: '論集部類', cjkChars: 11200 },
  { workId: 'T1564', title: '中論', canon: 'T', vol: 'T30', creators: '龍樹菩薩造 · 後秦 鳩摩羅什譯', juansCount: 4, category: '中觀部類', cjkChars: 28500 },

  // 近代新編文獻 (印順導師 Y、太虛大師 TX 等)
  { workId: 'Y0001', title: '般若經講記', canon: 'Y', vol: 'Y01', creators: '民國 釋印順著', juansCount: 3, category: '新編部類', cjkChars: 73164 },
  { workId: 'Y0002', title: '寶積經講記', canon: 'Y', vol: 'Y02', creators: '民國 釋印順著', juansCount: 2, category: '新編部類', cjkChars: 89078 },
  { workId: 'Y0003', title: '勝鬘經講記', canon: 'Y', vol: 'Y03', creators: '民國 釋印順著', juansCount: 2, category: '新編部類', cjkChars: 87742 },
  { workId: 'Y0040', title: '成佛之道（增注本）', canon: 'Y', vol: 'Y42', creators: '民國 釋印順著', juansCount: 5, category: '新編部類', cjkChars: 146784 },
  { workId: 'TXa001', title: '太虛大師全書 · 編纂說明', canon: 'TX', vol: 'TX00', creators: '民國 釋太虛著', juansCount: 2, category: '新編部類', cjkChars: 16800 },
  { workId: 'TX01n0001', title: '太虛大師全書 · 第一編 五乘共學', canon: 'TX', vol: 'TX01', creators: '民國 釋太虛著', juansCount: 4, category: '新編部類', cjkChars: 54200 },
  { workId: 'B0080', title: '大唐西域記（校點本）', canon: 'B', vol: 'B13', creators: '唐 玄奘、辯機撰', juansCount: 12, category: '史傳部類', cjkChars: 109388 }
];

// CBETA 官方 23 部類權威清單 (完全對齊 CbetaCatalogView STATIC_DEPT_CATEGORIES 與圖1)
export const CBETA_DEPT_CATEGORIES = [
  { code: '01', name: '阿含部類', key: '01 阿含部類', keywords: ['阿含'] },
  { code: '02', name: '本緣部類', key: '02 本緣部類', keywords: ['本緣', '本生'] },
  { code: '03', name: '般若部類', key: '03 般若部類', keywords: ['般若'] },
  { code: '04', name: '法華部類', key: '04 法華部類', keywords: ['法華'] },
  { code: '05', name: '華嚴部類', key: '05 華嚴部類', keywords: ['華嚴'] },
  { code: '06', name: '寶積部類', key: '06 寶積部類', keywords: ['寶積'] },
  { code: '07', name: '涅槃部類', key: '07 涅槃部類', keywords: ['涅槃'] },
  { code: '08', name: '大集部類', key: '08 大集部類', keywords: ['大集'] },
  { code: '09', name: '經集部類', key: '09 經集部類', keywords: ['經集'] },
  { code: '10', name: '密教部類', key: '10 密教部類', keywords: ['密教', '密宗', '陀羅尼', '神咒', '儀軌'] },
  { code: '11', name: '律部類', key: '11 律部類', keywords: ['律部', '律'] },
  { code: '12', name: '毘曇部類', key: '12 毘曇部類', keywords: ['毘曇', '俱舍', '婆沙', '阿毘達磨'] },
  { code: '13', name: '中觀部類', key: '13 中觀部類', keywords: ['中觀', '中論'] },
  { code: '14', name: '瑜伽部類', key: '14 瑜伽部類', keywords: ['瑜伽', '唯識', '因明'] },
  { code: '15', name: '論集部類', key: '15 論集部類', keywords: ['論集', '論疏', '造論'] },
  { code: '16', name: '淨土宗部類', key: '16 淨土宗部類', keywords: ['淨土', '淨土宗', '阿彌陀', '無量壽'] },
  { code: '17', name: '禪宗部類', key: '17 禪宗部類', keywords: ['禪宗', '禪', '壇經', '語錄'] },
  { code: '18', name: '史傳部類', key: '18 史傳部類', keywords: ['史傳', '傳記', '西域', '高僧'] },
  { code: '19', name: '事彙部類', key: '19 事彙部類', keywords: ['事彙', '懺儀', '諸宗', '音義', '目錄'] },
  { code: '20', name: '敦煌寫本部類', key: '20 敦煌寫本部類', keywords: ['敦煌'] },
  { code: '21', name: '國圖善本部類', key: '21 國圖善本部類', keywords: ['國圖', '善本'] },
  { code: '22', name: '南傳大藏經部類', key: '22 南傳大藏經部類', keywords: ['南傳'] },
  { code: '23', name: '新編部類', key: '23 新編部類', keywords: ['新編', '印順', '太虛', '文獻', '呂澂'] }
];

// CBETA 官方 6 大冊別/藏經分類 (完全對齊 CbetaCatalogView STATIC_VOL_CATEGORIES 與圖4)
export const CBETA_CANON_CATEGORIES = [
  { id: 'T', name: 'T 大正新脩大藏經', order: 1, prefixes: ['T'] },
  { id: 'X', name: 'X 卍新纂續藏經選錄', order: 2, prefixes: ['X'] },
  { id: 'supplement', name: '歷代藏經補輯', order: 3, prefixes: ['A', 'B', 'C', 'F', 'G', 'GA', 'GB', 'I', 'K', 'L', 'M', 'P', 'U', 'ZS', 'ZW'] },
  { id: 'D', name: 'D 國家圖書館善本佛典', order: 4, prefixes: ['D'] },
  { id: 'N', name: 'N 漢譯南傳大藏經（元亨寺版）', order: 5, prefixes: ['N'] },
  { id: 'modern', name: '近代新編文獻', order: 6, prefixes: ['Y', 'TX', 'LC', 'YP', 'CC'] }
];

// 部類智慧映射函式：依圖1加上 01、02... 並依順序排列
function getDeptCategoryInfo(b: BookMetadata): { key: string; order: number } {
  const workId = (b.workId || '').toUpperCase();
  if (workId.startsWith('Y') || workId.startsWith('TX') || workId.startsWith('LC') || workId.startsWith('CC')) {
    return { key: '23 新編部類', order: 23 };
  }
  if (workId.startsWith('N')) {
    return { key: '22 南傳大藏經部類', order: 22 };
  }
  if (workId.startsWith('D')) {
    return { key: '21 國圖善本部類', order: 21 };
  }

  const cat = (b.category || '').trim();
  if (cat) {
    for (let i = 0; i < CBETA_DEPT_CATEGORIES.length; i++) {
      const item = CBETA_DEPT_CATEGORIES[i];
      if (
        cat.includes(item.name) || 
        cat.includes(item.name.replace('類', '')) || 
        item.keywords.some(kw => cat.includes(kw))
      ) {
        return { key: item.key, order: i + 1 };
      }
    }
  }

  const title = (b.title || '').trim();
  for (let i = 0; i < CBETA_DEPT_CATEGORIES.length; i++) {
    const item = CBETA_DEPT_CATEGORIES[i];
    if (item.keywords.some(kw => title.includes(kw))) {
      return { key: item.key, order: i + 1 };
    }
  }

  return { key: '23 新編部類', order: 23 };
}

// 冊別智慧映射函式：依官方 6 大藏經分類編排 (修正太虛大師全書 TX... 誤入大正藏 T 之問題)
function getCanonCategoryInfo(b: BookMetadata): { key: string; order: number } {
  const workId = (b.workId || '').toUpperCase();
  
  // 💡 1. 優先根據 workId 前綴判定：近代新編文獻 (太虛 TX、印順 Y、呂澂 LC、演培 YP、CBETA選集 CC)
  if (['TX', 'Y', 'LC', 'YP', 'CC'].some(p => workId.startsWith(p))) {
    return { key: '近代新編文獻', order: 6 };
  }
  // 💡 2. 大正藏：必須以 T 開頭且非 TX
  if (workId.startsWith('T') && !workId.startsWith('TX')) {
    return { key: 'T 大正新脩大藏經', order: 1 };
  }
  // 💡 3. 卍續藏
  if (workId.startsWith('X')) {
    return { key: 'X 卍新纂續藏經選錄', order: 2 };
  }
  // 💡 4. 國圖善本
  if (workId.startsWith('D')) {
    return { key: 'D 國家圖書館善本佛典', order: 4 };
  }
  // 💡 5. 南傳大藏經
  if (workId.startsWith('N')) {
    return { key: 'N 漢譯南傳大藏經（元亨寺版）', order: 5 };
  }
  return { key: '歷代藏經補輯', order: 3 };
}

/**
 * 🌟 藏經書籍智慧排序：
 * 1. 先以英文字母順序排「TX…」、「Y…」（如太虛大師 TX... 先於 印順導師 Y...）
 * 2. 後再依數字順序從小到大排 01、02、03…（如 TXa001, TX0002, TX0003...；Y0001, Y0002, Y0042...）
 * (完美滿足圖4冊別排序與圖5作者排序需求)
 */
export function sortBooksByPrefixAndNumber(books: BookMetadata[]): BookMetadata[] {
  const getCanonCode = (id: string): string => {
    const clean = (id || '').trim().toUpperCase();
    const double = ['TX', 'GA', 'GB', 'LC', 'YP', 'CC', 'ZS', 'ZW'];
    for (const d of double) {
      if (clean.startsWith(d)) return d;
    }
    const single = clean.match(/^[A-Z]/);
    return single ? single[0] : 'T';
  };

  const getSortNumber = (b: BookMetadata): number => {
    const id = (b.workId || '').toUpperCase();
    // 序篇、目錄或 a001（如 TXa001 太虛大師全書編纂說明）視為第 0 編 (排在首位)
    if (id.includes('A00') || id.includes('A0') || id.startsWith('TXA') || id.startsWith('YA')) return -1;
    
    // 若 workId 包含 'N' 後綴流水編號 (如 TX01n0001, T08n0251)
    const nMatch = id.match(/N(\d+)/i);
    if (nMatch) {
      return parseInt(nMatch[1], 10);
    }

    // 🌟 核心：優先以 CBETA 權威經典編號 (workId) 提取純數字 (如 Y0001=>1, Y0030=>30, Y0042=>42, TX0001=>1, TX0020=>20, T0262=>262)
    // 絕不可提取包含跨冊符號的 vol 字串（如 'Y30..Y32' 曾被誤串接為 3032 導致跳號，'TX01..TX02' 曾被誤串接為 102）
    const match = id.match(/\d+/);
    if (match) {
      return parseInt(match[0], 10);
    }

    // 次要補底：若 workId 無純數字，才從 vol 提取首個數字區塊
    if (b.vol) {
      const volMatch = b.vol.match(/\d+/);
      if (volMatch) {
        return parseInt(volMatch[0], 10);
      }
    }

    return 9999;
  };

  return [...books].sort((a, b) => {
    const canonA = getCanonCode(a.workId);
    const canonB = getCanonCode(b.workId);

    // 1. 先以英文字母前綴順序排（如 TX... 先於 Y...）
    if (canonA !== canonB) {
      return canonA.localeCompare(canonB);
    }

    // 2. 同一藏經前綴下，依經典數字順序從小到大排（01、02、03...）
    const numA = getSortNumber(a);
    const numB = getSortNumber(b);
    if (numA !== numB) {
      return numA - numB;
    }

    // 3. 次要補底自然序
    return a.workId.localeCompare(b.workId, undefined, { numeric: true });
  });
}

export function BookshelfInteractivePlayground({
  downloadedBooks,
  favoriteWorkIds,
  recentReadsBooks,
  onSelectBook,
  onOpenBookMenu,
  onToggleFavorite,
  onDeleteBook
}: BookshelfInteractivePlaygroundProps) {
  // === 1. 頂部四大藏經分類切換：'category' (依部類) | 'volume' (依冊別) | 'author' (依作譯者) | 'dynasty' (依朝代) ===
  const [classificationMode, setClassificationMode] = useState<'category' | 'volume' | 'author' | 'dynasty'>('category');

  // === 2. 次層 4 大膠囊快捷過濾：'all' (全部) | 'downloads' (近期下載) | 'recent' (近期閱讀) | 'favorites' (我的最愛) ===
  const [statusFilter, setStatusFilter] = useState<'all' | 'downloads' | 'recent' | 'favorites'>('all');

  // === 3. 視圖切換 (圖2)：條列式 (list) vs 卡片式 (grid) ===
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // === 4. 資料庫容量模式：'real' (真實書櫃經典) ===
  const [dataScale] = useState<'real' | 'mass'>('real');

  // === 5. 折疊分組的展開狀態 ===
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // === 6. 本地經典選單彈窗（若外部未傳入 onOpenBookMenu 時之 Fallback） ===
  const [localTargetBook, setLocalTargetBook] = useState<BookMetadata | null>(null);

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
      return ['T0262', 'T0412', 'T0251', 'T0279', 'T0779', 'T0366', 'T0112'].includes(workId);
    }
    return favoriteWorkIds.includes(workId);
  };

  // 依 4 大膠囊篩選後的書籍清單
  const filteredBooks = useMemo(() => {
    if (statusFilter === 'favorites') {
      return activeBooksPool.filter(b => isFavorite(b.workId));
    }
    if (statusFilter === 'recent') {
      if (dataScale === 'mass') {
        return activeBooksPool.slice(0, 9);
      }
      const list = recentReadsBooks.length > 0 ? recentReadsBooks : activeBooksPool.slice(0, 2);
      return list.slice(0, 9);
    }
    if (statusFilter === 'downloads') {
      return [...activeBooksPool].reverse().slice(0, 9);
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

  // 依選取的維度進行分組，並嚴格依圖1、圖4之標準規範排序
  const groupedData = useMemo(() => {
    const groups: Record<string, { order: number; books: BookMetadata[] }> = {};

    filteredBooks.forEach(b => {
      let key = '未分類';
      let sortOrder = 999;

      if (classificationMode === 'category') {
        // 1. 依部類：依圖1加上 01、02... 並依 01~23 順序排列
        const info = getDeptCategoryInfo(b);
        key = info.key;
        sortOrder = info.order;
      } else if (classificationMode === 'volume') {
        // 2. 依冊別：依圖4之 6 大藏經分類編排 (修正圖3錯誤)
        const info = getCanonCategoryInfo(b);
        key = info.key;
        sortOrder = info.order;
      } else if (classificationMode === 'author') {
        const { authorName, dynastyOrder } = parseCreators(b.creators);
        key = authorName;
        sortOrder = dynastyOrder * 1000;
      } else if (classificationMode === 'dynasty') {
        const { dynastyName, dynastyOrder } = parseCreators(b.creators);
        key = dynastyName;
        sortOrder = dynastyOrder;
      }

      if (!groups[key]) {
        groups[key] = { order: sortOrder, books: [] };
      }
      groups[key].books.push(b);
    });

    // 🌟 組內書籍全面智慧排序：先以英文字順序排「TX…」、「Y…」，後再依數字順序從小到大排 01、02、03… (圖4 & 圖5 需求)
    Object.values(groups).forEach(g => {
      g.books = sortBooksByPrefixAndNumber(g.books);
    });

    // 依 order 排序分組，同 order 依名稱穩定字典序排列
    const sortedEntries = Object.entries(groups).sort((a, b) => {
      if (a[1].order !== b[1].order) {
        return a[1].order - b[1].order;
      }
      return a[0].localeCompare(b[0], 'zh-Hant');
    });
    const result: Record<string, BookMetadata[]> = {};
    sortedEntries.forEach(([key, val]) => {
      result[key] = val.books;
    });

    return result;
  }, [filteredBooks, classificationMode, HISTORICAL_CHRONOLOGY]);

  // 切換折疊組
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: prev[groupKey] === false ? true : false
    }));
  };

  // 點擊書籍右側「…」按鈕
  const handleOpenBookOptions = (book: BookMetadata) => {
    if (onOpenBookMenu) {
      onOpenBookMenu(book);
    } else {
      setLocalTargetBook(book);
    }
  };

  return (
    <div className="bookshelf-playground-root animate-fade-in" style={{ padding: '0 0.85rem 3rem 0.85rem' }}>
      {/* ========================================================================= */}
      {/* 🌟 吸頂浮動控制列：4 大分類切換 + 4 大膠囊快捷過濾 (圖1/圖3 往下拉時浮於上方控制列圖2之下) */}
      {/* ========================================================================= */}
      <div className="bookshelf-sticky-controls-header">
        {/* 🌟 1. 頂部第一層：4 大分類切換 (依部類 / 依冊別 / 依作譯者 / 依朝代) */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            background: 'rgba(0, 0, 0, 0.05)',
            borderRadius: '16px',
            padding: '4px',
            marginBottom: '0.55rem',
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

        {/* 🏷️ 2. 第二層：4 大膠囊快捷過濾 (圖5型式：膠囊小、文字小、單行不分兩行、點到的反灰深灰底) */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px'
          }}
        >
          {[
            { id: 'all', label: `全部 (${activeBooksPool.length})` },
            { id: 'downloads', label: '近期下載' },
            { id: 'recent', label: '上次閱讀' },
            { id: 'favorites', label: '我的最愛' }
          ].map(item => {
            const isActive = statusFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`bookshelf-filter-capsule ${isActive ? 'active' : ''}`}
                onClick={() => setStatusFilter(item.id as any)}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
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
              className="bookshelf-group-card"
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
                          className="bookshelf-book-row"
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

                          {/* 最右邊：最愛標記 + 小小圓圈圈/淺灰「…」選項 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            {isFavorite(book.workId) && (
                              <Heart size={14} fill="#e53e3e" color="#e53e3e" />
                            )}
                            <button
                              type="button"
                              className="horizontal-book-more-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBookOptions(book);
                              }}
                              title="經典選項"
                            >
                              <MoreVertical size={13} />
                            </button>
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
                          className="bookshelf-book-card"
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {isFavorite(book.workId) && <Heart size={13} fill="#e53e3e" color="#e53e3e" />}
                              <button
                                type="button"
                                className="horizontal-book-more-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenBookOptions(book);
                                }}
                                title="經典選項"
                              >
                                <MoreVertical size={13} />
                              </button>
                            </div>
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

      {/* 💡 本地經典選單彈窗（Fallback）：移至資料夾為淺灰禁用 */}
      {localTargetBook && (
        <div 
          className="search-dialog-overlay" 
          style={{ zIndex: 1200 }} 
          onClick={() => setLocalTargetBook(null)}
        >
          <div 
            className="changelog-dialog-card animate-slide-up" 
            style={{ width: '90%', maxWidth: '340px' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#8c4b27',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.8rem',
                fontWeight: 800,
                flexShrink: 0
              }}>
                {localTargetBook.workId}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>
                  {localTargetBook.title}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {localTargetBook.creators} · {localTargetBook.juansCount}卷
                </p>
              </div>
            </div>

            <div style={{ margin: '0.75rem 0', borderTop: '1px solid var(--border-color, rgba(0,0,0,0.1))' }} />

            {/* 3 個按鈕：移至資料夾 (淺灰禁用) | 加入我的最愛 | 刪除經文 */}
            <div className="action-buttons-grid-3">
              {/* 1. 移至資料夾 (淺灰，暫不開啟這個功能) */}
              <button 
                className="action-grid-btn"
                disabled={true}
                style={{ opacity: 0.35, cursor: 'not-allowed', filter: 'grayscale(1)', color: 'var(--text-muted)' }}
                title="移至資料夾 (暫未開啟)"
              >
                <FolderInput size={20} />
                <span style={{ color: 'var(--text-muted)' }}>移至資料夾</span>
              </button>

              <div className="action-grid-divider" />

              {/* 2. 我的最愛 */}
              <button 
                className="action-grid-btn"
                onClick={() => {
                  if (onToggleFavorite) {
                    onToggleFavorite(localTargetBook.workId);
                  }
                  setLocalTargetBook(null);
                }}
              >
                <Heart 
                  size={20} 
                  fill={isFavorite(localTargetBook.workId) ? "#e53e3e" : "none"} 
                  color={isFavorite(localTargetBook.workId) ? "#e53e3e" : "currentColor"} 
                />
                <span>{isFavorite(localTargetBook.workId) ? '取消最愛' : '加入最愛'}</span>
              </button>

              <div className="action-grid-divider" />

              {/* 3. 刪除經文 */}
              <button 
                className="action-grid-btn delete-action"
                onClick={() => {
                  if (onDeleteBook) {
                    onDeleteBook(localTargetBook.workId);
                  }
                  setLocalTargetBook(null);
                }}
              >
                <Trash2 size={20} />
                <span>刪除經文</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
