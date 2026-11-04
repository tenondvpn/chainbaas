<template>
    <el-dialog v-model="visible" title="分片首节点配置" width="720px" :close-on-click-modal="false"
        draggable destroy-on-close>

        <!-- 顶部：配置集选择 + 新建 + 删除 + 激活状态 -->
        <div class="ns-toolbar">
            <el-select v-model="selectedId" placeholder="选择配置集" style="width:200px" size="small"
                no-data-text="尚无配置集">
                <el-option v-for="p in profiles" :key="p.id" :value="p.id"
                    :label="p.id === activeId ? `★ ${p.name}` : p.name" />
            </el-select>

            <el-button size="small" type="primary" plain @click="doAddProfile">新建配置集</el-button>

            <el-button size="small" type="danger" plain :disabled="!selectedProfile"
                @click="doRemoveProfile">删除</el-button>

            <div style="flex:1" />

            <el-tag v-if="selectedId && selectedId === activeId" type="success" effect="dark" size="small">
                当前激活
            </el-tag>
            <el-button v-if="selectedId && selectedId !== activeId" size="small" type="success"
                @click="doSetActive">激活此配置</el-button>
            <el-button v-if="selectedId && selectedId === activeId" size="small" @click="doClearActive">
                取消激活
            </el-button>
        </div>

        <!-- 配置集名称编辑 -->
        <div v-if="selectedProfile" class="ns-name-row">
            <el-input v-model="editingName" size="small" placeholder="配置集名称" style="width:240px"
                @blur="doRename" @keyup.enter="doRename" />
            <span class="ns-hint">修改后按 Enter 或点击其他地方保存</span>
        </div>

        <!-- 节点列表 -->
        <template v-if="selectedProfile">
            <el-table :data="selectedProfile.nodes" size="small" border style="width:100%;margin-top:12px">
                <el-table-column label="分片" width="68" align="center">
                    <template #default="{ $index }">
                        <el-tag size="small" effect="plain">{{ $index + 2 }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="主机 / IP" min-width="180">
                    <template #default="{ row }">
                        <el-input v-model="row.host" size="small" placeholder="192.168.1.100"
                            @change="onNodeChanged" />
                    </template>
                </el-table-column>
                <el-table-column label="端口" width="110">
                    <template #default="{ row }">
                        <el-input-number v-model="row.port" size="small" :min="1" :max="65535"
                            :controls="false" style="width:100%" @change="onNodeChanged" />
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="80" align="center">
                    <template #default="{ $index }">
                        <el-icon v-if="testStatus[$index] === 'ok'" color="#67c23a"><CircleCheck /></el-icon>
                        <el-icon v-else-if="testStatus[$index] === 'err'" color="#f56c6c"><CircleClose /></el-icon>
                        <el-icon v-else-if="testStatus[$index] === 'ing'" class="spinning" color="#409eff">
                            <Loading />
                        </el-icon>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="140" align="center">
                    <template #default="{ $index }">
                        <el-button link size="small" @click="doTestNode($index)">测试</el-button>
                        <el-button link size="small" type="danger"
                            @click="doRemoveNode($index)">删除</el-button>
                    </template>
                </el-table-column>
            </el-table>

            <div class="ns-actions">
                <el-button size="small" @click="doAddNode">
                    <el-icon><Plus /></el-icon> 添加节点
                </el-button>
                <span class="ns-hint">
                    节点行的顺序决定分片号：第 1 行 = 分片 2，第 2 行 = 分片 3，以此类推
                </span>
            </div>
        </template>

        <el-empty v-else description="请先新建或选择一个配置集" :image-size="80" />

        <template #footer>
            <el-button @click="visible = false">关闭</el-button>
        </template>
    </el-dialog>
</template>

<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, CircleCheck, CircleClose, Loading } from '@element-plus/icons-vue'
import { useNodeRegistry, type ShardNode } from '../services/nodeRegistry'
import axios from 'axios'
import qs from 'qs'

