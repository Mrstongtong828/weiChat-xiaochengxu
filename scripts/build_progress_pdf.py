# -*- coding: utf-8 -*-
"""生成《牙医仪器检修小程序 · 项目进度报告》存底 PDF（reportlab + CJK 字体）。

内容来源：项目进度表_2026-06-22.md 与 7月上线总控表_2026-06-22.md。
状态 emoji 在 PDF 中映射为带色文字标签（CID 字体不含 emoji 字形）。
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

BASE = Path(r"E:\小程序开发\docte")
OUT = BASE / "项目进度报告_2026-06-22.pdf"

# ---- 中文字体 ----
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
FONT = "STSong-Light"

# ---- 配色 ----
DARK_BLUE = colors.HexColor("#1F4D78")
BLUE = colors.HexColor("#2E74B5")
HEADER_FILL = colors.HexColor("#E8EEF5")
LIGHT_FILL = colors.HexColor("#F7F9FC")
RISK_FILL = colors.HexColor("#FFF2CC")
PASS_FILL = colors.HexColor("#E2F0D9")
BORDER = colors.HexColor("#B7C9DD")
GREEN = colors.HexColor("#2E7D32")
AMBER = colors.HexColor("#B8860B")
RED = colors.HexColor("#C0392B")
ORANGE = colors.HexColor("#D2691E")
GRAY = colors.HexColor("#808080")

# 行底色（按状态）
ROW_FILL = {
    "已完成": colors.HexColor("#E2F0D9"),
    "进行中": colors.HexColor("#FFF8E1"),
    "未开始": colors.HexColor("#F4F6F9"),
    "阻断": colors.HexColor("#F8D7DA"),
    "未完成": colors.HexColor("#FBE4E6"),
    "待确认": colors.HexColor("#FFF2CC"),
}

# emoji -> (标签, 颜色)
STATUS_MAP = [
    ("✅", "已完成", GREEN),
    ("🟡", "进行中", AMBER),
    ("⬜", "未开始", GRAY),
    ("⛔", "阻断", RED),
    ("❌", "未完成", RED),
    ("⚠️", "待确认", ORANGE),
]


def conv(text):
    """把含 emoji 的状态文字转成纯文字标签。返回 (标签文本, 主标签key)。"""
    s = str(text)
    key = None
    for emo, label, _ in STATUS_MAP:
        if emo in s:
            s = s.replace(emo, label)
            if key is None:
                key = label
    return s, key


styles = getSampleStyleSheet()


def P(text, size=8.4, color=colors.black, align=TA_LEFT, bold=False, leading=None):
    st = ParagraphStyle(
        f"p{size}{align}{bold}",
        parent=styles["Normal"],
        fontName=FONT,
        fontSize=size,
        textColor=color,
        alignment=align,
        leading=leading or size * 1.32,
    )
    txt = str(text).replace("\n", "<br/>")
    if bold:
        txt = f"<b>{txt}</b>"
    return Paragraph(txt, st)


def H(text, size=14, color=BLUE, space_before=10, space_after=5):
    st = ParagraphStyle(
        f"h{size}",
        parent=styles["Normal"],
        fontName=FONT,
        fontSize=size,
        textColor=color,
        spaceBefore=space_before,
        spaceAfter=space_after,
        leading=size * 1.25,
    )
    return Paragraph(f"<b>{text}</b>", st)


def note(title, body, fill=PASS_FILL):
    inner = [[P(f"<b>{title}</b>", size=9.6, color=DARK_BLUE)], [P(body, size=8.8)]]
    t = Table(inner, colWidths=[17.4 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def make_table(headers, rows, widths, status_col=None, font_size=8.0):
    data = [[P(h, size=8.4, color=colors.black, align=TA_CENTER, bold=True) for h in headers]]
    row_keys = []
    for row in rows:
        cells = []
        key_for_row = None
        for i, val in enumerate(row):
            text, key = conv(val)
            color = colors.black
            if status_col is not None and i == status_col and key:
                key_for_row = key
                color = dict((lbl, c) for _, lbl, c in STATUS_MAP).get(key, colors.black)
                cells.append(P(text, size=font_size, color=color, align=TA_CENTER, bold=True))
            else:
                align = TA_CENTER if (status_col is not None and i == status_col) else TA_LEFT
                cells.append(P(text, size=font_size, color=color, align=align))
        data.append(cells)
        row_keys.append(key_for_row)

    t = Table(data, colWidths=[w * cm for w in widths], repeatRows=1)
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_FILL),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    for idx, key in enumerate(row_keys, start=1):
        fill = ROW_FILL.get(key)
        if fill:
            ts.append(("BACKGROUND", (0, idx), (-1, idx), fill))
        else:
            ts.append(("BACKGROUND", (0, idx), (0, idx), LIGHT_FILL))
    t.setStyle(TableStyle(ts))
    return t


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.setFillColor(colors.HexColor("#888888"))
    canvas.drawCentredString(
        A4[0] / 2, 12 * mm,
        f"牙医仪器检修小程序 · 项目进度报告（2026-06-22）　第 {doc.page} 页",
    )
    canvas.restoreState()


def build():
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        topMargin=1.6 * cm,
        bottomMargin=1.6 * cm,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        title="牙医仪器检修小程序 · 项目进度报告",
        author="项目负责人",
    )
    el = []

    # 封面标题
    el.append(Spacer(1, 4))
    el.append(P("牙医仪器检修小程序", size=22, color=DARK_BLUE, align=TA_CENTER, bold=True))
    el.append(Spacer(1, 4))
    el.append(P("项目进度报告 · 存底", size=15, color=BLUE, align=TA_CENTER, bold=True))
    el.append(Spacer(1, 6))
    el.append(P("统计时间：2026-06-22　|　目标：2026 年 7 月上线", size=9.5, color=colors.HexColor("#555555"), align=TA_CENTER))
    el.append(P("对照文档：《微信小程序 7 月上线任务分配与交付标准》(2026-06-21 版)", size=9, color=colors.HexColor("#777777"), align=TA_CENTER))
    el.append(Spacer(1, 10))

    el.append(note(
        "总体判断",
        "小程序与后台代码功能已基本完成（16/16 主流程 + 合规整改），上线卡点为：①微信医疗器械类目审核（阻断）；"
        "②正式环境部署与微信支付/订阅/域名/索引等控制台配置；③真机与全流程验收尚未开始。代码侧无重大缺口，"
        "剩下的是“配置 + 审核 + 验收”三类工作。",
        PASS_FILL,
    ))
    el.append(Spacer(1, 4))

    # 一、总览
    el.append(H("一、总览结论", 14))
    el.append(make_table(
        ["维度", "完成度", "说明"],
        [
            ["小程序客户端代码功能", "✅ ~95%（16/16）", "仅余号码/资质等内容确认"],
            ["后端云函数代码", "✅ 已完成", "7 个云函数齐备，合规整改已写完"],
            ["后端部署（正式环境）", "❌ 未完成", "仅部署到开发云空间，5 个函数需重部署"],
            ["数据库索引", "❌ 未完成", "清单已写，控制台未创建"],
            ["微信平台/支付/订阅配置", "❌ 未完成", "域名、支付、模板 ID 均未配"],
            ["真机/全流程验收", "❌ 未开始", "排期 06-28 起"],
            ["类目审核（阻断项）", "⛔ 未通过", "医疗器械类目资质审核未过，发布前置阻断"],
        ],
        [5.0, 4.4, 8.0], status_col=1, font_size=8.4,
    ))

    # 二、功能完成度
    el.append(H("二、小程序客户端代码功能（16 / 16）", 14))
    feats = [
        ["1", "手机验证码登录 + token + 401 跳登录", "✅", "pages/login、api/auth.js、cloudHelpers.js"],
        ["2", "拒绝授权可恢复路径", "✅", "login/index.vue、PrivacyConsent.vue"],
        ["3", "报修建单（选设备 SN / 回寄地址自动带入）", "✅", "api/repair.js、createOrder"],
        ["4", "报修上传图片", "✅", "uploadRepairImage、uploadToCloud"],
        ["5", "订单进度/状态（列表+详情）", "✅", "getRepairList/Detail、getOrderList"],
        ["6", "查看/确认/拒绝报价", "✅", "confirm/rejectRepairQuote、rejectQuote"],
        ["7", "微信支付 requestPayment", "✅", "index.vue L2830、createWechatPayPayment"],
        ["8", "对公转账/付款凭证上传", "✅", "uploadRepairPaymentProof"],
        ["9", "发票申请", "✅", "api/content.js applyInvoice"],
        ["10", "确认收货 confirmReceipt", "✅", "confirmRepairReceipt 云函数"],
        ["11", "评价/回访（不满意转投诉）", "✅", "reviewOrder、submitOrderReview"],
        ["12", "投诉/建议提交 + 查看列表", "✅", "addComplaint/getComplaintList"],
        ["13", "订阅消息授权（全场景）", "✅", "requestStatusSubscription、sendOrderSubscription"],
        ["14", "设备档案页 listMyDevices", "✅", "getMyDevices、listMyDevices"],
        ["15", "隐私授权弹窗 + onNeedPrivacyAuthorization", "✅", "PrivacyConsent.vue"],
        ["16", "账号注销（软删除+脱敏）", "✅", "cancelAccount 云函数"],
    ]
    el.append(make_table(
        ["#", "功能", "状态", "证据"], feats,
        [1.0, 7.6, 1.8, 7.0], status_col=2, font_size=7.8,
    ))
    el.append(P("代码侧待确认（非编码缺口）：M5 客服热线号（暂用 0757-85775667 待确认）、客户可见资质/资料正式版本。",
                size=8, color=colors.HexColor("#777777")))

    el.append(PageBreak())

    # 三、最低上线门槛
    el.append(H("三、最低上线门槛（12 项 · 达成 0 / 12）", 14))
    gates = [
        ["1", "正式 AppID 真机登录成功", "✅", "❌ 真机未验收", "❌"],
        ["2", "正式库可建工单，后台可见", "✅", "❌ 未连正式环境", "❌"],
        ["3", "后台改状态，小程序进度同步", "✅", "❌ 未验收", "❌"],
        ["4", "后台发报价，小程序可确认", "✅", "❌ 未验收", "❌"],
        ["5", "微信支付或对公凭证至少一条可用", "✅", "❌ WX_PAY_* 未配置", "❌"],
        ["6", "发票申请与后台开票状态同步", "✅", "❌ 未验收", "❌"],
        ["7", "回寄物流小程序可见", "✅", "❌ 未验收", "❌"],
        ["8", "订阅消息成功/失败/拒绝可追踪", "✅", "❌ 模板 ID 未配", "❌"],
        ["9", "PC 后台正式域名 HTTPS 可访问", "—", "❌ 未部署", "❌"],
        ["10", "不依赖 localhost/mock/开发云空间", "—", "❌ 当前连开发云", "❌"],
        ["11", "数据库唯一+关键复合索引已创建", "✅清单", "❌ 控制台未创建", "❌"],
        ["12", "客户可见资料全部正式版本", "—", "⚠️ 热线/资质待确认", "⚠️"],
    ]
    el.append(make_table(
        ["#", "门槛", "代码", "部署/配置/验收", "综合"], gates,
        [1.0, 7.4, 2.0, 4.6, 2.4], status_col=4, font_size=7.8,
    ))
    el.append(P("门槛达成：0 / 12（代码就绪 8 项，但均卡在部署 / 配置 / 验收）。",
                size=8.4, color=RED, bold=True))

    # 四、里程碑
    el.append(H("四、上线里程碑", 14))
    el.append(make_table(
        ["阶段", "排期", "状态"],
        [
            ["正式资料锁定", "06-22 ~ 06-24", "🟡 进行中（今日起）"],
            ["正式环境部署", "06-25 ~ 06-27", "⬜ 未开始"],
            ["第一轮全流程验收", "06-28 ~ 06-30", "⬜ 未开始"],
            ["最终回归与提审准备", "07-01 ~ 07-03", "⬜ 未开始"],
            ["微信审核与发布", "07-04 起", "⬜ 未开始"],
        ],
        [6.0, 5.4, 6.0], status_col=2, font_size=8.4,
    ))

    # 五、阻断项与待办
    el.append(H("五、当前阻断项与待办（按优先级）", 14))
    el.append(make_table(
        ["优先级", "事项", "类型", "负责人"],
        [
            ["⛔ 最高（阻断）", "微信医疗器械类目审核未通过，需补齐《医疗器械生产许可证》《互联网信息服务备案》等资质并提交", "平台审核", "吴彤彤"],
            ["🔴 高", "重新部署 5 个云函数（含合规整改）+ 切正式云空间", "部署", "苏凤冰"],
            ["🔴 高", "配置微信支付 WX_PAY_*、回调 URL", "配置", "陈莎→苏凤冰"],
            ["🔴 高", "申请并配置订阅消息模板 ID（报修/签收/报价/付款/发货/完成/回访）", "配置", "陈莎"],
            ["🔴 高", "控制台创建数据库索引（order_no 唯一、sn 唯一前先清洗重复）", "数据库", "苏凤冰"],
            ["🟠 中", "PC 后台切正式 URL + 生产构建 + 正式域名 HTTPS 部署", "部署", "蔡珠琪"],
            ["🟠 中", "配置微信合法域名（request/uploadFile/downloadFile）", "配置", "陈莎"],
            ["🟠 中", "小程序用正式 AppID 构建体验版 → 真机跑全流程", "验收", "郑佳华"],
            ["🟡 低", "确认权威客服热线号、客户可见资料/资质正式版", "资料", "钟浩霆/吴彤彤"],
        ],
        [3.0, 8.6, 2.4, 3.4], status_col=None, font_size=7.8,
    ))

    el.append(PageBreak())

    # 总控表
    el.append(P("7 月上线总控表", size=18, color=DARK_BLUE, align=TA_CENTER, bold=True))
    el.append(Spacer(1, 3))
    el.append(P("负责人：吴彤彤（上线总控）　|　建立日期：2026-06-22　|　目标上线：2026 年 7 月",
                size=9.5, color=colors.HexColor("#555555"), align=TA_CENTER))
    el.append(Spacer(1, 8))
    el.append(note(
        "使用说明",
        "覆盖 6 人全部任务，每天至少更新一次；阻塞项必须有下一步动作。"
        "状态：已完成 / 进行中 / 未开始 / 阻断。",
        PASS_FILL,
    ))
    el.append(Spacer(1, 4))

    CH = ["序号", "任务", "负责人", "依赖", "状态", "阻塞原因 / 下一步动作", "预计完成"]
    CW = [1.2, 4.6, 1.8, 2.5, 1.5, 4.4, 2.0]

    el.append(H("一、阻断项（最高优先，未关闭不得提审）", 12, DARK_BLUE))
    el.append(make_table(CH, [
        ["B1", "微信医疗器械类目审核通过", "吴彤彤", "客户资质证照", "⛔",
         "类目审核未通过；补齐《医疗器械生产许可证》《互联网信息服务备案凭证》后在「类目管理」重新提交", "待定（卡发布）"],
    ], CW, status_col=4, font_size=7.4))

    def section(title, rows):
        el.append(H(title, 11, BLUE, space_before=8, space_after=4))
        el.append(make_table(CH, rows, CW, status_col=4, font_size=7.2))

    el.append(H("二、按人分工", 12, DARK_BLUE))
    section("客户资料 · 吴彤彤", [
        ["A1", "建立并每日维护本总控表", "吴彤彤", "无", "✅", "本表已建立，进入每日更新", "2026-06-22"],
        ["A2", "收齐正式资料（AppID/云空间/商户号/PC 域名/客服/Logo/介绍/政策）", "吴彤彤", "客户提供", "⬜", "向客户索取并逐项登记状态", "2026-06-24"],
        ["A3", "确认权威客服热线号", "吴彤彤", "客户确认", "🟡", "暂用 0757-85775667，待客户确认", "2026-06-24"],
        ["A4", "组织每日进度同步", "吴彤彤", "各人反馈", "🟡", "已启动，跟踪支付/订阅/URL/索引/真机", "2026-07-03"],
    ])
    section("微信平台 / 支付 / 订阅 · 陈莎", [
        ["C1", "配置合法域名（request/upload/download）", "陈莎", "正式域名", "⬜", "依赖 D4 URL 化、F3 正式域名", "2026-06-24"],
        ["C2", "正式 AppID 手机号授权 + openid", "陈莎", "E2 体验版", "⬜", "代码已实现，待真机验证", "2026-06-25"],
        ["C3", "申请订阅模板 ID（报修/签收/报价/付款/发货/完成/回访）", "陈莎", "平台审核", "⬜", "场景代码已就绪，待申请回填", "2026-06-26"],
        ["C4", "微信支付商户号/证书/APIv3/回调", "陈莎", "客户商户资料", "⬜", "退款代码已就绪，待 WX_PAY_*", "2026-06-26"],
        ["C5", "小额真实支付 + 订阅消息测试", "陈莎", "D/E 联调", "⬜", "依赖支付配置与正式环境", "2026-06-28"],
    ])
    section("uniCloud / 数据库 / 云函数 · 苏凤冰", [
        ["D1", "创建/接入客户正式云空间", "苏凤冰", "客户账号权限", "⬜", "当前开发云 env-00jy6bcqqsjw，待切正式", "2026-06-25"],
        ["D2", "部署 7 个云函数（含整改重部署 5 个）", "苏凤冰", "代码冻结", "🟡", "代码就绪；曾部署开发云，需重部署正式", "2026-06-26"],
        ["D3", "配置正式环境变量（登录/支付/订阅）", "苏凤冰", "陈莎参数", "⬜", "依赖 C3/C4", "2026-06-27"],
        ["D4", "PC 后台云函数 URL 化并交付", "苏凤冰", "D2", "⬜", "交蔡珠琪配置", "2026-06-27"],
        ["D5", "创建集合/schema/索引（order_no 唯一、sn 唯一前清洗）", "苏凤冰", "正式云空间", "⬜", "清单已写，控制台未创建", "2026-06-27"],
    ])
    section("小程序端 / 真机 · 郑佳华", [
        ["E1", "manifest/project 用正式 AppID 且无密钥", "郑佳华", "C 正式 AppID", "🟡", "当前 wx25289fbe4a3bf011，待确认正式主体", "2026-06-26"],
        ["E2", "构建体验版（二维码+版本号）", "郑佳华", "正式云函数", "🟡", "已生产构建，待连正式环境", "2026-06-27"],
        ["E3", "真机跑主流程（登录→…→评价）", "郑佳华", "后台配合", "⬜", "16 项功能已实现，待真机验收", "2026-06-29"],
        ["E4", "验证订阅授权（允许/拒绝/失败不阻塞）", "郑佳华", "C3", "⬜", "依赖模板配置", "2026-06-29"],
        ["E5", "整理小程序问题清单并复测", "郑佳华", "第一轮验收", "⬜", "—", "2026-06-30"],
    ])
    section("PC 后台部署 / 验收 · 蔡珠琪", [
        ["F1", "配置 PC 正式 VITE_* URL", "蔡珠琪", "D4", "⬜", "缺配置会报错（已加兜底）", "2026-06-27"],
        ["F2", "生产构建 + 检查命令", "蔡珠琪", "正式 URL", "⬜", "检查脚本已就绪", "2026-06-28"],
        ["F3", "部署正式域名 + HTTPS", "蔡珠琪", "部署权限", "⬜", "—", "2026-06-28"],
        ["F4", "验收后台核心业务（工单/报价/库存/结算/发票/物流/审计/统计）", "蔡珠琪", "云函数+DB", "⬜", "功能已就绪，待验收", "2026-06-30"],
        ["F5", "复核角色权限与敏感按钮（成本/退款脱敏）", "蔡珠琪", "账号角色", "🟡", "RBAC 脱敏已实现，待账号验收", "2026-06-30"],
    ])
    section("资料核对 / 全流程验收 · 钟浩霆", [
        ["G1", "核对客户可见资料", "钟浩霆", "A2", "⬜", "依赖资料收齐", "2026-06-26"],
        ["G2", "真实业务跑完整闭环", "钟浩霆", "前后台联调", "⬜", "—", "2026-06-29"],
        ["G3", "建立问题清单", "钟浩霆", "验收产生", "⬜", "—", "2026-06-30"],
        ["G4", "最终复验（阻塞清零）", "钟浩霆", "修复完成", "⬜", "—", "2026-07-02"],
        ["G5", "给出最终上线建议", "钟浩霆", "最终复验", "⬜", "—", "2026-07-02"],
    ])

    el.append(Spacer(1, 6))
    el.append(note(
        "上线判定规则",
        "任一最低上线门槛未过原则上不得提审；有条件上线须由吴彤彤在《最终上线确认单》写明风险、兜底方案、"
        "负责人、预计修复时间。",
        RISK_FILL,
    ))

    doc.build(el, onFirstPage=_footer, onLaterPages=_footer)
    print("PDF written:", OUT)


if __name__ == "__main__":
    build()
