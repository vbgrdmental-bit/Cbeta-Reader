import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string | number;
  showCloseButton?: boolean;
  className?: string;
}

/**
 * AppModal - 全站統一標準對話框 / 彈窗組件
 * 特色：
 * 1. 實心高對比遮罩，杜絕深色與各色主題半透明穿透
 * 2. 支援 ESC 鍵與外部雙擊關閉
 * 3. 鎖定底層滾軸，防止手機輸入法彈出時穿透滾動
 * 4. 採用全站統一 Design Tokens
 */
export function AppModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 440,
  showCloseButton = true,
  className = ''
}: AppModalProps) {
  const lastClickTimeRef = useRef(0);

  // 監聽 ESC 鍵關閉
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 鎖定底層滾軸
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // 外部雙擊判定關閉
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const now = Date.now();
    if (now - lastClickTimeRef.current < 350) {
      onClose();
    }
    lastClickTimeRef.current = now;
  };

  const modalContent = (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'var(--surface-overlay, rgba(0, 0, 0, 0.65))',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.18s ease-out'
      }}
    >
      <div
        className={className}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          backgroundColor: 'var(--surface-modal, #ffffff)',
          color: 'var(--text-main, #2d2a26)',
          border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.12))',
          borderRadius: 'var(--cbeta-radius-modal, 20px)',
          boxShadow: 'var(--shadow-modal, 0 20px 40px -8px rgba(0, 0, 0, 0.35))',
          padding: '22px 20px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          animation: 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: subtitle ? '4px' : '16px',
              paddingBottom: '10px',
              borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))'
            }}
          >
            <div>
              {typeof title === 'string' ? (
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: 'var(--text-main, #2d2a26)',
                    letterSpacing: '0.02em',
                    fontFamily: 'var(--font-serif)'
                  }}
                >
                  {title}
                </h3>
              ) : (
                title
              )}
              {subtitle && (
                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-sub, #666)',
                    marginTop: '2px'
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--surface-capsule, rgba(0,0,0,0.06))',
                  color: 'var(--text-sub, #666)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          className="custom-scrollbar"
          style={{
            overflowY: 'auto',
            flex: 1,
            paddingRight: '2px'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
