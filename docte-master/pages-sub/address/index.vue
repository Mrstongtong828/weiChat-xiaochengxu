<template>
	<view class="page-shell">
		<view class="wx-top">
			<view class="nav-row">
				<view class="back-btn tap" @click="goBack">
					<view class="chevron-left"></view>
				</view>
				<text class="nav-title">{{ showForm ? formTitle : '收货地址管理' }}</text>
				<image class="nav-brand" :src="cicadaAssets.wordmarkRegisteredWhite" mode="aspectFit"></image>
			</view>
		</view>

		<view v-if="!showForm" class="address-page">
			<view class="section-heading">
				<view>
					<text>默认回寄地址</text>
					<text>用于维修完成后的设备寄回</text>
				</view>
				<text>{{ addresses.length ? '共 ' + addresses.length + ' 条' : '待添加' }}</text>
			</view>

			<view v-if="sortedAddresses.length" class="address-list">
				<view v-for="(item, index) in sortedAddresses" :key="item.id" :class="['address-card', { 'is-default': item.isDefault }]">
					<view class="address-track">
						<view class="track-dot">
							<text>{{ item.isDefault ? '默' : index + 1 }}</text>
						</view>
						<view class="track-line"></view>
					</view>
					<view class="address-body">
						<view class="card-head">
							<view class="person-line">
								<text class="person-name">{{ item.receiver || '未命名联系人' }}</text>
								<text class="person-phone">{{ formatPhone(item.phone) }}</text>
							</view>
							<text v-if="item.isDefault" class="default-tag">默认</text>
						</view>
						<view class="address-main">
							<text v-if="item.unit" class="unit-line">{{ item.unit }}</text>
							<text class="detail-line">{{ fullAddress(item) || '未填写详细地址' }}</text>
						</view>
						<view class="contact-row">
							<text class="contact-chip">主号 {{ formatPhone(item.phone) }}</text>
							<text v-for="phone in validContacts(item)" :key="phone" class="contact-chip">{{ formatPhone(phone) }}</text>
						</view>
						<view class="card-actions">
							<view class="action-link tap" @click="editAddress(item)">编辑</view>
							<view v-if="!item.isDefault" class="action-link tap" @click="setDefault(item.id)">设为默认</view>
							<view class="action-link danger tap" @click="deleteAddress(item.id)">删除</view>
						</view>
					</view>
				</view>
			</view>

			<view v-else class="empty-card">
				<view class="empty-illustration">
					<view></view>
					<view></view>
					<view></view>
				</view>
				<text class="empty-title">还没有收货地址</text>
				<text class="empty-desc">先添加一个默认地址，报修填写回寄信息时会自动带出。</text>
			</view>

			<view class="add-address-btn tap" @click="createAddress">
				<view class="add-plus">
					<text></text>
					<text></text>
				</view>
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
				<view class="wechat-address-btn tap" @click="chooseWechatAddress">微信地址</view>
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

			<view class="default-card">
				<view class="default-copy">
					<text>设为默认地址</text>
					<text>维修回寄时优先使用该地址</text>
				</view>
				<switch :checked="form.isDefault" color="#1E6FE0" @change="form.isDefault = $event.detail.value" />
			</view>

			<view class="form-actions">
				<view v-if="form.id" class="ghost-btn tap" @click="deleteAddress(form.id)">删除</view>
				<view class="save-btn tap" @click="saveAddress">保存</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { cicadaAssets } from '@/config/cicada-assets'
import {
	getAddressList,
	addAddress,
	updateAddress,
	deleteAddress as removeAddressRemote
} from '@/api/content'
import { toCustomerErrorMessage } from '@/utils/customer-error.js'
import { createPrivateStorageKey, isSessionRequestCurrent } from '@/pages/index/composables/sessionPrivacy.js'

