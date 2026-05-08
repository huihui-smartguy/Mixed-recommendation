# 智能资产配置工作台 · Mixed-Recommendation

基于 [DesignDocuments.md](./DesignDocuments.md) 落地的双模推荐前端工作台 (V1.0)：

- **生成式推荐**：异步长报告任务、Step-Loading、Markdown + ECharts + 表格混合渲染、PDF 导出 / 链接分享。
- **交互式推荐**：Mock SSE 流式输出、Chain-of-Thought 折叠面板、动态产品微卡片、推荐方案对比抽屉。
- **页面级 Keep-Alive**：双 Tab 始终挂载，切换时报告进度与对话上下文不丢失。
- **合规红线**：水印背景、不可隐藏的免责条幅、违禁词本地拦截、PII 脱敏（手机号 / 身份证 / 卡号）。

## 技术栈

- React 18 + TypeScript
- Vite 5
- Zustand（轻量状态，满足高频流式更新）
- Ant Design v5 + ECharts (`echarts-for-react`)
- react-markdown + remark-gfm

## 启动

```bash
pnpm install   # 或 npm install
pnpm dev       # http://localhost:5173
pnpm build
pnpm typecheck
```

## 目录结构

```
src/
├─ components/
│  ├─ layout/         GlobalHeader、KeepAlive
│  ├─ generative/     ProfileWizard、StepLoading、ReportViewer、AllocationPieChart、BacktestLineChart
│  └─ interactive/    ChatWorkspace、ChatBubble、ThinkingAccordion、FundCard、CompareDrawer、Sparkline
├─ services/          mockApi.ts（含报告任务进度 + Mock SSE 流）, mockData.ts
├─ stores/            useReportStore.ts、useChatStore.ts
├─ types/             领域模型与流式协议契约
├─ utils/             compliance.ts（违禁词 / PII 脱敏 / 免责文案）, format.ts
└─ styles/global.css  含金融语义化色板（红涨绿跌）、安全区适配、骨架屏动画
```

## 接口契约（与设计文档一致）

### 生成式（异步轮询 / 任务化）

- `GET /api/v1/users/profiles`
- `GET /api/v1/onerec/adapter/products?userId=...`
- `POST /api/v1/report/generate` → `{ taskId }`
- `GET /api/v1/report/status?taskId=...` → `{ stage, progress, payload? }`

`mockApi.generateReportTask` 通过回调下发阶段进度，等价于前端轮询。

### 交互式（SSE 流）

`POST /api/v1/chat/completions` → `text/event-stream`

```
data: {"type":"thinking","content":"..."}
data: {"type":"text","content":"..."}
data: {"type":"widget","widgetName":"FundCard","data":{...}}
```

`mockApi.streamChatCompletion` 使用 async generator 模拟该协议；store 层负责按事件类型增量合并到当前消息。

## 关键设计点对照

| 文档要求 | 落地位置 |
| --- | --- |
| 双页签 + 页面级 Keep-Alive | `App.tsx` + `components/layout/KeepAlive.tsx` |
| Step-Loading | `components/generative/StepLoading.tsx` |
| Markdown + ECharts + 表格 | `ReportViewer.tsx` + `AllocationPieChart` + `BacktestLineChart` |
| 流式打字机 + 思考链 | `ChatBubble.tsx` 中 `cursor` 类、`ThinkingAccordion.tsx` |
| Generative UI 微卡片 | `FundCard.tsx`（含 Sparkline、展开/收起、加入对比） |
| 对比台 | `CompareDrawer.tsx`（雷达图 + 多维表格） |
| 红涨绿跌语义色 | `styles/global.css` `--color-up/--color-down`、`utils/format.ts:classOfChange` |
| 防遮挡 + 安全区 | `env(safe-area-inset-*)`、`chat-input-area` 吸底 |
| 防幻觉 | 推荐数据来源 `mockProductPool`，与"onerec 适配后候选池"一一对应 |
| PII 脱敏 | `utils/compliance.ts:maskPII`，发送前调用 |
| 违禁词阻断 | `checkBannedWords` 在表单与对话两处前置拦截 |
| 不可隐藏水印 | `app-watermark` 固定层 + 报告底部贴片免责条 |

## 后续接入真实后端

1. 将 `services/mockApi.ts` 中的函数替换为 `axios` / `fetch + SSE` 实现，保持函数签名不变。
2. `useReportStore.startGeneration` 替换为「POST 提交 → 轮询 status」两段式调用。
3. `streamChatCompletion` 改为 `fetch` + `ReadableStream` 解析 `text/event-stream`，按行分割并 JSON 反序列化。
