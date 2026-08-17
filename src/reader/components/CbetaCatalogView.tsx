import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, ChevronLeft, ChevronRight, Settings, Search,
  Folder, Download, Check, X, Layers, BookMarked, User, Clock, Plus, Minus, Heart
} from 'lucide-react';
import type { AppSettings } from '../../utils/db';
import { listBooks } from '../../utils/db';
import { IndexBuilder, getApiUrl } from '../../builder/IndexBuilder';
import type { SearchResult } from '../../builder/IndexBuilder';
import { PackageBuilder } from '../../builder/PackageBuilder';
import type { BuildProgress } from '../../builder/PackageBuilder';
import { isBackupMode } from '../../utils/sourceMode';
import '../styles/cbeta-catalog.css';

interface CbetaCatalogViewProps {
  onBackToLibrary: () => void;
  onOpenSettings: () => void;
  onSelectBook: (workId: string, segmentId?: string, searchQuery?: string) => void;
  settings: AppSettings;
}

interface CatalogNode {
  id: string; // e.g. "CBETA", "CBETA.001", "orig-T", etc.
  label: string; // Breadcrumb title
}

interface CatalogItem {
  id: string;
  label: string;
  subLabel?: string; // e.g. "25 CE ~ 220 CE"
  nodeType?: 'work' | 'category' | null;
  workId?: string;
  juansCount?: number;
  juanStart?: number;
  creators?: string;
  category?: string;
  file?: string;
  queryParam?: string;
  timeFrom?: number;
  timeTo?: number;
}

// CBETA 官方筆劃分類標籤與代表字 (1~29 劃)
export const CREATOR_STROKE_CATEGORIES = [
  { stroke: 1, label: '1 劃', sample: '一' },
  { stroke: 2, label: '2 劃', sample: '丁, 九, 了, 力, 十' },
  { stroke: 3, label: '3 劃', sample: '三, 上, 久, 于, 及, 士, 大, 子, 尸, 工, 才, 山' },
  { stroke: 4, label: '4 劃', sample: '不, 中, 仁, 今, 介, 允, 勿, 天, 太, 巨, 巴, 幻, 式, 心, 支, 文, 方, 日, 月, 木, 毛, 水, 王' },
  { stroke: 5, label: '5 劃', sample: '世, 丘, 功, 印, 古, 可, 平, 弗, 弘, 朱, 本, 札, 正, 永, 玄, 用, 白, 目, 矢, 石' },
  { stroke: 6, label: '6 劃', sample: '仲, 任, 伊, 先, 光, 全, 沖, 合, 吉, 地, 多, 如, 守, 安, 屾, 延, 廷, 成, 有, 朱, 朴, 汝, 江, 牟, 祁, 自, 至, 芝, 行, 衣, 西, 那' },
  { stroke: 7, label: '7 劃', sample: '伽, 住, 佐, 何, 余, 佛, 克, 利, 即, 含, 吳, 呂, 均, 妙, 孚, 宋, 完, 宏, 岑, 希, 序, 張, 志, 忖, 戒, 李, 杜, 求, 汪, 沈, 沙, 良, 芳, 見, 阿' },
  { stroke: 8, label: '8 劃', sample: '來, 其, 具, 受, 周, 孟, 宗, 定, 宜, 尚, 居, 岫, 岳, 帛, 建, 念, 性, 承, 拂, 拉, 拔, 明, 杭, 東, 林, 果, 武, 沮, 治, 法, 波, 知, 祇, 空, 竺, 舍, 若, 英, 范, 表, 迦, 金, 青, 非' },
  { stroke: 9, label: '9 劃', sample: '亮, 侯, 倡, 俊, 俞, 信, 修, 則, 威, 契, 姚, 彥, 思, 恆, 恒, 拾, 指, 施, 昭, 曷, 柳, 段, 毗, 毘, 洛, 洪, 珀, 省, 祖, 神, 紀, 胡, 胤, 貞, 退, 重, 音, 飛' },
  { stroke: 10, label: '10 劃', sample: '師, 乘, 條, 冥, 凌, 剛, 原, 員, 唐, 函, 夏, 孫, 徐, 悟, 振, 晃, 時, 朗, 栖, 浮, 海, 烏, 益, 真, 祥, 翁, 般, 莊, 華, 袁, 貢, 起, 通, 造, 郭, 陳, 陶, 陸, 馬, 高' },
  { stroke: 11, label: '11 劃', sample: '乾, 勒, 唯, 商, 啟, 堅, 婆, 寂, 屠, 崇, 崔, 常, 康, 張, 得, 從, 惟, 授, 旋, 曹, 曼, 梁, 梅, 梵, 梶, 淨, 深, 清, 盛, 眾, 章, 紹, 菩, 處, 姝, 許, 野, 隆, 雪' },
  { stroke: 12, label: '12 劃', sample: '傅, 勝, 善, 喻, 富, 寒, 尊, 彭, 復, 惠, 惹, 提, 敬, 普, 景, 晃, 智, 曾, 最, 湛, 湯, 無, 焦, 然, 琮, 發, 程, 等, 筏, 翔, 舒, 萬, 葉, 葛, 董, 訶, 費, 超, 跋, 遁, 遇, 運, 遍, 道, 達, 量, 開, 雅, 雲, 黃' },
  { stroke: 13, label: '13 劃', sample: '傳, 嗣, 圓, 塞, 愛, 慈, 暉, 楊, 楚, 業, 源, 薄, 照, 瑞, 皖, 寘, 福, 筠, 義, 聖, 與, 蒙, 蓮, 虞, 解, 註, 賈, 際, 鳩, 謎' },
  { stroke: 14, label: '14 劃', sample: '僧, 厲, 壽, 實, 寬, 廣, 榮, 滿, 熊, 熙, 碩, 管, 維, 翠, 聞, 蔡, 蔣, 裴, 趙, 鄧, 鄭, 閼, 齊' },
  { stroke: 15, label: '15 劃', sample: '儀, 劉, 德, 徹, 慧, 慶, 懡, 摩, 樓, 潘, 潤, 潭, 澄, 螢, 諸, 諾, 遵, 銳, 黎' },
  { stroke: 16, label: '16 劃', sample: '凝, 叡, 學, 曇, 曉, 機, 燈, 禪, 窺, 縛, 興, 蘊, 薩, 親, 諦, 賴, 辨, 錢, 閻, 靜, 鮑, 龍' },
  { stroke: 17, label: '17 劃', sample: '優, 嶽, 彌, 應, 戴, 濟, 禮, 聯, 膽, 藍, 藏, 謝, 鍾, 韓, 魏, 鮮' },
  { stroke: 18, label: '18 劃', sample: '瓊, 瞿, 聶, 豐, 鎮, 雙, 顏' },
  { stroke: 19, label: '19 劃', sample: '嚴, 懷, 羅, 蘇, 蘊, 譚, 贊, 關, 難, 願' },
  { stroke: 20, label: '20 劃', sample: '寶, 灌, 繼, 覺, 護, 釋' },
  { stroke: 21, label: '21 劃', sample: '攝, 續, 辯' },
  { stroke: 22, label: '22 劃', sample: '讀, 鑑, 體, 龔' },
  { stroke: 23, label: '23 劃', sample: '顯' },
  { stroke: 24, label: '24 劃', sample: '觀, 靈' },
  { stroke: 29, label: '29 劃', sample: '鬱' }
];

// CBETA 官方作譯者權威資料庫結構 (1~29 筆劃、首字分組、作譯者、經典清單)
export interface CreatorWork {
  workId: string;
  title: string;
  juansCount: number;
  byline: string;
  rawTitle: string;
}

export interface CreatorPerson {
  creatorId: string;
  name: string;
  displayName: string;
  worksCount: number;
  works: CreatorWork[];
}

export interface CreatorFirstCharGroup {
  firstChar: string;
  creatorsCount: number;
  creators: CreatorPerson[];
}

export interface CreatorStrokeCategory {
  stroke: number;
  label: string;
  groupsCount: number;
  creatorsCount: number;
  worksCount: number;
  groups: CreatorFirstCharGroup[];
}

let cachedCreatorsData: CreatorStrokeCategory[] | null = null;

export async function fetchCreatorsData(): Promise<CreatorStrokeCategory[]> {
  if (cachedCreatorsData && cachedCreatorsData.length > 0) {
    return cachedCreatorsData;
  }
  try {
    const res = await fetch('/data/cbeta-creators.json');
    if (res.ok) {
      cachedCreatorsData = await res.json();
      return cachedCreatorsData || [];
    }
  } catch (err) {
    console.error('Failed to fetch cbeta-creators.json:', err);
  }
  return [];
}

