<template>
	<view class="page-shell">
		<view class="mine-hero">
			<view class="mine-topbar">
				<text class="mine-topbar-title">我的</text>
			</view>

			<view class="profile-row">
				<view class="avatar" :class="{ 'avatar-logged': logged }" @click="logged && openEditProfile()">
					<image v-if="logged && avatarDisplayUrl" class="avatar-img" :src="avatarDisplayUrl" mode="aspectFill"></image>
					<text v-else-if="logged">{{ userAvatarText }}</text>
					<image v-else class="avatar-empty" src="/static/default-user-avatar.png" mode="aspectFit"></image>
				</view>
				<view class="profile-copy" @click="logged && openEditProfile()">
					<view class="profile-name-row">
						<text class="profile-name">{{ logged ? userDisplayName : '未登录' }}</text>
						<text v-if="logged" class="profile-edit-tag">编辑</text>
					</view>
					<view v-if="logged" class="profile-meta">
						<text>{{ userDisplayUnit }}</text>
						<text class="member-tag">已登录</text>
					</view>
					<text v-else class="profile-meta-text">登录后查看您的维修订单</text>
				</view>
				<view class="logout-btn tap" @click.stop="toggleLogin">{{ logged ? '退出' : '注册/登录' }}</view>
			</view>
		</view>

		<view class="order-wrap">
			<view class="order-card">
				<view class="order-head tap" @click="go('orders')">
					<view class="order-title-row">
						<view class="section-rule"></view>
						<text>我的维修单</text>
					</view>
					<view class="order-more">
						<text>查看全部</text>
						<view class="chevron"></view>
					</view>
				</view>
				<view class="status-grid">
					<view v-for="item in statusItems" :key="item.id" class="status-item tap" @click="goOrder(item.type)">
						<view class="status-icon" :style="{ color: item.color, backgroundColor: item.bg }">
							<view :class="['glyph', 'glyph-' + item.icon]"><view></view></view>
							<text v-if="item.count > 0" class="badge">{{ item.count }}</text>
						</view>
						<text class="status-text">{{ item.title }}</text>
					</view>
				</view>
				<view v-if="logged && todoItems.length" class="mine-todo-list">
					<view v-for="item in todoItems" :key="item.label" class="mine-todo-row tap" @click="goOrder(item.type)">
						<text class="mine-todo-label">{{ item.label }}</text>
						<view class="mine-todo-right">
							<text class="mine-todo-count">{{ item.count }} 单</text>
							<view class="chevron"></view>
						</view>
					</view>
				</view>
			</view>
		</view>

		<view class="settings-section">
			<view class="section-head">
				<view class="section-rule"></view>
				<text>服务与设置</text>
			</view>
			<view class="settings-card">
				<view v-for="(item, index) in menus" :key="item.title" class="menu-row tap" :class="{ last: index === menus.length - 1 }" @click="go(item.go)">
					<view class="menu-icon">
						<view :class="['glyph', 'glyph-' + item.icon]"><view></view></view>
					</view>
					<view class="menu-copy">
						<text class="menu-title">{{ item.title }}</text>
						<text class="menu-desc">{{ item.desc }}</text>
					</view>
					<view class="chevron"></view>
				</view>
			</view>
		</view>

		<view class="footer-brand">
			<image class="footer-logo" :src="cicadaAssets.logoFull" mode="aspectFit"></image>
			<text>佛山思科达 · 牙医仪器检修 v1.2.0</text>
		</view>

		<BottomTabbar :tabs="tabs" active-id="mine" @select="go" />

		<!-- 编辑资料弹层：微信已禁止自动获取昵称头像，须用户主动选择/填写 -->
		<view v-if="editVisible" class="edit-mask" @click="closeEditProfile">
			<view class="edit-sheet" @click.stop>
				<view class="edit-title">编辑资料</view>

				<view class="edit-avatar-row">
					<button class="edit-avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
						<image v-if="editAvatarUrl" class="edit-avatar-img" :src="editAvatarUrl" mode="aspectFill"></image>
						<view v-else class="edit-avatar-ph">选择头像</view>
					</button>
					<text class="edit-avatar-hint">点击选择微信头像</text>
				</view>

				<view class="edit-field">
					<text class="edit-label">昵称</text>
					<input
						class="edit-input"
						type="nickname"
						:value="editNickname"
						placeholder="点击输入，可使用微信昵称"
						placeholder-class="edit-input-ph"
						maxlength="30"
						@input="onNicknameInput"
						@blur="onNicknameInput"
					/>
				</view>

				<view class="edit-actions">
					<view class="edit-btn cancel tap" @click="closeEditProfile">取消</view>
					<view class="edit-btn save tap" :class="{ disabled: saving }" @click="saveProfile">{{ saving ? '保存中…' : '保存' }}</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BottomTabbar from '@/components/BottomTabbar.vue'
