<template>
    <el-form ref="ruleFormRef" style="max-width: 750px;margin-left: 40px;" :model="ruleForm" :rules="rules" label-width="auto"
        label-position="left">
        <el-form-item  prop="processor" required>
            <el-col :span="11">
                <el-form-item prop="processor" label="选择模板任务" required>
                    <el-tree-select v-model="ruleForm.processor" lazy :load="load" :props="processor_props"
                        @change="handleSelectionChange" style="width: 240px" :disabled="update_task" />
                </el-form-item>
            </el-col>
            <el-col :span="1">
            </el-col>
            <el-col :span="10">
                <el-form-item prop="processor_version" label="选择版本" required>
                    <el-select v-model="ruleForm.processor_version" value-key="id" placeholder="Select"
                        @change="changeTaskInfo"
                        style="width: 240px">
                        <el-option v-for="item in version_options" :key="item.id" :label="item.label"
                            :value="item.id" />
                    </el-select>
                </el-form-item>
            </el-col>
            <el-col :span="2">
                        <el-tooltip class="box-item" effect="dark" content="点击查看模板任务文件列表！">
            <el-button  type="primary" @click="show_detail = true" style="margin-top:-3px;margin-left: 3px;" :icon="Files" plain></el-button>
        </el-tooltip>    
        </el-col>
        </el-form-item>

        <el-form-item label="任务名称" prop="task_name">
            <el-input v-model="ruleForm.task_name" />
        </el-form-item>

        <el-form-item label="失败重复次数:" prop="retry_times" style="margin-top: 17px">
            <div style="margin-top: -10px">
                <el-radio-group v-model="retry_times_radio">
                    <el-radio-button label="&nbsp;&nbsp;&nbsp;&nbsp;不重试&nbsp;&nbsp;&nbsp;" value="1" />
                    <el-radio-button label="&nbsp;&nbsp;&nbsp;&nbsp;重试一次&nbsp;&nbsp;" value="2" />
                    <el-radio-button label="&nbsp;&nbsp;&nbsp;&nbsp;重试五次&nbsp;&nbsp;&nbsp;" value="3" />
                    <el-radio-button label="&nbsp;&nbsp;&nbsp;&nbsp;一直重试&nbsp;&nbsp;&nbsp;" value="4" />
                </el-radio-group>
            </div>
        </el-form-item>

        <el-form-item label="优先级:" prop="priority" style="margin-top: 17px">
            <div style="margin-top: -10px">
                <el-radio-group v-model="priority_radio">
                    <el-radio-button label="&nbsp;&nbsp;&nbsp;&nbsp;最高&nbsp;&nbsp;&nbsp;" value="10" />
                    <el-radio-button label="&nbsp;&nbsp;&nbsp;&nbsp;重要&nbsp;&nbsp;" value="9" />
                    <el-radio-button label="&nbsp;&nbsp;&nbsp;&nbsp;一般&nbsp;&nbsp;&nbsp;" value="8" />
                    <el-radio-button label="&nbsp;&nbsp;低优先级&nbsp;" value="7" />
                    <el-radio-button label="&nbsp;&nbsp;&nbsp;&nbsp;最低&nbsp;&nbsp;&nbsp;" value="6" />
                </el-radio-group>
            </div>
        </el-form-item>

        <el-form-item label="执行超时时间" prop="timeout">
            <el-input-number v-model="ruleForm.timeout" :step="10">
                <template #suffix>
                    <span>分钟</span>
                </template>
            </el-input-number>
        </el-form-item>
        <el-form-item label="选择算力集群" prop="power_tag">
            <el-select filterable v-model="ruleForm.power_tag" value-key="id" placeholder="请选择算力集群标签"
                style="width: 223px;margin-right:6px;">
                <el-option v-for="item in power_options" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
            <!-- <ChoosePowerNodes ref="choose_power_nodes" /> -->
        </el-form-item>
        <el-form-item label="任务描述" prop="desc" required>
            <el-input v-model="ruleForm.desc" type="textarea" placeholder="请输入任务描述信息，DAG图中用于显示！" />
        </el-form-item>
        <el-form-item v-if="taskType === TaskTypes.TYPE_SHELL" label="shell命令"
            prop="shell" required>
            <el-input v-model="ruleForm.shell" type="textarea" :rows="6" placeholder="输入shell命令，可以多行！" />
        </el-form-item>

        <el-form-item v-if="taskType === TaskTypes.TYPE_CLICKHOUSE" label="ck-sql命令"
            prop="shell" required>
            <el-input v-model="ruleForm.shell" type="textarea" :rows="6" placeholder="输入clickhouse的SQL命令，可以多行！" />
        </el-form-item>

        <el-form-item v-if="taskType === TaskTypes.TYPE_ODPS" label="odps-sql命令"
            prop="shell" required>
            <el-input v-model="ruleForm.shell" type="textarea" :rows="6" placeholder="输入odps的SQL命令，可以多行！" />
        </el-form-item>
        <el-divider border-style="dashed" />

        <el-form-item label="任务参数" prop="configs">
            <CreateNodeConfig ref="config_vue" :show_description="false" />
        </el-form-item>
        <el-divider border-style="dashed" />
        <el-form-item label="依赖任务" prop="prev_task">
            <CreateNodePrevTasks ref="prev_tasks_vue" />
        </el-form-item>

        <el-divider border-style="dashed" />
        <el-form-item>
            <el-button v-if="update_task" type="primary" @click="submitForm(ruleFormRef)" :icon="Edit">
                修改任务
            </el-button>
            <el-button v-else type="primary" @click="submitForm(ruleFormRef)">
                创建任务
            </el-button>
            <el-popconfirm confirm-button-text="确定" cancel-button-text="取消" :icon="InfoFilled" icon-color="#626AEF"
                title="确定删除任务吗?" @confirm="DeleteTask" @cancel="cancelEvent">
                <template #reference>
                    <el-button v-if="update_task" style="margin-left: 10px;" type="warning"
                        :icon="Delete">删除任务</el-button>
                </template>
            </el-popconfirm>

            <el-button @click="resetForm(ruleFormRef)" :icon="RefreshLeft">重置参数</el-button>
        </el-form-item>
    </el-form>
        <el-drawer v-model="show_detail" :direction="drawer_direction" size="80%" :destroy-on-close="true"
        :append-to-body="true">
        <template #header>
            <h4 style="width: 100px"></h4>
        </template>
        <template #default>
            <Package :processor_id="procId" :upload_id="ruleForm.processor_version" />
        </template>
    </el-drawer>
