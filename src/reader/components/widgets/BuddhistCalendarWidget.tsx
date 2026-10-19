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

  let iconEmoji: React.ReactNode = '🌿';
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
  } else if (lunarInfo.specialMoon) {
    iconEmoji = lunarInfo.specialMoon === '白月' ? (
      /* 🌕 白月：白色圓圈月亮，表示即將滿月的樣子 */
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block' }}>
        <circle cx="8" cy="8" r="6.2" fill="#ffffff" stroke="#b45309" strokeWidth="1.2" />
      </svg>
    ) : (
      /* 🌑 黑月：白色細細弦月的月亮，表示即將看不到月亮的樣子 */
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block' }}>
        <circle cx="8" cy="8" r="6.2" stroke="#b45309" strokeWidth="0.8" strokeDasharray="1.5 1.5" opacity="0.35" />
        <path d="M 8 1.8 A 6.2 6.2 0 0 0 8 14.2 A 5.5 5.5 0 0 1 8 1.8 Z" fill="#ffffff" stroke="#b45309" strokeWidth="0.8" />
      </svg>
    );
    title = `今日${lunarInfo.specialMoon} · 南無地藏菩薩`;
    badgeText = `${lunarInfo.specialMoon}·十齋`;
    badgeClass = 'badge-zhai';
    subText = `${dateStr} · 農曆${lunarInfo.fullStr} · 滅罪除障，持齋修善`;
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
