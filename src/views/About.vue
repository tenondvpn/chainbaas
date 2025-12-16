<template>
  <div class="page-container">
    <h1>关于我们</h1>
    <p>这是一个关于本项目的介绍页面。</p>
    <el-button plain @click="goBack">
      返回首页
    </el-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goBack = () => {
  router.push('/')
}
</script>

<style scoped>
.page-container {
  padding: 20px;
  text-align: center;
}
h1 {
  color: #333;
}
p {
  color: #666;
  margin-top: 10px;
  margin-bottom: 20px;
}
</style>