import { cicadaAssets } from '@/config/cicada-assets'
import { getMyDevices, getRepairList, getRepairStats } from '@/api/repair'
import { countStatusBuckets } from '@/pages/index/composables/statusMeta.js'
import { updateProfile, logout as logoutRemote } from '@/api/auth'
import { uploadToCloud } from '@/api/cloudHelpers.js'
import { getCloudTempFileURL } from '@/utils/cloud.js'
import { toCustomerErrorMessage } from '@/utils/customer-error.js'

const logged = ref(false)
const currentUser = ref({})
const repairCounts = ref({ all: 0, pending: 0, fixing: 0, shipped: 0 })
const statsTodo = ref({ unfinished: 0, payment: 0, receipt: 0, invoice: 0 })
const productCount = ref(0)

// 头像展示：库里存 cloud:// fileID，需转临时链接才能渲染
const avatarDisplayUrl = ref('')
// 编辑资料弹层状态
const editVisible = ref(false)
const editNickname = ref('')
const editAvatarUrl = ref('')       // 弹层内预览用的可显示 URL
const editAvatarFileId = ref('')    // 待保存的 cloud:// fileID（选新头像后才有值）
const saving = ref(false)

const syncLoginState = () => {
	const token = uni.getStorageSync('token')
	currentUser.value = uni.getStorageSync('userInfo') || {}
	logged.value = Boolean(token)
	if (token) {
		resolveAvatar(currentUser.value.avatar)
		loadRepairCounts()
		loadProductCount()
	} else {
		avatarDisplayUrl.value = ''
		repairCounts.value = { all: 0, pending: 0, fixing: 0, shipped: 0 }
		statsTodo.value = { unfinished: 0, payment: 0, receipt: 0, invoice: 0 }
		productCount.value = 0
	}
}

onMounted(syncLoginState)
onShow(syncLoginState)

// 把 cloud:// fileID 转成可显示的临时链接；已是 http(s) 直链则原样用
const resolveAvatar = async (raw) => {
	const value = String(raw || '')
	if (!value) { avatarDisplayUrl.value = ''; return }
	if (!value.startsWith('cloud://')) { avatarDisplayUrl.value = value; return }
	try {
		const res = await getCloudTempFileURL([value])
		const item = res && res.fileList && res.fileList[0]
		avatarDisplayUrl.value = (item && item.tempFileURL) || ''
	} catch (e) {
		avatarDisplayUrl.value = ''
	}
}

const userDisplayName = computed(() => currentUser.value.nickname || currentUser.value.name || (currentUser.value.phone ? `用户${String(currentUser.value.phone).slice(-4)}` : '已登录用户'))
const userDisplayUnit = computed(() => currentUser.value.unit || currentUser.value.companyName || '已绑定手机号')
const userAvatarText = computed(() => String(userDisplayName.value || '用').slice(0, 1))

// ============== 编辑资料（昵称/头像） ==============
const openEditProfile = () => {
	editNickname.value = currentUser.value.nickname || ''
	editAvatarUrl.value = avatarDisplayUrl.value || ''
	editAvatarFileId.value = ''
	editVisible.value = true
}

const closeEditProfile = () => {
	if (saving.value) return
	editVisible.value = false
}

