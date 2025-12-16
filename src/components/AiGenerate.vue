<template>
  <el-input
    v-model="textarea"
    style="width: 100%"
    :rows="18"
    type="textarea"
    placeholder="输入你的需求"
  />

  <el-divider />

  <el-button type="primary" @click="aiGenerate">AI生成流程图</el-button>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import emitter from './EventBus'

const textarea = ref('')
const aiGenerate = () => {
    emitter.emit('ai_generate', textarea.value)
}
</script>
