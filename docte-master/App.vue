<script>
	import { setupWechatPrivacyAuthorization } from '@/utils/wechat-privacy.js'

	export default {
		onLaunch: function() {
			console.log('App Launch')
			// #ifdef MP-WEIXIN
			setupWechatPrivacyAuthorization((resolve) => {
				if (typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
					uni.$emit('needPrivacyAuthorization', resolve)
				}
			})
			// #endif
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style>
	/*每个页面公共css */
	page {
		min-height: 100%;
		background: #E8EEFA;
	}
</style>
