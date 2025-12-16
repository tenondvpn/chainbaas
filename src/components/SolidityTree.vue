<template>
    <el-input class="esponsive-input" v-model="query" placeholder="Please enter keyword" @input="onQueryChanged"
        :prefix-icon="Search" />

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
                                    <el-tooltip class="box-item" effect="dark" content="点击新建文件夹！">
                                        <el-button plain type="info" size="small" :icon="Folder"
                                            @click="callCreateProject(node)" />
                                    </el-tooltip>
                                    <el-tooltip class="box-item" effect="dark" content="点击新建合约！">
                                        <el-button plain type="success" size="small" :icon="Plus"
                                            @click="addPipelineClicked(node)" />
                                    </el-tooltip>
                                    <el-tooltip v-if="node.label != '我的合约'" class="box-item" effect="dark"
                                        content="编辑分类">
                                        <el-button plain type="primary" size="small" :icon="Edit"
                                            @click="callUpdateProject(node)" />
                                    </el-tooltip>
                                    <el-tooltip v-if="node.label != '我的合约'" class="box-item" effect="dark"
                                        content="删除分类">
                                        <el-button plain type="warning" size="small" :icon="Delete"
                                            @click="deleteProject(node)" />
                                    </el-tooltip>
                                </el-button-group>
                            </span>
                        </div>
                        <div v-else>
                            <span class="node-buttons">
                                <el-button-group class="ml-4">
                                    <el-tooltip class="box-item" effect="dark" content="点击编辑合约信息！">
                                        <el-button plain type="primary" @click="addPipelineClicked(node)" size="small"
                                            :icon="Edit" />
                                    </el-tooltip>
                                    <el-tooltip class="box-item" effect="dark" content="点击删除合约！">
                                        <el-button plain type="warning" size="small" :icon="Delete"
                                            @click="clickDeletePipeline(node)" />
                                    </el-tooltip>
                                    <el-tooltip class="box-item" effect="dark" content="点击拷贝合约">
                                        <el-button plain type="primary" @click="copyPipelineClicked(node)" size="small"
                                            :icon="CopyDocument" />
                                    </el-tooltip>
                                </el-button-group>
                            </span>
                        </div>
                    </div>
                </template>
            </el-tree-v2>
        </div>
    </div>

    <el-drawer v-model="createSolidity" :direction="drawer_direction" size="50%" :destroy-on-close="true">
        <template #header>
            <h4>{{ openPipelineModelTitle }}</h4>
        </template>
        <template #default>
            <CreateSolidity :pipeline_info="selectedPipeline" />
        </template>
    </el-drawer>

    <el-drawer v-model="createProject" :direction="drawer_direction" size="50%" :destroy-on-close="true">
        <template #header>
            <h4>创建项目文件夹</h4>
        </template>
        <template #default>
            <CreateFolder :current_folder_info="selectedProject" />
        </template>
    </el-drawer>

    <el-drawer v-model="updateProject" :direction="drawer_direction" size="50%" :destroy-on-close="true">
        <template #header>
            <h4>修改项目文件夹</h4>
        </template>
        <template #default>
            <UpdateFolder :current_folder_info="selectedProject" />
        </template>
    </el-drawer>

    <el-dialog
        v-model="centerDialogVisible"
        title="拷贝合约"
        width="500"
        destroy-on-close
        center>
        <span>
            <el-form :model="form" label-width="auto" style="max-width: 600px" :label-position="labelPosition">
                <el-form-item prop="project" label="选择项目">
                    <el-tree-select v-model="projectToCopy" :data="treeData"  check-strictly
                                node-key="id" />
                </el-form-item>
                <el-form-item label="新合约名">
                    <el-input v-model="pipelineNameToCopy" />
                </el-form-item>
            </el-form>
        </span>

        <template #footer>
        <div class="dialog-footer" style="margin-top: 20px">
            <el-button @click="centerDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="callCopyPipeline">
            确认
            </el-button>
        </div>
        </template>
    </el-dialog>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, h } from 'vue';
import { Plus, Edit, Delete, Search, Folder, SetUp, Fold, Expand, CopyDocument } from '@element-plus/icons-vue'
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

