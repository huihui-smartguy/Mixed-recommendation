import { useEffect, useState } from 'react';
import { Button, Input, Select, Space, Tag, Tooltip, App } from 'antd';
import { PlayCircleOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { useReportStore } from '@/stores/useReportStore';
import { fetchProfiles } from '@/services/api';
import type { UserProfile } from '@/types';
import { checkBannedWords } from '@/utils/compliance';

const PRESET_TAGS = ['稳健保值', '股债平衡', '高股息', '海外配置', '科技成长', '黄金避险', '抗通胀'];

export default function ProfileWizard() {
  const { form, setForm, task, startGeneration, cancelGeneration } = useReportStore();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const { message } = App.useApp();

  useEffect(() => {
    fetchProfiles().then(setProfiles);
  }, []);

  const profile = profiles.find((p) => p.id === form.selectedProfileId);
  const generating = task.stage !== 'idle' && task.stage !== 'done' && task.stage !== 'error';

  const trigger = () => {
    if (!profile) {
      message.warning('请先选择一位客户画像');
      return;
    }
    if (form.intent.trim()) {
      const verdict = checkBannedWords(form.intent);
      if (!verdict.ok) {
        message.error(`本地风控拦截：检测到敏感词「${verdict.hits.join('、')}」`);
        return;
      }
    }
    void startGeneration(profile);
  };

  return (
    <div className="card card-pad">
      <h3 className="card-title">① 客户画像 & 意图输入</h3>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>选择客户</div>
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
          <div className="muted" style={{ marginBottom: 6 }}>偏好标签（可多选）</div>
          <div>
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
                  style={{ marginBottom: 6 }}
                >
                  {tag}
                </Tag.CheckableTag>
              );
            })}
          </div>
        </div>

        <div>
          <div className="muted" style={{ marginBottom: 6 }}>
            自然语言意图（可选）
            <Tooltip title="输入意图回车直接触发，等同点击下方按钮">
              <span style={{ marginLeft: 6 }}>ⓘ</span>
            </Tooltip>
          </div>
          <Input.TextArea
            rows={2}
            placeholder="例如：生成张总下半年的稳健型配置报告"
            value={form.intent}
            onChange={(e) => setForm({ intent: e.target.value })}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                trigger();
              }
            }}
            disabled={generating}
          />
        </div>

        <Space>
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
          {form.intent && !generating && (
            <Button icon={<SendOutlined />} onClick={trigger}>
              按意图生成
            </Button>
          )}
        </Space>
      </Space>
    </div>
  );
}
