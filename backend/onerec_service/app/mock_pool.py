"""
脚本化兜底召回池 —— 与 docs/onerec_example.md / docs/customer_sample.md 形态对齐。

5 个客户的 uid 对应 docs/customer_sample.md 中的真实 Cust_Id：
    1000000001 R3 平衡型 男 43
    1000000002 R4 进取型 女 46
    1000000004 R2 稳健型 男 46
    1000000008 R5 激进型 男 55
    1000000011 R1 保守型 女 29

接入真实 onerec 后，本模块可以删除，或保留作为 health check 兜底。
"""

from __future__ import annotations

from typing import Dict, List

from .schemas import OneRecResponse, RecommendationGroup

# 5 位客户的 user_profile 描述（与 src/services/mockData.ts 同步）
_USER_PROFILES: Dict[str, str] = {
    "1000000001": (
        "客户风险等级R3，金融资产总额335.20万元。已投资资产335.20万元，"
        "其中现金管理类109.00万元、固定收益类27.10万元、权益类14.70万元、"
        "保障类10.80万元、另类9.80万元、其他5.60万元。累计总收益19.40万元。"
        "该客户 年龄43，职业108.00，性别男，学历大专，投资经验1-3年。"
    ),
    "1000000002": (
        "客户风险等级R4，金融资产总额589.30万元。已投资资产589.30万元，"
        "其中现金管理类274.40万元、固定收益类185.10万元、权益类134.80万元、"
        "保障类54.60万元、另类38.20万元、其他6.10万元。累计总收益17.10万元。"
        "该客户 年龄46，职业124.00，性别女，学历本科，投资经验10年以上。"
    ),
    "1000000004": (
        "客户风险等级R2，金融资产总额138.20万元。已投资资产138.20万元，"
        "其中现金管理类94.40万元、固定收益类41.80万元、权益类9.60万元、"
        "保障类8.90万元、另类4.70万元、其他1.30万元。累计总收益6.60万元。"
        "该客户 年龄46，职业116.00，性别男，学历硕士，投资经验10年以上。"
    ),
    "1000000008": (
        "客户风险等级R5，金融资产总额1882.90万元。已投资资产1882.90万元，"
        "其中现金管理类250.80万元、固定收益类286.60万元、权益类283.80万元、"
        "保障类126.40万元、另类42.80万元、其他44.80万元。累计总收益111.10万元。"
        "该客户 年龄55，职业114.00，性别男，学历本科，投资经验10年以上。"
    ),
    "1000000011": (
        "客户风险等级R1，金融资产总额98.60万元。已投资资产98.60万元，"
        "其中现金管理类33.30万元、固定收益类12.10万元、权益类0.00万元、"
        "保障类0.00万元、另类0.00万元、其他0.00万元。累计总收益4.90万元。"
        "该客户 年龄29，职业102.00，性别女，学历本科，投资经验1-3年。"
    ),
}

_HIST_PRODUCTS: Dict[str, str] = {
    "1000000001": (
        "<|sid_begin|><s_a_4200><s_b_600><s_c_4580><|sid_end|>: 产品 P01592 属于理财-短期理财，"
        "风险等级R2，持有市值 67502.00，总收益 8852.00。 "
        "<|sid_begin|><s_a_2610><s_b_1283><s_c_8182><|sid_end|>: 产品 P01129 属于基金-混合基金，"
        "风险等级R3，持有市值 51887.00，总收益 1958.00。"
    ),
    "1000000002": (
        "<|sid_begin|><s_a_1661><s_b_2479><s_c_1254><|sid_end|>: 产品 P01257 属于理财-中期理财，"
        "风险等级R3，持有市值 160689.00，总收益 17383.00。"
    ),
    "1000000004": (
        "<|sid_begin|><s_a_4200><s_b_4828><s_c_4580><|sid_end|>: 产品 P04431 属于理财-短期理财，"
        "风险等级R2，持有市值 35796.00，总收益 6036.00。"
    ),
    "1000000008": (
        "<|sid_begin|><s_a_4200><s_b_7077><s_c_4195><|sid_end|>: 产品 P01740 属于基金-ETF基金，"
        "风险等级R5，持有市值 364925.00，总收益 14140.00。"
    ),
    "1000000011": (
        "<|sid_begin|><s_a_2610><s_b_3184><s_c_1857><|sid_end|>: 产品 P00863 属于理财-结构性存款，"
        "风险等级R1，持有市值 17252.00，总收益 2019.00。"
    ),
}


