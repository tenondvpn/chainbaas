import { createRouter, createWebHistory } from 'vue-router'
import Faucet from '../components/Faucet.vue'
import Explorer from '../components/Explorer.vue'
import Solidity from '../components/Solidity.vue'
import emitter from '../components/EventBus'

const routes = [
    { path: '/', redirect: '/explorer' },
    { path: '/explorer', component: Explorer },
    { path: '/faucet', component: Faucet },
    { path: '/solidity', component: Solidity },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

router.beforeEach((to, from, next) => {
    document.title = to.meta.title || 'ShardoraChain'
    emitter.emit('change_el_menu_item', to.path)
    next()
})

export default router
