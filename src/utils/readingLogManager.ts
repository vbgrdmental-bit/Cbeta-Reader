// 💡 每日閱讀日誌管理器 (Reading Log Manager)
// 功能：自動追蹤每次開啟/離開經文的時間，≥1 分鐘才寫入記錄
// 注意：獨立於護眼計時器 (readingTimer.ts)，兩者無耦合

import { saveReadingLog } from './db';
import type { ReadingLogEntry } from './db';

const PENDING_KEY = 'cbeta_reading_log_pending'; // localStorage 暫存 key

/** localStorage 暫存的進行中 session */
interface PendingSession {
  workId: string;
  title: string;
  startTime: number;     // 最近一次進入前台的 timestamp (ms)
  accumulated: number;   // 已累積的閱讀秒數 (ms)
}

/** 產生 UUID（無依賴版本） */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 將 timestamp 轉為 "YYYY-MM-DD" 字串 */
function toDateStr(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

class ReadingLogManager {
  private enabled = false;

  // 目前進行中 session
  private currentWorkId: string | null = null;
  private currentTitle: string = '';
  private sessionStartTime: number | null = null;   // 進入前台的時間點
  private accumulatedMs: number = 0;                 // 已暫停累積的 ms

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    // App 啟動時，嘗試補寫上次意外中斷的 session
    this._recoverPendingSession();
  }

  /** 設定是否啟用（由 settings.readingLogEnabled 驅動） */
  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /** 進入一本經文時呼叫 */
  public startSession(workId: string, title: string) {
    // 若已有其他 session 在進行，先結束它
    if (this.currentWorkId && this.currentWorkId !== workId) {
      this._finalizeSession();
    }

    if (!this.enabled) return;

    this.currentWorkId = workId;
    this.currentTitle = title;
    this.sessionStartTime = Date.now();
    this.accumulatedMs = 0;

    this._savePending();
  }

  /** 離開經文時呼叫（切回首頁、切換書、關閉等） */
  public endSession() {
    this._finalizeSession();
  }

  // ── 內部方法 ────────────────────────────────────────────

  private handleVisibilityChange = () => {
    if (!this.enabled || !this.currentWorkId) return;

    if (document.visibilityState === 'hidden') {
      // 切到背景：累積已讀時間並暫停
      if (this.sessionStartTime !== null) {
        this.accumulatedMs += Date.now() - this.sessionStartTime;
        this.sessionStartTime = null;
        this._savePending();
      }
    } else {
      // 恢復前台：重新開始計時
      if (this.sessionStartTime === null) {
        this.sessionStartTime = Date.now();
        this._savePending();
      }
    }
  };

  /** 結算並寫入日誌 */
  private _finalizeSession() {
    if (!this.currentWorkId) return;

    // 若還在前台計時，加上現在的增量
    let totalMs = this.accumulatedMs;
    if (this.sessionStartTime !== null) {
      totalMs += Date.now() - this.sessionStartTime;
    }

    const workId = this.currentWorkId;
    const title = this.currentTitle;

    // 清空 session 狀態
    this.currentWorkId = null;
    this.currentTitle = '';
    this.sessionStartTime = null;
    this.accumulatedMs = 0;
    this._clearPending();

    // 規則1：< 1 分鐘不記錄
    if (!this.enabled || totalMs < 60 * 1000) return;

    const endTime = Date.now();
    // startTime 重新計算為 endTime - totalMs（更精確）
    const startTime = endTime - totalMs;

    const entry: ReadingLogEntry = {
      id: generateId(),
      workId,
      title,
      startTime,
      endTime,
      durationMinutes: Math.round(totalMs / 60000),
      date: toDateStr(startTime),
    };

    // 非同步寫入，不阻塞 UI
    saveReadingLog(entry).catch(e =>
      console.warn('[ReadingLogManager] Failed to save reading log:', e)
    );
  }

  /** 儲存進行中 session 至 localStorage（應對意外關閉） */
  private _savePending() {
    if (!this.currentWorkId) return;
    try {
      const pending: PendingSession = {
        workId: this.currentWorkId,
        title: this.currentTitle,
        startTime: this.sessionStartTime ?? Date.now(),
        accumulated: this.accumulatedMs,
      };
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch (e) {
      // ignore
    }
  }

  private _clearPending() {
    try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ }
  }

  /**
   * App 啟動時回收上次意外中斷的 session。
   * 若有暫存且功能已啟用，計算從上次 startTime 到現在的時間差，
   * 若 ≥ 1 分鐘則補寫一筆記錄。
   */
  private _recoverPendingSession() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const pending: PendingSession = JSON.parse(raw);
      this._clearPending();

      // 以 pending.startTime 為起點，now 為終點
      const totalMs = pending.accumulated + (Date.now() - pending.startTime);
      if (totalMs < 60 * 1000) return;

      // 此時 enabled 可能尚未由 settings 設定進來，
      // 但能抵達這裡代表之前有啟用（已存入 pending），故直接寫入
      const endTime = Date.now();
      const startTime = endTime - totalMs;
      const entry: ReadingLogEntry = {
        id: generateId(),
        workId: pending.workId,
        title: pending.title,
        startTime,
        endTime,
        durationMinutes: Math.round(totalMs / 60000),
        date: toDateStr(startTime),
      };
      saveReadingLog(entry).catch(e =>
        console.warn('[ReadingLogManager] Failed to recover pending session:', e)
      );
    } catch (e) {
      // ignore
    }
  }
}

export const readingLogManager = new ReadingLogManager();
