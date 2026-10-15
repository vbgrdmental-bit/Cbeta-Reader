import { getLunarInfo } from '../../../utils/lunarCalendar';

export interface BuddhistCalendarWidgetProps {
  isLayoutEditMode?: boolean;
  onNavigateToReadingLog?: () => void;
}

/**
 * BuddhistCalendarWidget - 4x1 今日佛曆小卡
 * 呈現：
 * 1. 今日十齋日 / 佛菩薩聖誕紀念 / 一般修持日
 * 2. 國曆日期與農曆資訊
 * 3. 點擊整卡無縫直達閱讀與修持日誌
 */
export function BuddhistCalendarWidget({
  isLayoutEditMode = false,
  onNavigateToReadingLog
}: BuddhistCalendarWidgetProps) {
  const now = new Date();
  const lunarInfo = getLunarInfo(now);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  let iconEmoji = '🌿';
  let title = '今日十齋日';
  let badgeText = '十齋日';
  let badgeClass = 'badge-zhai';
  let subText = `${dateStr} · 農曆${lunarInfo.fullStr} · 持齋念佛，滅罪增福`;

  if (lunarInfo.festival) {
    iconEmoji = '🌸';
    title = lunarInfo.festival;
    badgeText = '聖誕紀念';
    badgeClass = 'badge-festival';
    subText = `${dateStr} · 農曆${lunarInfo.fullStr} · 大悲拔苦，智慧增益`;
  } else if (!lunarInfo.isZhai) {
    iconEmoji = '📜';
    title = '今日佛曆閱藏';
    badgeText = '修持日';
    badgeClass = 'badge-normal';
    subText = `${dateStr} · 農曆${lunarInfo.fullStr} · 深入經藏，智慧如海`;
  }

  return (
    <div
      className="home-calendar-banner-4x1"
      onClick={!isLayoutEditMode ? onNavigateToReadingLog : undefined}
      title="點擊前往閱讀與修持日誌"
      style={{ cursor: !isLayoutEditMode ? 'pointer' : 'default' }}
    >
      <div className="home-cal-banner-left">
        <div className="home-cal-banner-icon">{iconEmoji}</div>
        <div className="home-cal-banner-content">
          <div className="home-cal-banner-main">
            <span>{title}</span>
            <span className={`home-cal-banner-badge ${badgeClass}`}>{badgeText}</span>
          </div>
          <div className="home-cal-banner-sub">{subText}</div>
        </div>
      </div>
    </div>
  );
}
