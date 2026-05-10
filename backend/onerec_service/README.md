# onerec sidecar (FastAPI)

把公司内部的 **Python onerec 推荐框架**包装成一个 HTTP REST 服务，给项目根的
Node BFF（`src/server/prodMiddleware.ts → fetchOnerec()`）按 `GET /products?userId=...&topK=...`
契约调用。

## 为什么要这一层？

```
[Browser]  ──fetch──▶  [Node BFF (Vite middleware, src/server/prodMiddleware.ts)]
                              │
                              ├──▶ HTTP GET /products?userId=...&topK=...
                              │                ▲
                              │                │
                       [onerec sidecar (本目录, Python 3.10+)]
                              │
                              └──▶ import onerec ; OneRecRecommender(...).predict(...)
```

* Node 不能直接 `import onerec`（onerec 是 Python 库），所以中间需要一层进程边界。
* sidecar 进程只做"协议转换 + 字段对齐"，**不放业务逻辑**：业务逻辑（prompt 编排 / 合规 / SSE 编码）依然在 Node BFF。
* Sidecar **不直接面对浏览器**，只接 BFF 内网调用；建议加 `ONEREC_API_TOKEN` Bearer 鉴权。

## 项目结构

```
backend/onerec_service/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 入口、路由、鉴权
│   ├── config.py        # 环境变量解析
│   ├── schemas.py       # Pydantic v2 出入参（与 TS 端 onerecAdapter 字段对齐）
│   ├── recommender.py   # ⭐ 真实 onerec 接入点（替换 _RealRecommender 即可）
│   └── mock_pool.py     # 脚本化兜底召回池，方便联调
├── pyproject.toml
├── Dockerfile
└── README.md
```

## 本地启动

```bash
cd backend/onerec_service
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 8765 --reload
```

冒烟测试：

```bash
curl -s "http://127.0.0.1:8765/healthz" | jq
curl -s "http://127.0.0.1:8765/products?userId=1000000001&topK=4" | jq
```

OpenAPI 文档：<http://127.0.0.1:8765/docs>

## 接前端联调

在项目根 `.env` 写：

```bash
ONEREC_BASE_URL=http://127.0.0.1:8765
# 可选：内网鉴权
# ONEREC_API_TOKEN=please-rotate-me
# ONEREC_TIMEOUT_MS=4000
```

然后另起一个终端：

```bash
pnpm dev
```

## 接入真实 onerec

**只需改 `app/recommender.py` 一个文件**，其它代码无需变更。

1. `pip install onerec`（或公司私有源）。在 `pyproject.toml` 的 `dependencies` 里追加。
2. 在 `app/recommender.py` 的 `_RealRecommender` 里：
   * 取消 `from onerec.api import OneRecRecommender as _Native` 的注释
   * `__init__` 里加载模型（用 `settings.model_path`）
   * `predict()` 里把 onerec item 字段映射到 `schemas.OneRecItem`（snake_case）
3. 启动时设置 `ONEREC_MODEL_PATH=/path/to/your/model`
4. 看 `/healthz` 返回 `onerec_loaded: true` 即可。失败会自动降级到 `mock_pool`，前端不会断流。

## 字段约定（务必稳定）

输出字段必须与 `src/services/onerecAdapter.ts::normalizeOnerecResponse()` 兼容。
TS 端会做二次清洗（NaN 兜底 / sparkline 长度归一 / 去重），所以即便你的 onerec
模型字段命名略有不同，**也请在 `_RealRecommender.predict()` 里做映射**，
不要去改前端的 adapter，否则会破坏 ChatWorkspace 的契约。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `product_code` | string | ✅ | 产品代码，缺失则丢弃该条 |
| `product_name` | string | ✅ | 产品名称 |
| `type` | string |   | 资产大类 |
| `net_value` | float |   | 最新净值 |
| `change_pct` | float |   | 日涨跌幅（%） |
| `return_1y` / `return_3y` | float |   | 近 N 年收益（%） |
| `max_drawdown` | float |   | 最大回撤（%, 负数） |
| `sharpe` | float |   | 夏普比率 |
| `sparkline` | float[] |   | 净值序列（4-64 之间，TS 端会归一） |
| `recommendation` | string |   | onerec 推荐理由（可选） |

## Docker

```bash
docker build -t onerec-sidecar:0.1.0 backend/onerec_service
docker run --rm -p 8765:8765 \
    -e ONEREC_API_TOKEN=please-rotate-me \
    -e ONEREC_DEFAULT_TOPK=8 \
    onerec-sidecar:0.1.0
```

## 注意事项

* sidecar **只读**，没有副作用 —— 重启不影响业务数据。
* 禁止在 sidecar 里写 LLM 调用 / 写 SQL / 写 prompt：那是 Node BFF 的职责。
* 真实 onerec 模型加载失败时不会让进程崩溃，会回退到 `mock_pool`，并在 `/healthz` 暴露 `onerec_loaded: false` 给监控。
