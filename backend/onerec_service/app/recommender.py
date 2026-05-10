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

    ──────────────────────────────────────────────────────────────────────────
    请求体（与 docs/request.md 一字不差）：

        POST /v1/completions HTTP/1.1
        Authorization: Bearer {your_api_key}

        {
          "model": "OneRec-8B-full-tunning",
          "prompt": "客户风险等级R3，金融资产总额335.20万元。已投资资产335.20万元，"
                    "其中现金管理类109.00万元、固定收益类27.10万元、权益类14.70万元、"
                    "保障类10.80万元、另类9.80万元、其他5.60万元。"
                    "累计总收益19.40万元。该客户 年龄43，职业108.00，"
                    "性别男，学历大专，投资经验1-3年。",
          "max_tokens": 512,
          "temperature": 0.9,
          "top_p": 0.95,
          "n": 3,
          "frequency_penalty": 0.5,
          "presence_penalty": 0.5
        }
    ──────────────────────────────────────────────────────────────────────────

    接入步骤（只改本文件，schemas.py / main.py 保持不动）：
        1. pip install onerec  （或公司私有源）
        2. 在 _build_request_body() 里把 customer_sample 的字段拼成 prompt 字符串
        3. 在 _RealRecommender.predict() 里：
           a) 用 uid 拉客户特征（customer_sample.md + own_sample.md）
           b) 调 _build_request_body() 拿请求体
           c) requests.post(${ONEREC_BASE_URL}/v1/completions, json=body)
           d) 把响应里的 recommendations_by_type 装进 OneRecResponse 返回
        4. 删除/缩减 mock_pool.py 即可
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


def build_request_body(user_profile: str, n: int = 3) -> dict:
    """
    构造 onerec /v1/completions 请求体（与 docs/request.md 完全一致）。
    本函数纯字符串/字典操作，便于单测覆盖。

    实参 user_profile 应是已经合成好的 prompt 字符串，例如：
        "客户风险等级R3，金融资产总额335.20万元。已投资资产335.20万元，..."
    """
    return {
        "model": "OneRec-8B-full-tunning",
        "prompt": user_profile,
        "max_tokens": 512,
        "temperature": 0.9,
        "top_p": 0.95,
        "n": n,
        "frequency_penalty": 0.5,
        "presence_penalty": 0.5,
    }


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
