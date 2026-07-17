import type { ReferenceMap } from '../types/book';

export class ReferenceBuilder {
  /**
   * 建立指向 CBETA 官方學術資料的連結與引用對照表
   */
  static buildReference(workId: string): ReferenceMap {
    // 例如大正藏 T，乾淨的 4 位數經號（如 T0412 -> 0412）
    const numId = workId.substring(1); 
    const canon = workId.charAt(0); // T, X, etc.

    // CBETA Online 的標準閱讀 URL
    const cbetaOnlineUrl = `https://cbetaonline.dila.edu.tw/${workId}_001`;

    // 官方 PDF 與 EPUB 下載位址格式
    const pdfUrl = `https://github.com/cbeta-git/cbeta-pdf/raw/master/${canon}/${workId}.pdf`;
    const epubUrl = `https://github.com/cbeta-git/cbeta-epub/raw/master/${canon}/${workId}.epub`;

    // 大正藏影像的基礎連結
    // 大正藏原圖基礎路徑通常依據冊號頁碼，例如：images.cbeta.org/...
    const cbetaImageBaseUrl = `https://images.cbeta.org/${canon}/${canon}${numId.substring(0, 2)}`;

    return {
      workId,
      cbetaOnlineUrl,
      pdfUrl,
      epubUrl,
      cbetaImageBaseUrl
    };
  }

  /**
   * 根據段落的 lb (行號) 產生指向大正藏原始影像圖頁的連結
   * 例如：T13p0778a01 -> 轉成大正藏對應頁影像
   */
  static getOriginalImageLink(lb: string): string {
    // 範例輸入: T08n0223_p0221a01 或 T13p0778a01
    // 大正藏影卷圖檔通常對應到冊號與頁數
    // 這裡實作一個安全的跳轉連結，直接前往 CBETA Online 對應行數，裡面自帶大正藏原圖按鈕
    return `https://cbetaonline.dila.edu.tw/stable/${lb}`;
  }
}
