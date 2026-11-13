<template>
  <component :is="as">
    <slot />
  </component>
</template>

<script setup>
defineProps({
  as: {
    type: String,
    default: 'label'
  }
})
</script>
