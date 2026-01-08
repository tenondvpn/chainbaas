// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import Register from '../components/Register.vue';
import Login from '../components/Login.vue';
import Userinfo from '../components/UserInfo.vue'; // 登录后跳转的页面
import emitter from '../components/EventBus';
import Solidity from '../components/Solidity.vue';

const routes = [
  { path: '/register', component: Register },
  { path: '/login', component: Login },
  { path: '/userinfo', component: Userinfo, meta: { requiresAuth: true } },
  { path: '/solidity', component: Solidity, meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const whiteList = ['/external', '/public']


// 路由守卫：检查用户是否登录
router.beforeEach((to, from, next) => {
  document.title = to.meta.title || 'seth'
  console.log("each url: ", to.path)
  emitter.emit('change_el_menu_item', to.path)
  if (whiteList.includes(to.path)) {
    return next()
  }

  const token = localStorage.getItem('access_token');
  if (to.meta.requiresAuth && !token) {
    next('/login');
  } else {
    next();
  }
});

export default router;