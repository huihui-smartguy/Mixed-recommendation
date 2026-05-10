# DeepRec 接入指南（生成式 + 交互式）

> 面向后端 / 算法 / 联调同学。把"前端能输入什么 → BFF 怎么调 onerec → 怎么喂给 LLM → 怎么返回前端"一次说清，避免反复对齐字段。

> ⚠️ **关键设计**：onerec **只在生成式推荐**链路里使用；交互式推荐**不**调 onerec
> （开放式对话不需要圈定 top-k 候选池）。客户画像 (`profile`) 在两条链路上都会注入
> LLM prompt，让对话/报告与客户风险偏好对齐。

---

## 0. 端到端拓扑

```
┌──────────────────────────────────────────────────────────────────────┐
│  浏览器 (React + Vite, 已构建)                                       │
│   ├ 生成式推荐 Tab  → ReportWorkspace                                │
│   └ 交互式推荐 Tab  → ChatWorkspace                                  │
└──────────────────────────────────────────────────────────────────────┘
                  │  /api/v1/*
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Node BFF (Vite middleware)                                          │
│   src/server/prodMiddleware.ts                                       │
│                                                                      │
│   生成式：fetchOnerec() → buildReportUserPrompt() → streamLLM()      │
│   交互式：mockProductPool (内置)  → buildChatUserPrompt() → streamLLM│
└──────────────────────────────────────────────────────────────────────┘
        │                                          │
        ▼                                          ▼
┌────────────────────────────┐         ┌────────────────────────────┐
│ Python onerec sidecar      │         │ LLM 厂商 (Anthropic /      │
│ backend/onerec_service     │         │  DeepSeek / 通义 / 智谱)   │
│ FastAPI + Pydantic v2      │         │                            │
│  *(仅生成式链路使用)*       │         │                            │
└────────────────────────────┘         └────────────────────────────┘
```

* 所有跨进程调用都是 **HTTP**（onerec sidecar 走 REST，LLM 走各自厂商协议）。
* 浏览器永远只能看到 `/api/v1/*`，不直接接触 onerec / LLM。
* 缺凭证时（`LLM_API_KEY` 未配 / `ONEREC_BASE_URL` 不可达）BFF 会**全链路降级**到脚本化 mock，前端体验保持连贯。

---

## 0.1 5 位 mock 客户（与 docs/customer_sample.md 对齐）

生成式与交互式两条链路**共用**同一份 5 人 mock 池，定义在
[`src/services/mockData.ts`](../src/services/mockData.ts)。前端通过
`fetchProfiles()` 拉取列表，`useProfileStore` 管理 `activeId`。

| uid (Cust_Id) | 姓名 | 风险等级 | 性别 | 年龄 | 学历 | 投资经验 | 总资产 | 综合收益率 | VIP |
|---|---|---|---|---|---|---|---|---|---|
| 1000000001 | 陈建国 | R3 平衡型 | 男 | 43 | 大专 | 1-3年 | 335.20 万 | 5.8% | VIP3 |
| 1000000002 | 苏雅婷 | R4 进取型 | 女 | 46 | 本科 | 10年以上 | 589.30 万 | 2.9% | VIP3 |
| 1000000004 | 李文博 | R2 稳健型 | 男 | 46 | 硕士 | 10年以上 | 138.20 万 | 4.8% | VIP1 |
| 1000000008 | 王志远 | R5 激进型 | 男 | 55 | 本科 | 10年以上 | 1882.90 万 | 5.9% | VIP6 |
| 1000000011 | 周晓菲 | R1 保守型 | 女 | 29 | 本科 | 1-3年 | 98.60 万 | 4.9% | VIP1 |

每位客户带有完整的：
- 持仓六大类金额（`holdings.cash / fixed_income / equity / insurance / alternative / other` 元）
- onerec 输入端 `user_profile` 描述串（由 `src/utils/profilePrompt.ts::buildOnerecUserProfile()` 自动合成）
- onerec `hist_products` sid 序列示例
- 还款方式 / 年收入 / 客户等级（VIP）

新增字段时遵循 [`docs/customer_sample.md`](./customer_sample.md) 的字段命名表，
不要去掉 id/displayName 这些旧字段，保持向后兼容。

---

## 1. 生成式推荐：前端输入