const onNicknameInput = (e) => {
	editNickname.value = (e && e.detail && e.detail.value) || ''
}

// chooseAvatar 返回本地临时路径，先本地预览，保存时再上传云存储
const onChooseAvatar = (e) => {
	const path = e && e.detail && e.detail.avatarUrl
	if (!path) return
	editAvatarUrl.value = path
	editAvatarFileId.value = path // 暂存本地路径，saveProfile 时上传换成 fileID
}

const saveProfile = async () => {
	if (saving.value) return
	const nickname = String(editNickname.value || '').trim()
	// 头像未换时 fileId 为空，nickname 与原值相同则视为无改动
	const localAvatarPath = editAvatarFileId.value
	if (!nickname && !localAvatarPath) {
		uni.showToast({ title: '请填写昵称或选择头像', icon: 'none' })
		return
	}
	saving.value = true
	uni.showLoading({ title: '保存中…', mask: true })
	try {
		const payload = {}
		if (nickname !== (currentUser.value.nickname || '')) payload.nickname = nickname
		// 选了新头像才上传；上传得到 cloud:// fileID 再提交
		if (localAvatarPath && localAvatarPath.indexOf('cloud://') !== 0) {
			const up = await uploadToCloud(localAvatarPath, 'avatars', 'png')
			payload.avatar = (up && (up.fileID || up.url)) || ''
		}
		if (!Object.keys(payload).length) {
			uni.hideLoading()
			saving.value = false
			editVisible.value = false
			return
		}
		const info = await updateProfile(payload)
		currentUser.value = info || currentUser.value
		await resolveAvatar(currentUser.value.avatar)
		uni.hideLoading()
		uni.showToast({ title: '已保存', icon: 'success' })
		editVisible.value = false
	} catch (error) {
		uni.hideLoading()
		uni.showToast({ title: toCustomerErrorMessage(error, '保存失败'), icon: 'none' })
	} finally {
		saving.value = false
	}
}

const statusItems = computed(() => [
	{ id: 'all', title: '全部', count: repairCounts.value.all, color: '#1E6FE0', bg: 'rgba(30, 111, 224, 0.09)', icon: 'invoice', type: 0 },
	{ id: 'pending', title: '待处理', count: repairCounts.value.pending, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.09)', icon: 'track', type: 1 },
	{ id: 'fixing', title: '维修中', count: repairCounts.value.fixing, color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.09)', icon: 'repair', type: 2 },
	{ id: 'shipped', title: '已发货', count: repairCounts.value.shipped, color: '#10B981', bg: 'rgba(16, 185, 129, 0.09)', icon: 'truck', type: 3 }
])

// 高频待办行：type 为 index.vue openModule typeMap 的数字索引（4=未开票，6=待付款，3=已回寄）
const todoItems = computed(() => [
	{ label: '待付款', count: Number(statsTodo.value.payment) || 0, type: 6 },
	{ label: '待确认收货', count: Number(statsTodo.value.receipt) || 0, type: 3 },
	{ label: '待开票', count: Number(statsTodo.value.invoice) || 0, type: 4 }
].filter((item) => item.count > 0))

const loadRepairCounts = async () => {
	// 优先用 DB 端聚合统计
	try {
		const stats = await getRepairStats()
		if (stats && typeof stats === 'object' && (stats.total !== undefined || stats.byStatus)) {
			repairCounts.value = {
				all: Number(stats.total || 0),
				pending: Number(stats.pending || 0),
				fixing: Number(stats.fixing || 0),
				shipped: Number(stats.shipped || 0)
			}
			if (stats.todo) statsTodo.value = { ...statsTodo.value, ...stats.todo }
			return
		}
	} catch (error) {
		console.warn('load repair stats failed, fallback to list count:', error)
	}
	// 兜底：拉列表本地分桶（与后端 getOrderStats 同口径，统一走共享分桶逻辑）
	try {
		const data = await getRepairList({ page: 1, size: 100 })
		const list = Array.isArray(data) ? data : data.list
		if (!Array.isArray(list)) return
		repairCounts.value = countStatusBuckets(list)
	} catch (error) {
		console.warn('load repair counts failed:', error)
	}
}

