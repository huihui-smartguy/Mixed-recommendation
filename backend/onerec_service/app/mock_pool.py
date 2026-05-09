"""
脚本化兜底召回池 —— 与 docs/onerec_example.md 形态对齐。

接入真实 onerec 后，本模块可以删除，或保留作为 health check 兜底。
"""

from __future__ import annotations

from typing import Dict, List

from .schemas import OneRecResponse, RecommendationGroup

# 三种风险偏好的 user_profile 描述（与前端 mock 对齐）
_USER_PROFILES: Dict[str, str] = {
    "1000000261": (
        "客户风险等级R3，金融资产总额128.00万元。已投资资产128.00万元，"
        "其中现金管理类12.60万元、固定收益类85.10万元、权益类4.60万元、"
        "保障类25.70万元、另类0.00万元。累计总收益5.20万元。"
        "该客户 年龄42，职业122.00，性别1.00，学历4.00，投资经验5-10年。"
    ),
    "1000000054": (
        "客户风险等级R4，金融资产总额360.00万元。已投资资产360.00万元，"
        "其中现金管理类38.40万元、固定收益类155.30万元、权益类108.20万元、"
        "保障类42.30万元、另类15.80万元。累计总收益24.50万元。"
        "该客户 年龄36，职业105.00，性别2.00，学历5.00，投资经验5-10年。"
    ),
    "1000000312": (
        "客户风险等级R5，金融资产总额840.00万元。已投资资产840.00万元，"
        "其中现金管理类21.50万元、固定收益类94.30万元、权益类520.80万元、"
        "保障类68.40万元、另类135.00万元。累计总收益128.20万元。"
        "该客户 年龄31，职业104.00，性别1.00，学历6.00，投资经验10年以上。"
    ),
}

_HIST_PRODUCTS: Dict[str, str] = {
    "1000000261": (
        "<|sid_begin|><s_a_4200><s_b_600><s_c_4580><|sid_end|>: 产品属于固收类，风险等级为R2，"
        "客户投资 60000.00 元购买此产品。 持有市值 62000.00，总收益 2000.00。 "
        "<|sid_begin|><s_a_2610><s_b_3184><s_c_1857><|sid_end|>: 产品属于现金管理类，风险等级为R1，"
        "客户投资 20000.00 元购买此产品。 持有市值 20120.00，总收益 120.00。"
    ),
    "1000000054": (
        "<|sid_begin|><s_a_1661><s_b_2479><s_c_1254><|sid_end|>: 产品属于权益类，风险等级为R3，"
        "客户投资 80000.00 元购买此产品。 持有市值 92000.00，总收益 12000.00。"
    ),
    "1000000312": (
        "<|sid_begin|><s_a_1661><s_b_185><s_c_8191><|sid_end|>: 产品属于权益类，风险等级为R5，"
        "客户投资 200000.00 元购买此产品。 持有市值 256000.00，总收益 56000.00。 "
        "<|sid_begin|><s_a_4200><s_b_7077><s_c_4195><|sid_end|>: 产品属于另类，风险等级为R4，"
        "客户投资 100000.00 元购买此产品。 持有市值 118000.00，总收益 18000.00。"
    ),
}


