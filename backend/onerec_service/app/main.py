"""
FastAPI 入口 —— 把 Python onerec 库以 HTTP 形式暴露给 Node BFF。

启动方式（开发）：
    cd backend/onerec_service
    pip install -e .
    uvicorn app.main:app --host 0.0.0.0 --port 8765 --reload

启动方式（生产，多 worker + access log）：
    uvicorn app.main:app --host 0.0.0.0 --port 8765 \
        --workers 2 --proxy-headers --no-server-header

接入到前端：
    在项目根 .env 写 ONEREC_BASE_URL=http://127.0.0.1:8765
    （并按需追加 ONEREC_TOKEN / ONEREC_TIMEOUT_MS）
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import __version__, recommender
from .config import settings
from .schemas import HealthResponse, OneRecItem, OneRecResponse


@asynccontextmanager
async def _lifespan(app: FastAPI):
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    )
    real_ok = recommender.init()
    logging.getLogger("onerec.lifespan").info(
        "onerec sidecar started v%s, real_model=%s, default_top_k=%s",
        __version__,
        real_ok,
        settings.default_top_k,
    )
    yield


app = FastAPI(
    title="onerec sidecar",
    version=__version__,
    description="Wraps the Python onerec recommender as HTTP for the Node BFF.",
    lifespan=_lifespan,
)

# 默认仅信任本机/同 docker 网络。生产环境如需开放，请收紧 origins。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _require_token(authorization: Optional[str] = Header(default=None)) -> None:
    """ONEREC_API_TOKEN 已设置时强制鉴权；未设置则放通（开发模式）。"""
    if not settings.api_token:
        return
    expected = f"Bearer {settings.api_token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="invalid or missing bearer token")


@app.get("/healthz", response_model=HealthResponse)
def healthz() -> HealthResponse:
    return HealthResponse(
        ok=True,
        version=__version__,
        onerec_loaded=recommender.is_ready(),
    )


@app.get(
    "/products",
    response_model=OneRecResponse,
    response_model_by_alias=True,
    dependencies=[Depends(_require_token)],
    summary="按用户召回 top-K 候选产品（onerec）",
)
def get_products(
    userId: str = Query(..., min_length=1, description="客户 ID，与前端 profile.id 一致"),
    topK: int = Query(
        default=None,  # type: ignore[arg-type]
        ge=1,
        le=64,
        description="召回数量；缺省时使用 ONEREC_DEFAULT_TOPK",
    ),
) -> OneRecResponse:
    k = topK or settings.default_top_k
    raw = recommender.recommend(user_id=userId, top_k=k)
    items = [OneRecItem.model_validate(r) for r in raw]
    return OneRecResponse(userId=userId, items=items)
