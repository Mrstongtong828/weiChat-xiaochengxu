<template>
	<view class="page-shell">
		<view class="page-header">
			<text class="page-header-title">公司介绍</text>
		</view>

		<view class="page-body">
			<view class="company-hero">
				<image class="hero-image" src="/static/company-intro-header.jpg" mode="aspectFill"></image>
			</view>

			<view class="stats-grid">
				<view v-for="item in stats" :key="item.label" class="stat-card">
					<text class="stat-value">{{ item.value }}</text>
					<text class="stat-label">{{ item.label }}</text>
					<text class="stat-desc">{{ item.desc }}</text>
				</view>
			</view>

			<view class="intro-card">
				<text class="intro-label">公司简介</text>
				<text v-for="item in introParagraphs" :key="item" class="intro-text">{{ item }}</text>
			</view>

			<view class="section">
				<view class="section-head">
					<view class="section-rule"></view>
					<text>产品矩阵</text>
				</view>
				<view class="business-list">
					<view v-for="(item, index) in productLines" :key="item.title" class="business-card">
						<view class="business-visual" :style="{ background: item.gradient }">
							<view :class="['device-shape', 'device-' + (index % 3)]"></view>
						</view>
						<view class="business-copy">
							<text class="business-title">{{ item.title }}</text>
							<text class="business-desc">{{ item.desc }}</text>
						</view>
					</view>
				</view>
			</view>

			<view v-if="maintenanceGuides.length" class="section">
				<view class="section-head">
					<view class="section-rule"></view>
					<text>产品视频</text>
				</view>
				<view class="maint-list">
					<view v-for="item in maintenanceGuides" :key="item.id" class="maint-card tap" @click="playMaintenance(item)">
						<view class="maint-cover">
							<image v-if="item.cover" class="maint-cover-img" :src="item.cover" mode="aspectFill"></image>
							<view class="maint-play-badge"><text>▶</text></view>
						</view>
						<view class="maint-info">
							<text class="maint-title">{{ item.title }}</text>
							<text v-if="item.desc" class="maint-desc">{{ item.desc }}</text>
						</view>
					</view>
				</view>
			</view>

			<view class="section">
				<view class="section-head">
					<view class="section-rule"></view>
					<text>研发与质量</text>
				</view>
				<view class="auth-card">
					<view class="auth-title-row">
						<view class="icon-cert"><view></view></view>
						<text>医疗器械质量体系背书</text>
					</view>
					<text class="auth-desc">CICADA 始终坚持医疗器械质量体系标准，覆盖口腔医疗设备研发、生产与合规交付关键环节。具体资质证照以下方公示为准。</text>
					<view v-if="qualifications.length" class="qual-list">
						<view v-for="(item, index) in qualifications" :key="index" class="qual-item">
							<text class="qual-name">{{ item.name }}</text>
							<image v-if="item.type === 'image' && item.imageUrl" class="qual-image" :src="item.imageUrl" mode="widthFix" show-menu-by-longpress></image>
							<text v-else-if="item.text" class="qual-text">{{ item.text }}</text>
						</view>
					</view>
				</view>
				<view class="adv-grid">
					<view v-for="item in advantages" :key="item.title" class="adv-card">
						<view class="adv-icon" :class="'adv-' + item.icon"></view>
						<text class="adv-title">{{ item.title }}</text>
						<text class="adv-desc">{{ item.desc }}</text>
					</view>
				</view>
			</view>

			<view class="section">
				<view class="section-head">
					<view class="section-rule"></view>
					<text>服务理念</text>
				</view>
				<view class="service-card">
					<text class="service-title">Serve Global Dental Specialist</text>
					<text class="service-desc">我们服务全球牙科专业人士，不只提供设备，也重视售后支持、客户体验与临床技术交流，帮助诊所提升诊疗效率与设备使用体验。</text>
					<view class="service-tags">
						<text v-for="item in serviceTags" :key="item">{{ item }}</text>
					</view>
				</view>
			</view>

			<view class="follow-card">
				<view class="qr-wrap">
					<image class="qr-image" :src="cicadaAssets.qrWechat" mode="aspectFill" show-menu-by-longpress></image>
				</view>
				<text class="follow-title">了解产品与售后支持</text>
				<text class="follow-desc">长按识别二维码关注官方服务号，或通过电话、邮箱咨询产品资料、维修保养与售后服务。</text>
				<view class="contact-row">
					<view class="contact-pill tap" @click="callPhone">电话咨询</view>
					<view class="contact-pill ghost tap" @click="copyEmail">复制邮箱</view>
				</view>
			</view>

			<view class="compliance-links">
				<text class="compliance-link tap" @click="openPolicy('privacy')">隐私政策</text>
				<text class="compliance-divider">·</text>
				<text class="compliance-link tap" @click="openPolicy('cancellation')">账号注销规则</text>
			</view>
		</view>

		<view class="float-actions">
			<view class="float-btn tap" @click="copyEmail"><view class="icon-chat"></view></view>
			<view class="float-btn tap" @click="callPhone"><view class="icon-phone"></view></view>
		</view>

		<BottomTabbar :tabs="tabs" active-id="company" @select="go" />
		<PolicyDialog v-model:visible="policyVisible" :title="policyTitle" :content="policyContent" />
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import BottomTabbar from '@/components/BottomTabbar.vue'
import PolicyDialog from '@/components/PolicyDialog.vue'
import { cicadaAssets } from '@/config/cicada-assets'
import { getCompliance, getGuides } from '@/api/content.js'
import { getCloudTempFileURL } from '@/utils/cloud.js'

