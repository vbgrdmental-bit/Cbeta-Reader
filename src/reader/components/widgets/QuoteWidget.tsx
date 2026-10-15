export interface QuoteWidgetProps {
  quote?: string;
  author?: string;
}

/**
 * QuoteWidget - 佛典精進名句小卡 (4x2)
 */
export function QuoteWidget({
  quote = '「由聞知諸法，由聞遮眾惡，由聞斷無義，由聞得涅槃。」',
  author = '印順導師《成佛之道》Y0040'
}: QuoteWidgetProps) {
  return (
    <div className="zen-quote-4x2">
      <div className="zen-lotus">
        <svg
          width="22"
          height="18"
          viewBox="0 0 24 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.75, color: 'var(--theme-accent, #8c4b27)' }}
        >
          <path d="M12 2C12 2 8 8 8 13C8 16 10 18 12 18C14 18 16 16 16 13C16 8 12 2 12 2Z" />
          <path d="M12 18C7.5 18 4 14.5 4 11C4 8.5 6 6 8 5" />
          <path d="M12 18C16.5 18 20 14.5 20 11C20 8.5 18 6 16 5" />
          <path d="M2 18C5 18 8 17.5 12 17.5C16 17.5 19 18 22 18" />
        </svg>
      </div>
      <div className="zen-text">{quote}</div>
      <div className="zen-author">{author}</div>
    </div>
  );
}
