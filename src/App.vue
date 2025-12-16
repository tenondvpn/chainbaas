<template>
    <el-menu :default-active="activeIndex" mode="horizontal" style="height: 44px;" :ellipsis="false"
        @select="handleSelect">
        <el-menu-item index="0">
            <img v-if="isDark" style="width: 100px" src="./images/shardora.png" alt="Element logo" />
            <img v-else style="width: 100px" src="./images/blue_shardora.png" alt="Element logo" />
        </el-menu-item>
        <el-tooltip class="box-item" content="进入流程管理页面，管理自己的流程！">
            <el-menu-item v-if="show_menu" index="1" @click="toPipeline">流程管理</el-menu-item>
        </el-tooltip>
        <el-tooltip class="box-item" content="插件管理！">
            <el-menu-item v-if="show_menu" index="3" @click="toProcessor">插件管理</el-menu-item>
        </el-tooltip>
        <el-tooltip class="box-item" content="管理所有的任务执行状态！">
            <el-menu-item v-if="show_menu" index="2" @click="toRuning">流程状态</el-menu-item>
        </el-tooltip>
         <el-tooltip class="box-item" content="进入平台统计大屏，包括算力，数据，模型，任务，用户统计信息！">
            <el-menu-item v-if="show_menu" index="4" @click="toDashboard">平台大屏</el-menu-item>
        </el-tooltip>
        <el-tooltip class="box-item" content="solidity智能合约编辑管理！">
            <el-menu-item v-if="show_solidty" index="5" @click="toSolidty">智能合约</el-menu-item>
        </el-tooltip>
        <el-menu-item index="5" style="margin-top:0px" class="no-underline">
            <el-tooltip class="box-item" content="切换背景色！">
                <el-checkbox fill="#409eff" v-model="checked1" style="margin-top:-15px;margin-left: -12px;float:right;"
                    size="default" @change="toggleDark" />
            </el-tooltip>
            <el-tooltip class="box-item" content="切换主题！">
                <el-color-picker size="small" style="margin-top:20px;margin-left: -19px;float:right;"
                    v-model="themeColor" show-alpha :predefine="predefineColors" @change="logColor" />
            </el-tooltip>
        </el-menu-item>
        <el-dropdown trigger="click" @command="handleCommand">
            <div class="user-menu-trigger">
                <el-avatar :size="27" :src="circleUrl" style="margin-top: 7px;" />
            </div>
            <template #dropdown>
                <el-dropdown-menu>
                    <!-- <el-dropdown-item command="settings">修改密码</el-dropdown-item> -->
                    <el-dropdown-item v-if="show_menu" divided command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
            </template>
        </el-dropdown>
    </el-menu>
    <router-view  ></router-view>
</template>
<script lang="ts">
export default {
}

</script>

<script lang="ts" setup>
import { onMounted, ref, watch, onBeforeUnmount } from 'vue'
import { reactive, toRefs } from 'vue'
import { Sunny, Moon } from "@element-plus/icons-vue";
import { useDark, useToggle } from "@vueuse/core";
import axios from 'axios';
import { useRouter } from 'vue-router';
import { ElConfigProvider } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { ElMessage } from 'element-plus';
import emitter from './components/EventBus';
import { ElNotification } from 'element-plus';

const show_menu = ref(true)
const show_solidty = ref(true)
const checked1 = ref(true)
// 从 localStorage 获取或设置默认主题色
const themeColor = ref(localStorage.getItem('themeColor') || '#5F95FF');

// 监听 themeColor 的变化
watch(themeColor, (newColor) => {
    // 动态修改 Element UI 的 --el-color-primary 变量
    document.documentElement.style.setProperty('--el-color-primary', newColor);
    // 同时修改其他相关的颜色变量
    document.documentElement.style.setProperty('--el-color-primary-light-3', newColor);
    document.documentElement.style.setProperty('--el-color-primary-light-5', newColor);
    document.documentElement.style.setProperty('--el-color-primary-light-7', newColor);
    document.documentElement.style.setProperty('--el-color-primary-light-8', newColor);
    document.documentElement.style.setProperty('--el-color-primary-light-9', newColor);
});

onMounted(() => {
    emitterOn();
    const token = localStorage.getItem('access_token');
    if (token) {
        show_menu.value = true
    }

});

onBeforeUnmount(() => {
    emitterOff();
})

// 保存颜色到 localStorage
const saveTheme = () => {
    localStorage.setItem('themeColor', themeColor.value);
};

