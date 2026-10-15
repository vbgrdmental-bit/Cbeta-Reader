import React, { useState, useRef, useEffect } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  subtitle?: string;
}

export interface DropdownSelectProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  width?: string | number;
  triggerStyle?: React.CSSProperties;
  maxMenuHeight?: number;
  align?: 'left' | 'right' | 'center';
}

/**
 * DropdownSelect - 全站統一標準下拉選單組件
 * 特色：
 * 1. 內建精準向量 SVG 倒三角，深淺模式輪廓醒目
 * 2. 外部點擊自動收合
 * 3. 實心高對比背景，解決半透明重疊穿透問題
 */
export function DropdownSelect({
  options,
  value,
  onChange,
  placeholder = '請選擇',
  className = '',
  width = 'auto',
  triggerStyle,
  maxMenuHeight = 260,
  align = 'left'
}: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // 點選外部關閉
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ESC 鍵關閉
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const alignmentStyles: React.CSSProperties =
    align === 'right'
      ? { right: 0 }
      : align === 'center'
      ? { left: '50%', transform: 'translateX(-50%)' }
      : { left: 0 };

  return (
    <div
      ref={containerRef}
      className={`cbeta-dropdown-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: typeof width === 'number' ? `${width}px` : width
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          width: '100%',
          padding: '6px 14px',
          borderRadius: 'var(--cbeta-radius-capsule, 9999px)',
          backgroundColor: 'var(--surface-capsule, rgba(0, 0, 0, 0.06))',
          border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.12))',
          color: 'var(--text-main, inherit)',
          fontSize: '0.88rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          ...triggerStyle
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption?.icon}
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          width="10"
          height="7"
          viewBox="0 0 10 7"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s ease',
            flexShrink: 0,
            opacity: 0.75
          }}
        >
          <path
            d="M1 1.5L5 5.5L9 1.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="custom-scrollbar"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...alignmentStyles,
            zIndex: 10000,
            minWidth: '130px',
            maxWidth: '280px',
            maxHeight: `${maxMenuHeight}px`,
            overflowY: 'auto',
            backgroundColor: 'var(--surface-dropdown, #ffffff)',
            border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.14))',
            borderRadius: 'var(--cbeta-radius-md, 12px)',
            boxShadow: 'var(--shadow-dropdown, 0 10px 25px -4px rgba(0, 0, 0, 0.18))',
            padding: '4px',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderRadius: 'var(--cbeta-radius-sm, 8px)',
                  backgroundColor: isSelected
                    ? 'var(--surface-capsule-active, rgba(140, 75, 39, 0.12))'
                    : 'transparent',
                  color: isSelected
                    ? 'var(--theme-accent, var(--text-main, #2d2a26))'
                    : 'var(--text-main, #2d2a26)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.86rem',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.12s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-capsule, rgba(0, 0, 0, 0.05))';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {opt.icon && <span style={{ marginRight: '8px', display: 'flex' }}>{opt.icon}</span>}
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div>{opt.label}</div>
                  {opt.subtitle && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-hint, #888)', marginTop: '2px' }}>
                      {opt.subtitle}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
