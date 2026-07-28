<template>
	<view class="payment-method-selector">
		<view class="payment-method-heading">
			<text>付款方式</text>
			<text>请选择一种方式</text>
		</view>
		<mp-checkbox-group :multi="false" @change="onMethodChange">
			<mp-checkbox
				v-for="option in options"
				:key="option.value"
				:value="option.value"
				:label="option.label"
				:checked="modelValue === option.value"
			/>
		</mp-checkbox-group>
		<text class="payment-method-description">{{ selectedOption.description }}</text>
	</view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	modelValue: { type: String, default: 'wechat' }
})

const emit = defineEmits(['update:modelValue'])

const options = [
	{ value: 'wechat', label: '微信支付', description: '通过微信收银台完成付款' },
	{ value: 'transfer', label: '对公转账', description: '转账后上传付款凭证' }
]

const selectedOption = computed(() => options.find((option) => option.value === props.modelValue) || options[0])

const onMethodChange = (event = {}) => {
	const value = event.detail && event.detail.value
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


.payment-method-description {
	display: block;
	margin-top: 14rpx;
	font-size: 22rpx;
	color: #6B7C97;
}
</style>
