import { useEffect, useState } from 'react';
import { Select, Space, Tag, Tooltip } from 'antd';
import {
  CloudUploadOutlined,
  IdcardOutlined,
  CaretRightOutlined
} from '@ant-design/icons';
import { useProfileStore } from '@/stores/useProfileStore';

const RISK_COLORS: Record<string, string> = {
  R1: 'default',
  R2: 'cyan',
  R3: 'blue',
  R4: 'orange',
  R5: 'red'
};

/**
 * 客户档案卡 —— 与 onerec 协议字段一一对齐：
 *   · uid           客户唯一 ID
 *   · name          客户真实姓名（前端展示用）
 *   · user_profile  onerec 输入端那段画像描述串（折叠展开）
 *
 * 选中后画像会随每条 chat 提问下发后端：
 *   · profile.uid → onerec sidecar 召回个性化候选池
 *   · profile.user_profile / riskLevel / aum / age / preferenceTags → 注入 LLM prompt
 */
export default function UserProfileCard() {
  const { profiles, activeId, load, setActive } = useProfileStore();
  const [profileExpanded, setProfileExpanded] = useState(false);

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
            label: `${p.name ?? p.displayName} · ${p.riskLevel}`
          }))}
        />

        {active ? (
          <>
            <div className="user-avatar-row">
              <div className="user-avatar">{(active.name ?? active.displayName).slice(0, 1)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="user-name" title={active.name ?? active.displayName}>
                  {active.name ?? active.displayName}
                </div>
                <Space size={4} wrap>
                  <Tag color={RISK_COLORS[active.riskLevel] ?? 'default'} bordered={false}>
                    {active.riskLevel}
                  </Tag>
                  <span className="muted">{active.age} 岁</span>
                </Space>
              </div>
            </div>

            <div className="user-stat">
              <label>UID</label>
              <code title="onerec 协议 uid">{active.uid ?? active.id}</code>
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

            {active.user_profile && (
              <div className="user-profile-block">
                <button
                  type="button"
                  className="user-profile-toggle"
                  onClick={() => setProfileExpanded((v) => !v)}
                  aria-expanded={profileExpanded}
                >
                  <CaretRightOutlined rotate={profileExpanded ? 90 : 0} />
                  <span>onerec user_profile</span>
                  <span className="muted" style={{ marginLeft: 'auto' }}>
                    {profileExpanded ? '收起' : '展开'}
                  </span>
                </button>
                {profileExpanded && (
                  <div className="user-profile-text">{active.user_profile}</div>
                )}
              </div>
            )}

            <Tooltip title="详见 docs/INTEGRATION_GUIDE.md「客户画像 ↔ 后端」章节">
              <div className="user-aside-hint">
                <CloudUploadOutlined />
                <div>
                  以上画像会随每条提问发送后端：
                  <br />
                  <code>uid / user_profile / riskLevel / aum / age / 偏好</code>
                  <br />
                  注入 LLM prompt，让对话与客户风险偏好对齐。
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
