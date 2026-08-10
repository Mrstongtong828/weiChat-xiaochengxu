import productImplant from '@/static/product-implant.jpg'
import productPrevention from '@/static/product-prevention.jpg'
import productRestoration from '@/static/product-restoration.jpg'
import productRootCanal from '@/static/product-root-canal.jpg'

export const logisticsList = [
	{ value: '顺丰快递', label: '顺丰快递' },
	{ value: '申通快递', label: '申通快递' },
	{ value: '中通快递', label: '中通快递' },
	{ value: '德邦快递', label: '德邦快递' },
	{ value: '圆通快递', label: '圆通快递' },
	{ value: '韵达快递', label: '韵达快递' },
	{ value: '中国邮政', label: '中国邮政' },
	{ value: '京东快递', label: '京东快递' },
	{ value: '极兔快递', label: '极兔快递' },
	{ value: '菜鸟裹裹', label: '菜鸟裹裹' },
	{ value: '信丰快递', label: '信丰快递' },
	{ value: '其他', label: '其他' }
]

export const basics = [
	{ id: 'repair', title: '立即报修', desc: '快速提交维修申请', icon: 'repair', color: '#2F86EA', bg: '#DDEBFF' },
	{ id: 'track', title: '服务进度', desc: '实时跟踪处理进度', icon: 'track', color: '#FF7638', bg: '#FFE7DC' },
	{ id: 'package-query', title: '包裹查询', desc: '查询物流配送状态', icon: 'box', color: '#55C87A', bg: '#DEF4E5' }
]

export const queries = [
	{ id: 'diag', title: '故障自查', desc: '常见问题自助排查', icon: 'diag', color: '#5AA1F2', bg: '#DDEBFF' },
	{ id: 'survey', title: '调研有礼', desc: '参与调研领取好礼', icon: 'gift', color: '#8374F2', bg: '#E9E5FF' },
	{ id: 'warranty', title: '保修政策', desc: '查询保修政策说明', icon: 'shield', color: '#43B8EB', bg: '#DDF3FC' },
	{ id: 'fees', title: '收费指南', desc: '了解收费标准说明', icon: 'money', color: '#F5B32A', bg: '#FFF0CF' }
]

export const guides = [
	{ id: 'guide-quick', title: '快速指南', desc: '快速了解小程序售后流程', icon: 'book' },
	{ id: 'guide-repair', title: '报修指南', desc: '教你如何快速报修', icon: 'repair' }
]

export const defaultReceiver = [
	{ label: '收件公司', value: '佛山市登煌医疗器械有限公司' },
	{ label: '收件人', value: '姚兵' },
	{ label: '收件电话', value: '13929198537' },
	{ label: '收件地址', value: '广东省佛山市南海区狮山镇罗村广东新光源核心基地B5座五楼' }
]

export const companyStats = [
	{ value: '20+', label: '年品牌积累', desc: '品牌发展经验' },
	{ value: '20+', label: '产品线', desc: '覆盖专业医疗领域' },
	{ value: '100+', label: '出口国家', desc: '服务全球市场' },
	{ value: '150+', label: '专利成果', desc: '持续研发创新' }
]

export const companyIntro = [
	'佛山市登煌医疗器械有限公司',
	'佛山市登煌医疗器械有限公司（旗下品牌CICADA 思科达）自2005年成立以来，专注口腔医疗器械的研发、制造与销售。公司拥有37项商标与150余项国家专利，产品涵盖根管治疗、牙科手机、种植设备、光固化机及辅助设备等五大产品线，提供口腔临床系统化解决方案。',
	'公司全面通过ISO 13485质量管理体系认证，核心产品获CE、FDA等国际认证，依托自主研发、制造、检测一体化产业链，实行严格质量管控。产品已销往全球百余个国家，与超1000家企业建立长期合作。',
	'登煌医疗坚持以“品质为先、创新致远、客户至上”为准则，持续提升产品与服务水平，致力于成为全球领先的牙科设备制造商，助力全球口腔医疗事业发展。'
]

export const companyAdvantages = [
	{ icon: 'lightning', title: '研发制造', desc: '高标准研发中心，配备德国进口精密生产设备，持续驱动产品迭代升级。' },
	{ icon: 'microscope', title: '质量合规', desc: '依据《医疗器械生产质量管理规范》搭建完善质量管理体系，产品符合国内外行业标准与注册准入要求。' }
]