def _funds_for(uid: str) -> RecommendationGroup:
    if uid == "1000000001":
        return RecommendationGroup(
            recommended_pids=["P02382", "P00265"],
            recommended_texts=[
                "FOF基金 - 基金类产品，风险等级为R3，产品名称为博时恒泽稳健号。历史收益水平(%)2.30。"
                "产品说明：偏债混合 FOF，注重回撤控制。",
                "混合基金 - 基金类产品，风险等级为R3，产品名称为广发聚丰A号。历史收益水平(%)33.92。"
                "产品说明：聚焦周期赛道，弹性较高。",
            ],
            similarity=[0.0019, 0.0011],
            recommendation_count=2,
        )
    if uid == "1000000002":
        return RecommendationGroup(
            recommended_pids=["P03806", "P03555"],
            recommended_texts=[
                "ETF基金 - 基金类产品，风险等级为R4，产品名称为国泰纳指QDII号。历史收益水平(%)4.26。"
                "产品说明：跟踪纳斯达克100指数。",
                "股票基金 - 基金类产品，风险等级为R3，产品名称为广发聚丰A号。历史收益水平(%)20.74。"
                "产品说明：聚焦周期赛道。",
            ],
            similarity=[0.0028, 0.0016],
            recommendation_count=2,
        )
    if uid == "1000000008":
        return RecommendationGroup(
            recommended_pids=["P03771", "P00190", "P01244"],
            recommended_texts=[
                "ETF基金 - 基金类产品，风险等级为R5，产品名称为国泰纳斯达克100ETF号。历史收益水平(%)4.48。"
                "产品说明：海外科技龙头集中投资。",
                "FOF基金 - 基金类产品，风险等级为R4，产品名称为兴全合宜号。历史收益水平(%)5.39。"
                "产品说明：行业分散的进取型 FOF。",
                "混合基金 - 基金类产品，风险等级为R4，产品名称为汇添富消费机遇号。历史收益水平(%)1.03。"
                "产品说明：聚焦消费赛道。",
            ],
            similarity=[0.0035, 0.0024, 0.0018],
            recommendation_count=3,
        )
    if uid == "1000000011":
        return RecommendationGroup(
            recommended_pids=["P00589"],
            recommended_texts=[
                "货币基金 - 基金类产品，风险等级为R1，产品名称为天弘货币号。历史收益水平(%)2.09。"
                "产品说明：T+0 现金管理工具。"
            ],
            similarity=[0.0009],
            recommendation_count=1,
        )
    # 默认
    return RecommendationGroup(
        recommended_pids=["P00301"],
        recommended_texts=[
            "FOF基金 - 基金类产品，风险等级为R3，产品名称为博时恒泽号。历史收益水平(%)2.08。"
            "产品说明：偏债混合 FOF。"
        ],
        similarity=[0.001855],
        recommendation_count=1,
    )


def _wealth_for(uid: str) -> RecommendationGroup:
    if uid == "1000000001":
        return RecommendationGroup(
            recommended_pids=["P00445", "P02174"],
            recommended_texts=[
                "定期理财 - 理财类产品，风险等级为R2，产品名称为定期理财（180天封闭）。历史收益水平(%)2.81。"
                "产品说明：稳健型客户压舱石。",
                "大额存单 - 理财类产品，风险等级为R2，产品名称为大额存单（私银专享）。历史收益水平(%)3.17。"
                "产品说明：低波动锁定收益。",
            ],
            similarity=[0.0021, 0.0014],
            recommendation_count=2,
        )
    if uid == "1000000002":
        return RecommendationGroup(
            recommended_pids=["P03432"],
            recommended_texts=[
                "长期理财 - 理财类产品，风险等级为R3，产品名称为悦丰利增盈号。历史收益水平(%)4.55。"
                "产品说明：14 个月封闭，业绩基准 2.40%-2.70%。"
            ],
            similarity=[0.0023],
            recommendation_count=1,
        )
    if uid == "1000000004":
        return RecommendationGroup(
            recommended_pids=["P00697", "P01023"],
            recommended_texts=[
                "结构性存款 - 理财类产品，风险等级为R2，产品名称为天添鑫中短债号。历史收益水平(%)2.27。"
                "产品说明：每日开放，挂钩中债指数。",
                "封闭式理财 - 理财类产品，风险等级为R2，产品名称为季季鑫封闭式475号。历史收益水平(%)1.20。"
                "产品说明：3 个月封闭。",
            ],
            similarity=[0.0017, 0.0012],
            recommendation_count=2,
        )
    if uid == "1000000008":
        return RecommendationGroup(
            recommended_pids=[],
            recommended_texts=[],
            similarity=[],
            recommendation_count=0,
        )
    if uid == "1000000011":
        return RecommendationGroup(
            recommended_pids=["P03904", "P04121"],
            recommended_texts=[
                "结构性存款 - 理财类产品，风险等级为R1，产品名称为天天盈771号。历史收益水平(%)0.61。"
                "产品说明：保守型客户压舱石。",
                "短期理财 - 理财类产品，风险等级为R1，产品名称为可转债优选号。历史收益水平(%)0.94。"
                "产品说明：短期收益增强。",
            ],
            similarity=[0.0011, 0.0008],
            recommendation_count=2,
        )
    return RecommendationGroup(
        recommended_pids=["P00647"],
        recommended_texts=[
            "现金管理类 - 理财类产品，风险等级为R2，产品名称为可转债优选号。历史收益水平(%)2.92。"
        ],
        similarity=[0.001092],
        recommendation_count=1,
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

    profile = _USER_PROFILES.get(uid) or _USER_PROFILES["1000000001"]
    hist = _HIST_PRODUCTS.get(uid) or _HIST_PRODUCTS["1000000001"]

    return OneRecResponse(
        uid=uid,
        user_profile=profile,
        hist_products=hist,
        recommendations_by_type={
            "基金": _truncate(funds),
            "理财": _truncate(wealth),
        },
    )


# --- 兼容旧调用（仅供回归调试） ---
def get_pool(user_id: str) -> List[dict]:
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
