<template>
	<view class="page-shell">
		<view class="profile-header">
			<view class="back-button tap" @click="goBack">
				<view></view>
			</view>
			<text>修改资料</text>
			<view class="header-placeholder"></view>
		</view>

		<view class="profile-card">
			<view class="avatar-row">
				<text>头像</text>
				<button
					class="avatar-picker tap"
					open-type="chooseAvatar"
					:disabled="saving"
					@chooseavatar="onChooseAvatar"
				>
					<image v-if="avatar" class="avatar-image" :src="avatar" mode="aspectFill"></image>
					<image v-else class="avatar-image placeholder" :src="cicadaAssets.defaultUserAvatar" mode="aspectFit"></image>
					<view class="chevron"></view>
				</button>
			</view>

			<view class="field-row">
				<text>昵称</text>
				<input
					class="nickname-input"
					type="nickname"
					:value="nickname"
					:disabled="saving"
					maxlength="40"
					placeholder="输入或选择微信昵称"
					placeholder-class="input-placeholder"
					@input="onNicknameInput"
				/>
			</view>
		</view>

		<button class="save-button tap" :disabled="saving" @click="saveProfile">
			{{ saving ? '保存中...' : '保存修改' }}
		</button>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { updateUserInfo, uploadUserAvatar } from '@/api/content'
import { cicadaAssets } from '@/config/cicada-assets'
import { normalizeWechatProfile } from '@/utils/wechat-profile.js'

const currentUser = ref({})
const nickname = ref('')
const avatar = ref('')
const saving = ref(false)

const getExistingAvatar = (userInfo = currentUser.value) => (
	userInfo.avatar ||
	userInfo.avatarUrl ||
	userInfo.avatarFileID ||
	userInfo.avatar_file_id ||
	''
)

const getExistingAvatarFileID = (userInfo = currentUser.value) => (
	userInfo.avatarFileID ||
	userInfo.avatarFileId ||
	userInfo.avatar_file_id ||
	''
)

const loadProfile = () => {
	const token = uni.getStorageSync('token')
	if (!token) {
		uni.showToast({ title: '请先登录', icon: 'none' })
		setTimeout(goBack, 600)
		return
	}

	const userInfo = uni.getStorageSync('userInfo') || {}
	const profile = normalizeWechatProfile(userInfo)
	currentUser.value = userInfo
	nickname.value = profile.nickname || userInfo.name || ''
	avatar.value = profile.avatar || getExistingAvatar(userInfo)
}

onShow(loadProfile)

const goBack = () => {
	uni.navigateBack({
		fail: () => uni.reLaunch({ url: '/pages/index/index?tab=mine' })
	})
}

const isLocalAvatarPath = (value = '') => {
	const path = String(value || '')
	return /^wxfile:\/\//i.test(path) || /^tmp\//i.test(path) || /^http:\/\/tmp\//i.test(path) || /^https:\/\/tmp\//i.test(path)
}

const saveAvatarToLocal = (tempFilePath = '') => new Promise((resolve) => {
	if (!tempFilePath || !isLocalAvatarPath(tempFilePath) || typeof uni.saveFile !== 'function') {
		resolve(tempFilePath)
		return
	}

	uni.saveFile({
		tempFilePath,
		success: (res) => resolve(res.savedFilePath || tempFilePath),
		fail: () => resolve(tempFilePath)
	})
})

const persistAvatar = async (filePath = '') => {
	if (!filePath || !isLocalAvatarPath(filePath)) {
		return {
			avatar: filePath,
			avatarFileID: /^cloud:\/\//i.test(String(filePath || '')) ? filePath : ''
		}
	}

	try {
		const remoteUserInfo = await uploadUserAvatar(filePath)
		return {
			avatar: remoteUserInfo.avatar || remoteUserInfo.avatarUrl || filePath,
			avatarFileID: remoteUserInfo.avatarFileID || remoteUserInfo.avatarFileId || remoteUserInfo.avatar_file_id || ''
		}
	} catch (error) {
		console.warn('profile avatar upload failed:', error)
		const localAvatar = await saveAvatarToLocal(filePath)
		return { avatar: localAvatar || filePath, avatarFileID: '' }
	}
}

const onChooseAvatar = (event = {}) => {
	const avatarUrl = event.detail && event.detail.avatarUrl
	if (avatarUrl) avatar.value = avatarUrl
}

