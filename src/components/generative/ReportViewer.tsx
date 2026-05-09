import { useRef } from 'react';
import { Button, Empty, Space, App } from 'antd';
import { DownloadOutlined, ShareAltOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReportPayload, ReportStage, ReportThinkingEntry } from '@/types';
import StepLoading from './StepLoading';
import AllocationPieChart from './AllocationPieChart';
import AllocationBarChart from './AllocationBarChart';
import BacktestLineChart from './BacktestLineChart';
import ClientHeroStrip from './ClientHeroStrip';
import { useProfileStore } from '@/stores/useProfileStore';
import { DISCLAIMER } from '@/utils/compliance';

interface ReportViewerProps {
  stage: ReportStage;
  progress: number;
  message: string;
  payload?: ReportPayload;
  thinkingTrail?: ReportThinkingEntry[];
}

export default function ReportViewer({
  stage,
  progress,
  message,
  payload,
  thinkingTrail
}: ReportViewerProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { message: msg } = App.useApp();

  // 取当前活跃画像，用于在"客户速览"hero 条里展示真实姓名 / uid / 风险等级
  const activeProfile = useProfileStore((s) =>
    s.profiles.find((p) => p.id === s.activeId)
  );

  if (stage === 'idle') {
    return (
      <div className="card card-pad" style={{ minHeight: 320 }}>
        <Empty
          description={
            <div>
              <div>左侧选择客户画像并触发生成</div>
              <div className="muted">支持自然语言意图 / 向导式表单双轨触发</div>
            </div>
          }
        />
      </div>
    );
  }

  if (stage !== 'done' && stage !== 'error') {
    return (
      <div className="card card-pad">
        <h3 className="card-title">报告生成中</h3>
        <StepLoading
          stage={stage}
          progress={progress}
          message={message}
          thinkingTrail={thinkingTrail}
        />
      </div>
    );
  }

  if (stage === 'error' || !payload) {
    return (
      <div className="card card-pad">
        <Empty description="报告生成失败，请重试" />
      </div>
    );
  }

  const exportPdf = () => {
    msg.info('已触发打印导出，浏览器另存为 PDF 即可（生产环境对接服务端 PDF 服务）');
    setTimeout(() => window.print(), 200);
  };

  const share = async () => {
    const link = `${window.location.origin}/share/${payload.taskId}?exp=24h`;
    try {
      await navigator.clipboard.writeText(link);
      msg.success('分享链接已复制到剪贴板（24 小时时效）');
    } catch {
      msg.warning(link);
    }
  };

  return (
    <div className="report-viewer" ref={printRef}>
      <Space style={{ float: 'right', marginBottom: 8 }}>
        <Button icon={<DownloadOutlined />} onClick={exportPdf}>
          导出 PDF
        </Button>
        <Button icon={<ShareAltOutlined />} onClick={share}>
          分享
        </Button>
      </Space>

      <ClientHeroStrip
        payload={payload}
        customerName={activeProfile?.name ?? activeProfile?.displayName}
        uid={activeProfile?.uid ?? activeProfile?.id}
        riskLevel={activeProfile?.riskLevel}
      />

      <div className="report-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{payload.markdown}</ReactMarkdown>
      </div>

      <h2 className="report-section-title">七、大类资产权重可视化</h2>
      <div className="report-charts-2up">
        <div className="report-chart-card">
          <div className="report-chart-card-title">权重比例（环图）</div>
          <AllocationPieChart allocations={payload.allocations} />
        </div>
        <div className="report-chart-card">
          <div className="report-chart-card-title">权重排序（条形图）</div>
          <AllocationBarChart allocations={payload.allocations} title="" />
        </div>
      </div>

      <h2 className="report-section-title">八、近三年回测对比</h2>
      <div className="report-chart-card report-chart-card-wide">
        <BacktestLineChart
          dates={payload.backtest.dates}
          portfolio={payload.backtest.portfolio}
          benchmark={payload.backtest.benchmark}
        />
      </div>

      <div className="report-disclaimer">⚠ {DISCLAIMER}</div>
    </div>
  );
}