const loadProductCount = async () => {
	try {
		const data = await getMyDevices({ page: 1, size: 100 })
		const list = Array.isArray(data) ? data : (data?.list || [])
		const total = Number(data?.total || data?.count || list.length)
		if (Number.isFinite(total) && total >= 0) {
			productCount.value = total
		}
	} catch (error) {
		console.warn('load product count failed:', error)
	}
}

const menus = computed(() => [
	{ icon: 'pin', title: '收货地址管理', desc: '多地址 · 默认回寄地址', go: 'address' },
	{ icon: 'edit', title: '投诉和建议', desc: '问题反馈 / 改进建议', go: 'feedback' },
	{ icon: 'box', title: '我的产品', desc: `${productCount.value} 件设备档案`, go: 'products' },
	{ icon: 'invoice', title: '发票与开票', desc: '申请开票 / 下载电子发票', go: 'invoices' }
])

const tabs = [
	{ id: 'home', label: '首页', icon: 'home' },
	{ id: 'company', label: '公司介绍', icon: 'company' },
	{ id: 'mine', label: '我的', icon: 'mine' }
]

const routes = {
	home: '/pages/index/index',
	company: '/pages-sub/company/index',
	mine: '/pages-sub/mine/index',
	orders: '/pages/index/index?module=orders',
	address: '/pages-sub/address/index',
	feedback: '/pages/index/index?module=feedback',
	products: '/pages/index/index?module=products',
	invoices: '/pages/index/index?module=invoices',
	'guide-invoice': '/pages/index/index?module=guide-invoice',
	warranty: '/pages/index/index?module=warranty'
}

const toggleLogin = () => {
	if (logged.value) {
		uni.showModal({
			title: '退出登录',
			content: '确定退出当前账号？',
			confirmText: '退出',
			success: async (res) => {
				if (!res.confirm) return
				try {
					await logoutRemote()
				} catch (error) {
					uni.removeStorageSync('token')
					uni.removeStorageSync('isLoggedIn')
					uni.removeStorageSync('userInfo')
				}
				currentUser.value = {}
				repairCounts.value = { all: 0, pending: 0, fixing: 0, shipped: 0 }
				statsTodo.value = { unfinished: 0, payment: 0, receipt: 0, invoice: 0 }
				productCount.value = 0
				avatarDisplayUrl.value = ''
				logged.value = false
				uni.showToast({ title: '已退出登录', icon: 'success' })
			}
		})
	} else {
		uni.navigateTo({ url: '/pages/login/index' })
	}
}

const go = (id) => {
	if (id === 'mine') return
	const url = routes[id] || `/pages/${id}/index`
	if (id === 'home' || id === 'company') {
		uni.redirectTo({
			url,
			fail: () => uni.showToast({ title: '打开失败', icon: 'none' })
		})
		return
	}
	uni.navigateTo({
		url,
		fail: () => uni.showToast({ title: '打开失败', icon: 'none' })
	})
}

const goOrder = (type) => {
	uni.redirectTo({
		url: `/pages/index/index?type=${type}`,
		fail: () => uni.showToast({ title: '打开失败', icon: 'none' })
	})
}
</script>

<style scoped>
.page-shell {
	position: relative;
	min-height: 100vh;
	padding-bottom: 220rpx;
	background: #E8EEFA;
	color: #0F1F3A;
	font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
	box-sizing: border-box;
}

.tap:active {
	opacity: 0.82;
	transform: scale(0.98);
}

