import { Dropdown, Switch, Tag, Tooltip, type MenuProps } from 'antd';
import {
  BgColorsOutlined,
  CheckOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  UserOutlined
} from '@ant-design/icons';
import { THEMES, useUIPrefsStore, type ThemeKey } from '@/stores/useUIPrefsStore';

const THEME_KEYS: ThemeKey[] = ['warm', 'green', 'blue', 'gray'];

export default function GlobalHeader() {
  const { theme, setTheme, robotVisible, setRobotVisible } = useUIPrefsStore();

  const themeMenu: MenuProps['items'] = THEME_KEYS.map((key) => ({
    key,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: THEMES[key].colorPrimary,
            border: '1px solid rgba(0,0,0,0.08)'
          }}
        />
        <span style={{ flex: 1 }}>{THEMES[key].label}</span>
        {theme === key ? <CheckOutlined style={{ color: THEMES[key].colorPrimary }} /> : null}
      </span>
    ),
    onClick: () => setTheme(key)
  }));

  return (
    <header className="global-header">
      <div className="brand">
        <span className="brand-mark">D·R</span>
        <span>DeepRec+ · 深度推荐系统</span>
        <Tag color="blue-inverse" style={{ marginLeft: 8, fontWeight: 500 }}>
          V1.2
        </Tag>
      </div>
      <div className="spacer" />
      <div className="meta">
        <Tooltip title="切换品牌主题色（浅绿 / 天蓝 / 浅灰 / 暖橙），保存到本地">
          <Dropdown menu={{ items: themeMenu }} placement="bottomRight" trigger={['click']}>
            <span className="header-btn" role="button">
              <BgColorsOutlined /> 主题：{THEMES[theme].label}
            </span>
          </Dropdown>
        </Tooltip>

        <Tooltip title={robotVisible ? '关闭浮动 AI 助手' : '打开浮动 AI 助手'}>
          <span className="header-btn" role="group">
            <RobotOutlined />
            <span style={{ margin: '0 6px' }}>AI 助手</span>
            <Switch
              size="small"
              checked={robotVisible}
              onChange={setRobotVisible}
            />
          </span>
        </Tooltip>

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