### 1.1 输入字段（前端 → BFF）

接口：`POST /api/v1/report/generate`，请求 body 是一个 JSON 对象：

| 字段 | 类型 | 必填 | 来源（前端组件） | 说明 |
|---|---|---|---|---|
| `profileId` | string | ✅ | `ButtonWizard` 中的 `Select` / `ConversationTrigger` 默认取第一个画像 | 客户 uid（10 位 onerec ID）。例 `"1000000001"` |
| `preferenceTags` | string[] | ❌ | `ButtonWizard` 中的 `Tag.CheckableTag` | 偏好标签，例 `["稳健保值","海外配置"]` |
| `intent` | string | ❌ | `ConversationTrigger` 中的 `<Input.TextArea />` | 自然语言意图，例 `"生成张总下半年的稳健型配置报告"` |

请求示例：

```json
POST /api/v1/report/generate
Content-Type: application/json

{
  "profileId": "1000000001",
  "preferenceTags": ["稳健保值", "黄金避险"],
  "intent": "生成张总下半年的稳健型配置报告"
}
```

成功立即返回 `{ "taskId": "T-xxxxx" }`，**不阻塞**。然后前端按 600ms 间隔轮询 `GET /api/v1/report/status?taskId=T-xxxxx` 直到 `stage === "done"`。

### 1.2 触发组件入口

| 组件 | 文件 | 用户操作 |
|---|---|---|
| `ConversationTrigger` | `src/components/generative/ConversationTrigger.tsx` | 输入自然语言意图 + 回车 |
| `ButtonWizard` | `src/components/generative/ButtonWizard.tsx` | 选客户 → 勾选偏好 → 点"生成"按钮 |

两者**共用** `useReportStore.startGeneration(profile)`（`src/stores/useReportStore.ts`），收口到同一份 HTTP 调用。

---

## 2. 后端 onerec 框架如何对接前端？

**onerec 不直接对接前端**——浏览器只看到 BFF。中间多一跳是因为：

1. onerec 是 **Python 库**，Node BFF 不能 `import`。
2. 浏览器层不应直接拿到内部模型推荐数据，需要 BFF 做合规与防腐层。

### 2.1 接入路径

```
ChatWorkspace / ReportWorkspace
        │
        │ HTTP (任意端点 /api/v1/...)
        ▼
Node BFF: src/server/prodMiddleware.ts::fetchOnerec(userId, rootDir, topK)
        │
        │ HTTP GET ${ONEREC_BASE_URL}/products?userId=&topK=
        │ (可选 Authorization: Bearer ${ONEREC_API_TOKEN})
        ▼
Python sidecar: backend/onerec_service/app/main.py
        │
        │ recommender.recommend(user_id, top_k)
        ▼
真实 onerec.OneRecRecommender（在 _RealRecommender 里加载模型）
```

### 2.2 sidecar 暴露的契约（与 docs/onerec_example.md 真实形态一致）

```
GET /products?userId=1000000054&topK=8
Authorization: Bearer <ONEREC_API_TOKEN>     # 可选
→ 200
{
  "uid": "1000000054",
  "user_profile": "客户风险等级R2，金融资产总额108.70万元。已投资资产108.70万元...",
  "hist_products": "<|sid_begin|>...<|sid_end|>: 产品属于...持有市值...总收益...",
  "recommendations_by_type": {
    "基金": {
      "raw_pid": ["P00086"],
      "raw_texts": ["QDII-基金类产品..."],
      "recommended_pids": ["P00252"],
      "recommended_texts": [
        "FOF - 基金类产品，风险等级为R3，产品名称为ESG责任号。"
      ],
      "recommendation_count": 1,
      "similarity": [0.0018]
    },
    "理财": {
      "recommended_pids": ["P00647"],
      "recommended_texts": [
        "现金管理类 - 理财类产品，风险等级为R2，产品名称为可转债优选号。"
      ],
      ...
    }
  }
}
```

`src/services/onerecAdapter.ts::normalizeOnerecResponse()` 自动识别这一形态，把
`recommendations_by_type[type].recommended_pids[i]` 与 `recommended_texts[i]` 一一配对，
用正则解析 `产品名称为...`、`风险等级为R\d`、`历史收益水平(%)\d+` 字段，组装成
内部 `Product[]` 给 LLM prompt 使用。**额外字段（如 `hist_products`、`user_profile`）
被 BFF 注入到画像 / Prompt，不会丢失。**