.mine-hero {
	position: relative;
	padding: calc(118rpx + env(safe-area-inset-top)) 36rpx 160rpx;
	background: linear-gradient(180deg, #1E6FE0 0%, #3A86FF 100%);
	color: #FFFFFF;
	box-sizing: border-box;
}

.mine-topbar {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	z-index: 30;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: calc(24rpx + env(safe-area-inset-top)) 36rpx 0;
	box-sizing: border-box;
}

.mine-topbar-title {
	font-size: 32rpx;
	font-weight: 700;
	line-height: 1;
	color: #FFFFFF;
}

.profile-row {
	display: flex;
	align-items: center;
	gap: 28rpx;
}

.avatar {
	width: 120rpx;
	height: 120rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	overflow: hidden;
	border-radius: 999rpx;
	border: none;
	background: transparent;
	box-shadow: none;
	color: #FFFFFF;
	font-size: 48rpx;
	font-weight: 700;
	box-sizing: border-box;
}

.avatar-logged {
	background: #FFFFFF;
	color: #1E6FE0;
}

.avatar-empty {
	width: 120rpx;
	height: 120rpx;
	display: block;
}

.avatar-img {
	width: 120rpx;
	height: 120rpx;
	display: block;
	border-radius: 999rpx;
}

.profile-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.profile-name-row {
	display: flex;
	align-items: center;
	gap: 12rpx;
}

.profile-edit-tag {
	font-size: 21rpx;
	line-height: 1;
	color: #FFFFFF;
	padding: 5rpx 14rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.22);
}

.profile-name {
	font-size: 34rpx;
	font-weight: 700;
	line-height: 1.25;
	color: #FFFFFF;
}

.profile-meta {
	margin-top: 6rpx;
	display: flex;
	align-items: center;
	gap: 12rpx;
	font-size: 23rpx;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.85);
}

.profile-meta-text {
	margin-top: 6rpx;
	font-size: 23rpx;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.85);
}

.member-tag {
	padding: 2rpx 14rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.18);
	font-size: 20rpx;
	font-weight: 600;
	letter-spacing: 0.4rpx;
}

.logout-btn {
	padding: 14rpx 28rpx;
	flex-shrink: 0;
	border: 2rpx solid rgba(255, 255, 255, 0.3);
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.18);
	color: #FFFFFF;
	font-size: 24rpx;
	font-weight: 500;
}

.order-wrap {
	position: relative;
	z-index: 2;
	margin-top: -116rpx;
	padding: 0 28rpx;
}

.order-card {
	overflow: hidden;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
}

.order-head {
	padding: 28rpx 32rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 2rpx solid #F1F5FB;
	box-sizing: border-box;
}

.order-title-row,
.section-head {
	display: flex;
	align-items: center;
	gap: 16rpx;
	font-size: 30rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
}

.section-rule {
	width: 6rpx;
	height: 28rpx;
	border-radius: 4rpx;
	background: #1E6FE0;
}

.order-more {
	display: flex;
	align-items: center;
	gap: 8rpx;
	font-size: 24rpx;
	color: #6B7C97;
}

.chevron {
	width: 14rpx;
	height: 14rpx;
	border-top: 3rpx solid #C4D1E4;
	border-right: 3rpx solid #C4D1E4;
	transform: rotate(45deg);
	flex-shrink: 0;
}

.status-grid {
	padding: 36rpx 20rpx 32rpx;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
}

.status-item {
	position: relative;
	width: 25%;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12rpx;
}

.status-icon {
	position: relative;
	width: 88rpx;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 26rpx;
}

.badge {
	position: absolute;
	top: -8rpx;
	right: -8rpx;
	min-width: 32rpx;
	height: 32rpx;
	padding: 0 10rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 4rpx solid #FFFFFF;
	border-radius: 999rpx;
	background: #E5484D;
	color: #FFFFFF;
	font-size: 20rpx;
	font-weight: 700;
	box-sizing: border-box;
}

.status-text {
	font-size: 24rpx;
	font-weight: 500;
	line-height: 1.2;
	color: #324563;
}

.mine-todo-list {
	margin: 0 32rpx;
	padding-bottom: 12rpx;
	border-top: 2rpx solid #F1F5FB;
}

.mine-todo-row {
	padding: 22rpx 4rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 2rpx solid #F1F5FB;
}

.mine-todo-row:last-child {
	border-bottom: none;
}

