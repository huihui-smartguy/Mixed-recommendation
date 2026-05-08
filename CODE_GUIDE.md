# 智能资产配置工作台 · 代码导览 (CODE GUIDE)

> 配套文档：`DesignDocuments.md` (产品 / 架构需求)、`README.md` (启动与对照表)。
> 本文目标：让任何接手开发者在 30 分钟内完整理解仓库的每一层代码、为什么这么写、改动应该改哪里。

---

## 0. 阅读地图

| 想了解 … | 直接跳到 |
| --- | --- |
| 一行命令把项目跑起来 | [§1 工程入口](#1-工程入口与启动) |
| 双 Tab 工作台为什么状态切换不丢失 | [§5.1 layout/KeepAlive](#51-componentslayoutkeepalivetsx) |
| 报告生成的 5 步进度怎么驱动 | [§4.2 报告任务时序](#42-报告任务时序生成式) + [§5.2 ReportWorkspace](#52-生成式工作台) |
| SSE 流式打字机底层怎么收数据 | [§3.1 sseParser](#31-servicessseparserts) |
| 怎么对接真实后端 / 灰度切流 | [§7 真实后端接入指南](#7-真实后端接入指南) |
| 单元测试为什么覆盖到 97% | [§6 测试策略](#6-测试策略与覆盖率) |
| 哪些地方在做合规拦截 | [§8 合规与防幻觉红线](#8-合规与防幻觉红线) |

---

## 1. 工程入口与启动

```
pnpm install            # 装依赖 (含 vitest / jsdom / @types/node / cross-env)
pnpm dev                # 生产模式：调真实 LLM/onerec；缺凭证→脚本化降级
pnpm copy               # 全 mock 模式：完全本地虚拟后端
pnpm typecheck          # tsc --noEmit
pnpm test               # 70 用例
pnpm test:coverage      # 含 80% 行/语句/函数 + 75% 分支门槛
pnpm build              # 产线构建
```

两个 npm 脚本通过 `cross-env WORKBENCH_MODE=...` 区分；`vite.config.ts` 在 Node 启动阶段读取该环境变量，挑选挂载的 backend 插件（`prodBackendPlugin` 或 `mockBackendPlugin`）。Vite 启动时会打印模式横幅，方便确认。

### 关键配置文件

| 文件 | 作用 |
| --- | --- |
| `package.json` | 脚本与依赖矩阵；前端走 React 18 + AntD v5 + ECharts，测试走 Vitest |
| `tsconfig.json` | `strict + noUnused` 全开；`@/*` → `src/*` 路径别名；`types: vite/client + node + vitest/globals` |
| `vite.config.ts` | 注入 `mockBackendPlugin()`；`manualChunks` 把 React/AntD/ECharts 拆成独立 chunk 防大块产物拖慢首屏 |
| `vitest.config.ts` | jsdom 环境；覆盖率 include 显式列举关键模块；阈值固化 80% / 75% |
| `index.html` | `viewport-fit=cover` 让 `env(safe-area-inset)` 生效；`theme-color` 与 Header 主色一致 |

---

## 2. 整体目录结构

```
mock-data/
├─ onerec/products.json      onerec 调试数据（snake_case 原始字段，含 _comment / _schema）
└─ llm/chat-cases.json       浮动机器人对话用例（含 followup / trailing_rec）

src/
├─ main.tsx                  应用启动；ConfigProvider 注入暖色主题
├─ App.tsx                   双 Tab + 全局水印 + 合规页脚 + FloatingRobot
├─ types/index.ts            领域模型；ChatChunk 含 followup / trailing_rec 类型
├─ utils/
│  ├─ compliance.ts          PII 脱敏 + 违禁词检测 + 免责文案
│  └─ format.ts              金融数字格式化
├─ services/
│  ├─ sseParser.ts           text/event-stream 解析
│  ├─ onerecAdapter.ts       onerec 防腐层 + 防幻觉守卫
│  ├─ api.ts                 fetch 真实客户端（REST + SSE，含新事件类型）
│  └─ mockData.ts            画像演示数据（被两套中间件共享）
├─ server/
│  ├─ devMockMiddleware.ts   pnpm copy 的全 mock 后端（任务化轮询 + 脚本化 SSE）
│  └─ prodMiddleware.ts      pnpm dev 的生产后端：先打真接口，缺凭证降级
├─ llm/
│  ├─ client.ts              LLM 抽象客户端（Anthropic / OpenAI 兼容）
│  └─ prompts/
│     ├─ system.ts           财富顾问人设 + SSE 输出协议 + 防幻觉硬约束
│     ├─ chat.ts             chat user prompt 构造（注入 onerec 候选池）
│     └─ report.ts           报告 user prompt + 默认大类资产权重
├─ stores/                   useChatStore.ts（含 followup / trailing_rec 处理）、useReportStore.ts
├─ components/
│  ├─ layout/                GlobalHeader、KeepAlive
│  ├─ generative/            ConversationTrigger、ButtonWizard（双触发拆分）、
│  │                         ReportWorkspace、StepLoading、ReportViewer、
│  │                         AllocationPieChart、BacktestLineChart
│  ├─ interactive/           ChatWorkspace、ChatBubble、ThinkingAccordion、
│  │                         FundCard、CompareDrawer、Sparkline
│  └─ floating/              FloatingRobot（三态：closed → mini → open）
├─ styles/global.css         暖色令牌（橙/红/米）+ 响应式 + 浮动机器人样式
└─ __tests__/                70 个 Vitest 用例
```

### 分层依赖关系

```
┌────────────────────────────────────────────────────────┐
│ components/    UI（不直接调 API，只读 store / props）   │
├────────────────────────────────────────────────────────┤
│ stores/        编排（持有 AbortController、合并 chunk） │
├────────────────────────────────────────────────────────┤
│ services/api.ts → sseParser.ts / onerecAdapter.ts       │
├────────────────────────────────────────────────────────┤
│ HTTP / SSE  ←→  server/devMockMiddleware.ts (dev only)  │
└────────────────────────────────────────────────────────┘
```

依赖单向向下；`utils/` 与 `types/` 是叶子层，任何层都可以引用。`components` 不直接 `fetch`、`stores` 不直接渲染 — 这是后续接真后端时唯一需要替换 `services/` 的前提。

---

## 3. 服务层 (`services/`)

### 3.1 `services/sseParser.ts`

W3C **EventSource** 协议子集解析器，独立成纯函数模块以便单元测试与跨运行时复用。

**对外形态**

```ts
interface SSEEvent<T> { event; id?; retry?; data: T; raw: string }

createSSEState(): { buffer: '' }
pushSSEChunk(state, chunk): SSEEvent[]                  // 纯函数，可重复增量推入
readSSEStream<T>(response, signal): AsyncGenerator<...> // 高层包装
```

**实现要点**

1. **缓冲区**：网络层切片不可控，事件以 `\n\n` 为终止符。`pushSSEChunk` 先把 chunk 拼到 `state.buffer`，再循环 `indexOf('\n\n')` 把完整事件切下来；尾部不完整字节天然留在 buffer 等下一片。
2. **`\r\n` 兼容**：进入 buffer 前统一 `replace(/\r\n?/g, '\n')`，后续逻辑只处理 LF。
3. **字段解析**（`parseEventBlock`）：
   - 以 `:` 分割 field / value；规范要求冒号后第一个空格属于分隔符要跳过 (`line[colonIdx+1] === ' '`)
   - 支持 `event:` `id:` `retry:`，多个 `data:` 行用 `\n` 拼接
   - 行首 `:` 整行忽略（heart-beat / keepalive）
   - 没有 `data:` 的事件直接丢弃
4. **JSON 优先 + 字符串回退**：`try { JSON.parse(raw) } catch { raw }`。这样后端临时换协议或注释行不至于让前端崩溃。
5. **`readSSEStream`** 用 `Response.body.getReader()` + `TextDecoder` 流式解码；末尾兜一次 `pushSSEChunk(state, '\n\n')` 把没带 trailing `\n\n` 的最后事件也吐出来；`finally` 内 `reader.cancel()` 确保连接释放。

**为什么不用浏览器自带 EventSource？**
EventSource 不能 POST 也不能传自定义 header（`Accept`/`Authorization` 全要靠 query 重写），与设计文档 §3.3 的 `POST /api/v1/chat/completions` 契约不符。`fetch + ReadableStream` 是当前 LLM 流式接口的事实标准，且方便附带 `AbortController`。

### 3.2 `services/onerecAdapter.ts` — Anti-Corruption Layer

设计文档 §2.2.2 要求的"防腐层"，对 `onerec` 任意脏数据做归一：

```ts
normalizeOnerecResponse(raw): Product[]
gateProductCodes(poolCodes, candidates, onDrop?): string[]
toFiniteNumber(v, fallback): number
```

**清洗规则**

| 规则 | 实现 |
| --- | --- |
| 必备字段缺失即丢弃 | `code` 与 `name` 任一为空就 `continue` |
| 字段命名兼容 | 同时接受 `code`/`product_code`、`netValue`/`net_value` 等 snake/camel |
| 数值兜底 | `toFiniteNumber` 接受 `number` / 含 `%`/`,` 的字符串；NaN/Infinity/null 走 fallback |
| sparkline 长度规整 | 短于 4 用首值补齐，长于 64 等距下采样 — 对应虚拟列表性能要求 |
| 重复 code 去重 | `Set<string> seen`，保留首条 |
| reason 兜底 | 缺失时回填 `"由 onerec 召回的候选资产"`，避免 UI 出现空气泡 |

**`gateProductCodes` — 防幻觉守卫**

设计文档 §5.1 提到 "大模型最终输出的资产代码必须严格存在于 onerec 召回池中"。`gateProductCodes(pool, candidates, onDrop)` 用 `Set<string>` 求交集，被丢弃的代码通过 `onDrop` 上报，便于服务端打 alarm。

> 当前代码在前端定义，是为了 dev/测试环境与文档对齐；生产环境应当在后端 LLM 出口处再调用一次同样的逻辑。

### 3.3 `services/api.ts` — 真实后端客户端

封装文档定义的全部接口；`AbortController` 全链路透传。

| 函数 | 接口 | 备注 |
| --- | --- | --- |
| `fetchProfiles()` | `GET /users/profiles` | 直接 JSON |
| `fetchOnerecCandidates(userId)` | `GET /onerec/adapter/products?userId=…` | **必经** `normalizeOnerecResponse` 清洗 |
| `submitReport(profileId, tags, intent)` | `POST /report/generate` | 返回 `{ taskId }` |
| `fetchReportStatus(taskId)` | `GET /report/status?taskId=…` | 单次拉取 |
| `pollReportUntilDone(taskId, onProgress, signal)` | 自循环 | 每 600ms 拉一次，直到 `done` 或 `error`，含 60s 超时 |
| `chatStream(prompt, signal)` | `POST /chat/completions` (SSE) | 走 `readSSEStream`，过滤 `done` 事件、丢弃 `data` 不是对象的脏数据 |

**通用增强**

- `API_BASE` 通过 `import.meta.env.VITE_API_BASE` 注入，未配置回落 `/api/v1` — 让 dev / staging / 生产可以共用一份打包产物。
- `ApiError` 携带 status，方便上层区分网络错误与业务异常。
- `sleep(ms, signal)` 实现可中断的轮询间歇 — `signal.abort()` 会同时清掉 setTimeout 并 reject。
- `AbortError` 全部用 `DOMException('aborted', 'AbortError')`，保证 `(err as DOMException).name === 'AbortError'` 这种判断在浏览器与 jsdom 都成立。

### 3.4 `services/mockData.ts`

仅用于 dev 中间件填充示意数据：3 个客户画像 (C3 / C4 / C5)、6 个产品（覆盖宽基、纯债、行业主题、QDII、商品、红利策略）。生产部署时不会被引用 — `import` 链只通过 `server/devMockMiddleware.ts`，而该文件不在生产 bundle 里。

---

## 4. 服务端中间件 — 双模式

### 4.0 总览

`vite.config.ts` 在 Node 启动阶段读 `process.env.WORKBENCH_MODE`：

```
WORKBENCH_MODE=production (pnpm dev)  →  prodBackendPlugin()
WORKBENCH_MODE=mock       (pnpm copy) →  mockBackendPlugin()
```

两套中间件挂的路由完全相同 (`/api/v1/users/profiles`、`/api/v1/onerec/...`、`/api/v1/report/{generate,status}`、`/api/v1/chat/completions`)，前端零感知。区别仅在数据来源：

| 路由 | mock (pnpm copy) | prod (pnpm dev) |
| --- | --- | --- |
| profiles | 内存常量 | 内存常量（同源；可换 DB） |
| onerec | 静态选择候选池 | 优先 `ONEREC_BASE_URL`，失败回退 `mock-data/onerec/products.json` |
| report | 阶段定时器 + 脚本拼 markdown | 阶段定时器 + 真实 LLM 撰写 markdown；缺 `LLM_API_KEY` 用兜底文案 |
| chat | 脚本化 SSE | 真实 LLM 流；缺 `LLM_API_KEY` 按 prompt 关键词命中 `chat-cases.json` 回放 |

### 4.1 prodMiddleware (`server/prodMiddleware.ts`)

生产模式核心。设计原则：**任何配置项缺失都不阻塞 demo**。

- **onerec 接口预留**：`fetchOnerec(userId)` 先尝试 `${ONEREC_BASE_URL}/products?userId=...`；非 2xx 或 throw 时打 warn 并 fallback 到本地 JSON。结果一律经 `normalizeOnerecResponse` 清洗。
- **LLM 客户端**：服务端通过 `readLLMConfig()` 读环境变量，调用 `streamLLM()` 异步生成器逐 token 累积。两种 provider：
  - `anthropic`: POST `/v1/messages`，`x-api-key` + `anthropic-version` 头
  - `openai-compatible`: POST `/chat/completions`，`Authorization: Bearer` 头
  - SSE 行解析 ([DONE] 终止符兼容)
- **chat SSE 转发**：LLM 输出按 `\n\n` 切块，每块尝试 JSON parse；parse 失败则当作 `text` 段，保证客户端流式始终可用。
- **报告任务**：`POST /report/generate` 立即返回 taskId，后台异步跑 `buildReportPayload`（包含 LLM 调用）；前端轮询 status 时根据已过时间在 STAGE_TIMINGS 中对位返回阶段。
- **缓存**：`mock-data/` 下两份 JSON 在首次读取时缓存到内存，重启 dev 进程清掉。

### 4.2 devMockMiddleware (`server/devMockMiddleware.ts`)

老版 mock 后端，接 `pnpm copy`，便于无网络 / 无密钥环境演示：
- 前端 dev 环境也走真 fetch + 真 SSE，而不是直接读内存
- 前端代码无需 mock/prod 双分支
- 单元测试可以独立 stub `global.fetch`
- 联调时可以用 curl/Postman 直接打中间件验证协议

### 4.1 路由表

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/v1/users/profiles` | 返回 `mockProfiles` |
| GET | `/api/v1/onerec/adapter/products?userId=` | 不同画像不同的优先级（C3 优先债券，C4 平衡，C5 偏权益）|
| POST | `/api/v1/report/generate` | 写入 `tasks` 内存 Map，返回 `{ taskId }` |
| GET | `/api/v1/report/status?taskId=` | 根据 `Date.now() - startedAt` 推算当前阶段，到尾段才生成完整 payload |
| POST | `/api/v1/chat/completions` | 写出 SSE：thinking ×4 → text 逐字节 → widget ×N → done |

### 4.2 报告任务时序（生成式）

`STAGE_TIMINGS` 是阶段定义；`reportStatus(t)` 用累加 `delay` 与已过时间比对计算当前阶段：

```
queued     0ms ─ 200ms      progress  8%
profiling  200ms ─ 900ms    progress 22%
recall     900ms ─ 1700ms   progress 45%
writing    1700ms ─ 2800ms  progress 72%
rendering  2800ms ─ 3500ms  progress 92%
done       ≥3500ms          progress 100%   ← 此时 lazy 构造 payload (markdown + 配置 + 回测)
```

> 实际后端会用 BullMQ/RabbitMQ 把任务推到 worker，状态变更走 Redis；前端轮询接口形态保持一致。

### 4.3 SSE 写出（交互式）

```ts
function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}
```

发送顺序严格匹配文档 §3.3：
1. `thinking` × 4 步（每步 350ms 的"思考停顿"）
2. `text` 逐字节（`for (const ch of intro)`，每 16ms 一字节，模拟打字机）
3. `widget` × N（每 240ms 一张产品卡）
4. `text` 收尾免责
5. `done` (sentinel)

`res.on('close', () => aborted = true)` 监听客户端断开，发现就提前 return — 真实后端要把这条信号 forward 给上游 LLM 调用方，避免无效计费。

`X-Accel-Buffering: no` 头是为了告诉 nginx 不要缓冲该流，否则会一次性聚合后才下发，毁掉打字机效果。

---

## 5. 状态层与 UI

### 5.1 `components/layout/KeepAlive.tsx`

设计文档强约束 "切换页签时报告进度与对话状态不能丢失"。React Router 默认会卸载非激活路由 → 状态清零。这里用 CSS `display: none` 切换，组件常驻挂载：

```tsx
return <div style={{ display: active ? 'block' : 'none' }}>{children}</div>;
```

副作用、定时器、SSE 连接、Zustand store 全部不被打断。代价是首屏会同时渲染两个 Tab；但因为 Tab 数固定且都是单页面，开销可接受。

### 5.2 生成式工作台（V1.1 拆分）

```
ReportWorkspace
├─ trigger-grid                                         <- 顶部双卡并列
│  ├─ ConversationTrigger    自然语言意图 + Quick Intent chip
│  └─ ButtonWizard           客户选择 + 偏好标签 + 三步向导按钮
└─ ReportViewer (全宽)
   ├─ StepLoading            5 步进度 + 骨架屏
   └─ Markdown + ECharts 区   报告完成后渲染
```

**为什么拆**：原本 `ProfileWizard` 把"对话"与"按钮"两条交互路径塞在一张卡里，业务方反馈不够清晰。拆分后：
- `ConversationTrigger` 强调对话感（暖橙渐变 + `CommentOutlined` 图标 + 顶部突出 Quick Intent chip）
- `ButtonWizard` 强调结构化（暖红渐变 + 三步编号 ① 选客户 / ② 偏好 / ③ 点按钮）

两者共享同一个 `useReportStore.form` —— 在对话框输入意图后切到按钮卡，已选客户与标签都还在；都通过 `startGeneration(profile)` 进入同一条任务流。

**Step-Loading**：`StepLoading.tsx` 把 `ReportStage` 枚举映射到固定 5 步；当前阶段加 `active` 类名（蓝色光圈），已完成阶段加 `done` 类名（绿色 ✓）。底部三条骨架屏 (`@keyframes shimmer`) 缓解空白感。

**Markdown + 图表**：报告主体由后端返回 markdown，ECharts 通过 `payload.allocations` / `payload.backtest` 单独驱动 — 前端不解析 markdown 里的图表占位，避免后端 markdown 写错形成白屏。

**导出**：`exportPdf()` 借浏览器原生打印（`window.print`），CSS 端可补打印媒体查询隐藏非必要元素。生产环境推荐换成服务端 PDF（puppeteer / weasyprint），文档里也明确写了。

### 5.3 交互式助手 (主 Tab)

```
ChatWorkspace
├─ chat-stream
│  └─ ChatBubble × N
│     ├─ ThinkingAccordion       折叠面板呈现 CoT 思考链
│     ├─ bubble (text + cursor)  打字机 + 末尾 ▍闪烁
│     ├─ FundCard × N            产品微卡片（Sparkline + 加入对比）
│     ├─ trailing-rec            尾随推荐组（"您可能还感兴趣"）
│     └─ followup                智能追问 chip（点击直接回填输入框）
├─ compare-bar                   已选产品悬浮条（吸底）
├─ chat-input-area
│  ├─ Alert (违禁词命中)
│  ├─ prompt-chips (快捷提问)
│  └─ compose (textarea + 发送/停止)
└─ CompareDrawer                 雷达图 + 多维表格
```

### 5.4 浮动机器人 "小颂" (`components/floating/FloatingRobot.tsx`)

类 AI 涨乐 / 支付宝小助手，全局常驻在右下角。**与主 Tab 的对话台共享 `useChatStore`**——切到生成式 Tab 也能继续问机器人。

三态切换：

```
   closed ──[click]──▶ mini ──[click chip / 展开]──▶ open
     ▲                    │                            │
     └─────[X 关闭]───────┴────[X 关闭] / [- 最小化]─┘
```

| 态 | 视觉 | 行为 |
| --- | --- | --- |
| `closed` | 56px 圆形 FAB（橙红渐变 + pulse 动画） | 点击 → mini |
| `mini` | 280px 招呼气泡 + 头像 + 3 个建议 chip | 点击 chip 直接发送并切到 open；展开链接也切 open |
| `open` | 380×560px 完整对话面板，复用 `ChatBubble` | 与主 Tab 同步消息，支持 followup 直接回填输入框 |

**为什么不复用 `ChatWorkspace`**：浮动面板尺寸、bubble 字号、输入区都更紧凑，但消息流复用同一个 store 保证一致性。

### 5.5 ChatBubble 新事件渲染

新增两类 chunk 类型在 `ChatBubble.tsx` 内分支处理：

```ts
if (c.type === 'trailing_rec' && c.products) {
  // 渲染暖橙虚线框 + 标题 + 多张 FundCard
}
if (c.type === 'followup' && c.suggestions) {
  // 渲染 BulbOutlined + chip 数组；onChange → onFollowupPick(s)
}
```

`onFollowupPick` prop 由父组件 (`ChatWorkspace` / `FloatingRobot`) 传入，决定追问点击后是回填输入框还是直接发送，两端体验保持自然。

**`ChatBubble.tsx` 的合并策略**：

```ts
const thinking: string[] = [];
const visible: ChatChunk[] = [];
for (const c of message.chunks) {
  if (c.type === 'thinking') thinking.push(c.content);
  else visible.push(c);
}
```

设计上 `thinking` 始终聚合到一个折叠卡片，`text` 与 `widget` 维持原顺序展示。打字机光标 (`cursor` className) 只挂在 **最后一个 text chunk**：

```ts
const lastTextIdx = [...visible].map(c => c.type).lastIndexOf('text');
isLast && message.streaming  // 只有正在流式中且本段是最后一个文本时才显示 ▍
```

**`FundCard.tsx`**：纯展示组件 + 局部 `useState(open)` 控制详情展开。`Sparkline.tsx` 是手写 SVG（`polyline` + 线性映射），避免为了 96×32 的小图加载整个 ECharts 实例。

**`CompareDrawer.tsx`**：从右侧滑出抽屉，雷达图 5 维 (近 1 年 / 近 3 年 / 夏普 / 抗回撤 / 稳定性)。"抗回撤"维度用 `50 + maxDrawdown` 反向归一（回撤 -10% → 40 分，回撤 -50% → 0 分），让"越大越好"语义在雷达图上一致。

### 5.4 store 设计：`useChatStore` 与 `useReportStore`

两个 Zustand store 都遵循相同模式：

1. **`AbortController` 持有在 store 内**（`abortRef`），任何时候 `cancel()` 都能强制中断流式或轮询；切换上下文先 `abortRef?.abort()` 再开新 controller。
2. **AbortError 与业务 error 区分**：
   ```ts
   const aborted = (err as DOMException)?.name === 'AbortError'
                || (err as Error)?.message === 'aborted';
   ```
   只有非 abort 才把 stage 推到 `error`，避免用户主动取消反而看到失败提示。
3. **流式合并优化**（`useChatStore.send`）：
   - `appendText` 检查最后一段是不是 `text`；是则就地拼接（不产生新 chunk），保证 React 重渲染最少；
   - `appendChunk` 用于 `thinking` / `widget`，每个事件都是一段独立 chunk。
4. **本地合规闸门**：
   - `checkBannedWords` 命中即返回，不进入流式分支，不消耗 LLM token；
   - `maskPII` 把用户输入清洗后才落到消息流和接口请求里 — `userMsg.chunks[0].content` 与 `chatStream(masked)` 用的是同一份 `masked`，确保 UI 显示与后端看到的一致。

### 5.6 全局样式 (`styles/global.css`)

**V1.1 暖色系切换**：

```css
--color-primary: #f97316;       /* 暖橙 */
--color-primary-dark: #ea580c;
--color-accent: #ef4444;        /* 强调橙红 */
--bg-app: linear-gradient(180deg, #fff7ed 0%, #fff4e6 30%, #fff7ed 100%);
--bg-header: linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%);
```

**金融语义色保持不动**：

**金融语义化色板**（设计令牌通过 CSS 变量发布）：

```css
--color-up: #d93333;     /* 红涨 */
--color-down: #0aa66e;   /* 绿跌 */
--color-flat: #86909c;
```

`numeric` 类应用 `font-variant-numeric: tabular-nums` 强制等宽数字，符合"金融数字强制等宽对齐"。

**水印背景**：`.app-watermark::after` 用 `repeating-linear-gradient` 画底纹格，再用 `transform: rotate(-22deg)` 倾斜。`pointer-events: none` 不影响交互，`position: fixed; inset: 0` 全屏；`z-index: 1` 让正文 (`.workspace { z-index: 2 }`) 在它之上。**用户无法通过 DevTools 在 React 树里把它隐藏**，因为它根本不是 React 组件，而是 root 下的兄弟元素。

**安全区适配**：

```css
:root { --safe-bottom: env(safe-area-inset-bottom, 0px); }
.chat-input-area { padding-bottom: calc(12px + var(--safe-bottom)); }
.global-header   { padding-top:    calc(var(--safe-top) + 12px); }
```

iPhone 刘海与底部黑条直接拿到正确边距，不会被遮挡。

---

## 6. 测试策略与覆盖率

### 6.1 文件 → 用例对照

| 测试文件 | 用例数 | 覆盖目标 |
| --- | ---: | --- |
| `sseParser.test.ts` | 14 | 单事件 / 多事件 / 跨片续传 / 多行 data / event+id+retry / 注释行 / 无 data 的事件被丢弃 / 非 JSON 回退 / `\r\n` 兼容 / 冒号无空格 / 流读取 / 中途分片 / 末尾无空行 flush / no-body 异常 |
| `onerecAdapter.test.ts` | 13 | `toFiniteNumber` 三类输入 / 非数组返回 [] / 必备字段缺失丢弃 / snake+camel 双兼容 / 去重 / sparkline 补齐 / 抽样 / 默认 reason / `gateProductCodes` 三态 |
| `api.test.ts` | 8 | profiles GET / onerec 经过 adapter / 非 2xx 抛 ApiError / submitReport 体校验 / 轮询直到 done / taskId URL 编码 / SSE chunk 分类 / 流 5xx 抛错 |
| `chatStore.test.ts` | 9 | 违禁词阻断 / clearBannedHits / 流式合并 / PII 脱敏 / toggleCompare 加减 + 上限 4 / 异常追加道歉 / Abort 不追加 / 空输入忽略 / reset 回到 seed |
| `reportStore.test.ts` | 5 | setForm 局部更新 / 完整 queued→done 时序 / poll 异常落入 error / AbortError 回 idle / cancelGeneration 触发 abort |
| `compliance.test.ts` | 9 | 单 / 多违禁词 / 无误伤 / 18 位身份证 / 11 位手机号 / 16-19 位卡号 / 短数字保留 / DISCLAIMER 字符段 |
| `format.test.ts` | 10 | 正负零三态百分比 / 自定义位数 / 万亿单位切换 / `classOfChange` 阈值边界 |

### 6.2 覆盖率（最近一次本地）

| 模块 | Stmts | Branch | Funcs | Lines |
| --- | ---: | ---: | ---: | ---: |
| `services/api.ts` | 94.4% | 73.5% | 91.7% | 94.4% |
| `services/onerecAdapter.ts` | 97.4% | 96.4% | 100% | 97.4% |
| `services/sseParser.ts` | 95.7% | 82.1% | 100% | 95.7% |
| `stores/useChatStore.ts` | 97.5% | 95.9% | 90% | 97.5% |
| `stores/useReportStore.ts` | 100% | 94.4% | 100% | 100% |
| `utils/compliance.ts` | 100% | 100% | 100% | 100% |
| `utils/format.ts` | 100% | 100% | 100% | 100% |
| **All** | **97.0%** | **90.0%** | **95.0%** | **97.0%** |

`vitest.config.ts` 的 `thresholds` 强制 lines/statements/functions ≥ 80%、branches ≥ 75%，CI 任一项跌破就失败。

### 6.3 测试技巧

1. **stub `fetch` 而不是 mock 整个 api 模块**（`api.test.ts`）：用 `vi.stubGlobal('fetch', fetchMock)` 直接拦截网络层，被测函数走真实代码路径，覆盖率最大化。
2. **构造 SSE 响应**（`sseParser.test.ts`）：用 `ReadableStream` 在测试里手工 `enqueue` chunk，验证跨片续传、末尾 flush、无 body 异常。
3. **store 的两种隔离策略**：
   - `chatStore.test.ts` 用 `vi.mock('@/services/api', ...)` 注入脚本化 generator，可测产品线 happy/error/abort 三态；
   - `reportStore.test.ts` 把模块级 `submitMock` / `pollMock` 暴露出来，每个用例单独 `mockResolvedValueOnce` / `mockRejectedValueOnce`，断言阶段流转。
4. **isolate setState**：每个用例 `beforeEach(() => store.setState(initial))`，避免 Zustand 单例污染。

---

## 7. 真实后端接入指南

### 7.1 灰度切流

`services/api.ts` 通过 `VITE_API_BASE` 环境变量决定接口前缀：

| 环境 | `VITE_API_BASE` | 行为 |
| --- | --- | --- |
| dev (默认) | `/api/v1` | 命中 `mockBackendPlugin` |
| staging | `https://api-staging.example.com/v1` | 直连 staging 后端 |
| prod | 由部署 nginx 代理统一 `/api/v1` | 纯路径，无跨域 |

切流不需要改任何前端代码，重新构建即可。

### 7.2 接入 checklist

1. **后端实现 §3.3 接口契约**（profiles / onerec / report 任务化 / chat SSE）。
2. **响应头**：
   - REST → `Content-Type: application/json`
   - SSE → `Content-Type: text/event-stream; charset=utf-8`、`Cache-Control: no-cache, no-transform`、`X-Accel-Buffering: no`
3. **`onerec` 真实接口**：保证字段名稳定即可；`onerecAdapter` 已经容忍 snake/camel 与脏数值。
4. **PII 脱敏边界**：前端已经在 `useChatStore.send` 内做了第一道；后端进入 LLM 前再做一次（双保险）。
5. **防幻觉**：后端把 onerec 召回 code 集合 + LLM 输出引用 code 做交集，引入与 `gateProductCodes` 同样语义。
6. **熔断**：`pollReportUntilDone` 内置 60s 总超时；后端任务最长建议同步设到 ≤ 50s，留余量给客户端。
7. **鉴权**：在 `services/api.ts` 的 `getJSON` / `postJSON` / `chatStream` 三个 fetch 调用里统一加 `Authorization: Bearer <token>` 头即可；建议从 store 或 React context 读 token，不写到代码常量。

### 7.3 性能与稳定性建议

- **首字 (TTFB) 控制**：后端 SSE handler 启动后立即 `flushHeaders()` + 写一个 `:keepalive\n\n` 注释行，浏览器即可建立连接计时；前端解析器已经会忽略注释行。
- **大 payload chunking**：报告 markdown 较长时建议后端分多次写 stream（前端 `pollReportUntilDone` → `payload` 拼好后再下发）。
- **取消计费**：`res.on('close')` 监听到客户端断开时，后端必须 cancel 上游 LLM 调用，避免 `AbortController` 失效产生空账单。

---

## 8. 合规与防幻觉红线

| 红线 | 落地位置 |
| --- | --- |
| AI 内容必须带免责声明 | `app-watermark` 全屏背景 + `report-disclaimer` 报告底部贴片，DOM 不在 React 树内不可被业务代码隐藏 |
| 历史业绩不代表未来 | `utils/compliance.ts:DISCLAIMER` 单一来源，被 ReportViewer / App 共享 |
| PII 不出网 | `maskPII` 在 `useChatStore.send` 入口先洗，洗完才落到消息流 + 上行 fetch；测试覆盖三类场景 |
| 违禁词本地阻断 | `checkBannedWords` 在 `ProfileWizard.trigger` + `useChatStore.send` 双拦截；命中即不消耗后端算力 |
| 大模型不能虚构资产 | `gateProductCodes` (前端 + 后端双调用)；后端最终输出 code 必须在 `onerecAdapter` 召回池内 |

---

## 9. 设计取舍 & 可优化方向

### 已落地的取舍

- **Zustand 而非 Redux**：流式打字机每秒会触发几十次 setState，Zustand 直接 `set((s) => ...)` 不走 reducer 中间件链，性能/代码量都最优。
- **手写 SVG Sparkline 而非 ECharts**：96×32 的小图避免引入 ECharts 实例可以省掉数十 KB 主线程开销，且没有 Canvas 销毁/重建问题。
- **CSS `display:none` Keep-Alive 而非 React-Router**：组件常驻才能保住 Zustand AbortController + setTimeout 状态。代价是首屏多渲染一个 Tab，但都是单页面，可接受。
- **`ConfigProvider` 主题 hack**：把 AntD 的 `colorSuccess` 设成红色、`colorError` 设成绿色，复用 AntD 内部所有"成功/失败"色到金融"涨/跌"语义；少量边缘组件（如 Result）需要单独覆写。

### 可继续打磨的点

1. **虚拟列表**：当前 `chat-stream` 直接 `.map`，几百轮对话后会 OOM。可接 `react-virtuoso` / 自实现 `IntersectionObserver` 销毁 ECharts canvas。
2. **报告 Schema-Driven UI**：现在 markdown + JSON 是双轨；可改成纯 schema 让后端约束更强，前端更稳定。
3. **PDF 服务端化**：`window.print` 体验受浏览器差异影响，建议接 `pdf.example.com/generate?taskId=…`。
4. **持久化对话**：当前 `useChatStore` 是会话内内存；可接 IndexedDB + `zustand/middleware` 实现刷新不丢。
5. **可观测性**：在 `api.ts` 各调用点接入 Sentry / OpenTelemetry，特别是 SSE 断线重连指标。
6. **i18n**：当前文案中文硬编码。多机构客制化场景可抽到 `locales/`。
7. **E2E 与组件测试**：当前以单元测试为主，可加 Playwright 跑双 Tab 切换 / SSE 完整链路。

---

## 10. 索引：常见任务 → 改哪里

| 我想 … | 直接改 |
| --- | --- |
| 加一个新的客户画像 | `services/mockData.ts:mockProfiles`（dev）/ 真后端 |
| 新增产品字段 | `types/index.ts:Product` + `onerecAdapter.ts:normalizeOnerecResponse` + `FundCard.tsx` |
| 加一个 Prompt 模板 | 现在前端只发 `prompt`，模板在后端；前端只需在 `PROMPT_CHIPS` 加入展示 |
| 调整流式打字速度 | `server/devMockMiddleware.ts:streamChatResponse` 内的 `setTimeout(r, 16)` |
| 调报告阶段名 / 进度 | `StepLoading.tsx:STEPS`（仅展示） + `devMockMiddleware.ts:STAGE_TIMINGS`（dev 后端）|
| 加新的合规违禁词 | `utils/compliance.ts:BANNED_WORDS` |
| 加新的 PII 规则 | `utils/compliance.ts:maskPII` 增加 `replace` 链 |
| 改主题/品牌色 | `main.tsx:ConfigProvider.theme.token` + `styles/global.css` 的 CSS 变量 |
| 把数据接到真后端 | 配置 `VITE_API_BASE` + 让 `mockBackendPlugin` 在生产 build 自动失活（已是 dev-only 插件） |

---

完。如需对某一模块深入展开（性能 profiling、SSE 协议扩展、Schema-Driven UI 演进路径等），可在此基础上派生专题文档。