// CBETA 官方權威 37 個歷史時間與朝代完整列表 (包含「金 (7)」項目)
const HISTORICAL_DYNASTIES = [
  { name: '東漢 (80)', years: '25 CE ~ 220 CE', query: '東漢' },
  { name: '曹魏 (6)', years: '220 CE ~ 265 CE', query: '曹魏' },
  { name: '吳 (61)', years: '229 CE ~ 280 CE', query: '吳' },
  { name: '西晉 (140)', years: '265 CE ~ 316 CE', query: '西晉' },
  { name: '晉 (2)', years: '265 CE ~ 420 CE', query: '晉' },
  { name: '東晉 (56)', years: '317 CE ~ 420 CE', query: '東晉' },
  { name: '前涼 (1)', years: '301 CE ~ 387 CE', query: '前涼' },
  { name: '前秦/符秦 (11)', years: '351 CE ~ 394 CE', query: '前秦' },
  { name: '後秦/姚秦 (69)', years: '384 CE ~ 417 CE', query: '後秦' },
  { name: '西秦/乞伏秦 (11)', years: '385 CE ~ 431 CE', query: '西秦' },
  { name: '北涼 (17)', years: '397 CE ~ 460 CE', query: '北涼' },
  { name: '南北朝 (1)', years: '439 CE ~ 589 CE', query: '南北朝' },
  { name: '劉宋 (98)', years: '420 CE ~ 479 CE', query: '劉宋' },
  { name: '元魏/北魏/後魏 (51)', years: '386 CE ~ 534 CE', query: '元魏' },
  { name: '東魏 (26)', years: '534 CE ~ 550 CE', query: '東魏' },
  { name: '蕭齊/南齊 (6)', years: '479 CE ~ 502 CE', query: '蕭齊' },
  { name: '梁/蕭梁 (33)', years: '502 CE ~ 557 CE', query: '梁' },
  { name: '北齊/高齊 (5)', years: '550 CE ~ 577 CE', query: '北齊' },
  { name: '北周/宇文周 (6)', years: '557 CE ~ 581 CE', query: '北周' },
  { name: '陳 (37)', years: '557 CE ~ 589 CE', query: '陳' },
  { name: '隋 (137)', years: '581 CE ~ 618 CE', query: '隋' },
  { name: '唐 (910)', years: '618 CE ~ 907 CE', query: '唐' },
  { name: '後唐 (1)', years: '923 CE ~ 936 CE', query: '後唐' },
  { name: '後晉/石晉 (1)', years: '936 CE ~ 947 CE', query: '後晉' },
  { name: '南唐 (1)', years: '937 CE ~ 975 CE', query: '南唐' },
  { name: '南漢 (1)', years: '917 CE ~ 971 CE', query: '南漢' },
  { name: '遼 (6)', years: '907 CE ~ 1125 CE', query: '遼' },
  { name: '宋 (657)', years: '960 CE ~ 1279 CE', query: '宋' },
  { name: '北宋 (1)', years: '960 CE ~ 1127 CE', query: '北宋' },
  { name: '南宋 (1)', years: '1127 CE ~ 1279 CE', query: '南宋' },
  { name: '夏/西夏 (1)', years: '1032 CE ~ 1227 CE', query: '夏' },
  { name: '金 (7)', years: '1115 CE ~ 1234 CE', query: '金' },
  { name: '元 (65)', years: '1271 CE ~ 1368 CE', query: '元' },
  { name: '明 (429)', years: '1368 CE ~ 1644 CE', query: '明' },
  { name: '清 (529)', years: '1644 CE ~ 1911 CE', query: '清' },
  { name: '新羅 (32)', years: '-56 BCE ~ 936 CE', query: '新羅' },
  { name: '高麗 (12)', years: '918 CE ~ 1392 CE', query: '高麗' },
  { name: '民國 (156)', years: '1912 CE ~ 9999 CE', query: '民國' }
];

// CBETA 官方 23 部類靜態常數 (實現首層 0 延遲免載入)
export const STATIC_DEPT_CATEGORIES: CatalogItem[] = [
  { id: 'CBETA.001', label: '01 阿含部類 T01-02,25,33 etc.', nodeType: 'category' },
  { id: 'CBETA.002', label: '02 本緣部類 T03-04, X20-21 etc.', nodeType: 'category' },
  { id: 'CBETA.003', label: '03 般若部類 T05-08,25,33,40,85, X24-26,46,74 etc.', nodeType: 'category' },
  { id: 'CBETA.004', label: '04 法華部類 T09a,26a,33-34,40,46,85, X27-35,46,55-57,74 etc.', nodeType: 'category' },
  { id: 'CBETA.005', label: '05 華嚴部類 T09b-10,26a,35-36,45,85, X03-05,07-09,45,58,74 etc.', nodeType: 'category' },
  { id: 'CBETA.006', label: '06 寶積部類 T11-12a,26a,37,40b,85, X10,19', nodeType: 'category' },
  { id: 'CBETA.007', label: '07 涅槃部類 T12b,26a,37-38,40b,85, X36-37,53 etc.', nodeType: 'category' },
  { id: 'CBETA.008', label: '08 大集部類 T13,26a, X21,74 etc.', nodeType: 'category' },
  { id: 'CBETA.009', label: '09 經集部類 T14-17,19,21,26a,38-39,85, X01,09-10,17-21,37,39,74 etc.', nodeType: 'category' },
  { id: 'CBETA.010', label: '10 密教部類 T18-21,39,46, X01-02,10-16,23,59,74 etc.', nodeType: 'category' },
  { id: 'CBETA.011', label: '11 律部類 T22-24,40a,45,85, X38-44,59-60,74 etc.', nodeType: 'category' },
  { id: 'CBETA.012', label: '12 毘曇部類 T26b-29,41,85, X53', nodeType: 'category' },
  { id: 'CBETA.013', label: '13 中觀部類 T30a,42,45,85, X46,54 etc.', nodeType: 'category' },
  { id: 'CBETA.014', label: '14 瑜伽部類 T30b-32,42-45,85, X39,46-51,55 etc.', nodeType: 'category' },
  { id: 'CBETA.015', label: '15 論集部類 T32,44a,85, X45-46,53 etc.', nodeType: 'category' },
  { id: 'CBETA.016', label: '16 淨土宗部類 T11-12a,26a,37,40b,47,85, X01-02,16,22,61-62,74, CC006', nodeType: 'category' },
  { id: 'CBETA.017', label: '17 禪宗部類 T47-48,85, X63-73 etc.', nodeType: 'category' },
  { id: 'CBETA.018', label: '18 史傳部類 T47,49-52,54, X02,53,75-88 etc.', nodeType: 'category' },
  { id: 'CBETA.019', label: '19 事彙部類 T53-55,85, X65,68 etc.', nodeType: 'category' },
  { id: 'CBETA.020', label: '20 敦煌寫本部類 T85', nodeType: 'category' },
  { id: 'CBETA.021', label: '21 國圖善本部類 D01-64', nodeType: 'category' },
  { id: 'CBETA.022', label: '22 南傳大藏經部類 N01-70', nodeType: 'category' },
  { id: 'CBETA.023', label: '23 新編部類 ZW, ZS, I, B, GA, GB, Y, LC, TX, YP, CC', nodeType: 'category' }
];

// CBETA 官方 6 冊別靜態常數 (實現首層 0 延遲免載入)
export const STATIC_VOL_CATEGORIES: CatalogItem[] = [
  { id: 'orig-T', label: 'T 大正新脩大藏經', nodeType: 'category' },
  { id: 'orig-X', label: 'X 卍新纂續藏經選錄', nodeType: 'category' },
  { id: 'orig.003', label: '歷代藏經補輯', nodeType: 'category' },
  { id: 'orig-D', label: 'D 國家圖書館善本佛典', nodeType: 'category' },
  { id: 'orig-N', label: 'N 漢譯南傳大藏經（元亨寺版）', nodeType: 'category' },
  { id: 'orig.006', label: '近代新編文獻', nodeType: 'category' }
];

