# 牙医仪器检修小程序 · 项目进度汇报 - Design Spec

> Human-readable design narrative. Machine contract: `spec_lock.md` (Executor re-reads before every page; on divergence spec_lock wins).

## I. Project Information

| Item | Value |
| ---- | ----- |
| **Project Name** | 牙医仪器检修小程序 · 项目进度汇报 |
| **Canvas Format** | PPT 16:9 (1280×720) |
| **Page Count** | 12 |
| **Design Style** | briefing（进度通报） + swiss-minimal（瑞士极简） |
| **Target Audience** | 项目负责人、班委、6 人项目组成员 |
| **Use Case** | 每日 / 每周项目复盘会汇报；会后存档发给班委邮箱保管 |
| **Content Strategy** | 平衡（balanced）——忠实跟随进度表 + 总控表的事实，按 briefing 重组为可扫读看板；不新增任何来源外的数据或结论。 |
| **Created Date** | 2026-06-22 |

---

## II. Canvas Specification

| Property | Value |
| -------- | ----- |
| **Format** | PPT 16:9 |
| **Dimensions** | 1280×720 |
| **viewBox** | `0 0 1280 720` |
| **Margins** | 左右 72px，上下 56px（swiss 宽边距） |
| **Content Area** | 1136×608 |

---

## III. Visual Theme

### Theme Style

- **Mode**: briefing —— 中性、完整、可扫读；主题型页标题（陈述事实而非论点），同级条目等权重便于比对查找。
- **Visual style**: swiss-minimal —— 模块化栅格、锐利几何、强留白、近零装饰；直角矩形 rx=0，单一权重细线，结构本身承载页面。
- **Theme**: Light theme（近白底）
- **Tone**: 专业、克制、工程感、可信赖

### Color Scheme

| Role | HEX | Purpose |
| ---- | --- | ------- |
| **Background** | `#FFFFFF` | 页面底色 |
| **Secondary bg** | `#F4F7FB` | 看板分区 / 状态卡底（轻微抬升） |
| **Primary** | `#1565C0` | 主蓝：标题强调、栅格主色块、KPI、图标 |
| **Accent** | `#0D3B66` | 深蓝：页眉色带、章节锚点、深色数据块 |
| **Secondary accent** | `#5B8DD9` | 浅蓝：进度填充、次级强调、分隔渐层 |
| **Body text** | `#1A2230` | 正文墨色 |
| **Secondary text** | `#5A6675` | 注释、副信息 |
| **Tertiary text** | `#93A0B0` | 页脚、补充信息、表格弱化项 |
| **Border/divider** | `#D7DEE7` | 卡片描边、细分隔线 |
| **Grid hairline** | `#E5EAF0` | 栅格基线 / 表格内细线（比分隔线更浅） |
| **Success** | `#2E7D32` | 已完成 / 95%（绿） |
| **Caution** | `#B7791F` | 进行中（琥珀） |
| **Warning** | `#D32F2F` | 阻断 / 未完成 / 0-12（红） |

> 状态用绿 / 琥珀 / 红做交通灯式语义编码（数据编码而非装饰），其余页面遵守 swiss 单点强调：主蓝只在一个概念区出现，场域保持近白。

---

## IV. Typography System

### Font Plan

**Typography direction**: 现代中文无衬线 + 强字号层级（swiss 以字重对比承载性格）；标题用黑体显字重领衔，正文用雅黑常规字重。

| Role | Chinese | English | Fallback tail |
| ---- | ------- | ------- | ------------- |
| **Title** | `SimHei` | `Arial` | `sans-serif` |
| **Body** | `"Microsoft YaHei"`, `"PingFang SC"` | `Arial` | `sans-serif` |
| **Emphasis** | `SimHei` | `Arial` | `sans-serif` |
| **Code** | — | `Consolas`, `"Courier New"` | `monospace` |

**Per-role font stacks**:

- Title: `SimHei, "Microsoft YaHei", Arial, sans-serif`
- Body: `"Microsoft YaHei", "PingFang SC", Arial, sans-serif`
- Emphasis: `SimHei, "Microsoft YaHei", Arial, sans-serif`
- Code: `Consolas, "Courier New", monospace`

