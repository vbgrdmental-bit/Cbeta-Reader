# CBETA Reader - Workspace Customization & Builder Optimization Guide

Welcome! This document outlines the coordination rules, branching strategy, builder versioning, and scripture comparison protocols for this workspace.

---

## 1. Git Branching & Local Testing Workflow

- **Rules**:
  1. **App 調整（不涉及 Builder）**：可直接在 `main` 分支上進行修改與部署。
  2. **Scripture 解析與 Builder 調整**：必須在 `dev-builder-optimization` 分支上進行開發與測試，確認編譯與解析完全無誤後，再合併回 `main` 分支。
  3. 不論在哪個分支修改，皆需確保 `npm run build` 編譯成功。

---

## 2. Builder Versioning System

The builder engine version is tracked using semantic versioning (`MAJOR.MINOR.PATCH`) to communicate changes clearly.

- **Current Version**: `v2.0.0` (App: v2.0.0 / Builder: v2.0.0)
- **Location**: Defined in [version.ts](file:///c:/Users/vbgrd/OneDrive/桌面/Cbeta%20Reader/src/builder/version.ts#L1-L2).
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
  - 內部開發日誌與詳細技術說明維持紀錄於專案內部之 `.agents/AGENTS.md` 文件。

### Version History / Changelog

- **v2.0.0** (2026-07-25)
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
>>>>>>> dev-builder-optimization
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
