# 智能资产配置工作台 · Mixed-Recommendation

基于 [DesignDocuments.md](./DesignDocuments.md) 落地的双模推荐前端工作台 (V1.1，暖色系)：

- **双运行模式**
  - `pnpm dev` —— **生产模式**，对接真实 LLM 与 onerec；缺凭证时自动降级到脚本化 mock 数据
  - `pnpm copy` —— **全 mock 模式**，本地完整虚拟后端，离线可用
- **生成式推荐**：异步长报告任务、Step-Loading、Markdown + ECharts + 表格混合渲染、PDF 导出 / 链接分享
  - 触发拆分为两张并列卡：**对话区**（自然语言意图） + **按钮区**（向导式表单）
- **交互式推荐**：真实 SSE 流式输出（thinking / text / widget / followup / trailing_rec）
  - 主 Tab 提供完整对话台 + 全局 **浮动机器人 "小颂"**（类 AI 涨乐 / 支付宝小助手）
  - 气泡内可渲染 **尾随推荐**（额外的产品卡组）与 **智能追问**（点击直接回填输入框）
- **页面级 Keep-Alive**：双 Tab 始终挂载，切换时报告进度与对话上下文不丢失
- **合规红线**：水印背景、不可隐藏的免责条幅、违禁词本地拦截、PII 脱敏（手机号 / 身份证 / 卡号）
- **暖色 UI**：橙红主色调 + 米色背景 + 渐变 Header，金融"红涨绿跌"语义色保持不动

## 技术栈

- React 18 + TypeScript
- Vite 5
- Zustand（轻量状态，满足高频流式更新）
- Ant Design v5 + ECharts (`echarts-for-react`)
- react-markdown + remark-gfm

## 环境准备

### 前置要求

| 工具 | 推荐版本 | 实测验证版本 | 用途 |
| --- | --- | --- | --- |
| Node.js | ≥ 18.18 LTS（建议 20 或 22） | 22.22 | Vite / TypeScript / 测试运行时 |
| pnpm | **10.x（≤ 10.x，不要 11.x）** | **10.13.1** | 包管理 |
| Git | 任意 | — | 拉代码 |

> ⚠ **不要用 pnpm 11.x**。pnpm 11 强制要求 Node ≥ 22.13；多数 macOS 开发机仍在 Node 20，会触发 `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`。本仓库已通过 `package.json` 的 `packageManager` 字段把 pnpm 钉死在 10.13.1。

快速自检：

```bash
node -v   # 期望 v18.18+/v20.x/v22.x
pnpm -v   # 期望 10.x；若打印 11.x 请按下方"排错"修复
```

### 服务器/本机缺少 pnpm？按场景选一种

#### A · 已有 Node.js 18+：用 Corepack（**最推荐**）

Corepack 是 Node.js 16.10+ 自带的包管理调度器，无需额外网络下载二进制。**进到本仓库目录后，corepack 会自动读取 `package.json` 的 `packageManager: "pnpm@10.13.1"` 字段，下载并切换到该版本**——你不需要手动 prepare。

```bash
corepack enable          # 一次性开启（macOS / Linux 不一定需要 sudo）
cd Mixed-recommendation
pnpm -v                  # 首次运行会自动拉 pnpm@10.13.1，再次运行就快了
```

如果你的机器上 corepack 老版本不识别 `packageManager` 字段（少见），手动 pin 一次：

```bash
corepack prepare pnpm@10.13.1 --activate
```

> 不要写成 `pnpm@latest`——它会被解析成最新主版本，今天可能就是 11.x。

#### B · 没有 Node.js / 版本太低：先装 Node 再走 Corepack

**推荐 · nvm（用户态、不污染系统、Linux/macOS 通用）**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# 或 wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc          # macOS 默认 zsh；bash 用户改 ~/.bashrc

nvm install 20           # 装 Node 20 LTS（与 pnpm 10.x 完全兼容）
nvm use 20
corepack enable && corepack prepare pnpm@10.13.1 --activate
```

**macOS · Homebrew**

```bash
# 方案 1（推荐）：brew + corepack 走 packageManager 字段
brew install node@20            # 或 node@22
corepack enable
cd Mixed-recommendation && pnpm -v   # 触发自动拉取 pnpm@10.13.1

# 方案 2：直接装 pnpm，绕过 corepack
brew install pnpm@10            # 注意指定 @10，避免被 brew 升到 11.x
```

> macOS 上同时存在多个 Node（system / brew / nvm）时，请用 `which node` 确认指向；优先 nvm 管理。

**Linux · 系统包管理（需要 root）**

```bash
# Debian / Ubuntu — NodeSource 官方源
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# RHEL / CentOS / Rocky / Alma
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
sudo dnf install -y nodejs    # CentOS 7 用 yum