.mine-todo-label {
	font-size: 26rpx;
	font-weight: 600;
	color: #0F1F3A;
}

.mine-todo-right {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.mine-todo-count {
	font-size: 24rpx;
	font-weight: 700;
	color: #E5484D;
}

.settings-section {
	padding: 28rpx 28rpx 0;
}

.section-head {
	padding: 0 8rpx 20rpx;
}

.settings-card {
	overflow: hidden;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05);
}

.menu-row {
	padding: 28rpx;
	display: flex;
	align-items: center;
	gap: 24rpx;
	border-bottom: 2rpx solid #F1F5FB;
	box-sizing: border-box;
}

.menu-row.last {
	border-bottom: none;
}

.menu-icon {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border-radius: 20rpx;
	background: #F3F8FF;
	color: #1E6FE0;
}

.menu-copy {
	min-width: 0;
	flex: 1;
	display: flex;
	flex-direction: column;
}

.menu-title {
	font-size: 28rpx;
	font-weight: 500;
	line-height: 1.25;
	color: #0F1F3A;
}

.menu-desc {
	margin-top: 4rpx;
	font-size: 22rpx;
	line-height: 1.3;
	color: #94A3B8;
}

.footer-brand {
	padding: 48rpx 28rpx 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	color: #94A3B8;
	font-size: 22rpx;
	line-height: 1.3;
}

.footer-logo {
	width: 260rpx;
	height: 48rpx;
	margin-bottom: 12rpx;
	opacity: 0.55;
}

.glyph {
	position: relative;
	width: 44rpx;
	height: 44rpx;
	color: currentColor;
	box-sizing: border-box;
}

.glyph::before,
.glyph::after,
.glyph view {
	content: "";
	position: absolute;
	box-sizing: border-box;
}

.glyph-invoice::before,
.glyph-box::before {
	left: 10rpx;
	top: 6rpx;
	width: 24rpx;
	height: 32rpx;
	border: 4rpx solid currentColor;
	border-radius: 5rpx;
}

.glyph-invoice::after {
	left: 15rpx;
	top: 17rpx;
	width: 14rpx;
	height: 4rpx;
	border-radius: 4rpx;
	background: currentColor;
	box-shadow: 0 9rpx 0 currentColor;
}

.glyph-track::before {
	left: 5rpx;
	top: 5rpx;
	width: 34rpx;
	height: 34rpx;
	border: 4rpx solid currentColor;
	border-radius: 999rpx;
}

.glyph-track::after {
	left: 20rpx;
	top: 11rpx;
	width: 4rpx;
	height: 15rpx;
	border-radius: 4rpx;
	background: currentColor;
}

.glyph-track view {
	left: 21rpx;
	top: 23rpx;
	width: 13rpx;
	height: 4rpx;
	border-radius: 4rpx;
	background: currentColor;
	transform: rotate(26deg);
}

.glyph-repair::before,
.glyph-edit::before {
	left: 6rpx;
	top: 20rpx;
	width: 34rpx;
	height: 7rpx;
	border-radius: 8rpx;
	background: currentColor;
	transform: rotate(-45deg);
}

.glyph-repair::after,
.glyph-edit::after {
	left: 24rpx;
	top: 5rpx;
	width: 14rpx;
	height: 14rpx;
	border: 4rpx solid currentColor;
	border-radius: 5rpx;
	transform: rotate(45deg);
}

.glyph-truck::before {
	left: 4rpx;
	top: 13rpx;
	width: 24rpx;
	height: 18rpx;
	border: 4rpx solid currentColor;
}

.glyph-truck::after {
	left: 28rpx;
	top: 18rpx;
	width: 14rpx;
	height: 13rpx;
	border: 4rpx solid currentColor;
	border-left: none;
}

.glyph-truck view {
	left: 9rpx;
	bottom: 4rpx;
	width: 8rpx;
	height: 8rpx;
	border: 3rpx solid currentColor;
	border-radius: 999rpx;
	box-shadow: 21rpx 0 0 -1rpx #FFFFFF, 21rpx 0 0 2rpx currentColor;
}

