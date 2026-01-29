<template>
  <el-input
    v-model="textarea"
    style="width: 100%"
    :rows="18"
    type="textarea"
    placeholder="Enter your requirements"
  />

  <el-divider />

  <el-button type="primary" @click="aiGenerate">AI Generate Contract Graph</el-button>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import emitter from './EventBus'

const textarea = ref('')
const aiGenerate = () => {
    emitter.emit('ai_generate', textarea.value)
}
</script>