const STORAGE_KEY_BASE = 'receiverAddressList'
const getStorageKey = () => createPrivateStorageKey(STORAGE_KEY_BASE, uni.getStorageSync('userInfo') || {})
const captureAddressSession = () => ({
	token: String(uni.getStorageSync('token') || ''),
	storageKey: getStorageKey()
})
const isAddressSessionCurrent = (session = {}) => Boolean(
	session.storageKey
	&& session.storageKey === getStorageKey()
	&& isSessionRequestCurrent(session.token, uni.getStorageSync('token'))
)

// 本地临时 id（云端未同步）前缀
const isLocalId = (id) => String(id || '').startsWith('addr-')

// 地址管理页结构 → 云端保存载荷
const toRemotePayload = (item = {}) => ({
	_id: isLocalId(item.id) ? undefined : item.id,
	receiver: item.receiver || '',
	phone: item.phone || '',
	region: Array.isArray(item.region) ? item.region : [],
	detail: item.detail || '',
	unit: item.unit || '',
	contactPhones: Array.isArray(item.contactPhones) ? item.contactPhones.filter(Boolean) : [],
	isDefault: Boolean(item.isDefault)
})

const addressSaving = ref(false)
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
const sortedAddresses = computed(() => [...addresses.value].sort((a, b) => {
	if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
	return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
}))

onMounted(() => {
	if (!uni.getStorageSync('token') || !getStorageKey()) {
		addresses.value = []
		uni.redirectTo({ url: '/pages/login/index' })
		return
	}
	loadAddresses()
})

const loadAddresses = async () => {
	const session = captureAddressSession()
	if (!session.token || !session.storageKey) {
		addresses.value = []
		return
	}
	// 本地缓存秒显
	const saved = uni.getStorageSync(session.storageKey)
	addresses.value = Array.isArray(saved) ? saved.map(normalizeAddress) : []
	ensureOneDefault(session.storageKey)
	// 云端为准
	try {
		const list = await getAddressList()
		if (!isAddressSessionCurrent(session)) return
		addresses.value = (Array.isArray(list) ? list : []).map(normalizeAddress)
		ensureOneDefault(session.storageKey)
		persistAddresses(session.storageKey)
	} catch (error) {
		console.warn('load addresses from cloud failed, using local cache:', error)
	}
}

