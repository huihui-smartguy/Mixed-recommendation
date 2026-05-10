import { IdcardOutlined, SafetyOutlined, WalletOutlined, UserOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import type { ReportPayload } from '@/types';

interface Props {
  payload: ReportPayload;
  /** 选填：从 useProfileStore 拿到的 profile，用于补齐姓名 / uid */
  customerName?: string;
  uid?: string;
  riskLevel?: string;
}

const RISK_COLORS: Record<string, string> = {
  R1: 'default',
  R2: 'cyan',
  R3: 'blue',
  R4: 'orange',
  R5: 'red'
};

/**
 * 报告顶部"客户速览"封面条 ——把生成的报告包装成更视觉化的金融报告体验。
 * 取代 markdown 里那张"客户画像"小表格的入口角色，让关键数据一眼可见。
 */
export default function ClientHeroStrip({ payload, customerName, uid, riskLevel }: Props) {
  const aumWan = payload.profileSummary?.match(/(\d+(\.\d+)?)\s*万/)?.[1];
  const generatedAt = new Date(payload.generatedAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  return (
    <div className="report-hero">
      <div className="report-hero-title">
        <span className="report-hero-badge">
          <SafetyOutlined /> 私人银行级
        </span>
        <h1>{payload.title}</h1>
        <span className="report-hero-meta">{generatedAt}</span>
      </div>
      <div className="report-hero-grid">
        <div className="hero-cell">
          <UserOutlined className="hero-cell-icon" />
          <div>
            <div className="hero-cell-label">客户</div>
            <div className="hero-cell-value">{customerName ?? '客户'}</div>
          </div>
        </div>
        <div className="hero-cell">
          <IdcardOutlined className="hero-cell-icon" />
          <div>
            <div className="hero-cell-label">UID</div>
            <div className="hero-cell-value mono">{uid ?? '—'}</div>
          </div>
        </div>
        {aumWan && (
          <div className="hero-cell">
            <WalletOutlined className="hero-cell-icon" />
            <div>
              <div className="hero-cell-label">在管资产</div>
              <div className="hero-cell-value">{aumWan} 万元</div>
            </div>
          </div>
        )}
        {riskLevel && (
          <div className="hero-cell">
            <SafetyOutlined className="hero-cell-icon" />
            <div>
              <div className="hero-cell-label">风险等级</div>
              <Tag color={RISK_COLORS[riskLevel] ?? 'default'}>{riskLevel}</Tag>
            </div>
          </div>
        )}
        <div className="hero-cell hero-cell-tag">
          <Tag color="blue-inverse">报告编号 {payload.taskId}</Tag>
        </div>
      </div>
    </div>
  );
}