> 兼容：旧的扁平 `Product[]`（含 `product_code/product_name/type/...`）依然可用，
> 仅当响应里没有 `recommendations_by_type` 才走旧路径。

### 2.2.1 onerec 上游请求体（与 docs/request.md 一字不差）

Sidecar 调用真实 onerec HTTP 服务的 body：

```json
POST /v1/completions HTTP/1.1
Authorization: Bearer {your_api_key}
Content-Type: application/json

{
  "model": "OneRec-8B-full-tunning",
  "prompt": "客户风险等级R3，金融资产总额335.20万元。已投资资产335.20万元，其中现金管理类109.00万元、固定收益类27.10万元、权益类14.70万元、保障类10.80万元、另类9.80万元、其他5.60万元。累计总收益19.40万元。该客户 年龄43，职业108.00，性别男，学历大专，投资经验1-3年。",
  "max_tokens": 512,
  "temperature": 0.9,
  "top_p": 0.95,
  "n": 3,
  "frequency_penalty": 0.5,
  "presence_penalty": 0.5
}
```

`prompt` 字段就是客户的 `user_profile` 描述串，由 5 个固定字段组装而成：

| 段落 | 来源 | 示例 |
|---|---|---|
| 风险等级 + 总资产 | `Rsk_Grd` + `Curr_Bal` (Hold_Market_Val_0) | `客户风险等级R3，金融资产总额335.20万元` |
| 已投资 + 五大类金额 | `Hold_Market_Val_1~6` | `已投资资产335.20万元，其中现金管理类109.00万元、固定收益类27.10万元、权益类14.70万元、保障类10.80万元、另类9.80万元、其他5.60万元` |
| 累计总收益 | `Total_Profit_0` | `累计总收益19.40万元` |
| 人口学特征 | `Age` + `Vocation_Cd` + `Gender_Cd` + `Edu_Degree_Cd` + `Invest_Expre` | `该客户 年龄43，职业108.00，性别男，学历大专，投资经验1-3年` |

#### 客户端组装

* **TypeScript** ：`src/utils/profilePrompt.ts::buildOnerecUserProfile(profile)` 与
  `buildOnerecCompletionRequest(profile)` 直接产出 prompt 字符串和完整请求体，
  入参就是 `UserProfile` 对象（`uid` / `riskLevel` / `holdings` / `gender` / ...）。
* **Python** ：`backend/onerec_service/app/recommender.py::build_request_body(user_profile)`
  接受已拼好的字符串，输出 `dict` 给 `requests.post(...)` 直接用。

```ts
// Node 侧示例（接入真实 onerec 时直接复用）
import { buildOnerecCompletionRequest } from '@/utils/profilePrompt';
const body = buildOnerecCompletionRequest(profile);  // n=3, top_p=0.95, ...
const r = await fetch(`${ONEREC_BASE_URL}/v1/completions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ONEREC_API_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
```

```python
# Python 侧示例（在 _RealRecommender.predict 里）
from .recommender import build_request_body
prompt = customer.user_profile or build_user_profile_string(customer)  # 自定义合成器
body = build_request_body(prompt, n=top_k)
resp = requests.post(f"{ONEREC_BASE_URL}/v1/completions", json=body, headers={...})
```

### 2.3 配置（项目根 `.env`）

```ini
ONEREC_BASE_URL=http://127.0.0.1:8765   # sidecar 地址
ONEREC_API_TOKEN=please-rotate-me       # 可选，与 sidecar 同名变量配套
ONEREC_TIMEOUT_MS=5000                  # 单次请求超时
```

未配置时 BFF 自动回退到 `mock-data/onerec/products.json`，整个链路依然能跑。

### 2.4 真实 onerec 接入步骤（≤ 3 处改动）

详见 [`backend/onerec_service/README.md`](../backend/onerec_service/README.md)。核心是改 `app/recommender.py::_RealRecommender`：

```python
class _RealRecommender:
    def __init__(self, model_path: str):
        from onerec.api import OneRecRecommender as _Native
        self._impl = _Native.load_from_config(model_path)

    def predict(self, user_id: str, top_k: int) -> list[dict]:
        items = self._impl.recommend(user_id=user_id, top_k=top_k)
        return [
            {
                "product_code": it.id,
                "product_name": it.title,
                "type": it.category,
                "net_value": it.last_nav,
                "change_pct": it.daily_change_pct,
                "return_1y": it.return_1y,
                "return_3y": it.return_3y,
                "max_drawdown": it.max_drawdown,
                "sharpe": it.sharpe,
                "sparkline": list(it.nav_history),
                "recommendation": it.reason,
            }
            for it in items
        ]
