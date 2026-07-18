<template>
	<view v-if="false" class="inline-profile-compat"></view>
</template>

<script setup>
defineProps({
	userInfo: {
		type: Object,
		default: () => ({})
	},
	visible: {
		type: Boolean,
		default: false
	}
})

defineEmits(['update:visible', 'saved', 'skip'])
</script>

<style scoped>
.inline-profile-compat {
	display: none;
}
</style>
