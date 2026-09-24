<template>
    <!-- Search input. Doubles as the address lookup: a bare hex string of 40+
         chars (0x optional) is looked up in the explorer's address table as a
         prefix. Shorter input just filters the tree locally. -->
    <el-popover :visible="results_visible" placement="bottom-start" :width="560" trigger="manual"
        popper-class="addr-search-popper">
        <div v-if="searching" style="padding: 4px 2px; font-size: 12px; color: #888;">Searching...</div>
        <div v-else-if="hits.length === 0" style="padding: 4px 2px; font-size: 12px; color: #888;">
            No address matched {{ normalisedQuery }}...
        </div>
        <template v-else>
            <div v-for="hit in hits" :key="hit.address" class="hit-row">
                <div class="hit-main">
                    <span class="hit-addr">{{ hit.address }}</span>
                    <el-tag :type="hit.is_contract ? 'success' : 'info'" size="small" effect="plain">
                        {{ hit.is_contract ? '合约' : addressKind(hit) }}
                    </el-tag>
                </div>
                <div class="hit-detail">
                    {{ addrHexLen(hit.address) > 40 ? `prefund (to+from, ${addrHexLen(hit.address) / 2} bytes)` : 'shard ' + hit.shard_id }}
                    <template v-if="hit.pool_index >= 0"> · pool {{ hit.pool_index }}</template>
                    · balance {{ hit.balance }} · nonce {{ hit.nonce }} · {{ hit.tx_count }} txs
                </div>
                <div class="hit-actions">
                    <el-button link type="primary" size="small" @click="useAddress(hit.address, hit.shard_id)">填入</el-button>
                    <el-button link size="small" @click="copyAddress(hit.address)">复制</el-button>
                </div>
            </div>
        </template>
        <template #reference>
            <el-input class="esponsive-input" v-model="query" :prefix-icon="Search"
                :placeholder="'搜索合约 / 账户 / prefund 地址（≥40位hex前缀）或合约名'"
                @input="onQueryChanged" @keyup.enter="onQueryEnter" @clear="results_visible = false" clearable />
        </template>
    </el-popover>

    <div :class="{ appContainerDark: isDark, appContainerLight: !isDark }" :style="`min-height: ${dynamicTreeHeight}px;`">
        <div class="tree-container" ref="treeContainerRef">
            <el-tree-v2 ref="treeRef" :data="data" :props="props" :height="treeHeight" :filter-method="filterMethod"
                :expand-on-click-node="false" @node-expand="handleNodeExpand" @node-click="handleNodeClick"
                :highlight-current="true" node-key="id">

                <template #default="{ node }">
                    <div v-if="node.data.valid" class="custom-tree-node">
                        <div v-if="node.data.is_project" style="margin-top: 0px;">
                            <el-icon v-if="!node.expanded" :size="18" style="padding:4px"
                                color="var(--el-color-primary)">
                                <Fold />
                            </el-icon>
                            <el-icon v-else :size="18" style="padding:4px" color="var(--el-color-info)">
                                <Expand />
                            </el-icon>
                            <el-link style="margin-bottom: 10px;">{{ node.label }}</el-link>
                            <!-- <h4>{{ node.label }}</h4> -->
                        </div>
                        <div v-else style="margin-top: 0px;">
                            <el-icon :size="18" style="padding:4px" color="var(--el-color-primary)">
                                <SetUp />
                            </el-icon>
                            <el-link style="margin-bottom: 10px;">{{ node.label }}</el-link>
                        </div>
                        <div v-if="node.data.is_project">
                            <span class="node-buttons">
                                <el-button-group class="ml-4">
                                    <el-tooltip v-if="node.data.id === 'chain-root'" class="box-item" effect="dark" content="新建合约">
                                        <el-button plain type="success" size="small" :icon="Plus"
                                            @click.stop="addPipelineClicked(node)" />
                                    </el-tooltip>
                                    <el-tooltip v-if="node.data.id === 'chain-root'" class="box-item" effect="dark" content="转账">
                                        <el-button plain type="warning" size="small" :icon="Promotion"
                                            @click.stop="openTransfer(node)" />
                                    </el-tooltip>
                                    <el-tooltip v-if="node.data.id === 'chain-root'" class="box-item" effect="dark" content="刷新列表">
                                        <el-button plain type="primary" size="small" :icon="Refresh"
                                            @click.stop="GetProjectsAndPipelines()" />
                                    </el-tooltip>
                                </el-button-group>
                            </span>
                        </div>
                        <div v-else>
                            <span class="node-buttons">
                                <el-button-group v-if="('' + node.data.id).startsWith('draft-')" class="ml-4">
                                    <el-tooltip class="box-item" effect="dark" content="删除草稿">
                                        <el-button plain type="danger" size="small" :icon="Delete"
                                            @click.stop="deleteDraft(node.data.id)" />
                                    </el-tooltip>
                                </el-button-group>
                            </span>
                        </div>
                    </div>
                </template>
            </el-tree-v2>
        </div>
    </div>


    <el-dialog
        v-model="centerDialogVisible"
        title="Copy Contract"
        width="500"
        destroy-on-close
        center>
        <span>
            <el-form :model="form" label-width="auto" style="max-width: 600px" :label-position="labelPosition">
                <el-form-item prop="project" label="Select Project">
                    <el-tree-select v-model="projectToCopy" :data="treeData"  check-strictly
                                node-key="id" />
                </el-form-item>
                <el-form-item label="New Contract Name">
                    <el-input v-model="pipelineNameToCopy" />
                </el-form-item>
            </el-form>
        </span>

        <template #footer>
        <div class="dialog-footer" style="margin-top: 20px">
            <el-button @click="centerDialogVisible = false">Cancel</el-button>
            <el-button type="primary" @click="callCopyPipeline">
            Confirm
            </el-button>
        </div>
        </template>
    </el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount, h, nextTick } from 'vue';