# Alpine
sudo apk add nodejs npm

corepack enable && corepack prepare pnpm@10.13.1 --activate
```

#### C · 不想动 Node：直接安装独立 pnpm

```bash
# 官方安装脚本（Linux / macOS 通用，会装 pnpm 最新版 — 注意可能是 11.x）
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=10.13.1 sh -
# 安装完成后按提示 source ~/.zshrc 或 ~/.bashrc

# 或通过 npm 安装（需要先有 Node 与 npm）
npm install -g pnpm@10

# macOS Homebrew
brew install pnpm@10
```

#### D · 受限内网 / 离线服务器

1. **走公司内网镜像**：
   ```bash
   pnpm config set registry https://npm.your-corp.com/
   # 或社区镜像：https://registry.npmmirror.com/
   ```
2. **完全离线**：在能联网的同架构机器上 `pnpm fetch` 把依赖拉成 store，再用 `pnpm install --offline`；或者打成 Docker 镜像分发：
   ```dockerfile
   FROM node:20-alpine
   RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
   WORKDIR /app
   COPY package.json pnpm-lock.yaml ./
   RUN pnpm install --frozen-lockfile
   COPY . .
   RUN pnpm build
   ```
3. **免管理员**：把 pnpm 单文件二进制放到 `~/bin`：
   ```bash
   mkdir -p ~/bin
   # Linux x64
   curl -fL -o ~/bin/pnpm \
     https://github.com/pnpm/pnpm/releases/download/v10.13.1/pnpm-linuxstatic-x64
   # macOS Apple Silicon → pnpm-macos-arm64；Intel → pnpm-macos-x64
   chmod +x ~/bin/pnpm
   export PATH="$HOME/bin:$PATH"   # 加到 ~/.zshrc / ~/.bashrc 持久化
   ```

### 实在不想用 pnpm？

`package.json` 没有 pnpm-only 字段，npm / yarn 都能跑。仅注意：

- 若改用 npm，请删除 `pnpm-lock.yaml` 并提交 `package-lock.json`；
- 若改用 yarn 4+，先 `corepack prepare yarn@stable --activate`。

但 CI 与 lockfile 管理建议保持 pnpm 一致。

### 排错

#### 1) macOS 报 `ERR_UNKNOWN_BUILTIN_MODULE: No such built-in module: node:sqlite`

完整错误特征：

```
warn: This version of pnpm requires at least Node.js v22.13
warn: The current version of Node.js is v20.x.x
Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite
    at .../corepack/v1/pnpm/11.0.8/dist/pnpm.mjs ...
```

**根因**：以前执行过 `corepack prepare pnpm@latest --activate`，corepack 把 pnpm 11.0.8 写入 `~/.cache/node/corepack`；而 pnpm 11 的 store 索引模块依赖 Node 22.13+ 才有的 `node:sqlite` 内置模块，你本机 Node 20 自然没有。

**修复（任选一个）：**

```bash
# 修复 1（推荐，不需要升级 Node）：把 pnpm 降到 10.x
corepack prepare pnpm@10.13.1 --activate
pnpm -v   # 应输出 10.13.1

# 修复 2：升级 Node 到 22 LTS（pnpm 11 才能跑）
nvm install 22 && nvm use 22
# 然后 packageManager 字段会自动起作用，无需手动指定 pnpm 版本

# 修复 3：清理 corepack 缓存，让 packageManager 字段托管
rm -rf ~/.cache/node/corepack
corepack enable
cd Mixed-recommendation && pnpm install   # 自动按 packageManager 字段拉取
```

进到本仓库 `cd Mixed-recommendation` 后只要 corepack 正确启用，`packageManager: "pnpm@10.13.1"` 字段会替你做兜底。

#### 2) 其他常见问题

| 现象 | 处理 |
| --- | --- |
| `corepack: command not found` | Node 版本低于 16.10；按方案 B 升级 |
| `Unsupported engine ... required: { node: '>=18.18' }` | `nvm install 20 && nvm use 20` |
| `EACCES: permission denied` 装全局 npm 包 | 不要用 sudo；走 nvm 或方案 D 的 `~/bin` |
| 安装慢 / 卡在 fetch | 切镜像：`pnpm config set registry https://registry.npmmirror.com/` |
| `ERR_PNPM_FETCH_404` 私有包 | 检查 `.npmrc` 是否漏配私有 registry 或 token |
| Apple Silicon 装 esbuild 失败 | 升级 pnpm ≥ 10，或 `arch -arm64 pnpm install` |
| 修改 `packageManager` 后想强制更新 | `corepack prepare --activate` 不带版本号会读 `package.json` |

---

## 启动

