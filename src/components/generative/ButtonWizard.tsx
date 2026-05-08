import { useEffect, useState } from 'react';
import { App, Button, Select, Space, Tag } from 'antd';
import { AppstoreOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import { useReportStore } from '@/stores/useReportStore';
import { fetchProfiles } from '@/services/api';
import type { UserProfile } from '@/types';

const PRESET_TAGS = ['稳健保值', '股债平衡', '高股息', '海外配置', '科技成长', '黄金避险', '抗通胀'];

/**
 * 按钮触发卡 — 结构化向导（用户选择 → 偏好勾选 → 点按钮）。
 *
 * 与 ConversationTrigger 并列，承担确定性更强的传统操作流。
 */
export default function ButtonWizard() {
  const { form, setForm, task, startGeneration, cancelGeneration } = useReportStore();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const { message } = App.useApp();

  useEffect(() => {
    fetchProfiles().then(setProfiles).catch(() => undefined);
  }, []);

  const profile = profiles.find((p) => p.id === form.selectedProfileId);
  const generating = task.stage !== 'idle' && task.stage !== 'done' && task.stage !== 'error';

  const trigger = () => {
    if (!profile) {
      message.warning('请先选择一位客户画像');
      return;
    }
    void startGeneration(profile);
  };

  return (
    <div className="card card-pad trigger-card trigger-button">
      <h3 className="card-title">
        <AppstoreOutlined /> 按钮触发 · 向导式
      </h3>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>① 选择客户</div>
          <Select
            style={{ width: '100%' }}
            placeholder="选择客户画像"
            value={form.selectedProfileId}
            onChange={(v) => setForm({ selectedProfileId: v })}
            options={profiles.map((p) => ({
              value: p.id,
              label: `${p.displayName} · ${p.riskLevel} · 在管 ${(p.aum / 10000).toFixed(0)}万`
            }))}
          />
        </div>

        <div>
          <div className="muted" style={{ marginBottom: 6 }}>② 偏好标签（可多选）</div>
          <Space size={[6, 6]} wrap>
            {PRESET_TAGS.map((tag) => {
              const active = form.preferenceTags.includes(tag);
              return (
                <Tag.CheckableTag
                  key={tag}
                  checked={active}
                  onChange={(checked) =>
                    setForm({
                      preferenceTags: checked
                        ? [...form.preferenceTags, tag]
                        : form.preferenceTags.filter((t) => t !== tag)
                    })
                  }
                >
                  {tag}
                </Tag.CheckableTag>
              );
            })}
          </Space>
        </div>

        <div className="muted">③ 点击按钮生成报告</div>
        <Space size={8}>
          {!generating && (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={trigger}>
              生成资产配置报告
            </Button>
          )}
          {generating && (
            <Button danger icon={<StopOutlined />} onClick={cancelGeneration}>
              取消生成
            </Button>
          )}
        </Space>
      </Space>
    </div>
  );
}