def _funds_for(uid: str) -> RecommendationGroup:
    if uid == "1000000054":
        return RecommendationGroup(
            recommended_pids=["P00601", "P00708"],
            recommended_texts=[
                "FOF - 基金类产品，风险等级为R3，产品名称为博时恒泽稳健号。历史收益水平(%)2.08。"
                "产品说明：股债搭配的偏债混合 FOF，注重回撤控制。",
                "权益型 - 基金类产品，风险等级为R3，产品名称为广发聚丰A号。历史收益水平(%)20.74。"
                "产品说明：聚焦周期赛道的偏股混合，弹性较高。",
            ],
            recommendation_count=2,
            similarity=[0.0023, 0.0017],
        )
    if uid == "1000000312":
        return RecommendationGroup(
            recommended_pids=["P00921", "P00712"],
            recommended_texts=[
                "QDII-基金类产品，风险等级为R5，产品名称为国泰纳斯达克100ETF号。历史收益水平(%)28.6。"
                "产品说明：跟踪纳斯达克100指数，配置全球科技龙头。",
                "权益型 - 基金类产品，风险等级为R4，产品名称为泉果消费机遇A号。历史收益水平(%)6.84。"
                "产品说明：聚焦消费赛道的偏股混合。",
            ],
            recommendation_count=2,
            similarity=[0.0019, 0.0014],
        )
    # CUST-A / 默认
    return RecommendationGroup(
        recommended_pids=["P00301"],
        recommended_texts=[
            "FOF - 基金类产品，风险等级为R3，产品名称为博时恒泽号。历史收益水平(%)2.08。"
            "产品说明：股债搭配的偏债混合 FOF，注重回撤控制，适合稳健型投资者。"
        ],
        recommendation_count=1,
        similarity=[0.001855],
    )


def _wealth_for(uid: str) -> RecommendationGroup:
    if uid == "1000000054":
        return RecommendationGroup(
            recommended_pids=["P00833"],
            recommended_texts=[
                "现金管理类 - 理财类产品，风险等级为R2，产品名称为悦丰利增盈号。历史收益水平(%)2.55。"
                "产品说明：14 个月封闭，业绩基准 2.40%-2.70%，稳健增值。"
            ],
            recommendation_count=1,
            similarity=[0.0011],
        )
    if uid == "1000000312":
        return RecommendationGroup(
            recommended_pids=[],
            recommended_texts=[],
            recommendation_count=0,
            similarity=[],
        )
    # 默认
    return RecommendationGroup(
        recommended_pids=["P00647"],
        recommended_texts=[
            "现金管理类 - 理财类产品，风险等级为R2，产品名称为可转债优选号。历史收益水平(%)2.92。"
            "产品说明：固定收益类理财产品，R1-R2 风险，适合保守与稳健型投资者。"
        ],
        recommendation_count=1,
        similarity=[0.001092],
    )


def build_mock_response(uid: str, top_k: int = 8) -> OneRecResponse:
    """
    把 uid 映射到对照样例，返回与 docs/onerec_example.md 完全一致的 OneRecResponse 形态。
    top_k 仅用于截断，每个分组最多保留前 top_k 条推荐。
    """
    funds = _funds_for(uid)
    wealth = _wealth_for(uid)

    def _truncate(g: RecommendationGroup) -> RecommendationGroup:
        return RecommendationGroup(
            raw_pid=g.raw_pid[:top_k],
            raw_texts=g.raw_texts[:top_k],
            sid_input=g.sid_input[:top_k],
            sid_matched=g.sid_matched[:top_k],
            recommended_pids=g.recommended_pids[:top_k],
            recommended_texts=g.recommended_texts[:top_k],
            recommendation_count=min(g.recommendation_count, top_k),
            similarity=g.similarity[:top_k],
        )

    profile = _USER_PROFILES.get(uid) or _USER_PROFILES["1000000261"]
    hist = _HIST_PRODUCTS.get(uid) or _HIST_PRODUCTS["1000000261"]

    return OneRecResponse(
        uid=uid,
        user_profile=profile,
        hist_products=hist,
        recommendations_by_type={
            "基金": _truncate(funds),
            "理财": _truncate(wealth),
        },
    )


# --- 兼容旧调用 ---
def get_pool(user_id: str) -> List[dict]:
    """旧 API：把新形态展平成扁平 dict 列表，仅供回归调试，不推荐继续使用。"""
    resp = build_mock_response(user_id)
    out: List[dict] = []
    for big_cat, group in resp.recommendations_by_type.items():
        for pid, text, sim in zip(
            group.recommended_pids, group.recommended_texts, group.similarity or []
        ):
            out.append(
                {
                    "product_code": pid,
                    "product_name": text.split("产品名称为")[-1].split("。")[0]
                    if "产品名称为" in text
                    else pid,
                    "type": big_cat,
                    "recommendation": text,
                }
            )
    return out
