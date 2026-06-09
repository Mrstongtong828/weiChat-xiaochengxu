<template>
	<view class="page-shell">
		<view class="wx-top">
			<view class="nav-row">
				<view class="back-btn tap" @click="goBack">
					<view class="chevron-left"></view>
				</view>
				<text class="nav-title">{{ showForm ? formTitle : '收货地址管理' }}</text>
				<view class="nav-spacer"></view>
			</view>
		</view>

		<view v-if="!showForm" class="address-page">
			<view class="hero-card">
				<view class="hero-copy">
					<text class="hero-kicker">回寄信息</text>
					<text class="hero-title">管理常用收货地址</text>
					<text class="hero-desc">可保存多个地址，默认地址会优先用于维修回寄信息。</text>
				</view>
				<view class="hero-icon">
					<view class="pin-mark"></view>
				</view>
			</view>

			<view class="summary-row">
				<view class="summary-card">
					<text>{{ addresses.length }}</text>
					<text>已保存地址</text>
				</view>
				<view class="summary-card">
					<text>{{ defaultAddressName }}</text>
					<text>默认联系人</text>
				</view>
			</view>

			<view v-if="addresses.length" class="address-list">
				<view v-for="item in addresses" :key="item.id" class="address-card">
					<view class="card-head">
						<view class="person-line">
							<text class="person-name">{{ item.receiver }}</text>
							<text class="person-phone">{{ formatPhone(item.phone) }}</text>
						</view>
						<text v-if="item.isDefault" class="default-tag">默认</text>
					</view>
					<text v-if="item.unit" class="unit-line">{{ item.unit }}</text>
					<text class="detail-line">{{ fullAddress(item) }}</text>
					<view v-if="validContacts(item).length" class="contact-row">
						<text v-for="phone in validContacts(item)" :key="phone">{{ formatPhone(phone) }}</text>
					</view>
					<view class="card-actions">
						<view class="action-link tap" @click="editAddress(item)">编辑</view>
						<view v-if="!item.isDefault" class="action-link tap" @click="setDefault(item.id)">设为默认</view>
						<view class="action-link danger tap" @click="deleteAddress(item.id)">删除</view>
					</view>
				</view>
			</view>

			<view v-else class="empty-card">
				<view class="empty-illustration">
					<view></view>
					<view></view>
				</view>
				<text class="empty-title">还没有收货地址</text>
				<text class="empty-desc">新增后，后续报修回寄时可以快速选择和复用。</text>
			</view>

			<view class="add-address-btn tap" @click="createAddress">
				<text>+</text>
				<text>新增收货地址</text>
			</view>
		</view>

		<view v-else class="form-page">
			<view class="recognize-card">
				<view class="section-title">
					<text>智能识别</text>
					<text>可粘贴姓名、电话、地址</text>
				</view>
				<textarea
					v-model="form.smartText"
					class="recognize-input"
					maxlength="300"
					placeholder="例如：李医生 13800138000 广西桂林象山区中山中路88号 桂林口腔门诊"
					placeholder-class="input-placeholder"
				></textarea>
				<view class="recognize-btn tap" @click="recognizeAddress">确认识别</view>
			</view>

			<view class="form-card">
				<view class="field-row">
					<text class="field-label"><text class="required-star">*</text>收货人</text>
					<input v-model="form.receiver" class="field-input" placeholder="请输入用户姓名" placeholder-class="input-placeholder" />
				</view>
				<view class="field-row">
					<text class="field-label"><text class="required-star">*</text>手机号码</text>
					<input v-model="form.phone" class="field-input" type="number" maxlength="11" placeholder="请输入用户手机" placeholder-class="input-placeholder" />
				</view>
				<view class="field-row tap">
					<text class="field-label">所在地区</text>
					<picker class="field-picker" mode="region" :value="form.region" @change="onRegionChange">
						<view class="picker-value">
							<text :class="{ placeholder: !regionText }">{{ regionText || '请选择省 / 市 / 区' }}</text>
							<view class="field-arrow"></view>
						</view>
					</picker>
				</view>
				<view class="field-row">
					<text class="field-label"><text class="required-star">*</text>详细地址</text>
					<input v-model="form.detail" class="field-input" placeholder="请输入用户地址" placeholder-class="input-placeholder" />
					<view class="field-pin"></view>
				</view>
				<view class="field-row">
					<text class="field-label">单位名称</text>
					<input v-model="form.unit" class="field-input" placeholder="请输入单位名称" placeholder-class="input-placeholder" />
				</view>
				<view class="field-row">
					<text class="field-label">联系人1手机号</text>
					<input v-model="form.contactPhones[0]" class="field-input" type="number" maxlength="11" placeholder="请输入联系人1手机号" placeholder-class="input-placeholder" />
				</view>
				<view class="field-row">
					<text class="field-label">联系人2手机号</text>
					<input v-model="form.contactPhones[1]" class="field-input" type="number" maxlength="11" placeholder="请输入联系人2手机号" placeholder-class="input-placeholder" />
				</view>
				<view class="field-row last">
					<text class="field-label">联系人3手机号</text>
					<input v-model="form.contactPhones[2]" class="field-input" type="number" maxlength="11" placeholder="请输入联系人3手机号" placeholder-class="input-placeholder" />
				</view>
			</view>

			<view class="default-card tap" @click="form.isDefault = !form.isDefault">
				<view class="default-copy">
					<text>设为默认地址</text>
					<text>维修回寄时优先使用该地址</text>
				</view>
				<view class="default-check" :class="{ checked: form.isDefault }">
					<view></view>
				</view>
			</view>

			<view class="form-actions">
				<view v-if="form.id" class="ghost-btn tap" @click="deleteAddress(form.id)">删除</view>
				<view class="save-btn tap" @click="saveAddress">保存</view>
			</view>
		</view>

		<view class="help-bubble tap" @click="callService">
			<view class="smile-face">
				<view class="eye one"></view>
				<view class="eye two"></view>
				<view class="mouth"></view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const STORAGE_KEY = 'receiverAddressList'