const createSolidity = ref(false)
const drawer_direction = ref<DrawerProps['direction']>('rtl')
const treeContainerRef = ref(null);
const treeHeight = ref(0);
let resizeObserver = null;
const query = ref('')
const treeRef = ref()
const project_path = ref('我的合约')
const project_id = ref('1')
const openPipelineModelTitle = ref("创建合约")
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

const emitterOn = () => {

emitter.on("success_create_pipeline", (payload) => {
    appendNode(payload["pid"], payload)
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
                    message: '创建项目文件夹失败：' + response.data.msg,
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
                    // 子目录
                    appendNode(data["selected_id"], data)
                } else {
                    // 平级目录
                    appendNode(pid, data)
                }
                ElMessage({
                    type: 'success',
                    message: '创建项目文件夹成功！',
                })
            }
        })
        .catch(error => {
            ElMessage({
                type: 'error',
                message: '创建项目文件夹失败：' + error,
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
                    message: '修改项目文件夹失败：' + response.data.msg,
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
                    message: '修改项目文件夹成功！',
                })
            }
        })
        .catch(error => {
            ElMessage({
                type: 'error',
                message: '修改项目文件夹失败：' + error,
            })
        })
})

emitter.on("success_update_pipeline", (payload) => {
    createSolidity.value = false;
});

emitter.on('home_view_click_create_pipeline', (payload) => {
    selectedPipeline.value = structuredClone(selectedPipelineValue)
    selectedPipeline.value.project_id = payload
    createSolidity.value = true;
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
    openPipelineModelTitle.value = "修改合约"
    axios
        .post('/pipeline/get_pipeline_detail/', qs.stringify({
            'pipe_id': key.split("-")[1],
        }))
        .then(response => {
            selectedPipeline.value = response.data
            if (response.data.email_to != "") {
                selectedPipeline.value.monitor_way |= 1
            }

            if (response.data.sms_to != "") {
                selectedPipeline.value.monitor_way |= 2
            }

            const str_id = "" + key;

            console.log(str_id, key, str_id.split("-").length)
            project_id.value = str_id
            createSolidity.value = true;
        })
        .catch(error => {
            console.log(error)
            emitter.emit('update_graph', "-1");
        })
})
}

const emitterOff = () => {
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
            ElMessage.error("创建合约失败: " + error)
        })
}

