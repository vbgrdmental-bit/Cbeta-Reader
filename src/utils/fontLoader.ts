// 💡 教育部標準楷書 (MOE EduKai / TW-Kai / DFKai-SB) 按需延遲載入器 (Lazy-Loader)
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

  const styleEl = document.createElement('style');
  styleEl.id = 'moe-edukai-dynamic-font';
  styleEl.textContent = `
    /* 💡 教育部國字標準字體楷書 (edukai-5.1_20251208.woff2 官方標準檔) */
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
  console.log('⚡ [FontLoader] 教育部標準楷書 (MOE-EduKai) 按需載入完成！');
}
