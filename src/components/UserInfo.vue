<template>
    <el-container class="profile-container">
        <el-aside width="380px" class="profile-aside">
            <div class="user-info-card">
                <el-avatar :size="80" :src="userInfo.avatar" />
                <el-text class="mx-1" style="font-size: 24px;">{{ userInfo.name }}</el-text>
                <p class="user-intro">{{ userInfo.intro }}</p>

                <el-form :model="form" label-width="auto" style="max-width: 131px">
                    <el-form-item label="Switch Background">
                        <el-switch v-model="isDark" :active-icon="Moon" :inactive-icon="Sunny" inline-prompt
                            @change="toggleDark" style="margin-top: 0px; width: 200px;margin-left:0px;" />

                    </el-form-item>
                    <el-form-item label="Switch Theme Color">
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
                        <span>Basic Info</span>
                    </div>
                </template>
                <p class="info-item"><strong>Nickname:</strong>{{ userInfo.name }}</p>
                <p class="info-item"><strong>Email:</strong>{{ userInfo.email }}</p>
                <p class="info-item"><strong>Join Date:</strong>{{ userInfo.joinDate }}</p>
            </el-card>
            <el-card class="content-card">
                <template #header>
                    <div class="card-header">
                        <span>Data Overview</span>
                    </div>
                </template>
                <div class="data-overview">
                    <div class="data-item">
                        <h3>23</h3>
                        <p>Total Orders</p>
                    </div>
                    <div class="data-item">
                        <h3>4</h3>
                        <p>Pending</p>
                    </div>
                    <div class="data-item">
                        <h3>58</h3>
                        <p>Views</p>
                    </div>
                </div>
            </el-card>
            <el-card class="content-card">
                <template #header>
                    <div class="card-header">
                        <span>Basic Info</span>
                    </div>
                </template>
                <p class="info-item"><strong>Nickname:</strong>{{ userInfo.name }}</p>
                <p class="info-item"><strong>Email:</strong>{{ userInfo.email }}</p>
                <p class="info-item"><strong>Join Date:</strong>{{ userInfo.joinDate }}</p>
            </el-card>

            <el-card class="content-card">
                <template #header>
                    <div class="card-header">
                        <span>Basic Info</span>
                    </div>
                </template>
                <p class="info-item"><strong>Nickname:</strong>{{ userInfo.name }}</p>
                <p class="info-item"><strong>Email:</strong>{{ userInfo.email }}</p>
                <p class="info-item"><strong>Join Date:</strong>{{ userInfo.joinDate }}</p>
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


// Get or set default theme color from localStorage
const themeColor = ref(localStorage.getItem('themeColor') || '#5F95FF');

// Watch for themeColor changes
watch(themeColor, (newColor) => {
    // Dynamically modify Element UI --el-color-primary variable
    document.documentElement.style.setProperty('--el-color-primary', newColor);
    // Simultaneously modify other related color variables
    document.documentElement.style.setProperty('--el-color-primary-light-3', newColor);
    document.documentElement.style.setProperty('--el-color-primary-light-5', newColor);
    document.documentElement.style.setProperty('--el-color-primary-light-7', newColor);
    document.documentElement.style.setProperty('--el-color-primary-light-8', newColor);
    document.documentElement.style.setProperty('--el-color-primary-light-9', newColor);
});

// Save color to localStorage
const saveTheme = () => {
    localStorage.setItem('themeColor', themeColor.value);
};

function logColor(val) {
    console.log('Color updated:', val)
    // When document.documentElement is a global variable
    const el = document.documentElement
    // const el = document.getElementById('xxx')

    // Get css variable
    getComputedStyle(el).getPropertyValue(`--el-color-primary`)

    // Set css variable
    el.style.setProperty('--el-color-primary', val)
    themeColor.value = val;
    saveTheme()
}

// Apply saved color on page load
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
/* Container for the entire page */
.profile-container {
    height: calc(100vh - 60px);
    /* Subtract header height to make sidebar adaptive */
    /* background-color: #f0f2f5; */
}

/* Sidebar styles */
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

/* Main content area styles */
.profile-main {
    padding: 20px;
    /* display: flex; */
    flex-direction: column;
    gap: 20px;
    /* Spacing between cards */
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