const onNicknameInput = (event = {}) => {
	nickname.value = String(event.detail && event.detail.value || '').trim()
}

const buildLocalUserInfo = (profile = {}) => ({
	...currentUser.value,
	...profile,
	name: profile.nickname || currentUser.value.name || currentUser.value.nickname || '',
	avatarUrl: profile.avatar || currentUser.value.avatarUrl || currentUser.value.avatar || ''
})

const saveProfile = async () => {
	const name = nickname.value.trim()
	const selectedAvatar = avatar.value || getExistingAvatar()

	if (!name && !selectedAvatar) {
		uni.showToast({ title: '请输入昵称或选择头像', icon: 'none' })
		return
	}

	saving.value = true
	try {
		const savedAvatar = selectedAvatar
			? await persistAvatar(selectedAvatar)
			: { avatar: '', avatarFileID: '' }
		const profile = {
			nickname: name || currentUser.value.nickname || currentUser.value.name || '',
			avatar: savedAvatar.avatar || currentUser.value.avatar || '',
			avatarFileID: savedAvatar.avatarFileID || getExistingAvatarFileID()
		}

		let userInfo = buildLocalUserInfo(profile)
		try {
			const remoteUserInfo = await updateUserInfo({ profile })
			userInfo = remoteUserInfo || userInfo
		} catch (error) {
			console.warn('profile update failed:', error)
		}

		uni.setStorageSync('userInfo', userInfo)
		uni.$emit('auth:changed', { logged: true, userInfo })
		uni.showToast({ title: '资料已保存', icon: 'success' })
		setTimeout(goBack, 650)
	} finally {
		saving.value = false
	}
}
</script>

<style scoped>
.page-shell {
	min-height: 100vh;
	padding: 0 28rpx 64rpx;
	background: #E8EEFA;
	color: #0F1F3A;
	box-sizing: border-box;
}

.profile-header {
	height: calc(112rpx + env(safe-area-inset-top));
	padding-top: env(safe-area-inset-top);
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
}

.profile-header > text {
	font-size: 32rpx;
	font-weight: 700;
}

.back-button,
.header-placeholder {
	width: 72rpx;
	height: 72rpx;
}

.back-button {
	display: flex;
	align-items: center;
	justify-content: center;
}

.back-button view {
	width: 20rpx;
	height: 20rpx;
	margin-left: 8rpx;
	border-left: 4rpx solid #0F1F3A;
	border-bottom: 4rpx solid #0F1F3A;
	transform: rotate(45deg);
}

.profile-card {
	margin-top: 24rpx;
	overflow: hidden;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 8rpx 28rpx rgba(30, 111, 224, 0.06);
}

.avatar-row,
.field-row {
	min-height: 116rpx;
	padding: 0 28rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	border-bottom: 2rpx solid #F1F5FB;
	box-sizing: border-box;
}

.field-row {
	border-bottom: none;
}

.avatar-row > text,
.field-row > text {
	flex-shrink: 0;
	font-size: 29rpx;
	font-weight: 600;
	color: #263A59;
}

.avatar-picker {
	min-width: 0;
	height: 116rpx;
	margin: 0;
	padding: 0;
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 18rpx;
	background: transparent;
	line-height: 1;
}

.avatar-picker::after,
.save-button::after {
	border: none;
}

.avatar-image {
	width: 82rpx;
	height: 82rpx;
	display: block;
	border-radius: 999rpx;
	background: #F3F8FF;
}

.avatar-image.placeholder {
	padding: 14rpx;
	box-sizing: border-box;
}

.chevron {
	width: 16rpx;
	height: 16rpx;
	border-top: 3rpx solid #A7B6CC;
	border-right: 3rpx solid #A7B6CC;
	transform: rotate(45deg);
}

.nickname-input {
	min-width: 0;
	height: 96rpx;
	flex: 1;
	text-align: right;
	font-size: 29rpx;
	color: #0F1F3A;
}

.input-placeholder {
	color: #9AA9BF;
}

.save-button {
	height: 92rpx;
	margin: 48rpx 0 0;
	border-radius: 24rpx;
	background: #1E6FE0;
	color: #FFFFFF;
	font-size: 30rpx;
	font-weight: 700;
	line-height: 92rpx;
}

.save-button[disabled] {
	opacity: 0.72;
}

.tap:active {
	opacity: 0.86;
}
</style>
