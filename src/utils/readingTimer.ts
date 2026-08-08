// 💡 全局閱讀計時器與螢幕睡眠鎖 (Screen WakeLock) 管理器

export type TimerDuration = 15 | 30 | 45 | 60 | null;

export interface ReadingTimerState {
  duration: TimerDuration;
  endTime: number | null; // timestamp in ms
  remainingSeconds: number;
  isWarningShown: boolean;      // 第一對話框：1分鐘溫馨提醒是否顯示中
  isTimeUpShown: boolean;       // 第二對話框：時間到黑幕對話框是否顯示中
  restOnTimeChoice: boolean;    // 是否已在第一對話框點選「時間到就休息」
  warningAutoDismissed: boolean;// 第一對話框是否因 30 秒無視而自動隱藏
  timeUpAutoDismissed: boolean; // 第二對話框是否因 30 秒無視而自動隱藏
  isBlackoutMode: boolean;      // 是否處於全黑幕 / 睡眠狀態
}

type TimerListener = (state: ReadingTimerState) => void;

class ReadingTimerManager {
  private duration: TimerDuration = null;
  private endTime: number | null = null;
  
  private isWarningShown = false;
  private isTimeUpShown = false;
  private restOnTimeChoice = false;
  private warningAutoDismissed = false;
  private timeUpAutoDismissed = false;
  private isBlackoutMode = false;
  
  private intervalId: any = null;
  private warningTimerTimeoutId: any = null;
  private timeUpTimerTimeoutId: any = null;
  private timeUpReleaseWakeLockTimeoutId: any = null;
  private wakeLock: any = null;
  private listeners: Set<TimerListener> = new Set();

