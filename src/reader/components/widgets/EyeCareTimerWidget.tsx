import { useState, useEffect } from 'react';
import { readingTimer, formatTimerMMSS, type ReadingTimerState } from '../../../utils/readingTimer';
import type { HomeWidgetSize } from '../../../types/homeLayout';

export interface EyeCareTimerWidgetProps {
  size?: HomeWidgetSize;
  isLayoutEditMode?: boolean;
}

/**
 * EyeCareTimerWidget - 護眼計時器小卡 (支援 2x2 與 4x2 規格)
 * 特色：
 * 1. 2x2: 上方虛線倒數圓環 + 下方 4 個快捷選時圓圈 (15/25/45/60m)
 * 2. 4x2: 左側大倒數環與護眼副標 + 右側 6 個選時按鈕 (10/15/25/35/45/60m)
 * 3. 點選中之時間按鈕即可取消計時
 */
export function EyeCareTimerWidget({
  size = 'size-2x2',
  isLayoutEditMode = false
}: EyeCareTimerWidgetProps) {
  const [timerState, setTimerState] = useState<ReadingTimerState>(readingTimer.getState());

  useEffect(() => {
    const unsub = readingTimer.subscribe(setTimerState);
    return unsub;
  }, []);

  const handleSetTimerMinutes = (minutes: number | null) => {
    readingTimer.setTimer(minutes);
  };

  const isRunning = timerState.duration !== null;
  const timeDisplay = isRunning 
    ? formatTimerMMSS(timerState.remainingSeconds)
    : '25:00';

  const durations6 = [10, 15, 25, 35, 45, 60];
  const durations4 = [15, 25, 45, 60];

  // 4x2 橫幅大儀表板
  if (size === 'size-4x2') {
    return (
      <div className="timer-widget-4x2">
        <div className="timer-4x2-left">
          <div 
            className={`timer-circle timer-circle-large ${isRunning ? 'is-active' : ''}`}
            onClick={!isLayoutEditMode ? () => {
              if (isRunning) handleSetTimerMinutes(null);
              else handleSetTimerMinutes(25);
            } : undefined}
            title={isRunning ? `倒數中：${timeDisplay} (點擊取消)` : '點擊開始計時'}
            style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
          >
            <span>{timeDisplay}</span>
          </div>
          <div className="timer-mode-sublabel">護眼模式設定</div>
        </div>
        <div className="timer-4x2-right">
          <div className="timer-durations-circles-6">
            {durations6.map(mins => {
              const isSelected = timerState.duration === mins;
              return (
                <button
                  key={`timer-circle-6-${mins}`}
                  type="button"
                  className={`timer-circle-btn ${isSelected ? 'active' : ''}`}
                  onClick={!isLayoutEditMode ? () => {
                    if (isSelected) {
                      handleSetTimerMinutes(null);
                    } else {
                      handleSetTimerMinutes(mins);
                    }
                  } : undefined}
                  title={isSelected ? `點擊取消 ${mins} 分鐘計時` : `設定 ${mins} 分鐘`}
                >
                  {mins}m
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 2x2 方塊規格
  return (
    <div className="timer-2x2-wrapper">
      <div 
        className={`timer-circle ${isRunning ? 'is-active' : ''}`}
        onClick={!isLayoutEditMode ? () => {
          if (isRunning) handleSetTimerMinutes(null);
          else handleSetTimerMinutes(25);
        } : undefined}
        title={isRunning ? `倒數中：${timeDisplay} (點擊取消)` : '點擊開始 25 分鐘計時'}
        style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default', margin: '0 0 6px 0' }}
      >
        <span>{timeDisplay}</span>
      </div>

      <div className="timer-circles-4-row">
        {durations4.map(mins => {
          const isSelected = timerState.duration === mins;
          return (
            <button
              key={`inline-circle-${mins}`}
              type="button"
              className={`timer-circle-btn-small ${isSelected ? 'active' : ''}`}
              onClick={!isLayoutEditMode ? (e) => {
                e.stopPropagation();
                if (isSelected) {
                  handleSetTimerMinutes(null);
                } else {
                  handleSetTimerMinutes(mins);
                }
              } : undefined}
              title={isSelected ? `點擊取消 ${mins} 分鐘計時` : `設定 ${mins} 分鐘`}
            >
              {mins}m
            </button>
          );
        })}
      </div>
    </div>
  );
}