const addresses = ref([])
const showForm = ref(false)

const emptyForm = () => ({
	id: '',
	receiver: '',
	phone: '',
	region: [],
	detail: '',
	unit: '',
	contactPhones: ['', '', ''],
	isDefault: false,
	smartText: ''
})

const form = ref(emptyForm())

const formTitle = computed(() => (form.value.id ? '编辑收货地址' : '新增收货地址'))
const regionText = computed(() => (form.value.region || []).filter(Boolean).join(' / '))
const defaultAddressName = computed(() => {
	const target = addresses.value.find((item) => item.isDefault)
	return target ? target.receiver : '未设置'
})

onMounted(() => {
	loadAddresses()
})

const loadAddresses = () => {
	const saved = uni.getStorageSync(STORAGE_KEY)
	addresses.value = Array.isArray(saved) ? saved.map(normalizeAddress) : []
	ensureOneDefault()
}

const persistAddresses = () => {
	uni.setStorageSync(STORAGE_KEY, addresses.value)
}

const normalizePhone = (value) => String(value || '').replace(/\D/g, '')

const normalizeAddress = (item) => ({
	id: item.id || createId(),
	receiver: item.receiver || item.name || '',
	phone: normalizePhone(item.phone),
	region: Array.isArray(item.region) ? item.region : [],
	detail: item.detail || '',
	unit: item.unit || '',
	contactPhones: normalizeContactPhones(item.contactPhones),
	isDefault: Boolean(item.isDefault),
	createdAt: item.createdAt || Date.now(),
	updatedAt: item.updatedAt || Date.now()
})

const normalizeContactPhones = (phones = []) => {
	const list = Array.isArray(phones) ? phones : []
	return [0, 1, 2].map((index) => normalizePhone(list[index]))
}

const createId = () => `addr-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

const ensureOneDefault = () => {
	if (!addresses.value.length) return
	if (!addresses.value.some((item) => item.isDefault)) {
		addresses.value[0].isDefault = true
		persistAddresses()
		return
	}
	let found = false
	addresses.value = addresses.value.map((item) => {
		if (!item.isDefault) return item
		if (!found) {
			found = true
			return item
		}
		return { ...item, isDefault: false }
	})
}

const createAddress = () => {
	form.value = {
		...emptyForm(),
		isDefault: addresses.value.length === 0
	}
	showForm.value = true
}

const editAddress = (item) => {
	form.value = {
		...emptyForm(),
		...item,
		region: Array.isArray(item.region) ? [...item.region] : [],
		contactPhones: normalizeContactPhones(item.contactPhones),
		smartText: ''
	}
	showForm.value = true
}

const onRegionChange = (event) => {
	form.value.region = event.detail.value || []
}

const validContacts = (item) => normalizeContactPhones(item.contactPhones).filter(Boolean)

const fullAddress = (item) => {
	const region = Array.isArray(item.region) ? item.region.filter(Boolean).join('') : ''
	return `${region}${item.detail || ''}`
}

const formatPhone = (value) => {
	const phone = normalizePhone(value)
	if (phone.length !== 11) return value || ''
	return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`
}

