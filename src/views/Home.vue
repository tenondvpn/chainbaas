<template>
  <div class="page-container">
    <h1>欢迎来到首页！</h1>
    <p>这是一个使用 Element Plus 和 Vue Router 构建的单页应用示例。</p>
    <el-button plain type="primary" @click="goToAbout">
      前往关于页面
    </el-button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goToAbout = () => {
  router.push('/about')
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