import { Plus, Edit, Delete, Search, Folder, SetUp, Fold, Expand, CopyDocument, Refresh, Promotion } from '@element-plus/icons-vue'
import type { TreeNodeData } from 'element-plus'
import { useDark } from "@vueuse/core";
import axios from 'axios';
import qs from 'qs';

import emitter from './EventBus.ts';
import { DrawerProps } from 'element-plus';
import CreateSolidity from './CreateSolidity.vue'
import CreateFolder from './CreateFolder.vue'
import UpdateFolder from './UpdateFolder.vue'
import { ElMessageBox } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useEventListener } from '@vueuse/core'
import { explorerGetContracts, explorerGetContract, deleteContractFromExplorer, explorerSearch, SHARDS } from '../services/shardora'
import { selectedShard, rememberContractShard } from '../services/shardState'

const createSolidity = ref(false)
const drawer_direction = ref<DrawerProps['direction']>('rtl')
const treeContainerRef = ref(null);
const treeHeight = ref(0);
let resizeObserver = null;
const query = ref('')
const treeRef = ref()
const project_path = ref('My Contracts')
const project_id = ref('1')
const openPipelineModelTitle = ref("Create Contract")
const pipeline_detail = ref({})
const showed_init_expand = ref(false)
const selectedPipelineValue = {
    "id": "",
    "name": "",
    "owner_id": 1,
    "ct_time": "",
    "update_time": "",
    "enable": 0,
    "type": 0,
    "email_to": "",
    "description": "",
    "sms_to": "",
    "tag": "",
    "life_cycle": "",
    "monitor_way": 0,
    "private": 1,
    "project_id": 1,
    "project_name": "",
    "principal_name_list": "",
    "principal_id_list": "",
    "is_super": true,
    "user_id": 1
}
const selectedPipeline = ref(structuredClone(selectedPipelineValue))
const selectedProject = ref({})
const createProject = ref(false)
const updateProject = ref(false)
const dynamicTreeHeight = ref(1000)
const centerDialogVisible = ref(false)
const projectToCopy = ref(-1)
const treeData = ref([
]);
const labelPosition = ref<FormProps['labelPosition']>('top')
const isDark = useDark();
const pipelineNameToCopy = ref("")
const chainContractMap = new Map<string, any>()

