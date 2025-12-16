<template>
    <el-form ref="ruleFormRef" style="max-width: 750px;margin-left: 40px;" :model="ruleForm" :rules="rules" label-width="auto"
        label-position="left">
        <el-form-item prop="project" label="选择项目" required>
            <el-tree-select v-model="ruleForm.project" lazy :load="load" :props="processor_props" check-strictly
                :render-after-expand="false" style="width: 100%" />
        </el-form-item>
        <el-form-item prop="type" label="模板任务类型" required>
            <el-select v-model="processorType" value-key="id" placeholder="Select" style="width: 100%">
                <el-option v-for="item in type_options" :key="item.id" :label="item.label" :value="item.id" />
            </el-select>
        </el-form-item>

        <el-form-item label="模板任务名称" prop="name">
            <el-input v-model="ruleForm.name" />
        </el-form-item>
        <el-form-item label="负责人:" prop="users" style="margin-top: 17px">
            <el-select v-model="selectedUsers" multiple clearable filterable placeholder="Select">
                <el-option v-for="item in userOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
        </el-form-item>
        <el-form-item label="模板任务描述" prop="desc" required>
            <el-input v-model="ruleForm.desc" type="textarea" placeholder="请输入模板任务描述信息！" />
        </el-form-item>
        <el-form-item v-if="processorType === TaskTypes.TYPE_SHELL" label="shell命令" prop="shell" required>
            <el-input v-model="ruleForm.shell" type="textarea" :rows="6" placeholder="输入shell命令，可以多行！" />
        </el-form-item>

        <el-form-item v-if="processorType === TaskTypes.TYPE_CLICKHOUSE" label="ck-sql命令" prop="shell" required>
            <el-input v-model="ruleForm.shell" type="textarea" :rows="6" placeholder="输入clickhouse的SQL命令，可以多行！" />
        </el-form-item>

        <el-form-item v-if="processorType === TaskTypes.TYPE_ODPS" label="odps-sql命令" prop="shell" required>
            <el-input v-model="ruleForm.shell" type="textarea" :rows="6" placeholder="输入odps的SQL命令，可以多行！" />
        </el-form-item>
        <el-form-item label="模板任务标签" prop="tags" required>
            <el-input-tag v-model="ruleForm.tags" tag-type="primary" :max="3" placeholder="最多设置三个标签">
                <template #tag="{ value }">
                    <div class="flex items-center">
                        <el-icon class="mr-1">
                            <ElementPlus />
                        </el-icon>
                        <span>{{ value }}</span>
                    </div>
                </template>
            </el-input-tag>
        </el-form-item>
        <el-divider border-style="dashed" />

        <el-form-item label="模板任务参数" prop="configs">
            <CreateNodeConfig ref="config_vue" :show_description="true" />
        </el-form-item>
        <el-divider border-style="dashed" />
        <el-form-item>
            <el-button v-if="update_processor" type="primary" @click="submitForm(ruleFormRef)" :icon="Edit">
                修改模板任务
            </el-button>
            <el-button v-else type="primary" @click="submitForm(ruleFormRef)">
                创建模板任务
            </el-button>
            <el-popconfirm confirm-button-text="确定" cancel-button-text="取消" :icon="InfoFilled" icon-color="#626AEF"
                title="确定删除模板任务吗?" @confirm="DeleteProcessor" @cancel="cancelEvent">
                <template #reference>
                    <el-button v-if="update_processor" style="margin-left: 10px;" type="warning"
                        :icon="Delete">删除模板任务</el-button>
                </template>
            </el-popconfirm>

            <el-button @click="resetForm(ruleFormRef)" :icon="RefreshLeft">重置参数</el-button>
        </el-form-item>
    </el-form>
</template>

<script lang="ts">
import CreateNodeConfig from './CreateNodeConfig.vue';
import CreateNodePrevTasks from './CreateNodePrevTasks.vue';
import ChoosePowerNodes from './ChoosePowerNodes.vue';
import { ElMessage } from 'element-plus';
import emitter from './EventBus';
import { Edit, Delete, RefreshLeft, InfoFilled, ElementPlus } from '@element-plus/icons-vue'
import { faRulerVertical } from '@fortawesome/free-solid-svg-icons';
import { number } from 'echarts';

export default {
    name: 'App',
    components: {
        CreateNodeConfig,
        CreateNodePrevTasks,
        ChoosePowerNodes,
    },
};

</script>

<script lang="ts" setup>
import { reactive, ref, onMounted, defineProps } from 'vue'

import type { FormInstance, FormRules } from 'element-plus'
import axios from 'axios'
import qs from 'qs';

const config_vue = ref(null)
const update_processor = ref(false)
const selectedUsers = ref([]);
const initProcessorPath = ref('')

