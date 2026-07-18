<template>
	<view class="legal-page">
		<view class="legal-head">
			<view class="legal-back tap" @click="goBack">
				<view></view>
			</view>
			<text>{{ currentDoc.title }}</text>
		</view>
		<scroll-view class="legal-scroll" scroll-y>
			<view class="legal-content">
				<text class="legal-title">{{ currentDoc.title }}</text>
				<text v-for="(line, index) in currentDoc.lines" :key="index" :class="lineClass(line)">{{ line }}</text>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const userAgreementLines = [
	'第一条 协议说明',
	'本协议为思科达（以下简称 “我方”）与使用「思科达售后服务中心」微信小程序（下称 “本小程序”）用户之间，订立的服务使用约定。',
	'用户点击「微信一键登录」并完成授权，即代表完整阅读、理解并自愿同意本协议全部条款；若不认可本协议内容，请停止登录及使用本小程序全部功能。',
	'本小程序服务对象为口腔诊所、牙科从业机构，仅提供牙科仪器报修、维修进度查询、设备保养、售后质保登记相关服务。',
	'第二条 账号使用规范',
	'用户通过微信手机号授权生成专属账号，账号绑定本人微信身份，所有通过该账号提交的报修工单、沟通记录，责任均由账号持有人承担。',
	'用户填写报修信息时，需如实提交门店名称、联系地址、设备型号、故障详情，不得编造虚假信息、恶意报修、重复无效下单。',
	'禁止利用本小程序发布违法、涉医违规、辱骂骚扰类内容，禁止批量恶意工单占用维修资源；出现上述行为，我方有权限制账号登录、终止全部售后服务。',
	'用户需自行保管微信账号安全，因微信被盗、转借账号产生的一切问题，我方不承担相关责任。',
	'第三条 售后维修服务约定',
	'用户提交报修工单后，我方工作人员将联系用户确认故障情况，区分寄修、上门维修两种服务方式，同步告知配件报价、维修工期、质保范围，经用户确认后启动维修工作。',
	'原厂配件维修项目，严格按照工单标注时长提供质保；设备人为磕碰、进水、私自拆机改装、超出使用年限自然老化产生故障，不属于免费保修范畴。',
	'小程序系统永久留存用户全部维修工单档案，用户登录账号可随时查询历史维修记录、质保到期信息。',
	'维修产生的配件费、上门服务费、检测费以双方确认报价单为准，用户需按照约定完成款项结算。',
	'第四条 免责说明',
	'设备因用户自行改装、非我方人员拆机、日常保养不当造成二次损坏，我方仅可提供有偿维修，不承担设备损坏赔偿。',
	'因自然灾害、物流停运、政策管控等不可抗力因素导致维修工期延误，我方仅顺延维修周期，不承担停业、经营损失等间接赔偿。',
	'我方仅负责牙科仪器硬件维修维护，不对诊所经营客流、营业收入损失承担任何赔付责任。',
	'第五条 知识产权保护',
	'本小程序 LOGO、界面设计、维修技术资料、工单系统文字内容全部知识产权归属思科达所有，未经我方书面许可，不得私自复制、转载、商用。',
	'第六条 争议解决',
	'用户与我方产生服务纠纷，优先通过小程序客服线上协商；协商无法达成一致，提交我方企业所在地人民法院诉讼处理。',
	'第七条 协议更新规则',
	'我方有权根据业务、法规要求修订本用户协议，更新后的协议将在小程序登录页面公示，用户继续登录、使用小程序，视为认可新版协议内容。',
	'思科达售后服务中心'
]

