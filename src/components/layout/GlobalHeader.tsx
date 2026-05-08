import { Tag, Tooltip } from 'antd';
import { SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';

export default function GlobalHeader() {
  return (
    <header className="global-header">
      <div className="brand">
        <span className="brand-mark">M·R</span>
        <span>智能资产配置工作台</span>
        <Tag color="blue-inverse" style={{ marginLeft: 8, fontWeight: 500 }}>
          Mixed-Recommendation V1.0
        </Tag>
      </div>
      <div className="spacer" />
      <div className="meta">
        <Tooltip title="所有上下文均经 PII 脱敏后再投喂大模型">
          <span>
            <SafetyCertificateOutlined /> PII 脱敏 · 已启用
          </span>
        </Tooltip>
        <span>
          <UserOutlined /> 理财师 · 王经理
        </span>
      </div>
    </header>
  );
}