const TaskTypes = {
    TYPE_STREAM_DATA: -1,
    TYPE_SCRIPT: 1,
    TYPE_SPARK: 2,
    TYPE_OOZIE: 3,
    TYPE_ODPS: 4,
    TYPE_SHELL: 5,
    TYPE_DOCKER: 6,
    TYPE_CLICKHOUSE: 7,
    TYPE_V100: 8,
}

const processorType = ref(TaskTypes.TYPE_SCRIPT)

const props = defineProps({
    processor_info: Map,
});

interface RuleForm {
    project_id: number
    project: number
    type: number
    name: string
    configs: string
    desc: string
    tags: Array<String>
    users: string
    shell: string
}

const rules = reactive<FormRules<RuleForm>>({
    project: [
        { required: true, message: '请选择项目', trigger: 'blur' },
    ],
    type: [
        { required: true, message: '请选择模板任务类型', trigger: 'blur' },
    ],
    name: [
        { required: true, message: '请输入模板任务名称', trigger: 'blur' },
        { min: 1, max: 30, message: '长度不超过30个字符。', trigger: 'blur' },
    ],
    configs: [
        {
            required: false,
            message: 'Please select Activity zone',
            trigger: 'change',
        },
    ],
    desc: [
        {
            required: true,
            message: '请输入任务描述',
            trigger: 'change',
        },
    ],
    tags: [
        {
            required: false,
            message: '',
            trigger: 'change',
        },
    ],
    users: [
        {
            required: false,
            message: '',
            trigger: 'change',
        },
    ],
    shell: [
        {
            required: true,
            message: '请输入命令！',
            trigger: 'change',
        },
    ],
})

const ruleFormRef = ref<FormInstance>()
const ruleForm = reactive<RuleForm>({
    project: -1,
    type: TaskTypes.TYPE_SCRIPT,
    name: '',
    configs: '',
    desc: "",
    tags: [],
    users: "",
})


interface UserItem {
    id: string
    name: string
}
const userOptions = ref<UserItem[]>([])
const get_user_list = async () => {
    await axios
        .post('/pipeline/get_user_list/', {
        })
        .then(response => {
            // var json_obj = JSON.parse(response)
            var user_list = [];
            for (const item of response.data.user_list) {
                user_list.push({
                    id: item.id,
                    name: item.name,
                })
            }

            console.log(user_list)
            userOptions.value = user_list
        })
        .catch(error => console.log(error))
}

onMounted(() => {
    get_user_list();
    ruleForm.project = props.processor_info.project_path
    ruleForm.project_id = props.processor_info.project_id
    initProcessorPath.value = ruleForm.project
    console.log("create processor: ", props.processor_info.project_path, props.processor_info.project_id)
    if (props.processor_info["status"] == 0) {
        var processor = props.processor_info.processor
        ruleForm.type = processor.type
        ruleForm.name = processor.name
        processorType.value = processor.type
        var users = processor.userid_list.split(',')
        for (const user of users) {
            if (user == "") {
                continue;
            }

            selectedUsers.value.push(parseInt(user))
        }

        ruleForm.desc = processor.description
        ruleForm.tags = processor.tag.split(',')
        var configs = processor.config.split('\r\n')
        for (const config of configs) {
            var config_item = config.split('=')
            console.log("config: ", config_item)
            var tmp_slit = config_item[1].split('H0')
            config_vue.value.AddConfig(config_item[0], tmp_slit[0], tmp_slit[1])
        }

        console.log(ruleForm)
        update_processor.value = true
        ruleForm.shell = processor.template
    }
});

const cancelEvent = () => {
}

const DeleteProcessor = () => {
    var params = {
        "Task[id]": props.task_info.task.id
    }

    axios
        .post('/pipeline/delete_task/' + props.pipeline_id + '/', qs.stringify(params))
        .then(response => {
            if (response.status != 200 || response.data.status != 0) {
                ElMessage.warning("删除任务失败：" + response.data.info)
            } else {
                console.log(response.data)
                emitter.emit("delete_task_success", props.task_info.task.id)
                ElMessage.success("删除任务成功！")
            }
        })
        .catch(error => {
            ElMessage.error("创建任务失败：" + error)
            console.log(error)
        })
}

function uniqueBySet(arr) {
    return [...new Set(arr)];
}

