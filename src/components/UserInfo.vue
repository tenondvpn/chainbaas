<template>
    <el-container class="profile-container">
        <el-aside width="380px" class="profile-aside">
            <div class="user-info-card">
                <el-avatar :size="80" :src="userInfo.avatar" />
                <el-text class="mx-1" style="font-size: 24px;">{{ userInfo.name }}</el-text>
                <p class="user-intro">{{ userInfo.intro }}</p>

                <el-form :model="form" label-width="auto" style="max-width: 131px">
                    <el-form-item label="切换背景色">
                        <el-switch v-model="isDark" :active-icon="Moon" :inactive-icon="Sunny" inline-prompt
                            @change="toggleDark" style="margin-top: 0px; width: 200px;margin-left:0px;" />

                    </el-form-item>
                    <el-form-item label="切换主题色">
                        <el-color-picker v-model="themeColor" show-alpha :predefine="predefineColors" style="width: 48px; margin-left: -4px;"
                            @change="logColor" />
                    </el-form-item>
                </el-form>
            </div>
        </el-aside>

        <el-main class="profile-main">
            <el-card class="content-card">
                <template #header>
                    <div class="card-header">
                        <span>基本信息</span>
                    </div>
                </template>
                <p class="info-item"><strong>昵称：</strong>{{ userInfo.name }}</p>
                <p class="info-item"><strong>邮箱：</strong>{{ userInfo.email }}</p>
                <p class="info-item"><strong>注册日期：</strong>{{ userInfo.joinDate }}</p>
            </el-card>
            <el-card class="content-card">
                <template #header>
                    <div class="card-header">
                        <span>数据概览</span>
                    </div>
                </template>
                <div class="data-overview">
                    <div class="data-item">
                        <h3>23</h3>
                        <p>订单总数</p>
                    </div>
                    <div class="data-item">
                        <h3>4</h3>
                        <p>待处理</p>
                    </div>
                    <div class="data-item">
                        <h3>58</h3>
                        <p>浏览量</p>
                    </div>
                </div>
            </el-card>
            <el-card class="content-card">
                <template #header>
                    <div class="card-header">
                        <span>基本信息</span>
                    </div>
                </template>
                <p class="info-item"><strong>昵称：</strong>{{ userInfo.name }}</p>
                <p class="info-item"><strong>邮箱：</strong>{{ userInfo.email }}</p>
                <p class="info-item"><strong>注册日期：</strong>{{ userInfo.joinDate }}</p>
            </el-card>

            <el-card class="content-card">
                <template #header>
                    <div class="card-header">
                        <span>基本信息</span>
                    </div>
                </template>
                <p class="info-item"><strong>昵称：</strong>{{ userInfo.name }}</p>
                <p class="info-item"><strong>邮箱：</strong>{{ userInfo.email }}</p>
                <p class="info-item"><strong>注册日期：</strong>{{ userInfo.joinDate }}</p>
            </el-card>

        </el-main>
    </el-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Moon, Sunny, Document, Histogram } from '@element-plus/icons-vue';
import { reactive } from 'vue'
import { useDark, useToggle } from "@vueuse/core";

const isDark = useDark();
const toggleDark = useToggle(isDark);
const formAccessibility = reactive({
    fullName: '',
    firstName: '',
    lastName: '',
})

const userInfo = ref({
    name: 'Vue Dev',
    intro: '',
    email: 'dev@example.com',
    joinDate: '2023-01-15',
    avatar: 'https://cube.elemecdn.com/0/88/03b0d110126da18af6e7492c092c7jpg.jpeg'
});



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


// do not use same name with ref
const form = reactive({
    name: '',
    region: '',
    date1: '',
    date2: '',
    delivery: false,
    type: [],
    resource: '',
    desc: '',
})

const onSubmit = () => {
    console.log('submit!')
}
</script>

<style scoped>
/* 整个页面的容器 */
.profile-container {
    height: calc(100vh - 60px);
    /* 减去头部高度，使侧边栏自适应 */
    /* background-color: #f0f2f5; */
}

/* 侧边栏样式 */
.profile-aside {
    /* background-color: #ffffff; */
    box-shadow: 2px 0 6px rgba(0, 0, 0, 0.05);
    padding: 20px 0;
}

.user-info-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 20px;
    border-bottom: 0px solid #e0e6ed;
}

.user-info-card h2 {
    font-size: 1.5rem;
    margin-top: 10px;
    color: #333;
}

.user-intro {
    font-size: 0.9rem;
    color: #666;
    margin-top: 5px;
}

.profile-menu {
    border-right: none;
    padding-top: 20px;
}

/* 主内容区样式 */
.profile-main {
    padding: 20px;
    /* display: flex; */
    flex-direction: column;
    gap: 20px;
    /* 卡片之间的间距 */
    overflow-y: auto;
}

.content-card {
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    margin-top: 20px;
}

.card-header span {
    font-size: 1.2rem;
    font-weight: 600;
    color: #333;
}

.info-item {
    line-height: 1.8;
    color: #555;
    font-size: 1rem;
}

.data-overview {
    display: flex;
    justify-content: space-around;
    text-align: center;
}

.data-item h3 {
    font-size: 2rem;
    color: #409EFF;
}

.data-item p {
    font-size: 0.9rem;
    color: #666;
}
</style>