<template>
	<view v-if="visible" class="profile-editor-mask">
		<view class="profile-editor-panel">
			<view class="profile-editor-head">
				<text>完善头像昵称</text>
				<text class="profile-editor-skip tap" @click="skip">跳过</text>
			</view>

			<view class="profile-editor-body">
				<button
					class="profile-avatar-button tap"
					open-type="chooseAvatar"
					:disabled="saving"
					@chooseavatar="onChooseAvatar"
				>
					<image v-if="avatar" class="profile-avatar-image" :src="avatar" mode="aspectFill"></image>
					<image v-else class="profile-avatar-image placeholder" :src="cicadaAssets.defaultUserAvatar" mode="aspectFit"></image>
				</button>
				<input
					class="profile-nickname-input"
					type="nickname"
					:value="nickname"
					:disabled="saving"
					maxlength="40"
					placeholder="请输入昵称"
					placeholder-class="profile-input-placeholder"
					@input="onNicknameInput"
				/>
			</view>

			<view class="profile-editor-actions">
				<button class="profile-action secondary tap" :disabled="saving" @click="skip">暂不</button>
				<button class="profile-action primary tap" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { buildCloudPath } from '@/api/cloudHelpers.js'
import { updateUserInfo, uploadUserAvatar } from '@/api/content'
import { cicadaAssets } from '@/config/cicada-assets'
import { getCloudTempFileURL, uploadCloudFile } from '@/utils/cloud.js'
import { normalizeWechatProfile } from '@/utils/wechat-profile.js'

const props = defineProps({
	visible: {
		type: Boolean,
		default: false
	},
	userInfo: {
		type: Object,
		default: () => ({})
	}
})

const emit = defineEmits(['update:visible', 'saved', 'skip'])

const nickname = ref('')
const avatar = ref('')
const saving = ref(false)

const currentUserInfo = computed(() => props.userInfo || {})

const getExistingAvatar = () => (
	currentUserInfo.value.avatar ||
	currentUserInfo.value.avatarUrl ||
	currentUserInfo.value.avatarFileID ||
	currentUserInfo.value.avatar_file_id ||
	''
)

const getExistingAvatarFileID = () => (
	currentUserInfo.value.avatarFileID ||
	currentUserInfo.value.avatarFileId ||
	currentUserInfo.value.avatar_file_id ||
	''
)

watch(
	() => props.visible,
	(value) => {
		if (!value) return
		const profile = normalizeWechatProfile(currentUserInfo.value)
		nickname.value = profile.nickname || currentUserInfo.value.name || ''
		avatar.value = profile.avatar || getExistingAvatar()
		saving.value = false
	}
)

const isLocalAvatarPath = (value = '') => {
	const path = String(value || '')
	return /^wxfile:\/\//i.test(path) || /^tmp\//i.test(path) || /^http:\/\/tmp\//i.test(path) || /^https:\/\/tmp\//i.test(path)
}

const isCloudFileId = (value = '') => /^cloud:\/\//i.test(String(value || ''))

const resolveCloudAvatarUrl = async (fileID = '', fallback = '') => {
	if (!fileID) return fallback
	if (!isCloudFileId(fileID)) return fileID
	try {
		const res = await getCloudTempFileURL([fileID])
		const item = (res.fileList || [])[0]
		return (item && item.tempFileURL) || fallback || fileID
	} catch (error) {
		console.warn('resolve avatar temp url failed:', error)
		return fallback || fileID
	}
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
			avatarFileID: isCloudFileId(filePath) ? filePath : ''
		}
	}

	try {
		if (uni.getStorageSync('token')) {
			try {
				const remoteUserInfo = await uploadUserAvatar(filePath)
				return {
					avatar: remoteUserInfo.avatar || remoteUserInfo.avatarUrl || filePath,
					avatarFileID: remoteUserInfo.avatarFileID || remoteUserInfo.avatarFileId || remoteUserInfo.avatar_file_id || ''
				}
			} catch (error) {
				console.warn('upload avatar by cloud object failed:', error)
				const localAvatar = await saveAvatarToLocal(filePath)
				return { avatar: localAvatar || filePath, avatarFileID: '' }
			}
		}

		const uploadRes = await uploadCloudFile({
			filePath,
			name: 'file',
			cloudPath: buildCloudPath(filePath, 'user/avatars', 'jpg')
		})
		const uploadedUrl = uploadRes.url || uploadRes.fileUrl || uploadRes.fileID || uploadRes.fileId || ''
		const avatarFileID = isCloudFileId(uploadedUrl) ? uploadedUrl : ''
		const avatar = await resolveCloudAvatarUrl(uploadedUrl, filePath)
		return { avatar: avatar || filePath, avatarFileID }
	} catch (error) {
		console.warn('upload avatar failed, use local saved file:', error)
		const localAvatar = await saveAvatarToLocal(filePath)
		return { avatar: localAvatar || filePath, avatarFileID: '' }
	}
}

