"""
配置加载（环境变量优先，方便容器/k8s 注入）。

ONEREC_API_TOKEN     若设置则要求请求带 Authorization: Bearer <token>
ONEREC_DEFAULT_TOPK  默认召回数（前端不传 topK 时用此值）
ONEREC_MODEL_PATH    真实 onerec 模型文件路径（接入真实库时再读）
ONEREC_LOG_LEVEL     日志等级，默认 INFO
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    api_token: str | None
    default_top_k: int
    model_path: str | None
    log_level: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            api_token=os.environ.get("ONEREC_API_TOKEN") or None,
            default_top_k=int(os.environ.get("ONEREC_DEFAULT_TOPK", "8")),
            model_path=os.environ.get("ONEREC_MODEL_PATH") or None,
            log_level=os.environ.get("ONEREC_LOG_LEVEL", "INFO"),
        )


settings = Settings.from_env()