const submitForm = async (formEl: FormInstance | undefined) => {
    var config_forms = config_vue.value.GetConfigs()
    var config_str = ""
    var keys = new Set()
    for (const item of config_forms) {
        var key = item.key.trim()
        if (key == "") {
            continue
        }

        if (keys.has(key)) {
            continue;
        }

        keys.add(key)
        console.log(key, item.value)
        config_str += key + "=" + item.value + "H0" + item.desc + "\r\n"
    }

    ruleForm.tags = uniqueBySet(ruleForm.tags)
    console.log(ruleForm)
    var tmp_project_id = ruleForm.project
    console.log("submit: ", ruleForm.project, props.processor_info.project_path)
    if (ruleForm.project == initProcessorPath.value) {
        tmp_project_id = ruleForm.project_id
    }

    var params = {
        "name": ruleForm.name,
        "config": config_str,
        'template': ruleForm.shell,
        "description": ruleForm.desc,
        "type": processorType.value,
        "project_id": tmp_project_id,
        'principal': selectedUsers.value.toString(),
        'input_config': '',
        'output_config': '',
        'tag': ruleForm.tags.toString(),
    }

    console.log(params)
    if (!formEl) return
    await formEl.validate((valid, fields) => {
        if (valid) {
            if (update_processor.value) {
                axios
                    .post('/processor/update/' + props.processor_info.processor.id + '/', qs.stringify(params))
                    .then(response => {
                        if (response.status != 200 || response.data.status != 0) {
                            ElMessage.warning("修改模板任务失败：" + response.data.msg)
                        } else {
                            console.log(response.data)
                            emitter.emit("update_processor_success", { "id": props.processor_info.processor.project_id + "_" + props.processor_info.processor.id })
                            ElMessage.success("修改模板任务成功！")
                        }
                    })
                    .catch(error => {
                        ElMessage.error("修改模板任务失败：" + error)
                        console.log(error)
                    })
            } else {
                axios
                    .post('/processor/create/', qs.stringify(params))
                    .then(response => {
                        if (response.status != 200 || response.data.status != 0) {
                            ElMessage.warning("创建模板任务失败：" + response.data.msg)
                        } else {
                            console.log(response.data)
                            var tmp_project_id = ruleForm.project 
                            if (ruleForm.project == initProcessorPath.value) {
                                tmp_project_id = ruleForm.project_id
                            }
                            
                            params['id'] = tmp_project_id + "_" + response.data['pid']
                            params['is_project'] = false
                            params['pid'] = params["project_id"]
                            params['text'] = params["name"]
                            params['user_list'] = params["principal"]
                            var emit_data = {
                                'tag': 0,
                                'proc_detail': {
                                    'config_str': params['config'],
                                    'processor': params
                                }
                            }
                            emitter.emit("create_processor_success", emit_data)
                            ElMessage.success("创建模板任务成功！")
                        }
                    })
                    .catch(error => {
                        ElMessage.error("创建模板任务失败：" + error)
                        console.log(error)
                    })
            }

        } else {
            console.log('error submit!', fields)
        }
    })
}

const resetForm = (formEl: FormInstance | undefined) => {
    if (!formEl) return
    formEl.resetFields()
    config_vue.value.ResetForm()
    prev_tasks_vue.value.ResetForm()
}

const processor_props = {
    id: 'id',
    value: 'value',
    label: 'label',
    children: 'children',
    isLeaf: 'isLeaf',
}

const load = (node, resolve) => {
    if (node.isLeaf) return resolve([])
    console.log(node.data.id, node.data.value, node.data.label)
    var node_id = node.data.id
    var params;

    if (node_id == undefined) {
        params = {
        }
    } else {
        params = {
            id: node_id
        }
    }

    axios
        .get('/processor/get_processor_tree_async/', {
            params: params
        })
        .then(response => {
            // var json_obj = JSON.parse(response)
            var get_processor_data = [];
            for (const item of response.data) {
                if (!item.is_project) {
                    continue;
                }

                get_processor_data.push({
                    id: item.id,
                    value: item.id,
                    label: item.text,
                    isLeaf: !item.is_project,
                })
            }

            console.log(get_processor_data)
            return resolve(get_processor_data);
        })
        .catch(error => console.log(error))
}

const type_options = ref([
    {
        "id": TaskTypes.TYPE_STREAM_DATA,
        "label": "stream",
    },
    {
        "id": TaskTypes.TYPE_SCRIPT,
        "label": "python",
    },

    {
        "id": TaskTypes.TYPE_SPARK,
        "label": "spark",
    },

    {
        "id": TaskTypes.TYPE_OOZIE,
        "label": "oozie",
    },

    {
        "id": TaskTypes.TYPE_ODPS,
        "label": "odps",
    },

    {
        "id": TaskTypes.TYPE_SHELL,
        "label": "shell",
    },

    {
        "id": TaskTypes.TYPE_DOCKER,
        "label": "docker",
    },
    {
        "id": TaskTypes.TYPE_CLICKHOUSE,
        "label": "clickhouse",
    },
])

defineExpose({
    TaskTypes,
});

</script>