### Font Size Hierarchy

**Baseline**: Body font size = 18px（密集数据看板，dense 主导）。

| Purpose | Ratio to body | px @ body=18 | Weight |
| ------- | ------------- | ------------ | ------ |
| Cover title | 2.5-5x | 64-80px | Heavy |
| Section / chapter | 2-2.5x | 36-45px | Bold |
| Page title | 1.5-2x | 30-34px | Bold |
| Hero number (KPI) | 1.5-5x | 拆为 hero_number 槽位 56px | Heavy |
| Subtitle | 1.2-1.5x | 22-26px | SemiBold |
| **Body** | **1x** | **18px** | Regular |
| Annotation / caption | 0.7-0.85x | 13-15px | Regular |
| Page number / footer | 0.5-0.65x | 10-12px | Regular |

> 声明 hero_number 槽位用于 P02 仪表盘大数字（95 / 0 / 7 / 1），免受常规上限约束。

---

## V. Layout Principles

### Page Structure

- **Header area**: 顶部 56–96px，左对齐页标题 + 右侧统计日期 / 页码；深蓝细色带或基线分隔。
- **Content area**: 中部主看板区，模块化栅格承载表格 / 状态卡 / 时间轴。
- **Footer area**: 底部 28px，左「牙医仪器检修 · 项目进度汇报」，右「2026-06-22 · P0X/12」，10–12px 三级文字。

### Layout Pattern Library (combine or break as content demands)

| Pattern | 用在 |
| ------- | ---- |
| 单列居中 | 封面 P01、收尾 P12 |
| KPI 四宫格 | P02 仪表盘 |
| 状态表（等权行） | P03 七维度、P06 门槛 |
| 多列状态卡 | P05 功能、P09/P10 按人分工 |
| 顶-底时间轴 | P07 里程碑、P11 行动计划 |
| 负空间单焦点 | P04 三大卡点、P08 阻断项 |

### Spacing Specification

**Universal**：安全边距 72px；内容块间距 28–36px；图标-文字间距 10px。
**Card-based**：卡间距 20–24px；卡内边距 20–24px；卡圆角 0（swiss，必要时 ≤4）；三列卡宽约 360px；双行卡高约 270px。
**Non-card**：breathing 页靠留白与细分隔线承载；正文行高 1.5×，大字 1.6–1.8×。

---

## VI. Icon Usage Specification

### Source

- **Built-in icon library**: `templates/icons/tabler-outline`（线性，stroke_width=2，deck-wide 单一图标库）
- **Usage method**: `<use data-icon="tabler-outline/icon-name" .../>`，仅可使用下表已核验图标。

### Recommended Icon List（确认后用 icon_sync 落地核验，名称以 `ls | grep` 为准）

| Purpose | Icon Path（待核验） | Page |
| ------- | --------- | ---- |
| 代码就绪 | `tabler-outline/code` | P02/P05 |
| 云函数 / 部署 | `tabler-outline/cloud` / `tabler-outline/server` | P02/P03 |
| 仪表盘 / 完成度 | `tabler-outline/gauge` | P02 |
| 阻断 / 风险 | `tabler-outline/alert-triangle` | P03/P08 |
| 资质审核 / 合规 | `tabler-outline/shield` | P08 |
| 里程碑 / 排期 | `tabler-outline/calendar` | P07/P11 |
| 团队 / 分工 | `tabler-outline/users` | P09/P10 |
| 支付 | `tabler-outline/credit-card` | P03/P09 |
| 订阅消息 | `tabler-outline/bell` | P03/P09 |
| 数据库 / 索引 | `tabler-outline/database` | P03/P09 |
| 验收 / 真机 | `tabler-outline/clipboard-check` | P10 |
| 完成勾选 | `tabler-outline/circle-check` | P05/P06 |

---

## VII. Visualization Reference List

> 本 deck 不引用 `templates/charts/` 图表模板；所有看板（KPI 数字、状态表、时间轴、状态卡）均按 swiss-minimal 栅格自绘（§V 模式库）。无数据坐标图（柱/线/饼），故 §VII 无模板行，`page_charts` 整节省略。

