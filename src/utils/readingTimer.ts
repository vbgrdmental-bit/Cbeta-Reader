// 💡 全局閱讀計時器與螢幕睡眠鎖 (Screen WakeLock) 管理器

export type TimerDuration = 15 | 30 | 45 | 60 | null;

export interface ReadingTimerState {
  duration: TimerDuration;
  endTime: number | null; // timestamp in ms
  remainingSeconds: number;
  isWarningShown: boolean;
  isTimeUpShown: boolean;
}

type TimerListener = (state: ReadingTimerState) => void;

class ReadingTimerManager {
  private duration: TimerDuration = null;
  private endTime: number | null = null;
  private isWarningShown = false;
  private isTimeUpShown = false;
  
  private intervalId: any = null;
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
      const storedWarning = localStorage.getItem('reading_timer_warning_shown');
      const storedTimeUp = localStorage.getItem('reading_timer_timeup_shown');

      if (storedEndTime && storedDuration) {
        const parsedEndTime = parseInt(storedEndTime, 10);
        const parsedDuration = parseInt(storedDuration, 10) as TimerDuration;
        
        if (parsedEndTime > Date.now()) {
          this.duration = parsedDuration;
          this.endTime = parsedEndTime;
          this.isWarningShown = storedWarning === 'true';
          this.isTimeUpShown = storedTimeUp === 'true';
          this.startInterval();
          this.acquireWakeLock();
        } else {
          // 時間已過
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
        localStorage.setItem('reading_timer_warning_shown', String(this.isWarningShown));
        localStorage.setItem('reading_timer_timeup_shown', String(this.isTimeUpShown));
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
      localStorage.removeItem('reading_timer_warning_shown');
      localStorage.removeItem('reading_timer_timeup_shown');
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

      // 檢查 1 分鐘 (60秒) 溫馨提醒
      if (remSec <= 60 && remSec > 0 && !this.isWarningShown) {
        this.isWarningShown = true;
        this.saveToStorage();
      }

      // 檢查 0 秒時間到
      if (remSec <= 0 && !this.isTimeUpShown) {
        this.isTimeUpShown = true;
        this.releaseWakeLock();
        this.saveToStorage();
      }

      this.notifyListeners();

      if (remSec <= 0) {
        clearInterval(this.intervalId);
        this.intervalId = null;
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
      isTimeUpShown: this.isTimeUpShown
    };
  }

  public setTimer(minutes: TimerDuration) {
    if (minutes === null || this.duration === minutes) {
      // 點擊已選中的分鐘數 -> 取消計時
      this.stopTimer();
      return;
    }

    this.duration = minutes;
    this.endTime = Date.now() + minutes * 60 * 1000;
    this.isWarningShown = false;
    this.isTimeUpShown = false;

    this.saveToStorage();
    this.acquireWakeLock();
    this.startInterval();
    this.notifyListeners();
  }

  public extendTimer(minutes: 15 | 30 | 45 | 60) {
    this.duration = minutes;
    this.endTime = Date.now() + minutes * 60 * 1000;
    this.isWarningShown = false;
    this.isTimeUpShown = false;

    this.saveToStorage();
    this.acquireWakeLock();
    this.startInterval();
    this.notifyListeners();
  }

  public dismissWarning() {
    this.isWarningShown = false;
    this.saveToStorage();
    this.notifyListeners();
  }

  public dismissTimeUp() {
    this.stopTimer();
  }

  public stopTimer() {
    this.duration = null;
    this.endTime = null;
    this.isWarningShown = false;
    this.isTimeUpShown = false;
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
    // 立即推播一次當前狀態
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
