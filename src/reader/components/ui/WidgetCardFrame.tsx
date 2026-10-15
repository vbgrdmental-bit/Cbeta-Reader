import React from 'react';

export interface WidgetCardFrameProps {
  id?: string;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
  onClick?: () => void;
}

/**
 * WidgetCardFrame - 全站統一標準小卡外框容器組件
 * 特色：
 * 1. 統一圓角 (16px)、卡片陰影與微邊框，風格協調大氣
 * 2. 標配簡潔標題列，支援左側圖示與右側快捷操作
 * 3. 支援深淺色與各色自適應背景
 */
export function WidgetCardFrame({
  id,
  title,
  icon,
  subtitle,
  headerRight,
  children,
  className = '',
  style,
  noPadding = false,
  onClick
}: WidgetCardFrameProps) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`cbeta-widget-card-frame ${className}`}
      style={{
        backgroundColor: 'var(--surface-card, rgba(255, 255, 255, 0.75))',
        border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.10))',
        borderRadius: 'var(--cbeta-radius-card, 16px)',
        boxShadow: 'var(--shadow-card, 0 4px 14px -2px rgba(90, 50, 20, 0.08))',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        ...style
      }}
    >
      {/* Header (若有 title 或 icon 或 headerRight) */}
      {(title || icon || headerRight) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px 6px 14px',
            borderBottom: '1px solid transparent'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {icon && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--theme-accent, var(--text-main, #3c2a1a))'
                }}
              >
                {icon}
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              {typeof title === 'string' ? (
                <span
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    color: 'var(--text-main, #3c2a1a)',
                    fontFamily: 'var(--font-serif)',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {title}
                </span>
              ) : (
                title
              )}
              {subtitle && (
                <div
                  style={{
                    fontSize: '0.74rem',
                    color: 'var(--text-hint, #888)',
                    marginTop: '1px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {headerRight && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{headerRight}</div>}
        </div>
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: noPadding ? '0' : '8px 14px 14px 14px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {children}
      </div>
    </div>
  );
}