.glyph-pin::before {
	left: 11rpx;
	top: 4rpx;
	width: 22rpx;
	height: 22rpx;
	border: 4rpx solid currentColor;
	border-radius: 999rpx;
}

.glyph-pin::after {
	left: 15rpx;
	top: 23rpx;
	width: 14rpx;
	height: 14rpx;
	border-right: 4rpx solid currentColor;
	border-bottom: 4rpx solid currentColor;
	transform: rotate(45deg);
}

.glyph-box::after {
	left: 6rpx;
	top: 12rpx;
	width: 32rpx;
	height: 24rpx;
	border: 4rpx solid currentColor;
	border-radius: 5rpx;
}

.glyph-box view {
	left: 8rpx;
	top: 18rpx;
	width: 28rpx;
	height: 4rpx;
	background: currentColor;
	transform: rotate(20deg);
}

.glyph-shield::before {
	left: 7rpx;
	top: 4rpx;
	width: 30rpx;
	height: 36rpx;
	border: 4rpx solid currentColor;
	border-radius: 18rpx 18rpx 12rpx 12rpx;
}

.glyph-shield::after {
	left: 14rpx;
	top: 19rpx;
	width: 17rpx;
	height: 10rpx;
	border-left: 4rpx solid currentColor;
	border-bottom: 4rpx solid currentColor;
	transform: rotate(-45deg);
}

.glyph-phone::before {
	left: 8rpx;
	top: 8rpx;
	width: 28rpx;
	height: 28rpx;
	border-right: 7rpx solid currentColor;
	border-bottom: 7rpx solid currentColor;
	border-radius: 0 0 14rpx 0;
	transform: rotate(45deg);
}

/* ============== 编辑资料弹层 ============== */
.edit-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 200;
	background: rgba(15, 23, 42, 0.45);
	display: flex;
	align-items: flex-end;
}

.edit-sheet {
	width: 100%;
	background: #FFFFFF;
	border-radius: 28rpx 28rpx 0 0;
	padding: 36rpx 40rpx calc(40rpx + constant(safe-area-inset-bottom));
	padding: 36rpx 40rpx calc(40rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}

.edit-title {
	font-size: 32rpx;
	font-weight: 700;
	color: #1E293B;
	text-align: center;
	margin-bottom: 32rpx;
}

.edit-avatar-row {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12rpx;
	margin-bottom: 32rpx;
}

.edit-avatar-btn {
	width: 140rpx;
	height: 140rpx;
	padding: 0;
	border-radius: 999rpx;
	overflow: hidden;
	background: #F1F5F9;
	border: 2rpx solid #E4ECF7;
	display: flex;
	align-items: center;
	justify-content: center;
	line-height: 1;
}

.edit-avatar-btn::after {
	border: none;
}

.edit-avatar-img {
	width: 140rpx;
	height: 140rpx;
	display: block;
}

.edit-avatar-ph {
	font-size: 24rpx;
	color: #94A3B8;
}

.edit-avatar-hint {
	font-size: 22rpx;
	color: #94A3B8;
}

.edit-field {
	display: flex;
	align-items: center;
	gap: 20rpx;
	padding: 24rpx 0;
	border-top: 2rpx solid #F1F5F9;
}

.edit-label {
	font-size: 28rpx;
	color: #475569;
	width: 96rpx;
	flex-shrink: 0;
}

.edit-input {
	flex: 1;
	font-size: 28rpx;
	color: #1E293B;
	text-align: right;
}

.edit-input-ph {
	color: #CBD5E1;
}

.edit-actions {
	display: flex;
	gap: 20rpx;
	margin-top: 36rpx;
}

.edit-btn {
	flex: 1;
	height: 84rpx;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 30rpx;
	font-weight: 600;
}

.edit-btn.cancel {
	background: #F1F5F9;
	color: #475569;
}

.edit-btn.save {
	background: #1E6FE0;
	color: #FFFFFF;
}

.edit-btn.save.disabled {
	opacity: 0.6;
}

</style>
