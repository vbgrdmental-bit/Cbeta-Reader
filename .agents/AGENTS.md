# CBETA Reader - Workspace Customization & Builder Optimization Guide

Welcome! This document outlines the coordination rules, branching strategy, builder versioning, and scripture comparison protocols for this workspace.

---

## 0. Core Doctrine: Zero Text Tampering Policy (絕不篡改、精簡或摘要經文原則)

> [!IMPORTANT]
> **最高核心原則：絕不篡改、精簡、摘要或產生任何假的經文內容！**
> 1. **CBETA 正統經典完整性**：本 App 以「CBETA」為名，核心宗旨為提供讀者 100% 忠實、原汁原味、完全無縮減、無摘要、無篡改的 CBETA 大藏經原文。
> 2. **嚴禁任何精簡/摘要/假文字**：
>    - **絕對禁止** 產生任何「模擬段落」、「經文預設段落」、「精簡示範版」或「摘要版」文字。
>    - **寧可不提供內容**（跳出連線超時提示並引導讀者稍後重試），也**絕對不可**提供任何經簡化、摘錄、不完整或經修改的偽段落。
> 3. **離線套件標準**：所有置於離線快取之經文套件，必須是 100% 來自 CBETA 官方原版且經 Parser 完全解析校對之真跡正文（包含所有卷數、品名、序文與完整段落）。

---

## 1. Git Branching & Local Testing Workflow

- **Rules**:
  1. **App 調整（不涉及 Builder）**：可直接在 `main` 分支上進行修改與部署。
  2. **Scripture 解析與 Builder 調整**：必須在 `dev-builder-optimization` 分支上進行開發與測試，確認編譯與解析完全無誤後，再合併回 `main` 分支。
  3. 不論在哪個分支修改，皆需確保 `npm run build` 編譯成功。

---

## 2. Builder Versioning System

The builder engine version is tracked using semantic versioning (`MAJOR.MINOR.PATCH`) to communicate changes clearly.