const close = () => {
	emit('update:visible', false)
}

const onChooseAvatar = (event = {}) => {
	const avatarUrl = event.detail && event.detail.avatarUrl
	if (avatarUrl) avatar.value = avatarUrl
}

const onNicknameInput = (event = {}) => {
	nickname.value = String(event.detail && event.detail.value || '').trim()
}

const buildMergedUserInfo = (profile = {}) => ({
	...currentUserInfo.value,
	...profile,
	name: profile.nickname || currentUserInfo.value.name || currentUserInfo.value.nickname || '',
	avatarUrl: profile.avatar || currentUserInfo.value.avatarUrl || currentUserInfo.value.avatar || ''
})

const skip = () => {
	close()
	emit('skip', currentUserInfo.value)
}

const save = async () => {
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
			nickname: name || currentUserInfo.value.nickname || currentUserInfo.value.name || '',
			avatar: savedAvatar.avatar || currentUserInfo.value.avatar || '',
			avatarFileID: savedAvatar.avatarFileID || getExistingAvatarFileID()
		}

		let userInfo = buildMergedUserInfo(profile)
		if (uni.getStorageSync('token')) {
			try {
				const remoteUserInfo = await updateUserInfo({ profile })
				userInfo = remoteUserInfo || userInfo
			} catch (error) {
				console.warn('update wechat profile failed:', error)
			}
		}

		uni.setStorageSync('userInfo', userInfo)
		close()
		emit('saved', userInfo)
	} finally {
		saving.value = false
	}
}
</script>

<style scoped>
.profile-editor-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 48rpx;
	background: rgba(15, 31, 58, 0.52);
	box-sizing: border-box;
}

.profile-editor-panel {
	width: 100%;
	max-width: 640rpx;
	padding: 36rpx;
	border-radius: 28rpx;
	background: #FFFFFF;
	box-shadow: 0 18rpx 60rpx rgba(15, 31, 58, 0.18);
	box-sizing: border-box;
}

.profile-editor-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 32rpx;
	font-weight: 700;
	line-height: 1.2;
	color: #0F1F3A;
}

.profile-editor-skip {
	font-size: 24rpx;
	font-weight: 500;
	color: #6B7C97;
}

.profile-editor-body {
	margin-top: 34rpx;
	display: flex;
	align-items: center;
	gap: 28rpx;
}

.profile-avatar-button {
	width: 132rpx;
	height: 132rpx;
	padding: 0;
	flex: 0 0 132rpx;
	overflow: hidden;
	border-radius: 999rpx;
	background: #F3F8FF;
	line-height: 1;
}

.profile-avatar-button::after {
	border: none;
}

.profile-avatar-image {
	width: 132rpx;
	height: 132rpx;
	display: block;
	border-radius: 999rpx;
}

.profile-avatar-image.placeholder {
	padding: 20rpx;
	box-sizing: border-box;
}

.profile-nickname-input {
	height: 88rpx;
	min-width: 0;
	flex: 1;
	padding: 0 24rpx;
	border: 2rpx solid #E4ECF7;
	border-radius: 18rpx;
	background: #F8FAFE;
	color: #0F1F3A;
	font-size: 30rpx;
	line-height: 88rpx;
	box-sizing: border-box;
}

.profile-input-placeholder {
	color: #9AA9BF;
}

.profile-editor-actions {
	margin-top: 36rpx;
	display: flex;
	gap: 20rpx;
}

.profile-action {
	height: 84rpx;
	margin: 0;
	padding: 0;
	flex: 1;
	border-radius: 18rpx;
	font-size: 28rpx;
	font-weight: 700;
	line-height: 84rpx;
}

.profile-action::after {
	border: none;
}

.profile-action.secondary {
	background: #F1F5FB;
	color: #324563;
}

.profile-action.primary {
	background: #1E6FE0;
	color: #FFFFFF;
}

.tap:active {
	opacity: 0.86;
}
</style>
