import { useEffect, useState } from 'react';
import { App, Button, Input, Space, Tag } from 'antd';
import { CommentOutlined, SendOutlined } from '@ant-design/icons';
import { useReportStore } from '@/stores/useReportStore';
import { fetchProfiles } from '@/services/api';
import type { UserProfile } from '@/types';
import { checkBannedWords } from '@/utils/compliance';

const QUICK_INTENTS = [
  '生成张总下半年的稳健型配置报告',
  '帮王女士重做一份股债平衡组合',
  '为李总设计一份海外科技进取组合'
];

/**
 * 对话触发卡 — 自然语言意图直接生成报告。
 *
 * 与 ButtonWizard 并列使用，分别承担"自然语言"与"结构化向导"两条路径。
 */
export default function ConversationTrigger() {
  const { form, setForm, task, startGeneration } = useReportStore();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const { message } = App.useApp();

  useEffect(() => {
    fetchProfiles().then(setProfiles).catch(() => undefined);
  }, []);

  const generating = task.stage !== 'idle' && task.stage !== 'done' && task.stage !== 'error';

  const trigger = () => {
    if (!form.intent.trim()) {
      message.warning('请输入您的自然语言意图');
      return;
    }
    const verdict = checkBannedWords(form.intent);
    if (!verdict.ok) {
      message.error(`本地风控拦截：检测到敏感词「${verdict.hits.join('、')}」`);
      return;
    }
    // 优先使用已选画像；未选时取第一个
    const profile = profiles.find((p) => p.id === form.selectedProfileId) ?? profiles[0];
    if (!profile) {
      message.warning('未拉到客户画像');
      return;
    }
    if (!form.selectedProfileId) setForm({ selectedProfileId: profile.id });
    void startGeneration(profile);
  };

  return (
    <div className="card card-pad trigger-card trigger-conversation">
      <h3 className="card-title">
        <CommentOutlined /> 对话触发 · 自然语言意图
      </h3>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Input.TextArea
          rows={3}
          placeholder="例如：生成张总下半年的稳健型配置报告。回车直接生成。"
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
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>常用意图</div>
          <Space size={[6, 6]} wrap>
            {QUICK_INTENTS.map((q) => (
              <Tag.CheckableTag
                key={q}
                checked={form.intent === q}
                onChange={() => setForm({ intent: q })}
              >
                {q}
              </Tag.CheckableTag>
            ))}
          </Space>
        </div>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={trigger}
          loading={generating && !form.intent}
          disabled={generating}
          block
        >
          按意图生成报告
        </Button>
      </Space>
    </div>
  );
}