const visible = defineModel<boolean>({ default: false })

const { profiles, activeId, activeProfile, addProfile, removeProfile, renameProfile,
    setActive, clearActive, addNode, removeNode, updateNode } = useNodeRegistry()

// ── 配置集选择 ────────────────────────────────────────────────────────────────

const selectedId = ref<string>(activeId.value || (profiles.value[0]?.id ?? ''))

// 切换选择时初始化名称编辑框
watch(selectedId, (id) => {
    const p = profiles.value.find(x => x.id === id)
    editingName.value = p?.name ?? ''
    testStatus.value = []
})

// 保持同步：外部删掉后选择的 ID 可能失效
watch(profiles, (list) => {
    if (!list.find(p => p.id === selectedId.value)) {
        selectedId.value = list[0]?.id ?? ''
    }
}, { deep: true })

const selectedProfile = computed(() => profiles.value.find(p => p.id === selectedId.value) ?? null)
const editingName = ref(selectedProfile.value?.name ?? '')

// ── 操作 ─────────────────────────────────────────────────────────────────────

function doAddProfile() {
    const p = addProfile('新配置集')
    selectedId.value = p.id
    editingName.value = p.name
    testStatus.value = []
}

async function doRemoveProfile() {
    if (!selectedProfile.value) return
    try {
        await ElMessageBox.confirm(
            `确定删除配置集「${selectedProfile.value.name}」？`, '删除', { type: 'warning' }
        )
        removeProfile(selectedId.value)
    } catch {}
}

function doRename() {
    const name = editingName.value.trim()
    if (!name || !selectedId.value) return
    renameProfile(selectedId.value, name)
}

function doSetActive() {
    setActive(selectedId.value)
    ElMessage.success(`已激活「${selectedProfile.value?.name}」`)
}

function doClearActive() {
    clearActive()
    ElMessage.info('已取消激活，将使用内置 nginx 代理节点')
}

// ── 节点列表 ─────────────────────────────────────────────────────────────────

const testStatus = ref<Record<number, 'ok' | 'err' | 'ing'>>({})

function doAddNode() {
    if (!selectedId.value) return
    addNode(selectedId.value)
}

function doRemoveNode(idx: number) {
    if (!selectedId.value) return
    removeNode(selectedId.value, idx)
    const next: Record<number, 'ok' | 'err' | 'ing'> = {}
    Object.keys(testStatus.value).forEach(k => {
        const n = Number(k)
        if (n < idx) next[n] = testStatus.value[n]
        else if (n > idx) next[n - 1] = testStatus.value[n]
    })
    testStatus.value = next
}

function onNodeChanged() {
    // 修改后清空测试状态
    testStatus.value = {}
}

/** 向该节点发一个无害的 query_account 请求验证可达性 */
async function doTestNode(idx: number) {
    const node = selectedProfile.value?.nodes[idx]
    if (!node?.host || !node?.port) {
        ElMessage.warning('请先填写主机和端口')
        return
    }
    testStatus.value = { ...testStatus.value, [idx]: 'ing' }
    const url = `http://${node.host}:${node.port}/query_account`
    try {
        const resp = await axios.post(url, qs.stringify({ address: '0'.repeat(40) }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 5000,
            responseType: 'text',
        })
        // 节点返回任何文本（哪怕"not found"）都说明连通了
        const ok = resp.status >= 200 && resp.status < 500
        testStatus.value = { ...testStatus.value, [idx]: ok ? 'ok' : 'err' }
        ElMessage({ type: ok ? 'success' : 'error', message: ok ? `分片 ${idx + 2} 节点连通` : '节点无响应' })
    } catch {
        testStatus.value = { ...testStatus.value, [idx]: 'err' }
        ElMessage.error(`分片 ${idx + 2} 节点连接失败`)
    }
}
</script>

<style scoped>
.ns-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.ns-name-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
}

.ns-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 10px;
}

.ns-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

.spinning {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
