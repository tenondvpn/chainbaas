//unsafe-eval
import { createApp } from 'vue'
// import './style.css'
import ElementPlus from 'element-plus'
import router from './router/index.js'
import 'element-plus/dist/index.css'
// import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/dark.scss';
import './assets/css/variable.scss'
// import './styles/element/index.scss'
import App from './App.vue'
import axios from 'axios';
// 1. 导入 Font Awesome 核心库
import { library } from '@fortawesome/fontawesome-svg-core';
// 2. 导入官方 Vue 组件
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
// 3. 导入你需要的图标
import { faUser, faHome, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { faTwitter, faGithub } from '@fortawesome/free-brands-svg-icons';
import { createPinia } from 'pinia'
import emitter from './components/EventBus.js';

// 4. 将图标添加到库中
library.add(faUser, faHome, faCircleInfo, faTwitter, faGithub);


// 设置 axios 的基础 URL
axios.defaults.baseURL = 'http://82.156.224.174:7001';

// 在应用启动时检查本地是否有 token
const token = localStorage.getItem('access_token');
if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`; // 设置默认请求头
    emitter.emit('show_menu', true)
    // axios.interceptors.response.use(response => response, error => {
    //     if (error.response.status === 401) {
    //         return axios.post('/rest_refresh/', {
    //             refresh: localStorage.getItem('refresh_token')
    //         }).then(response => {
    //             localStorage.setItem('access_token', response.data.access)
    //             error.config.headers['Authorization'] = `Bearer ${response.data.access}`
    //             return axios.request(error.config)
    //         })
    //     }
    //     return Promise.reject(error)
    // })

}

const app = createApp(App)

app.use(router)
app.use(createPinia())
app.use(ElementPlus)
app.component('font-awesome-icon', FontAwesomeIcon);
app.mount('#app')