// ─── Address search ───────────────────────────────────────────────────────────
// Minimum prefix length before hitting the node, counted in hex characters
// (0x excluded). Stored addresses are 40 hex chars (account/contract) or 80
// (contract gas prefund); a shorter prefix can never disambiguate anything, so
// it stays a local tree filter.
const MIN_SEARCH_HEX = 40

const hits = ref<any[]>([])
const results_visible = ref(false)
const searching = ref(false)
let searchTimer: any = null

const normalisedQuery = computed(() => query.value.trim().toLowerCase().replace(/^0x/, ''))

// Stored addresses carry a 0x prefix, so an account is 42 chars and a contract
// gas-prefund address (to||from, 40 bytes) is 82.
const addrHexLen = (a: string) => (a ?? '').replace(/^0x/i, '').length
const addressKind = (hit: any) => addrHexLen(hit.address) > 40 ? 'prefund' : '账户'

const emitterOn = () => {

emitter.on('refresh_draft_list', () => {
    loadDraftsFromStorage()
})

emitter.on('refresh_contract_list', () => {
    GetProjectsAndPipelines()
})

emitter.on("success_create_pipeline", (payload) => {
    // Reload chain contracts to pick up newly deployed contract
    GetProjectsAndPipelines()
    createSolidity.value = false;
});

emitter.on('create_folder', (data) => {
    axios
        .post('/processor/add_new_project/', qs.stringify({
            'project_name': data.name,
            'description': '',
            'parent_id': data.cur_id,
            'type': 4
        })).then(response => {
            if (response.data.status != 0) {
                ElMessage({
                    type: 'error',
                    message: 'Failed to create project folder: ' + response.data.msg,
                })
            } else {
                createProject.value = false

                data["id"] = response.data.id
                data["text"] = data.name
                data["is_project"] = true
                data["pipe_id"] = 0
                var pid = data["cur_id"]
                if (pid == 0) {
                    pid = -1
                }
                if (data['type'] == 0) {
                    // Subdirectory
                    appendNode(data["selected_id"], data)
                } else {
                    // Peer directory
                    appendNode(pid, data)
                }
                ElMessage({
                    type: 'success',
                    message: 'Project folder created successfully!',
                })
            }
        })
        .catch(error => {
            ElMessage({
                type: 'error',
                message: 'Failed to create project folder: ' + error,
            })
        })
})

emitter.on('update_folder', (node_data) => {
    axios
        .post('/pipeline/update_project/', qs.stringify({
            'project_name': node_data.name,
            'description': '',
            'id': node_data.cur_id,
        })).then(response => {
            if (response.data.status != 0) {
                ElMessage({
                    type: 'error',
                    message: 'Failed to update project folder: ' + response.data.msg,
                })
            } else {
                updateProject.value = false

                const node = treeRef.value.getNode(node_data.cur_id);
                if (node) {
                    console.log("upate project name: ", node, node.label)
                    node.label = node_data.name;
                    var tmp_node = findNode(node_data.cur_id, data.value)
                    tmp_node.label = node_data.name
                    console.log("upate project name: ", node, node.label)
                    data.value = [...data.value]
                }

                ElMessage({
                    type: 'success',
                    message: 'Project folder updated successfully!',
                })
            }
        })
        .catch(error => {
            ElMessage({
                type: 'error',
                message: 'Failed to update project folder: ' + error,
            })
        })
})

emitter.on("success_update_pipeline", (payload) => {
    createSolidity.value = false;
});

emitter.on('home_view_click_create_pipeline', (_payload) => {
    addPipelineClicked(null)
});

emitter.on("graph_call_delete_pipeline", (key) => {
    // var node = findNode(key, data.value);
    const node = treeRef.value.getNode(key)
    console.log(node)
    clickDeletePipeline(node)
});

emitter.on('show_graph_called', (data) => {
    handleNodeClick({ "id": data }, null)
})

emitter.on('click_show_pipeline', (key) => {
    // For chain contracts, key is the node id (e.g. "contract-0xabc...")
    handleNodeClick({ id: key }, null)
})
}

