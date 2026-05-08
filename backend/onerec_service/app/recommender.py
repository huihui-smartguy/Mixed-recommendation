"""
召回核心 —— 真实 onerec 框架的接入点。

═══════════════════════════════════════════════════════════════════════════
 ⚠️ 接入真实 onerec 时只需改本文件，schemas.py / main.py 保持不动。
═══════════════════════════════════════════════════════════════════════════

设计目标：
  1. 暴露一个稳定的 recommend(user_id, top_k) 函数给 FastAPI 路由调用
  2. 真实 onerec 库加载失败 / 未配置模型路径时，自动降级到 mock_pool，
     保证 Node BFF 的契约联调不被打断
  3. 把"工程封装"和"算法逻辑"分离 —— 想换召回算法只需改 _RealRecommender
"""

from __future__ import annotations

import logging
from typing import List, Optional

from .config import settings
from .mock_pool import get_pool

logger = logging.getLogger("onerec.recommender")


class _RealRecommender:
    """
    真实 onerec 模型适配器。

    TODO（接入步骤，按你们 Python onerec 库的实际 API 调整）：
        1. pip 安装：pip install onerec  （或公司私有源）
        2. 取消下面 import 的注释；把 model_path 指向你们的模型 checkpoint
        3. 在 predict() 内把 onerec 输出的 item 字段映射到 schemas.OneRecItem
        4. 删除/缩减 mock_pool.py 即可

    示例（伪代码）：
        from onerec.api import OneRecRecommender as _Native

        class _RealRecommender:
            def __init__(self, model_path: str):
                self._impl = _Native.load_from_config(model_path)

            def predict(self, user_id: str, top_k: int) -> List[dict]:
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
    """

    def __init__(self, model_path: str) -> None:
        # TODO: 替换为真实 import
        # from onerec.api import OneRecRecommender as _Native
        # self._impl = _Native.load_from_config(model_path)
        raise NotImplementedError(
            "真实 onerec 模型加载尚未实现，请在 _RealRecommender.__init__ 中接入"
        )

    def predict(self, user_id: str, top_k: int) -> List[dict]:  # pragma: no cover
        raise NotImplementedError


_recommender: Optional[_RealRecommender] = None


def _try_init_real() -> Optional[_RealRecommender]:
    """启动时尝试加载真实 onerec；失败则返回 None，由路由层降级。"""
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


def recommend(user_id: str, top_k: int) -> List[dict]:
    """
    主入口 —— 路由层调用此函数。

    1. 真实 onerec 已加载 → 走模型推断
    2. 否则 → 用 mock_pool 截取 top_k，保证前端可联调
    """
    if _recommender is not None:
        try:
            return _recommender.predict(user_id=user_id, top_k=top_k)
        except Exception as e:  # noqa: BLE001
            logger.exception("onerec.predict 抛错，本次降级到 mock_pool: %s", e)

    pool = get_pool(user_id)
    return pool[:top_k]