const qualifications = ref([])
const maintenanceGuides = ref([])
const complianceDocs = ref({ privacyPolicy: '', cancellationPolicy: '' })
const policyVisible = ref(false)
const policyTitle = ref('')
const policyContent = ref('')

onMounted(async () => {
	try {
		const data = await getCompliance()
		qualifications.value = Array.isArray(data.qualifications) ? data.qualifications : []
		complianceDocs.value = {
			privacyPolicy: data.privacyPolicy || '',
			cancellationPolicy: data.cancellationPolicy || ''
		}
	} catch (e) {
		console.warn('加载合规信息失败', e)
	}
	loadMaintenanceGuides()
})

// 把 cloud:// 文件地址解析为可访问临时地址（https/wxfile 直接返回）
const resolveFileUrl = async (url = '') => {
	const u = String(url || '').trim()
	if (!u || /^https?:\/\//i.test(u) || u.startsWith('wxfile://')) return u
	try {
		const res = await getCloudTempFileURL([u])
		const item = res.fileList && res.fileList[0]
		return (item && (item.tempFileURL || item.url)) || u
	} catch (e) {
		return u
	}
}

// 加载「产品视频」分类、面向客户端、且含视频的指南
const loadMaintenanceGuides = async () => {
	try {
		const list = await getGuides({ forceRefresh: true })
		const arr = Array.isArray(list) ? list : []
		const picked = arr.filter(g =>
			String(g.category || '').includes('产品视频') &&
			(g.audience === 'client' || !g.audience)
		)
		const result = []
		for (const g of picked) {
			const media = Array.isArray(g.media) ? g.media : []
			const video = media.find(m => m && m.type === 'video' && m.url)
			if (!video) continue
			const image = media.find(m => m && m.type === 'image' && m.url)
			let cover = ''
			if (image) cover = await resolveFileUrl(image.url)
			result.push({
				id: g.id,
				// 后端字段：description=后台填的视频标题，content=简介（title 是分类名，不用）
				title: g.description || g.summary || g.category || '产品视频',
				desc: g.content || '',
				videoUrl: video.url,
				cover
			})
		}
		maintenanceGuides.value = result
	} catch (e) {
		console.warn('加载维护保养指南失败', e)
	}
}

// 点击播放维护保养视频
const playMaintenance = async (item = {}) => {
	if (!item.videoUrl) {
		uni.showToast({ title: '暂无视频', icon: 'none' })
		return
	}
	try {
		uni.showLoading({ title: '加载中' })
		const url = await resolveFileUrl(item.videoUrl)
		uni.hideLoading()
		if (uni.previewMedia) {
			uni.previewMedia({ sources: [{ url, type: 'video' }], current: 0 })
		} else {
			uni.navigateTo({ url: `/pages-sub/legal/index?type=user`, fail: () => {} })
		}
	} catch (e) {
		uni.hideLoading()
		uni.showToast({ title: '视频打开失败', icon: 'none' })
	}
}

const openPolicy = (type) => {
	const map = {
		privacy: { title: '隐私政策', content: complianceDocs.value.privacyPolicy },
		cancellation: { title: '账号注销规则', content: complianceDocs.value.cancellationPolicy }
	}
	const target = map[type] || map.privacy
	policyTitle.value = target.title
	policyContent.value = target.content
	policyVisible.value = true
}

const stats = [
	{ value: '20', label: '年品牌积累', desc: '品牌发展经验' },
	{ value: '27', label: '产品线', desc: '覆盖诊疗场景' },
	{ value: '195', label: '出口国家', desc: '服务全球市场' },
	{ value: '150', label: '专利成果', desc: '持续研发创新' }
]

const introParagraphs = [
	'CICADA Dental（思科达 / 登煌医疗）是扎根佛山的口腔医疗设备研发制造品牌。',
	'公司从光固化设备制造起步，逐步发展为覆盖根管治疗设备、牙科手机、电动微马达、牙齿美白仪及临床辅助器械的综合口腔解决方案提供商。',
	'我们坚持以安全与质量为核心，通过研发、制造、售后和培训协同，为牙科专业人士提供稳定、高效、易用的设备支持。'
]

const advantages = [
	{ icon: 'lightning', title: '研发制造', desc: '高标准研发中心，配套来自德国、日本、韩国等地的精密设备，支撑产品快速迭代。' },
	{ icon: 'microscope', title: '质量合规', desc: '围绕医疗器械安全标准建立质量体系，产品满足国内外相关行业标准与注册要求。' }
]

const productLines = [
	{
		title: '根管治疗设备',
		desc: '覆盖根管马达、根管测量、热牙胶充填、冲洗等临床根管治疗场景。',
		gradient: 'linear-gradient(135deg, #2C5985 0%, #6BB0CC 100%)'
	},
	{
		title: '牙科手机与电动微马达',
		desc: '提供高速手机、增速弯机、电动微马达等高效、低噪、稳定的动力设备。',
		gradient: 'linear-gradient(135deg, #3D6F9E 0%, #6BB0CC 100%)'
	},
	{
		title: '光固化与美白设备',
		desc: '以光固化灯为起点，延伸到牙齿美白仪及修复、美学相关设备。',
		gradient: 'linear-gradient(135deg, #0A4FB8 0%, #6BB0CC 100%)'
	},
	{
		title: '洁牙抛光与辅助器械',
		desc: '覆盖喷砂抛光、临床器械及耗材配套，满足诊所日常诊疗效率需求。',
		gradient: 'linear-gradient(135deg, #1D8A96 0%, #7BC9C7 100%)'
	}
]

const serviceTags = ['及时售后', '临床培训', '全球服务网络']

const tabs = [
	{ id: 'home', label: '首页', icon: 'home' },
	{ id: 'company', label: '公司介绍', icon: 'company' },
	{ id: 'mine', label: '我的', icon: 'mine' }
]

const routes = {
	home: '/pages/index/index',
	company: '/pages-sub/company/index',
	mine: '/pages-sub/mine/index'
}

const go = (id) => {
	if (id === 'company') return
	uni.redirectTo({
		url: routes[id] || `/pages/${id}/index`,
		fail: () => uni.showToast({ title: '页面建设中', icon: 'none' })
	})
}

const callPhone = () => {
	uni.makePhoneCall({
		phoneNumber: '075785775667',
		fail: () => uni.showToast({ title: '电话：0757-85775667', icon: 'none' })
	})
}

const copyEmail = () => {
	uni.setClipboardData({
		data: 'info@cicadadental.com',
		success: () => uni.showToast({ title: '邮箱已复制', icon: 'success' })
	})
}
</script>

<style scoped>
.qual-list { margin-top: 20rpx; display: flex; flex-direction: column; gap: 20rpx; }
.qual-item { background: #f7f9fc; border-radius: 14rpx; padding: 20rpx; }
.qual-name { display: block; font-size: 27rpx; font-weight: 600; color: #1d2129; margin-bottom: 12rpx; }
.qual-image { width: 100%; border-radius: 10rpx; }
.qual-text { font-size: 25rpx; line-height: 1.7; color: #4e5969; }
.compliance-links { display: flex; align-items: center; justify-content: center; gap: 14rpx; padding: 28rpx 0 8rpx; }
.compliance-link { font-size: 25rpx; color: #1E6FE0; }
.compliance-divider { color: #c9cdd4; font-size: 22rpx; }
.page-shell {
	position: relative;
	min-height: 100vh;
	background: #E8EEFA;
	color: #0F1F3A;
	font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

.page-body {
	padding: calc(138rpx + env(safe-area-inset-top)) 28rpx 220rpx;
	box-sizing: border-box;
}

.tap:active {
	opacity: 0.82;
	transform: scale(0.98);
}

.page-header {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 30;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: calc(24rpx + env(safe-area-inset-top)) 28rpx 18rpx;
	background: rgba(232, 238, 250, 0.96);
	backdrop-filter: blur(10rpx);
	box-sizing: border-box;
}

.page-header-title {
	font-size: 32rpx;
	font-weight: 700;
	color: #0F1F3A;
	line-height: 1.2;
}

.icon-phone,
.icon-chat,
.icon-cert,
.adv-icon {
	position: relative;
	box-sizing: border-box;
}

.company-hero {
	position: relative;
	margin-top: 12rpx;
	height: 480rpx;
	overflow: hidden;
	border-radius: 28rpx;
	background: linear-gradient(135deg, #1A3C5C 0%, #2C5985 50%, #4A7BA6 100%);
	box-shadow: 0 10rpx 28rpx rgba(44, 89, 133, 0.16);
}

.hero-image {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}

.stats-grid {
	margin-top: 24rpx;
	display: flex;
	flex-wrap: wrap;
	gap: 18rpx;
}

.stat-card {
	width: calc((100% - 18rpx) / 2);
	padding: 26rpx 24rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.stat-value {
	display: block;
	font-size: 42rpx;
	font-weight: 800;
	line-height: 1.05;
	color: #1E6FE0;
}

.stat-label {
	display: block;
	margin-top: 10rpx;
	font-size: 25rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
}

.stat-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 21rpx;
	line-height: 1.3;
	color: #6B7C97;
}

.intro-card {
	margin-top: 24rpx;
	padding: 34rpx 32rpx;
	border-radius: 28rpx;
	background: linear-gradient(180deg, #FFFFFF 0%, #F7FAFF 100%);
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.intro-label {
	display: block;
	margin-bottom: 18rpx;
	font-size: 30rpx;
	font-weight: 800;
	line-height: 1.2;
	color: #0F1F3A;
}

.intro-text {
	display: block;
	margin-top: 14rpx;
	font-size: 27rpx;
	line-height: 1.7;
	color: #324563;
	letter-spacing: 0.4rpx;
}

.section {
	padding-top: 44rpx;
}

.section-head {
	padding: 0 4rpx 24rpx;
	display: flex;
	align-items: center;
	gap: 12rpx;
	font-size: 30rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
	letter-spacing: 0.6rpx;
}

.section-rule {
	width: 6rpx;
	height: 28rpx;
	border-radius: 4rpx;
	background: #1E6FE0;
}

.maint-list { display: flex; flex-direction: column; gap: 20rpx; }
.maint-card {
	border-radius: 24rpx;
	overflow: hidden;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
}
.maint-cover {
	position: relative;
	width: 100%;
	height: 320rpx;
	background: linear-gradient(135deg, #2C5985 0%, #6BB0CC 100%);
	display: flex;
	align-items: center;
	justify-content: center;
}
.maint-cover-img { width: 100%; height: 100%; }
.maint-play-badge {
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	width: 88rpx;
	height: 88rpx;
	border-radius: 999rpx;
	background: rgba(0, 0, 0, 0.42);
	display: flex;
	align-items: center;
	justify-content: center;
}
.maint-play-badge text { color: #FFFFFF; font-size: 36rpx; margin-left: 6rpx; }
.maint-info { padding: 24rpx 28rpx; }
.maint-title { display: block; font-size: 28rpx; font-weight: 700; line-height: 1.3; color: #0F1F3A; }
.maint-desc { display: block; margin-top: 10rpx; font-size: 24rpx; line-height: 1.6; color: #6B7C97; }

.auth-card {
	margin-bottom: 20rpx;
	padding: 32rpx;
	border-left: 6rpx solid #1E6FE0;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.auth-title-row {
	margin-bottom: 16rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	font-size: 30rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.icon-cert {
	width: 44rpx;
	height: 44rpx;
	border: 4rpx solid #1E6FE0;
	border-radius: 999rpx;
}

.icon-cert::before {
	content: "";
	position: absolute;
	left: 11rpx;
	top: 15rpx;
	width: 18rpx;
	height: 10rpx;
	border-left: 4rpx solid #1E6FE0;
	border-bottom: 4rpx solid #1E6FE0;
	transform: rotate(-45deg);
}

.icon-cert::after {
	content: "";
	position: absolute;
	left: 8rpx;
	bottom: -18rpx;
	width: 24rpx;
	height: 20rpx;
	border-left: 4rpx solid #1E6FE0;
	border-right: 4rpx solid #1E6FE0;
	transform: skew(-12deg);
}

.auth-desc {
	font-size: 26rpx;
	line-height: 1.7;
	color: #324563;
}

.adv-grid {
	display: flex;
	align-items: stretch;
	justify-content: space-between;
}

.adv-card {
	width: 337rpx;
	padding: 32rpx 28rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.adv-icon {
	width: 64rpx;
	height: 64rpx;
	margin-bottom: 20rpx;
	border-radius: 16rpx;
	background: #1E6FE0;
}

.adv-lightning::before {
	content: "";
	position: absolute;
	left: 22rpx;
	top: 10rpx;
	width: 20rpx;
	height: 42rpx;
	background: #FFFFFF;
	clip-path: polygon(58% 0, 100% 0, 66% 40%, 100% 40%, 30% 100%, 44% 54%, 10% 54%);
}

.adv-microscope::before {
	content: "";
	position: absolute;
	left: 18rpx;
	top: 12rpx;
	width: 22rpx;
	height: 30rpx;
	border-radius: 4rpx;
	background: #FFFFFF;
	transform: rotate(-18deg);
}

.adv-microscope::after {
	content: "";
	position: absolute;
	left: 14rpx;
	bottom: 12rpx;
	width: 36rpx;
	height: 7rpx;
	border-radius: 8rpx;
	background: #FFFFFF;
}

.adv-title {
	display: inline-block;
	padding-bottom: 16rpx;
	border-bottom: 4rpx solid #1E6FE0;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
}

.adv-desc {
	display: block;
	margin-top: 20rpx;
	font-size: 23rpx;
	line-height: 1.7;
	color: #6B7C97;
}

.business-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.business-card {
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 28rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
	box-sizing: border-box;
}

.service-card {
	padding: 36rpx 32rpx;
	border-radius: 28rpx;
	background: linear-gradient(135deg, #123B6D 0%, #1E6FE0 58%, #64B5D4 100%);
	box-shadow: 0 18rpx 42rpx rgba(30, 111, 224, 0.22);
	box-sizing: border-box;
}

.service-title {
	display: block;
	font-size: 30rpx;
	font-weight: 800;
	line-height: 1.3;
	color: #FFFFFF;
}

.service-desc {
	display: block;
	margin-top: 16rpx;
	font-size: 25rpx;
	line-height: 1.7;
	color: rgba(255, 255, 255, 0.86);
}

.service-tags {
	margin-top: 26rpx;
	display: flex;
	flex-wrap: wrap;
	gap: 14rpx;
}

.service-tags text {
	padding: 10rpx 18rpx;
	border: 1rpx solid rgba(255, 255, 255, 0.34);
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.13);
	font-size: 22rpx;
	color: #FFFFFF;
}

.business-visual {
	position: relative;
	width: 128rpx;
	height: 120rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	overflow: hidden;
	border-radius: 16rpx;
}

.device-shape {
	position: relative;
	width: 96rpx;
	height: 96rpx;
}

.device-0::before {
	content: "";
	position: absolute;
	left: 8rpx;
	top: 42rpx;
	width: 72rpx;
	height: 12rpx;
	border-radius: 5rpx;
	background: #4A8AB8;
}

.device-0::after {
	content: "";
	position: absolute;
	left: 66rpx;
	top: 46rpx;
	width: 28rpx;
	height: 4rpx;
	background: #1E6FE0;
	box-shadow: -56rpx 4rpx 0 #0F1F3A, -12rpx 20rpx 0 rgba(107, 176, 204, 0.75);
}

.device-1::before {
	content: "";
	position: absolute;
	left: 10rpx;
	top: 48rpx;
	width: 76rpx;
	height: 38rpx;
	border-top: 6rpx solid #4A8AB8;
	border-radius: 999rpx 999rpx 0 0;
}

.device-1::after {
	content: "";
	position: absolute;
	left: 58rpx;
	top: 28rpx;
	width: 16rpx;
	height: 16rpx;
	border-radius: 999rpx;
	background: #1E6FE0;
	box-shadow: -46rpx 48rpx 0 0 #6BB0CC;
}

.device-2::before {
	content: "";
	position: absolute;
	left: 12rpx;
	top: 16rpx;
	width: 72rpx;
	height: 56rpx;
	border: 4rpx solid #4A8AB8;
	border-radius: 8rpx;
	background: rgba(30, 79, 168, 0.15);
}

.device-2::after {
	content: "";
	position: absolute;
	left: 36rpx;
	top: 36rpx;
	width: 22rpx;
	height: 22rpx;
	border: 4rpx solid #1E6FE0;
	border-radius: 999rpx;
	background: transparent;
}

.business-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.business-title {
	font-size: 29rpx;
	font-weight: 700;
	line-height: 1.25;
	color: #0F1F3A;
}

.business-desc {
	margin-top: 8rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: #6B7C97;
}

.follow-card {
	margin-top: 44rpx;
	padding: 44rpx 36rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	border-radius: 28rpx;
	background: #D7E3FA;
	text-align: center;
	box-shadow: 0 8rpx 26rpx rgba(30, 111, 224, 0.12);
	box-sizing: border-box;
}

.qr-wrap {
	width: 208rpx;
	height: 208rpx;
	padding: 12rpx;
	border-radius: 24rpx;
	background: #FFFFFF;
	box-shadow: 0 8rpx 28rpx rgba(30, 111, 224, 0.18);
	box-sizing: border-box;
}

.qr-image {
	width: 100%;
	height: 100%;
	border-radius: 12rpx;
}

.follow-title {
	margin-top: 28rpx;
	font-size: 28rpx;
	font-weight: 600;
	line-height: 1.2;
	color: #1E6FE0;
}

.follow-desc {
	margin-top: 16rpx;
	padding: 0 24rpx;
	font-size: 24rpx;
	line-height: 1.7;
	color: #324563;
}

.contact-row {
	width: 100%;
	margin-top: 32rpx;
	display: flex;
	gap: 18rpx;
}

.contact-pill {
	flex: 1;
	height: 86rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: linear-gradient(180deg, #2A6CD3 0%, #0A4FB8 100%);
	box-shadow: 0 18rpx 42rpx -18rpx rgba(10, 79, 184, 0.5);
	color: #FFFFFF;
	font-size: 28rpx;
	font-weight: 700;
}

.contact-pill.ghost {
	border: 1rpx solid rgba(30, 111, 224, 0.22);
	background: #FFFFFF;
	box-shadow: none;
	color: #1E6FE0;
}

.float-actions {
	position: fixed;
	right: 36rpx;
	bottom: 180rpx;
	z-index: 20;
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.float-btn {
	width: 96rpx;
	height: 96rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 4rpx solid #FFFFFF;
	border-radius: 999rpx;
	background: linear-gradient(180deg, #3A86FF 0%, #1E6FE0 100%);
	box-shadow: 0 20rpx 48rpx -12rpx rgba(30, 111, 224, 0.55);
	color: #FFFFFF;
}

.icon-chat {
	width: 44rpx;
	height: 32rpx;
	border: 4rpx solid currentColor;
	border-radius: 10rpx;
}

.icon-chat::after {
	content: "";
	position: absolute;
	left: 8rpx;
	bottom: -12rpx;
	width: 14rpx;
	height: 14rpx;
	border-left: 4rpx solid currentColor;
	border-bottom: 4rpx solid currentColor;
	transform: rotate(-45deg);
}

.icon-phone {
	width: 42rpx;
	height: 42rpx;
	border-right: 8rpx solid currentColor;
	border-bottom: 8rpx solid currentColor;
	border-radius: 0 0 18rpx 0;
	transform: rotate(45deg);
}
</style>