const emitterOff = () => {
    emitter.off('refresh_draft_list', null)
    emitter.off('refresh_contract_list', null)
    emitter.off("success_create_pipeline", null);
    emitter.off('create_folder', null)
    emitter.off('update_folder', null)
    emitter.off("success_update_pipeline", null);
    emitter.off('home_view_click_create_pipeline', null);
    emitter.off("graph_call_delete_pipeline", null);
    emitter.off('show_graph_called', null)
    emitter.off('click_show_pipeline', null)
}

interface Tree {
    id: string
    label: string
    valid: boolean
    is_project: boolean
    children?: Tree[]
}

const props = {
    id: 'id',
    label: 'label',
    is_project: 'is_project',
    children: 'children',
    valid: 'valid',
}
const data = ref<Tree[]>([
])


const getProjectTree = async () => {
    await axios
        .get('/pipeline/get_project_tree/', {
            params: {
                "type": 4
            }
        })
        .then(response => {
            treeData.value = response.data
        })
        .catch(error => {
            ElMessage.error("Failed to create contract: " + error)
        })
}

const callCopyPipeline = () => {
    if (pipelineNameToCopy.value.trim() == "") {
        ElMessage({
            type: 'warning',
            message: "Please enter a new contract name",
        })
        return;
    }

    console.log("Get pipeline detail: ", pipeline_detail.value)
    axios
        .post('/pipeline/copy_pipeline/', qs.stringify({
            'project_id': projectToCopy.value,
            'pl_name': pipelineNameToCopy.value.trim(),
            'pl_id': pipeline_detail.value.id,
            'use_src_type': 1
        }))
        .then(response => {
            if (response.data.status != 0) {
                ElMessage({
                    type: 'danger',
                    message: "Failed to copy contract: " + response.data.msg,
                })
            } else {
                centerDialogVisible.value = false
                var params = {}
                params["pid"] = projectToCopy.value
                params["text"] = pipelineNameToCopy.value.trim()
                params["is_project"] = false
                params["id"] = projectToCopy.value + "-" + response.data.pl_id
                params["pipe_id"] = response.data.pl_id
                console.log("copy pipeline: ", params)
                appendNode(projectToCopy.value, params)
                ElMessage({
                    type: 'success',
                    message: "Contract copied successfully!",
                })
            }
        })
        .catch(error => {
            ElMessage({
                type: 'danger',
                message: "Failed to copy contract: " + error,
            })
        })
}

const copyPipelineClicked = (node) => {
    getProjectTree()
    centerDialogVisible.value = true
}

const callUpdateProject = (node) => {
    var path = node.label
    var parent_id = 0
    if (node.parent) {
        path = node.parent.label + "/" + path
        parent_id = node.parent.key
    }

    selectedProject.value = {
        "path": path,
        "id": node.data.id,
        "parent_id": parent_id,
    }
    updateProject.value = true
}

const deleteProject = (node) => {
    ElMessageBox({
        title: 'Delete Project Folder',
        message: h('p', null, [
            h('span', null, 'Are you sure you want to delete this project folder? Folder name: '),
            h('i', { style: 'color: red' }, node.label),
        ]),
        showCancelButton: true,
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel',
        beforeClose: (action, instance, done) => {
            if (action === 'confirm') {
                instance.confirmButtonLoading = true
                instance.confirmButtonText = 'Deleting...'
                axios
                    .post('/processor/delete_project/', qs.stringify({
                        'project_id': node.data.id,
                    }))
                    .then(response => {
                        if (response.data.status != 0) {
                            ElMessage({
                                type: 'danger',
                                message: "Failed to delete project folder: " + response.data.msg,
                            })
                        } else {
                            ElMessage({
                                type: 'success',
                                message: "Project folder deleted successfully!",
                            })
                            handleDelete(node)
                        }

                        done()
                        instance.confirmButtonLoading = false
                    })
                    .catch(error => {
                        ElMessage({
                            type: 'danger',
                            message: "Failed to delete project folder: " + error,
                        })
                    })
            } else {
                done()
            }
        },
    }).then((action) => {
    })
}

const callCreateProject = (node) => {
    var path = node.label
    var parent_id = 0
    if (node.parent) {
        path = node.parent.label + "/" + path
        parent_id = node.parent.key
    }

    selectedProject.value = {
        "path": path,
        "id": node.data.id,
        "parent_id": parent_id,
    }
    createProject.value = true
}

