import { Progress, Tag } from 'antd';
import type { ReportStage, ReportThinkingEntry } from '@/types';

interface StepLoadingProps {
  stage: ReportStage;
  progress: number;
  message: string;
  thinkingTrail?: ReportThinkingEntry[];
}

const STEPS: { key: ReportStage; label: string }[] = [
  { key: 'queued', label: '排队入列' },
  { key: 'profiling', label: '提取客户画像' },
  { key: 'recall', label: '调用 onerec 召回' },
  { key: 'writing', label: 'AI 撰写配置逻辑' },
  { key: 'rendering', label: '渲染图表 / 注入水印' }
];

const ORDER: Record<ReportStage, number> = {
  idle: -1,
  queued: 0,
  profiling: 1,
  recall: 2,
  writing: 3,
  rendering: 4,
  done: 5,
  error: -1
};

const KIND_LABEL: Record<ReportThinkingEntry['kind'], { tag: string; color: string }> = {
  reasoning: { tag: '模型推理', color: 'purple' },
  section: { tag: '章节进展', color: 'geekblue' },
  system: { tag: '中间件', color: 'default' }
};

export default function StepLoading({ stage, progress, message, thinkingTrail }: StepLoadingProps) {
  const cur = ORDER[stage];
  const trail = thinkingTrail ?? [];
  return (
    <div className="step-loading">
      <Progress percent={progress} status={stage === 'error' ? 'exception' : 'active'} />
      {STEPS.map((s, i) => {
        const done = cur > i;
        const active = cur === i;
        return (
          <div className="step-row" key={s.key}>
            <div className={`step-dot ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              {done ? '✓' : i + 1}
            </div>
            <div className={`step-text ${active ? 'active' : ''}`}>
              {s.label}
              {active && message ? ` · ${message}` : ''}
            </div>
          </div>
        );
      })}

      {trail.length > 0 ? (
        <div className="cot-trail">
          <div className="cot-trail-title">真实后端调用思维链</div>
          {trail.map((e, idx) => (
            <div key={idx} className="cot-trail-item">
              <Tag color={KIND_LABEL[e.kind].color} bordered={false} className="cot-trail-tag">
                {KIND_LABEL[e.kind].tag}
              </Tag>
              <span className="cot-trail-text">{e.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div className="skeleton-block" style={{ height: 14, width: '70%', marginBottom: 8 }} />
          <div className="skeleton-block" style={{ height: 14, width: '90%', marginBottom: 8 }} />
          <div className="skeleton-block" style={{ height: 14, width: '60%' }} />
        </div>
      )}
    </div>
  );
}
