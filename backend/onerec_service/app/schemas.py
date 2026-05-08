"""
Pydantic v2 schema —— 与 src/services/onerecAdapter.ts 的字段约定保持一致。

为方便真实环境接入，采用 snake_case 出参（前端 normalizeOnerecResponse 兼容
snake_case 与 camelCase 双写）。如果你们公司 onerec 输出的字段名不同，
请在 recommender.py::recommend() 内做映射，不要改本文件，避免破坏前端契约。
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OneRecItem(BaseModel):
    """单个候选产品。所有数值字段强制 float，字符串数字会被自动转换。"""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    product_code: str = Field(..., min_length=1, description="产品代码（必备）")
    product_name: str = Field(..., min_length=1, description="产品名称（必备）")
    type: str = Field(default="其他", description="资产大类 / 产品类型")
    net_value: float = Field(default=1.0, description="最新净值")
    change_pct: float = Field(default=0.0, description="日涨跌幅（%）")
    return_1y: float = Field(default=0.0, description="近 1 年收益（%）")
    return_3y: float = Field(default=0.0, description="近 3 年收益（%）")
    max_drawdown: float = Field(default=0.0, description="最大回撤（%, 通常为负）")
    sharpe: float = Field(default=0.0, description="夏普比率")
    sparkline: List[float] = Field(default_factory=list, description="近 N 期净值序列")
    recommendation: Optional[str] = Field(default=None, description="onerec 推荐理由")

    @field_validator("sparkline", mode="before")
    @classmethod
    def _coerce_sparkline(cls, v: object) -> list[float]:
        if v is None:
            return []
        if not isinstance(v, (list, tuple)):
            return []
        out: list[float] = []
        for x in v:
            try:
                out.append(float(x))
            except (TypeError, ValueError):
                continue
        return out


class OneRecResponse(BaseModel):
    """召回响应顶层结构。"""

    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(..., alias="userId")
    items: List[OneRecItem]


class HealthResponse(BaseModel):
    ok: bool = True
    version: str
    onerec_loaded: bool = Field(
        default=False,
        description="真实 onerec 模型是否成功加载；False 时说明走了脚本化兜底",
    )