const handleNodeExpand = (nodeData, nodeInstance) => {
    // Chain nodes are loaded eagerly; nothing to lazy-load
    const str_id = "" + nodeData.id
    if (str_id === 'chain-root' || str_id.startsWith('contract-')) return
}

const addPipelineClicked = (nodeData) => {
    // Open blank editor for a new contract (deploy goes directly to chain)
    emitter.emit('update_graph', {
        tag: '0',
        project_id: 'chain-root',
        project_path: '/链上合约',
        data: { is_project: 0, pipe_id: 0, pipe_usr_graph: '' },
    })
    emitter.emit('show_update_graph', { tag: '1', project_path: '/链上合约', pipe_id: '' })
}

const handleDelete = (node) => {
    var parentNode = null;
    if (node.parent) {
        console.log("now delete node: ", node.parent.key)
        parentNode = findNode(node.parent.key, data.value)
    }

    if (parentNode) {
        // 从父节点的 children 数组中移除该节点
        // Remove the node from the parent's children array
        const index = parentNode.children.findIndex(child => child.id === node.key);
        console.log("found parent now delete node: ", index)
        if (index !== -1) {
            parentNode.children.splice(index, 1);
        }
    } else {
        // 如果没有父节点，说明是根节点
        // If there is no parent, it is a root node
        // Logic for deleting a root node
        const index = data.value.findIndex(item => item.id === node.key);
        console.log("not found parent now delete node: ", index)
        if (index !== -1) {
            data.value.splice(index, 1);
        }
    }

    data.value = [...data.value]
    console.log("delete key: ", node.key)
    var node_key = "" + node.key
    if (node_key.split('-').length == 2) {
        emitter.emit('success_delete_pipeline', node_key)
    }
};

const clickDeletePipeline = (nodeData) => {
    ElMessageBox({
        title: 'Delete Contract',
        message: h('p', null, [
            h('span', null, 'Are you sure you want to delete this contract? Contract name: '),
            h('i', { style: 'color: red' }, nodeData.label),
        ]),
        showCancelButton: true,
        confirmButtonText: 'Confirm',
        cancelButtonText: 'Cancel',
        beforeClose: (action, instance, done) => {
            if (action === 'confirm') {
                instance.confirmButtonLoading = true
                instance.confirmButtonText = 'Deleting...'
                // Node keys are `contract-<shard>-<addr>`; a plain prefix strip
                // would leave the shard in the address and delete on shard 3.
                const keyParts = ('' + nodeData.key).split('-')
                const contractShard = Number(keyParts[1])
                const contractAddr = keyParts.slice(2).join('-')
                deleteContractFromExplorer(contractShard, contractAddr)
                    .then(result => {
                        if (!result.ok) {
                            done()
                            ElMessage({ type: 'danger', message: "Failed to delete contract: " + result.msg })
                            return
                        }
                        console.log('success delete contract.')
                        handleDelete(nodeData)
                        done()
                        instance.confirmButtonLoading = false
                    })
                    .catch(error => {
                        done()
                        ElMessage({
                            type: 'danger',
                            message: "Failed to delete contract: " + error,
                        })
                    })
            } else {
                done()
            }
        },
    }).then((action) => {
        ElMessage({
            type: 'success',
            message: "Contract deleted successfully!",
        })
    })
}

