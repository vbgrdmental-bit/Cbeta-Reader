import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Heart, Clock, ChevronRight, ChevronDown, Check,
  Layers, BookOpen, User, Grid, List,
  MoreVertical, Play, Trash2, FileText, Sparkles,
  Calendar
} from 'lucide-react';
import type { BookMetadata } from '../../types/book';
import { getAllReadingLogs, type ReadingLogEntry } from '../../utils/db';
import { getRecentDownloadedBooks } from '../../utils/recentDownloads';
import { getRecentFavoriteBooks } from '../../utils/favoritesManager';
import { sanitizeCreators } from '../../builder/IndexBuilder';
import { 
  STATIC_DEPT_CATEGORIES, 
  STATIC_VOL_CATEGORIES, 
  HISTORICAL_DYNASTIES, 
  fetchCreatorsData 
} from './CbetaCatalogView';

export interface BookHubDetail {
  notesCount: number;
  lastReadJuan: string;
  lastReadProgress: number; // 0-100
  lastReadSnippet?: string; // 🌟 50-60 字上次閱讀停駐位置摘錄（前後以 … 包覆）
  totalReadingMinutes: number;
  readCount: number; // 累計閱讀次數
  practiceCount?: number; // 誦經累計部數
  todayPracticeCount?: number;
  cbetaVolumeInfo: string;
  readingHistoryRecords?: Array<{
    date: string;
    count: number;
    minutes: number;
  }>;
  sampleNotes: Array<{
    id: string;
    text: string;
    note?: string;
    date: string;
    juan: number;
    segmentId?: string;
  }>;
}

const BOOK_HUB_RETURN_KEY = 'cbeta_return_book_hub';

export function saveBookHubReturnState(workId: string, tab: 'intro' | 'reading', subTab?: 'history' | 'notes' | 'timeline') {
  try {
    sessionStorage.setItem(BOOK_HUB_RETURN_KEY, JSON.stringify({ workId, tab, subTab: subTab || 'history' }));
  } catch {}
}

export function clearBookHubReturnState() {
  try {
    sessionStorage.removeItem(BOOK_HUB_RETURN_KEY);
  } catch {}
}

