<template>
  <div>
    <h2>User Registration</h2>
    <form @submit.prevent="handleRegister">
      <div>
        <label>Username:</label>
        <input v-model="username" type="text" required />
      </div>
      <div>
        <label>Password:</label>
        <input v-model="password" type="password" required />
      </div>
      <div>
        <label>Confirm Password:</label>
        <input v-model="confirmPassword" type="password" required />
      </div>
      <button type="submit">Register</button>
    </form>
        <el-button plain @click="toLogin">
      Login
    </el-button>
    <p v-if="message">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import router from '../router/index.js'; // Assuming you are using Vue Router

const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const message = ref('');

const handleRegister = async () => {
  if (password.value !== confirmPassword.value) {
    message.value = 'Passwords do not match!';
    return;
  }

  try {
    const response = await axios.post('/rest_register/', {
      username: username.value,
      password: password.value,
    });
    message.value = response.data.message;
    // Redirect after successful registration
  } catch (error) {
    message.value = 'Registration failed: ' + (error.response?.data?.message || 'Network error');
  }
};

const toLogin = () => {
    router.push('/login'); // Redirect to login page
}
</script>