  constructor() {
    this.restoreFromStorage();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private restoreFromStorage() {
    try {
      const storedDuration = localStorage.getItem('reading_timer_duration');
      const storedEndTime = localStorage.getItem('reading_timer_end_time');
      const storedRestChoice = localStorage.getItem('reading_timer_rest_choice');

      if (storedEndTime && storedDuration) {
        const parsedEndTime = parseInt(storedEndTime, 10);
        const parsedDuration = parseInt(storedDuration, 10) as TimerDuration;
        
        if (parsedEndTime > Date.now()) {
          this.duration = parsedDuration;
          this.endTime = parsedEndTime;
          this.restOnTimeChoice = storedRestChoice === 'true';
          this.startInterval();
          this.acquireWakeLock();
        } else {
          this.clearStorage();
        }
      }
    } catch (e) {
      console.warn('Failed to restore reading timer:', e);
    }
  }

  private saveToStorage() {
    try {
      if (this.endTime && this.duration) {
        localStorage.setItem('reading_timer_duration', String(this.duration));
        localStorage.setItem('reading_timer_end_time', String(this.endTime));
        localStorage.setItem('reading_timer_rest_choice', String(this.restOnTimeChoice));
      } else {
        this.clearStorage();
      }
    } catch (e) {
      console.warn('Failed to save reading timer:', e);
    }
  }

  private clearStorage() {
    try {
      localStorage.removeItem('reading_timer_duration');
      localStorage.removeItem('reading_timer_end_time');
      localStorage.removeItem('reading_timer_rest_choice');
    } catch (e) {}
  }

  // 請求螢幕防睡眠鎖 (Screen WakeLock API)
  private async acquireWakeLock() {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        if (!this.wakeLock) {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('[ReadingTimer] Screen WakeLock acquired successfully');
        }
      }
    } catch (err) {
      console.warn('[ReadingTimer] Screen WakeLock request failed:', err);
    }
  }

  // 釋放螢幕防睡眠鎖
  private async releaseWakeLock() {
    try {
      if (this.wakeLock) {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log('[ReadingTimer] Screen WakeLock released');
      }
    } catch (err) {
      console.warn('[ReadingTimer] Screen WakeLock release failed:', err);
    }
  }

  private handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible' && this.endTime && Date.now() < this.endTime) {
      await this.acquireWakeLock();
    }
  };

  private startInterval() {
    if (this.intervalId) clearInterval(this.intervalId);

    this.intervalId = setInterval(() => {
      if (!this.endTime) {
        this.stopTimer();
        return;
      }

      const now = Date.now();
      const remSec = Math.max(0, Math.ceil((this.endTime - now) / 1000));

      // 1. 觸發 1 分鐘 (60秒) 溫馨提醒 (第一個對話框)
      if (remSec <= 60 && remSec > 0 && !this.isWarningShown && !this.restOnTimeChoice && !this.warningAutoDismissed) {
        this.isWarningShown = true;
        this.notifyListeners();

        // 30 秒無視自動隱藏第一對話框
        if (this.warningTimerTimeoutId) clearTimeout(this.warningTimerTimeoutId);
        this.warningTimerTimeoutId = setTimeout(() => {
          if (this.isWarningShown) {
            this.isWarningShown = false;
            this.warningAutoDismissed = true;
            this.notifyListeners();
          }
        }, 30000);
      }

      // 2. 觸發 0 秒時間到
      if (remSec <= 0) {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }

        if (this.restOnTimeChoice) {
          // 💡 邏輯 Branch A: 已在第一對話框按「時間到就休息」-> 00:00 時直接進入黑幕/睡眠，不彈出第二對話框
          this.isWarningShown = false;
          this.isTimeUpShown = false;
          this.isBlackoutMode = true;
          this.releaseWakeLock();
        } else {
          // 💡 邏輯 Branch B: 未點選「時間到就休息」(無視或未回應) -> 跳出第二對話框 + 黑幕
          this.isWarningShown = false;
          this.isTimeUpShown = true;
          this.isBlackoutMode = true;

          // 第二對話框 30 秒無視自動隱藏 (維持黑幕)
          if (this.timeUpTimerTimeoutId) clearTimeout(this.timeUpTimerTimeoutId);
          this.timeUpTimerTimeoutId = setTimeout(() => {
            if (this.isTimeUpShown) {
              this.isTimeUpShown = false;
              this.timeUpAutoDismissed = true;
              this.notifyListeners();
            }
          }, 30000);

          // 出現後 1 分鐘 (T+1 min) 完全釋放 WakeLock 防睡眠鎖 (手機/電腦原生睡眠)
          if (this.timeUpReleaseWakeLockTimeoutId) clearTimeout(this.timeUpReleaseWakeLockTimeoutId);
          this.timeUpReleaseWakeLockTimeoutId = setTimeout(() => {
            this.releaseWakeLock();
          }, 60000);
        }

        this.notifyListeners();
      } else {
        this.notifyListeners();
      }
    }, 1000);
  }

  public getState(): ReadingTimerState {
    const now = Date.now();
    const remSec = this.endTime ? Math.max(0, Math.ceil((this.endTime - now) / 1000)) : 0;
    return {
      duration: this.duration,
      endTime: this.endTime,
      remainingSeconds: remSec,
      isWarningShown: this.isWarningShown,
      isTimeUpShown: this.isTimeUpShown,
      restOnTimeChoice: this.restOnTimeChoice,
      warningAutoDismissed: this.warningAutoDismissed,
      timeUpAutoDismissed: this.timeUpAutoDismissed,
      isBlackoutMode: this.isBlackoutMode
    };
  }

  public setTimer(minutes: TimerDuration) {
    if (minutes === null || this.duration === minutes) {
      this.stopTimer();
      return;
    }
    this.extendTimer(minutes);
  }

  public extendTimer(minutes: 15 | 30 | 45 | 60) {
    this.clearTimeouts();
    this.duration = minutes;
    this.endTime = Date.now() + minutes * 60 * 1000;
    this.isWarningShown = false;
    this.isTimeUpShown = false;
    this.restOnTimeChoice = false;
    this.warningAutoDismissed = false;
    this.timeUpAutoDismissed = false;
    this.isBlackoutMode = false;

    this.saveToStorage();
    this.acquireWakeLock();
    this.startInterval();
    this.notifyListeners();
  }

  // 第一對話框：點選「時間到就休息」
  public chooseRestOnTime() {
    this.restOnTimeChoice = true;
    this.isWarningShown = false;
    this.saveToStorage();
    this.notifyListeners();
  }

  // 手動關閉黑幕 / 休息狀態
  public exitBlackout() {
    this.stopTimer();
  }

  private clearTimeouts() {
    if (this.warningTimerTimeoutId) { clearTimeout(this.warningTimerTimeoutId); this.warningTimerTimeoutId = null; }
    if (this.timeUpTimerTimeoutId) { clearTimeout(this.timeUpTimerTimeoutId); this.timeUpTimerTimeoutId = null; }
    if (this.timeUpReleaseWakeLockTimeoutId) { clearTimeout(this.timeUpReleaseWakeLockTimeoutId); this.timeUpReleaseWakeLockTimeoutId = null; }
  }

  public stopTimer() {
    this.clearTimeouts();
    this.duration = null;
    this.endTime = null;
    this.isWarningShown = false;
    this.isTimeUpShown = false;
    this.restOnTimeChoice = false;
    this.warningAutoDismissed = false;
    this.timeUpAutoDismissed = false;
    this.isBlackoutMode = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.clearStorage();
    this.releaseWakeLock();
    this.notifyListeners();
  }

  public subscribe(listener: TimerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }
}

export const readingTimer = new ReadingTimerManager();

export function formatTimerMMSS(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