```

---

## 3. 后端 onerec 怎么对接生成式 LLM 模块？

onerec 召回结果作为 **Prompt 的硬约束**注入进 LLM，防止幻觉。

### 3.1 串接代码

`src/server/prodMiddleware.ts::buildReportPayload()`：

```ts
const products = await fetchOnerec(profile.id, rootDir);   // ← onerec 召回
const llmMarkdown = await callLLMForReport(
  profile, products, intent, preferenceTags, task          // ← 带候选池调 LLM
);
```

`callLLMForReport()` 又调 `buildReportUserPrompt()` 拼出报告 user prompt，把 `products` 渲染成 Markdown 列表注入到 `【onerec 召回候选池】` 段落里。

### 3.2 Prompt 模板（`src/llm/prompts/`）

| 文件 | 角色 |
|---|---|
| `system.ts` (`SYSTEM_PROMPT`) | 私行财富顾问人设、6 章节 Markdown 大纲、3 大业务红线（数据一致性 / 超配无减持 / 黄金三段论）、SSE 输出协议、防幻觉硬约束 |
| `report.ts` (`buildReportUserPrompt`) | 资产配置报告 user prompt，按 [`docs/prompt.md`](./prompt.md) 私行模板注入 {Client_Info}/{Holdings}/{Target_Allocation}/{Macro_Views}/{Product_Pool} 五段变量 |
| `chat.ts` (`buildChatUserPrompt`) | 交互对话 user prompt，注入候选池与画像速览 |

### 3.3 银行名称脱敏

LLM 在生成报告时可能复用 prompt 中的银行品牌内容（"浦发银行"等）。为避免对外
文档暴露具体行别，`src/utils/compliance.ts::redactBankNames()` 在 `prodMiddleware`
拿到 LLM 输出后**立即统一替换**为 `[XX银行]`：

| 命中名单 | 替换 |
|---|---|
| 浦发银行 / 中国工商银行 / 工商银行 / 招商银行 / ... 全 25 家主要中资银行 | `[XX银行]` |

脱敏完成后再写入 `task.payload.markdown`，前端 ReportViewer 看到的已经是脱敏版本。
若需要保留具体行别（白名单场景），改 `BANK_NAMES` 数组即可。

**真实 onerec 的输出会原样进入 prompt**，模型只能在这个池子里推荐 `product_code`，否则被 `gateProductCodes()`（`src/services/onerecAdapter.ts:119`）过滤掉。

### 3.3 LLM 客户端（`src/llm/client.ts`）

`streamLLM(config, messages, signal, onReasoning?)` 是个 async generator，逐 token yield 文本内容。

* 自动同时支持 **Anthropic Messages API** 与 **OpenAI 兼容协议**（DeepSeek / Qwen / Moonshot / 智谱 / 月之暗面…）
* 模型若开启了原生 reasoning（Anthropic Extended Thinking、DeepSeek R1、OpenAI o1），`onReasoning(text)` 回调拿到的是**真实模型推理流**，不混在文本输出里
* 配置项见 `.env.example` 的 `LLM_*` 段

---

## 4. 生成式推荐：端到端调用代码流程

```
[前端]
ConversationTrigger.tsx / ButtonWizard.tsx
  → useReportStore.startGeneration(profile)
      ↓
[前端 → BFF]
src/services/api.ts::submitReport(profileId, preferenceTags, intent)
  → POST /api/v1/report/generate
      ↓
[BFF 入口]
src/server/prodMiddleware.ts  (handler block: /report/generate)
  → 创建 ReportTaskInternal { taskId, thinkingTrail: [] }
  → 立即响应 { taskId }，并异步 buildReportPayload(task)
      ↓
