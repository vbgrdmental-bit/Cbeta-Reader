/**
 * 佛教農曆與佛菩薩紀念日/十齋日計算工具
 * 採用現代瀏覽器原生 Intl.DateTimeFormat('zh-TW-u-ca-chinese') 進行高精度無依賴農曆換算
 */

export interface LunarInfo {
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  monthDays: number;     // 該農曆月總天數 (29 為小月，30 為大月)
  monthStr: string;      // 例如 "八月"、"閏六月"
  dayStr: string;        // 例如 "初一"、"十九"、"三十"
  fullStr: string;       // 例如 "八月十九"
  cellLabel: string;     // 月曆格子下方精簡展示（例如 "觀音誕"、"十齋"、"十九"）
  festival?: string;     // 佛菩薩聖誕或紀念日（例如 "藥師如來誕"）
  isZhai: boolean;       // 是否為十齋日
  zhaiName?: string;     // 齋日名稱（例如 "十齋日"）
  noteDetail: string;    // 下方備註完整文字（例如 "農曆九月三十 · 藥師如來誕 · 十齋日"）
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

/** 判定指定公曆日期所屬之農曆月為大月(30天)或小月(29天) */
function getLunarMonthLength(date: Date, curDay: number, curMonthRaw: string): number {
  const test30 = new Date(date);
  test30.setDate(date.getDate() + (30 - curDay));
  const parts30 = new Intl.DateTimeFormat('zh-TW-u-ca-chinese', { 
    month: 'numeric', 
    day: 'numeric' 
  }).formatToParts(test30);
  const day30 = parseInt(parts30.find(p => p.type === 'day')?.value || '1', 10);
  const month30 = parts30.find(p => p.type === 'month')?.value || '1';
  return (month30 === curMonthRaw && day30 === 30) ? 30 : 29;
}

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

    // 計算該農曆月是大月(30天)還是小月(29天)
    const monthDays = getLunarMonthLength(date, dayNum, mPart);

    // 檢查是否有節日
    const festKey = `${monthNum}-${dayNum}`;
    let festival = BUDDHIST_FESTIVALS[festKey];

    // 特殊情況：若為小月無三十日，七月廿九可視為地藏菩薩誕，九月廿九可視為藥師如來誕
    if (!festival && monthDays === 29 && dayNum === 29) {
      if (monthNum === 7) festival = '地藏菩薩誕';
      if (monthNum === 9) festival = '藥師如來誕';
    }

    // 💡 依《地藏經》十齋日：初一、初八、十四、十五、十八、二三、二四、月底三日
    // 月底三日有大小月之分：大月為二八、二九、三十；小月為二七、二八、二九
    const zhaiDaysSet = monthDays === 30 
      ? new Set([1, 8, 14, 15, 18, 23, 24, 28, 29, 30])
      : new Set([1, 8, 14, 15, 18, 23, 24, 27, 28, 29]);

    const isZhai = zhaiDaysSet.has(dayNum);
    const zhaiName = isZhai ? '十齋日' : undefined;

    // 💡 月曆格子下方精簡展示 (小字)：
    // 1. 若十齋日有遇到佛教常用日期，則月曆上優先顯示佛教常用日期（如 "藥師誕"、"觀音誕"）
    // 2. 若無節日且為十齋日，顯示 "十齋"（初一顯示 "初一·齋"、十五顯示 "十五·齋"）
    // 3. 一般日子顯示農曆日（如 "十九"、"廿二"）
    let cellLabel = dName;
    if (festival) {
      // 精簡名稱至 3~4 字呈現於月曆小格中
      cellLabel = festival.replace('菩薩', '').replace('如來', '').replace('古佛', '');
    } else if (dayNum === 1) {
      cellLabel = isZhai ? '初一·齋' : '初一';
    } else if (dayNum === 15) {
      cellLabel = isZhai ? '十五·齋' : '十五';
    } else if (isZhai) {
      cellLabel = '十齋';
    }

    // 💡 下方備註接續二則並陳（例如：農曆九月三十 · 藥師如來誕 · 十齋日）
    const noteParts = [`農曆${fullStr}`];
    if (festival) {
      noteParts.push(festival);
    }
    if (isZhai) {
      noteParts.push('十齋日');
    }
    const noteDetail = noteParts.join(' · ');

    const res: LunarInfo = {
      lunarYear: y,
      lunarMonth: monthNum,
      lunarDay: dayNum,
      isLeapMonth: isLeap,
      monthDays,
      monthStr: mName,
      dayStr: dName,
      fullStr,
      cellLabel,
      festival,
      isZhai,
      zhaiName,
      noteDetail
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
      monthDays: 30,
      monthStr: `${m}月`,
      dayStr: `${d}日`,
      fullStr: `${m}月${d}日`,
      cellLabel: `${d}日`,
      isZhai: false,
      noteDetail: `農曆${m}月${d}日`
    };
    return fallback;
  }
}
