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
	{ id: 'repair', title: '立即报修', icon: 'repair', color: '#1E6FE0', bg: '#DCE6FA' },
	{ id: 'track', title: '维修进度', icon: 'track', color: '#C97A6B', bg: '#F8E2DA' },
	{ id: 'package-query', title: '包裹查询', icon: 'box', color: '#10B981', bg: '#DCFCE7' }
]

export const queries = [
	{ id: 'diag', title: '故障自查', icon: 'diag', color: '#0A4FB8', bg: '#D7E3FA' },
	{ id: 'survey', title: '调研有礼', icon: 'gift', color: '#8E96A8', bg: '#E5E7EE' },
	{ id: 'warranty', title: '保修政策', icon: 'shield', color: '#1E6FE0', bg: '#E8F1FE' },
	{ id: 'fees', title: '收费指南', icon: 'money', color: '#D97706', bg: '#FFF7E6' }
]

export const guides = [
	{ id: 'guide-quick', title: '快速指南', icon: 'book' },
	{ id: 'guide-repair', title: '报修指南', icon: 'repair' },
	{ id: 'guide-query', title: '查询指南', icon: 'search' },
	{ id: 'guide-invoice', title: '开票指南', icon: 'invoice' }
]

export const defaultReceiver = [
	{ label: '收件公司', value: '佛山市思科达医疗器械有限公司' },
	{ label: '收件人', value: '姚兵' },
	{ label: '收件电话', value: '13929198537' },
	{ label: '收件地址', value: '广东省佛山市南海区狮山镇罗村广东新光源核心基地B5座五楼' }
]

export const companyStats = [
	{ value: '20', label: '年品牌积累', desc: '品牌发展经验' },
	{ value: '27', label: '产品线', desc: '覆盖诊疗场景' },
	{ value: '195', label: '出口国家', desc: '服务全球市场' },
	{ value: '150', label: '专利成果', desc: '持续研发创新' }
]

export const companyIntro = [
	'CICADA Dental（思科达 / 登煌医疗）是扎根佛山的口腔医疗设备研发制造品牌。',
	'公司从光固化设备制造起步，逐步发展为覆盖根管治疗设备、牙科手机、电动微马达、牙齿美白仪及临床辅助器械的综合口腔解决方案提供商。',
	'我们坚持以安全与质量为核心，通过研发、制造、售后和培训协同，为牙科专业人士提供稳定、高效、易用的设备支持。'
]

export const companyAdvantages = [
	{ icon: 'lightning', title: '研发制造', desc: '高标准研发中心，配套来自德国、日本、韩国等地的精密设备，支撑产品快速迭代。' },
	{ icon: 'microscope', title: '质量合规', desc: '围绕医疗器械安全标准建立质量体系，产品满足国内外相关行业标准与注册要求。' }
]

export const companyProductLines = [
	{ title: '根管治疗设备', desc: '覆盖根管马达、根管测量、热牙胶充填、冲洗等临床根管治疗场景。', gradient: 'linear-gradient(135deg, #2C5985 0%, #6BB0CC 100%)' },
	{ title: '牙科手机与电动微马达', desc: '提供高速手机、增速弯机、电动微马达等高效、低噪、稳定的动力设备。', gradient: 'linear-gradient(135deg, #3D6F9E 0%, #6BB0CC 100%)' },
	{ title: '光固化与美白设备', desc: '以光固化灯为起点，延伸到牙齿美白仪以及修复、美学相关设备。', gradient: 'linear-gradient(135deg, #0A4FB8 0%, #6BB0CC 100%)' },
	{ title: '洁牙抛光与辅助器械', desc: '覆盖喷砂抛光、临床器械及耗材配套，满足诊所日常诊疗效率需求。', gradient: 'linear-gradient(135deg, #1D8A96 0%, #7BC9C7 100%)' }
]

export const companyServiceTags = ['及时售后', '临床培训', '全球服务网络']

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
	{ icon: 'invoice', title: '发票与开票', desc: '申请开票 / 下载电子发票', go: 'invoices' }
]

export const tabs = [
	{ id: 'home', label: '首页', icon: 'home' },
	{ id: 'company', label: '公司介绍', icon: 'company' },
	{ id: 'mine', label: '我的', icon: 'mine' }
]

export const moduleMap = {
	repair: { title: '立即报修', subtitle: '填写寄出信息、产品信息与寄回信息' },
	'repair-success': { title: '提交成功', subtitle: '工程师已收到您的报修申请' },
	track: { title: '维修进度', subtitle: '查看提交、物流、处理与回寄状态' },
	'package-query': { title: '包裹查询', subtitle: '按快递单号查询是否签收和当前处理状态' },
	'order-detail': { title: '工单详情', subtitle: '维修时间线与费用发票' },
	survey: { title: '调研有礼', subtitle: '填写售后体验反馈，领取专属维保福利' },
	diag: { title: '故障自查', subtitle: '选择产品类型和故障类型，查看排查建议' },
	warranty: { title: '保修政策', subtitle: '文字形式展示保修范围、期限和注意事项' },
	fees: { title: '收费指南', subtitle: '文字形式展示收费办法和常见项目' },
	'guide-quick': { title: '快速指南', subtitle: '以图文文档形式浏览操作说明' },
	'guide-repair': { title: '报修指南', subtitle: '了解寄修报修的完整流程' },
	'guide-query': { title: '查询指南', subtitle: '查看进度查询和结果确认办法' },
	'guide-invoice': { title: '开票指南', subtitle: '了解发票申请、抬头和寄送说明' },
	invoices: { title: '发票与开票', subtitle: '申请开票、查看进度与复制电子发票' },
	contact: { title: '联系我们', subtitle: '客服热线、工作时间和寄修地址' },
	orders: { title: '维修订单', subtitle: '查看全部维修记录与处理状态' },
	products: { title: '我的产品', subtitle: '已登记设备与保修状态' },
	address: { title: '收货地址', subtitle: '管理默认回寄地址与单位信息' },
	feedback: { title: '投诉和建议', subtitle: '提交问题反馈或服务建议' },
	login: { title: '登录', subtitle: '登录后查看您的维修订单' }
}

export const repairStatusFlow = ['已提交', '运输中', '已签收', '处理中', '已回寄', '已完成']
export const pendingRepairStatuses = ['已提交', '运输中', '已签收']
export const progressTabs = ['全部', ...repairStatusFlow]
export const repairFlow = ['提交', '运输', '签收', '处理', '回寄', '完成']
export const packageFlow = ['待签收', '已签收', '已登记', '处理中', '已关联']

export const invoiceTitleTypes = [
	{ value: 'company', label: '企业单位', desc: '适合诊所 / 医院' },
	{ value: 'personal', label: '个人', desc: '无需填写税号' }
]