- **Current Version**: `v4.1.9` (App: v4.1.9 / Builder: v2.9.10)
- **Stable Checkpoint Tag**: `checkpoint-v4.0.1-cbeta-primary-stable`
- **Location**: Defined in [version.ts](file:///D:/Antigravity%E5%B0%88%E7%94%A8/Cbeta%20Reader/src/builder/version.ts#L1-L2).
- **Metadata Integration**: Packaged books will have the builder's version recorded in their IndexedDB metadata (`BookMetadata.version`), allowing the reader application to identify the version of the builder that imported it.
- **Independent Versioning Rules (獨立版號原則)**：
  - 未來若僅更動 Builder 經文解析引擎：僅提升 `BUILDER_VERSION`，`APP_VERSION` 保持不變。
  - 未來若僅更動 App 介面/閱讀器功能：僅提升 `APP_VERSION`，`BUILDER_VERSION` 保持不變。
  - 只有兩者皆有調整時，才同時變更兩者版號。
- **無縫自動背景修復 (Auto-Migration)**：
  - 當開啟舊有經文時，若其 `BookMetadata.version !== BUILDER_VERSION`，系統會自動在背景以最新 Builder 重新構建 IndexedDB 快取，保留所有讀者劃線與筆記，免去讀者刪除重新下載之不便。
- **乾淨刪除與 CBETA 即時同步**：
  - 刪除經文時同步清空 IndexedDB、localStorage 位置紀錄與 CacheStorage/ServiceWorker 的 HTTP 快取。
  - 向 CBETA 請求新經文時一律帶有 `cache: 'reload'` 與時間戳記，確保必定取得 CBETA 最新校勘版本。
- **對外 App 說明對話框原則 (SettingsView.tsx)**：
  - 對外 UI 的版本更新紀錄一律為**精簡摘要**，每次改版**不超過 3 項**，每項**不超過 50 字**。
  - 說明對話框（點選「？」）採用 **獨立分區（上方 App / 下方 Builder）** 呈現，最新版本直接顯示，其餘歷程依「+ 更多修改歷程」(置左) 收折呈現。
  - **自動累積更新升版原則 (Auto-Batch Versioning Policy)**：當收集了 3 個（含）以上的調整項目，自動整合至對話框內摘要記錄，並自動提升第三位數 Patch 版號（例：`backup App: v1.0.2`、`backup Builder: v1.0.2`）。
  - 內部開發日誌與詳細技術說明維持紀錄於專案內部之 `.agents/AGENTS.md` 文件。

### Version History / Changelog

- **⭐ App: v4.1.9 / Builder: v2.9.10** (2026-08-21)
  - [App] 閱讀頁下方浮動膠囊列升級為 20% 半透明毛玻璃質感（80% 不透明度），經文透光隱約可見。
  - [App] 下方浮動膠囊列高度厚度調整為 56px，與上方控制列高度完全一致。
  - [App] 下方膠囊至手機底部過渡區間新增 50% 毛玻璃模糊漸變效果（Bottom Blur Gradient）。
- **⭐ App: v4.1.8 / Builder: v2.9.10** (2026-08-21)
  - [App] 點選目次章節跳轉時，精確將該品章節標題置於畫面頂端第一行。
  - [Builder] 系統性重構目錄導航精準度，優先匹配經文內真實標題段落與近鄰 lb 探測，精確錨定品名起點，解決科註/論疏經文跳轉落在科文前綴之問題。
- **⭐ App: v4.1.7 / Builder: v2.9.9** (2026-08-21)
  - [App] 經文檢索切換「< / >」或外部檢索跳轉時，精確將目標關鍵字置中偏上（45%）黃金閱讀視角對齊，徹底消除字句落在螢幕外之問題。
  - [App] 閱讀滑動頁面時，動態即時同步檢索 Bar 序號（如 6/13 滑動超過中心線時自動推進至 7/13）。
  - [App] 完善本地經典檢索淺色主題文字對比度，修復「站內已下載書籍檢索」提示文字清晰可讀。
- **⭐ App: v4.1.6 / Builder: v2.9.9** (2026-08-20)
  - [App] 修正子資料夾內經書點選「移出至上一層」時，精確退回上一層資料夾或「我的書櫃」。
- **⭐ App: v4.1.5 / Builder: v2.9.9** (2026-08-20)
  - [App] 經書管理對話框支援動態即時計算與自動補齊字數與預計閱讀時間。
  - [Builder] 完善經文書籍打包引擎，全面自動提取並計算 CJK 漢字與英數總字數。
- **⭐ App: v4.1.4 / Builder: v2.9.8** (2026-08-20)
  - [App] 批量下載經書至指定資料夾完成後，即時同步資料夾與經書歸類，免除手動重新整理。
- **⭐ App: v4.1.3 / Builder: v2.9.8** (2026-08-20)
  - [App] 經典與版權資訊將「譯者」統一調整為「作譯者」，若無標明作譯者則保持為空。
  - [App] 經書管理對話框將「譯者」調整為「作譯者」，若無標明作譯者則保持為空。
  - [Builder] 系統性修正無標明作譯者之經典（如 T1910、T1944 等），作譯者欄位忠實保持為空（`""`），不再預設佔位文字。
- **⭐ App: v4.1.2 / Builder: v2.9.7** (2026-08-19)
  - [App] 閱讀頁下方控制列升級為「4 色背景快捷切換」與「字體大小 A-/A+ 調整器」。
  - [App] 新增「開啟經文時自動回到上次閱讀位置」偏好設定，免去每次進入經文時的詢問彈窗打擾。
- **App: v4.1.1 / Builder: v2.9.7** (2026-08-19)
  - [App] 新增「Cbeta Reader 簡易功能導覽」生動互動演示（支援 5 步驟手勢操作教學與手機左右滑動翻頁）。
  - [App] 閱讀設定「其他設定」新增導覽快捷重播按鈕，方便隨時複習上手。
- **⭐ App: v4.1.0 / Builder: v2.9.7** (2026-08-17) [Major Release 重大更新]
  - [App] 全面升級「依作譯者」查詢，100% 對齊 CBETA 官方 1~29 筆劃、首字分組與 2,000+ 位權威作譯者作品目錄。
  - [App] 經書管理對話框移除「更新經文」，調整為「移至資料夾 | 加入我的最愛 | 刪除經文」等寬三欄配置佐以細間隔線。
  - [App] 目次選單帶有折疊項目者預設一律收合，避免版面過長。
  - [App] 烏木模式適配字體大小與劃重點快選彈窗之深色底色與灰白細框。
  - [Builder] 系統性修復全藏經帶有前綴之 `lb` 行號識別，修正目次小節精確錨定。
- **⭐ App: v4.0.7 / Builder: v2.9.6** (2026-08-17)
  - [App] 「重點與筆記」收合設定，依內文順序排列。
  - [App] 調整閱讀頁面上方控制列的「文字大小」、「畫重點」設定。
- **⭐ App: v4.0.6 / Builder: v2.9.6** (2026-08-16)
  - [App] 目次全面支援跨卷平滑定位，精確導航至章節起點。
  - [App] 完善 CBETA 權威字數計算標準。
  - [Builder] 修正目錄段落標題索引，精準錨定經文起始節點。
  - [Builder] 修正巢狀目錄列表文字重複，保留項目獨立段落。
- **⭐ App: v4.0.5 / Builder: v2.9.5** (2026-08-16)
  - [App] 目次全面支援跨卷平滑定位，精確導航至章節起點。
  - [App] 完善 CBETA 權威字數計算標準（包含中英數詞）。
  - [Builder] 修正巢狀目錄列表文字重複問題，精確保留項目獨立段落。
  - [Builder] 擴充經文段落標籤解析與目錄索引映射。
- **⭐ App: v4.0.4 / Builder: v2.9.4** (2026-08-14)
  - [App] 優化現代經典目錄 (Y系列)，隱藏空白卷頁標籤。
  - [App] 修正目錄樹跨卷定位跳轉，使其能精確導航至起點。
  - [Builder] 修正現代經典 HTML 嵌套目錄列表的分行與文字重複問題。
  - [Builder] 擴充 HTML 段落解析，支援 byline 與 speaker 標籤。
- **⭐ Builder: v2.9.1** (2026-08-11) [Builder Only]
  - 新增 `extractTocTreeFromHtml` 引擎，從 HTML `cb:div` 嵌套結構提取完整多層次目錄樹（最深可達 11 層），解決印順導師講記（Y 系列，如 Y0001 般若經講記）目次顯示扁平無層次的問題。
  - 採用「toc.mulu 頂層骨架 + HTML 子層次補充」雙階策略，確保多卷書目次骨架（全書頂層節點）與深層次細節（各卷內嵌嵌套）同時正確。
- **⭐ backup App: v1.0.3 / Builder: v1.0.3** (2026-08-10) [Backup Mode]
  - 停用備援模式下 `FEATURED_BOOKS` 硬編碼常用經典後備機制，搜尋與目錄 100% 讀取真實離線備援藏經庫。
  - 支援零補償真實校驗，精確揭露離線備援資料庫經文完整性，便於精準驗證每部經典。
- **⭐ v4.0.1** (2026-08-08) [CBETA 官方主源純淨穩定基線 Checkpoint Tag: `checkpoint-v4.0.1-cbeta-primary-stable`]
  - 確保 Vercel 主站 100% 直連 CBETA 官方 API (`cbdata.dila.edu.tw`)，零離線快取無感偷換污染。
  - 修復 `<p class="lg">` 散文段落被誤判為偈頌體導致短句折行排版 Bug，還原完整連貫段落。
  - 抹除 `<cb:docNumber>` 雜質 (如 `No.235N`)，完成 `sourceMode` (`?source=backup`) 獨立雙軌架構。
- **⭐ v4.0.0** (2026-08-06) [App Major Release 重大更新]
  - 新增文章「重點與筆記」功能，支援隨文寫下感悟心得，並可於首頁專屬資料夾集中集中複習、編輯與導航跳轉。
  - 全面導入手勢與點擊雙向「絲滑切換」過渡動態，支援手指向左右滑動與點選平滑推進離場。
  - 重構首頁編排版，固定為四大系統資料夾（我的資料夾、近期閱讀、我的最愛、重點與筆記），使版面更加簡潔直觀。
- **v3.2.0** (2026-08-02) [App Only]
  - 調整首頁版面，新增「近期閱讀」與「我的最愛」系統資料夾，優化資料夾卡片高度、圖示與標題垂直置中排版。
  - 調整書籍與資料夾移動、刪除及命名設定，停用系統資料夾長按編輯，並支援資料夾嵌套移動。
  - 優化閱讀設定初始預設值（預設正黑體、全塗筆刷、開啟校勘與頁碼），升級「清空經典」包含一鍵重置為初始預設值。
- **v3.1.0** (2026-08-01) [App Only]
  - 「畫重點設定」直覺設定。
  - 新增「設定閱讀時間 (護眼模式)」，時間到了溫馨提醒。
  - 主頁更名為「CBETA Reader 淨心小角落．閱讀大藏經」。
- **⭐ v3.0.0** (2026-07-31) [App Major Release 重大更新]
  - 提升 CBETA Reader 藏經庫搜尋功能，導入 CBETA 原有的四大檢索方式「依部類查詢」、「依冊別查詢」、「依作譯者查詢」、「依朝代查詢」等，並加入「常用經典」，更方便讀者搜尋經典。
- **⭐ v2.4.0** (2026-07-31) [Builder Major Release 重大更新]
  - 重構全自動背景無感修復機制 (Auto-Healing Engine)，開啟舊有經文 0 秒瞬開並背景自動向 CBETA 補齊真實完整 HTML 段落正文。
  - 全面導入 6 線程極速防限流下載串流池 (`CONCURRENCY = 6`) 與 3 次自動重試，消除 Cloudflare 429 丟包問題。
  - 導入部類關鍵字智慧自動關聯 (Category Keyword Auto-Mapping)，解決大範圍檢索伺服器斷線難題。
- **v2.3.0** (2026-07-29) [App Only]
  - 閱讀設定新增「| 內文字體」選擇，提供宋/明體、正黑體、芫荽體與芫荽體(粗) 4 種開放字型（例字：永）。
  - 新增「儲存空間與全集壓縮管理」儀表板，支援高動態 Gzip 壓縮引擎，大部頭經典全集（如《大般若經》600卷）節省 80% 本地儲存容量。
  - 新增一鍵「清理 HTTP 網路快取」與即時容量統計，輕鬆維護手機與瀏覽器快取暫存。
- **v2.2.0** (2026-07-28) [App Only]
  - 閱讀設定新增「| 內文字體」選擇，提供宋/明體、正黑體、芫荽體與芫荽體(粗) 4 種開放字型（例字：永）。
  - 內文字體切換僅影響經典正文段落，保持篇章節段與書名標題字體不變。
  - 修復「烏木」模式劃線高對比字體與 iOS Safari 點擊輸入框時觸發自動縮放畫面之跑版問題。
- **v2.1.0** (2026-07-28) [App Only]
  - 支援線上搜尋「整批勾選經典與一鍵批量下載」。
  - 批量下載自動帶出關鍵字作為資料夾名稱，支援讀者自訂修改。
  - 新增「放入已有資料夾」選項，輕鬆收納新下載經書至指定資料夾。
- **v2.3.0** (2026-07-28) [Builder Only]
  - 全面過濾 CBETA 頁尾與腳註備註容器（`<div id="back">` / `<div class="footnotes">` / `[id^="cb_note"]`），防止腳註中的出版資訊與書目備註（如「參見《印順導師著作總目．序》...」）被誤判為正文段落出現在卷末。
- **v2.2.0** (2026-07-28) [Builder Only]
  - 全面修正 CBETA 異體字、組字與缺字標籤（`<a class="gaijiAnchor">` / `<span class="gaiji">`，例如 `[言*(狂-王+主)]`、`[圭*頁]`）被錯判為校勘腳註遭整塊抹除的 bug，還原完整的缺字組字表達。
  - 修正經文中途過度清除 CJK 空格導致印順導師著作（Y系列）與精校版《壇經》中「一　慧能大師」、「二　刺史」等節號與清單項目的全形空格遺失問題。
- **v2.0.0** (2026-07-27) [App Only]
  - 全面配置 PWA 與 iOS「加入主畫面」蓮花經典圖示 (apple-touch-icon 180x180 & 512x512, manifest.json)。
  - 首頁編輯模式新增經書批量勾選與一鍵「批量移動至資料夾」功能。
  - 修正編輯模式控制按鈕面板動態最大寬度，解鎖經文與資料夾標題約 78px 水平空間，多顯示 4-5 字再截斷。
  - 縮短長按判定至 380ms 並加入 10px 微震觸控防誤斷機制；拖曳手把替換為極簡灰色豎條 `|`。
  - 取消資料夾縮排與經書齊平對齊，並新增 6 種典雅東方主題色選單。
- **v2.1.0** (2026-07-26) [Builder Only]
  - 優先讀取 CBETA 規範作譯者名稱（`workInfo.creators` + `workInfo.time_dynasty`，例如 `西晉 竺法護`），取代原始雜項 `byline`（如 `西晉 燉煌三藏譯`），使經典資訊與 CBETA 官方權威名稱完全對齊。
  - 徹底解決部分經典缺少「冊別」欄位（如 `T0325` 缺少 `冊別: T12`）的 bug，升級為優先讀取 API `vol` 欄位與 `file` 開頭標籤，確保 100% 經典皆可精確取得對應冊別。
- **v2.0.0** (2026-07-25) [Builder Only]
  - 支援印順導師著作中的附圖、圖表與解說段落標籤（`<div class="div-figure">`, `<div class="figure">`, `<figure>`）。
  - 解決如 `Y0003 勝鬘經講記` 「關於一乘」圖表附圖段落因欠缺段落容器識別而被錯判為孤立 `<span>` 導致多行碎裂單字斷行的 bug。
- **v1.9.0** (2026-07-25)
  - 全面修正 CBETA 清單與列表標籤（`<ul>`, `<ol>`, `<li>`, `<item>`）的段落分割算法，防止項目內部的文字、小註與單字 `<span>` 被拆散為孤立行。
  - 徹底解決 CBETA 紙本版面折行與 `<span class="line_space">` 遺留在段落中途導致漢字、詞彙與標點符號之間出現惱人空格的問題（如 `CC0006`「近代流通」、`Y0001`「當經」、「展轉」、「真實」、「如是」等）。
  - 完美還原如 `CC0006 佛說大乘無量壽莊嚴清淨平等覺經` 等含目次條目與五種原譯清單的經典排版，自動補齊縮排與 bullet 標籤 (`• `)。
- **v1.8.0** (2026-07-25)
  - 縮減偈頌體（韻文）段落上下間距與行高，提升長篇詩歌經文的閱讀緊湊感。
  - 閱讀器「經典與版權資訊」新增「冊別」與「字數」欄位，排序為：經名 → 譯者 → 經號 → 部類 → 冊別 → 字數。
  - 大藏經經號依 A~Z 26 個字母開頭自動分配 26 套典雅經典封面色系。
  - 優化手機版首頁編輯模式（Edit Mode）版面，限制標題單行省略 (`...`) 並固定單行卡片高度，刪除按鈕改為 `X` 置右，隱藏數值標籤防跑版。
- **v1.7.0** (2026-07-24)
  - 新增完整與輕量資料備份與還原功能（`.json` 匯出匯入，包含劃線重點、離線經文與個人偏好設定）。
  - 修復 `T0412 地藏菩薩本願經` 卷數對齊（由 3 卷修正為官方標準 2 卷：卷上、卷下）。
  - 全面升級 `NavigationBuilder` 的跨卷 `lb` 定位與雙向導航防錯機制，解決目次末段項目無法點選跳轉之問題。
- **v1.6.0** (2026-07-23)
  - 強化原始經文「圓體粗體」跨平台（Windows/Mac/iOS/Android）字體 fallback 與 `font-weight: 800` 強制高對比排版。
  - 隱藏閱讀器底部工具列的百分比進度文字（`的閱讀進度 (12%)`），僅保留目前品名標題。
  - 修正目次 Tree 算法，完整保留如 `T0262` 等經典中的 `+ 附文`（`御製觀世音普門品經序`）資料夾樹狀結構。
- **v1.5.0** (2026-07-23)
  - 精確解析論典/講記中的原始經文引用（`div-orig`, `p.bold`）並標註 `isOrig`。
  - 閱讀器採用「圓體粗體」樣式渲染原始經文引文，使原始經文與解說正文形成清晰視覺對比。
- **v1.4.0** (2026-07-23)
  - 全面升級目次（TOC）樹狀多層級解析算法（支持無限制深度與 `children` 樹狀節點）。
  - 閱讀器側邊欄目錄升級為可展開/折疊（`+`/`-`）的多層級樹狀選單，完美還原 CBETA 官方原版多級章節結構。
- **v1.3.0** (2026-07-21)
  - 優化印順導師現代著述（Y系列）的目次結構，將目錄層級限制為最多兩層，並將深層標題拼接為雙層格式。
  - 對於現代無「卷」圖書（Y系列），隱藏目次與閱讀器介面右側的「卷 X」標籤，自適應替換為「部分 X」。
  - 系統性修復列表（LI）與層級縮排（line_space）在 HTML 解析時丟失縮排及文字重複的 bug，轉換為全形空格完美還原縮排。
  - 將偈頌體（韻文）段落由置中對齊（center）變更為置左對齊並左縮排 2 字符，解決手機窄屏換行閱讀凌亂的問題。
- **v1.2.0** (2026-07-21)
  - Established builder versioning system (`src/builder/version.ts`).
  - Switched repository to active development branch `dev-builder-optimization`.
  - Created `.agents/AGENTS.md` workspace rules and registry guide.
- **v1.1.0** (2026-07-20)
  - Retained online search CBETA dialog active after clicking download.
  - Unified all header and top control bar heights (including `.dialog-header`) to a consistent `56px` base height.
- **v1.0.0** (Initial Release)
  - Core book building logic for XML text parsing, indexing, navigation, and reference indexing.

---

## 3. Scripture Comparison & Correction Protocol

When comparing imported book segments with original CBETA documents to fix errors:

### Rule A: Prefer Universal Logic (全域規則)
- If a formatting error, footnote mismatch, or navigation discrepancy is found, **always try to modify the builder engine (`src/builder/*`)** in a way that handles the case systematically, thereby correcting all other scriptures sharing similar structures.

### Rule B: Exception Handling (個案例外)
- If a bug is a unique case specific to a single book and cannot be resolved systemically:
  1. Add a conditional check in the relevant builder script with a detailed comment explaining the exception (e.g., `// Special handling for T0235 due to unique XML tag nesting...`).
  2. Catalog the exception in this document under the **Individual Book Exceptions (個案清單)** registry below.

---

## 4. Registry of Individual Book Exceptions (個案清單)

*(Currently, there are no individual book exceptions registered. All builder logic is 100% systemic.)*

| Book ID | Book Title | Description of Exception | Code Location | Builder Version | Date |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

---

## 5. Reading Timer & Sleep Lock System Specifications (設定閱讀時間與防睡眠鎖系統規範)

- **核心檔案位置**：
  - 管理器邏輯：[src/utils/readingTimer.ts](file:///D:/Antigravity%E5%B0%88%E7%94%A8/Cbeta%20Reader/src/utils/readingTimer.ts)
  - UI 選項按鈕：[src/reader/components/SettingsView.tsx](file:///D:/Antigravity%E5%B0%88%E7%94%A8/Cbeta%20Reader/src/reader/components/SettingsView.tsx)
  - 閱讀頁底部控制列顯示：[src/reader/components/ReaderView.tsx](file:///D:/Antigravity%E5%B0%88%E7%94%A8/Cbeta%20Reader/src/reader/components/ReaderView.tsx)
  - 全域提醒彈窗與純黑屏休眠：[src/App.tsx](file:///D:/Antigravity%E5%B0%88%E7%94%A8/Cbeta%20Reader/src/App.tsx)

- **功能架構與核心規則**：
  1. **防睡眠鎖 (Screen Wake Lock API)**：
     - 當點擊 `15分 / 30分 / 45分 / 60分` 啟動計時器時，系統自動請求 `navigator.wakeLock.request('screen')`，閱讀期間保持螢幕恆亮不自動熄屏。
  2. **全域與跨頁連貫性**：
     - 計時器為全域單例 (`readingTimer`)，狀態同步儲存至 `localStorage`，切換書籍、搜尋或重新整理皆保持連貫倒數。
     - 閱讀器下方工具列正中間即時顯示分秒倒數（例：`⏱ 14:59`），點擊可開啟時間設定。
  3. **第一對話框（T-1 分鐘 / 60 秒溫馨提醒）**：
     - 剩餘 60 秒時跳出對話框：*「您的閱讀時間即將到達，要適當休息一下，身體動一動，眼睛眨一眨…」*。
     - **若按下「時間到就休息」**：標記 `restOnTimeChoice = true` 並關閉第一對話框。當 `00:00` 到達時，**直接進入全黑屏休眠/釋放 WakeLock，絕不跳出第二對話框打擾！**
     - **若按下「繼續閱讀 +X分」**：重置為延長後的分鐘數並重新倒數，關閉對話框，不跳出第二對話框。
     - **若 30 秒無視無動作**：對話框在 30 秒後自動淡出隱藏 (`warningAutoDismissed = true`)，避免阻擋閱讀正文。
  4. **第二對話框（T-0 時間到 / 黑幕休息）**：
     - **僅在第一對話框未點擊（無視或無回應）且時間歸零時跳出**。
     - 顯示：*「時間到了，請適當休息。您已完成預定的閱讀時間。請放鬆雙眼，活動身心，常保健康。」*
     - 提供「關閉並休息」與「繼續閱讀 (+15分 | +30分 | +45分 | +60分)」選項。
     - **若 30 秒無視無動作**：對話框自動隱藏，畫面上保持 OLED 全純黑屏休眠。
     - **若出現後 1 分鐘（T+1 min）無動作**：自動呼叫 `releaseWakeLock()` 釋放防睡眠鎖，交由作業系統/手機原生省電機制關閉螢幕。
  5. **純黑屏休眠 (OLED Blackout Overlay)**：
     - 時間到進入黑幕休眠時，畫面呈現全純黑 (`#000000`) 樣式，點擊畫面任意處即可隨時恢復閱讀狀態。

---

## 6. High-Availability Scripture Source & Failover Notification Policy (經文備用源與切換通知規範)

- **雙軌架構原則**：
  1. **主線（Primary Source）**：以 CBETA 官方 API (`cbdata.dila.edu.tw`) 為第一優先經文下載來源，確保取得 100% CBETA 最新校勘版本。
  2. **備援（Secondary Backup Source）**：以 GitHub Releases / GitHub CDN / Cloudflare R2 自建預編譯鏡像為第二備用來源。當官方 API 超時、斷線或遭遇 429 限流時，自動無感切換至備援鏡像。
- **讀者知情與透明通知規範 (Notification Policy)**：
  - 當觸發備援機制切換至離線備用鏡像源時，系統**必須主動向讀者顯示溫馨提示 Toast 或標籤**：
    > *「💡 CBETA 官方伺服器連線繁忙，已自動切換至離線版本（經文內容版本為 CBReader 2X v0.9.9 2026-01-21）。」*
  - 確保讀者充分知情資料來源與版本狀態，兼顧高可用性下載體驗與資訊透明度。

---

## 7. Four Color Themes Adaptability Doctrine (四大配色主題全域適配原則)

> [!IMPORTANT]
> **四大配色主題全域適配原則 (Four Themes UI/UX Protocol)**：
> 未來在修改或新增 App 任何功能、版面介面、按鈕、圖示、彈窗、選單、背景、色塊或劃線重點時，**一律必須同步考量並完整適配本 App 的四大配色模式**：
> 1. **象牙白 (Ivory / Default)**：經典米白紙質底色 (`#fefcf8` / `--bg-paper-ivory`)，深褐色文字 (`#2c2016`) 與木質金褐色邊框/按鈕。
> 2. **羊皮紙 (Parchment)**：古雅暖黃牛皮紙底色 (`#f5eee0` / `--bg-paper-parchment`)，暖棕色文字 (`#3c2a1a`) 與羊皮金邊框。
> 3. **舒服護眼 (Comfort)**：柔和淡青草木綠底色 (`#ecf3e2` / `--bg-paper-comfort`)，深黛綠文字 (`#23351d`) 與淡青草綠邊框。
> 4. **烏木暗色 (Ebony)**：深沉純黑/黑藍夜間底色 (`#12161a` / `--bg-paper-ebony`)，柔和灰白文字 (`#d8dec9` / `#e0dcd3`)，彈窗/色塊/輸入框/卡片一律採用**深色底色 (`#181d22` 或半透明深黑) 佐以灰白色細框 (`1px solid rgba(255, 255, 255, 0.18~0.25)`)**。
>
> **開發守則**：
> - **嚴禁在 UI 元件中寫死單一白底 (`#ffffff`) 或黑字 (`#000000`)**，必須使用 CSS 變數（如 `var(--card-bg)`, `var(--text-primary)`, `var(--border-color)`）或在對應 CSS 檔案中編寫 `.theme-ebony` / `body.theme-ebony` 覆寫規則。
> - 任何新 UI 元素（按鈕、選單、Popover、Dialog、Tooltip、SVG 圖標等）於開發完成後，皆需逐一確認在四種模式下的文字對比度、背景融合度與邊框辨識度。



