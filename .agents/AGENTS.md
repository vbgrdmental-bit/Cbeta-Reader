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

- **Current Version**: `v1.4.0`
- **Location**: Defined in [version.ts](file:///c:/Users/vbgrd/OneDrive/桌面/Cbeta%20Reader/src/builder/version.ts#L1-L2).
- **Metadata Integration**: Packaged books will have the builder's version recorded in their IndexedDB metadata (`BookMetadata.version`), allowing the reader application to identify the version of the builder that imported it.

### Version History / Changelog

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
