"""
Pydantic v2 schema —— 与 docs/onerec_example.md 真实 onerec 输出形态对齐。

═══════════════════════════════════════════════════════════════════════════
契约结构（recommendations_by_type 形态，详见 docs/onerec_example.md）：

    {
      "uid": "1000000054",
      "user_profile": "客户风险等级R2，金融资产总额108.70万元...",
      "hist_products": "<|sid_begin|>...<|sid_end|>: 产品属于...持有市值...总收益...",
      "recommendations_by_type": {
        "基金": {
          "raw_pid": ["P00086"],
          "raw_texts": ["QDII-基金类产品..."],
          "recommended_pids": ["P00252"],
          "recommended_texts": ["FOF - 基金类产品..."],
          "recommendation_count": 1,
          "similarity": [0.0018]
        },
        "理财": { ... }
      }
    }
═══════════════════════════════════════════════════════════════════════════

Node BFF 端 src/services/onerecAdapter.ts 同时支持本形态与旧的扁平 Product[]
形态——所以接入真实 onerec 可以不用改前端字段映射，只要 sidecar 输出契约对齐。
"""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class RecommendationGroup(BaseModel):
    """单个产品类型（基金 / 理财 / ...）下的召回明细。"""

    model_config = ConfigDict(extra="ignore")

    raw_pid: List[str] = Field(default_factory=list, description="客户当前持仓的对照产品 ID")
    raw_texts: List[str] = Field(default_factory=list, description="对照产品文字描述")
    sid_input: List[str] = Field(default_factory=list, description="输入 sid 序列")
    sid_matched: List[str] = Field(default_factory=list, description="匹配到的 sid 序列")

    recommended_pids: List[str] = Field(default_factory=list, description="推荐的产品 ID 列表")
    recommended_texts: List[str] = Field(
        default_factory=list,
        description="推荐产品的文字描述（含风险等级、产品名称、收益水平等）",
    )
    recommendation_count: int = Field(default=0, ge=0, description="推荐数量")
    similarity: List[float] = Field(
        default_factory=list, description="与持仓 sid 的余弦/欧式相似度，越大越相关"
    )

    raw_response: Optional[str] = Field(default=None, description="原始 LLM 响应（调试用）")
    response_content: Optional[str] = Field(default=None, description="模型响应正文（调试用）")


class OneRecResponse(BaseModel):
    """召回响应顶层结构（与 docs/onerec_example.md 完全对齐）。"""

    model_config = ConfigDict(populate_by_name=True)

    uid: str = Field(..., description="onerec 协议中的客户唯一 ID")
    user_profile: str = Field(..., description="客户画像描述串，前端 UserProfileCard 会原样展示")
    hist_products: Optional[str] = Field(
        default=None, description="历史持仓串（拼接的 <|sid_begin|>...<|sid_end|> 段）"
    )
    recommendations_by_type: Dict[str, RecommendationGroup] = Field(
        default_factory=dict, description="按产品类型分组的召回结果，键如'基金' / '理财'"
    )


class HealthResponse(BaseModel):
    ok: bool = True
    version: str
    onerec_loaded: bool = Field(
        default=False,
        description="真实 onerec 模型是否成功加载；False 时说明走了脚本化兜底",
    )
