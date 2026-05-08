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
pnpm dev       # http://localhost:5173 — 内嵌 Mock 后端中间件（SSE + 任务轮询）
pnpm build
pnpm typecheck
pnpm test          # 运行 Vitest
pnpm test:coverage # 含 80% 覆盖率门槛
```

## 目录结构

```
src/
├─ components/
│  ├─ layout/         GlobalHeader、KeepAlive
│  ├─ generative/     ProfileWizard、StepLoading、ReportViewer、AllocationPieChart、BacktestLineChart
│  └─ interactive/    ChatWorkspace、ChatBubble、ThinkingAccordion、FundCard、CompareDrawer、Sparkline
├─ services/
│  ├─ api.ts          fetch + SSE 真实客户端（profiles / onerec / report 轮询 / chat 流）
│  ├─ sseParser.ts    标准 text/event-stream 解析器（纯函数 + 流读取）
│  ├─ onerecAdapter.ts onerec 防腐层：字段归一、数值兜底、sparkline 长度规整、产品代码守卫
│  └─ mockData.ts     画像与候选池演示数据
├─ server/
│  └─ devMockMiddleware.ts  Vite 插件：把 /api/v1/* 接成"真后端"（SSE + 任务化）
├─ stores/            useReportStore.ts、useChatStore.ts
├─ types/             领域模型与流式协议契约
├─ utils/             compliance.ts（违禁词 / PII 脱敏 / 免责文案）, format.ts
├─ __tests__/         Vitest 单测：sseParser/onerecAdapter/api/compliance/format/chatStore/reportStore
└─ styles/global.css  含金融语义化色板（红涨绿跌）、安全区适配、骨架屏动画
```

## 测试与覆盖率

```bash
pnpm test:coverage
```

最近一次运行：68 用例全绿，关键模块覆盖率：

| 模块 | Stmts | Branch | Funcs | Lines |
| --- | ---: | ---: | ---: | ---: |
| services/api.ts | 94.4% | 73.5% | 91.7% | 94.4% |
| services/onerecAdapter.ts | 97.4% | 96.4% | 100% | 97.4% |
| services/sseParser.ts | 95.7% | 82.1% | 100% | 95.7% |
| stores/useChatStore.ts | 97.5% | 95.9% | 90% | 97.5% |
| stores/useReportStore.ts | 100% | 94.4% | 100% | 100% |
| utils/compliance.ts | 100% | 100% | 100% | 100% |
| utils/format.ts | 100% | 100% | 100% | 100% |
| **All** | **97.0%** | **90.0%** | **95.0%** | **97.0%** |

vitest.config.ts 中已固化 ≥80% 行/语句/函数 与 ≥75% 分支门槛，CI 不达标即 fail。

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

data: {"type":"done"}
```

落地分两层：

1. **真实后端客户端** (`services/api.ts`) 用 `fetch` 拿到 `Response.body` 后，交由
   `services/sseParser.ts` 的 `readSSEStream<T>(response, signal)` 异步生成器解析。
   `pushSSEChunk` / `createSSEState` 是纯函数，单测覆盖：跨包延续、`\r\n` 兼容、
   多行 `data:` 拼接、注释行忽略、JSON 反序列化失败回退原始字符串。
2. **Mock 后端** (`server/devMockMiddleware.ts`) 作为 Vite 插件挂在 `/api/v1/*`：
   - 报告 API 完整模拟"任务化 + 轮询"流程
   - 对话 API 真实写出 SSE chunk（`thinking → text 逐字节 → widget → done`）

切换到生产真后端只需在部署时让反向代理把 `/api/v1/*` 转到真实服务。
若需自定义域名，可设置 `VITE_API_BASE` 环境变量覆盖前缀。

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
