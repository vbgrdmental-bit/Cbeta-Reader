/**
 * CBETA Reader - 主題與佛光色彩管理模組
 * 包含：W3C WCAG 2.1 相對亮度計算、深淺色模式自動判定、佛教修行光譜及動態 CSS 變數注入
 */

export interface SacredThemeColor {
  id: string;
  name: string;
  sub: string;
  hex: string;
}

/** 尊貴顯密傳承修行佛光色系 (由淺到深、六大不同光譜排列) */
export const SACRED_THEME_PALETTE: SacredThemeColor[] = [
  { id: 'lotus_mist', name: '蓮花粉', sub: '西方淨土 · 慈悲柔和', hex: '#ebdcd9' },
  { id: 'amber_gold', name: '琥珀金', sub: '增益法門 · 泥金古經', hex: '#dcb372' },
  { id: 'azure_sky', name: '天青藍', sub: '琉璃晴空 · 清涼澄澈', hex: '#8caec4' },
  { id: 'cinnabar_red', name: '硃砂赤', sub: '甘珠爾經 · 尊榮藏紅', hex: '#8c3835' },
  { id: 'pine_green', name: '青松黛', sub: '空山古剎 · 清心安神', hex: '#234a3b' },
  { id: 'sandalwood_purple', name: '紫紺木', sub: '金剛威德 · 甚深紫檀', hex: '#221426' },
];

/**
 * 將 Hex 顏色轉換為 RGB 數值 (0-255)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

/**
 * 計算符合 W3C WCAG 2.1 標準的相對亮度 (Relative Luminance)
 * 回傳值介於 0 (最暗純黑) 到 1 (最亮純白)
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const sRgb = [r, g, b].map(val => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRgb[0] + 0.7152 * sRgb[1] + 0.0722 * sRgb[2];
}

/**
 * 判斷自訂顏色是否應判定為「深色模式」
 * 閾值設為 0.38 (兼顧舒適護眼與高對比)
 */
export function isDarkColor(hex: string): boolean {
  return getRelativeLuminance(hex) < 0.38;
}

/**
 * 微調顏色的明度 (用於產生背景漸層與卡片底色)
 */