const handleNodeClick = async (nodeData, nodeInstance) => {
    const str_id = "" + nodeData.id;
    project_id.value = str_id

    // Root folder node
    if (str_id === 'chain-root') {
        project_path.value = '/链上合约'
        emitter.emit('update_graph', { tag: '-1', project_path: project_path.value, project_id: str_id })
        emitter.emit('show_update_graph', { tag: '-1', project_path: project_path.value, project_id: str_id })
        return
    }

    // Local draft node
    if (str_id.startsWith('draft-')) {
        const name = str_id.replace(/^draft-/, '')
        try {
            const stored = localStorage.getItem(`solidity_draft_${name}`)
            if (stored) {
                const draft = JSON.parse(stored)
                emitter.emit('show_update_graph', { tag: '1', project_path: '/本地草稿', pipe_id: str_id })
                emitter.emit('update_graph', {
                    tag: '0',
                    project_id: 'drafts-root',
                    project_path: '/本地草稿',
                    data: { is_project: 0, pipe_id: 0, pipe_usr_graph: JSON.stringify({ code: draft.code, address: '', abi: '[]' }) },
                })
            }
        } catch (e) { console.error('Failed to load draft:', e) }
        return
    }

    // Chain contract leaf node
    if (str_id.startsWith('contract-')) {
        let contract = chainContractMap.get(str_id)
        // The list is merged across shards, so every operation on a contract has
        // to use the shard it came from. Recording it here is what keeps call and
        // query pointed at the right one after a cross-shard click — the shard is
        // a property of the contract, not of whichever account happens to sign.
        const contractShard = Number(contract?.shard_id ?? selectedShard.value)
        if (contract?.addr) rememberContractShard(contract.addr, contractShard)
        // Fetch full detail if source_code not yet loaded
        if (contract && !contract._detail_loaded) {
            try {
                const detail = await explorerGetContract(contractShard, contract.addr)
                if (detail) {
                    Object.assign(contract, detail)
                    contract._detail_loaded = true
                }
            } catch (e) { /* use cached data */ }
        }
        if (!contract) return
        const graphPayload = JSON.stringify({
            code: contract.source_code ?? '',
            address: contract.addr ?? '',
            abi: contract.abi ?? '[]',
            // Carried through so the editor can re-verify the contract against the
            // shard it actually lives on rather than whatever is selected later.
            shard: contractShard,
        })
        emitter.emit('show_update_graph', { tag: '1', project_path: '/链上合约', pipe_id: str_id })
        emitter.emit('update_graph', {
            tag: '0',
            project_id: 'chain-root',
            project_path: '/链上合约',
            data: { is_project: 0, pipe_id: 0, pipe_usr_graph: graphPayload },
        })
        return
    }
}

const GetProjectsAndPipelines = async () => {
    chainContractMap.clear()
    data.value = []
    const rootId = 'chain-root'
    appendNode(-1, { id: rootId, text: '链上合约', is_project: true, pipe_id: 0 }, false)

    // One request per shard, merged into a single list. allSettled rather than
    // all: a shard that is unreachable should cost its own contracts and nothing
    // else, where Promise.all would reject the whole load on one bad shard.
    const perShard = await Promise.allSettled(
        SHARDS.map(async (s) => {
            const resp = await explorerGetContracts(s, { limit: 100 })
            const items: any[] = Array.isArray(resp?.data) ? resp.data
                : Array.isArray(resp?.items) ? resp.items
                : Array.isArray(resp?.data?.items) ? resp.data.items
                : []
            return items.map(c => ({ ...c, shard_id: c.shard_id ?? s }))
        })
    )

    for (const outcome of perShard) {
        if (outcome.status !== 'fulfilled') {
            console.warn('Failed to load contracts from a shard:', outcome.reason)
            continue
        }
        for (const contract of outcome.value) {
            const addr: string = contract.addr ?? ''
            const shard = Number(contract.shard_id)
            // Node id is shard-qualified: the same address can exist on several
            // shards, and a bare `contract-${addr}` would make the later shard
            // silently overwrite the earlier node's map entry.
            const nodeId = `contract-${shard}-${addr}`
            const srcName = contract.source_code
                ? (contract.source_code.match(/contract\s+(\w+)/)?.[1] ?? '')
                : ''
            const shortAddr = addr.length > 12
                ? addr.slice(0, 6) + '...' + addr.slice(-4)
                : (addr || '?')
            // The shard is part of the label so two same-named contracts from
            // different shards are distinguishable in the tree.
            const label = (srcName ? `${srcName} (${shortAddr})` : shortAddr) + ` · S${shard}`
            chainContractMap.set(nodeId, contract)
            appendNode(rootId, { id: nodeId, text: label, is_project: false, pipe_id: 0 }, false)
        }
    }

    treeRef.value?.expandNode(treeRef.value.getNode(rootId))
    loadDraftsFromStorage()
}

