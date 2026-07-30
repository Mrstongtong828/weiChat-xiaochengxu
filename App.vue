<script>
	export default {
		onLaunch: function() {
			console.log('App Launch')
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

	page::after {
		content: "CICADA 思科达";
		position: fixed;
		top: 128rpx;
		right: 28rpx;
		z-index: 1;
		pointer-events: none;
		color: rgba(107, 114, 128, 0.22);
		font-size: 26rpx;
		font-weight: 600;
		line-height: 1;
	}
</style>