</template>

<script lang="ts">
import CreateNodeConfig from './CreateNodeConfig.vue';
import CreateNodePrevTasks from './CreateNodePrevTasks.vue';
import ChoosePowerNodes from './ChoosePowerNodes.vue';
import { ElMessage } from 'element-plus';
import emitter from './EventBus';
import { Edit, Delete, RefreshLeft, InfoFilled, Files } from '@element-plus/icons-vue'
import { DrawerProps } from 'element-plus';
import Package from './package.vue'

export default {
    name: 'App',
    components: {
        CreateNodeConfig,
        CreateNodePrevTasks,
        ChoosePowerNodes,
        Package,
    },
};


</script>

<script lang="ts" setup>
import { reactive, ref, onMounted } from 'vue'

import type { FormInstance, FormRules } from 'element-plus'
import axios from 'axios'
import qs from 'qs';
import { defineProps } from 'vue';


const drawer_direction = ref<DrawerProps['direction']>('rtl')
const show_detail = ref(false)
const procId = ref()
const power_options = ref([])
const ChangcePowerNodes = (type) => {
    axios
        .get('/pipeline/get_power_nodes/', {
            params: {
                "type": type
            }
        })
        .then(response => {
            power_options.value = []
            for (const key in response.data.tags) {
                power_options.value.push({
                    "id": key,
                    "name": key,
                })
            }
            console.log(response.data)
        })
        .catch(error => console.log(error))
}

const props = defineProps({
    pipeline_id: String,
    task_info: Map,
    task_type: Number,
    update_task: Boolean
});

const config_vue = ref(null)
const prev_tasks_vue = ref(null)
const retry_times_radio = ref('1')
const priority_radio = ref('6')
const update_task = ref(false)
const now_history_list = ref(null)

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


const taskType = ref(TaskTypes.TYPE_SCRIPT)
const srctaskType = ref(TaskTypes.TYPE_SCRIPT)

interface RuleForm {
    processor: string
    processor_version: string
    task_name: string
    configs: string
    retry_times: number
    priority: number
    timeout: number
    prev_task: string
    power_tag: string
    desc: string
    shell: string
}

const ruleFormRef = ref<FormInstance>()
const ruleForm = reactive<RuleForm>({
    processor: "",
    processor_version: '',
    task_name: '',
    configs: '',
    retry_times: 1,
    priority: 6,
    timeout: 0,
    prev_task: "",
    power_tag: "ALL",
    desc: "",
    shell: "",
})

