/**
 * 佛教農曆與佛菩薩紀念日/十齋日計算工具
 * 採用現代瀏覽器原生 Intl.DateTimeFormat('zh-TW-u-ca-chinese') 進行高精度無依賴農曆換算
 */

export interface LunarInfo {
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  monthStr: string;      // 例如 "八月"、"閏六月"
  dayStr: string;        // 例如 "初一"、"十九"、"三十"
  fullStr: string;       // 例如 "八月十九"
  cellLabel: string;     // 月曆格子下方精簡展示（例如 "觀音誕"、"十齋"、"十九"）
  festival?: string;     // 佛菩薩聖誕或紀念日
  isZhai: boolean;       // 是否為十齋日
  zhaiName?: string;     // 齋日名稱（例如 "十齋日"、"朔望齋"）
}

// 漢傳佛教常用佛菩薩聖誕與重要修持紀念日（農曆月份-日期）
const BUDDHIST_FESTIVALS: Record<string, string> = {
  '1-1': '彌勒菩薩誕',
  '1-6': '定光佛誕',
  '2-8': '釋迦佛出家',
  '2-15': '釋迦佛涅槃',
  '2-19': '觀音菩薩誕',
  '2-21': '普賢菩薩誕',
  '3-16': '準提菩薩誕',
  '4-4': '文殊菩薩誕',
  '4-8': '釋迦佛聖誕', // 浴佛節
  '4-15': '佛吉祥日',  // 衛塞節
  '4-28': '藥王菩薩誕',
  '5-13': '伽藍菩薩誕',
  '6-3': '韋馱菩薩誕',
  '6-19': '觀音成道日',
  '7-13': '大勢至菩薩誕',
  '7-15': '佛歡喜日',  // 盂蘭盆節
  '7-24': '龍樹菩薩誕',
  '7-30': '地藏菩薩誕',
  '8-22': '燃燈古佛誕',
  '9-19': '觀音出家日',
  '9-30': '藥師如來誕',
  '10-5': '達摩祖師誕',
  '11-17': '阿彌陀佛誕',
  '12-8': '釋迦佛成道', // 臘八成道日
  '12-29': '華嚴菩薩誕'
};

const LUNAR_MONTH_NAMES = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '臘'];
const LUNAR_DAY_NAMES = [
  '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];

// 《地藏經》十齋日：每月初一、初八、十四、十五、十八、廿三、廿四、廿八、廿九、三十
const TEN_ZHAI_DAYS = new Set([1, 8, 14, 15, 18, 23, 24, 28, 29, 30]);

/** 快取近期日期的農曆計算結果，避免重複格式化 */
const lunarCache = new Map<string, LunarInfo>();

/**
 * 取得指定公曆日期的農曆與佛教節日資訊
 */
export function getLunarInfo(date: Date): LunarInfo {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const cacheKey = `${y}-${m}-${d}`;

  const cached = lunarCache.get(cacheKey);
  if (cached) return cached;

  try {
    const parts = new Intl.DateTimeFormat('zh-TW-u-ca-chinese', { 
      month: 'numeric', 
      day: 'numeric' 
    }).formatToParts(date);

    const mPart = parts.find(p => p.type === 'month')?.value || '1';
    const isLeap = mPart.includes('閏') || mPart.includes('bis') || mPart.startsWith('r');
    const monthNum = parseInt(mPart.replace(/[^0-9]/g, ''), 10) || 1;
    const dayNum = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);

    const mName = (isLeap ? '閏' : '') + (LUNAR_MONTH_NAMES[monthNum] || monthNum) + '月';
    const dName = LUNAR_DAY_NAMES[dayNum] || `${dayNum}日`;
    const fullStr = `${mName}${dName}`;

    // 檢查是否有節日
    const festKey = `${monthNum}-${dayNum}`;
    let festival = BUDDHIST_FESTIVALS[festKey];

    // 特殊情況：若無三十日，七月廿九可視為地藏誕，九月廿九可視為藥師誕
    if (!festival && dayNum === 29) {
      // 判斷次日是否為初一
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      const nextParts = new Intl.DateTimeFormat('zh-TW-u-ca-chinese', { day: 'numeric' }).formatToParts(nextDay);
      const nextDayNum = parseInt(nextParts.find(p => p.type === 'day')?.value || '1', 10);
      if (nextDayNum === 1) {
        if (monthNum === 7) festival = '地藏菩薩誕';
        if (monthNum === 9) festival = '藥師如來誕';
      }
    }

    const isZhai = TEN_ZHAI_DAYS.has(dayNum);
    let zhaiName: string | undefined = undefined;
    if (isZhai) {
      zhaiName = (dayNum === 1 || dayNum === 15) ? '朔望齋' : '十齋日';
    }

    // 月曆格子下方精簡展示 (小字)：
    // 1. 若有佛菩薩紀念日，優先顯示（如 "觀音誕"、"地藏誕"）
    // 2. 若為初一，顯示月份朔日（如 "八月初一" 或 "初一"）
    // 3. 若為十五，顯示 "十五望" 或 "十五"
    // 4. 若為十齋日，顯示 "十齋"
    // 5. 一般日子顯示農曆日（如 "十九"、"廿二"）
    let cellLabel = dName;
    if (festival) {
      // 精簡名稱至 3~4 字
      cellLabel = festival.replace('菩薩', '').replace('如來', '').replace('古佛', '');
    } else if (dayNum === 1) {
      cellLabel = isZhai ? '初一·齋' : '初一';
    } else if (dayNum === 15) {
      cellLabel = isZhai ? '十五·齋' : '十五';
    } else if (isZhai) {
      cellLabel = '十齋';
    }

    const res: LunarInfo = {
      lunarYear: y,
      lunarMonth: monthNum,
      lunarDay: dayNum,
      isLeapMonth: isLeap,
      monthStr: mName,
      dayStr: dName,
      fullStr,
      cellLabel,
      festival,
      isZhai,
      zhaiName
    };

    lunarCache.set(cacheKey, res);
    return res;
  } catch (err) {
    console.warn('Lunar calculation fallback for', date, err);
    const fallback: LunarInfo = {
      lunarYear: y,
      lunarMonth: m,
      lunarDay: d,
      isLeapMonth: false,
      monthStr: `${m}月`,
      dayStr: `${d}日`,
      fullStr: `${m}月${d}日`,
      cellLabel: `${d}日`,
      isZhai: false
    };
    return fallback;
  }
}
