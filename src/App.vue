<template>
    <el-menu :default-active="activeIndex" mode="horizontal" style="height: 44px;" :ellipsis="false"
        @select="handleSelect">
        <el-menu-item index="0">
            <h3>ShardoraChain</h3>
        </el-menu-item>
        <el-tooltip content="Blockchain explorer — search accounts and transactions">
            <el-menu-item index="1" @click="toExplorer">Explorer</el-menu-item>
        </el-tooltip>
        <el-tooltip content="Get test tokens from the faucet">
            <el-menu-item index="2" @click="toFaucet">Faucet</el-menu-item>
        </el-tooltip>
        <el-tooltip content="Solidity smart contract IDE">
            <el-menu-item index="3" @click="toSolidity">Smart Contract</el-menu-item>
        </el-tooltip>
        <el-menu-item index="8" class="no-underline" style="margin-top:0px">
            <el-popover :visible="pkVisible" placement="bottom" :width="480">
                <p style="margin:0 0 8px;font-weight:600;">设置私钥 (64位十六进制)</p>
                <el-input v-model="privateKeyInput" type="password" show-password
                    placeholder="输入64位十六进制私钥" style="width:100%" />
                <div style="text-align:right;margin-top:12px;">
                    <el-button size="small" text @click="pkVisible = false">取消</el-button>
                    <el-button size="small" type="primary" @click="savePrivateKey">确定</el-button>
                </div>
                <template #reference>
                    <el-button :type="pkSaved ? 'success' : 'warning'" size="small" :icon="KeyIcon"
                        @click="pkVisible = true" style="margin-top:10px;">
                        私钥{{ pkSaved ? ' ✓' : '' }}
                    </el-button>
                </template>
            </el-popover>
        </el-menu-item>
        <el-menu-item index="9" style="margin-top:0px" class="no-underline">
            <el-tooltip content="Switch background color">
                <el-checkbox fill="#409eff" v-model="checked1" style="margin-top:-15px;margin-left:-12px;float:right;"
                    size="default" @change="toggleDark" />
            </el-tooltip>
            <el-tooltip content="Switch theme color">
                <el-color-picker size="small" style="margin-top:20px;margin-left:-19px;float:right;"
                    v-model="themeColor" show-alpha :predefine="predefineColors" @change="logColor" />
            </el-tooltip>
        </el-menu-item>
    </el-menu>
    <router-view />
</template>

<script lang="ts">
export default {}
</script>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useDark, useToggle } from '@vueuse/core'
import { useRouter } from 'vue-router'
import emitter from './components/EventBus'
import { Key as KeyIcon } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const checked1 = ref(true)
const themeColor = ref(localStorage.getItem('themeColor') || '#5F95FF')

// Private key
const pkVisible = ref(false)
const privateKeyInput = ref(localStorage.getItem('solidity_private_key') ?? '')
const pkSaved = ref(!!localStorage.getItem('solidity_private_key'))

function savePrivateKey() {
    const key = privateKeyInput.value.trim().replace(/^0x/, '')
    if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
        ElMessage({ type: 'error', message: '私钥必须是64位十六进制字符串' })
        return
    }
    privateKeyInput.value = key
    localStorage.setItem('solidity_private_key', key)
    pkSaved.value = true
    pkVisible.value = false
    emitter.emit('set_solidity_private_key', { prikey: key })
    ElMessage({ type: 'success', message: '私钥已保存' })
}

watch(themeColor, (val) => {
    document.documentElement.style.setProperty('--el-color-primary', val)
    ;['light-3','light-5','light-7','light-8','light-9'].forEach(s => {
        document.documentElement.style.setProperty(`--el-color-primary-${s}`, val)
    })
})
document.documentElement.style.setProperty('--el-color-primary', themeColor.value)

function logColor(val: string) {
    document.documentElement.style.setProperty('--el-color-primary', val)
    themeColor.value = val
    localStorage.setItem('themeColor', val)
}

const router = useRouter()
const activeIndex = ref('1')

function toExplorer() { router.push('/explorer') }
function toFaucet() { router.push('/faucet') }
function toSolidity() { router.push('/solidity') }

const handleSelect = (key: string) => { activeIndex.value = key }

const isDark = useDark()
const tmp_toggleDark = useToggle(isDark)
function toggleDark() {
    tmp_toggleDark()
    emitter.emit('theme_changed', {})
}

function emitterOn() {
    emitter.on('change_el_menu_item', (path: string) => {
        if (path.includes('/explorer')) activeIndex.value = '1'
        else if (path.includes('/faucet')) activeIndex.value = '2'
        else if (path.includes('/solidity')) activeIndex.value = '3'
    })
}

function emitterOff() {
    emitter.off('change_el_menu_item', null)
}

onMounted(emitterOn)
onBeforeUnmount(emitterOff)

const predefineColors = ref([
    '#5F95FF','#ff8c00','#ffd700','#90ee90','#00ced1','#1e90ff','#c71585',
    'rgba(255, 69, 0, 0.68)','rgb(255, 120, 0)',
])
</script>

<style scoped>
.el-menu--horizontal>.el-menu-item:nth-child(1) {
    margin-right: auto;
}

.no-underline.is-active {
    border-bottom: 0px !important;
}
</style>

<style>
.el-color-picker__trigger { border: 0px; }
.el-color-picker .el-color-picker__icon {
    align-items: center;
    color: #ffffff;
    display: none;
    font-size: 12px;
    justify-content: center;
}
</style>