[BFF 后台异步]
prodMiddleware.ts::buildReportPayload(task)
  ├─ fetchOnerec(userId, rootDir, topK)
  │    → HTTP GET ${ONEREC_BASE_URL}/products?userId=&topK=
  │    → backend/onerec_service: app/main.py::get_products
  │        → recommender.recommend()
  │            → _RealRecommender.predict() 或 mock_pool.get_pool()
  │    → normalizeOnerecResponse(items) 字段清洗
  │    ← Product[]
  ├─ pushTrail(task, system: "onerec 召回 N 条候选...")
  ├─ callLLMForReport(profile, products, intent, preferenceTags, task)
  │    ├─ buildReportUserPrompt() —— 注入候选池
  │    └─ streamLLM(config, [system, user], signal, onReasoning)
  │         ├─ 文本 token  → 累积进 markdown
  │         ├─ onReasoning → pushTrail(reasoning)  (Anthropic thinking_delta /
  │         │                                       DeepSeek R1 reasoning_content)
  │         └─ ## 章节切换 → pushTrail(section: "正在撰写：xxx")
  └─ 落 task.payload (markdown + allocations + backtest + products)
      ↓
[前端轮询]
src/services/api.ts::pollReportUntilDone(taskId, onProgress)
  → GET /api/v1/report/status?taskId=...   每 600ms
  ← { stage, progress, message, payload?, thinkingTrail[] }
      ↓
[前端渲染]
useReportStore  → task.thinkingTrail
ReportViewer.tsx → StepLoading 把 thinkingTrail 渲染成"真实后端调用思维链"卡片
报告完成后渲染 markdown + AllocationPieChart + BacktestLineChart
```

---

## 5. 交互式推荐：前端输入

### 5.1 输入字段（前端 → BFF）

接口：`POST /api/v1/chat/completions`，**SSE 长连接**。请求 body：

| 字段 | 类型 | 必填 | 来源 | 说明 |
|---|---|---|---|---|
| `prompt` | string | ✅ | `ChatWorkspace` 的 `<textarea>` / prompt chip / 浮动机器人输入 | 用户原始问题；BFF 在 PII 脱敏 + 违禁词检查后再下发 LLM |
| `profile` | object | ❌ | `UserProfileCard` 当前选中的客户 | 客户画像；用于 onerec 个性化 + LLM 风险匹配，详见 §5.3 |

`profile` 对象字段（与 `UserProfile` 类型一致，`src/types/index.ts`）：

| 字段 | 类型 | 用途 |
|---|---|---|
| `uid` | string | **onerec 协议字段**，sidecar 的 `userId` 查询参数；与 `id` 等价（兼容旧字段） |
| `name` | string | **客户真实姓名**（卡片展示 + Prompt 称谓） |
| `user_profile` | string | **onerec 输入端那段画像描述串**，前端展开展示，后端原样注入 LLM prompt |
| `displayName` | string | 旧字段：含称谓后缀的展示名（如"陈建国 · 平衡型"），保留兼容 |
| `riskLevel` | `'C1'\|'C2'\|'C3'\|'C4'\|'C5'` | 决定 LLM 写作语气、能否推荐高弹性资产 |
| `aum` | number (单位：元) | 资产规模影响配置颗粒度 |
| `age` | number | 影响生命周期建议（年龄越大越偏稳健） |
| `preferenceTags` | string[] | 软偏好；LLM 会显式呼应这些标签 |
| `hist_products` | string? | 历史持仓串（onerec hist_products），可选；UserProfileCard 二级展开 |

请求示例：

```json
POST /api/v1/chat/completions
Content-Type: application/json
Accept: text/event-stream