const persistAddresses = (storageKey = getStorageKey()) => {
	if (storageKey && storageKey === getStorageKey()) uni.setStorageSync(storageKey, addresses.value)
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

const ensureOneDefault = (storageKey = getStorageKey()) => {
	if (!addresses.value.length) return
	if (!addresses.value.some((item) => item.isDefault)) {
		addresses.value[0].isDefault = true
		persistAddresses(storageKey)
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

const chooseWechatAddress = () => {
	if (typeof uni.chooseAddress !== 'function') {
		uni.showToast({ title: '当前微信版本不支持地址导入', icon: 'none' })
		return
	}
	uni.chooseAddress({
		success: (result = {}) => {
			form.value.receiver = String(result.userName || '').trim()
			form.value.phone = normalizePhone(result.telNumber)
			form.value.region = [result.provinceName, result.cityName, result.countyName].filter(Boolean)
			form.value.detail = String(result.detailInfo || '').trim()
		},
		fail: (error) => {
			if (!String(error && error.errMsg || '').includes('cancel')) {
				uni.showToast({ title: '微信地址导入失败', icon: 'none' })
			}
		}
	})
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

	const recognized = []
	if (phoneList[0]) recognized.push('手机号')
	if (possibleName) recognized.push('收货人')
	if (unitLine) recognized.push('单位')
	if (detailLine) recognized.push('详细地址')
	if (recognized.length) {
		uni.showToast({ title: '已识别，请核对', icon: 'none' })
	} else {
		uni.showToast({ title: '未识别到信息，请手动填写', icon: 'none' })
	}
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

const saveAddress = async () => {
	if (addressSaving.value) return
	if (!form.value.receiver.trim() || !form.value.phone || !form.value.detail.trim()) {
		uni.showToast({ title: '请完善地址信息', icon: 'none' })
		return
	}

	if (!validatePhones()) return
	const session = captureAddressSession()
	if (!isAddressSessionCurrent(session)) return
	addressSaving.value = true

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

	const isEdit = !isLocalId(payload.id)
	uni.showLoading({ title: '保存中', mask: true })
	try {
		if (isEdit) {
			await updateAddress(toRemotePayload(payload))
		} else {
			await addAddress(toRemotePayload(payload))
		}
		if (!isAddressSessionCurrent(session)) return
		uni.hideLoading()
		uni.showToast({ title: '已保存', icon: 'success' })
		await loadAddresses()
		setTimeout(() => {
			showForm.value = false
			form.value = emptyForm()
		}, 450)
	} catch (error) {
		uni.hideLoading()
		console.warn('save address to cloud failed:', error)
		uni.showToast({ title: toCustomerErrorMessage(error, '保存失败，请重试'), icon: 'none' })
	} finally {
		addressSaving.value = false
	}
}

const setDefault = async (id) => {
	const target = addresses.value.find((item) => item.id === id)
	if (!target || isLocalId(id)) return
	const session = captureAddressSession()
	if (!isAddressSessionCurrent(session)) return
	try {
		await updateAddress({ ...toRemotePayload(target), isDefault: true })
		if (!isAddressSessionCurrent(session)) return
		await loadAddresses()
		uni.showToast({ title: '已设为默认', icon: 'success' })
	} catch (error) {
		console.warn('set default cloud sync failed:', error)
		uni.showToast({ title: toCustomerErrorMessage(error, '设置默认地址失败'), icon: 'none' })
	}
}

const deleteAddress = (id) => {
	uni.showModal({
		title: '删除地址',
		content: '删除后无法恢复。',
		confirmText: '删除',
		confirmColor: '#EF4444',
		success: async (res) => {
			if (!res.confirm) return
			if (isLocalId(id)) return
			const session = captureAddressSession()
			if (!isAddressSessionCurrent(session)) return
			try {
				await removeAddressRemote(id)
				if (!isAddressSessionCurrent(session)) return
				await loadAddresses()
				showForm.value = false
				form.value = emptyForm()
				uni.showToast({ title: '已删除', icon: 'success' })
			} catch (error) {
				console.warn('delete address cloud sync failed:', error)
				uni.showToast({ title: toCustomerErrorMessage(error, '删除失败，请重试'), icon: 'none' })
			}
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
			uni.redirectTo({ url: '/pages-sub/mine/index' })
		}
	})
}

</script>

<style scoped>
.page-shell {
	position: relative;
	min-height: 100vh;
	padding-bottom: 176rpx;
	background:
		radial-gradient(circle at 12% 16%, rgba(58, 134, 255, 0.16) 0, rgba(58, 134, 255, 0) 240rpx),
		linear-gradient(180deg, #EAF2FF 0%, #F7FAFF 58%, #FFFFFF 100%);
	color: #0F1F3A;
	font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
	box-sizing: border-box;
}

.tap:active {
	opacity: 0.82;
	transform: scale(0.98);
}

.wx-top {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	z-index: 30;
	height: 176rpx;
	padding: 76rpx 32rpx 0;
	background: linear-gradient(180deg, #1E6FE0 0%, #3490F7 100%);
	color: #FFFFFF;
	box-shadow: 0 18rpx 42rpx rgba(30, 111, 224, 0.18);
	box-sizing: border-box;
}

.nav-row {
	height: 92rpx;
	display: flex;
	align-items: center;
	justify-content: flex-start;
	gap: 18rpx;
	padding-right: 322rpx;
	box-sizing: border-box;
}

.nav-brand {
	position: absolute;
	right: 190rpx;
	bottom: 30rpx;
	width: 132rpx;
	height: 34rpx;
	opacity: 0.82;
	pointer-events: none;
}

.back-btn {
	position: relative;
	width: 72rpx;
	height: 72rpx;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: #FFFFFF;
	box-shadow: 0 10rpx 24rpx rgba(30, 111, 224, 0.14);
}

.nav-spacer {
	display: none;
}

.chevron-left {
	width: 20rpx;
	height: 20rpx;
	margin-left: 8rpx;
	border-left: 4rpx solid #2B7DE9;
	border-bottom: 4rpx solid #2B7DE9;
	transform: rotate(45deg);
}

.nav-title {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 34rpx;
	font-weight: 700;
	letter-spacing: 1rpx;
}

.address-page,
.form-page {
	padding: 28rpx 28rpx 0;
	padding-top: 188rpx;
	box-sizing: border-box;
}

.address-page {
	padding-bottom: 156rpx;
}

.hero-card {
	position: relative;
	overflow: hidden;
	min-height: 204rpx;
	padding: 30rpx 32rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-radius: 32rpx;
	background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, #F2F8FF 100%);
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
	font-size: 40rpx;
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
	width: 112rpx;
	height: 112rpx;
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
	margin-top: 20rpx;
}

.summary-card {
	min-height: 120rpx;
	padding: 22rpx 24rpx;
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
	margin-top: 24rpx;
	min-height: 268rpx;
	padding: 44rpx 42rpx;
	border-radius: 32rpx;
	background: rgba(255, 255, 255, 0.92);
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
	margin-bottom: 20rpx;
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
	bottom: calc(28rpx + env(safe-area-inset-bottom));
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

.section-heading {
	margin: 8rpx 4rpx 16rpx;
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 20rpx;
}

.section-heading view {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.section-heading view text:first-child {
	font-size: 32rpx;
	font-weight: 900;
	color: #0D1B33;
}

.section-heading view text:last-child {
	font-size: 23rpx;
	color: #7588A3;
}

.section-heading > text {
	padding: 8rpx 16rpx;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: #EAF3FF;
	color: #1E6FE0;
	font-size: 22rpx;
	font-weight: 800;
}

.address-list {
	margin-top: 0;
	display: flex;
	flex-direction: column;
	gap: 22rpx;
}

.address-card {
	position: relative;
	overflow: hidden;
	padding: 0;
	border: 2rpx solid rgba(212, 226, 241, 0.9);
	border-radius: 34rpx;
	background: #FFFFFF;
	box-shadow: 0 18rpx 48rpx rgba(43, 72, 112, 0.1);
	box-sizing: border-box;
	display: flex;
}

.address-card.is-default {
	border-color: rgba(30, 111, 224, 0.28);
	box-shadow: 0 20rpx 58rpx rgba(30, 111, 224, 0.16);
}

.address-card::before {
	content: "";
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	height: 8rpx;
	border-radius: 34rpx 34rpx 0 0;
	background: linear-gradient(90deg, #1E6FE0 0%, #25B6D2 52%, #8FD5C5 100%);
}

.address-track {
	position: relative;
	width: 86rpx;
	padding-top: 48rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	flex-shrink: 0;
	background: linear-gradient(180deg, #F3F8FE 0%, #FFFFFF 100%);
}

.track-dot {
	position: relative;
	z-index: 2;
	width: 46rpx;
	height: 46rpx;
	border-radius: 50%;
	background: #1E6FE0;
	color: #FFFFFF;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 20rpx;
	font-weight: 900;
	box-shadow: 0 0 0 8rpx #EAF3FF;
}

.track-line {
	width: 4rpx;
	flex: 1;
	min-height: 176rpx;
	margin-top: 16rpx;
	border-radius: 999rpx;
	background: linear-gradient(180deg, rgba(30, 111, 224, 0.42), rgba(30, 111, 224, 0));
}

.address-body {
	min-width: 0;
	flex: 1;
	padding: 32rpx 30rpx 24rpx 4rpx;
	box-sizing: border-box;
}

.card-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 18rpx;
}

.person-line {
	min-width: 0;
	display: flex;
	align-items: baseline;
	gap: 16rpx;
	flex-wrap: wrap;
}

.person-name {
	max-width: 220rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 34rpx;
	font-weight: 900;
	color: #0D1B33;
}

.person-phone {
	font-size: 26rpx;
	font-weight: 800;
	color: #5B6F8D;
}

.default-tag {
	flex-shrink: 0;
	padding: 7rpx 16rpx;
	border-radius: 999rpx;
	background: #EAF3FF;
	color: #1E6FE0;
	font-size: 22rpx;
	font-weight: 900;
}

.address-main {
	margin-top: 20rpx;
	padding: 20rpx 22rpx;
	border-radius: 24rpx;
	background: #F7FAFE;
}

.unit-line {
	display: block;
	margin-top: 0;
	font-size: 29rpx;
	line-height: 1.35;
	font-weight: 900;
	color: #182B48;
}

.detail-line {
	display: block;
	margin-top: 10rpx;
	font-size: 25rpx;
	line-height: 1.62;
	color: #627795;
}

.contact-row {
	margin-top: 18rpx;
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.contact-row .contact-chip {
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	background: #EDF5FE;
	color: #58708F;
	font-size: 22rpx;
	font-weight: 700;
}

.card-actions {
	margin-top: 22rpx;
	padding-top: 20rpx;
	border-top: 1rpx dashed #DCE7F3;
	display: flex;
	justify-content: flex-end;
	gap: 30rpx;
}

.action-link {
	font-size: 26rpx;
	font-weight: 900;
	color: #1E6FE0;
}

.action-link.danger {
	color: #E5484D;
}

.empty-card {
	margin-top: 0;
	min-height: 360rpx;
	padding: 54rpx 44rpx;
	border: 2rpx dashed #C9D9EC;
	border-radius: 34rpx;
	background: rgba(255, 255, 255, 0.9);
	box-shadow: 0 18rpx 52rpx rgba(55, 83, 126, 0.08);
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	box-sizing: border-box;
}

.empty-illustration {
	position: relative;
	width: 154rpx;
	height: 118rpx;
	margin-bottom: 24rpx;
}

.empty-illustration view:first-child {
	position: absolute;
	left: 8rpx;
	top: 36rpx;
	width: 136rpx;
	height: 70rpx;
	border-radius: 28rpx;
	background: #E7F1FF;
}

.empty-illustration view:nth-child(2) {
	position: absolute;
	left: 42rpx;
	top: 8rpx;
	width: 70rpx;
	height: 86rpx;
	border: 6rpx solid #1E6FE0;
	border-radius: 36rpx 36rpx 40rpx 40rpx;
	transform: rotate(45deg);
	box-sizing: border-box;
}

.empty-illustration view:last-child {
	position: absolute;
	left: 66rpx;
	top: 32rpx;
	width: 20rpx;
	height: 20rpx;
	border-radius: 50%;
	background: #1E6FE0;
}

.empty-title {
	font-size: 33rpx;
	font-weight: 900;
	color: #0D1B33;
}

.empty-desc {
	margin-top: 12rpx;
	font-size: 26rpx;
	line-height: 1.56;
	color: #6B7C97;
}

.add-address-btn {
	position: fixed;
	left: 32rpx;
	right: 32rpx;
	bottom: calc(28rpx + env(safe-area-inset-bottom));
	z-index: 20;
	height: 100rpx;
	border-radius: 30rpx;
	background: linear-gradient(180deg, #2A97F5 0%, #1E6FE0 100%);
	box-shadow: 0 20rpx 42rpx rgba(30, 111, 224, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 14rpx;
	color: #FFFFFF;
	font-size: 31rpx;
	font-weight: 900;
}

.add-plus {
	position: relative;
	width: 38rpx;
	height: 38rpx;
	border-radius: 12rpx;
	background: rgba(255, 255, 255, 0.16);
}

.add-plus text {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 20rpx;
	height: 4rpx;
	border-radius: 999rpx;
	background: #FFFFFF;
	transform: translate(-50%, -50%);
}

.add-plus text:last-child {
	transform: translate(-50%, -50%) rotate(90deg);
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

.wechat-address-btn {
	display: inline-flex;
	margin: 18rpx 0 0 12rpx;
	padding: 14rpx 20rpx;
	border-radius: 16rpx;
	background: #EEF8F3;
	color: #078A48;
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

</style>
