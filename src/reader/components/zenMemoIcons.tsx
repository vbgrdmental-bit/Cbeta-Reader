import React from 'react';
import type { HomeWidgetSize } from '../../types/homeLayout';

/**
 * 💡 自訂便籤尺寸臨界點限制 (Min / Max FontSize)
 * 2*2、4*1、4*2、4*3，每個卡片都有它文字的最大或最小，當到達臨界點時，無法再點放大/縮小
 */
export const MEMO_FONT_SIZE_LIMITS: Record<string, { min: number; max: number; default: number }> = {
  'size-4x1': { min: 12, max: 18, default: 14 },
  'size-2x2': { min: 12, max: 20, default: 16 },
  'size-4x2': { min: 14, max: 26, default: 22 },
  'size-4x3': { min: 14, max: 32, default: 24 },
  'size-4x4': { min: 14, max: 32, default: 24 },
};

export const getMemoFontSizeLimits = (size?: HomeWidgetSize) => {
  const key = size || 'size-4x2';
  return MEMO_FONT_SIZE_LIMITS[key] || { min: 12, max: 26, default: 20 };
};

/**
 * 💡 6 款禪意/佛教小圖示符號 (含圖 3 經典盛開清蓮)
 * index 0: 無符號 (可選沒有符號)
 * index 1: 經典清蓮 (圖 3 盛開三瓣端麗蓮花)
 * index 2: 雙重曼陀羅蓮 (莊嚴雙層蓮瓣)
 * index 3: 菩提覺葉 (清淨菩提樹葉)
 * index 4: 八正道法輪 (八輻轉法輪印)
 * index 5: 禪宗圓相 (一筆劃空性圓滿)
 * index 6: 吉祥如意雲 (如意祥雲紋樣)
 */
export interface ZenMemoIconMeta {
  id: number;
  name: string;
  render: (size?: number, color?: string) => React.ReactNode;
}

export const ZEN_MEMO_ICONS: ZenMemoIconMeta[] = [
  {
    id: 1,
    name: '經典清蓮',
    render: (size = 20, color = 'currentColor') => (
      <svg
        width={size}
        height={size * 0.9}
        viewBox="0 0 24 22"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 中心蓮瓣 */}
        <path d="M12 2.5C12 2.5 9.2 7.5 9.2 12.8C9.2 16.2 10.5 18.2 12 18.2C13.5 18.2 14.8 16.2 14.8 12.8C14.8 7.5 12 2.5 12 2.5Z" />
        {/* 左外瓣 */}
        <path d="M10.8 18C6.8 17.5 4 14 4 9.8C4 7 5.8 4.8 7.5 3.8" />
        {/* 右外瓣 */}
        <path d="M13.2 18C17.2 17.5 20 14 20 9.8C20 7 18.2 4.8 16.5 3.8" />
        {/* 下方蓮座底線 */}
        <path d="M3 18.5H21" />
      </svg>
    )
  },
  {
    id: 2,
    name: '雙瓣曼陀羅',
    render: (size = 20, color = 'currentColor') => (
      <svg
        width={size}
        height={size * 0.9}
        viewBox="0 0 24 22"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2C12 2 9.5 6.5 9.5 11.5C9.5 14.5 10.6 16.5 12 16.5C13.4 16.5 14.5 14.5 14.5 11.5C14.5 6.5 12 2 12 2Z" />
        <path d="M9 15.5C6.5 14.5 4.5 11.5 4.5 8.5C4.5 6.8 5.8 5 7 4.2" />
        <path d="M15 15.5C17.5 14.5 19.5 11.5 19.5 8.5C19.5 6.8 18.2 5 17 4.2" />
        <path d="M6.5 17.5C8 18.8 10 19.5 12 19.5C14 19.5 16 18.8 17.5 17.5" />
        <path d="M3.5 20H20.5" />
      </svg>
    )
  },
  {
    id: 3,
    name: '菩提覺葉',
    render: (size = 20, color = 'currentColor') => (
      <svg
        width={size}
        height={size * 0.9}
        viewBox="0 0 24 22"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 飄逸菩提葉形 */}
        <path d="M12 2C12 2 12 4.5 12 6.5C8.5 6.5 4.5 9.5 4.5 13.8C4.5 17.5 7.8 20 12 20C16.2 20 19.5 17.5 19.5 13.8C19.5 9.5 15.5 6.5 12 6.5" />
        <path d="M12 6.5V20" />
        <path d="M12 10.5C10 12 7.5 12.8 6.5 13.2" />
        <path d="M12 10.5C14 12 16.5 12.8 17.5 13.2" />
        <path d="M12 14.5C10 15.5 8 16.2 7 16.5" />
        <path d="M12 14.5C14 15.5 16 16.2 17 16.5" />
      </svg>
    )
  },
  {
    id: 4,
    name: '八正法輪',
    render: (size = 20, color = 'currentColor') => (
      <svg
        width={size}
        height={size * 0.9}
        viewBox="0 0 24 22"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="11" r="8.5" />
        <circle cx="12" cy="11" r="2.8" />
        <path d="M12 2.5V8.2M12 13.8V19.5M3.5 11H8.2M13.8 11H20.5" />
        <path d="M6 5L9.6 8.6M14.4 13.4L18 17M6 17L9.6 13.4M14.4 8.6L18 5" />
      </svg>
    )
  },
  {
    id: 5,
    name: '禪宗圓相',
    render: (size = 20, color = 'currentColor') => (
      <svg
        width={size}
        height={size * 0.9}
        viewBox="0 0 24 22"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3C7 3 3.5 7 3.5 12C3.5 16.5 7 19.5 11.8 19.5C16.8 19.5 20.5 16 20.5 11.5C20.5 8 18.8 5.2 16 3.8" />
      </svg>
    )
  },
  {
    id: 6,
    name: '吉祥如意雲',
    render: (size = 20, color = 'currentColor') => (
      <svg
        width={size}
        height={size * 0.9}
        viewBox="0 0 24 22"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 16.5H16.5C18.8 16.5 20.5 14.8 20.5 12.5C20.5 10.4 18.9 8.8 16.8 8.5C16.3 6.2 14.3 4.5 11.8 4.5C9.6 4.5 7.8 5.8 7 7.5C4.8 7.8 3.2 9.7 3.2 12C3.2 14.5 5 16.5 6.5 16.5Z" />
        <path d="M7.5 16.5C7.5 13.5 9.5 11.5 12 11.5C14 11.5 15 12.5 15.5 13.5" />
      </svg>
    )
  }
];

export const renderZenMemoIcon = (iconIndex: number = 1, size: number = 20, color: string = 'var(--theme-accent, #8c4b27)') => {
  if (iconIndex === 0) return null; // 0 為「無符號」
  const target = ZEN_MEMO_ICONS.find(item => item.id === iconIndex) || ZEN_MEMO_ICONS[0];
  return target.render(size, color);
};