{
  "prompt": "下半年怎么配？",
  "profile": {
    "id": "1000000001",
    "uid": "1000000001",
    "name": "陈建国",
    "displayName": "陈建国 · 平衡型",
    "user_profile": "客户风险等级R3，金融资产总额335.20万元。已投资资产335.20万元，其中现金管理类109.00万元、固定收益类27.10万元、权益类14.70万元、保障类10.80万元、另类9.80万元、其他5.60万元。累计总收益19.40万元。该客户 年龄43，职业108.00，性别男，学历大专，投资经验1-3年。",
    "riskLevel": "R3",
    "aum": 3352000,
    "age": 43,
    "gender": "男",
    "vocation_cd": 108,
    "edu_degree": "大专",
    "invest_expre": "1-3年",
    "holdings": {
      "cash": 1090000,
      "fixed_income": 271000,
      "equity": 147000,
      "insurance": 108000,
      "alternative": 98000,
      "other": 56000,
      "total_profit": 194000
    },
    "preferenceTags": ["现金管理为主", "固收偏好", "稳健"]
  }
}
```

### 5.2 客户画像（UserProfileCard）↔ 后端的对接

> **新增（V1.4）**：交互式工作区左侧 `UserProfileCard` 现在是上下文锚点。选中客户后，画像会随每条提问自动下发，**整条链路真实个性化**。

#### 状态来源

```
src/stores/useProfileStore.ts
  ├─ profiles (List<UserProfile>)        从 GET /api/v1/users/profiles 拉
  ├─ activeId (string)                   localStorage 持久化（key: deeprec-active-profile-id）
  └─ getActive()                         衍生：当前活跃画像对象
```

`UserProfileCard` 顶部下拉切换会更新 `activeId`，下次发送即生效。

#### 调用流（前端）

```
UserProfileCard ─── setActive(id) ───▶ useProfileStore.activeId
                                              │
ChatWorkspace.send(text)                      │
  └─ useChatStore.send(text)                  │
       └─ useProfileStore.getState()          │
            .getActive() ◀──────────────────  │
       └─ chatStream(prompt, signal, profile)
            └─ POST /api/v1/chat/completions  body: { prompt, profile }
```

#### 调用流（后端）

`src/server/prodMiddleware.ts::streamChatLLM()`：

> ⚠️ **重要：交互式推荐不再调 onerec**。交互场景是开放式对话，强制圈一个 top-k 候选池
> 反而会限制 LLM 的话术覆盖面。BFF 直接用内置 `mockProductPool` 作为话术兜底素材；
> 画像（uid / 风险等级 / 偏好）仍然注入 prompt，让 LLM 与客户风险匹配。
>
> *onerec 仅在生成式推荐链路里使用*，详见 §1 的 fetchOnerec 调用。

```ts
// 路由层读 body
const { prompt, profile } = JSON.parse(body);

// 1️⃣ 拿内置话术兜底素材（不调 onerec）
const candidates = mockProductPool.slice(0, 6);

// 2️⃣ 把画像字段拼进 LLM prompt
const summary = profile
  ? `${profile.name ?? profile.displayName} (${profile.uid}) · 风险等级 ${profile.riskLevel}
     · 在管 ${(profile.aum/10000).toFixed(0)} 万 · ${profile.age} 岁
     · 偏好：${profile.preferenceTags.join('、')}`
  : undefined;

const userPrompt = buildChatUserPrompt({
  userPrompt: prompt,
  candidates,
  profileSummary: summary
});

// 3️⃣ 流式调 LLM
streamLLM(config, [{role:'system', content: SYSTEM_PROMPT}, {role:'user', content: userPrompt}], ...)
```

#### Prompt 注入位置

`src/llm/prompts/chat.ts::buildChatUserPrompt()` 拼出：

```
【客户问题】
下半年怎么配？

【客户画像】
陈建国 (1000000001) · 风险等级 R3 · 在管 335 万 · 43 岁
                · 偏好：稳健、权益偏低、债券为主

