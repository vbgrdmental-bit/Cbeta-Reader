# CBETA Reader - Workspace Customization & Builder Optimization Guide

Welcome! This document outlines the coordination rules, branching strategy, builder versioning, and scripture comparison protocols for this workspace.

---

## 1. Git Branching & Local Testing Workflow

- **Branch**: `dev-builder-optimization` (Active Development)
- **Rules**:
  1. All new features, scripture parsing logic modifications, and bug fixes must be developed and tested locally on the `dev-builder-optimization` branch.
  2. Do not modify or push directly to `main` without thorough local verification.
  3. Ensure `npm run build` compiles successfully before committing or merging.

---

## 2. Builder Versioning System

The builder engine version is tracked using semantic versioning (`MAJOR.MINOR.PATCH`) to communicate changes clearly.

- **Current Version**: `v1.2.0`
- **Location**: Defined in [version.ts](file:///c:/Users/vbgrd/OneDrive/桌面/Cbeta%20Reader/src/builder/version.ts#L1-L2).
- **Metadata Integration**: Packaged books will have the builder's version recorded in their IndexedDB metadata (`BookMetadata.version`), allowing the reader application to identify the version of the builder that imported it.

### Version History / Changelog

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