export function getBookHubReturnState(): { workId: string; tab: 'intro' | 'reading'; subTab: 'history' | 'notes' | 'timeline' } | null {
  try {
    const str = sessionStorage.getItem(BOOK_HUB_RETURN_KEY);
    if (!str) return null;
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// 💡 預載精華經典 360° 全息整合數據 (以 T0412 地藏經為旗艦範例，嚴格遵循零篡改真實經文原則)
export const BOOK_HUB_REGISTRY: Record<string, BookHubDetail> = {
  T0412: {
    notesCount: 5,
    lastReadJuan: '卷上 · 忉利天宮神通品第一',
    lastReadProgress: 45,
    lastReadSnippet: '…爾時十方無量世界，不可說不可說一切諸佛，及大菩薩摩訶薩，皆來集會。讚歎釋迦牟尼佛，能於五濁惡世，現不可思議大智慧神通之力，調伏剛強眾生…',
    totalReadingMinutes: 135,
    readCount: 21,
    practiceCount: 21,
    todayPracticeCount: 1,
    cbetaVolumeInfo: '大正新脩大藏經 第十三冊 No. 412 (本緣部類)',
    readingHistoryRecords: [
      { date: '2026-10-18', count: 1, minutes: 45 },
      { date: '2026-10-15', count: 1, minutes: 45 },
      { date: '2026-10-12', count: 1, minutes: 45 }
    ],
    sampleNotes: [
      {
        id: 'n-t412-1',
        text: '閻浮提眾生，身口意業，惡習結業，善因難植。',
        note: '隨時觀照身口意三業，慎勿隨境造惡。',
        date: '2026-10-15',
        juan: 1
      },
      {
        id: 'n-t412-2',
        text: '若遇殺生者，說宿殃短命報；若遇竊盜者，說貧窮苦楚報。',
        note: '因果業報絲毫不爽，應行十善布施戒殺。',
        date: '2026-10-14',
        juan: 1
      },
      {
        id: 'n-t412-3',
        text: '地獄不空，誓不成佛；眾生度盡，方證菩提。',
        note: '大願地藏王菩薩大悲宏深，頂禮效學。',
        date: '2026-10-12',
        juan: 1
      },
      {
        id: 'n-t412-4',
        text: '若有眾生，出佛身血，毀謗三寶，不敬尊經，亦當墮於無間地獄。',
        date: '2026-10-10',
        juan: 1
      },
      {
        id: 'n-t412-5',
        text: '未來世中，若有善男子、善女人，聞是地藏菩薩摩訶薩名者，或讚歎，或瞻禮，或稱名，或供養，是人當得百返生於三十三天，永不墮惡道。',
        note: '稱名念誦功德殊勝。',
        date: '2026-10-08',
        juan: 2
      }
    ]
  },
  T0251: {
    notesCount: 3,
    lastReadJuan: '全一卷 · 般若波羅蜜多心經',
    lastReadProgress: 100,
    lastReadSnippet: '…舍利子，色不異空，空不異色，色即是空，空即是色，受想行識亦復如是。舍利子，是諸法空相，不生不滅，不垢不淨，不增不減。是故空中無色，無受想行識…',
    totalReadingMinutes: 85,
    readCount: 108,
    practiceCount: 108,
    todayPracticeCount: 3,
    cbetaVolumeInfo: '大正新脩大藏經 第八冊 No. 251 (般若部類)',
    readingHistoryRecords: [
      { date: '2026-10-18', count: 3, minutes: 15 },
      { date: '2026-10-17', count: 5, minutes: 25 },
      { date: '2026-10-16', count: 4, minutes: 20 },
      { date: '2026-10-15', count: 6, minutes: 25 }
    ],
    sampleNotes: [
      {
        id: 'n-t251-1',
        text: '照見五蘊皆空，度一切苦厄。',
        note: '觀照色受想行識皆無自性，方能拔除執著苦本。',
        date: '2026-10-16',
        juan: 1
      },
      {
        id: 'n-t251-2',
        text: '色不異空，空不異色；色即是空，空即是色。',
        note: '真空妙有，不偏空亦不住有。',
        date: '2026-10-15',
        juan: 1
      },
      {
        id: 'n-t251-3',
        text: '心無罣礙，無罣礙故，無有恐怖，遠離顛倒夢想，究竟涅槃。',
        note: '放下得失妄念，本自具足寂靜。',
        date: '2026-10-13',
        juan: 1
      }
    ]
  },
  T0262: {
    notesCount: 4,
    lastReadJuan: '卷一 · 方便品第二',
    lastReadProgress: 30,
    lastReadSnippet: '…爾時世尊從三昧安詳而起，告舍利弗：諸佛智慧甚深無量，其智慧門難解難入，一切聲聞、辟支佛所不能知。所以者何？佛曾親近百千萬億無數諸佛，盡行諸佛無量道法…',
    totalReadingMinutes: 180,
    readCount: 7,
    practiceCount: 7,
    todayPracticeCount: 0,
    cbetaVolumeInfo: '大正新脩大藏經 第九冊 No. 262 (法華部類)',
    readingHistoryRecords: [
      { date: '2026-10-17', count: 1, minutes: 60 },
      { date: '2026-10-11', count: 1, minutes: 60 },
      { date: '2026-10-09', count: 1, minutes: 60 }
    ],
    sampleNotes: [
      {
        id: 'n-t262-1',
        text: '諸佛世尊，唯以一大事因緣故出現於世。欲令眾生開佛知見，使得清淨故。',
        note: '開示悟入佛之知見，純圓獨妙。',
        date: '2026-10-11',
        juan: 1
      },
      {
        id: 'n-t262-2',
        text: '三界無安，猶如火宅，眾苦充滿，甚可怖畏。',
        note: '火宅三車喻，方便開顯真實。',
        date: '2026-10-09',
        juan: 2
      }
    ]
  }
};

interface BookshelfInteractivePlaygroundProps {
  downloadedBooks: BookMetadata[];
  favoriteWorkIds: string[];
  recentReadsBooks: BookMetadata[];
  onSelectBook: (workId: string, segmentId?: string, searchQuery?: string, autoResumeMode?: 'resume' | 'restart') => void;
  onExitDemo?: () => void;
  onOpenBookMenu?: (book: BookMetadata) => void;
  onToggleFavorite?: (workId: string) => void;
  onDeleteBook?: (workId: string) => void;
  onNavigateToCatalogCategory?: (target: {
    tab: 'favorite' | 'dept' | 'vol' | 'creator' | 'time';
    node?: { id: string; label: string };
    stack?: Array<{ id: string; label: string }>;
  }) => void;
  statusFilter?: 'all' | 'downloads' | 'recent' | 'favorites';
  onStatusFilterChange?: (filter: 'all' | 'downloads' | 'recent' | 'favorites') => void;
  allHighlights?: any[];
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
  { workId: 'X1487', title: '慈悲地藏菩薩懺法', canon: 'X', vol: 'X74', creators: '清', juansCount: 3, category: '大集部類', cjkChars: 14282 },

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
export function getDeptCategoryInfo(b: BookMetadata): { key: string; order: number } {
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
export function getCanonCategoryInfo(b: BookMetadata): { key: string; order: number } {
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

// CBETA 權威歷史朝代年表 (依時間先後嚴格排序)
export const HISTORICAL_CHRONOLOGY = [
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
];

// 輔助函式：從 creators 智慧提取朝代與作譯者名稱 (精準解析「彌勒菩薩說 · 唐 玄奘譯」等造論與譯者多層結構)
export function parseCreators(creatorsStr?: string) {
  const raw = (creatorsStr || '').trim();
  if (!raw || raw === 'CBETA' || raw === 'CBETA 大藏經' || raw === '未知' || raw === 'unknown') {
    return { 
      dynastyName: '其他', 
      dynastyOrder: 99, 
      dynastyDisplay: '', 
      authorName: '佚名', 
      authorDisplay: '' 
    };
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
    if (d.name === '其他') continue;
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

  // 3. 提取作譯者文字與純粹作譯者名稱
  // 3a. 作譯者顯示字串（保留動作如「玄奘譯」、「慧菀述」，但去除朝代）
  let authorDisplay = translationPart;
  if (matchedAlias) {
    const aliasRegex = new RegExp(`^${matchedAlias}\\s*|\\s*${matchedAlias}\\s*`, 'g');
    authorDisplay = authorDisplay.replace(aliasRegex, '').trim();
  }

  // 3b. 純粹作譯者名稱（去除「譯/述/造/撰」等，供目錄分組使用）
  let authorName = authorDisplay.replace(/(等?[譯述造說撰集錄編纂著]+|等)$/g, '').trim();

  // 若扣除朝代後已無作者（例如 creators 僅標記朝代如「清」、「唐」）
  if (!authorName) {
    authorName = '佚名';
    authorDisplay = '';
  }

  const dynastyDisplay = matchedDynasty.name !== '其他' ? matchedDynasty.name : '';

  return { 
    dynastyName: matchedDynasty.name, 
    dynastyOrder: matchedDynasty.order, 
    dynastyDisplay,
    authorName, 
    authorDisplay 
  };
}

export function BookshelfInteractivePlayground({
  downloadedBooks,
  favoriteWorkIds,
  recentReadsBooks,
  onSelectBook,
  onOpenBookMenu: _onOpenBookMenu,
  onToggleFavorite,
  onDeleteBook,
  onNavigateToCatalogCategory,
  statusFilter: propStatusFilter,
  onStatusFilterChange,
  allHighlights = []
}: BookshelfInteractivePlaygroundProps) {
  // === 1. 頂部四大藏經分類切換：'category' (依部類) | 'volume' (依冊別) | 'author' (依作譯者) | 'dynasty' (依朝代) ===
  const [classificationMode, setClassificationMode] = useState<'category' | 'volume' | 'author' | 'dynasty'>('category');

  // === 2. 次層 4 大膠囊快捷過濾：'all' (全部) | 'downloads' (近期下載) | 'recent' (近期閱讀) | 'favorites' (我的最愛) ===
  const [internalStatusFilter, setInternalStatusFilter] = useState<'all' | 'downloads' | 'recent' | 'favorites'>(propStatusFilter || 'all');

  useEffect(() => {
    if (propStatusFilter !== undefined) {
      setInternalStatusFilter(propStatusFilter);
    }
  }, [propStatusFilter]);

  const statusFilter = propStatusFilter !== undefined ? propStatusFilter : internalStatusFilter;

  const handleStatusFilterChange = (newFilter: 'all' | 'downloads' | 'recent' | 'favorites') => {
    setInternalStatusFilter(newFilter);
    if (onStatusFilterChange) {
      onStatusFilterChange(newFilter);
    }
  };
  void handleStatusFilterChange;

  // === 3. 視圖切換 (圖2)：條列式 (list) vs 卡片式 (grid) ===
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // === 4. 資料庫容量模式：'real' (真實書櫃經典) ===
  const [dataScale] = useState<'real' | 'mass'>('real');

  // === 5. 折疊分組的展開狀態 ===
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // === 6. 本地經典選單彈窗（若外部未傳入 onOpenBookMenu 時之 Fallback） ===
  const [localTargetBook, setLocalTargetBook] = useState<BookMetadata | null>(null);

  // === 7. 方案 B：維度切換輕量 Popover 浮動選單狀態 ===
  const [showDimPopover, setShowDimPopover] = useState(false);

  // === 8. 🌟 經典全息整合中樞 (Book 360° Hub) 互動狀態 (方案 A：雙層分類) ===
  const [bookHubTarget, setBookHubTarget] = useState<BookMetadata | null>(null);
  const [bookHubTab, setBookHubTab] = useState<'intro' | 'reading'>('intro');
  const [readingSubTab, setReadingSubTab] = useState<'history' | 'notes' | 'timeline'>('history');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [hubPracticeCounts] = useState<Record<string, number>>({
    T0412: 21,
    T0251: 108,
    T0262: 7
  });

  // 💡 自動監聽上一頁返回事件：若在經書閱讀器點「←」返回，無縫恢復剛剛開啟的全息視窗（圖5）
  useEffect(() => {
    const checkAndRestore = () => {
      const saved = getBookHubReturnState();
      if (!saved) return;
      const targetBook = downloadedBooks.find(b => b.workId === saved.workId) ||
                         SIMULATED_120_BOOKS.find(b => b.workId === saved.workId);
      if (targetBook) {
        setBookHubTarget(targetBook);
        setBookHubTab(saved.tab);
        if (saved.subTab) {
          setReadingSubTab(saved.subTab);
        }
        clearBookHubReturnState();
      }
    };

    window.addEventListener('cbeta_restore_book_hub', checkAndRestore);
    checkAndRestore();

    return () => {
      window.removeEventListener('cbeta_restore_book_hub', checkAndRestore);
    };
  }, [downloadedBooks]);

  const formatEstimatedReadingTime = (chars: number) => {
    if (!chars || chars <= 0) return '—';
    const mins = Math.max(1, Math.round(chars / 250));
    if (mins < 60) return `${mins} 分鐘`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours} 小時 ${remMins} 分鐘` : `${hours} 小時`;
  };

  // 💡 載入讀者真實的每日閱讀日誌 (Reading Logs)
  const [readingLogs, setReadingLogs] = useState<ReadingLogEntry[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadReadingLogs = async () => {
      try {
        const logs = await getAllReadingLogs();
        if (isMounted) setReadingLogs(logs);
      } catch (err) {
        console.error('Failed to load reading logs for book hub:', err);
      }
    };
    loadReadingLogs();
    const handleLogUpdate = () => loadReadingLogs();
    window.addEventListener('cbeta_reading_log_saved', handleLogUpdate);
    window.addEventListener('storage', handleLogUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('cbeta_reading_log_saved', handleLogUpdate);
      window.removeEventListener('storage', handleLogUpdate);
    };
  }, []);

  const getBookHubDetail = (workId: string): BookHubDetail => {
    // 💡 1. 讀取讀者真實的劃線與筆記
    const userNotes = (allHighlights || [])
      .filter(h => h.workId === workId)
      .map(h => ({
        id: h.id,
        text: h.text,
        note: h.note,
        date: new Date(h.createdAt || Date.now()).toISOString().split('T')[0],
        juan: h.juan || 1,
        segmentId: h.segmentId
      }));

    // 💡 2. 讀取讀者真實的閱讀日誌 (時數、次數與各日明細)
    const bookLogs = (readingLogs || []).filter(l => l.workId === workId);
    const totalReadingMinutes = bookLogs.reduce((acc, cur) => acc + (cur.durationMinutes || 0), 0);
    const readCount = bookLogs.length;

    const dateMap = new Map<string, { count: number; minutes: number }>();
    bookLogs.forEach(l => {
      const d = l.date || '未知日期';
      const cur = dateMap.get(d) || { count: 0, minutes: 0 };
      cur.count += 1;
      cur.minutes += (l.durationMinutes || 0);
      dateMap.set(d, cur);
    });
    const readingHistoryRecords = Array.from(dateMap.entries())
      .map(([date, val]) => ({ date, count: val.count, minutes: val.minutes }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // 💡 3. 讀取讀者真實的閱讀進度與經文摘錄
    let lastReadJuan = '未開始閱讀';
    let lastReadProgress = 0;
    let lastReadSnippet = '';

    try {
      const progressStr = localStorage.getItem(`reader_progress_${workId}`);
      if (progressStr) {
        const p = JSON.parse(progressStr);
        if (p.juan) {
          lastReadJuan = `第 ${p.juan} 卷`;
        }
        if (typeof p.percent === 'number' && p.percent > 0) {
          lastReadProgress = Math.min(100, Math.max(1, Math.round(p.percent)));
        } else if (p.juan) {
          lastReadProgress = 5;
        }
        if (p.text && p.text.trim()) {
          const clean = p.text.replace(/\s+/g, ' ').trim();
          lastReadSnippet = clean.length > 70 ? `…${clean.slice(0, 60)}…` : `…${clean}…`;
        }
      }
    } catch {}

    // 若曾有閱讀紀錄但未滾動記錄百分比，自動標記為第 1 卷已開卷
    if (lastReadJuan === '未開始閱讀' && (totalReadingMinutes > 0 || readCount > 0)) {
      lastReadJuan = '第 1 卷';
      lastReadProgress = 5;
    }

    const reg = BOOK_HUB_REGISTRY[workId];
    if (!lastReadSnippet) {
      if (reg?.lastReadSnippet) {
        lastReadSnippet = reg.lastReadSnippet;
      } else {
        lastReadSnippet = '…如是我聞。一時佛在舍衛國祇樹給孤獨園，與大比丘眾千二百五十人俱。爾時世尊食時，著衣持缽，入舍衛大城乞食…';
      }
    }

    return {
      notesCount: userNotes.length > 0 ? userNotes.length : (reg?.notesCount ?? 0),
      lastReadJuan: lastReadProgress > 0 ? lastReadJuan : (reg?.lastReadJuan ?? '未開始閱讀'),
      lastReadProgress: lastReadProgress > 0 ? lastReadProgress : (reg?.lastReadProgress ?? 0),
      lastReadSnippet: lastReadSnippet,
      totalReadingMinutes: totalReadingMinutes > 0 ? totalReadingMinutes : (reg?.totalReadingMinutes ?? 0),
      readCount: readCount > 0 ? readCount : (reg?.readCount ?? 0),
      practiceCount: hubPracticeCounts[workId] ?? (reg?.practiceCount ?? 0),
      todayPracticeCount: reg?.todayPracticeCount ?? 0,
      cbetaVolumeInfo: reg?.cbetaVolumeInfo || 'CBETA 電子佛典集成',
      readingHistoryRecords: readingHistoryRecords.length > 0 ? readingHistoryRecords : (reg?.readingHistoryRecords ?? []),
      sampleNotes: userNotes.length > 0 ? userNotes : (reg?.sampleNotes ?? [])
    };
  };

  const handleOpenBookHub = (
    book: BookMetadata, 
    tab: 'intro' | 'reading' | 'notes' | 'history' | 'timeline' | 'overview' = 'intro',
    subTab?: 'history' | 'notes' | 'timeline'
  ) => {
    setBookHubTarget(book);
    if (tab === 'intro') {
      setBookHubTab('intro');
      if (subTab) setReadingSubTab(subTab);
    } else if (tab === 'reading') {
      setBookHubTab('reading');
      if (subTab) setReadingSubTab(subTab);
    } else {
      setBookHubTab('reading');
      setReadingSubTab(tab === 'notes' ? 'notes' : tab === 'timeline' ? 'timeline' : 'history');
    }
  };

  // 點擊書籍右側「…」按鈕，直接打開 360° 經典全息整合視窗（預設第 1 控制鍵：書籍簡介）
  const handleOpenBookOptions = (book: BookMetadata) => {
    handleOpenBookHub(book, 'intro');
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      if (showDimPopover) setShowDimPopover(false);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [showDimPopover]);

  const classificationLabels: Record<string, string> = {
    category: '依部類',
    volume: '依冊別',
    author: '依作譯者',
    dynasty: '依朝代'
  };

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
      if (dataScale === 'mass') {
        return activeBooksPool.filter(b => isFavorite(b.workId));
      }
      return getRecentFavoriteBooks(activeBooksPool);
    }
    if (statusFilter === 'recent') {
      if (dataScale === 'mass') {
        return activeBooksPool.slice(0, 9);
      }
      const list = recentReadsBooks.length > 0 ? recentReadsBooks : activeBooksPool.slice(0, 2);
      return list.slice(0, 9);
    }
    if (statusFilter === 'downloads') {
      return getRecentDownloadedBooks(activeBooksPool);
    }
    return activeBooksPool;
  }, [activeBooksPool, statusFilter, dataScale, recentReadsBooks, favoriteWorkIds]);



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

  // 💡 點擊書櫃分組標題文字（依部類 / 依冊別 / 依作譯者 / 依朝代），精確導航至 CBETA 藏經庫對應目錄
  const handleGroupTitleClick = async (e: React.MouseEvent, groupTitle: string) => {
    if (!onNavigateToCatalogCategory) return;
    e.stopPropagation();

    if (classificationMode === 'category') {
      const code = groupTitle.slice(0, 2);
      const deptMatch = STATIC_DEPT_CATEGORIES.find(c => 
        c.id === `CBETA.0${code}` || c.label.startsWith(groupTitle) || c.label.startsWith(code)
      );
      if (deptMatch) {
        onNavigateToCatalogCategory({
          tab: 'dept',
          node: { id: deptMatch.id, label: deptMatch.label }
        });
      }
    } else if (classificationMode === 'volume') {
      const volMatch = STATIC_VOL_CATEGORIES.find(c => 
        c.label === groupTitle || 
        c.label.startsWith(groupTitle) || 
        groupTitle.startsWith(c.label.slice(0, 4)) ||
        (groupTitle.startsWith('T ') && c.id === 'orig-T') ||
        (groupTitle.startsWith('X ') && c.id === 'orig-X') ||
        (groupTitle.startsWith('D ') && c.id === 'orig-D') ||
        (groupTitle.startsWith('N ') && c.id === 'orig-N')
      );
      if (volMatch) {
        onNavigateToCatalogCategory({
          tab: 'vol',
          node: { id: volMatch.id, label: volMatch.label }
        });
      }
    } else if (classificationMode === 'author') {
      const cleanAuthor = groupTitle.trim();
      if (!cleanAuthor || cleanAuthor === '佚名') return;

      try {
        const creatorsData = await fetchCreatorsData();
        let matchedStrokeCat: any = null;
        let matchedGroup: any = null;
        let matchedPerson: any = null;

        // 1. 第一優先：完全精確匹配 (避免「竺法護」被子字串模糊匹配至「法護」)
        for (const strokeCat of creatorsData) {
          for (const g of strokeCat.groups) {
            for (const c of g.creators) {
              if (
                c.name === cleanAuthor ||
                c.displayName === cleanAuthor ||
                c.displayName.startsWith(`${cleanAuthor} (`)
              ) {
                matchedStrokeCat = strokeCat;
                matchedGroup = g;
                matchedPerson = c;
                break;
              }
            }
            if (matchedPerson) break;
          }
          if (matchedPerson) break;
        }

        // 2. 次要優先：首字與前綴開頭完全相符
        if (!matchedPerson) {
          for (const strokeCat of creatorsData) {
            for (const g of strokeCat.groups) {
              for (const c of g.creators) {
                if (c.name.startsWith(cleanAuthor) || c.displayName.startsWith(cleanAuthor)) {
                  matchedStrokeCat = strokeCat;
                  matchedGroup = g;
                  matchedPerson = c;
                  break;
                }
              }
              if (matchedPerson) break;
            }
            if (matchedPerson) break;
          }
        }

        // 3. 第三優先：若 cleanAuthor 含有敬稱或綴字（例如「玄奘大師」-> c.name === '玄奘'）
        if (!matchedPerson) {
          for (const strokeCat of creatorsData) {
            for (const g of strokeCat.groups) {
              for (const c of g.creators) {
                if (cleanAuthor.startsWith(c.name) && c.name.length >= 2) {
                  matchedStrokeCat = strokeCat;
                  matchedGroup = g;
                  matchedPerson = c;
                  break;
                }
              }
              if (matchedPerson) break;
            }
            if (matchedPerson) break;
          }
        }

        if (matchedPerson && matchedGroup && matchedStrokeCat) {
          onNavigateToCatalogCategory({
            tab: 'creator',
            stack: [
              { id: 'creator_root', label: '依作譯者' },
              { id: `creator_stroke_${matchedStrokeCat.stroke}`, label: matchedStrokeCat.label },
              { id: `creator_group_${matchedStrokeCat.stroke}_${matchedGroup.firstChar}`, label: matchedGroup.firstChar },
              { id: `creator_person_${matchedPerson.creatorId}`, label: matchedPerson.displayName }
            ]
          });
        } else {
          // 若本機資料庫無收錄則備用搜尋模式
          onNavigateToCatalogCategory({
            tab: 'creator',
            stack: [
              { id: 'creator_root', label: '依作譯者' },
              { id: `creator_search_${cleanAuthor}`, label: cleanAuthor }
            ]
          });
        }
      } catch (err) {
        console.error('Failed to resolve author stack:', err);
      }
    } else if (classificationMode === 'dynasty') {
      const cleanDynasty = groupTitle.trim();
      const dynastyMatch = HISTORICAL_DYNASTIES.find(d => 
        cleanDynasty.includes(d.query) || 
        d.name.includes(cleanDynasty) || 
        d.query.includes(cleanDynasty.replace(/[朝代]/g, ''))
      );
      if (dynastyMatch) {
        onNavigateToCatalogCategory({
          tab: 'time',
          node: { id: `time_search_${dynastyMatch.query}`, label: dynastyMatch.name }
        });
      }
    }
  };


  return (
    <div className="bookshelf-playground-root animate-fade-in" style={{ padding: '0 0.85rem 3rem 0.85rem' }}>
      {/* ========================================================================= */}
      {/* 🌟 吸頂浮動控制列：方案 B 單行極致精簡水平膠囊列 (高度約 38px)             */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 📊 統計資訊 ＋ 圖 3 切換按鈕 ＋ 圖 2「依部類」膠囊 (同行並列，圖 3 在膠囊左邊) */}
      {/* ========================================================================= */}
      <div 
        className="bookshelf-sticky-summary-bar"
      >
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          共 {filteredBooks.length} 部經典
        </div>

        {/* 右側：圖 3 切換滑塊 ＋ 圖 2 依部類膠囊 (圖 3 整個在「依部類」膠囊的左邊) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          {/* 圖 3：條列式 (List) 與 卡片式 (Grid) 切換 */}
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

          {/* 圖 2：依部類膠囊 (下移至圖 3 右側，點選切換 4 分類維度) */}
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              type="button"
              className={`bookshelf-dim-dropdown-btn ${showDimPopover ? 'active-open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowDimPopover(!showDimPopover);
              }}
              title="切換經藏分類維度"
            >
              <span>• {classificationLabels[classificationMode]}</span>
              <ChevronDown 
                size={11} 
                style={{ 
                  transform: showDimPopover ? 'rotate(180deg)' : 'none', 
                  transition: 'transform 0.2s ease' 
                }} 
              />
            </button>

            {/* 4 分類維度輕量 Popover 浮動選單 */}
            {showDimPopover && (
              <div 
                className="bookshelf-dim-popover-menu animate-fade-in"
                style={{ right: '0' }}
                onClick={(e) => e.stopPropagation()}
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
                    <div
                      key={item.id}
                      className={`bookshelf-dim-popover-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setClassificationMode(item.id as any);
                        setShowDimPopover(false);
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconComp size={13} />
                        <span>{item.label}</span>
                      </span>
                      {isActive && <Check size={12} strokeWidth={2.5} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📚 4. 主體內容：分組經典呈現 (條列式 vs 卡片式)                             */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {Object.entries(groupedData).map(([groupTitle, books]) => {
          const isExpanded = expandedGroups[groupTitle] !== false; // 預設全部展開
          const isLinkable = !!onNavigateToCatalogCategory && groupTitle !== '未分類' && groupTitle !== '佚名' && groupTitle !== '其他';

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
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--theme-accent, #8c4b27)' }} />
                  <span 
                    className={isLinkable ? "bookshelf-group-title-link" : ""}
                    onClick={(e) => {
                      if (isLinkable) {
                        handleGroupTitleClick(e, groupTitle);
                      }
                    }}
                    style={{ 
                      fontSize: '0.94rem', 
                      fontWeight: 800, 
                      color: 'var(--text-primary)', 
                      fontFamily: 'var(--font-serif)',
                      cursor: isLinkable ? 'pointer' : 'inherit'
                    }}
                    title={isLinkable ? `前往 CBETA 藏經庫瀏覽「${groupTitle}」` : undefined}
                  >
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
                            <div className="bookshelf-book-badge">
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

                          {/* 最右邊：淺淺色愛心（可點選加入/取消最愛） + 小小圓圈圈/淺灰「…」選項 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            <button
                              type="button"
                              className={`horizontal-book-fav-btn ${isFavorite(book.workId) ? 'is-fav' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onToggleFavorite) onToggleFavorite(book.workId);
                              }}
                              title={isFavorite(book.workId) ? '已加入我的最愛 (點擊取消)' : '加入我的最愛'}
                              aria-label={isFavorite(book.workId) ? '取消我的最愛' : '加入我的最愛'}
                            >
                              <Heart 
                                size={14} 
                                fill={isFavorite(book.workId) ? "#e53e3e" : "none"} 
                                color={isFavorite(book.workId) ? "#e53e3e" : "currentColor"} 
                                style={{ strokeWidth: isFavorite(book.workId) ? 2 : 1.8 }}
                              />
                            </button>
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
                      {books.map(book => {
                        const hubDetail = getBookHubDetail(book.workId);
                        return (
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
                              <span className="bookshelf-grid-tag">
                                {book.workId}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  className={`horizontal-book-fav-btn ${isFavorite(book.workId) ? 'is-fav' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onToggleFavorite) onToggleFavorite(book.workId);
                                  }}
                                  title={isFavorite(book.workId) ? '已加入我的最愛 (點擊取消)' : '加入我的最愛'}
                                  aria-label={isFavorite(book.workId) ? '取消我的最愛' : '加入我的最愛'}
                                >
                                  <Heart 
                                    size={13} 
                                    fill={isFavorite(book.workId) ? "#e53e3e" : "none"} 
                                    color={isFavorite(book.workId) ? "#e53e3e" : "currentColor"} 
                                    style={{ strokeWidth: isFavorite(book.workId) ? 2 : 1.8 }}
                                  />
                                </button>
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
                            {hubDetail && hubDetail.notesCount > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color, rgba(0,0,0,0.06))' }}>
                                <span style={{ fontSize: '0.66rem', color: '#2e7d32', fontWeight: 600 }}>
                                  📝 {hubDetail.notesCount} 筆記
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 經典更多選項對話框 */}
      {localTargetBook && typeof document !== 'undefined' && createPortal(
        <div 
          className="search-dialog-overlay" 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999998, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
          onClick={() => setLocalTargetBook(null)}
        >
          <div 
            className="changelog-dialog-card animate-slide-up" 
            style={{ width: '90%', maxWidth: '340px' }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div className="bookshelf-book-badge" style={{ borderRadius: '10px', fontSize: '0.76rem' }}>
                  {localTargetBook.workId}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {localTargetBook.title}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {localTargetBook.creators} · {localTargetBook.juansCount}卷
                  </p>
                </div>
              </div>

              {/* 右上角愛心收藏按鈕 */}
              <button
                type="button"
                className={`modal-fav-heart-btn ${isFavorite(localTargetBook.workId) ? 'is-favorite' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleFavorite) {
                    onToggleFavorite(localTargetBook.workId);
                  }
                }}
                title={isFavorite(localTargetBook.workId) ? '已加入我的最愛 (點擊取消)' : '加入我的最愛'}
              >
                <Heart 
                  size={18} 
                  fill={isFavorite(localTargetBook.workId) ? "#e53e3e" : "none"} 
                  color={isFavorite(localTargetBook.workId) ? "#e53e3e" : "var(--text-muted)"} 
                />
              </button>
            </div>

            <div style={{ margin: '0.75rem 0', borderTop: '1px solid var(--border-color, rgba(0,0,0,0.1))' }} />

            {/* 彈窗底膠囊列：刪除經文 | 繼續閱讀 */}
            <div className="modal-action-capsules-row" style={{ marginTop: '0.65rem' }}>
              <button 
                type="button"
                className="modal-capsule-btn delete-capsule"
                onClick={() => {
                  if (onDeleteBook) {
                    onDeleteBook(localTargetBook.workId);
                  }
                  setLocalTargetBook(null);
                }}
              >
                <Trash2 size={15} />
                <span>刪除經文</span>
              </button>

              <button 
                type="button"
                className="modal-capsule-btn resume-capsule"
                onClick={() => {
                  onSelectBook(localTargetBook.workId);
                  setLocalTargetBook(null);
                }}
              >
                <Play size={15} fill="currentColor" />
                <span>繼續閱讀</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🌟 經典全息檔案中樞 (Book 360° Hub) 互動彈窗 (方案 A：雙層結構，高度鎖定零跳動) */}
      {bookHubTarget && typeof document !== 'undefined' && createPortal(
        (() => {
          const hub = getBookHubDetail(bookHubTarget.workId);

          return (
            <div 
              className="book-hub-modal-overlay"
              onClick={() => {
                setBookHubTarget(null);
                clearBookHubReturnState();
              }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999999,
                backgroundColor: 'rgba(0, 0, 0, 0.72)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                animation: 'fadeIn 0.15s ease-out'
              }}
            >
              <div 
                className="book-hub-modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: '430px',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  backgroundColor: 'var(--surface-modal, #ffffff)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  color: 'var(--text-primary, #261c14)',
                  borderRadius: '20px',
                  border: '1.5px solid var(--surface-modal-border, var(--border-color, rgba(139, 90, 43, 0.35)))',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
                  padding: '18px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative'
                }}
              >
                {/* 頂部標題列與右上角收藏+關閉按鈕 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div className="bookshelf-book-badge" style={{ borderRadius: '10px', fontSize: '0.8rem', padding: '4px 8px', flexShrink: 0 }}>
                      {bookHubTarget.workId}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bookHubTarget.title}
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bookHubTarget.creators} · {bookHubTarget.juansCount}卷
                      </p>
                    </div>
                  </div>

                  {/* 右側操作區：愛心收藏 + 關閉 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className={`modal-fav-heart-btn ${isFavorite(bookHubTarget.workId) ? 'is-favorite' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleFavorite) onToggleFavorite(bookHubTarget.workId);
                      }}
                      title={isFavorite(bookHubTarget.workId) ? '已加入我的最愛 (點擊取消)' : '加入我的最愛'}
                      style={{
                        border: 'none',
                        background: 'var(--surface-capsule, rgba(0,0,0,0.06))',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Heart 
                        size={17} 
                        fill={isFavorite(bookHubTarget.workId) ? "#e53e3e" : "none"} 
                        color={isFavorite(bookHubTarget.workId) ? "#e53e3e" : "var(--text-muted)"} 
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBookHubTarget(null);
                        clearBookHubReturnState();
                      }}
                      style={{
                        border: 'none',
                        background: 'var(--surface-capsule, rgba(0,0,0,0.06))',
                        borderRadius: '50%',
                        width: '30px',
                        height: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '0.9rem'
                      }}
                      title="關閉"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* 🌟 一級主分類：客觀書籍簡介 vs 個人閱讀概況 (大氣清雅白底浮動分段槽，與下方子膠囊及主行動鍵層次分明) */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '6px', 
                  padding: '3px', 
                  borderRadius: '12px', 
                  backgroundColor: 'var(--surface-capsule, rgba(0,0,0,0.06))', 
                  border: '1px solid var(--border-color, rgba(0,0,0,0.06))',
                  height: '40px',
                  boxSizing: 'border-box'
                }}>
                  <button
                    type="button"
                    onClick={() => setBookHubTab('intro')}
                    style={{
                      height: '100%',
                      borderRadius: '9px',
                      border: 'none',
                      backgroundColor: bookHubTab === 'intro' ? 'var(--surface-card, #ffffff)' : 'transparent',
                      color: bookHubTab === 'intro' ? 'var(--text-primary, #261c14)' : 'var(--text-secondary, #524038)',
                      boxShadow: bookHubTab === 'intro' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                      fontSize: '0.84rem',
                      fontWeight: bookHubTab === 'intro' ? 700 : 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <BookOpen size={15} />
                    <span>書籍簡介</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookHubTab('reading')}
                    style={{
                      height: '100%',
                      borderRadius: '9px',
                      border: 'none',
                      backgroundColor: bookHubTab === 'reading' ? 'var(--surface-card, #ffffff)' : 'transparent',
                      color: bookHubTab === 'reading' ? 'var(--text-primary, #261c14)' : 'var(--text-secondary, #524038)',
                      boxShadow: bookHubTab === 'reading' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                      fontSize: '0.84rem',
                      fontWeight: bookHubTab === 'reading' ? 700 : 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Sparkles size={15} />
                    <span>閱讀概況</span>
                    {(hub.notesCount > 0 || hub.lastReadProgress > 0) && (
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--theme-accent, #8b5a2b)',
                        display: 'inline-block'
                      }} />
                    )}
                  </button>
                </div>

                {/* 🌟 內容區域（根據一級分類呈現；高度精準配平 260px / 34px+6px+220px，換頁零跳動） */}
                {bookHubTab === 'intro' ? (
                  /* 1. 📖 客觀層級：書籍簡介 (完全對齊 CBETA 原版資訊) */
                  <div 
                    className="animate-fade-in" 
                    style={{ 
                      height: '260px', 
                      maxHeight: '260px', 
                      overflowY: 'auto', 
                      padding: '0.75rem 0.6rem',
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.55rem', 
                      fontSize: '0.86rem', 
                      color: 'var(--text-primary)', 
                      boxSizing: 'border-box',
                      backgroundColor: 'var(--surface-card, rgba(30, 36, 44, 0.88))',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.08))'
                    }}
                  >
                    <div><span style={{ color: 'var(--text-secondary, #524038)', fontWeight: 600 }}>作譯者 : </span>{sanitizeCreators(bookHubTarget.creators)}</div>
                    <div><span style={{ color: 'var(--text-secondary, #524038)', fontWeight: 600 }}>經號 : </span>CBETA No. {bookHubTarget.workId}</div>
                    <div><span style={{ color: 'var(--text-secondary, #524038)', fontWeight: 600 }}>部類 : </span>{bookHubTarget.category || '大藏經部類'}</div>
                    <div><span style={{ color: 'var(--text-secondary, #524038)', fontWeight: 600 }}>冊別 : </span>{bookHubTarget.vol || 'CBETA 典籍'}</div>
                    <div>
                      <span style={{ color: 'var(--text-secondary, #524038)', fontWeight: 600 }}>字數 : </span>
                      {bookHubTarget.cjkChars ? `${bookHubTarget.cjkChars.toLocaleString()} 字` : (hub.cbetaVolumeInfo ? '1,097 字' : '—')}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary, #524038)', fontWeight: 600 }}>預計閱讀時間 : </span>
                      {formatEstimatedReadingTime(bookHubTarget.cjkChars || 1097)}
                    </div>
                  </div>
                ) : (
                  /* 2. 📿 主觀層級：個人閱讀概況 (依功能配置溫潤明亮且舒心的專屬二級子膠囊) */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* 二級子分類 3 個獨立膠囊列 (高度 34px，依功能類別呈現溫潤明亮專屬色系，徹底擺脫視覺失焦) */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(3, 1fr)', 
                      gap: '6px', 
                      height: '34px',
                      boxSizing: 'border-box'
                    }}>
                      {[
                        { 
                          id: 'history', 
                          label: '上次閱讀', 
                          icon: Clock,
                          // 溫暖典雅的暖杏琥珀色（時間、位置與停駐）
                          activeColor: '#b45309',
                          activeBg: 'rgba(217, 119, 6, 0.13)',
                          activeBorder: 'rgba(217, 119, 6, 0.45)',
                          activeShadow: '0 2px 6px rgba(217, 119, 6, 0.16)'
                        },
                        { 
                          id: 'notes', 
                          label: `我的筆記 (${hub.notesCount})`, 
                          icon: FileText,
                          // 清幽靜心的竹林翡翠綠（筆記、法義心得與墨寶）
                          activeColor: '#15803d',
                          activeBg: 'rgba(22, 101, 52, 0.13)',
                          activeBorder: 'rgba(21, 128, 61, 0.45)',
                          activeShadow: '0 2px 6px rgba(22, 101, 52, 0.16)'
                        },
                        { 
                          id: 'timeline', 
                          label: '閱讀歷程', 
                          icon: Calendar,
                          // 澄澈安詳的菩提天青藍（修行歷程、累計時數與日誌）
                          activeColor: '#1d4ed8',
                          activeBg: 'rgba(37, 99, 235, 0.13)',
                          activeBorder: 'rgba(37, 99, 235, 0.45)',
                          activeShadow: '0 2px 6px rgba(37, 99, 235, 0.16)'
                        }
                      ].map(st => {
                        const isActive = readingSubTab === st.id;
                        const Icon = st.icon;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setReadingSubTab(st.id as any)}
                            style={{
                              height: '100%',
                              borderRadius: '9999px',
                              border: isActive 
                                ? `1.5px solid ${st.activeBorder}` 
                                : '1px solid var(--border-color, rgba(0,0,0,0.12))',
                              backgroundColor: isActive 
                                ? st.activeBg 
                                : 'var(--surface-capsule, rgba(0,0,0,0.03))',
                              color: isActive ? st.activeColor : 'var(--text-secondary, #524038)',
                              boxShadow: isActive ? st.activeShadow : 'none',
                              fontSize: '0.74rem',
                              fontWeight: isActive ? 800 : 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '0 6px',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Icon size={12} color={isActive ? st.activeColor : 'currentColor'} />
                            <span>{st.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* 二級子內容容器 (高度 220px，與上方 34px+6px 合計 260px，與書籍簡介完全齊平) */}
                    <div style={{ 
                      height: '220px', 
                      maxHeight: '220px', 
                      overflowY: 'auto', 
                      paddingRight: '2px',
                      display: 'flex', 
                      flexDirection: 'column', 
                      boxSizing: 'border-box'
                    }}>
                      {/* 2-1 ⏱️ 上次閱讀 (二個內容框統一為膚色/暖杏琥珀色系邊框，背景採用微透防穿透層) */}
                      {readingSubTab === 'history' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* 框 1：上次閱讀位置進度框 (膚色系邊框 + 高覆蓋微透底色) */}
                          <div style={{ 
                            padding: '10px 12px', 
                            borderRadius: '12px', 
                            backgroundColor: 'var(--surface-card, rgba(30, 36, 44, 0.88))', 
                            border: '1.5px solid rgba(217, 119, 6, 0.45)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>上次閱讀位置</span>
                              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: hub.lastReadProgress > 0 ? '#b45309' : 'var(--text-muted)' }}>
                                {hub.lastReadProgress > 0 ? `${hub.lastReadProgress}%` : '未開始閱讀'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', marginTop: '4px' }}>
                              {hub.lastReadJuan}
                            </div>

                            {/* 進度條 (膚色系琥珀色) */}
                            <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'rgba(217, 119, 6, 0.12)', marginTop: '8px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.max(hub.lastReadProgress, 0)}%`, height: '100%', backgroundColor: '#d97706', borderRadius: '3px' }} />
                            </div>
                          </div>

                          {/* 框 2：🌟 核心摘要：50-60 字上次閱讀停駐位置摘錄 (膚色系虛線邊框 + 高覆蓋微透底色) */}
                          <div 
                            onClick={() => {
                              saveBookHubReturnState(bookHubTarget.workId, 'reading', 'history');
                              onSelectBook(bookHubTarget.workId, undefined, undefined, 'resume');
                              setBookHubTarget(null);
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '12px',
                              backgroundColor: 'var(--surface-card, rgba(30, 36, 44, 0.88))',
                              border: '1.5px dashed rgba(217, 119, 6, 0.45)',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '5px'
                            }}
                            title="點擊接續閱讀此段"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700 }}>
                                {hub.lastReadProgress > 0 ? '📍 上次停駐經文文字摘要' : '📖 經典首段經文摘錄'} (約 50-60 字)
                              </span>
                              <span style={{ fontSize: '0.66rem', color: '#b45309', fontWeight: 600 }}>
                                {hub.lastReadProgress > 0 ? '點擊接續 ›' : '點擊開卷 ›'}
                              </span>
                            </div>

                            <div style={{ 
                              fontSize: '0.84rem', 
                              color: 'var(--text-primary)', 
                              fontFamily: 'var(--font-serif)', 
                              lineHeight: 1.6,
                              letterSpacing: '0.3px',
                              marginTop: '2px'
                            }}>
                              {hub.lastReadSnippet || '…舍利子，色不異空，空不異色，色即是空，空即是色，受想行識亦復如是。舍利子，是諸法空相，不生不滅，不垢不淨，不增不減。是故空中無色，無受想行識…'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2-2 📝 我的筆記 (翡翠竹青綠色系) */}
                      {readingSubTab === 'notes' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              在「我的筆記」中共有 {hub.sampleNotes.length} 則真跡標註：
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 700 }}>
                              點選直達段落
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {hub.sampleNotes.length > 0 ? (
                              hub.sampleNotes.map(n => (
                                <div 
                                  key={n.id}
                                  onClick={() => {
                                    saveBookHubReturnState(bookHubTarget.workId, 'reading', 'notes');
                                    onSelectBook(
                                      bookHubTarget.workId,
                                      n.segmentId,
                                      n.segmentId ? undefined : (n.text ? n.text.slice(0, 15) : undefined),
                                      'resume'
                                    );
                                    setBookHubTarget(null);
                                  }}
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    backgroundColor: 'var(--surface-card, rgba(30, 36, 44, 0.88))',
                                    border: '1.5px solid rgba(22, 101, 52, 0.35)',
                                    borderLeft: '4px solid #16a34a',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '3px'
                                  }}
                                >
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', lineHeight: 1.35, fontStyle: 'italic' }}>
                                    「{n.text}」
                                  </div>
                                  {n.note && (
                                    <div style={{ fontSize: '0.72rem', color: '#15803d', backgroundColor: 'rgba(22, 101, 52, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                                      💭 心得：{n.note}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    <span>第 {n.juan} 卷</span>
                                    <span style={{ color: '#15803d', fontWeight: 600 }}>{n.date} · 點擊直達 ›</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div style={{ 
                                padding: '28px 12px', 
                                textAlign: 'center', 
                                color: 'var(--text-muted)', 
                                fontSize: '0.78rem',
                                backgroundColor: 'var(--surface-card, rgba(30, 36, 44, 0.88))',
                                borderRadius: '12px',
                                border: '1.5px dashed rgba(22, 101, 52, 0.35)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)'
                              }}>
                                尚無閱讀筆記與標註<br />
                                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>閱讀時選取經文長按，即可建立心得筆記</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 2-3 📈 閱讀歷程 (三個內容框統一為藍色系邊框，背景採用微透防穿透層) */}
                      {readingSubTab === 'timeline' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* 上方雙指標卡：累計閱讀時數 + 累計閱讀次數 (框 1 與 框 2：藍色系邊框 + 高覆蓋微透底色) */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                            <div style={{ 
                              padding: '8px 10px', 
                              borderRadius: '10px', 
                              backgroundColor: 'var(--surface-card, rgba(30, 36, 44, 0.88))', 
                              border: '1.5px solid rgba(37, 99, 235, 0.42)',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)'
                            }}>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>累計閱讀時數</div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1d4ed8', marginTop: '2px' }}>
                                {hub.totalReadingMinutes} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>分鐘</span>
                              </div>
                            </div>

                            <div style={{ 
                              padding: '8px 10px', 
                              borderRadius: '10px', 
                              backgroundColor: 'var(--surface-card, rgba(30, 36, 44, 0.88))', 
                              border: '1.5px solid rgba(37, 99, 235, 0.42)',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)'
                            }}>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>累計閱讀次數</div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1d4ed8', marginTop: '2px' }}>
                                {hub.readCount || hub.practiceCount || 0} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>次</span>
                              </div>
                            </div>
                          </div>

                          {/* 框 3：🌟 核心條列：累計閱讀時數與次數的日期明細 (藍色系邊框 + 高覆蓋微透底色) */}
                          <div style={{ 
                            padding: '10px 12px', 
                            borderRadius: '12px', 
                            backgroundColor: 'var(--surface-card, rgba(30, 36, 44, 0.88))', 
                            border: '1.5px solid rgba(37, 99, 235, 0.42)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '6px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1d4ed8' }}>
                                📅 歷史閱讀明細 ({(hub.readingHistoryRecords || []).length} 筆)
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                                style={{
                                  border: '1px solid rgba(37, 99, 235, 0.3)',
                                  background: 'rgba(37, 99, 235, 0.08)',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  color: '#1d4ed8',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                              >
                                {isHistoryExpanded ? '− 收合' : '+ 展開'}
                              </button>
                            </div>

                            {/* 條列明細內容 */}
                            {isHistoryExpanded ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                                {(hub.readingHistoryRecords && hub.readingHistoryRecords.length > 0) ? (
                                  hub.readingHistoryRecords.map((r, idx) => (
                                    <div 
                                      key={idx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '5px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: 'var(--surface-capsule, rgba(255,255,255,0.06))',
                                        fontSize: '0.72rem'
                                      }}
                                    >
                                      <span style={{ color: 'var(--text-muted)' }}>{r.date}</span>
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        閱讀 {r.count} 次 · 累計 {r.minutes} 分鐘
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '6px' }}>
                                    暫無各日閱讀明細
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                已收合詳細日期清單，點擊「+ 展開」可查看各日閱讀次數與時數明細。
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 底部行動列：刪除經文 + 接續閱讀經文 (全膠囊型式，大氣圓潤，位置固定杜絕跳動) */}
                <div style={{ borderTop: '1px solid var(--border-color, rgba(0,0,0,0.1))', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (onDeleteBook) onDeleteBook(bookHubTarget.workId);
                        setBookHubTarget(null);
                        clearBookHubReturnState();
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '9999px',
                        border: '1.5px solid var(--btn-delete-border, rgba(239, 68, 68, 0.35))',
                        backgroundColor: 'var(--btn-delete-bg, #fee2e2)',
                        color: 'var(--btn-delete-text, #dc2626)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        height: '38px',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                    >
                      <Trash2 size={14} />
                      <span>刪除經文</span>
                    </button>

                  <button
                    type="button"
                    onClick={() => {
                      saveBookHubReturnState(bookHubTarget.workId, bookHubTab, readingSubTab);
                      onSelectBook(bookHubTarget.workId, undefined, undefined, 'resume');
                      setBookHubTarget(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 20px',
                      borderRadius: '9999px',
                      border: 'none',
                      backgroundColor: 'var(--theme-accent, #8b5a2b)',
                      color: 'var(--theme-accent-contrast, #ffffff)',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      height: '38px',
                      boxSizing: 'border-box',
                      boxShadow: '0 3px 10px rgba(139, 90, 43, 0.28)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Play size={15} fill="currentColor" />
                    <span>接續閱讀經文 ›</span>
                  </button>
                </div>

              </div>
            </div>
          );
        })(),
        document.body
      )}

    </div>
  );
}
