// 💡 教育部標準楷書 (MOE EduKai) & 霞鶖文楷 (LXGW WenKai TC) 按需延遲載入器
// 確保預設模式下 0 MB 流量、0 秒極速開啟網頁；僅在切換至標楷體時動態注入下載！

let isEduKaiLoaded = false;

export function loadEduKaiFontOnDemand(): void {
  if (isEduKaiLoaded) return;
  if (typeof document === 'undefined') return;

  // 避免重複注入
  if (document.getElementById('moe-edukai-dynamic-font')) {
    isEduKaiLoaded = true;
    return;
  }

  // 1. 注入 Google Fonts 雲端輕量化 WOFF2 分段標楷體 (專治 iOS / Safari / 手機端 8.7MB 本地字型遭封鎖問題)
  const linkEl = document.createElement('link');
  linkEl.id = 'lxgw-wenkai-tc-font';
  linkEl.rel = 'stylesheet';
  linkEl.href = 'https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@300;400;700&display=swap';
  document.head.appendChild(linkEl);

  // 2. 注入本地/全字庫標準楷書定義
  const styleEl = document.createElement('style');
  styleEl.id = 'moe-edukai-dynamic-font';
  styleEl.textContent = `
    /* 💡 教育部國字標準字體楷書 (edukai-5.1 WOFF2 壓縮檔 8.7MB) */
    @font-face {
      font-family: 'MOE-EduKai';
      src: url('/fonts/edukai-5.1_20251208.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: 'TW-Kai-98';
      src: url('/fonts/edukai-5.1_20251208.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `;

  document.head.appendChild(styleEl);
  isEduKaiLoaded = true;
  console.log('⚡ [FontLoader] 教育部標準楷書 & 雲端標楷體 (LXGW WenKai TC) 按需載入完成！');
}