```bash
pnpm install
pnpm dev           # 生产模式：对接真实 LLM/onerec；缺凭证自动降级到脚本化用例
pnpm copy          # 全 mock 模式：完全本地虚拟后端（离线可用）
pnpm build
pnpm typecheck
pnpm test          # 70 个 Vitest 用例
pnpm test:coverage # ≥80% 行/语句/函数覆盖率门槛
```

> Vite 启动时会打印当前模式横幅：
>
> - `[Workbench] WORKBENCH_MODE = production (pnpm dev)`
> - `[Workbench] WORKBENCH_MODE = mock (pnpm copy)`

### 配置真实 LLM 与 onerec（生产模式）

复制示例文件再按需填写：

```bash
cp .env.example .env
# .env 已被 .gitignore，不会进版本库
```

支持的环境变量（仅服务端可见，浏览器拿不到）：

| 变量 | 说明 |
| --- | --- |
| `LLM_PROVIDER` | `anthropic`（默认）/ `openai-compatible` |
| `LLM_BASE_URL` | API 端点；可指向 DeepSeek / Qwen / Moonshot / 智谱等兼容协议 |
| `LLM_MODEL` | 模型名（默认 `claude-sonnet-4-6` 或 `gpt-4o-mini`） |
| `LLM_API_KEY` | 密钥；缺失时降级为脚本化用例 |
| `LLM_TEMPERATURE` / `LLM_MAX_TOKENS` | 生成参数 |
| `ONEREC_BASE_URL` | onerec 推荐引擎地址；缺失时读 `mock-data/onerec/products.json` |
| `DEFAULT_USER_ID` | 交互式对话默认拉取的客户画像 ID |

**Prompt 模板** 已放开在 `src/llm/prompts/`，无需重启即可改文案：

| 文件 | 用途 |
| --- | --- |
| `src/llm/prompts/system.ts` | 财富顾问系统人设 + SSE 输出协议 + 防幻觉硬约束 |
| `src/llm/prompts/chat.ts` | 交互式对话 user prompt（注入 onerec 候选池） |
| `src/llm/prompts/report.ts` | 生成式报告 user prompt + 默认大类资产权重 |

### 调试用 Mock 数据文件

| 文件 | 何时被使用 |
| --- | --- |
| `mock-data/onerec/products.json` | 生产模式且未配 `ONEREC_BASE_URL`，或调真实接口失败时回退 |
| `mock-data/llm/chat-cases.json` | 生产模式且未配 `LLM_API_KEY`，按 prompt 关键词匹配 case 回放 |

数据格式与字段说明都在 JSON 文件 `_comment` / `_schema` 里。修改文件后**首次请求**会重新读取（中间件做了缓存，重启 dev 进程即可清掉）。

## 目录结构

```
mock-data/
├─ onerec/products.json     onerec 调试数据（snake_case 原始字段）
└─ llm/chat-cases.json      浮动机器人对话用例（含 followup / trailing_rec）

src/
├─ components/
│  ├─ layout/                GlobalHeader、KeepAlive
│  ├─ generative/            ConversationTrigger、ButtonWizard（双触发拆分）、
│  │                         ReportWorkspace、StepLoading、ReportViewer、
│  │                         AllocationPieChart、BacktestLineChart
│  ├─ interactive/           ChatWorkspace、ChatBubble、ThinkingAccordion、
│  │                         FundCard、CompareDrawer、Sparkline
│  └─ floating/              FloatingRobot（浮动机器人三态：closed/mini/open）
├─ services/
│  ├─ api.ts                 fetch + SSE 客户端（profiles / onerec / report / chat）
│  ├─ sseParser.ts           标准 text/event-stream 解析器（纯函数 + 流读取）
│  ├─ onerecAdapter.ts       onerec 防腐层
│  └─ mockData.ts            演示用画像数据
├─ server/
│  ├─ devMockMiddleware.ts   pnpm copy 的全 mock 后端
│  └─ prodMiddleware.ts      pnpm dev 的生产后端：调真实 LLM/onerec，缺凭证降级
├─ llm/
│  ├─ client.ts              LLM 抽象客户端（Anthropic / OpenAI 兼容协议）
│  └─ prompts/
│     ├─ system.ts           系统人设 + SSE 协议
│     ├─ chat.ts             交互式对话 prompt 构造器
│     └─ report.ts           报告生成 prompt + 默认大类资产权重
├─ stores/                   useReportStore.ts、useChatStore.ts
├─ types/                    领域模型与流式协议契约（含新增 followup / trailing_rec）
├─ utils/                    compliance.ts、format.ts
├─ __tests__/                70 个 Vitest 用例
└─ styles/global.css         暖色设计令牌（橙/红/米）+ 浮动机器人样式
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
