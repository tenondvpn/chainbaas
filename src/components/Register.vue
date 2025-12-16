<template>
  <div>
    <h2>用户注册</h2>
    <form @submit.prevent="handleRegister">
      <div>
        <label>用户名:</label>
        <input v-model="username" type="text" required />
      </div>
      <div>
        <label>密码:</label>
        <input v-model="password" type="password" required />
      </div>
      <div>
        <label>确认密码:</label>
        <input v-model="confirmPassword" type="password" required />
      </div>
      <button type="submit">注册</button>
    </form>
        <el-button plain @click="toLogin">
      登录
    </el-button>
    <p v-if="message">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import router from '../router/index.js'; // 假设你使用了 Vue Router

const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const message = ref('');

const handleRegister = async () => {
  if (password.value !== confirmPassword.value) {
    message.value = '两次输入的密码不一致！';
    return;
  }

  try {
    const response = await axios.post('/rest_register/', {
      username: username.value,
      password: password.value,
    });
    message.value = response.data.message;
    // 注册成功后可以进行页面跳转
  } catch (error) {
    message.value = '注册失败：' + (error.response?.data?.message || '网络错误');
  }
};

const toLogin = () => {
    router.push('/login'); // 登录成功后跳转到主页
}
</script>