const recognizeAddress = () => {
	const text = form.value.smartText.trim()
	if (!text) {
		uni.showToast({ title: '请先输入识别内容', icon: 'none' })
		return
	}

	const phonePattern = /1[3-9][\d\s-]{9,16}/g
	const phoneList = Array.from(new Set((text.match(phonePattern) || []).map(normalizePhone).filter((phone) => phone.length === 11)))
	if (phoneList[0]) form.value.phone = phoneList[0]
	form.value.contactPhones = [0, 1, 2].map((index) => phoneList[index + 1] || form.value.contactPhones[index] || '')

	const cleanLines = text
		.replace(phonePattern, ' ')
		.split(/[\n，,；;]+/)
		.map((line) => line.trim())
		.filter(Boolean)
	const textParts = cleanLines.length > 1 ? cleanLines : cleanLines.join(' ').split(/\s+/).filter(Boolean)

	const possibleName = textParts.find((line) => line.length <= 8 && !/[省市区县镇路街号室栋楼]/.test(line))
	if (possibleName) form.value.receiver = possibleName

	const unitLine = textParts.find((line) => /医院|诊所|门诊|口腔|公司|单位/.test(line))
	if (unitLine && !form.value.unit) form.value.unit = unitLine

	const detailLine = textParts
		.filter((line) => line !== possibleName)
		.join(' ')
		.replace(form.value.unit, '')
		.trim()
	if (detailLine) form.value.detail = detailLine

	uni.showToast({ title: '已尝试识别', icon: 'success' })
}

const validatePhones = () => {
	const phoneRegex = /^1[3-9]\d{9}$/
	const mainPhone = normalizePhone(form.value.phone)
	if (!phoneRegex.test(mainPhone)) {
		uni.showToast({ title: '请输入正确手机号', icon: 'none' })
		return false
	}

	const invalidContact = normalizeContactPhones(form.value.contactPhones).find((phone) => phone && !phoneRegex.test(phone))
	if (invalidContact) {
		uni.showToast({ title: '联系人手机号格式不正确', icon: 'none' })
		return false
	}

	form.value.phone = mainPhone
	form.value.contactPhones = normalizeContactPhones(form.value.contactPhones)
	return true
}

const saveAddress = () => {
	if (!form.value.receiver.trim() || !form.value.phone || !form.value.detail.trim()) {
		uni.showToast({ title: '请完善地址信息', icon: 'none' })
		return
	}

	if (!validatePhones()) return

	const now = Date.now()
	const payload = {
		id: form.value.id || createId(),
		receiver: form.value.receiver.trim(),
		phone: normalizePhone(form.value.phone),
		region: form.value.region || [],
		detail: form.value.detail.trim(),
		unit: form.value.unit.trim(),
		contactPhones: normalizeContactPhones(form.value.contactPhones),
		isDefault: form.value.isDefault || addresses.value.length === 0,
		createdAt: form.value.createdAt || now,
		updatedAt: now
	}

	let next = addresses.value.filter((item) => item.id !== payload.id)
	if (payload.isDefault) {
		next = next.map((item) => ({ ...item, isDefault: false }))
	}
	next.unshift(payload)
	addresses.value = next
	ensureOneDefault()
	persistAddresses()

	uni.showToast({ title: '地址已保存', icon: 'success' })
	setTimeout(() => {
		showForm.value = false
		form.value = emptyForm()
	}, 450)
}

const setDefault = (id) => {
	addresses.value = addresses.value.map((item) => ({
		...item,
		isDefault: item.id === id
	}))
	persistAddresses()
	uni.showToast({ title: '已设为默认', icon: 'success' })
}

const deleteAddress = (id) => {
	uni.showModal({
		title: '删除地址',
		content: '删除后将无法恢复，确定删除这个地址吗？',
		confirmText: '删除',
		confirmColor: '#EF4444',
		success: (res) => {
			if (!res.confirm) return
			addresses.value = addresses.value.filter((item) => item.id !== id)
			ensureOneDefault()
			persistAddresses()
			showForm.value = false
			form.value = emptyForm()
			uni.showToast({ title: '已删除', icon: 'success' })
		}
	})
}

