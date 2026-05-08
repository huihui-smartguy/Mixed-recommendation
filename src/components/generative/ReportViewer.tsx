import { useRef } from 'react';
import { Button, Empty, Space, Tag, App } from 'antd';
import { DownloadOutlined, ShareAltOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReportPayload, ReportStage } from '@/types';
import StepLoading from './StepLoading';
import AllocationPieChart from './AllocationPieChart';
import BacktestLineChart from './BacktestLineChart';
import { DISCLAIMER } from '@/utils/compliance';

interface ReportViewerProps {
  stage: ReportStage;
  progress: number;
  message: string;
  payload?: ReportPayload;
}

export default function ReportViewer({ stage, progress, message, payload }: ReportViewerProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { message: msg } = App.useApp();

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
        <StepLoading stage={stage} progress={progress} message={message} />
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
      <Space style={{ float: 'right' }}>
        <Button icon={<DownloadOutlined />} onClick={exportPdf}>
          导出 PDF
        </Button>
        <Button icon={<ShareAltOutlined />} onClick={share}>
          分享
        </Button>
      </Space>

      <Tag color="blue">{payload.taskId}</Tag>
      <span className="muted" style={{ marginLeft: 8 }}>
        {new Date(payload.generatedAt).toLocaleString('zh-CN')}
      </span>

      <ReactMarkdown remarkPlugins={[remarkGfm]}>{payload.markdown}</ReactMarkdown>

      <h2>七、大类资产权重可视化</h2>
      <AllocationPieChart allocations={payload.allocations} />

      <h2>八、近三年回测对比</h2>
      <BacktestLineChart
        dates={payload.backtest.dates}
        portfolio={payload.backtest.portfolio}
        benchmark={payload.backtest.benchmark}
      />

      <div className="report-disclaimer">⚠ {DISCLAIMER}</div>
    </div>
  );
}
