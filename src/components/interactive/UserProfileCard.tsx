import { useEffect } from 'react';
import { Select, Space, Tag, Tooltip } from 'antd';
import { CloudUploadOutlined, IdcardOutlined } from '@ant-design/icons';
import { useProfileStore } from '@/stores/useProfileStore';

const RISK_COLORS: Record<string, string> = {
  C1: 'default',
  C2: 'cyan',
  C3: 'blue',
  C4: 'orange',
  C5: 'red'
};

/**
 * 客户档案卡 —— 交互式推荐工作区的"上下文锚点"。
 *
 * 行为：
 *  · 选择客户后，画像信息会**随每条 chat 提问**通过 POST 体下发给后端
 *  · 后端用 profile.id 调 onerec 拿个性化候选池
 *  · 后端把 profile.{riskLevel, age, aum, preferenceTags} 拼进 LLM prompt
 */
export default function UserProfileCard() {
  const { profiles, activeId, load, setActive } = useProfileStore();
  useEffect(() => {
    void load();
  }, [load]);

  const active = profiles.find((p) => p.id === activeId);

  return (
    <aside className="user-aside" aria-label="客户档案">
      <div className="user-aside-header">
        <IdcardOutlined />
        <span>客户档案</span>
      </div>
      <div className="user-aside-body">
        <Select
          style={{ width: '100%' }}
          placeholder="选择客户档案"
          value={activeId}
          onChange={setActive}
          options={profiles.map((p) => ({
            value: p.id,
            label: `${p.displayName} · ${p.riskLevel}`
          }))}
        />

        {active ? (
          <>
            <div className="user-avatar-row">
              <div className="user-avatar">{active.displayName.replace(/[·\s].*/, '').slice(0, 2)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="user-name" title={active.displayName}>
                  {active.displayName}
                </div>
                <Space size={4}>
                  <Tag color={RISK_COLORS[active.riskLevel] ?? 'default'} bordered={false}>
                    {active.riskLevel}
                  </Tag>
                  <span className="muted">{active.age} 岁</span>
                </Space>
              </div>
            </div>

            <div className="user-stat">
              <label>客户 ID</label>
              <code>{active.id}</code>
            </div>
            <div className="user-stat">
              <label>在管资产</label>
              <strong className="numeric">{(active.aum / 10000).toFixed(0)} 万元</strong>
            </div>
            <div className="user-stat">
              <label>风险等级</label>
              <strong>{active.riskLevel}</strong>
            </div>

            <div className="user-tags">
              <label>偏好标签</label>
              <Space size={[4, 4]} wrap>
                {active.preferenceTags.map((t) => (
                  <Tag key={t} color="processing" bordered={false}>
                    {t}
                  </Tag>
                ))}
              </Space>
            </div>

            <Tooltip title="详见 docs/INTEGRATION_GUIDE.md「客户画像 ↔ 后端」章节">
              <div className="user-aside-hint">
                <CloudUploadOutlined />
                <div>
                  以上画像信息会随每条提问发送给后端：
                  <br />
                  <code>profile.id</code> → onerec 个性化召回
                  <br />
                  <code>riskLevel / aum / age / preferenceTags</code>
                  → 注入 LLM prompt 做风险匹配
                </div>
              </div>
            </Tooltip>
          </>
        ) : (
          <div className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>
            请选择客户档案，画像会用于个性化推荐
          </div>
        )}
      </div>
    </aside>
  );
}