const privacyPolicyLines = [
	'为规范个人信息处理活动，遵守《中华人民共和国个人信息保护法》《网络安全法》《微信小程序平台运营规范》，思科达向您清晰说明小程序信息收集、使用、存储相关规则，请您仔细阅读。',
	'一、我们收集的个人信息',
	'本小程序仅收集开展售后维修服务必需信息，绝不超额采集用户隐私：',
	'微信基础信息：微信昵称、微信头像（仅作账号展示，用户可拒绝授权，不影响基础报修功能）；',
	'核心必填信息：手机号码（登录授权获取，用于电话沟通维修报价、上门时间、物流对接）；',
	'用户主动填报业务信息：门店名称、经营地址、牙科设备型号、故障描述、维修工单记录；',
	'系统日志信息：小程序访问时间、页面操作记录，仅用于排查系统卡顿、报错故障。',
	'本小程序不会申请、获取您的相册、摄像头、地理位置、身份证、银行卡等敏感权限与信息。',
	'二、信息使用用途',
	'核验用户身份，完成小程序账号登录；',
	'与用户实时对接维修方案、上门安排、配件物流、售后回访；',
	'归档维修工单，方便用户随时查询历史维修记录、质保期限；',
	'统计售后业务数据，优化工程师维修流程、提升服务体验。',
	'我方承诺：不会出售、出租、共享用户手机号、诊所经营信息给任何第三方机构，所有信息仅用于本牙科设备售后维修业务。',
	'三、信息存储与留存规则',
	'用户全部数据存储于国内合规云服务器，采用加密机制存储，防止信息泄露、篡改、丢失；',
	'维修工单档案长期留存，用于设备质保追溯；用户申请注销账号后，我方将在 7 个工作日内清除手机号、门店地址等可识别个人信息，仅保留去除身份标识的匿名维修统计数据；',
	'我方不会将用户数据传输至境外服务器。',
	'四、您享有的个人信息权利',
	'查阅权：可在小程序个人中心查看系统留存的本人全部信息；',
	'更正权：可自行修改门店地址、联系电话等填报信息；',
	'删除 / 注销权：联系小程序客服申请账号注销，清除全部个人实名信息；',
	'撤回授权权：可在微信系统设置中关闭手机号授权，授权撤回后将无法登录、提交报修工单。',
	'五、未成年人保护',
	'本小程序服务面向成年口腔机构经营者，不主动收集任何未成年人个人信息，若误收集未成年人信息，核实后将第一时间删除。',
	'六、咨询与反馈渠道',
	'若您对本隐私政策、个人信息处理存在疑问，可通过小程序内在线客服联系我方咨询。',
	'七、政策修订说明',
	'我方会依据法律法规、业务变动更新本隐私政策，更新版本将在小程序登录页面公示，您继续使用小程序服务，即视为同意更新后的隐私政策。',
	'思科达售后服务中心'
]

const docs = {
	user: {
		title: '思科达售后服务中心 用户协议',
		lines: userAgreementLines
	},
	privacy: {
		title: '思科达售后服务中心 隐私政策',
		lines: privacyPolicyLines
	}
}

const type = ref('user')
const currentDoc = computed(() => docs[type.value] || docs.user)

onLoad((options = {}) => {
	type.value = options.type === 'privacy' ? 'privacy' : 'user'
})

const goBack = () => {
	uni.navigateBack({
		fail: () => uni.reLaunch({ url: '/pages/index/index' })
	})
}

const lineClass = (line) => (/^(第.+条|[一二三四五六七八九十]、)/.test(line) ? 'legal-section' : 'legal-paragraph')
</script>

<style scoped>
.legal-page {
	min-height: 100vh;
	background: #F4F9FF;
	box-sizing: border-box;
}

.legal-head {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	z-index: 5;
	height: 176rpx;
	padding: 76rpx 32rpx 0;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	background: rgba(244, 249, 255, 0.96);
	backdrop-filter: blur(12rpx);
}

.legal-head > text {
	max-width: 520rpx;
	font-size: 32rpx;
	font-weight: 800;
	color: #102044;
	text-align: center;
	line-height: 1.3;
}

.legal-back {
	position: absolute;
	left: 32rpx;
	bottom: 24rpx;
	width: 72rpx;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: #FFFFFF;
	box-shadow: 0 10rpx 24rpx rgba(30, 111, 224, 0.14);
}

.legal-back view {
	width: 20rpx;
	height: 20rpx;
	margin-left: 8rpx;
	border-left: 4rpx solid #2B7DE9;
	border-bottom: 4rpx solid #2B7DE9;
	transform: rotate(45deg);
}

.legal-scroll {
	height: 100vh;
	box-sizing: border-box;
	padding-top: 176rpx;
}

.legal-content {
	padding: 32rpx 36rpx 72rpx;
	box-sizing: border-box;
}

.legal-title {
	display: block;
	margin-bottom: 24rpx;
	font-size: 36rpx;
	font-weight: 900;
	line-height: 1.4;
	color: #102044;
}

.legal-section {
	display: block;
	margin: 28rpx 0 12rpx;
	font-size: 29rpx;
	font-weight: 800;
	line-height: 1.6;
	color: #16325F;
}

.legal-paragraph {
	display: block;
	margin-bottom: 14rpx;
	font-size: 27rpx;
	line-height: 1.75;
	color: #4E5F7E;
	text-align: justify;
}
</style>