---

## VIII. Image Resource List

> 无配图（确认项 h = A）。纯数据 / 状态看板，不使用 AI / web / 用户图片。本节无行，`images` 段与 AI 渲染/调色段一并省略。

---

## IX. Content Outline

### Part 1: 概况

#### Slide 01 - Cover

- **Cover impact**: 提炼核心冲突——「代码就绪，卡在配置·审核·验收」。封面底部嵌一行四状态条（代码 95% / 部署 0% / 门槛 0-12 / 类目审核 阻断），冲突即看板。
- **Layout**: 单列左对齐排印海报；左下角主蓝细色块锚点，大量留白。
- **Title**: 牙医仪器检修小程序 · 项目进度汇报
- **Subtitle**: 开发已基本完成，上线在配置与审核
- **Info**: 统计时间 2026-06-22　|　目标 2026 年 7 月上线　|　负责人：吴彤彤

#### Slide 02 - 进度仪表盘

- **Layout**: KPI 四宫格（hero_number 大字）
- **Title**: 进度仪表盘
- **Core message**: 用四个关键数字概括当前盘面。
- **Content**:
  - 代码功能完成度 **95%**（16/16 主流程）· 绿
  - 后端云函数 **7 个** 代码就绪（含合规整改）· 蓝
  - 最低上线门槛 **0 / 12** 达成 · 红
  - 发布阻断项 **1**（医疗器械类目审核）· 红

#### Slide 03 - 总览结论 · 七维度

- **Layout**: 状态表（维度 | 完成度 | 说明），等权行 + 状态色
- **Title**: 总览结论 · 七维度完成度
- **Core message**: 七个维度的完成度与说明一览。
- **Content**: 客户端代码 ✅~95% / 云函数代码 ✅ / 后端部署 ❌ / 数据库索引 ❌ / 微信支付订阅配置 ❌ / 真机验收 ❌ / 类目审核 ⛔。

#### Slide 04 - 一句话结论 + 三大卡点

- **Layout**: 负空间单焦点——上半大字结论，下半三栏卡点
- **Title**: 结论与三大卡点
- **Core message**: 一句话定调，三类卡点收口。
- **Content**:
  - 大字：开发已基本完成，上线在配置和审核。
  - ① 微信医疗器械类目审核未通过（阻断）
  - ② 正式环境部署 + 支付/订阅/域名/索引控制台配置
  - ③ 真机与全流程验收尚未开始

### Part 2: 明细盘点

#### Slide 05 - 客户端功能完成度 16/16

- **Layout**: 多列状态卡 / 紧凑清单（4×4 或两栏），全绿勾
- **Title**: 客户端功能完成度 16 / 16
- **Core message**: 16 项主流程功能均已实现。
- **Content**: 登录/授权恢复/报修建单/上传图/进度/报价确认拒绝/微信支付/对公凭证/发票/确认收货/评价回访/投诉建议/订阅消息/设备档案/隐私授权/账号注销。底注：待确认客服热线 0757-85775667、客户可见资质正式版。

#### Slide 06 - 最低上线门槛 0/12

- **Layout**: 状态表（门槛 | 代码 | 部署配置验收 | 综合），综合列红
- **Title**: 最低上线门槛 · 达成 0 / 12
- **Core message**: 12 项门槛中代码就绪 8 项，但均卡在部署/配置/验收。
- **Content**: 12 行门槛逐项；右侧"卡点"短语（真机未验收 / 未连正式环境 / WX_PAY_* 未配 / 模板 ID 未配 / 控制台未建索引 / 热线资质待确认）。

#### Slide 07 - 上线里程碑

- **Layout**: 顶-底水平时间轴（5 段）
- **Title**: 上线里程碑
- **Core message**: 从资料锁定到提审发布的五阶段排期。
- **Content**: 正式资料锁定 06-22~24（进行中）→ 正式环境部署 06-25~27 → 第一轮全流程验收 06-28~30 → 最终回归与提审准备 07-01~03 → 微信审核与发布 07-04 起。

