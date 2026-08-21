import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import type { BuildProgress, BuildStep } from '../../builder/PackageBuilder';

interface BuilderProgressOverlayProps {
  buildProgress: BuildProgress;
  theme?: string;
  isUpdate?: boolean;
}

interface StepDef {
  id: BuildStep;
  num: number;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
  completedSteps: BuildStep[];
}

const STEP_DEFINITIONS: StepDef[] = [
  {
    id: 'metadata', num: 1,
    title: '佛典資料', titleEn: 'Metadata',
    desc: '元數據解析', descEn: 'Work info & vol count',
    completedSteps: ['fetch_content', 'navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed']
  },
  {
    id: 'fetch_content', num: 2,
    title: '經文段落', titleEn: 'Scripture Text',
    desc: 'HTML 標記解析', descEn: 'Parse CBETA HTML juans',
    completedSteps: ['navigation', 'reference', 'search_index', 'ai_index', 'saving', 'completed']
  },
  {
    id: 'navigation', num: 3,
    title: '目錄章節', titleEn: 'TOC / Navigation',
    desc: '品名卷期導覽', descEn: 'Chapter & juan index',
    completedSteps: ['reference', 'search_index', 'ai_index', 'saving', 'completed']
  },
  {
    id: 'reference', num: 4,
    title: '校勘註解', titleEn: 'Critical Notes',
    desc: '學術校勘比對', descEn: 'Apparatus & variants',
    completedSteps: ['search_index', 'ai_index', 'saving', 'completed']
  },
  {
    id: 'search_index', num: 5,
    title: '全文檢索', titleEn: 'Search Index',
    desc: '本地極速索引', descEn: 'Local full-text index',
    completedSteps: ['ai_index', 'saving', 'completed']
  },
  {
    id: 'ai_index', num: 6,
    title: '智慧索引', titleEn: 'AI Index',
    desc: '語意導航架構', descEn: 'Semantic RAG scaffold',
    completedSteps: ['saving', 'completed']
  },
];

/** 將剩餘秒數格式化為人類可讀字串 */
function fmtTime(sec?: number): string {
  if (sec == null || sec <= 0) return '';
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}分${s}秒` : `${m}分鐘`;
}

export const BuilderProgressOverlay: React.FC<BuilderProgressOverlayProps> = ({
  buildProgress,
  theme = 'ivory',
  isUpdate = false
}) => {
  const [loadingDots, setLoadingDots] = useState('');

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setLoadingDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 450);
    return () => clearInterval(dotInterval);
  }, []);

  const currentStep = buildProgress.step;
  const jp = buildProgress.juanProgress;
  const bi = buildProgress.batchInfo;

  // --- 組合圓圈圖下方的二行資訊 ---
  let line1 = '';
  let line2 = '';

  if (bi) {
    // 批量模式：顯示批次進度
    line1 = `批量下載中（${bi.current} / ${bi.total}）`;
    const wt = buildProgress.workTitle;
    const wi = buildProgress.workId;
    line2 = wt ? `正在下載《${wt}》${wi ? `（${wi}）` : ''}` : '';
  } else {
    // 單書模式：顯示書名 + 卷次進度/剩餘時間
    const wt = buildProgress.workTitle;
    const wi = buildProgress.workId;
    if (wt) {
      line1 = `正在下載《${wt}》${wi ? `（${wi}）` : ''}`;
    } else {
      line1 = buildProgress.message;
    }
    // Line2：卷次進度 + 剩餘時間
    if (jp && jp.total > 1) {
      const remaining = jp.total - jp.completed;
      const timeStr = fmtTime(jp.remainingSeconds);
      line2 = `共 ${jp.total} 卷，已完成 ${jp.completed} 卷，剩 ${remaining} 卷${timeStr ? `，約剩 ${timeStr}` : ''}`;
    }
  }

  return (
    <div className={`builder-progress-overlay theme-${theme}`}>
      {/* 1. 圓型圖案 (固定尺寸與位置，不跳動) */}
      <div className="builder-animation-box">
        <div 
          className="builder-outer-ring" 
          style={{ transform: `rotate(${buildProgress.percent * 3.6}deg)`, transition: 'transform 0.2s linear' }}
        />
        <div className={`builder-mandala ${buildProgress.percent === 100 ? 'is-completed' : ''}`}>
          <img 
            src="/apple-touch-icon.png" 
            alt="CBETA Reader 淨心閱讀"
            className="builder-logo-img"
          />
        </div>
      </div>

      {/* 2. 圓圈圖下方的二行簡潔資訊 (固定高度容器，防排版上下跳動) */}
      <div className="builder-header-message">
        {line1 && <div className="builder-header-line1">{line1}</div>}
        {line2 && <div className="builder-header-line2">{line2}</div>}
      </div>

      {/* 3. 「下載中」卡片，內含 6 個 1:1 方塊 */}
      <div className="builder-details-card animate-slide-up">
        <div className="builder-title">{isUpdate ? '更新中' : '下載中'}{loadingDots}</div>
        <div className="builder-progress-bar-wrapper">
          <div className="builder-progress-bar-fill" style={{ width: `${buildProgress.percent}%` }} />
        </div>
        
        {/* 6 個方塊網格：上 3 個 (1,2,3)、下 3 個 (4,5,6)，比例 1:1:1，每個 1:1 */}
        <div className="builder-steps-grid">
          {STEP_DEFINITIONS.map((stepItem) => {
            const isCompleted = stepItem.completedSteps.includes(currentStep);
            const isActive = currentStep === stepItem.id;
            const statusClass = isCompleted ? 'completed' : (isActive ? 'active' : 'pending');

            return (
              <div 
                key={stepItem.id} 
                className={`builder-step-card ${statusClass}`}
              >
                {/* 上方：打勾圓框 / 序號 + 英文短標題 */}
                <div className="builder-card-top">
                  <div className="builder-card-badge">
                    {isCompleted ? (
                      <Check size={12} strokeWidth={3} />
                    ) : (
                      <span>{stepItem.num}</span>
                    )}
                  </div>
                  <div className="builder-card-en">{stepItem.titleEn}</div>
                </div>

                {/* 中間：中文標題 */}
                <div className="builder-card-title">
                  {stepItem.title}
                </div>

                {/* 下方：中英說明 */}
                <div className="builder-card-desc">
                  <div>{stepItem.desc}</div>
                  <div className="builder-card-desc-en">{stepItem.descEn}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