function logColor(val) {
    console.log('颜色已更新:', val)
    // document.documentElement 是全局变量时
    const el = document.documentElement
    // const el = document.getElementById('xxx')

    // 获取 css 变量
    getComputedStyle(el).getPropertyValue(`--el-color-primary`)

    // 设置 css 变量
    el.style.setProperty('--el-color-primary', val)
    themeColor.value = val;
    saveTheme()
}

// 页面加载时，应用保存的颜色
document.documentElement.style.setProperty('--el-color-primary', themeColor.value);

const router = useRouter();

const handleCommand = async (command) => {
    if (command === 'settings') {
    } else if (command === 'logout') {
        try {
            const response = await axios.post('/rest_logout/', {
            });

            localStorage.setItem('access_token', '')
            axios.defaults.headers.common['Authorization'] = ''; // 设置默认请求头
            ElMessage.success('已退出登录');
            show_menu.value = true
            router.push('/login'); // 登录成功后跳转到主页
        } catch (error) {
            ElNotification({ title: "出现错误", message: "退出失败：" + error, type: "danger", position: 'top-left', })
        }
    }
};

const toSolidty = () => {
    router.push('/solidity');
}

const handleLogout = async () => {
    localStorage.removeItem('user-token');
    delete axios.defaults.headers.common['Authorization'];
    router.push('/login');
    console.log("logout success.")


};

const toDashboard = () => {
    router.push('/dashboard');
}

const toPipeline = () => {
    router.push('/pipeline');
}

const toRuning = () => {
    router.push('/runing');
}

const toProcessor = () => {
    router.push('/processor');
}

const isDark = useDark();

const tmp_toggleDark = useToggle(isDark);
const toggleDark = () => {
    tmp_toggleDark()
    emitter.emit("theme_changed", {})
}

const activeIndex = ref('1')
const handleSelect = (key: string, keyPath: string[]) => {
    console.log(key, keyPath)
}

const emitterOn = () => {
    emitter.on("show_menu", (show) => {
        show_menu.value = show
        console.log("show_menu: ", show_menu.value)
    })

    emitter.on('change_el_menu_item', (path) => {
        if (path.indexOf('/dashboard') >= 0) {
            activeIndex.value = '4'
        } else if (path.indexOf('/pipeline') >= 0) {
            activeIndex.value = '1'
        } else if (path.indexOf('/runing') >= 0) {
            activeIndex.value = '2'
        } else if (path.indexOf('/processor') >= 0) {
            activeIndex.value = '3'
        } else {
            activeIndex.value = '5'
        }
    })
}

const emitterOff = () => {
    emitter.off("show_menu", null)
    emitter.off("change_el_menu_item", null)
}

const state = reactive({
    circleUrl:
        'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
    squareUrl:
        'https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png',
    sizeList: ['small', '', 'large'] as const,
})

const { circleUrl, squareUrl, sizeList } = toRefs(state)


const color = ref('rgba(255, 69, 0, 0.68)')
const predefineColors = ref([
    '#5F95FF',
    '#ff8c00',
    '#ffd700',
    '#90ee90',
    '#00ced1',
    '#1e90ff',
    '#c71585',
    'rgba(255, 69, 0, 0.68)',
    'rgb(255, 120, 0)',
    'hsv(51, 100, 98)',
    'hsva(120, 40, 94, 0.5)',
    'hsl(181, 100%, 37%)',
    'hsla(209, 100%, 56%, 0.73)',
    '#c7158577',
])

</script>

<style scoped>
.el-menu--horizontal>.el-menu-item:nth-child(1) {
    margin-right: auto;
}

.demo-basic {
    text-align: center;
}

.demo-basic .sub-title {
    margin-bottom: 10px;
    font-size: 14px;
    color: var(--el-text-color-secondary);
}

.demo-basic .demo-basic--circle,
.demo-basic .demo-basic--square {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.demo-basic .block:not(:last-child) {
    border-right: 1px solid var(--el-border-color);
}

.demo-basic .block {
    flex: 1;
}

.demo-basic .el-col:not(:last-child) {
    border-right: 1px solid var(--el-border-color);
}

@media screen and (max-width: 992px) {
    .demo-basic .el-col:not(:last-child) {
        border-right: none;
    }
}


.no-underline.is-active {
    border-bottom: 0px !important;
}
</style>

<style>
.el-color-picker__trigger {
    border: 0px;
}

/* .el-color-picker__color-inner {
    background-color: var(--el-color-info)!important;
} */

.el-color-picker .el-color-picker__icon {
    align-items: center;
    color: #ffffff;
    display: none;
    font-size: 12px;
    justify-content: center;
}
</style>