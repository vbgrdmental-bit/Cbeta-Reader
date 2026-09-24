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
export function deriveHarmoniousPalette(hex: string): {
  accent: string;       // 相關深色 / 選中強調色
  accentLight: string;  // 相關淺色
  accentBorder: string; // 相關邊框色
} {
  const clean = hex.toLowerCase().trim();

  // 1. 若為 6 款佛光修行色，優先使用權威設計師精準同色系調配
  if (clean === '#ebdcd9') {
    // 蓮花粉 -> 沉香絳粉深色
    return { accent: '#783e39', accentLight: 'rgba(120, 62, 57, 0.10)', accentBorder: 'rgba(120, 62, 57, 0.22)' };
  }
  if (clean === '#dcb372') {
    // 琥珀金 -> 焦糖金棕深色
    return { accent: '#70440f', accentLight: 'rgba(112, 68, 15, 0.10)', accentBorder: 'rgba(112, 68, 15, 0.25)' };
  }
  if (clean === '#8caec4') {
    // 天青藍 -> 深海天青藍
    return { accent: '#1e4b6e', accentLight: 'rgba(30, 75, 110, 0.10)', accentBorder: 'rgba(30, 75, 110, 0.25)' };
  }
  if (clean === '#8c3835') {
    // 硃砂赤 -> 明麗硃砂金光
    return { accent: '#f59e0b', accentLight: 'rgba(255, 255, 255, 0.12)', accentBorder: 'rgba(245, 158, 11, 0.35)' };
  }
  if (clean === '#234a3b') {
    // 青松黛 -> 蒼翠明玉光
    return { accent: '#2dd4bf', accentLight: 'rgba(255, 255, 255, 0.12)', accentBorder: 'rgba(45, 212, 191, 0.35)' };
  }
  if (clean === '#221426') {
    // 紫紺木 -> 經典「紫紺金字」泥金佛光 (在極深紫黑紙上無比清晰莊嚴)
    return { accent: '#f3c969', accentLight: 'rgba(243, 201, 105, 0.14)', accentBorder: 'rgba(243, 201, 105, 0.38)' };
  }

  // 2. 自由取色器之任意顏色：使用 HSL 色相感知公式同色相衍生
  const { r, g, b } = hexToRgb(clean);
  const { h, s } = rgbToHsl(r, g, b);
  const isDark = isDarkColor(clean);

  if (!isDark) {
    // 淺色底：衍生同色相之高飽和度深色
    const sat = Math.min(0.85, Math.max(0.48, s * 1.25));
    const accentHex = hslToHex(h, sat, 0.27);
    const { r: ar, g: ag, b: ab } = hexToRgb(accentHex);
    return {
      accent: accentHex,
      accentLight: `rgba(${ar}, ${ag}, ${ab}, 0.10)`,
      accentBorder: `rgba(${ar}, ${ag}, ${ab}, 0.25)`
    };
  } else {
    // 深色底：衍生高明度金光或亮色，在深底上必須有足夠對比度
    const accentHex = hslToHex(h, Math.min(0.85, Math.max(0.55, s * 1.2)), 0.68);
    return {
      accent: accentHex,
      accentLight: 'rgba(255, 255, 255, 0.14)',
      accentBorder: 'rgba(255, 255, 255, 0.25)'
    };
  }
}

/**
 * 全域動態注入自訂色彩至 document.body
 */
export function applyCustomThemeToDOM(hex: string) {
  const body = document.body;
  const isDark = isDarkColor(hex);
  const palette = deriveHarmoniousPalette(hex);

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

  // 設定 CSS 變數：背景與文字
  body.style.setProperty('--reader-bg', hex);
  body.style.setProperty('--bg-library', hex);
  body.style.setProperty('--bg-shelf', hex);

  // 💡 同色系按鍵與選中色系注入 (使全站按鍵與背景一氣呵成，絕不突兀混雜)
  body.style.setProperty('--theme-accent', palette.accent);
  body.style.setProperty('--theme-accent-light', palette.accentLight);
  body.style.setProperty('--theme-accent-border', palette.accentBorder);
  body.style.setProperty('--color-wood-700', palette.accent);
  
  // 💡 按鍵背景的高對比文字顏色 (當 accent 為深色時用白字，accent 為亮色如泥金時用深黑字)
  const isAccentDark = isDarkColor(palette.accent);
  body.style.setProperty('--theme-accent-contrast', isAccentDark ? '#ffffff' : '#18181b');

  if (isDark) {
    body.style.setProperty('--reader-text', '#f8fafc');
    body.style.setProperty('--reader-text-muted', '#cbd5e1');
    body.style.setProperty('--text-primary', '#f8fafc');
    body.style.setProperty('--text-main', '#f8fafc'); // 徹底解決深色模式下開關標題變黑問題！
    body.style.setProperty('--text-muted', '#cbd5e1');
    body.style.setProperty('--text-secondary', '#e2e8f0');
    body.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.08)');
    body.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.16)');
    body.style.setProperty('--reader-border', 'rgba(255, 255, 255, 0.12)');
  } else {
    body.style.setProperty('--reader-text', '#261c14');
    body.style.setProperty('--reader-text-muted', '#68594b');
    body.style.setProperty('--text-primary', '#261c14');
    body.style.setProperty('--text-main', '#261c14');
    body.style.setProperty('--text-muted', '#68594b');
    body.style.setProperty('--text-secondary', '#444444');
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
  body.style.removeProperty('--theme-accent');
  body.style.removeProperty('--theme-accent-light');
  body.style.removeProperty('--theme-accent-border');
  body.style.removeProperty('--color-wood-700');
}
