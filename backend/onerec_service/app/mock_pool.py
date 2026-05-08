"""
脚本化兜底召回池 —— 方便在真实 onerec 模型未接入前完整跑通端到端联调。

字段命名与 mock-data/onerec/products.json 对齐，复制了同一份数据，
让 sidecar 可以独立运行（不依赖前端项目的 mock 文件）。

接入真实 onerec 后，本模块可以删除，或保留作为 health check 兜底。
"""

from __future__ import annotations

from typing import Dict, List

POOL: Dict[str, List[dict]] = {
    "CUST-A": [
        {
            "product_code": "003376",
            "product_name": "汇添富中债3-5年政策金融债",
            "type": "中长期纯债",
            "net_value": 1.1428,
            "change_pct": 0.04,
            "return_1y": 4.7,
            "return_3y": 14.9,
            "max_drawdown": -1.8,
            "sharpe": 1.32,
            "sparkline": [1.0, 1.005, 1.012, 1.018, 1.024, 1.03, 1.036, 1.04, 1.045, 1.05, 1.058, 1.063],
            "recommendation": "提供组合压舱石作用，久期适中、违约风险低",
        },
        {
            "product_code": "180202",
            "product_name": "南方红利低波50ETF",
            "type": "红利策略",
            "net_value": 1.4218,
            "change_pct": 0.36,
            "return_1y": 8.6,
            "return_3y": 28.1,
            "max_drawdown": -12.4,
            "sharpe": 0.78,
            "sparkline": [1.0, 1.02, 1.04, 1.03, 1.06, 1.09, 1.11, 1.10, 1.13, 1.16, 1.18, 1.21],
            "recommendation": "高股息、低波动，适配稳健客户底仓",
        },
        {
            "product_code": "513100",
            "product_name": "国泰纳指QDII",
            "type": "海外权益",
            "net_value": 2.6310,
            "change_pct": 0.92,
            "return_1y": 24.3,
            "return_3y": 62.5,
            "max_drawdown": -22.1,
            "sharpe": 0.92,
            "sparkline": [1.0, 1.05, 1.12, 1.18, 1.25, 1.20, 1.30, 1.40, 1.48, 1.55, 1.60, 1.66],
            "recommendation": "AI 主线行情仍具有上行弹性，注意汇率与估值",
        },
        {
            "product_code": "518880",
            "product_name": "华安黄金ETF",
            "type": "商品",
            "net_value": 5.0210,
            "change_pct": 1.45,
            "return_1y": 18.4,
            "return_3y": 41.2,
            "max_drawdown": -8.6,
            "sharpe": 0.86,
            "sparkline": [1.0, 1.03, 1.04, 1.06, 1.10, 1.13, 1.16, 1.18, 1.22, 1.25, 1.28, 1.30],
            "recommendation": "对冲组合的地缘与通胀风险",
        },
    ],
    "CUST-B": [
        {
            "product_code": "180202",
            "product_name": "南方红利低波50ETF",
            "type": "红利策略",
            "net_value": 1.4218,
            "change_pct": 0.36,
            "return_1y": 8.6,
            "return_3y": 28.1,
            "max_drawdown": -12.4,
            "sharpe": 0.78,
            "sparkline": [1.0, 1.02, 1.04, 1.03, 1.06, 1.09, 1.11, 1.10, 1.13, 1.16, 1.18, 1.21],
            "recommendation": "高股息、低波动，匹配中等风险",
        },
        {
            "product_code": "513100",
            "product_name": "国泰纳指QDII",
            "type": "海外权益",
            "net_value": 2.6310,
            "change_pct": 0.92,
            "return_1y": 24.3,
            "return_3y": 62.5,
            "max_drawdown": -22.1,
            "sharpe": 0.92,
            "sparkline": [1.0, 1.05, 1.12, 1.18, 1.25, 1.20, 1.30, 1.40, 1.48, 1.55, 1.60, 1.66],
            "recommendation": "组合权益部分的成长引擎",
        },
        {
            "product_code": "519983",
            "product_name": "长信稳益混合A",
            "type": "稳健混合",
            "net_value": 1.5712,
            "change_pct": 0.18,
            "return_1y": 6.2,
            "return_3y": 19.3,
            "max_drawdown": -4.5,
            "sharpe": 1.05,
            "sparkline": [1.0, 1.01, 1.02, 1.04, 1.05, 1.07, 1.08, 1.09, 1.11, 1.13, 1.14, 1.16],
            "recommendation": "股债平衡，回撤控制良好",
        },
    ],
    "CUST-C": [
        {
            "product_code": "513100",
            "product_name": "国泰纳指QDII",
            "type": "海外权益",
            "net_value": 2.6310,
            "change_pct": 0.92,
            "return_1y": 24.3,
            "return_3y": 62.5,
            "max_drawdown": -22.1,
            "sharpe": 0.92,
            "sparkline": [1.0, 1.05, 1.12, 1.18, 1.25, 1.20, 1.30, 1.40, 1.48, 1.55, 1.60, 1.66],
            "recommendation": "权益主导客户的核心成长仓",
        },
        {
            "product_code": "501018",
            "product_name": "南方原油QDII",
            "type": "海外商品",
            "net_value": 1.1845,
            "change_pct": -0.62,
            "return_1y": 11.7,
            "return_3y": 35.8,
            "max_drawdown": -16.4,
            "sharpe": 0.61,
            "sparkline": [1.0, 1.04, 1.02, 1.05, 1.08, 1.06, 1.10, 1.12, 1.15, 1.13, 1.16, 1.18],
            "recommendation": "通胀对冲与组合多元化",
        },
        {
            "product_code": "159949",
            "product_name": "华夏创业板50ETF",
            "type": "成长股",
            "net_value": 1.0312,
            "change_pct": 1.21,
            "return_1y": 19.8,
            "return_3y": 45.6,
            "max_drawdown": -28.7,
            "sharpe": 0.68,
            "sparkline": [1.0, 0.98, 1.04, 1.10, 1.06, 1.12, 1.16, 1.20, 1.24, 1.30, 1.35, 1.38],
            "recommendation": "进取型客户的高弹性筹码",
        },
    ],
}


def get_pool(user_id: str) -> List[dict]:
    """按 userId 命中候选池；命中失败回退到 CUST-A 默认池。"""
    return POOL.get(user_id) or POOL.get("CUST-A") or []
