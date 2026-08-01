<template>
  <section class="shad-card" :class="{ 'is-clickable': clickable }">
    <slot />
  </section>
</template>

<script setup>
defineProps({
  clickable: {
    type: Boolean,
    default: false
  }
})
</script>
