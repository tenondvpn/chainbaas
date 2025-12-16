// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import Register from '../components/Register.vue';
import Login from '../components/Login.vue';
import Dashboard from '../components/Dashboard.vue'; // 登录后跳转的页面
import Pipeline from '../components/Pipeline.vue'; // 登录后跳转的页面
import ExternalView from '../components/ExternalRedirect.vue'; // 登录后跳转的页面
import Userinfo from '../components/UserInfo.vue'; // 登录后跳转的页面
import HistoryGraph from '../components/HistoryGraph.vue';
import AllRuningTasks from '../components/AllRuningTasks.vue';
import Processor from '../components/Processor.vue';
import emitter from '../components/EventBus';
import Solidity from '../components/Solidity.vue';

const routes = [
  { path: '/register', component: Register },
  { path: '/login', component: Login },
  { path: '/pipeline', component: Pipeline, meta: { requiresAuth: true } },
  { path: '/userinfo', component: Userinfo, meta: { requiresAuth: true } },
  { path: '/historyGraph', component: HistoryGraph, meta: { requiresAuth: true } },
  { path: '/runing', component: AllRuningTasks, meta: { requiresAuth: true } },
  { path: '/processor', component: Processor, meta: { requiresAuth: true } },
  { path: '/solidity', component: Solidity, meta: { requiresAuth: true } },
  {
    path: '/dashboard',
    component: ExternalView,
    meta: { bypassAuth: true, external: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const whiteList = ['/external', '/public']


// 路由守卫：检查用户是否登录
router.beforeEach((to, from, next) => {
  document.title = to.meta.title || '智能计算平台'
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