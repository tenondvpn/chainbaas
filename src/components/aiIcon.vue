<template>
  <img src="/images/ai.png" :alt="alt" class="custom-icon" />
</template>

<script setup>
defineProps({
  src: {
    type: String,
    required: true,
  },
  alt: {
    type: String,
    default: 'Custom Icon',
  },
});
</script>

<style scoped>
.custom-icon {
  width: 1.5em;
  height: 1.5em;
  vertical-align: -0.125em; /* 对齐文本 */
}
</style>