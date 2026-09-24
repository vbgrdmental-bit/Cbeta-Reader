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

/** 尊貴顯密傳承修行佛光色系 (經護眼與最佳對比度調校) */
export const SACRED_THEME_PALETTE: SacredThemeColor[] = [
  { id: 'amber_gold', name: '琥珀金', sub: '增益法門 · 泥金古經', hex: '#dcb372' },
  { id: 'lapis_blue', name: '琉璃紺', sub: '藥師佛光 · 沉靜深藍', hex: '#182433' },
  { id: 'sandalwood_purple', name: '紫紺木', sub: '金剛威德 · 沉香紫檀', hex: '#2b1b28' },
  { id: 'cinnabar_red', name: '硃砂赭', sub: '甘珠爾經 · 尊榮藏紅', hex: '#3d1818' },
  { id: 'lotus_mist', name: '蓮花粉', sub: '觀音水月 · 慈悲柔和', hex: '#ebdcd9' },
  { id: 'jade_pine', name: '青松黛', sub: '翡翠空山 · 清心安神', hex: '#1c2b23' },
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
 * 全域動態注入自訂色彩至 document.body
 */
export function applyCustomThemeToDOM(hex: string) {
  const body = document.body;
  const isDark = isDarkColor(hex);

  // 清除現有的四大主題 class
  body.className = body.className
    .split(' ')
    .filter(c => !c.startsWith('theme-'))
    .join(' ');

  body.classList.add('theme-custom');
  if (isDark) {
    body.classList.add('theme-custom-dark', 'theme-ebony');
  } else {
    body.classList.add('theme-custom-light', 'theme-ivory');
  }

  // 設定 CSS 變數
  body.style.setProperty('--reader-bg', hex);
  body.style.setProperty('--bg-library', hex);
  body.style.setProperty('--bg-shelf', hex);

  if (isDark) {
    body.style.setProperty('--reader-text', '#f0f3f6');
    body.style.setProperty('--reader-text-muted', '#9aa5b1');
    body.style.setProperty('--text-primary', '#f0f3f6');
    body.style.setProperty('--text-muted', '#9aa5b1');
    body.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.08)');
    body.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.16)');
    body.style.setProperty('--reader-border', 'rgba(255, 255, 255, 0.12)');
  } else {
    body.style.setProperty('--reader-text', '#261c14');
    body.style.setProperty('--reader-text-muted', '#68594b');
    body.style.setProperty('--text-primary', '#261c14');
    body.style.setProperty('--text-muted', '#68594b');
    body.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.65)');
    body.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.12)');
    body.style.setProperty('--reader-border', 'rgba(0, 0, 0, 0.10)');
  }
}

/**
 * 清除自訂主題變數，回歸經典四大主題
 */
export function clearCustomThemeFromDOM() {
  const body = document.body;
  body.classList.remove('theme-custom', 'theme-custom-dark', 'theme-custom-light');
  body.style.removeProperty('--reader-bg');
  body.style.removeProperty('--bg-library');
  body.style.removeProperty('--bg-shelf');
  body.style.removeProperty('--reader-text');
  body.style.removeProperty('--reader-text-muted');
  body.style.removeProperty('--text-primary');
  body.style.removeProperty('--text-muted');
  body.style.removeProperty('--bg-card');
  body.style.removeProperty('--border-color');
  body.style.removeProperty('--reader-border');
}
