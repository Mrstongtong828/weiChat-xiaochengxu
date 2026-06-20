<template>
  <button
    class="shad-button"
    :class="`shad-button--${variant}`"
    :type="type"
    :disabled="disabled || loading"
  >
    <span v-if="loading">处理中...</span>
    <slot v-else />
  </button>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'primary'
  },
  type: {
    type: String,
    default: 'button'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})
</script>