export const companyProductLines = [
	{ title: '根管系列', desc: '覆盖根管马达、根管锉、根尖定位、热牙胶充填、根管冲洗等整套根管诊疗方案。', image: productRootCanal, gradient: 'linear-gradient(135deg, #2C5985 0%, #6BB0CC 100%)' },
	{ title: '修复系列', desc: '牙科光固化机、高速气涡轮手机、低速气动马达手机、牙科低压电动马达满足各类牙体美学修复需求。', image: productRestoration, gradient: 'linear-gradient(135deg, #3D6F9E 0%, #6BB0CC 100%)' },
	{ title: '种植系列', desc: '种植机、种植手机、清水仪、种植扭力扳手，适配各类种植外科修复手术。', image: productImplant, gradient: 'linear-gradient(135deg, #0A4FB8 0%, #6BB0CC 100%)' },
	{ title: '预防辅助系列', desc: '洁牙抛光设备，助力门诊基础预防诊疗。', image: productPrevention, gradient: 'linear-gradient(135deg, #1D8A96 0%, #7BC9C7 100%)' }
]

export const companyServiceTags = ['售后快速响应', '临床技术支持', '全球服务布局']

export const defaultStatusItems = [
	{ id: 'all', title: '全部', count: 0, color: '#1E6FE0', bg: 'rgba(30, 111, 224, 0.09)', icon: 'invoice', type: 0 },
	{ id: 'pending', title: '待处理', count: 0, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.09)', icon: 'track', type: 'pending' },
	{ id: 'fixing', title: '处理中', count: 0, color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.09)', icon: 'repair', type: '处理中' },
	{ id: 'shipped', title: '已回寄', count: 0, color: '#10B981', bg: 'rgba(16, 185, 129, 0.09)', icon: 'truck', type: '已回寄' }
]

export const menus = [
	{ icon: 'pin', title: '收货地址管理', desc: '多地址 · 默认回寄地址', go: 'address' },
	{ icon: 'edit', title: '投诉和建议', desc: '问题反馈 / 改进建议', go: 'feedback' },
	{ icon: 'box', title: '我的产品', desc: '登录后查看已登记设备', go: 'products' },
	{ icon: 'invoice', title: '发票与开票', desc: '对公开票 / 查看发票信息', go: 'invoices' }
]

export const tabs = [
	{ id: 'home', label: '首页', icon: 'home' },
	{ id: 'company', label: '公司介绍', icon: 'company' },
	{ id: 'mine', label: '我的', icon: 'mine' }
]

export const moduleMap = {
	repair: { title: '立即报修', subtitle: '填写寄出信息、产品信息与寄回信息' },
	'repair-success': { title: '提交成功', subtitle: '工程师已收到您的报修申请' },
	track: { title: '服务进度', subtitle: '查看提交、物流、处理与回寄状态' },
	'package-query': { title: '包裹查询', subtitle: '按快递单号查询是否签收和当前处理状态' },
	'order-detail': { title: '工单详情', subtitle: '维修时间线与费用发票' },
	survey: { title: '调研有礼', subtitle: '填写售后体验反馈，领取专属维保福利' },
	diag: { title: '故障自查', subtitle: '选择产品类型和故障类型，查看排查建议' },
	warranty: { title: '保修政策', subtitle: '文字形式展示保修范围、期限和注意事项' },
	fees: { title: '收费指南', subtitle: '文字形式展示收费办法和常见项目' },
	'guide-quick': { title: '快速指南', subtitle: '快速了解小程序售后流程' },
	'guide-repair': { title: '报修指南', subtitle: '了解寄修报修的完整流程' },
	invoices: { title: '发票与开票', subtitle: '申请开票、查看进度与复制电子发票' },
	contact: { title: '联系我们', subtitle: '客服热线、工作时间和寄修地址' },
	orders: { title: '维修订单', subtitle: '查看全部维修记录与处理状态' },
	products: { title: '我的产品', subtitle: '已登记设备与保修状态' },
	address: { title: '收货地址', subtitle: '管理默认回寄地址与单位信息' },
	feedback: { title: '投诉和建议', subtitle: '提交问题反馈或服务建议' },
	login: { title: '登录', subtitle: '登录后查看您的服务订单' }
}

export const repairStatusFlow = ['已提交', '运输中', '已签收', '处理中', '已回寄', '已完成']
export const pendingRepairStatuses = ['已提交', '运输中', '已签收']
export const progressTabs = ['全部', ...repairStatusFlow]
export const repairFlow = ['提交', '运输', '签收', '处理', '回寄', '完成']
export const packageFlow = ['待签收', '已签收', '已登记', '处理中', '已关联']

export const customerTypeOptions = [
	{ value: 'clinic', label: '门诊/医院' },
	{ value: 'dealer', label: '代理商/经销商' }
]

export const invoiceTitleTypes = [
	{ value: 'company', label: '企业单位', desc: '适合诊所 / 医院' },
	{ value: 'personal', label: '个人', desc: '无需填写税号' }
]