【onerec 候选池（请只在此池中挑选产品）】
- 003376 | 汇添富中债3-5年政策金融债 | ...
- 180202 | 南方红利低波50ETF | ...
- ...
```

LLM 看到 `C3` 自动收敛到稳健型推荐；看到偏好里的 "债券为主" 会显式呼应；
看到 `aum=128 万` 会用合适的颗粒度（如"建议从 30 万开始分批"而非"3 万")。

#### 后端拓展指南

如果你们公司的 onerec 还需要更多画像字段（例如行业、持仓历史、地区），按以下顺序扩展：

1. **前端 `UserProfile` 类型** (`src/types/index.ts`) 加字段
2. **`UserProfileCard.tsx`** 渲染该字段
3. **后端 sidecar `app/schemas.py`** 接收（如果需要让 onerec 用到）
4. **`prodMiddleware.ts::profileSummary()`** 把字段拼进 prompt
5. **`useProfileStore`** 不需要改，因为它直接转发整个 profile 对象

#### 保密 / 合规建议

* `profile` 不含手机号 / 身份证 / 真实姓名等强 PII。`displayName` 在生产上应是脱敏后的称呼（如"张总"而非全名）。
* 如客户拒绝个性化，前端调 `useProfileStore.setActive(undefined)` 即可——后端检测到 `profile` 缺失会自动走 `DEFAULT_USER_ID` 兜底召回，不会泄漏。
* 真实 onerec sidecar 应启用 `ONEREC_API_TOKEN`，避免内网横向访问伪造 userId。

### 5.3 输入入口

`ChatWorkspace.tsx`（`src/components/interactive/`）—— 同时承担三种入口：

* 主输入区 `<textarea>`，Enter 发送
* `PROMPT_CHIPS` 快捷常用意图
* `FloatingRobot` 浮动机器人面板（共享同一 `useChatStore`）

发送前在 `useChatStore.send()` 里走 PII 脱敏（`maskPII`）和违禁词拦截（`checkBannedWords`），都过了才打 BFF。

---

## 6. 交互式推荐：与后端的 SSE 对接

### 6.1 SSE 事件协议

服务器按 `data: <json>\n\n` 流式下发以下事件，每条独立 JSON：

| `type` | payload | 用途 | 前端如何渲染 |
|---|---|---|---|
| `thinking` | `{ content: string }` | LLM 思维链。可来自系统 prompt 让模型主动 emit，也可以是模型原生 reasoning 流被 BFF 包装 | PC 模式右侧 `ThinkingSidebar`；移动模式不显示 |
| `text` | `{ content: string }` | 主体文本，逐字下发 | 气泡里逐字 append，最后一段带光标 `▍` |
| `widget` | `{ widgetName: "FundCard", data: Product }` | 内联产品卡 | PC 直接渲染 FundCard；Mobile 折叠为 `[n]` 引用徽章 + 底抽屉 |
| `trailing_rec` | `{ title: string, products: Product[] }` | 尾随推荐组 | PC 纵向堆叠；Mobile 多于 1 条用横向 Swiper |
| `followup` | `{ suggestions: string[] }` | 智能追问 chip | 渲染成可点击 chip，回填到输入框 |
| `done` | `{}` | 流结束 | 关掉光标动画，把 message.streaming 置 false |

### 6.2 BFF 端两条路径

`src/server/prodMiddleware.ts::POST /api/v1/chat/completions` 优先走真实 LLM：

```ts
1. streamChatLLM(prompt, rootDir, res)
   ├─ fetchOnerec()  —— 注入候选池
   ├─ buildChatUserPrompt()
   ├─ streamLLM(config, [system, user], signal, onReasoning)
   │   ├─ 文本 token → 拼 buffer，按 \n\n 切块解析为 SSE 事件转发
   │   └─ onReasoning(text) → 直接 sseWrite({type:'thinking', content: text})
   └─ 末尾 sseWrite({type:'done'})
2. 失败/缺 LLM_API_KEY → streamChatScripted(prompt, rootDir, res)
   └─ 按 prompt 关键词命中 mock-data/llm/chat-cases.json 脚本化用例
```

### 6.3 真实后端思维链如何在右侧侧栏出现？

> 已经原生支持，无需任何前端改动。

**两条来源：**

1. **System prompt 显式约定**（`src/llm/prompts/system.ts`）。我们要求模型在主体内容前 emit 2-3 条 `{type:"thinking", content:"..."}`。模型按指令输出，BFF 转写到 SSE。
2. **模型原生 reasoning 流**。如果你在 `.env` 配的是支持 reasoning 的模型（Anthropic Claude 启用 Extended Thinking / DeepSeek R1 / OpenAI o1），LLM 会单独下发 `thinking_delta`（Anthropic）或 `reasoning_content`（OpenAI 兼容）流。BFF 在 `streamChatLLM` 里通过 `onReasoning` 回调把它们合成为 `{type:"thinking", content:"..."}` SSE 事件。

**前端**只看 `chat.completions` SSE 流，把所有 `thinking` 事件聚合到 `message.chunks`，PC 模式 `ThinkingSidebar` 自动渲染。`src/components/interactive/ThinkingSidebar.tsx` 锁定到最后一条 assistant 消息：

```tsx
const t = m.chunks.filter((c) => c.type === 'thinking' && c.content);
```

### 6.4 后端如何让"真实模型 reasoning"显示出来（运营 checklist）

| 步骤 | 操作 |
|---|---|
| 1 | `.env` 配置可 reasoning 的模型，例 `LLM_PROVIDER=openai-compatible`、`LLM_BASE_URL=https://api.deepseek.com/v1`、`LLM_MODEL=deepseek-reasoner` |
| 2 | 重启 `pnpm dev`。终端会打印 `[生产模式] LLM=已配置  onerec=...` |
| 3 | 在交互式推荐页面随便提问 |
| 4 | PC 模式右侧 `ThinkingSidebar` 应当看到模型原生 reasoning 文本（带"思考中…"红点呼吸效果） |