const loadDraftsFromStorage = () => {
    const existingDraftsIdx = data.value.findIndex(n => n.id === 'drafts-root')
    if (existingDraftsIdx !== -1) data.value.splice(existingDraftsIdx, 1)

    const draftsRootId = 'drafts-root'
    appendNode(-1, { id: draftsRootId, text: '本地草稿', is_project: true, pipe_id: 0 }, false)

    const draftKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('solidity_draft_')) draftKeys.push(key)
    }
    const drafts = draftKeys
        .map(k => { try { return JSON.parse(localStorage.getItem(k)!) } catch { return null } })
        .filter(Boolean)
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))

    for (const draft of drafts) {
        appendNode(draftsRootId, {
            id: `draft-${draft.name}`,
            text: draft.name,
            is_project: false,
            pipe_id: 0,
        }, false)
    }

    nextTick(() => treeRef.value?.expandNode(treeRef.value.getNode(draftsRootId)))
}

const deleteDraft = (nodeId: string) => {
    const name = nodeId.replace(/^draft-/, '')
    localStorage.removeItem(`solidity_draft_${name}`)
    loadDraftsFromStorage()
}

useEventListener(window, 'resize', () => {
    dynamicTreeHeight.value = window.innerHeight - 130
})

// Dismiss the search result popover on any click outside it.
useEventListener(window, 'click', (ev: MouseEvent) => {
    if (!results_visible.value) return
    const el = ev.target as HTMLElement | null
    if (el && (el.closest('.addr-search-popper') || el.closest('.esponsive-input'))) return
    results_visible.value = false
})

onMounted(() => {
    dynamicTreeHeight.value = window.innerHeight - 130
    emitterOn()
    if (treeContainerRef.value) {
        treeHeight.value = treeContainerRef.value.clientHeight;
    }

    resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.target === treeContainerRef.value) {
                treeHeight.value = entry.contentRect.height;
            }
        }
    });

    if (treeContainerRef.value) {
        resizeObserver.observe(treeContainerRef.value);
    }

    GetProjectsAndPipelines();
});

onBeforeUnmount(() => {
    emitterOff()
    if (resizeObserver && treeContainerRef.value) {
        resizeObserver.unobserve(treeContainerRef.value);
    }
});


const onQueryChanged = (value: string) => {
    treeRef.value!.filter(value)

    // Below the threshold the input is only a tree filter, not an address lookup.
    if (normalisedQuery.value.length < MIN_SEARCH_HEX) {
        results_visible.value = false
        hits.value = []
        return
    }

    if (searchTimer) clearTimeout(searchTimer)
    searching.value = true
    results_visible.value = true
    searchTimer = setTimeout(runSearch, 250)
}

const runSearch = async () => {
    hits.value = await explorerSearch(normalisedQuery.value, 50)
    searching.value = false
}

// Enter with a full 40-hex prefix that matches exactly one contract jumps to it.
const onQueryEnter = async () => {
    if (normalisedQuery.value.length < MIN_SEARCH_HEX) return
    if (searchTimer) clearTimeout(searchTimer)
    await runSearch()
    const exact = hits.value.find(h => h.exact)
    if (exact) useAddress(exact.address, exact.shard_id)
}

const filterMethod = (query: string, node: TreeNodeData) =>
    (node.label ?? '').toLowerCase().includes(query.toLowerCase()) ||
    ('' + node.id).toLowerCase().includes(query.toLowerCase())

const copyAddress = async (addr: string) => {
    try {
        await navigator.clipboard.writeText(addr)
        ElMessage({ type: 'success', message: '已复制地址' })
    } catch (e) {
        ElMessage({ type: 'error', message: '复制失败: ' + e })
    }
}

// Jump to a contract node if the address is in the loaded list, otherwise copy.
// Node ids are `contract-<shard>-<addr>`, and the contracts table's addr may or
// may not carry a 0x prefix, so match on the hex body rather than the raw string.
// `shard` is supplied by search hits, which know which shard matched; without it
// the first shard holding that address wins.
const useAddress = (addr: string, shard?: number) => {
    const want = addr.toLowerCase().replace(/^0x/, '')
    const node = (data.value as any[]).find(n => {
        if (!('' + n.id).startsWith('contract-')) return false
        const parts = ('' + n.id).split('-')
        const nodeAddr = (parts[2] ?? '').toLowerCase().replace(/^0x/, '')
        if (nodeAddr !== want) return false
        return shard === undefined || Number(parts[1]) === shard
    })
    if (node) {
        treeRef.value?.setCurrentKey(node.id)
        handleNodeClick({ id: node.id }, null)
    } else {
        copyAddress(addr)
    }
    results_visible.value = false
}