#### Slide 08 - 阻断项：医疗器械类目审核

- **Layout**: 负空间单焦点——红色警示 + 单卡
- **Title**: 阻断项 B1 · 医疗器械类目审核
- **Core message**: 唯一发布前置阻断项及其下一步动作。
- **Content**: 类目审核未通过；下一步：补齐《医疗器械生产许可证》《互联网信息服务备案凭证》后在公众平台「类目管理」重新提交；负责人 吴彤彤；预计 待定（卡发布）。

### Part 3: 分工与计划

#### Slide 09 - 按人分工 · 卡点（上）

- **Layout**: 三列状态卡（每人：负责域 / 关键卡点 / 下一步）
- **Title**: 按人分工 · 卡点（上）
- **Core message**: 吴彤彤、陈莎、苏凤冰的负责域与关键卡点。
- **Content**:
  - 吴彤彤｜客户资料 + 上线总控：收齐正式资料、确认客服热线、组织每日同步
  - 陈莎｜微信平台/支付/订阅：合法域名、订阅模板 ID、WX_PAY_* 支付参数
  - 苏凤冰｜uniCloud/数据库/云函数：切正式云空间、重部署 7 个云函数、建索引

#### Slide 10 - 按人分工 · 卡点（下）

- **Layout**: 三列状态卡
- **Title**: 按人分工 · 卡点（下）
- **Core message**: 郑佳华、蔡珠琪、钟浩霆的负责域与关键卡点。
- **Content**:
  - 郑佳华｜小程序端/真机：正式 AppID 体验版、真机跑主流程、订阅授权体验
  - 蔡珠琪｜PC 后台部署/验收：配 VITE_* URL、正式域名 HTTPS、后台核心业务验收
  - 钟浩霆｜资料核对/全流程验收：核对可见资料、跑完整闭环、最终复验与上线建议

#### Slide 11 - 未来 7 天行动计划

- **Layout**: 顶-底时间轴 / 日期分桶清单
- **Title**: 未来 7 天行动计划（06-22 → 06-30）
- **Core message**: 按日期归桶的下一步动作与负责人。
- **Content**: 06-22~24 资料锁定（吴彤彤）+ 重部署云函数（苏凤冰）；06-25~27 切正式云空间 + 支付/订阅/域名/索引配置（苏凤冰/陈莎）+ PC 正式部署（蔡珠琪）；06-28~30 第一轮真机与全流程验收（郑佳华/钟浩霆）。并行推进：类目审核资质补齐（吴彤彤，卡发布）。

#### Slide 12 - 上线判定与收尾

- **Closing impact**: 留给听众一句判定准则——「门槛未清零不提审」。重申代码无重大缺口，剩下是配置+审核+验收三类工作。
- **Layout**: 单列居中 + 一条判定规则强调块
- **Content**: 上线判定：任一最低门槛未过原则上不得提审；有条件上线须由吴彤彤在《最终上线确认单》写明风险、兜底、负责人、预计修复时间。收束句：开发已就位，决胜在配置与审核。

---

## X. Speaker Notes Requirements

每页一个讲稿文件存入 `notes/`（文件名匹配 SVG，如 `01_cover.md`）。register：briefing——平实、事实、逐点读出，数字直说，不制造悬念，便于汇报口播或会后扫读。

---

## XI. Technical Constraints Reminder

1. viewBox `0 0 1280 720`；背景用 `<rect>`。
2. 文本换行用 `<tspan>`；禁用 `<foreignObject>`。
3. 透明度用 `fill-opacity` / `stroke-opacity`；禁用 `rgba()`。
4. 禁用 `mask` / `<style>` / `class` / `textPath` / `animate*` / `script` / `@font-face`。
5. `<g opacity>` 禁用（逐子元素设透明度）。
6. 文本符号用原始 Unicode（— → ©）；禁 HTML 实体；XML 保留字转义 `&amp; &lt; &gt;`（如 `R&amp;D`）。
7. swiss-minimal：直角 rx=0，无阴影、无渐变填充、无装饰块。