如果只想**在不改模型的情况下**让侧栏有内容，依赖 system prompt 即可——已有模板让任何模型都会 emit `thinking` 事件。

---

## 7. 交互式推荐：端到端调用代码流程

```
[前端]
ChatWorkspace.tsx <textarea>
  → useChatStore.send(rawText)
      ├─ checkBannedWords(text)        ← 本地违禁词
      ├─ maskPII(text)                  ← 本地 PII 脱敏
      ├─ messages: [...prev, userMsg, assistantStreamingPlaceholder]
      └─ chatStream(masked, signal)
          ↓
[前端 → BFF]
src/services/api.ts::chatStream
  → POST /api/v1/chat/completions  (SSE 长连接)
  ← data: { type: "thinking" | "text" | "widget" | ... }\n\n  逐条
      ↓
[BFF]
src/server/prodMiddleware.ts::POST /chat/completions
  → streamChatLLM(prompt, rootDir, res)        ★ 真 LLM
      ├─ fetchOnerec(DEFAULT_USER_ID, rootDir)
      ├─ buildChatUserPrompt()
      ├─ streamLLM(config, [system, user], signal, onReasoning)
      │   ├─ onReasoning(text) → sseWrite({type:"thinking", content:text})
      │   │      （Anthropic thinking_delta / DeepSeek R1 reasoning_content）
      │   └─ 文本 token → buffer 累积
      │       └─ buffer.indexOf("\n\n") 切块
      │           └─ JSON.parse → sseWrite(evt)
      └─ sseWrite({type:"done"})
  → 失败/缺凭证：streamChatScripted (脚本化用例兜底)
      ↓
[前端流式渲染]
useChatStore  consumes chatStream() generator
  ├─ thinking → push 到 message.chunks
  ├─ text     → 合并到尾部 text chunk
  ├─ widget   → 单独 chunk
  ├─ trailing_rec / followup → 单独 chunk
  └─ done     → message.streaming = false

ChatBubble.tsx 按 viewMode 渲染：
  PC 模式：
    · 主气泡流  ← text + widget(FundCard) + trailing_rec + followup
    · 右侧 ThinkingSidebar ← 实时聚合 thinking
  Mobile 模式：
    · 单列瀑布流，输入框吸底
    · trailing_rec.length > 1 → 横向 Swiper
    · widget → [n] 引用徽章 → ProductSheet 底抽屉
```

---

## 附 A：环境变量速查

完整列表在 `.env.example`。最常用的：

```ini
# LLM
LLM_PROVIDER=openai-compatible           # 或 anthropic
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-reasoner              # 选支持 reasoning 的模型即可让右侧侧栏有内容
LLM_API_KEY=sk-xxxxxxxxxxxx
LLM_TEMPERATURE=0.4
LLM_MAX_TOKENS=2048

# onerec sidecar
ONEREC_BASE_URL=http://127.0.0.1:8765
ONEREC_API_TOKEN=please-rotate-me
ONEREC_TIMEOUT_MS=5000
DEFAULT_USER_ID=1000000001
```

## 附 B：本地启动

```bash
# 终端 1：onerec sidecar (Python)
cd backend/onerec_service
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --port 8765 --reload

# 终端 2：BFF + 前端 (Node)
pnpm install
pnpm dev          # 生产模式（真 LLM + onerec）
# pnpm copy       # 全 mock 模式（不需要任何凭证）
```

打开 `http://localhost:5173` 即可。