export function adjustColorBrightness(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const adj = (val: number) => {
    const res = Math.round(val + (255 - val) * (percent / 100));
    return Math.min(255, Math.max(0, res));
  };
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(adj(r))}${toHex(adj(g))}${toHex(adj(b))}`;
}

/**
 * 將 RGB 轉換為 HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s, l };
}

/**
 * 將 HSL 轉換為 Hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360;
  const hue2rgb = (p: number, q: number, t: number) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1 / 2) return q;
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 依據主題背景色，智慧衍生出同色系高和諧度的「深色(相關色)」與「淺色(相關色)」
 */
export interface SystemColorTokens {
  // 0. 大螢幕外圍背景 (Desktop Outer Canvas / Backdrop)
  bgOuterCanvas: string;       // 大螢幕兩側畫布底色 (襯托中央手機版型，同色相柔和景深)

  // 1. 基底與表面層
  bgCard: string;              // 一級卡片 (首頁小卡、日誌月曆、統計卡)
  surfaceCard: string;         // 內部表面/浮動卡片 (全息分段鍵、彈窗內盒)
  surfaceModal: string;        // 彈窗背景 (玉白或深色防穿透層)
  surfaceModalBorder: string;  // 彈窗外邊框
  bgCardSubtle: string;        // 次級凹槽/摘要底色 (摘要框、榜單條)
  surfaceCapsule: string;      // 未選中膠囊/次級按鍵槽底色
  borderColor: string;         // 主邊框色
  borderSubtle: string;        // 次級細邊框
  readerBorder: string;        // 閱讀器邊框
  
  // 2. 主動強調與按鈕
  accent: string;              // 主行動色 (「接續閱讀」、「繼續閱讀」等主行動鍵底色)
  accentHover: string;         // 主行動色 hover
  accentLight: string;         // 選中/高亮膠囊微透底
  accentBorder: string;        // 選中膠囊微透邊框
  accentContrast: string;      // 主行動鍵上的文字顏色 (自動算力：深色底金光配 #18181b，淺色底深色配 #ffffff)
  
  // 3. 全局文字階梯
  textPrimary: string;         // 經題、主數據、標題 (≥ 7:1)
  textSecondary: string;       // 副標、段落文字 (≥ 4.5:1)
  textMuted: string;           // 卷數、日期、輔助小字 (≥ 3:1)
  
  // 4. 輔助/危險功能
  btnDeleteBg: string;         // 刪除按鍵底色
  btnDeleteBorder: string;     // 刪除按鍵邊框
  btnDeleteText: string;       // 刪除按鍵文字

  // 5. 🌟 聞思修三學語意標籤 (深色底採用翡翠玉光/天青琉璃/璀璨泥金發光色，淺色底採用深沉墨色)
  tagListenText: string;       // 閱讀記錄/時間標籤 (3分鐘) 文字
  tagListenBg: string;         // 閱讀記錄/時間標籤底色
  tagListenBorder: string;     // 閱讀記錄卡片強調邊框
  tagThinkText: string;        // 我的筆記經號 (Y0040·第1卷) 文字
  tagThinkBg: string;          // 筆記經號膠囊底色
  tagThinkBorder: string;      // 筆記卡片強調邊框
  tagPracticeText: string;     // 轉持經 (+修) 圓圈文字
  tagPracticeBg: string;       // +修 圓圈底色
  tagPracticeBorder: string;   // +修 圓圈邊框
}

/**
 * 依據主題背景色，透過「明度三態分級 (Luminance 3-Tier)」與 HSL 算法
 * 自動推導全套高和諧度、符合 WCAG 2.1 高對比標準之語意化色彩 Token
 */
export function calculateSemanticTokens(hex: string): SystemColorTokens {
  const clean = hex.toLowerCase().trim();

  // 1. 六大經典修行佛光色：尊榮精雕專屬配色
  if (clean === '#ebdcd9') {
    // 🌸 蓮花粉 (極淺雅緻)
    return {
      bgOuterCanvas: '#dec9c5', // 溫潤蓮華暖粉泥，襯托中央柔白主頁
      bgCard: '#faf3f1',
      surfaceCard: '#f6eeeb',
      surfaceModal: '#faf3f1',
      surfaceModalBorder: 'rgba(120, 62, 57, 0.22)',
      bgCardSubtle: '#f2e5e1',
      surfaceCapsule: 'rgba(120, 62, 57, 0.06)',
      borderColor: 'rgba(120, 62, 57, 0.18)',
      borderSubtle: 'rgba(120, 62, 57, 0.08)',
      readerBorder: 'rgba(120, 62, 57, 0.22)',
      accent: '#783e39',
      accentHover: '#5e302c',
      accentLight: 'rgba(120, 62, 57, 0.10)',
      accentBorder: 'rgba(120, 62, 57, 0.25)',
      accentContrast: '#ffffff',
      textPrimary: '#2c1e1c',
      textSecondary: '#524038',
      textMuted: '#786259',
      btnDeleteBg: '#fee2e2',
      btnDeleteBorder: 'rgba(239, 68, 68, 0.35)',
      btnDeleteText: '#dc2626',
      tagListenText: '#15803d',
      tagListenBg: 'rgba(34, 197, 94, 0.10)',
      tagListenBorder: 'rgba(21, 128, 61, 0.25)',
      tagThinkText: '#1e4b6e',
      tagThinkBg: 'rgba(30, 75, 110, 0.08)',
      tagThinkBorder: 'rgba(30, 75, 110, 0.25)',
      tagPracticeText: '#92400e',
      tagPracticeBg: 'rgba(245, 158, 11, 0.12)',
      tagPracticeBorder: 'rgba(180, 83, 9, 0.28)'
    };
  }

  if (clean === '#dcb372') {
    // 🏺 琥珀金 (中度偏亮金：卡片升級泥金素帛淡金玉底，徹底告別發白割裂感)
    return {
      bgOuterCanvas: '#b88d44', // 醇厚古銅泥金，消除死白割裂感，營造同色相大器景深
      bgCard: '#f2e2ca',
      surfaceCard: '#ecdcbf',
      surfaceModal: '#f2e2ca',
      surfaceModalBorder: 'rgba(112, 68, 15, 0.35)',
      bgCardSubtle: 'rgba(255, 255, 255, 0.60)',
      surfaceCapsule: 'rgba(112, 68, 15, 0.08)',
      borderColor: 'rgba(112, 68, 15, 0.26)',
      borderSubtle: 'rgba(112, 68, 15, 0.12)',
      readerBorder: 'rgba(112, 68, 15, 0.30)',
      accent: '#70440f',
      accentHover: '#563309',
      accentLight: 'rgba(112, 68, 15, 0.12)',
      accentBorder: 'rgba(112, 68, 15, 0.28)',
      accentContrast: '#ffffff',
      textPrimary: '#261706',
      textSecondary: '#4a3319',
      textMuted: '#755836',
      btnDeleteBg: '#fee2e2',
      btnDeleteBorder: 'rgba(239, 68, 68, 0.35)',
      btnDeleteText: '#dc2626',
      tagListenText: '#14532d',
      tagListenBg: 'rgba(34, 197, 94, 0.14)',
      tagListenBorder: 'rgba(20, 83, 45, 0.30)',
      tagThinkText: '#173f5f',
      tagThinkBg: 'rgba(23, 63, 95, 0.12)',
      tagThinkBorder: 'rgba(23, 63, 95, 0.30)',
      tagPracticeText: '#78350f',
      tagPracticeBg: 'rgba(245, 158, 11, 0.15)',
      tagPracticeBorder: 'rgba(120, 53, 15, 0.35)'
    };
  }

  if (clean === '#8caec4') {
    // 🌌 天青藍 (中度澄澈藍：卡片升級天青淡琉璃玉底，消除白紙感，與色塊完美層次呼應)
    return {
      bgOuterCanvas: '#678b9e', // 暮色澄澈天青，營造清涼高遠之大螢幕殿堂畫布
      bgCard: '#d5e5f0',
      surfaceCard: '#cbe0ed',
      surfaceModal: '#d5e5f0',
      surfaceModalBorder: 'rgba(30, 75, 110, 0.35)',
      bgCardSubtle: 'rgba(255, 255, 255, 0.60)',
      surfaceCapsule: 'rgba(30, 75, 110, 0.08)',
      borderColor: 'rgba(30, 75, 110, 0.24)',
      borderSubtle: 'rgba(30, 75, 110, 0.12)',
      readerBorder: 'rgba(30, 75, 110, 0.28)',
      accent: '#1e4b6e',
      accentHover: '#143650',
      accentLight: 'rgba(30, 75, 110, 0.12)',
      accentBorder: 'rgba(30, 75, 110, 0.28)',
      accentContrast: '#ffffff',
      textPrimary: '#0e2433',
      textSecondary: '#284457',
      textMuted: '#4a677c',
      btnDeleteBg: '#fee2e2',
      btnDeleteBorder: 'rgba(239, 68, 68, 0.35)',
      btnDeleteText: '#dc2626',
      tagListenText: '#166534',
      tagListenBg: 'rgba(34, 197, 94, 0.14)',
      tagListenBorder: 'rgba(22, 101, 52, 0.30)',
      tagThinkText: '#133e5c',
      tagThinkBg: 'rgba(19, 62, 92, 0.12)',
      tagThinkBorder: 'rgba(19, 62, 92, 0.30)',
      tagPracticeText: '#92400e',
      tagPracticeBg: 'rgba(245, 158, 11, 0.15)',
      tagPracticeBorder: 'rgba(180, 83, 9, 0.35)'
    };
  }

  if (clean === '#8c3835') {
    // 📿 硃砂赤 (甘珠爾藏紅 · 泥金佛光：告別突兀綠色，採用尊榮金光與高對比朱砂深底)
    return {
      bgOuterCanvas: '#2e1110', // 幽玄朱黑，如甘珠爾護法重門，沉著莊嚴
      bgCard: 'rgba(255, 255, 255, 0.11)',
      surfaceCard: 'rgba(255, 255, 255, 0.14)',
      surfaceModal: '#2a1211',
      surfaceModalBorder: 'rgba(245, 158, 11, 0.30)',
      bgCardSubtle: 'rgba(0, 0, 0, 0.20)',
      surfaceCapsule: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.18)',
      borderSubtle: 'rgba(255, 255, 255, 0.10)',
      readerBorder: 'rgba(245, 158, 11, 0.35)',
      accent: '#f59e0b',
      accentHover: '#d97706',
      accentLight: 'rgba(245, 158, 11, 0.15)',
      accentBorder: 'rgba(245, 158, 11, 0.40)',
      accentContrast: '#18181b', // 泥金配深黑字
      textPrimary: '#fef2f2',
      textSecondary: '#fecaca',
      textMuted: '#f87171',
      btnDeleteBg: 'rgba(239, 68, 68, 0.18)',
      btnDeleteBorder: 'rgba(239, 68, 68, 0.40)',
      btnDeleteText: '#fca5a5',
      tagListenText: '#4ade80',              // 翡翠明玉光 (解決硃砂赤中時間看不清)
      tagListenBg: 'rgba(74, 222, 128, 0.18)',
      tagListenBorder: 'rgba(74, 222, 128, 0.40)',
      tagThinkText: '#38bdf8',               // 琉璃天青光 (解決深底經號看不清)
      tagThinkBg: 'rgba(56, 189, 248, 0.18)',
      tagThinkBorder: 'rgba(56, 189, 248, 0.40)',
      tagPracticeText: '#fbbf24',            // 璀璨泥金光 (解決+修圓圈看不清)
      tagPracticeBg: 'rgba(251, 191, 36, 0.20)',
      tagPracticeBorder: 'rgba(251, 191, 36, 0.45)'
    };
  }

  if (clean === '#234a3b') {
    // 🌲 青松黛 (深沉古剎綠 · 蒼翠玉光)
    return {
      bgOuterCanvas: '#0c1d16', // 幽玄松黛墨綠，古剎幽謐夜色，托出蒼翠主頁
      bgCard: 'rgba(255, 255, 255, 0.09)',
      surfaceCard: 'rgba(255, 255, 255, 0.13)',
      surfaceModal: '#12241d',
      surfaceModalBorder: 'rgba(45, 212, 191, 0.30)',
      bgCardSubtle: 'rgba(0, 0, 0, 0.22)',
      surfaceCapsule: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.16)',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      readerBorder: 'rgba(45, 212, 191, 0.35)',
      accent: '#2dd4bf',
      accentHover: '#14b8a6',
      accentLight: 'rgba(45, 212, 191, 0.15)',
      accentBorder: 'rgba(45, 212, 191, 0.40)',
      accentContrast: '#0f291e', // 玉光配深黛字
      textPrimary: '#f0fdf4',
      textSecondary: '#bbf7d0',
      textMuted: '#86efac',
      btnDeleteBg: 'rgba(239, 68, 68, 0.18)',
      btnDeleteBorder: 'rgba(239, 68, 68, 0.40)',
      btnDeleteText: '#fca5a5',
      tagListenText: '#4ade80',
      tagListenBg: 'rgba(74, 222, 128, 0.18)',
      tagListenBorder: 'rgba(74, 222, 128, 0.40)',
      tagThinkText: '#38bdf8',               // 琉璃天青光 (解決青松黛中 Y0040看不清)
      tagThinkBg: 'rgba(56, 189, 248, 0.18)',
      tagThinkBorder: 'rgba(56, 189, 248, 0.40)',
      tagPracticeText: '#fbbf24',
      tagPracticeBg: 'rgba(251, 191, 36, 0.20)',
      tagPracticeBorder: 'rgba(251, 191, 36, 0.45)'
    };
  }

  if (clean === '#221426') {
    // 🟣 紫紺木 (極深紫檀 · 紫紺金字泥金佛光)
    return {
      bgOuterCanvas: '#120a14', // 幽玄紫檀黑，深邃靜穆，如大雄寶殿佛龕
      bgCard: 'rgba(255, 255, 255, 0.08)',
      surfaceCard: 'rgba(255, 255, 255, 0.12)',
      surfaceModal: '#1a0e1c',
      surfaceModalBorder: 'rgba(243, 201, 105, 0.35)',
      bgCardSubtle: 'rgba(0, 0, 0, 0.25)',
      surfaceCapsule: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.16)',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      readerBorder: 'rgba(243, 201, 105, 0.38)',
      accent: '#f3c969',
      accentHover: '#deb14e',
      accentLight: 'rgba(243, 201, 105, 0.15)',
      accentBorder: 'rgba(243, 201, 105, 0.40)',
      accentContrast: '#1b0f1e', // 泥金配紫黑字
      textPrimary: '#faf5ff',
      textSecondary: '#e9d5ff',
      textMuted: '#c084fc',
      btnDeleteBg: 'rgba(239, 68, 68, 0.18)',
      btnDeleteBorder: 'rgba(239, 68, 68, 0.40)',
      btnDeleteText: '#fca5a5',
      tagListenText: '#4ade80',
      tagListenBg: 'rgba(74, 222, 128, 0.18)',
      tagListenBorder: 'rgba(74, 222, 128, 0.40)',
      tagThinkText: '#38bdf8',               // 琉璃天青光 (解決紫紺木中 Y0040看不清)
      tagThinkBg: 'rgba(56, 189, 248, 0.18)',
      tagThinkBorder: 'rgba(56, 189, 248, 0.40)',
      tagPracticeText: '#fbbf24',
      tagPracticeBg: 'rgba(251, 191, 36, 0.20)',
      tagPracticeBorder: 'rgba(251, 191, 36, 0.45)'
    };
  }

  // 2. 自由取色器與任意顏色：依 WCAG 2.1 相對亮度進行「明度三態分級」精算
  const { r, g, b } = hexToRgb(clean);
  const { h, s, l } = rgbToHsl(r, g, b);
  const luminance = getRelativeLuminance(clean);

  // 【第一態：深沉古剎態 (Luminance < 0.25)】
  if (luminance < 0.25) {
    const goldAccent = '#f59e0b';
    const darkCanvas = hslToHex(h, Math.min(s, 0.40), Math.max(0.04, l * 0.42));
    return {
      bgOuterCanvas: darkCanvas,
      bgCard: 'rgba(255, 255, 255, 0.09)',
      surfaceCard: 'rgba(255, 255, 255, 0.13)',
      surfaceModal: hslToHex(h, Math.max(0.18, s * 0.7), 0.11),
      surfaceModalBorder: 'rgba(255, 255, 255, 0.18)',
      bgCardSubtle: 'rgba(0, 0, 0, 0.22)',
      surfaceCapsule: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.16)',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      readerBorder: 'rgba(255, 255, 255, 0.14)',
      accent: goldAccent,
      accentHover: '#d97706',
      accentLight: 'rgba(245, 158, 11, 0.15)',
      accentBorder: 'rgba(245, 158, 11, 0.40)',
      accentContrast: '#18181b',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      btnDeleteBg: 'rgba(239, 68, 68, 0.18)',
      btnDeleteBorder: 'rgba(239, 68, 68, 0.40)',
      btnDeleteText: '#fca5a5',
      tagListenText: '#4ade80',
      tagListenBg: 'rgba(74, 222, 128, 0.18)',
      tagListenBorder: 'rgba(74, 222, 128, 0.40)',
      tagThinkText: '#38bdf8',
      tagThinkBg: 'rgba(56, 189, 248, 0.18)',
      tagThinkBorder: 'rgba(56, 189, 248, 0.40)',
      tagPracticeText: '#fbbf24',
      tagPracticeBg: 'rgba(251, 191, 36, 0.20)',
      tagPracticeBorder: 'rgba(251, 191, 36, 0.45)'
    };
  }

  // 【第二態：中度莊嚴態 (0.25 <= Luminance < 0.60)】
  if (luminance < 0.60) {
    const deepAccent = hslToHex(h, Math.min(0.85, s * 1.3), 0.27);
    const deepHover = hslToHex(h, Math.min(0.85, s * 1.3), 0.20);
    // 中度底色：卡片吸收主題色相，明度鎖定在 88.5%，形成溫潤同相淡玉底，絕不發白
    const harmonizedCard = hslToHex(h, Math.min(0.40, Math.max(0.16, s * 0.55)), 0.885);
    const harmonizedCardSubtle = 'rgba(255, 255, 255, 0.60)';
    const midCanvas = hslToHex(h, Math.min(s, 0.50), Math.max(0.18, l * 0.75));

    return {
      bgOuterCanvas: midCanvas,
      bgCard: harmonizedCard,
      surfaceCard: hslToHex(h, Math.min(0.40, Math.max(0.18, s * 0.60)), 0.86),
      surfaceModal: harmonizedCard,
      surfaceModalBorder: hslToHex(h, s * 0.5, 0.70),
      bgCardSubtle: harmonizedCardSubtle,
      surfaceCapsule: hslToHex(h, s * 0.2, 0.90),
      borderColor: hslToHex(h, s * 0.4, 0.75),
      borderSubtle: 'rgba(0, 0, 0, 0.10)',
      readerBorder: hslToHex(h, s * 0.4, 0.72),
      accent: deepAccent,
      accentHover: deepHover,
      accentLight: hslToHex(h, s * 0.35, 0.90),
      accentBorder: hslToHex(h, s * 0.5, 0.72),
      accentContrast: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#374151',
      textMuted: '#6b7280',
      btnDeleteBg: '#fee2e2',
      btnDeleteBorder: 'rgba(239, 68, 68, 0.35)',
      btnDeleteText: '#dc2626',
      tagListenText: '#15803d',
      tagListenBg: 'rgba(34, 197, 94, 0.12)',
      tagListenBorder: 'rgba(21, 128, 61, 0.25)',
      tagThinkText: '#1e4b6e',
      tagThinkBg: 'rgba(30, 75, 110, 0.10)',
      tagThinkBorder: 'rgba(30, 75, 110, 0.25)',
      tagPracticeText: '#b45309',
      tagPracticeBg: 'rgba(245, 158, 11, 0.14)',
      tagPracticeBorder: 'rgba(180, 83, 9, 0.30)'
    };
  }

  // 【第三態：極淺雅緻態 (Luminance >= 0.60)】
  const warmJade = hslToHex(h, Math.max(0.05, s * 0.30), 0.975);
  const deepAccent = hslToHex(h, Math.min(0.85, Math.max(0.45, s * 1.4)), 0.26);
  const deepHover = hslToHex(h, Math.min(0.85, Math.max(0.45, s * 1.4)), 0.20);
  const lightCanvas = hslToHex(h, Math.min(s, 0.30), Math.max(0.35, l * 0.88));

  return {
    bgOuterCanvas: lightCanvas,
    bgCard: warmJade,
    surfaceCard: hslToHex(h, Math.max(0.07, s * 0.35), 0.95),
    surfaceModal: warmJade,
    surfaceModalBorder: hslToHex(h, s * 0.4, 0.80),
    bgCardSubtle: hslToHex(h, Math.max(0.08, s * 0.4), 0.93),
    surfaceCapsule: 'rgba(0, 0, 0, 0.04)',
    borderColor: hslToHex(h, Math.max(0.12, s * 0.5), 0.82),
    borderSubtle: 'rgba(0, 0, 0, 0.06)',
    readerBorder: hslToHex(h, Math.max(0.15, s * 0.5), 0.80),
    accent: deepAccent,
    accentHover: deepHover,
    accentLight: hslToHex(h, s * 0.4, 0.92),
    accentBorder: hslToHex(h, s * 0.6, 0.78),
    accentContrast: '#ffffff',
    textPrimary: '#261c14',
    textSecondary: '#4a3b32',
    textMuted: '#6e5d53',
    btnDeleteBg: '#fee2e2',
    btnDeleteBorder: 'rgba(239, 68, 68, 0.35)',
    btnDeleteText: '#dc2626',
    tagListenText: '#15803d',
    tagListenBg: 'rgba(34, 197, 94, 0.10)',
    tagListenBorder: 'rgba(21, 128, 61, 0.25)',
    tagThinkText: '#1e4b6e',
    tagThinkBg: 'rgba(30, 75, 110, 0.08)',
    tagThinkBorder: 'rgba(30, 75, 110, 0.25)',
    tagPracticeText: '#b45309',
    tagPracticeBg: 'rgba(245, 158, 11, 0.12)',
    tagPracticeBorder: 'rgba(180, 83, 9, 0.28)'
  };
}

/**
 * 依據主題背景色，智慧衍生出同色系高和諧度的「深色(相關色)」與「淺色(相關色)」
 */
export function deriveHarmoniousPalette(hex: string): {
  accent: string;       // 相關深色 / 選中強調色
  accentLight: string;  // 相關淺色
  accentBorder: string; // 相關邊框色
} {
  const tokens = calculateSemanticTokens(hex);
  return {
    accent: tokens.accent,
    accentLight: tokens.accentLight,
    accentBorder: tokens.accentBorder
  };
}

/**
 * 全域動態注入自訂色彩至 document.body
 */
export function applyCustomThemeToDOM(hex: string) {
  const body = document.body;
  const isDark = isDarkColor(hex);
  const tokens = calculateSemanticTokens(hex);

  // 清除現有的四大主題 class
  body.className = body.className
    .split(' ')
    .filter(c => !c.startsWith('theme-'))
    .join(' ');

  body.classList.add('theme-custom');
  if (isDark) {
    body.classList.add('theme-custom-dark', 'theme-ebony');
    body.classList.remove('theme-custom-light', 'theme-ivory', 'theme-lotus');
  } else {
    body.classList.add('theme-custom-light', 'theme-ivory');
    body.classList.remove('theme-custom-dark', 'theme-ebony');
    if (tokens.accent === '#783e39') {
      body.classList.add('theme-lotus');
    } else {
      body.classList.remove('theme-lotus');
    }
  }

  // 0. 大螢幕外圍背景畫布 (連動至 html, body 與 CSS 變數，襯托中央手機版型)
  body.style.setProperty('--bg-outer-canvas', tokens.bgOuterCanvas);
  body.style.backgroundColor = tokens.bgOuterCanvas;
  document.documentElement.style.backgroundColor = tokens.bgOuterCanvas;

  // 1. 基底背景
  body.style.setProperty('--reader-bg', hex);
  body.style.setProperty('--bg-library', hex);
  body.style.setProperty('--bg-shelf', hex);

  // 2. 容器層與表面層 (全站卡片、彈窗、次級色塊)
  body.style.setProperty('--bg-card', tokens.bgCard);
  body.style.setProperty('--surface-card', tokens.surfaceCard);
  body.style.setProperty('--surface-modal', tokens.surfaceModal);
  body.style.setProperty('--surface-modal-border', tokens.surfaceModalBorder);
  body.style.setProperty('--bg-card-subtle', tokens.bgCardSubtle);
  body.style.setProperty('--surface-capsule', tokens.surfaceCapsule);
  body.style.setProperty('--border-color', tokens.borderColor);
  body.style.setProperty('--border-subtle', tokens.borderSubtle);
  body.style.setProperty('--reader-border', tokens.readerBorder);

  // 3. 主動強調色與按鈕 (接續閱讀、繼續閱讀、選中標籤)
  body.style.setProperty('--theme-accent', tokens.accent);
  body.style.setProperty('--theme-accent-hover', tokens.accentHover);
  body.style.setProperty('--theme-accent-light', tokens.accentLight);
  body.style.setProperty('--theme-accent-border', tokens.accentBorder);
  body.style.setProperty('--theme-accent-contrast', tokens.accentContrast);
  body.style.setProperty('--color-wood-700', tokens.accent);

  // 4. 文字階梯
  body.style.setProperty('--reader-text', tokens.textPrimary);
  body.style.setProperty('--reader-text-muted', tokens.textMuted);
  body.style.setProperty('--text-primary', tokens.textPrimary);
  body.style.setProperty('--text-main', tokens.textPrimary);
  body.style.setProperty('--text-secondary', tokens.textSecondary);
  body.style.setProperty('--text-muted', tokens.textMuted);

  // 5. 輔助與危險操作
  body.style.setProperty('--btn-delete-bg', tokens.btnDeleteBg);
  body.style.setProperty('--btn-delete-border', tokens.btnDeleteBorder);
  body.style.setProperty('--btn-delete-text', tokens.btnDeleteText);

  // 6. 🌟 聞思修三學語意標籤 (解決深色模式下經號、時間、+修看不清的缺陷)
  body.style.setProperty('--tag-listen-text', tokens.tagListenText);
  body.style.setProperty('--tag-listen-bg', tokens.tagListenBg);
  body.style.setProperty('--tag-listen-border', tokens.tagListenBorder);
  body.style.setProperty('--tag-think-text', tokens.tagThinkText);
  body.style.setProperty('--tag-think-bg', tokens.tagThinkBg);
  body.style.setProperty('--tag-think-border', tokens.tagThinkBorder);
  body.style.setProperty('--tag-practice-text', tokens.tagPracticeText);
  body.style.setProperty('--tag-practice-bg', tokens.tagPracticeBg);
  body.style.setProperty('--tag-practice-border', tokens.tagPracticeBorder);
}

/**
 * 清除自訂主題變數，回歸經典四大主題
 */
export function clearCustomThemeFromDOM() {
  const body = document.body;
  body.classList.remove('theme-custom', 'theme-custom-dark', 'theme-custom-light', 'theme-lotus');
  body.style.removeProperty('--bg-outer-canvas');
  body.style.backgroundColor = '';
  document.documentElement.style.backgroundColor = '';
  body.style.removeProperty('--reader-bg');
  body.style.removeProperty('--bg-library');
  body.style.removeProperty('--bg-shelf');
  body.style.removeProperty('--reader-text');
  body.style.removeProperty('--reader-text-muted');
  body.style.removeProperty('--text-primary');
  body.style.removeProperty('--text-muted');
  body.style.removeProperty('--text-main');
  body.style.removeProperty('--text-secondary');
  body.style.removeProperty('--bg-card');
  body.style.removeProperty('--surface-card');
  body.style.removeProperty('--surface-modal');
  body.style.removeProperty('--surface-modal-border');
  body.style.removeProperty('--bg-card-subtle');
  body.style.removeProperty('--surface-capsule');
  body.style.removeProperty('--border-color');
  body.style.removeProperty('--border-subtle');
  body.style.removeProperty('--reader-border');
  body.style.removeProperty('--theme-accent');
  body.style.removeProperty('--theme-accent-hover');
  body.style.removeProperty('--theme-accent-light');
  body.style.removeProperty('--theme-accent-border');
  body.style.removeProperty('--theme-accent-contrast');
  body.style.removeProperty('--color-wood-700');
  body.style.removeProperty('--btn-delete-bg');
  body.style.removeProperty('--btn-delete-border');
  body.style.removeProperty('--btn-delete-text');
  body.style.removeProperty('--tag-listen-text');
  body.style.removeProperty('--tag-listen-bg');
  body.style.removeProperty('--tag-listen-border');
  body.style.removeProperty('--tag-think-text');
  body.style.removeProperty('--tag-think-bg');
  body.style.removeProperty('--tag-think-border');
  body.style.removeProperty('--tag-practice-text');
  body.style.removeProperty('--tag-practice-bg');
  body.style.removeProperty('--tag-practice-border');
}


