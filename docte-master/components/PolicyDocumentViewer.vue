<template>
	<view class="policy-document-viewer">
		<template v-if="policyDocument">
			<view v-if="hasMobileView && hasOriginalView" class="policy-view-switch">
				<view :class="['policy-view-option', { active: viewMode === 'mobile' }]" @click="setViewMode('mobile')">适配阅读</view>
				<view :class="['policy-view-option', { active: viewMode === 'original' }]" @click="setViewMode('original')">原稿</view>
			</view>

			<view v-if="viewMode === 'mobile' && hasMobileView" class="policy-mobile-content">
				<rich-text :nodes="policyDocument.mobileHtml"></rich-text>
			</view>
			<view v-else class="policy-original-content">
				<image
					v-for="(url, index) in pageUrls"
					:key="url + index"
					class="policy-original-page"
					:src="url"
					mode="widthFix"
					:lazy-load="index > 0"
					@click="previewPage(index)"
				/>
				<text v-if="!pageUrls.length" class="policy-document-empty">暂无原稿页面</text>
				<view v-if="originalFileUrl" class="policy-open-file tap" @click="openOriginalFile">打开原稿文件</view>
			</view>
		</template>

		<template v-else-if="fallbackSections.length">
			<view v-for="(section, index) in fallbackSections" :key="section.title + index" class="policy-fallback-section">
				<view class="policy-fallback-title">{{ section.title }}</view>
				<view class="policy-mobile-content compact"><rich-text :nodes="section.content"></rich-text></view>
			</view>
		</template>

		<view v-else-if="fallbackContent" class="policy-mobile-content">
			<rich-text :nodes="fallbackContent"></rich-text>
		</view>
		<text v-else class="policy-document-empty">{{ emptyText }}</text>
	</view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
	policyDocument: { type: Object, default: null },
	fallbackContent: { type: String, default: '' },
	fallbackSections: { type: Array, default: () => [] },
	emptyText: { type: String, default: '暂无内容' }
})

const pageUrls = computed(() => (props.policyDocument?.original?.pagePreviewUrls || []).filter(Boolean))
const originalFileUrl = computed(() => (
	props.policyDocument?.original?.pdfPreviewUrl || props.policyDocument?.source?.previewUrl || ''
))
const hasMobileView = computed(() => !!String(props.policyDocument?.mobileHtml || '').trim())
const hasOriginalView = computed(() => !!pageUrls.value.length || !!originalFileUrl.value)
const defaultViewMode = () => (hasMobileView.value ? 'mobile' : 'original')
const viewMode = ref(defaultViewMode())

watch(() => props.policyDocument, () => {
	viewMode.value = defaultViewMode()
})

const setViewMode = (mode) => {
	if (mode === 'mobile' && !hasMobileView.value) return
	if (mode === 'original' && !hasOriginalView.value) return
	viewMode.value = mode
}

const previewPage = (index) => {
	if (!pageUrls.value.length) return
	uni.previewImage({
		urls: pageUrls.value,
		current: pageUrls.value[index] || pageUrls.value[0]
	})
}

const openOriginalFile = async () => {
	const url = originalFileUrl.value
	if (!/^https?:\/\//i.test(String(url || ''))) {
		uni.showToast({ title: '原稿地址暂不可用', icon: 'none' })
		return
	}
	try {
		uni.showLoading({ title: '打开中' })
		const downloadRes = await uni.downloadFile({ url })
		await uni.openDocument({
			filePath: downloadRes.tempFilePath,
			fileType: props.policyDocument?.original?.pdfPreviewUrl ? 'pdf' : (props.policyDocument?.source?.fileType || 'docx'),
			showMenu: true
		})
	} catch (error) {
		console.warn('open policy document failed:', error)
		uni.showToast({ title: '原稿打开失败', icon: 'none' })
	} finally {
		uni.hideLoading()
	}
}
</script>

<style scoped>
.policy-document-viewer { width: 100%; box-sizing: border-box; }
.policy-view-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 360rpx; height: 68rpx; margin: 0 auto 28rpx; padding: 6rpx; border-radius: 8rpx; background: #e8edf4; box-sizing: border-box; }
.policy-view-option { display: flex; align-items: center; justify-content: center; min-width: 0; border-radius: 6rpx; color: #65758c; font-size: 25rpx; font-weight: 600; }
.policy-view-option.active { background: #fff; color: #174f92; box-shadow: 0 2rpx 8rpx rgba(15, 31, 58, 0.12); }
.policy-mobile-content { padding: 24rpx 8rpx 64rpx; color: #27364d; font-size: 28rpx; line-height: 1.8; word-break: break-word; box-sizing: border-box; }
.policy-mobile-content.compact { padding: 12rpx 4rpx 8rpx; }
.policy-original-content { padding-bottom: 64rpx; }
.policy-original-page { display: block; width: 100%; margin-bottom: 22rpx; background: #fff; box-shadow: 0 4rpx 20rpx rgba(15, 31, 58, 0.1); }
.policy-open-file { display: flex; align-items: center; justify-content: center; min-height: 84rpx; margin-top: 28rpx; border: 2rpx solid #1e6fe0; border-radius: 8rpx; color: #1e6fe0; font-size: 27rpx; font-weight: 700; }
.policy-fallback-section { margin-top: 20rpx; padding: 24rpx 26rpx; border-radius: 16rpx; background: #fff; box-shadow: 0 2rpx 4rpx rgba(15, 31, 58, 0.04), 0 8rpx 28rpx rgba(30, 111, 224, 0.05); box-sizing: border-box; }
.policy-fallback-title { color: #0f1f3a; font-size: 30rpx; font-weight: 700; line-height: 1.5; }
.policy-document-empty { display: block; padding: 96rpx 0; color: #8593a7; font-size: 27rpx; text-align: center; }
</style>