const callCopyPipeline = () => {
    if (pipelineNameToCopy.value.trim() == "") {
        ElMessage({
            type: 'warning',
            message: "请输入新的合约名",
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
                    message: "拷贝合约失败：" + response.data.msg,
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
                    message: "拷贝合约成功！",
                })
            }
        })
        .catch(error => {
            ElMessage({
                type: 'danger',
                message: "拷贝合约失败：" + error,
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
        title: '删除项目文件夹',
        message: h('p', null, [
            h('span', null, '确定要删除项目文件夹吗? 项目文件夹名： '),
            h('i', { style: 'color: red' }, node.label),
        ]),
        showCancelButton: true,
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        beforeClose: (action, instance, done) => {
            if (action === 'confirm') {
                instance.confirmButtonLoading = true
                instance.confirmButtonText = '正在删除...'
                axios
                    .post('/processor/delete_project/', qs.stringify({
                        'project_id': node.data.id,
                    }))
                    .then(response => {
                        if (response.data.status != 0) {
                            ElMessage({
                                type: 'danger',
                                message: "项目文件夹删除失败：" + response.data.msg,
                            })
                        } else {
                            ElMessage({
                                type: 'success',
                                message: "项目文件夹删除成功！",
                            })
                            handleDelete(node)
                        }

                        done()
                        instance.confirmButtonLoading = false
                    })
                    .catch(error => {
                        ElMessage({
                            type: 'danger',
                            message: "项目文件夹删除失败：" + error,
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
    axios
        .get('/pipeline/get_project_tree_async/', {
            params: {
                "id": nodeData.id,
                "type": 4
            }
        })
        .then(response => {
            var parentNode = findNode(nodeData.id, data.value)
            if (parentNode) {
                parentNode.children = []
            }

            // var json_obj = JSON.parse(response)
            for (const item of response.data) {
                appendNode(nodeData.id, item);
            }

        })
        .catch(error => console.log(error))
}

const addPipelineClicked = (nodeData) => {
    openPipelineModelTitle.value = "创建合约"
    selectedPipeline.value = structuredClone(selectedPipelineValue);
    console.log("ttttt:", nodeData.key)
    var str_key = "" + nodeData.key
    if (str_key.split("-").length != 2) {
        selectedPipeline.value.project_id = nodeData.key
        createSolidity.value = true;
        project_path.value = nodeData.label
        var parent_node = nodeData.parent
        while (parent_node) {
            project_path.value = parent_node.label + "/" + project_path.value
            parent_node = parent_node.parent
        }

        console.log(project_path.value)
        return;
    }

    openPipelineModelTitle.value = "修改合约"
    axios
        .post('/pipeline/get_pipeline_detail/', qs.stringify({
            'pipe_id': nodeData.key.split("-")[1],
        }))
        .then(response => {
            selectedPipeline.value = response.data
            if (response.data.email_to != "") {
                selectedPipeline.value.monitor_way |= 1
            }

            if (response.data.sms_to != "") {
                selectedPipeline.value.monitor_way |= 2
            }

            createSolidity.value = true;
            const str_id = "" + nodeData.key;

            console.log(str_id, nodeData, str_id.split("-").length)
            project_id.value = str_id
        })
        .catch(error => {
            console.log(error)
            emitter.emit('update_graph', "-1");
        })

}

const handleDelete = (node) => {
    var parentNode = null;
    if (node.parent) {
        console.log("now delete node: ", node.parent.key)
        parentNode = findNode(node.parent.key, data.value)
    }

    if (parentNode) {
        // 从父节点的 children 数组中移除该节点
        const index = parentNode.children.findIndex(child => child.id === node.key);
        console.log("found parent now delete node: ", index)
        if (index !== -1) {
            parentNode.children.splice(index, 1);
        }
    } else {
        // 如果没有父节点，说明是根节点
        // 根节点的删除逻辑
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
        title: '删除合约',
        message: h('p', null, [
            h('span', null, '确定要删除合约吗? 合约名： '),
            h('i', { style: 'color: red' }, nodeData.label),
        ]),
        showCancelButton: true,
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        beforeClose: (action, instance, done) => {
            if (action === 'confirm') {
                instance.confirmButtonLoading = true
                instance.confirmButtonText = '正在删除...'
                ''
                axios
                    .post('/pipeline/delete/' + nodeData.key.split('-')[1] + '/', {
                    })
                    .then(response => {
                        console.log('success delete pipeline.')
                        handleDelete(nodeData)
                        done()
                        instance.confirmButtonLoading = false
                    })
                    .catch(error => {
                        done()
                        ElMessage({
                            type: 'danger',
                            message: "合约删除失败：" + error,
                        })
                    })
            } else {
                done()
            }
        },
    }).then((action) => {
        ElMessage({
            type: 'success',
            message: "合约删除成功！",
        })
    })
}

const handleNodeClick = (nodeData, nodeInstance) => {
    const str_id = "" + nodeData.id;
    selectedPipeline.value = structuredClone(selectedPipelineValue)
    console.log(str_id, str_id.split("-")[1], str_id.split("-").length)
    project_id.value = str_id
    if (str_id.split("-").length != 2) {
        project_path.value = "/" + nodeData.label
        var parent_node = nodeInstance.parent
        while (parent_node) {
            project_path.value = "/" + parent_node.label + project_path.value
            parent_node = parent_node.parent
        }

        emitter.emit('update_graph', { "tag": "-1", "project_path": project_path.value, 'project_id': ""+ nodeData.id });
        emitter.emit('show_update_graph', { "tag": "-1", "project_path": project_path.value, 'project_id': ""+nodeData.id });
        console.log('update_graph node click 0', project_path.value, 'project_id', nodeData.id)
        return;
    }

    axios
        .post('/pipeline/get_pipeline_detail/', qs.stringify({
            'pipe_id': nodeData.id.split("-")[1],
        }))
        .then(response => {
            selectedPipeline.value = response.data
            if (response.data.email_to != "") {
                selectedPipeline.value.monitor_way |= 1
            }

            if (response.data.sms_to != "") {
                selectedPipeline.value.monitor_way |= 2
            }

            console.log('get pipeline detail:', response.data)
            console.log("11111:", str_id, str_id.split("-")[1], str_id.split("-").length)
            pipeline_detail.value = response.data
            projectToCopy.value = pipeline_detail.value.project_id
            var pipline_data = response.data
            axios
                .post('/pipeline/get_tasks/', qs.stringify({
                    'pipeline_id': str_id.split("-")[1],
                }))
                .then(response => {
                    // 正确: 载荷类型与定义匹配
                    emitter.emit('show_update_graph', { "tag": "1", "project_path": project_path.value, "pipe_id": str_id });
                    response.data['project_id'] = str_id.split("-")[0]
                    response.data['pipeline_detail'] = pipline_data
                    emitter.emit('update_graph', { "tag": "0", 'project_id': str_id.split("-")[0], "project_path": project_path.value, "data": response.data });
                    console.log('update_graph get tasks 1', project_path.value, response.data, 'project_id', str_id.split("-")[0])
                })
                .catch(error => {
                    console.log(error)
                    emitter.emit('update_graph', { "tag": "-1", 'project_id': str_id.split("-")[0], "project_path": project_path.value });
                    emitter.emit('show_update_graph', { "tag": "-1", "project_path": project_path.value, 'project_id': str_id.split("-")[0] });
                    console.log('update_graph get tasks error 2', project_path.value, 'project_id', str_id.split("-")[0])
                })
        })
        .catch(error => {
            console.log(error)
            emitter.emit('update_graph', "-1");
        })
}

const GetProjectsAndPipelines = async () => {
    // axios.interceptors.request.use(config => {
    //     const token = localStorage.getItem('access_token')
    //     if (token) {
    //         config.headers.Authorization = `Bearer ${token}`
    //     }
    //     return config
    // })
    await axios
        .get('/pipeline/get_project_tree_async/', {
            params: {
                "type": 4
            }
        })
        .then(response => {
            console.log("0 get_project_tree_async:", response)
            // var json_obj = JSON.parse(response)
            for (const item of response.data) {
                appendNode(-1, item);
                if (item.is_project && projectToCopy.value == -1) {
                    projectToCopy.value = item.id
                }
            }

            console.log('treeRef.value.getNode():', projectToCopy.value, treeRef.value.getNode(projectToCopy.value))
            handleNodeExpand({ "id": projectToCopy.value }, null)

        })
        .catch(error => console.log(error))

        treeRef.value.expandNode(treeRef.value.getNode(projectToCopy.value))
}

useEventListener(window, 'resize', () => {
    dynamicTreeHeight.value = window.innerHeight - 130
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


const onQueryChanged = (query: string) => {
    treeRef.value!.filter(query)
}
const filterMethod = (query: string, node: TreeNodeData) =>
    node.label!.includes(query)

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
const appendNode = (parentId, item) => {
    if (item == null) {
        return;
    }

    var project_name = item["text"];
    if (project_name == "我的项目") {
        project_name = "我的合约"
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
            treeRef.value.setCurrentKey(newChild.id);
        }
    }

    emitter.emit('update_graph', { "tag": "0", 'project_id': parentId, "project_path": project_path.value, "data": newChild });
}

</script>

<style>
.appContainerDark {
    height: 500px;
    /* 假设一个父容器的高度 */
    padding: 20px;
    border: 1px solid #4c4d4f;
}

.appContainerLight {
    height: 500px;
    /* 假设一个父容器的高度 */
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
    /* 默认隐藏按钮 */
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
}

/* 关键：当鼠标悬停在整个节点容器上时，显示按钮 */
.custom-tree-node:hover .node-buttons {
    opacity: 1;
}

.responsive-input {
    width: 240px;
}

@media (max-width: 768px) {
    .input-container {
        flex-direction: column;
        gap: 1rem;
    }

    .responsive-input {
        width: 100%;
    }
}
</style>