// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import Register from '../components/Register.vue';
import Login from '../components/Login.vue';
import Userinfo from '../components/UserInfo.vue'; // Page to redirect after login
import emitter from '../components/EventBus';
import Solidity from '../components/Solidity.vue';
import Faucet from '../components/Faucet.vue';
import ExplorerLayout from '../components/Explorer/ExplorerLayout.vue';
import ExplorerOverview from '../components/Explorer/ExplorerOverview.vue';
import BlockList from '../components/Explorer/BlockList.vue';
import BlockDetail from '../components/Explorer/BlockDetail.vue';
import TxList from '../components/Explorer/TxList.vue';
import TxDetail from '../components/Explorer/TxDetail.vue';
import AddressDetail from '../components/Explorer/AddressDetail.vue';
import ContractList from '../components/Explorer/ContractList.vue';
import ContractDetail from '../components/Explorer/ContractDetail.vue';
import GasPresets from '../components/Explorer/GasPresets.vue';

const routes = [
  { path: '/register', component: Register },
  { path: '/login', component: Login },
  { path: '/faucet', component: Faucet },
  { path: '/userinfo', component: Userinfo, meta: { requiresAuth: true } },
  { path: '/solidity', component: Solidity, meta: { requiresAuth: true } },
  {
    path: '/explorer',
    component: ExplorerLayout,
    redirect: '/explorer/overview',
    children: [
      { path: 'overview', component: ExplorerOverview },
      { path: 'blocks', component: BlockList },
      { path: 'blocks/:hash', component: BlockDetail },
      { path: 'transactions', component: TxList },
      { path: 'transactions/:hash', component: TxDetail },
      { path: 'address/:addr', component: AddressDetail },
      { path: 'contracts', component: ContractList },
      { path: 'contracts/:addr', component: ContractDetail },
      { path: 'gas-presets', component: GasPresets },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const whiteList = ['/external', '/public', '/faucet', '/explorer']


// Route guard: check if user is logged in
router.beforeEach((to, from, next) => {
  document.title = to.meta.title || 'seth'
  console.log("each url: ", to.path)
  emitter.emit('change_el_menu_item', to.path)
  if (whiteList.includes(to.path) || to.path.startsWith('/explorer')) {
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