const goBack = () => {
	if (showForm.value) {
		showForm.value = false
		form.value = emptyForm()
		return
	}
	uni.navigateBack({
		delta: 1,
		fail: () => {
			uni.redirectTo({ url: '/pages/mine/index' })
		}
	})
}

const callService = () => {
	uni.makePhoneCall({
		phoneNumber: '13929945417',
		fail: () => uni.showToast({ title: '可联系售后：13929945417', icon: 'none' })
	})
}
</script>

<style scoped>
.page-shell {
	position: relative;
	min-height: 100vh;
	padding-bottom: 148rpx;
	background:
		radial-gradient(circle at 16% 18%, rgba(58, 134, 255, 0.18) 0, rgba(58, 134, 255, 0) 230rpx),
		linear-gradient(180deg, #E8EEFA 0%, #F7FAFF 100%);
	color: #0F1F3A;
	font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
	box-sizing: border-box;
}

.tap:active {
	opacity: 0.82;
	transform: scale(0.98);
}

.wx-top {
	position: relative;
	z-index: 30;
	background: linear-gradient(180deg, #1E6FE0 0%, #3490F7 100%);
	color: #FFFFFF;
	box-shadow: 0 18rpx 42rpx rgba(30, 111, 224, 0.18);
}

.nav-row {
	height: 88rpx;
	padding: 0 32rpx 10rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
}

.back-btn,
.nav-spacer {
	width: 68rpx;
	height: 68rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.chevron-left {
	width: 18rpx;
	height: 18rpx;
	border-left: 4rpx solid #FFFFFF;
	border-bottom: 4rpx solid #FFFFFF;
	transform: rotate(45deg);
}

.nav-title {
	font-size: 34rpx;
	font-weight: 700;
	letter-spacing: 1rpx;
}

.address-page,
.form-page {
	padding: 28rpx 28rpx 0;
	box-sizing: border-box;
}

.hero-card {
	position: relative;
	overflow: hidden;
	min-height: 220rpx;
	padding: 34rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-radius: 32rpx;
	background: linear-gradient(135deg, #FFFFFF 0%, #F1F7FF 100%);
	box-shadow: 0 24rpx 60rpx rgba(36, 98, 173, 0.12);
	box-sizing: border-box;
}

.hero-card::after {
	content: "";
	position: absolute;
	right: -70rpx;
	bottom: -90rpx;
	width: 240rpx;
	height: 240rpx;
	border-radius: 50%;
	background: rgba(30, 111, 224, 0.08);
}

.hero-copy {
	position: relative;
	z-index: 2;
	display: flex;
	flex-direction: column;
	gap: 12rpx;
}

.hero-kicker {
	align-self: flex-start;
	padding: 8rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(30, 111, 224, 0.1);
	color: #1E6FE0;
	font-size: 22rpx;
	font-weight: 700;
}

.hero-title {
	font-size: 42rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.hero-desc {
	max-width: 430rpx;
	font-size: 25rpx;
	line-height: 1.55;
	color: #5D6F8C;
}

.hero-icon {
	position: relative;
	z-index: 2;
	width: 120rpx;
	height: 120rpx;
	border-radius: 36rpx;
	background: linear-gradient(180deg, #3A86FF 0%, #1E6FE0 100%);
	box-shadow: 0 20rpx 38rpx rgba(30, 111, 224, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.pin-mark {
	position: relative;
	width: 46rpx;
	height: 58rpx;
	border-radius: 24rpx 24rpx 28rpx 28rpx;
	background: #FFFFFF;
	transform: rotate(45deg);
}

.pin-mark::after {
	content: "";
	position: absolute;
	left: 15rpx;
	top: 15rpx;
	width: 16rpx;
	height: 16rpx;
	border-radius: 50%;
	background: #1E6FE0;
}

.summary-row {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 18rpx;
	margin-top: 22rpx;
}

.summary-card {
	min-height: 132rpx;
	padding: 24rpx;
	border-radius: 26rpx;
	background: rgba(255, 255, 255, 0.78);
	box-shadow: 0 16rpx 38rpx rgba(60, 85, 130, 0.08);
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 8rpx;
	box-sizing: border-box;
}

.summary-card text:first-child {
	font-size: 36rpx;
	font-weight: 800;
	color: #1E6FE0;
}

.summary-card text:last-child {
	font-size: 24rpx;
	color: #6B7C97;
}

.address-list {
	margin-top: 24rpx;
	display: flex;
	flex-direction: column;
	gap: 22rpx;
}

.address-card {
	position: relative;
	overflow: hidden;
	padding: 30rpx;
	border-radius: 30rpx;
	background: #FFFFFF;
	box-shadow: 0 18rpx 52rpx rgba(55, 83, 126, 0.1);
	box-sizing: border-box;
}

.address-card::before {
	content: "";
	position: absolute;
	left: 0;
	top: 32rpx;
	width: 8rpx;
	height: 64rpx;
	border-radius: 0 999rpx 999rpx 0;
	background: linear-gradient(180deg, #3A86FF 0%, #1E6FE0 100%);
}

.card-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
}

.person-line {
	display: flex;
	align-items: baseline;
	gap: 16rpx;
	flex-wrap: wrap;
}

.person-name {
	font-size: 32rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.person-phone {
	font-size: 26rpx;
	font-weight: 600;
	color: #566A88;
}

.default-tag {
	flex-shrink: 0;
	padding: 6rpx 16rpx;
	border-radius: 999rpx;
	background: #EAF3FF;
	color: #1E6FE0;
	font-size: 22rpx;
	font-weight: 700;
}

.unit-line {
	display: block;
	margin-top: 16rpx;
	font-size: 27rpx;
	font-weight: 700;
	color: #273A58;
}

.detail-line {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	line-height: 1.55;
	color: #637693;
}

.contact-row {
	margin-top: 18rpx;
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.contact-row text {
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	background: #F3F7FC;
	color: #607493;
	font-size: 22rpx;
}

.card-actions {
	margin-top: 24rpx;
	padding-top: 20rpx;
	border-top: 1rpx solid #EEF3F9;
	display: flex;
	justify-content: flex-end;
	gap: 28rpx;
}

.action-link {
	font-size: 26rpx;
	font-weight: 700;
	color: #1E6FE0;
}

.action-link.danger {
	color: #E5484D;
}

.empty-card {
	margin-top: 28rpx;
	padding: 58rpx 42rpx;
	border-radius: 32rpx;
	background: rgba(255, 255, 255, 0.82);
	box-shadow: 0 18rpx 52rpx rgba(55, 83, 126, 0.08);
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	box-sizing: border-box;
}

.empty-illustration {
	position: relative;
	width: 132rpx;
	height: 110rpx;
	margin-bottom: 24rpx;
}

.empty-illustration view:first-child {
	position: absolute;
	left: 18rpx;
	top: 18rpx;
	width: 96rpx;
	height: 70rpx;
	border-radius: 22rpx;
	background: #DCEBFF;
}

.empty-illustration view:last-child {
	position: absolute;
	left: 50rpx;
	top: 0;
	width: 34rpx;
	height: 48rpx;
	border-radius: 18rpx 18rpx 22rpx 22rpx;
	background: #1E6FE0;
	transform: rotate(45deg);
}

.empty-title {
	font-size: 32rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.empty-desc {
	margin-top: 12rpx;
	font-size: 26rpx;
	line-height: 1.5;
	color: #6B7C97;
}

.add-address-btn {
	position: fixed;
	left: 32rpx;
	right: 32rpx;
	bottom: calc(34rpx + env(safe-area-inset-bottom));
	z-index: 20;
	height: 96rpx;
	border-radius: 28rpx;
	background: linear-gradient(180deg, #2A97F5 0%, #1E6FE0 100%);
	box-shadow: 0 20rpx 40rpx rgba(30, 111, 224, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12rpx;
	color: #FFFFFF;
	font-size: 31rpx;
	font-weight: 800;
}

.add-address-btn text:first-child {
	font-size: 42rpx;
	line-height: 1;
}

.recognize-card,
.form-card,
.default-card {
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 18rpx 52rpx rgba(55, 83, 126, 0.1);
	box-sizing: border-box;
}

.recognize-card {
	padding: 28rpx;
}

.section-title {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 18rpx;
}

.section-title text:first-child {
	font-size: 30rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.section-title text:last-child {
	font-size: 23rpx;
	color: #7B8EA8;
}

.recognize-input {
	width: 100%;
	height: 126rpx;
	margin-top: 20rpx;
	padding: 20rpx;
	border-radius: 20rpx;
	background: #F4F8FD;
	color: #0F1F3A;
	font-size: 26rpx;
	line-height: 1.5;
	box-sizing: border-box;
}

.recognize-btn {
	display: inline-flex;
	margin-top: 18rpx;
	padding: 14rpx 24rpx;
	border-radius: 16rpx;
	background: #EAF3FF;
	color: #1E6FE0;
	font-size: 26rpx;
	font-weight: 800;
}

.form-card {
	margin-top: 24rpx;
	padding: 0 28rpx;
}

.field-row {
	min-height: 96rpx;
	display: flex;
	align-items: center;
	gap: 16rpx;
	border-bottom: 1rpx solid #EEF3F9;
	position: relative;
}

.field-row.last {
	border-bottom: none;
}

.field-label {
	width: 190rpx;
	flex-shrink: 0;
	font-size: 27rpx;
	font-weight: 700;
	color: #263955;
}

.required-star {
	margin-right: 4rpx;
	color: #E5484D;
}

.field-input {
	flex: 1;
	min-width: 0;
	height: 88rpx;
	font-size: 27rpx;
	color: #0F1F3A;
}

.input-placeholder,
.placeholder {
	color: #9AA9BD;
}

.field-picker {
	flex: 1;
	min-width: 0;
}

.picker-value {
	min-height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	color: #0F1F3A;
	font-size: 27rpx;
}

.field-arrow {
	width: 16rpx;
	height: 16rpx;
	border-right: 3rpx solid #9AA9BD;
	border-bottom: 3rpx solid #9AA9BD;
	transform: rotate(-45deg);
	flex-shrink: 0;
}

.field-pin {
	position: relative;
	width: 28rpx;
	height: 34rpx;
	margin-right: 4rpx;
	border-radius: 16rpx 16rpx 18rpx 18rpx;
	background: #3A86FF;
	transform: rotate(45deg);
	flex-shrink: 0;
}

.field-pin::after {
	content: "";
	position: absolute;
	left: 9rpx;
	top: 9rpx;
	width: 10rpx;
	height: 10rpx;
	border-radius: 50%;
	background: #FFFFFF;
}

.default-card {
	margin-top: 24rpx;
	padding: 28rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}

.default-copy {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.default-copy text:first-child {
	font-size: 28rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.default-copy text:last-child {
	font-size: 24rpx;
	color: #7B8EA8;
}

.default-check {
	width: 48rpx;
	height: 48rpx;
	border-radius: 14rpx;
	border: 2rpx solid #D7E2F0;
	background: #FFFFFF;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

.default-check.checked {
	border-color: #1E6FE0;
	background: #1E6FE0;
}

.default-check view {
	width: 18rpx;
	height: 10rpx;
	border-left: 4rpx solid #FFFFFF;
	border-bottom: 4rpx solid #FFFFFF;
	transform: rotate(-45deg);
	opacity: 0;
}

.default-check.checked view {
	opacity: 1;
}

.form-actions {
	position: fixed;
	left: 28rpx;
	right: 28rpx;
	bottom: calc(34rpx + env(safe-area-inset-bottom));
	z-index: 20;
	display: flex;
	gap: 18rpx;
}

.save-btn,
.ghost-btn {
	height: 96rpx;
	border-radius: 28rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 31rpx;
	font-weight: 800;
	box-sizing: border-box;
}

.save-btn {
	flex: 1;
	background: linear-gradient(180deg, #2A97F5 0%, #1E6FE0 100%);
	color: #FFFFFF;
	box-shadow: 0 20rpx 40rpx rgba(30, 111, 224, 0.28);
}

.ghost-btn {
	width: 180rpx;
	background: #FFFFFF;
	border: 2rpx solid #FAD2D6;
	color: #E5484D;
}

.help-bubble {
	position: fixed;
	right: 34rpx;
	bottom: calc(154rpx + env(safe-area-inset-bottom));
	z-index: 18;
	width: 82rpx;
	height: 82rpx;
	border-radius: 50%;
	background: linear-gradient(180deg, #2A97F5 0%, #1E6FE0 100%);
	box-shadow: 0 18rpx 34rpx rgba(30, 111, 224, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.smile-face {
	position: relative;
	width: 52rpx;
	height: 52rpx;
	border: 4rpx solid #DDF0FF;
	border-radius: 50%;
	box-sizing: border-box;
}

.eye {
	position: absolute;
	top: 16rpx;
	width: 7rpx;
	height: 7rpx;
	border-radius: 50%;
	background: #FFFFFF;
}

.eye.one {
	left: 12rpx;
}

.eye.two {
	right: 12rpx;
}

.mouth {
	position: absolute;
	left: 14rpx;
	bottom: 10rpx;
	width: 18rpx;
	height: 10rpx;
	border-bottom: 4rpx solid #FFFFFF;
	border-radius: 0 0 18rpx 18rpx;
}
</style>