const rules = reactive<FormRules<RuleForm>>({
    processor: [
        { required: true, message: '请选择模板任务', trigger: 'blur' },
    ],
    processor_version: [
        { required: true, message: '请选择版本', trigger: 'blur' },
    ],
    task_name: [
        { required: true, message: '请输入任务名称', trigger: 'blur' },
        { min: 1, max: 30, message: '长度不超过30个字符。', trigger: 'blur' },
    ],
    configs: [
        {
            required: false,
            message: 'Please select Activity zone',
            trigger: 'change',
        },
    ],
    retry_times: [
        {
            required: true,
            message: '选择失败重试次数',
            trigger: 'change',
        },
    ],
    priority: [
        {
            required: true,
            message: '请设置优先级',
            trigger: 'change',
        },
    ],
    timeout: [
        {
            required: true,
            message: '请设置执行任务超时时间',
            trigger: 'change',
        },
    ],
    prev_task: [
        {
            required: false,
            message: '',
            trigger: 'change',
        },
    ],
    power_tag: [
        {
            required: false,
            message: '请选择算力集群',
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
    shell: [
        {
            required: true,
            message: '请输入shell命令',
            trigger: 'change',
        },
    ],
})

onMounted(() => {
    taskType.value = props.task_type!
    srctaskType.value = props.task_type!
    console.log("0 init create node: ", taskType.value, props.task_info)

    if (taskType.value == TaskTypes.TYPE_SCRIPT) {
        ChangcePowerNodes("script")
    } else if (taskType.value == TaskTypes.TYPE_SPARK) {
        ChangcePowerNodes("spark")
    } else if (taskType.value == TaskTypes.TYPE_OOZIE) {
        ChangcePowerNodes("oozie")
    } else if (taskType.value == TaskTypes.TYPE_ODPS) {
        ChangcePowerNodes("odps")
    } else if (taskType.value == TaskTypes.TYPE_SHELL) {
        ChangcePowerNodes("shell")
    } else if (taskType.value == TaskTypes.TYPE_DOCKER) {
        ChangcePowerNodes("docker")
    } else if (taskType.value == TaskTypes.TYPE_CLICKHOUSE) {
        ChangcePowerNodes("clickhouse")
    } else if (taskType.value == TaskTypes.TYPE_V100) {
        ChangcePowerNodes("v100")
    } else if (taskType.value == TaskTypes.TYPE_STREAM_DATA) {
        ChangcePowerNodes("stream")
    } else {
        taskType.value = TaskTypes.TYPE_SCRIPT
        ChangcePowerNodes("script")
    }

    if (props.task_info["task"]) {
        ruleForm.processor = props.task_info.processor.name
        procId.value = props.task_info.processor.id
        var get_processor_data = [];
        for (const item of props.task_info.version_list) {
            get_processor_data.push({
                id: item.id,
                desc: item.name,
                label: item.version,
            })
        }

        version_options.value = get_processor_data;
        console.log(get_processor_data)
        ruleForm.processor_version = props.task_info.task.version_id
        if (ruleForm.processor_version == -1) {
            ruleForm.processor_version = props.task_info.version_list[0].id
        }
        ruleForm.task_name = props.task_info.task.name
        ruleForm.retry_times = props.task_info.task.retry_count
        if (ruleForm.retry_times <= 0 || ruleForm.retry_times >= 5) {
            ruleForm.retry_times = 1
        }

        retry_times_radio.value = "" + ruleForm.retry_times
        priority_radio.value = "" + props.task_info.task.priority
        ruleForm.priority = props.task_info.task.priority
        ruleForm.timeout = props.task_info.task.over_time
        ruleForm.power_tag = props.task_info.task.server_tag
        ruleForm.desc = props.task_info.task.description
        var configs = props.task_info.task.config.split('\r\n')
        for (const config of configs) {
            var config_item = config.split('=')
            if (config_item.length < 2) {
                break
            }

            console.log("config: ", config_item)
            var val_split = config_item[1].split('H0')
            config_vue.value.AddConfig(config_item[0], val_split[0])
        }

        prev_tasks_vue.value.AddPrevTasks(props.task_info.rely_tasks)
        console.log(ruleForm)
        ruleForm.shell = props.task_info.processor.template
    }

    update_task.value = props.update_task
    console.log("init create node is update_task: ", update_task.value)

});

const changeTaskInfo = () => {
    var history = null;
    for (const item of now_history_list.value) {
        console.log("get changed history: ", item, ruleForm.processor_version)
        if (item.id == ruleForm.processor_version) {
            history = item;
            break
        }
    }

    if (history == null) {
        return
    }

    taskType.value = history.type
    procId.value = history.id
    ruleForm.task_name = ""
    ruleForm.retry_times = 1
    retry_times_radio.value = "" + ruleForm.retry_times
    priority_radio.value = "" + 6
    ruleForm.priority = 6
    ruleForm.timeout = 0
    ruleForm.power_tag = "ALL"
    ruleForm.desc = ""
    var configs = history.config.split('\r\n')
    for (const config of configs) {
        var config_item = config.split('=')
        console.log("config: ", config_item)
        var val_split = config_item[1].split('H0')
        config_vue.value.AddConfig(config_item[0], val_split[0])
    }

    console.log(ruleForm)
    ruleForm.shell = history.template
}
const handleSelectionChange = (value) => {
    // `value` 参数就是新选中的节点的 value 值
    console.log('新选中的节点值:', value);
    version_value.value = null
    var proc_id = value.split('_')[1]
    axios
        .post('/processor/view_history/' + proc_id + '/', "")
        .then(response => {
            // var json_obj = JSON.parse(response)
            var get_processor_data = [];
            for (const item of response.data.history_list) {
                get_processor_data.push({
                    id: item.id,
                    desc: item.name,
                    label: item.version,
                })
            }

            now_history_list.value = response.data.history_list
            version_options.value = get_processor_data;
            console.log(get_processor_data)
            ChangcePowerNodes("script")
            procId.value = proc_id
        })
        .catch(error => console.log(error))
};

const cancelEvent = () => {
}

const DeleteTask = () => {
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

const submitForm = async (formEl: FormInstance | undefined) => {
    var config_forms = config_vue.value.GetConfigs()
    var config_str = ""
    for (const item of config_forms) {
        console.log(item.key, item.value)
        config_str += item.key + "=" + item.value + "\r\n"
    }

    var prev_tasks = prev_tasks_vue.value.GetPrevTasks()
    console.log(prev_tasks)
    var prev_tasks_str = ""
    for (const item of prev_tasks) {
        console.log(item.task_id, item.pipeline_id, item.task, item.pipeline)
        if (item.task_id != 0) {
            prev_tasks_str += item.task_id + ","
        } else {
            prev_tasks_str += "" + item.task.id + ","
        }
    }

    console.log("pipeline_id: %s", props.pipeline_id)
    console.log(ruleForm)
    var tmp_processor_id = "-1"
    var tmp_version_id = "-1"
    if (ruleForm.processor != "") {
        tmp_processor_id = ruleForm.processor.split('_')[1]
        tmp_version_id = ruleForm.processor_version
    }

    var params = {
        "name": ruleForm.task_name,
        "config": config_str,
        "template": ruleForm.shell,
        "retry_count": ruleForm.retry_times,
        "priority": ruleForm.priority,
        "over_time": ruleForm.timeout,
        "prev_task_ids": prev_tasks_str,
        "server_tag": ruleForm.power_tag,
        "description": ruleForm.desc,
        "type": taskType.value,
        "processor_id": tmp_processor_id,
        "version_id": tmp_version_id,
        "use_processor": 1,
    }

    console.log(params)
    if (!formEl) return
    await formEl.validate((valid, fields) => {
        if (valid) {
            if (update_task.value) {
                axios
                    .post('/pipeline/update_task/' + props.task_info.task.id + '/', qs.stringify(params))
                    .then(response => {
                        if (response.status != 200 || response.data.status != 0) {
                            ElMessage.warning("修改任务失败：" + response.data.msg)
                        } else {
                            console.log(response.data)
                            emitter.emit("update_task_success", response.data.task)
                            ElMessage.success("修改任务成功！")
                        }
                    })
                    .catch(error => {
                        ElMessage.error("修改任务失败：" + error)
                        console.log(error)
                    })
            } else {
                axios
                    .post('/pipeline/create_task/' + props.pipeline_id + '/', qs.stringify(params))
                    .then(response => {
                        if (response.status != 200 || response.data.status != 0) {
                            ElMessage.warning("创建任务失败：" + response.data.msg)
                        } else {
                            console.log(response.data)
                            emitter.emit("success_create_task", response.data.task)
                            ElMessage.success("创建任务成功！")
                        }
                    })
                    .catch(error => {
                        ElMessage.error("创建任务失败：" + error)
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

const options = Array.from({ length: 10000 }).map((_, idx) => ({
    value: `${idx + 1}`,
    label: `${idx + 1}`,
}))

// const processor_value = ref()
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
                    continue
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
type VersionOption = {
    id: number
    label: string
    desc: string
}
const version_value = ref<VersionOption>()
const version_options = ref([])

defineExpose({
    TaskTypes,
});

</script>
