"""
召回核心 —— 真实 onerec 框架的接入点。

═══════════════════════════════════════════════════════════════════════════
 ⚠️ 接入真实 onerec 时只需改本文件，schemas.py / main.py 保持不动。
═══════════════════════════════════════════════════════════════════════════

设计目标：
  1. 暴露稳定的 recommend(uid, top_k) → OneRecResponse 给 FastAPI 路由调用
  2. 真实 onerec 库加载失败 / 未配置模型路径时，自动降级到 mock，保证 BFF 联调不断
  3. "工程封装"和"算法逻辑"分离 —— 想换召回算法只需改 _RealRecommender

返回结构与 docs/onerec_example.md 一致：uid / user_profile / hist_products /
recommendations_by_type。
"""

from __future__ import annotations

import logging
from typing import Optional

from .config import settings
from .mock_pool import build_mock_response
from .schemas import OneRecResponse

logger = logging.getLogger("onerec.recommender")


class _RealRecommender:
    """
    真实 onerec 模型适配器。

    TODO（接入步骤，按真实 onerec API 调整）：
        1. pip 安装：pip install onerec  （或公司私有源）
        2. 取消下面 import 的注释；指向你们的 checkpoint
        3. 在 predict() 内：
           a) 用 uid 拉客户特征 → 拼成 docs/request.md 中的 prompt 字符串
           b) 调真实 onerec：POST /v1/completions（model=OneRec-8B-full-tunning, n=3, top_p=0.95）
           c) 把响应里的 recommendations_by_type 直接作为 OneRecResponse.recommendations_by_type
        4. 删除/缩减 mock_pool.py 即可

    示例（伪代码）：
        from onerec.api import OneRecClient as _Native

        class _RealRecommender:
            def __init__(self, model_path: str):
                self._impl = _Native.load_from_config(model_path)

            def predict(self, uid: str, top_k: int) -> OneRecResponse:
                feature = self._fetch_user_feature(uid)            # 内部 RPC
                prompt = self._render_request_prompt(feature)      # 按 docs/request.md
                resp = self._impl.complete(
                    model="OneRec-8B-full-tunning",
                    prompt=prompt,
                    n=top_k, top_p=0.95, temperature=0.9,
                    frequency_penalty=0.5, presence_penalty=0.5,
                )
                return OneRecResponse(
                    uid=uid,
                    user_profile=feature.user_profile,
                    hist_products=feature.hist_products,
                    recommendations_by_type=resp.recommendations_by_type,
                )
    """

    def __init__(self, model_path: str) -> None:
        # TODO: 替换为真实 import
        # from onerec.api import OneRecClient
        # self._impl = OneRecClient.load_from_config(model_path)
        raise NotImplementedError(
            "真实 onerec 模型加载尚未实现，请在 _RealRecommender.__init__ 中接入"
        )

    def predict(self, uid: str, top_k: int) -> OneRecResponse:  # pragma: no cover
        raise NotImplementedError


_recommender: Optional[_RealRecommender] = None


def _try_init_real() -> Optional[_RealRecommender]:
    if not settings.model_path:
        logger.info("ONEREC_MODEL_PATH 未配置，使用脚本化兜底召回池")
        return None
    try:
        return _RealRecommender(settings.model_path)
    except NotImplementedError as e:
        logger.warning("onerec 接入未完成 (%s)，使用脚本化兜底召回池", e)
        return None
    except Exception as e:  # noqa: BLE001
        logger.exception("加载真实 onerec 失败，使用脚本化兜底: %s", e)
        return None


def init() -> bool:
    """FastAPI startup 钩子调用。返回 True 表示真实 onerec 已就绪。"""
    global _recommender
    _recommender = _try_init_real()
    return _recommender is not None


def is_ready() -> bool:
    return _recommender is not None


def recommend(uid: str, top_k: int) -> OneRecResponse:
    """
    主入口 —— 路由层调用此函数。
    1. 真实 onerec 已加载 → 走模型推断
    2. 否则 → 用 mock_pool 拼出与真实形态一致的 OneRecResponse
    """
    if _recommender is not None:
        try:
            return _recommender.predict(uid=uid, top_k=top_k)
        except Exception as e:  # noqa: BLE001
            logger.exception("onerec.predict 抛错，本次降级到 mock_pool: %s", e)

    return build_mock_response(uid=uid, top_k=top_k)