// The transfer form itself lives in SolidityTransfer.vue, rendered in place of
// the code editor so the status box underneath stays visible. Only the key is
// checked here, so the click fails fast before the pane switches.
const openTransfer = () => {
    const pk = localStorage.getItem('solidity_private_key') ?? ''
    if (!pk || pk.length !== 64) {
        ElMessage({ type: 'error', message: '请先在右上角设置私钥' })
        return
    }
    emitter.emit('open_transfer', { open: true })
}

const findNode = (id, nodes) => {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (("" + node.id) === ("" + id)) {
            return node
        }
        if (node.children) {
            const found = findNode(id, node.children)
            if (found) {
                return found
            }
        }
    }
    return null
}

// 新增节点的方法
const appendNode = (parentId, item, autoSelect = true) => {
    if (item == null) {
        return;
    }

    var project_name = item["text"];
    if (project_name == "My Project") {
        project_name = "My Contracts"
    }

    const newChild = {
        id: item["id"],
        label: project_name,
        is_project: item["is_project"],
        children: [],
        valid: true,
        pipe_id: item["pipe_id"],
    }

    if (item["is_project"]) {
        newChild.children.push({
            id: -1,
            valid: false,
            label: "",
            is_project: false,
            children: [],
        })
    }

    var parentNode = null;
    if (parentId == -1) {
        data.value.push(newChild)
        data.value = [...data.value]
    } else {
        parentNode = findNode(parentId, data.value)
        if (parentNode) {
            if (!parentNode.children) {
                parentNode.children = []
            }

            if (parentNode.children.length == 1 && parentNode.children[0].id == -1) {
                parentNode.children = []
            }

            parentNode.children.push(newChild)
            data.value = [...data.value]
            if (autoSelect) {
                treeRef.value.setCurrentKey(newChild.id);
            }
        }
    }

    if (autoSelect) {
        emitter.emit('update_graph', { "tag": "0", 'project_id': parentId, "project_path": project_path.value, "data": newChild });
    }
}

</script>

<style>
.appContainerDark {
    height: 500px;
    /* Assuming a parent container height */
    padding: 20px;
    border: 1px solid #4c4d4f;
}

.appContainerLight {
    height: 500px;
    /* Assuming a parent container height */
    padding: 20px;
    border: 1px solid #dddfe6;
}

.tree-container {
    width: 100%;
    height: 100%;
}

.prefix {
    color: var(--el-color-primary);
    margin-right: 10px;
}

.prefix.is-leaf {
    color: var(--el-color-success);
}

.custom-tree-node {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    padding-right: 8px;
}

.node-buttons {
    /* Buttons are hidden by default */
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
}

/* Key: Show buttons when hovering over the entire node container */
.custom-tree-node:hover .node-buttons {
    opacity: 1;
}

/* The template spells this class "esponsive-input" (typo, pre-existing) —
   .responsive-input alone never matched anything. */
.esponsive-input,
.responsive-input {
    width: 240px;
}
</style>

<style>
/* The popover body is teleported outside this component, so it needs global
   rules rather than scoped ones. */
.addr-search-popper .hit-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 6px 4px;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

.addr-search-popper .hit-row:last-child {
    border-bottom: none;
}

.addr-search-popper .hit-main {
    flex: 1 1 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

.addr-search-popper .hit-addr {
    font-family: monospace;
    font-size: 12px;
    word-break: break-all;
}

.addr-search-popper .hit-detail {
    flex: 1 1 auto;
    font-size: 11px;
    color: #888;
    word-break: break-all;
}

.addr-search-popper .hit-actions {
    flex: 0 0 auto;
}


@media (max-width: 768px) {
    .input-container {
        flex-direction: column;
        gap: 1rem;
    }

    .esponsive-input,
    .responsive-input {
        width: 100%;
    }
}
</style>