// 常用經典 12 本熱門經典常數 (快速連結，點擊即可下載/閱讀)
export const STATIC_FAVORITE_WORKS: CatalogItem[] = [
  {
    id: 'T0779',
    label: '佛說八大人覺經',
    nodeType: 'work',
    workId: 'T0779',
    creators: '東漢 安清',
    category: '經集部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0784',
    label: '四十二章經',
    nodeType: 'work',
    workId: 'T0784',
    creators: '東漢 攝摩騰,竺法蘭',
    category: '經集部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0801',
    label: '佛說無常經',
    nodeType: 'work',
    workId: 'T0801',
    creators: '唐 義淨',
    category: '經集部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0251',
    label: '般若波羅蜜多心經',
    nodeType: 'work',
    workId: 'T0251',
    creators: '唐 玄奘',
    category: '般若部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0235',
    label: '金剛般若波羅蜜經',
    nodeType: 'work',
    workId: 'T0235',
    creators: '後秦 鳩摩羅什',
    category: '般若部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0366',
    label: '佛說阿彌陀經',
    nodeType: 'work',
    workId: 'T0366',
    creators: '姚秦 鳩摩羅什',
    category: '寶積部類,淨土宗部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0450',
    label: '藥師琉璃光如來本願功德經',
    nodeType: 'work',
    workId: 'T0450',
    creators: '唐 玄奘',
    category: '經集部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0276',
    label: '無量義經',
    nodeType: 'work',
    workId: 'T0276',
    creators: '蕭齊 曇摩迦陀耶舍',
    category: '法華部類',
    juansCount: 1,
    juanStart: 1
  },
  {
    id: 'T0262',
    label: '妙法蓮華經',
    nodeType: 'work',
    workId: 'T0262',
    creators: '姚秦 鳩摩羅什',
    category: '法華部類',
    juansCount: 7,
    juanStart: 7
  },
  {
    id: 'T0412',
    label: '地藏菩薩本願經',
    nodeType: 'work',
    workId: 'T0412',
    creators: '唐 實叉難陀',
    category: '大集部類',
    juansCount: 2,
    juanStart: 2
  },
  {
    id: 'T0945',
    label: '大佛頂如來密因修證了義諸菩薩萬行首楞嚴經',
    nodeType: 'work',
    workId: 'T0945',
    creators: '唐 般剌蜜帝',
    category: '密教部類',
    juansCount: 10,
    juanStart: 10
  },
  {
    id: 'Y0040',
    label: '成佛之道（增注本）',
    nodeType: 'work',
    workId: 'Y0040',
    creators: '民國 釋印順',
    category: '新編部類',
    juansCount: 5,
    juanStart: 5
  }
];

