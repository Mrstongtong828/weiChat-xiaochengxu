<template>
	<view class="payment-method-selector">
		<view class="payment-method-heading">
			<text>付款方式</text>
			<text>请选择一种方式</text>
		</view>
		<view class="payment-option-list" aria-role="radiogroup" aria-label="付款方式">
			<view
				v-for="option in options"
				:key="option.value"
				class="payment-option"
				:class="{ 'payment-option--selected': modelValue === option.value }"
				aria-role="radio"
				:aria-checked="modelValue === option.value"
				hover-class="payment-option--pressed"
				@click="selectMethod(option.value)"
			>
				<view class="payment-option-copy">
					<text class="payment-option-label">{{ option.label }}</text>
					<text class="payment-option-description">{{ option.description }}</text>
				</view>
				<view
					class="payment-option-radio"
					:class="{ 'payment-option-radio--checked': modelValue === option.value }"
					aria-hidden="true"
				>
					<view v-if="modelValue === option.value" class="payment-option-radio-dot"></view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
const props = defineProps({
	modelValue: { type: String, default: 'wechat' }
})

const emit = defineEmits(['update:modelValue'])

const options = [
	{ value: 'wechat', label: '微信支付', description: '通过微信收银台完成付款' },
	{ value: 'transfer', label: '对公转账', description: '转账后上传付款凭证' }
]

const selectMethod = (value) => {
	if (options.some((option) => option.value === value)) emit('update:modelValue', value)
}
</script>

<style scoped>
.payment-method-selector {
	margin-top: 28rpx;
	padding-top: 24rpx;
	border-top: 2rpx solid #E4ECF7;
}

.payment-method-heading {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 20rpx;
}

.payment-method-heading text:first-child {
	font-size: 27rpx;
	font-weight: 800;
	color: #0F1F3A;
}

.payment-method-heading text:last-child {
	font-size: 22rpx;
	color: #8A97AA;
}

.payment-option-list {
	margin-top: 18rpx;
	border: 2rpx solid #E4ECF7;
	border-radius: 16rpx;
	overflow: hidden;
}

.payment-option {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24rpx;
	min-height: 112rpx;
	padding: 20rpx 24rpx;
	box-sizing: border-box;
	background: #FFFFFF;
	border-bottom: 2rpx solid #E4ECF7;
	transition: background-color 160ms ease;
}

.payment-option:last-child {
	border-bottom: 0;
}

.payment-option--selected {
	background: #F3F7FF;
}

.payment-option--pressed {
	background: #EDF3FD;
}

.payment-option-copy {
	display: flex;
	flex: 1;
	min-width: 0;
	flex-direction: column;
	gap: 8rpx;
}

.payment-option-label {
	font-size: 28rpx;
	font-weight: 700;
	color: #0F1F3A;
}

.payment-option-description {
	font-size: 22rpx;
	color: #6B7C97;
}

.payment-option-radio {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40rpx;
	height: 40rpx;
	flex: 0 0 40rpx;
	box-sizing: border-box;
	border: 3rpx solid #AAB6C8;
	border-radius: 50%;
	background: #FFFFFF;
}

.payment-option-radio--checked {
	border-color: #1D63D2;
}

.payment-option-radio-dot {
	width: 20rpx;
	height: 20rpx;
	border-radius: 50%;
	background: #1D63D2;
}
</style>
