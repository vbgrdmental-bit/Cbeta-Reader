import React from 'react';
import { Heart } from 'lucide-react';

export interface BookCapsuleProps {
  workId: string;
  title: string;
  subtitle?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 依經號前綴判定徽章色彩與背景
 */
export function getCanonBadgeColor(workId: string): { bg: string; text: string } {
  const prefix = workId.charAt(0).toUpperCase();
  switch (prefix) {
    case 'T':
      return { bg: 'var(--badge-t-bg, #8c3835)', text: 'var(--badge-t-text, #ffffff)' };
    case 'X':
      return { bg: 'var(--badge-x-bg, #1e4b6e)', text: 'var(--badge-x-text, #ffffff)' };
    case 'J':
      return { bg: 'var(--badge-j-bg, #70440f)', text: 'var(--badge-j-text, #ffffff)' };
    default:
      return { bg: 'var(--badge-other-bg, #4a5568)', text: 'var(--badge-other-text, #ffffff)' };
  }
}

/**
 * BookCapsule - 全站統一標準經書膠囊組件
 * 特色：
 * 1. 左側 34px 正方形經號徽章 (Serif 襯線古風字型)，無文字切邊
 * 2. 經題支援 2 行自然折行 (line-clamp: 2)，採用典雅楷宋體
 * 3. 支援點擊收藏愛心與秒速直達開啟
 */
export function BookCapsule({
  workId,
  title,
  subtitle,
  isFavorite = false,
  onToggleFavorite,
  onClick,
  className = '',
  style
}: BookCapsuleProps) {
  const badgeColors = getCanonBadgeColor(workId);

  return (
    <div
      onClick={onClick}
      className={`cbeta-book-capsule ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 10px',
        borderRadius: 'var(--cbeta-radius-md, 12px)',
        backgroundColor: 'var(--surface-card, rgba(255, 255, 255, 0.75))',
        border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.10))',
        boxShadow: 'var(--shadow-card, 0 2px 6px rgba(0,0,0,0.04))',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.16s ease',
        userSelect: 'none',
        minHeight: '48px',
        position: 'relative',
        ...style
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.backgroundColor = 'var(--surface-card-hover, rgba(255, 255, 255, 0.95))';
          e.currentTarget.style.boxShadow = 'var(--shadow-card-hover, 0 6px 16px rgba(0,0,0,0.08))';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.backgroundColor = 'var(--surface-card, rgba(255, 255, 255, 0.75))';
          e.currentTarget.style.boxShadow = 'var(--shadow-card, 0 2px 6px rgba(0,0,0,0.04))';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* 經號正方形徽章 */}
      <div
        style={{
          width: '34px',
          height: '34px',
          borderRadius: 'var(--cbeta-radius-xs, 4px)',
          backgroundColor: badgeColors.bg,
          color: badgeColors.text,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.74rem',
          fontWeight: 700,
          fontFamily: 'var(--font-serif)',
          flexShrink: 0,
          letterSpacing: '0.02em',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
      >
        {workId}
      </div>

      {/* 經名與副標 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          title={title}
          style={{
            fontSize: '0.88rem',
            fontWeight: 700,
            color: 'var(--text-main, #2d2a26)',
            fontFamily: 'var(--font-serif)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.35,
            wordBreak: 'break-all'
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-hint, #888)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '1px'
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* 收藏愛心 (可選) */}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(e);
          }}
          aria-label={isFavorite ? '取消最愛' : '加入最愛'}
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            color: isFavorite ? '#e11d48' : 'var(--text-hint, rgba(0,0,0,0.25))',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            transition: 'transform 0.15s ease'
          }}
        >
          <Heart size={16} fill={isFavorite ? '#e11d48' : 'none'} />
        </button>
      )}
    </div>
  );
}