export function CbetaCatalogView({
  onBackToLibrary,
  onOpenSettings,
  onSelectBook,
  settings
}: CbetaCatalogViewProps) {
  // 5 大經典分頁 (常用經典, 依部類, 依冊別, 依作譯者, 依朝代) - 預設開啟「常用經典」
  const [activeTab, setActiveTab] = useState<'favorite' | 'dept' | 'vol' | 'creator' | 'time'>('favorite');

  // 導航歷史紀錄 (Header 上一頁/下一頁及麵包屑使用) - 初始對齊「常用經典」頁籤
  const [historyStack, setHistoryStack] = useState<CatalogNode[]>([
    { id: 'favorite_root', label: '常用經典' }
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // 記憶體快取：紀錄所有已加載或靜態目錄，避免重複出現「正在檢索 CBETA 藏經庫數據中...」轉圈畫面
  const catalogCacheRef = useRef<Map<string, CatalogItem[]>>(new Map());

  // 當前目錄層級內容 (預設使用常用經典静態列表，實現 0 延遲渲染)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(STATIC_FAVORITE_WORKS);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // 關鍵字搜尋狀態 (當有搜尋關鍵字時，自動隱藏 4 個 Tab 區塊)
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<SearchResult[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isTextSearchActive, setIsTextSearchActive] = useState(false);

  // 💡 近期 5 個搜尋關鍵字紀錄
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cbeta_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(q => q !== trimmed)].slice(0, 5);
      localStorage.setItem('cbeta_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  // 已下載書籍紀錄 (Local IndexedDB)
  const [downloadedWorkIds, setDownloadedWorkIds] = useState<string[]>([]);

  // 批量勾選與下載狀態
  const [selectedOnlineWorkIds, setSelectedOnlineWorkIds] = useState<string[]>([]);
  const [showBatchDownloadModal, setShowBatchDownloadModal] = useState(false);
  const [batchFolderMode, setBatchFolderMode] = useState<'new' | 'existing' | 'none'>('new');
  const [batchFolderName, setBatchFolderName] = useState('');
  const [batchFolderColor] = useState('#8b7355');
  const [selectedExistingFolderId, setSelectedExistingFolderId] = useState('');
  const [folders, setFolders] = useState<any[]>([]);

  // 💡 檢索CBETA與依類別查詢預設手風琴 state（預設「檢索CBETA」開啟，「依類別查詢」關閉）
  const [isSearchExpanded, setIsSearchExpanded] = useState(true);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);

  const handleToggleSearch = () => {
    const nextState = !isSearchExpanded;
    setIsSearchExpanded(nextState);
    if (nextState) {
      setIsCategoriesExpanded(false);
    }
  };

  const handleToggleCategories = () => {
    const nextState = !isCategoriesExpanded;
    setIsCategoriesExpanded(nextState);
    if (nextState) {
      setIsSearchExpanded(false);
    }
  };

  // 💡 平滑倒滑離場動畫返回首頁 (Smooth Slide Exit back to Library)
  const [isCatalogExiting, setIsCatalogExiting] = useState(false);

  const handleSmoothBackToLibrary = () => {
    if (isCatalogExiting) return;
    setIsCatalogExiting(true);
    setTimeout(() => {
      onBackToLibrary();
    }, 220);
  };

  // 💡 在 CBETA 藏經庫 Modal 內向左劃動 (Swipe Left) 自動平滑離場返回首頁
  const catalogTouchRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleCatalogTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    catalogTouchRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleCatalogTouchEnd = (e: React.TouchEvent) => {
    if (!catalogTouchRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - catalogTouchRef.current.x;
    const deltaY = touch.clientY - catalogTouchRef.current.y;
    const deltaTime = Date.now() - catalogTouchRef.current.time;
    catalogTouchRef.current = null;

    // 水平滑動 > 28px 且未點選彈窗時
    if (Math.abs(deltaX) > 28 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15 && deltaTime < 550) {
      if (deltaX < -28) {
        // 👈 向左滑動 1 下 ──> 直覺平滑離場關閉 CBETA 並返回首頁
        handleSmoothBackToLibrary();
      }
    }
  };

  // Builder 建置進度與遮罩
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null);
  const [loadingDots, setLoadingDots] = useState('...');

  // 載入動畫點點
  useEffect(() => {
    let interval: number;
    if (buildProgress) {
      interval = window.setInterval(() => {
        setLoadingDots((prev) => {
          if (prev === '.') return '..';
          if (prev === '..') return '...';
          return '.';
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [buildProgress]);

  // 載入已下載書籍與資料夾結構
  useEffect(() => {
    const loadDownloadedBooks = async () => {
      try {
        const books = await listBooks();
        setDownloadedWorkIds(books.map(b => b.workId));
      } catch (err) {
        console.error('Failed to list local books:', err);
      }
    };
    loadDownloadedBooks();

    // 載入 localStorage 資料夾
    const storedFolders = localStorage.getItem('cbeta_reader_folders');
    if (storedFolders) {
      try {
        setFolders(JSON.parse(storedFolders));
      } catch (e) {
        setFolders([]);
      }
    }
  }, [buildProgress]);

  // 動態載入當前歷史指標對應的 CBETA 目錄資料
  useEffect(() => {
    const currentNode = historyStack[historyIndex];
    if (currentNode) {
      fetchCatalog(currentNode.id);
    }
  }, [historyIndex, historyStack]);

  // 載入 CBETA Catalog Entry 或作譯者/朝代資料 (具備強大記憶體快取，免重複搜尋)
  const fetchCatalog = async (queryId: string) => {
    // 0. 優先檢查記憶體快取：若已有該層級資料，立即同步渲染，完全不跳轉圈遮罩！
    if (catalogCacheRef.current.has(queryId)) {
      setCatalogItems(catalogCacheRef.current.get(queryId)!);
      setIsLoadingCatalog(false);
      return;
    }

    // 0.5. 常用經典根目錄 (Level 1: 靜態 12 本熱門經典快速連結，0 延遲秒開)
    if (queryId === 'favorite_root') {
      catalogCacheRef.current.set(queryId, STATIC_FAVORITE_WORKS);
      setCatalogItems(STATIC_FAVORITE_WORKS);
      setIsLoadingCatalog(false);
      return;
    }

    // 1. 依據部類根目錄 (Level 1: 靜態 23 部類，0 延遲秒開)
    if (queryId === 'CBETA' || queryId === 'root_dept') {
      catalogCacheRef.current.set(queryId, STATIC_DEPT_CATEGORIES);
      setCatalogItems(STATIC_DEPT_CATEGORIES);
      setIsLoadingCatalog(false);
      return;
    }

    // 2. 依據冊別根目錄 (Level 1: 靜態 6 冊別，0 延遲秒開)
    if (queryId === 'orig' || queryId === 'root_vol') {
      catalogCacheRef.current.set(queryId, STATIC_VOL_CATEGORIES);
      setCatalogItems(STATIC_VOL_CATEGORIES);
      setIsLoadingCatalog(false);
      return;
    }

    // 3. 依作譯者根目錄 (Level 1: 靜態 25 筆劃資料夾，0 延遲秒開)
    if (queryId === 'creator_root') {
      const creatorsData = await fetchCreatorsData();
      const strokeList = creatorsData.length > 0 ? creatorsData : CREATOR_STROKE_CATEGORIES.map(s => ({
        stroke: s.stroke,
        label: s.label,
        groupsCount: 0,
        creatorsCount: 0,
        worksCount: 0,
        groups: []
      }));
      const items: CatalogItem[] = strokeList.map(s => ({
        id: `creator_stroke_${s.stroke}`,
        label: s.label,
        subLabel: s.groupsCount > 0 ? `${s.groupsCount} 首字, ${s.creatorsCount} 位作譯者` : (CREATOR_STROKE_CATEGORIES.find(c => c.stroke === s.stroke)?.sample || ''),
        nodeType: 'category'
      }));
      catalogCacheRef.current.set(queryId, items);
      setCatalogItems(items);
      setIsLoadingCatalog(false);
      return;
    }

    // 4. 點選特定筆劃數資料夾 (Level 2: 首字群組分類，如 3 劃 -> 三、大、子、久、上...)
    if (queryId.startsWith('creator_stroke_')) {
      const strokeNum = parseInt(queryId.replace(/^creator_stroke_/, ''), 10);
      const creatorsData = await fetchCreatorsData();
      const strokeCat = creatorsData.find(s => s.stroke === strokeNum);

      if (strokeCat && strokeCat.groups && strokeCat.groups.length > 0) {
        const items: CatalogItem[] = strokeCat.groups.map(g => ({
          id: `creator_group_${strokeNum}_${g.firstChar}`,
          label: g.firstChar,
          subLabel: `${g.creatorsCount} 位作譯者`,
          nodeType: 'category'
        }));
        catalogCacheRef.current.set(queryId, items);
        setCatalogItems(items);
        setIsLoadingCatalog(false);
        return;
      }
    }

    // 4.5. 點選特定首字群組資料夾 (Level 3: 該首字底下的所有權威作譯者清單)
    if (queryId.startsWith('creator_group_')) {
      const parts = queryId.split('_'); // ['creator', 'group', '3', '大']
      const strokeNum = parseInt(parts[2], 10);
      const firstChar = parts.slice(3).join('_');

      const creatorsData = await fetchCreatorsData();
      const strokeCat = creatorsData.find(s => s.stroke === strokeNum);
      const group = strokeCat?.groups.find(g => g.firstChar === firstChar);

      if (group && group.creators && group.creators.length > 0) {
        const items: CatalogItem[] = group.creators.map(c => ({
          id: `creator_person_${c.creatorId}`,
          label: c.displayName,
          subLabel: `${c.worksCount} 部作品`,
          nodeType: 'category',
          queryParam: c.creatorId
        }));
        catalogCacheRef.current.set(queryId, items);
        setCatalogItems(items);
        setIsLoadingCatalog(false);
        return;
      }
    }

    // 5. 依據朝代根目錄 (Level 1: 靜態 37 朝代，0 延遲秒開)
    if (queryId === 'time_root') {
      const items: CatalogItem[] = HISTORICAL_DYNASTIES.map(d => ({
        id: `time_search_${d.query}`,
        label: d.name,
        subLabel: d.years,
        nodeType: 'category',
        queryParam: d.query
      }));
      catalogCacheRef.current.set(queryId, items);
      setCatalogItems(items);
      setIsLoadingCatalog(false);
      return;
    }

    // 6. 需要發送網路 API 或查找作譯者經典清單的深層子層級
    setIsLoadingCatalog(true);
    try {
      // 點選大師名字資料夾 (Level 4: 取得專屬經典作品清單)
      if (queryId.startsWith('creator_person_') || queryId.startsWith('creator_search_')) {
        const creatorId = queryId.replace(/^creator_person_/, '').replace(/^creator_search_/, '');

        // 優先從本地權威資料庫中尋找該作譯者的作品清單 (0 秒瞬開)
        const creatorsData = await fetchCreatorsData();
        let foundPerson: CreatorPerson | undefined;
        for (const strokeCat of creatorsData) {
          for (const group of strokeCat.groups) {
            const p = group.creators.find(c => c.creatorId === creatorId || c.name === creatorId);
            if (p) {
              foundPerson = p;
              break;
            }
          }
          if (foundPerson) break;
        }

        if (foundPerson && foundPerson.works && foundPerson.works.length > 0) {
          const items: CatalogItem[] = foundPerson.works.map(w => ({
            id: w.workId,
            label: w.title,
            subLabel: `${w.juansCount} 卷`,
            nodeType: 'work',
            workId: w.workId,
            creators: w.byline || foundPerson!.name,
            category: 'CBETA',
            juansCount: w.juansCount,
            juanStart: w.juansCount
          }));
          catalogCacheRef.current.set(queryId, items);
          setCatalogItems(items);
          setIsLoadingCatalog(false);
          return;
        }

        // 若本地無作品則線上 fallback 查詢 CBETA API
        let works: any[] = [];
        let endpoint = /^A\d+$/i.test(creatorId)
          ? `/stable/works?creator_id=${creatorId}`
          : `/stable/works?creator=${encodeURIComponent(creatorId)}`;

        let relativeUrl = getApiUrl(endpoint);
        let res = await fetch(relativeUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' }).catch(() => null);

        if (!res || !res.ok) {
          const directUrl = `https://cbdata.dila.edu.tw${endpoint}`;
          res = await fetch(directUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' }).catch(() => null);
        }

        if (res && res.ok) {
          const data = await res.json();
          if (data && data.results && Array.isArray(data.results)) {
            works = data.results;
          }
        }

        // 若 API 查無結果，備用關鍵字搜尋
        if (works.length === 0) {
          const searchRes = await IndexBuilder.searchTitle(creatorId);
          works = searchRes.map(r => ({
            work: r.workId,
            title: r.title,
            byline: r.creators,
            category: r.category,
            juan: r.juansCount
          }));
        }

        const items: CatalogItem[] = works.map(r => ({
          id: r.work || r.workId,
          label: r.title,
          nodeType: 'work',
          workId: r.work || r.workId,
          creators: r.byline || r.creators || r.lead_creator || 'CBETA 電子佛典',
          category: r.category || r.orig_category || 'CBETA',
          juanStart: r.juan || r.juansCount || 1,
          juansCount: r.juan || r.juansCount || 1
        }));

        catalogCacheRef.current.set(queryId, items);
        setCatalogItems(items);
        setIsLoadingCatalog(false);
        return;
      }

      // 點選特定朝代時的經典清單查詢 (按「著述年代」先後排序)
      if (queryId.startsWith('time_search_')) {
        const qParam = queryId.replace(/^time_search_/, '');
        const relativeUrl = getApiUrl(`/stable/works?dynasty=${encodeURIComponent(qParam)}`);
        let res = await fetch(relativeUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' }).catch(() => null);

        if (!res || !res.ok) {
          const directUrl = `https://cbdata.dila.edu.tw/stable/works?dynasty=${encodeURIComponent(qParam)}`;
          res = await fetch(directUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' });
        }

        let works: any[] = [];
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.results && Array.isArray(data.results)) {
            works = data.results;
          }
        }

        if (works.length === 0) {
          // 備用搜尋
          const searchRes = await IndexBuilder.searchTitle(qParam);
          works = searchRes.map(r => ({
            work: r.workId,
            title: r.title,
            byline: r.creators,
            category: r.category,
            juan: r.juansCount
          }));
        }

        // 依據著述年代 time_from 進行年代由早至晚排序
        works.sort((a, b) => {
          const yearA = typeof a.time_from === 'number' ? a.time_from : 99999;
          const yearB = typeof b.time_from === 'number' ? b.time_from : 99999;
          return yearA - yearB;
        });

        const items: CatalogItem[] = works.map(r => {
          const timeRangeStr = r.time_from 
            ? ` (${r.time_from}${r.time_to && r.time_to !== r.time_from ? ' ~ ' + r.time_to : ''}年)` 
            : '';
          return {
            id: r.work || r.workId,
            label: r.title,
            nodeType: 'work',
            workId: r.work || r.workId,
            creators: (r.byline || r.creators || r.lead_creator || 'CBETA 電子佛典') + timeRangeStr,
            category: r.category || r.orig_category || 'CBETA',
            juanStart: r.juan || r.juansCount || 1,
            timeFrom: r.time_from,
            timeTo: r.time_to
          };
        });

        catalogCacheRef.current.set(queryId, items);
        setCatalogItems(items);
        setIsLoadingCatalog(false);
        return;
      }

      // 處理 CBETA 官方 API (部類 q=CBETA / 冊別 q=orig 及子節點)
      let targetId = queryId;
      if (queryId === 'root_dept') targetId = 'CBETA';
      if (queryId === 'root_vol') targetId = 'orig';

      const relativeUrl = getApiUrl(`/stable/catalog_entry?q=${encodeURIComponent(targetId)}`);
      let res = await fetch(relativeUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' }).catch(() => null);

      if (!res || !res.ok) {
        const directUrl = `https://cbdata.dila.edu.tw/stable/catalog_entry?q=${encodeURIComponent(targetId)}`;
        res = await fetch(directUrl, { headers: { 'Accept': 'application/json' }, cache: 'reload' });
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data && data.results && Array.isArray(data.results)) {
          const items: CatalogItem[] = data.results.map((r: any) => ({
            id: r.n || r.work || r.label,
            label: r.label || r.title || r.n,
            nodeType: r.node_type === 'work' || r.work ? 'work' : 'category',
            workId: r.work,
            juanStart: r.juan_start,
            creators: r.creators,
            category: r.category,
            file: r.file
          }));
          catalogCacheRef.current.set(queryId, items);
          setCatalogItems(items);
        } else {
          setCatalogItems([]);
        }
      } else {
        setCatalogItems([]);
      }
    } catch (err) {
      console.error('Failed to fetch catalog entries:', err);
      setCatalogItems([]);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  // 切換 5 個頁籤 (常用經典、依部類、依冊別、依作譯者、依朝代)
  const handleTabSelect = (tab: 'favorite' | 'dept' | 'vol' | 'creator' | 'time') => {
    setActiveTab(tab);
    setOnlineResults([]);
    setIsTextSearchActive(false);
    let rootNode: CatalogNode;

    switch (tab) {
      case 'favorite':
        rootNode = { id: 'favorite_root', label: '常用經典' };
        setCatalogItems(STATIC_FAVORITE_WORKS);
        break;
      case 'dept':
        rootNode = { id: 'CBETA', label: '依部類' };
        setCatalogItems(STATIC_DEPT_CATEGORIES);
        break;
      case 'vol':
        rootNode = { id: 'orig', label: '依冊別' };
        setCatalogItems(STATIC_VOL_CATEGORIES);
        break;
      case 'creator':
        rootNode = { id: 'creator_root', label: '依作譯者' };
        if (catalogCacheRef.current.has('creator_root')) {
          setCatalogItems(catalogCacheRef.current.get('creator_root')!);
        } else {
          setCatalogItems(CREATOR_STROKE_CATEGORIES.map(s => ({
            id: `creator_stroke_${s.stroke}`,
            label: s.label,
            subLabel: s.sample,
            nodeType: 'category'
          })));
          fetchCreatorsData().then(creatorsData => {
            if (creatorsData.length > 0) {
              const items: CatalogItem[] = creatorsData.map(s => ({
                id: `creator_stroke_${s.stroke}`,
                label: s.label,
                subLabel: `${s.groupsCount} 首字, ${s.creatorsCount} 位作譯者`,
                nodeType: 'category'
              }));
              catalogCacheRef.current.set('creator_root', items);
              setCatalogItems(items);
            }
          });
        }
        break;
      case 'time':
        rootNode = { id: 'time_root', label: '依朝代' };
        setCatalogItems(HISTORICAL_DYNASTIES.map(d => ({
          id: `time_search_${d.query}`,
          label: d.name,
          subLabel: d.years,
          nodeType: 'category',
          queryParam: d.query
        })));
        break;
      default:
        rootNode = { id: 'CBETA', label: '依部類' };
        setCatalogItems(STATIC_DEPT_CATEGORIES);
    }

    setIsLoadingCatalog(false);
    setHistoryStack([rootNode]);
    setHistoryIndex(0);
  };

  // 點擊目錄項目 (資料夾 / 經典)
  const handleItemClick = (item: CatalogItem) => {
    if (item.nodeType === 'work' || item.workId) {
      const wId = item.workId || item.id;
      if (downloadedWorkIds.includes(wId)) {
        onSelectBook(wId);
      } else {
        // 下載單本經典
        handleDownloadSingleWork({
          workId: wId,
          title: item.label.replace(/^[A-Z]\d+\s*/, '').replace(/^[A-Z]\d+n\d+[A-Za-z]?\s*/, '').replace(/\s*\(\d+卷\)$/, ''),
          creators: item.creators || 'CBETA 電子佛典',
          juansCount: item.juansCount || item.juanStart || 1,
          category: item.category || 'CBETA'
        });
      }
    } else {
      // 點擊資料夾 -> 開啟下一層
      const newNode: CatalogNode = {
        id: item.id,
        label: item.label
      };
      const nextStack = [...historyStack.slice(0, historyIndex + 1), newNode];
      setHistoryStack(nextStack);
      setHistoryIndex(nextStack.length - 1);
    }
  };

  // 點擊麵包屑跳轉
  const handleBreadcrumbClick = (targetIndex: number) => {
    if (targetIndex !== historyIndex) {
      setHistoryIndex(targetIndex);
    }
  };

  // 控制列上一頁 / 下一頁
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyStack.length - 1;

  const handleHeaderPrev = () => {
    if (canGoBack) setHistoryIndex(prev => prev - 1);
  };

  const handleHeaderNext = () => {
    if (canGoForward) setHistoryIndex(prev => prev + 1);
  };

  const renderStepIcon = (targetStep: string, activeStep: string, percent: number) => {
    const stepsOrder = ['metadata', 'fetch_content', 'navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed'];
    const targetIndex = stepsOrder.indexOf(targetStep);
    const activeIndex = stepsOrder.indexOf(activeStep);
    
    if (activeIndex > targetIndex) {
      return <Check size={14} style={{ color: '#2e7d32' }} />;
    } else if (activeIndex === targetIndex) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--theme-accent)', fontWeight: 'bold' }}>進行中 ({percent}%)</span>;
    }
    return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>等待中</span>;
  };

  // 執行線上關鍵字搜尋
  const executeSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setOnlineSearchQuery(trimmed);
    saveRecentSearch(trimmed);
    setIsSearchingOnline(true);
    setIsTextSearchActive(true);
    try {
      const results = await IndexBuilder.searchTitle(trimmed);
      setOnlineResults(results);
    } catch (err) {
      console.error('Failed to search online CBETA:', err);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onlineSearchQuery.trim()) return;
    executeSearch(onlineSearchQuery);
  };

  // 清除關鍵字搜尋 -> 自動恢復 4 個分頁與目錄瀏覽
  const handleClearSearch = () => {
    setOnlineSearchQuery('');
    setOnlineResults([]);
    setIsTextSearchActive(false);
    setSelectedOnlineWorkIds([]);
  };

  // 大部頭經典 (>= 80 卷) 確認對話框
  const [largeDownloadTarget, setLargeDownloadTarget] = useState<SearchResult | null>(null);

  // 觸發單本下載前進行卷數檢測
  const handleDownloadSingleWork = (res: SearchResult) => {
    // 💡 若總卷數 >= 80 卷 (如大般若經 600卷、大毘婆沙論 200卷、大寶積經 120卷、華嚴經 80卷)，先彈出提示確認視窗！
    if (res.juansCount >= 80 || res.workId === 'T0220') {
      setLargeDownloadTarget(res);
      return;
    }
    executeSingleWorkDownload(res);
  };

  // 實際執行單本經典下載
  const executeSingleWorkDownload = async (res: SearchResult) => {
    try {
      setBuildProgress({ step: 'metadata', message: `正在準備下載《${res.title}》...`, percent: 3 });
      const pkg = await PackageBuilder.downloadAndPackage(res, (prog: BuildProgress) => {
        setBuildProgress(prog);
      });

      if (pkg) {
        setDownloadedWorkIds(prev => [...prev, res.workId]);
        setTimeout(() => {
          setBuildProgress(null);
          // 💡 下載完成後留在目錄頁，不跳入閱讀頁
        }, 600);
      }
    } catch (err) {
      console.error('Failed to download book:', err);
      alert(`下載《${res.title}》失敗，請確認網路連線。`);
      setBuildProgress(null);
    }
  };

  // 批量勾選/取消
  const toggleSelectOnlineWork = (workId: string) => {
    setSelectedOnlineWorkIds(prev => 
      prev.includes(workId) ? prev.filter(id => id !== workId) : [...prev, workId]
    );
  };

  const handleSelectAllOnlineResults = (currentList: any[]) => {
    const unDownloaded = currentList.filter((r: any) => {
      const wId = r.workId || r.id;
      return !downloadedWorkIds.includes(wId);
    });
    const unDownloadedIds = unDownloaded.map((r: any) => r.workId || r.id);

    if (selectedOnlineWorkIds.length === unDownloadedIds.length && selectedOnlineWorkIds.length > 0) {
      setSelectedOnlineWorkIds([]);
    } else {
      setSelectedOnlineWorkIds(unDownloadedIds);
    }
  };

  // 執行批量下載
  const handleExecuteBatchDownload = async () => {
    if (selectedOnlineWorkIds.length === 0) return;
    const targetWorkIds = [...selectedOnlineWorkIds];
    setShowBatchDownloadModal(false);
    setSelectedOnlineWorkIds([]);

    let targetFolderId: string | null = null;
    if (batchFolderMode === 'new') {
      const newFId = `folder_${Date.now()}`;
      const newFolder = {
        id: newFId,
        name: batchFolderName.trim() || '下載經典',
        color: batchFolderColor,
        bookIds: [],
        subFolderIds: []
      };
      const updatedFolders = [...folders, newFolder];
      localStorage.setItem('cbeta_reader_folders', JSON.stringify(updatedFolders));
      setFolders(updatedFolders);
      targetFolderId = newFId;
    } else if (batchFolderMode === 'existing') {
      targetFolderId = selectedExistingFolderId;
    }

    const totalCount = targetWorkIds.length;
    let completedCount = 0;
    const newlyDownloaded: string[] = [];

    // 合併線上搜尋結果與當前目錄經典清單
    const availablePool = [
      ...onlineResults,
      ...catalogItems.map(item => ({
        workId: item.workId || item.id,
        title: item.label,
        creators: item.creators || 'CBETA',
        juansCount: item.juansCount || item.juanStart || 1,
        category: item.category || 'CBETA'
      }))
    ];

    for (const wId of targetWorkIds) {
      completedCount++;
      const res = availablePool.find(r => r.workId === wId) || {
        workId: wId,
        title: wId,
        creators: 'CBETA',
        juansCount: 1,
        category: 'CBETA'
      };

      try {
        setBuildProgress({
          step: 'metadata',
          message: `批量下載中 (${completedCount}/${totalCount})：正在建置《${res.title}》...`,
          percent: Math.round(((completedCount - 1) / totalCount) * 100)
        });

        await PackageBuilder.downloadAndPackage(res, (prog: BuildProgress) => {
          const overallPercent = Math.round(((completedCount - 1) / totalCount) * 100 + (prog.percent / totalCount));
          setBuildProgress({
            ...prog,
            message: `批量下載中 (${completedCount}/${totalCount})：${prog.message}`,
            percent: Math.min(99, overallPercent)
          });
        });

        newlyDownloaded.push(wId);

        if (targetFolderId) {
          const currentFoldersStr = localStorage.getItem('cbeta_reader_folders');
          if (currentFoldersStr) {
            const currentFolders = JSON.parse(currentFoldersStr);
            const targetFolder = currentFolders.find((f: any) => f.id === targetFolderId);
            if (targetFolder && !targetFolder.bookIds.includes(wId)) {
              targetFolder.bookIds.push(wId);
              localStorage.setItem('cbeta_reader_folders', JSON.stringify(currentFolders));
              setFolders(currentFolders);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to download ${wId}:`, err);
      }
    }

    setDownloadedWorkIds(prev => [...prev, ...newlyDownloaded]);
    setBuildProgress({
      step: 'completed',
      message: `🎉 批量下載完成！成功匯入 ${newlyDownloaded.length} 本經典。`,
      percent: 100
    });

    setTimeout(() => {
      setBuildProgress(null);
    }, 1200);
  };

  // 計算當前目錄中未下載的經文清單
  const currentCategoryWorks = catalogItems.filter(item => item.nodeType === 'work' || !!item.workId);

  return (
    <div 
      className={`cbeta-catalog-container theme-${settings.theme} ${isCatalogExiting ? 'catalog-exiting-slide' : ''}`}
      onTouchStart={handleCatalogTouchStart}
      onTouchEnd={handleCatalogTouchEnd}
    >
      {/* 頂部固定控制列 (Header Bar) */}
      <header className="cbeta-catalog-header">
        {isBackupMode() && (
          <div className="header-backup-badge" title="目前處於備援閱讀模式 (?source=backup)">
            備援
          </div>
        )}
        {/* 回首頁 (書架) 圖示 */}
        <button 
          className="library-header-btn" 
          onClick={handleSmoothBackToLibrary}
          title="返回本地書架"
        >
          <Home size={20} />
        </button>

        <div className="control-divider" />

        {/* 上一層 (<) 與 下一層 (>) 歷史導航按鈕 */}
        <button 
          className="library-header-btn" 
          onClick={handleHeaderPrev}
          disabled={!canGoBack}
          title="上一頁 / 上一層"
          style={{ opacity: canGoBack ? 1 : 0.3 }}
        >
          <ChevronLeft size={20} />
        </button>

        <button 
          className="library-header-btn" 
          onClick={handleHeaderNext}
          disabled={!canGoForward}
          title="下一頁 / 下一層"
          style={{ opacity: canGoForward ? 1 : 0.3 }}
        >
          <ChevronRight size={20} />
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {/* 右上角齒輪設定圖示 */}
          <button 
            className="library-header-btn" 
            onClick={onOpenSettings}
            title="偏好設定"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* 主頁面內容區 */}
      <main className="cbeta-catalog-body custom-scrollbar">
        {/* 上方固定控制與搜尋面板 */}
        <section className="cbeta-top-panel">
          {/* 1. 關鍵字搜尋卡片 */}
          <div className="cbeta-search-card">
            {/* 💡 搜尋框上方標題：「[+] / [-] 檢索 CBETA 並下載書籍」（置左對齊、可點擊展開/收合） */}
            <div 
              className="cbeta-section-toggle-header"
              onClick={handleToggleSearch}
              title={isSearchExpanded ? '點擊收合檢索區塊' : '點擊展開檢索區塊'}
            >
              {isSearchExpanded ? (
                <Minus size={18} style={{ strokeWidth: 2.5, flexShrink: 0 }} />
              ) : (
                <Plus size={18} style={{ strokeWidth: 2.5, flexShrink: 0 }} />
              )}
              <span>
                搜尋 <span className="cbeta-green-brand">CBETA</span> 電子佛典
              </span>
            </div>

            {/* 展開時才顯示搜尋輸入框與關鍵字晶片 */}
            {isSearchExpanded && (
              <>
                <form className="cbeta-search-input-wrapper" onSubmit={handleSearchSubmit}>
                  <input 
                    type="text" 
                    className="cbeta-search-input"
                    placeholder="輸入關鍵字，例如：地藏、鳩摩羅什、T0235"
                    value={onlineSearchQuery}
                    onFocus={() => {
                      if (isCategoriesExpanded) setIsCategoriesExpanded(false);
                    }}
                    onChange={(e) => {
                      setOnlineSearchQuery(e.target.value);
                      if (e.target.value.trim() && isCategoriesExpanded) {
                        setIsCategoriesExpanded(false);
                      }
                      if (!e.target.value.trim() && isTextSearchActive) {
                        handleClearSearch();
                      }
                    }}
                  />
                  <div className="cbeta-search-actions">
                    {onlineSearchQuery && (
                      <button 
                        type="button" 
                        className="cbeta-search-clear-btn" 
                        onClick={handleClearSearch}
                        title="結束/清除搜尋"
                      >
                        <X size={18} />
                      </button>
                    )}
                    <button type="submit" className="cbeta-search-btn" disabled={isSearchingOnline} title="搜尋 CBETA 經典">
                      {isSearchingOnline ? <span style={{ fontSize: '0.75rem' }}>...</span> : <Search size={20} />}
                    </button>
                  </div>
                </form>

                {/* 💡 近期 5 個搜尋關鍵字 Chip 標籤列 (單行、灰黑小字) */}
                {recentSearches.length > 0 && (
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.4rem', 
                      marginTop: '0.55rem', 
                      overflowX: 'auto', 
                      whiteSpace: 'nowrap',
                      paddingBottom: '0.15rem',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                    className="custom-scrollbar"
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #718096)', flexShrink: 0, opacity: 0.85 }}>
                      近期搜尋：
                    </span>
                    {recentSearches.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isCategoriesExpanded) setIsCategoriesExpanded(false);
                          executeSearch(q);
                        }}
                        style={{
                          fontSize: '0.76rem',
                          color: 'var(--text-primary, #4a5568)',
                          backgroundColor: 'var(--theme-accent-light, rgba(0, 0, 0, 0.04))',
                          border: '1px solid var(--theme-accent-border, rgba(0, 0, 0, 0.12))',
                          borderRadius: '12px',
                          padding: '0.15rem 0.55rem',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.15s ease'
                        }}
                        title={`點擊立即搜尋：${q}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* 💡 上方加一條細細的分隔線 + 置左對齊動態開關：「+ 依類別查詢」 */}
            {!isTextSearchActive && (
              <>
                <div 
                  className="cbeta-category-divider"
                  style={{
                    height: '1px',
                    backgroundColor: 'var(--reader-border, rgba(0, 0, 0, 0.08))',
                    marginTop: isSearchExpanded ? '1.1rem' : '0.6rem',
                    marginBottom: '0.6rem',
                    width: '100%'
                  }}
                />
                <div 
                  className="cbeta-section-toggle-header"
                  onClick={handleToggleCategories}
                  title={isCategoriesExpanded ? '點擊收合類別查詢' : '點擊展開類別查詢'}
                >
                  {isCategoriesExpanded ? (
                    <Minus size={18} style={{ strokeWidth: 2.5, flexShrink: 0 }} />
                  ) : (
                    <Plus size={18} style={{ strokeWidth: 2.5, flexShrink: 0 }} />
                  )}
                  <span>依類別查詢</span>
                </div>
              </>
            )}
          </div>

          {/* 2. 5 個 Chrome 風精緻 Tab 頁籤 (預設收合，點選「+」後展開，圖示在上方) */}
          {!isTextSearchActive && isCategoriesExpanded && (
            <div className="cbeta-tabs-grid">
              {[
                { id: 'favorite', label: '常用經典', icon: Heart },
                { id: 'dept', label: '依部類', icon: Layers },
                { id: 'vol', label: '依冊別', icon: BookMarked },
                { id: 'creator', label: '依作譯者', icon: User },
                { id: 'time', label: '依朝代', icon: Clock }
              ].map((tabItem, idx, tabArr) => {
                const isActive = activeTab === tabItem.id;
                const isNextActive = tabArr[idx + 1] && tabArr[idx + 1].id === activeTab;
                const IconComp = tabItem.icon;

                return (
                  <div 
                    key={`cbeta-tab-${tabItem.id}`}
                    className={`cbeta-tab-block ${isActive ? 'active' : ''} ${isNextActive ? 'prev-active' : ''}`}
                    onClick={() => handleTabSelect(tabItem.id as any)}
                  >
                    <IconComp size={17} />
                    <span>{tabItem.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 文字搜尋結果區塊 */}
        {isTextSearchActive && (
          <section className="cbeta-content-pane">
            {isSearchingOnline ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                正在線上檢索 CBETA 藏經庫《{onlineSearchQuery}》經典中...
              </div>
            ) : onlineResults.length > 0 ? (
              <>
                <div className="cbeta-pane-header">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-rounded)', color: 'var(--text-primary)' }}>
                      搜尋結果 ({onlineResults.length} 本)
                    </h3>
                    
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <button 
                        type="button" 
                        className="batch-btn batch-btn-secondary" 
                        onClick={() => handleSelectAllOnlineResults(onlineResults)}
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem', fontFamily: 'var(--font-rounded)' }}
                      >
                        {selectedOnlineWorkIds.length === onlineResults.filter(r => !downloadedWorkIds.includes(r.workId)).length && selectedOnlineWorkIds.length > 0
                          ? '取消全選'
                          : '全選未下載'}
                      </button>

                      <button 
                        type="button"
                        className="batch-btn batch-btn-primary"
                        disabled={selectedOnlineWorkIds.length === 0}
                        onClick={() => {
                          setBatchFolderName(onlineSearchQuery.trim() || '下載經典');
                          setBatchFolderMode('new');
                          setShowBatchDownloadModal(true);
                        }}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-rounded)' }}
                      >
                        <Download size={15} />
                        批量下載與收納 ({selectedOnlineWorkIds.length})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="cbeta-items-scroll-area custom-scrollbar">
                  <div className="cbeta-items-grid">
                    {onlineResults.map((res) => {
                      const isDownloaded = downloadedWorkIds.includes(res.workId);
                      const isChecked = selectedOnlineWorkIds.includes(res.workId);

                      return (
                        <div 
                          key={`search-res-${res.workId}`} 
                          className={`cbeta-work-card ${isChecked ? 'selected' : ''}`}
                          onClick={() => !isDownloaded && toggleSelectOnlineWork(res.workId)}
                          style={{ cursor: isDownloaded ? 'default' : 'pointer' }}
                        >
                          {!isDownloaded && (
                            <div 
                              className={`batch-checkbox ${isChecked ? 'checked' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectOnlineWork(res.workId);
                              }}
                              style={{ marginRight: '6px' }}
                            >
                              {isChecked && <Check size={12} />}
                            </div>
                          )}

                          <div className="cbeta-work-badge">{res.workId}</div>

                          <div className="cbeta-work-info">
                            <div className="cbeta-work-title">{res.title}</div>
                            <div className="cbeta-work-meta">{res.creators} · {res.juansCount}卷</div>
                          </div>

                          {isDownloaded ? (
                            <div className="download-status-square" title="已匯入書架">
                              <Check size={16} />
                            </div>
                          ) : (
                            <button 
                              className="download-btn-square" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadSingleWork(res);
                              }} 
                              title="下載匯入"
                            >
                              <Download size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                未找到與「{onlineSearchQuery}」相關的經典
              </div>
            )}
          </section>
        )}

        {/* 滿版樹狀與層級內容區 (非搜尋模式且點選「+依類別查詢」後呈現) */}
        {!isTextSearchActive && isCategoriesExpanded && (
          <section className="cbeta-content-pane">
            {/* 💡 當有經文清單（包含「常用經典」與深層目錄）時，顯示麵包屑與批量下載工具列 */}
            {(historyIndex > 0 || currentCategoryWorks.length > 0) && (
              <div className="cbeta-pane-header">
                <div className="cbeta-breadcrumb-row">
                  {historyStack.slice(0, historyIndex + 1).map((node, index) => {
                    const isLast = index === historyIndex;
                    return (
                      <React.Fragment key={`bc-${node.id}-${index}`}>
                        {index > 0 && <span className="cbeta-breadcrumb-sep">»</span>}
                        <span 
                          className={`cbeta-breadcrumb-crumb ${isLast ? 'current' : ''}`}
                          onClick={() => handleBreadcrumbClick(index)}
                        >
                          {node.label}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 當子層級包含經典時，顯示批量工具列 */}
                {currentCategoryWorks.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0.2rem 0' }}>
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                      本層共有 {currentCategoryWorks.length} 本經典
                    </span>

                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <button 
                        type="button" 
                        className="batch-btn batch-btn-secondary" 
                        onClick={() => handleSelectAllOnlineResults(currentCategoryWorks)}
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', fontFamily: 'var(--font-rounded)' }}
                      >
                        {selectedOnlineWorkIds.length === currentCategoryWorks.filter(r => !downloadedWorkIds.includes(r.workId || r.id)).length && selectedOnlineWorkIds.length > 0
                          ? '取消全選'
                          : '全選未下載'}
                      </button>

                      <button 
                        type="button"
                        className="batch-btn batch-btn-primary"
                        disabled={selectedOnlineWorkIds.length === 0}
                        onClick={() => {
                          const currentNode = historyStack[historyIndex];
                          setBatchFolderName(currentNode ? currentNode.label : '下載經典');
                          setBatchFolderMode('new');
                          setShowBatchDownloadModal(true);
                        }}
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-rounded)' }}
                      >
                        <Download size={14} />
                        批量下載與收納 ({selectedOnlineWorkIds.length})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 獨立垂直滾動區：經典與資料夾卡片在這裡進行內部滾動 */}
            <div className="cbeta-items-scroll-area custom-scrollbar">
              {isLoadingCatalog ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                  正在檢索 CBETA 藏經庫數據中...
                </div>
              ) : catalogItems.length > 0 ? (
                <div className="cbeta-items-grid">
                  {catalogItems.map((item) => {
                    const isWork = item.nodeType === 'work' || !!item.workId;
                    const wId = item.workId || item.id;
                    const isDownloaded = downloadedWorkIds.includes(wId);
                    const isChecked = selectedOnlineWorkIds.includes(wId);

                    if (isWork) {
                      return (
                        <div 
                          key={`catalog-item-${item.id}`} 
                          className={`cbeta-work-card ${isChecked ? 'selected' : ''}`}
                          onClick={() => !isDownloaded && toggleSelectOnlineWork(wId)}
                          style={{ cursor: 'pointer' }}
                        >
                          {!isDownloaded && (
                            <div 
                              className={`batch-checkbox ${isChecked ? 'checked' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectOnlineWork(wId);
                              }}
                              style={{ marginRight: '6px' }}
                            >
                              {isChecked && <Check size={12} />}
                            </div>
                          )}

                          <div className="cbeta-work-badge">{wId}</div>
                          <div className="cbeta-work-info">
                            <div className="cbeta-work-title">{item.label}</div>
                            <div className="cbeta-work-meta">
                              {item.creators || 'CBETA 電子佛典'}
                            </div>
                          </div>

                          {isDownloaded ? (
                            <div className="download-status-square" title="已在書架">
                              <Check size={16} />
                            </div>
                          ) : (
                            <button 
                              className="download-btn-square" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item);
                              }} 
                              title="下載匯入"
                            >
                              <Download size={16} />
                            </button>
                          )}
                        </div>
                      );
                    }

                    // 資料夾 (筆劃數資料夾 / 大師名字資料夾 / 部類冊別層級)
                    return (
                      <div 
                        key={`catalog-folder-${item.id}`}
                        className="cbeta-folder-card"
                        onClick={() => handleItemClick(item)}
                      >
                        <Folder size={20} style={{ color: 'var(--theme-accent, #cf9f60)', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minWidth: 0 }}>
                          <span className="cbeta-folder-title">{item.label}</span>
                          {item.subLabel && (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                              {item.subLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontFamily: 'var(--font-rounded)' }}>
                  此分類下無子項目
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* 批量下載與自動資料夾收納對話框 */}
      {showBatchDownloadModal && (
        <div className="search-dialog-overlay" style={{ zIndex: 1250 }} onClick={() => setShowBatchDownloadModal(false)}>
          <div className="changelog-dialog-card animate-slide-up" style={{ width: '92%', maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: '"Microsoft JhengHei", "PingFang TC", "STHeiti", sans-serif' }}>批量下載經典收納設定</h3>
              <button className="icon-button close-btn" onClick={() => setShowBatchDownloadModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="dialog-body" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', fontFamily: '"Microsoft JhengHei", "PingFang TC", "STHeiti", sans-serif' }}>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                即將開始下載已勾選的 <strong style={{ color: 'var(--theme-accent)' }}>{selectedOnlineWorkIds.length}</strong> 本經典。
              </div>

              {/* 收納方式單選選項 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  選擇下載收納方式：
                </span>

                <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="batchFolderMode"
                    checked={batchFolderMode === 'new'} 
                    onChange={() => setBatchFolderMode('new')}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  建立新資料夾收納經書
                </label>

                {batchFolderMode === 'new' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.6rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>資料夾名稱（預設於「我的書櫃」）：</span>
                    <input 
                      type="text" 
                      className="settings-select"
                      value={batchFolderName}
                      onChange={(e) => setBatchFolderName(e.target.value)}
                      placeholder="請輸入資料夾名稱..."
                      style={{ fontSize: '0.88rem', padding: '0.5rem 0.8rem', fontFamily: '"Microsoft JhengHei", "PingFang TC", "STHeiti", sans-serif' }}
                    />
                  </div>
                )}

                <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="batchFolderMode"
                    checked={batchFolderMode === 'existing'} 
                    onChange={() => setBatchFolderMode('existing')}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  放入我的書櫃
                </label>

                {batchFolderMode === 'existing' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.6rem' }}>
                    {folders.length > 0 ? (
                      <select 
                        className="settings-select"
                        value={selectedExistingFolderId}
                        onChange={(e) => setSelectedExistingFolderId(e.target.value)}
                        style={{ fontSize: '0.88rem', padding: '0.55rem 0.8rem', fontFamily: '"Microsoft JhengHei", "PingFang TC", "STHeiti", sans-serif' }}
                      >
                        {folders.map(f => (
                          <option key={f.id} value={f.id}>
                            📁 {f.name} ({f.bookIds.length} 本)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--theme-accent)', padding: '0.3rem 0' }}>
                        （目前尚未建立任何資料夾，請選擇「建立新資料夾」）
                      </div>
                    )}
                  </div>
                )}

                <label className="checkbox-item" style={{ fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="batchFolderMode"
                    checked={batchFolderMode === 'none'} 
                    onChange={() => setBatchFolderMode('none')}
                    style={{ accentColor: 'var(--theme-accent)' }}
                  />
                  下載至首頁
                </label>
              </div>

              <div className="dialog-actions-row" style={{ marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="dialog-btn-cancel"
                  onClick={() => setShowBatchDownloadModal(false)}
                  style={{ fontFamily: 'var(--font-rounded)' }}
                >
                  取消
                </button>
                <button 
                  type="button" 
                  className="dialog-btn-confirm"
                  onClick={handleExecuteBatchDownload}
                  disabled={(batchFolderMode === 'new' && !batchFolderName.trim()) || (batchFolderMode === 'existing' && !selectedExistingFolderId)}
                  style={{ fontFamily: 'var(--font-rounded)' }}
                >
                  開始下載
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 大部頭經典 (> 80 卷) 下載前預估時間與確認對話框 */}
      {largeDownloadTarget && (
        <div className="search-dialog-overlay" style={{ zIndex: 1250 }} onClick={() => setLargeDownloadTarget(null)}>
          <div className="changelog-dialog-card animate-slide-up" style={{ width: '92%', maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 style={{ fontFamily: 'var(--font-rounded)' }}>大部頭經典下載提示</h3>
              <button className="icon-button close-btn" onClick={() => setLargeDownloadTarget(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="dialog-body" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6, fontFamily: 'var(--font-rounded)' }}>
                《<strong>{largeDownloadTarget.title}</strong>》全書共 <strong style={{ color: 'var(--theme-accent)' }}>{largeDownloadTarget.juansCount}</strong> 卷，篇幅宏大。
              </div>

              <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.03)', padding: '0.85rem', borderRadius: '8px', lineHeight: 1.6, fontFamily: 'var(--font-rounded)' }}>
                🚀 系統已啟用 6 線程動態併行流極速下載引擎（配備自動 3 次重試與抗限流保護），全集預估下載與建置時間約需：
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--theme-accent)', marginTop: '0.35rem' }}>
                  {largeDownloadTarget.juansCount >= 500 ? '約 3 ~ 6 分鐘' : largeDownloadTarget.juansCount >= 200 ? '約 1 ~ 3 分鐘' : '約 30 ~ 60 秒'}
                </div>
              </div>

              <div className="dialog-actions-row" style={{ marginTop: '0.4rem' }}>
                <button 
                  type="button" 
                  className="dialog-btn-cancel"
                  onClick={() => setLargeDownloadTarget(null)}
                  style={{ fontFamily: 'var(--font-rounded)' }}
                >
                  取消
                </button>
                <button 
                  type="button" 
                  className="dialog-btn-confirm"
                  onClick={() => {
                    const target = largeDownloadTarget;
                    setLargeDownloadTarget(null);
                    executeSingleWorkDownload(target);
                  }}
                  style={{ fontFamily: 'var(--font-rounded)' }}
                >
                  🚀 確定下載全集
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Builder 進度遮罩 */}
      {buildProgress && (
        <div className={`builder-progress-overlay theme-${settings.theme}`}>
          <div className="builder-animation-box">
            <div 
              className="builder-outer-ring" 
              style={{ transform: `rotate(${buildProgress.percent * 3.6}deg)`, transition: 'transform 0.2s linear' }}
            />
            <div className={`builder-mandala ${buildProgress.percent === 100 ? 'is-completed' : ''}`}>
              <img 
                src="/apple-touch-icon.png" 
                alt="CBETA Reader 淨心閱讀"
                className="builder-logo-img"
              />
            </div>
          </div>

          <div className="builder-header-message">
            {buildProgress.message}
          </div>

          <div className="builder-details-card animate-slide-up">
            <div className="builder-title">下載中{loadingDots}</div>
            <div className="builder-progress-bar-wrapper">
              <div className="builder-progress-bar-fill" style={{ width: `${buildProgress.percent}%` }} />
            </div>
            
            <div className="builder-step-status">
              <div className={`builder-step-item ${buildProgress.step === 'metadata' ? 'active' : ''} ${['fetch_content', 'navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>1. 取得佛典詮釋資料(Index Builder)</span>
                <span>{renderStepIcon('metadata', buildProgress.step, buildProgress.percent)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'fetch_content' ? 'active' : ''} ${['navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>2. 經典段落標記解析(Reader Builder)</span>
                <span>{renderStepIcon('fetch_content', buildProgress.step, buildProgress.percent)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'navigation' ? 'active' : ''} ${['reference', 'search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>3. 目錄結構與卷期編排(Navigation Builder)</span>
                <span>{renderStepIcon('navigation', buildProgress.step, buildProgress.percent)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'reference' ? 'active' : ''} ${['search_index', 'ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>4. 校勘註解與學術比對(Reference Builder)</span>
                <span>{renderStepIcon('reference', buildProgress.step, buildProgress.percent)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'search_index' ? 'active' : ''} ${['ai_index', 'saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>5. 本地高速檢索索引建置(Search Index Builder)</span>
                <span>{renderStepIcon('search_index', buildProgress.step, buildProgress.percent)}</span>
              </div>
              <div className={`builder-step-item ${buildProgress.step === 'ai_index' ? 'active' : ''} ${['saving', 'completed'].includes(buildProgress.step) ? 'completed' : ''}`}>
                <span>6. AI 輔助閱讀與語意索引(AI Indexer)</span>
                <span>{renderStepIcon('ai_index', buildProgress.step, buildProgress.percent)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CbetaCatalogView;
