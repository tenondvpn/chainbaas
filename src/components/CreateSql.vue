<template>
    <el-form ref="ruleFormRef" style="max-width: 600px" :model="ruleForm" :rules="rules" label-width="auto"
        label-position="left">
        <el-form-item prop="processor" required>
            <el-col :span="12">
                <el-form-item prop="processor" label="选择模板任务" required>
                    <el-tree-select v-model="ruleForm.processor" lazy :load="load" :props="processor_props"
                        @change="handleSelectionChange" style="width: 240px" />
                </el-form-item>
            </el-col>
            <el-col :span="1">
            </el-col>
            <el-col :span="11">
                <el-form-item prop="processor_version" label="选择版本" required>
                    <el-select v-model="ruleForm.processor_version" value-key="id" placeholder="Select"
                        style="width: 240px">
                        <el-option v-for="item in version_options" :key="item.id" :label="item.label" :value="item" />
                    </el-select>
                </el-form-item>
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
                <el-option v-for="item in power_options" :key="item.id" :label="item.name" :value="item" />
            </el-select>
            <!-- <ChoosePowerNodes ref="choose_power_nodes" /> -->
        </el-form-item>
        <el-form-item label="任务描述" prop="desc" required>
            <el-input v-model="ruleForm.desc" type="textarea" placeholder="请输入任务描述信息，DAG图中用于显示！" />
        </el-form-item>
        <el-divider border-style="dashed" />

        <el-form-item label="任务参数" prop="configs">
            <CreateNodeConfig ref="config_vue" />
        </el-form-item>
        <el-divider border-style="dashed" />
        <el-form-item label="依赖任务" prop="prev_task">
            <CreateNodePrevTasks ref="prev_tasks_vue" />
        </el-form-item>

        <el-divider border-style="dashed" />
        <el-form-item>
            <el-button type="primary" @click="submitForm(ruleFormRef)">
                创建任务
            </el-button>
            <el-button @click="resetForm(ruleFormRef)">重置参数</el-button>
        </el-form-item>
    </el-form>
</template>

<script lang="ts">
import CreateNodeConfig from './CreateNodeConfig.vue';
import CreateNodePrevTasks from './CreateNodePrevTasks.vue';
import ChoosePowerNodes from './ChoosePowerNodes.vue';
import { ElMessage } from 'element-plus';
import emitter from './EventBus';
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
import { reactive, ref } from 'vue'

import type { FormInstance, FormRules } from 'element-plus'
import axios from 'axios'
import qs from 'qs';

import { defineProps } from 'vue';

type PowerOption = {
    id: string
    name: string
    desc: string
}

const power_value = ref<PowerOption>()
const power_options = ref([])

const ChangcePowerNodes = (type) => {
    axios
        .get('/pipeline/get_power_nodes/', {
            params: {
                "type": type
            }
        })
        .then(response => {
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
});


const choose_power_nodes = ref(null)
const config_vue = ref(null)
const prev_tasks_vue = ref(null)

const retry_times_radio = ref('1')
const priority_radio = ref('6')
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
})

const locationOptions = ['Home', 'Company', 'School']

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
})

const handleSelectionChange = (value) => {
    // `value` 参数就是新选中的节点的 value 值
    console.log('新选中的节点值:', value);
    version_value.value = null
    var proc_id = value.split('-')[2]
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

            version_options.value = get_processor_data;
            console.log(get_processor_data)
            ChangcePowerNodes("script")
        })
        .catch(error => console.log(error))
};

const submitForm = async (formEl: FormInstance | undefined) => {
    var config_forms = config_vue.value.GetConfigs()
    var config_str = ""
    for (const item of config_forms) {
        console.log(item.key, item.value)
        config_str += item.key + "=" + item.value + "\n"
    }

    var prev_tasks = prev_tasks_vue.value.GetPrevTasks()
    console.log(prev_tasks)
    var prev_tasks_str = ""
    for (const item of prev_tasks) {
        console.log(item.pipeline.id, item.pipeline.name, item.task.id, item.task.name)
        prev_tasks_str += item.task.id + ","
    }

    console.log("pipeline_id: %s", props.pipeline_id)
    console.log(ruleForm)
    var params = {
        "name": ruleForm.task_name,
        "config": config_str,
        "template": "",
        "retry_count": ruleForm.retry_times,
        "priority": ruleForm.priority,
        "over_time": ruleForm.timeout,
        "prev_task_ids": prev_tasks_str,
        "server_tag": ruleForm.power_tag,
        "description": ruleForm.desc,
        "type": 1,
        "processor_id": ruleForm.processor.split('-')[2],
        "version_id": ruleForm.processor_version.id,
        "use_processor": 1
    }
    console.log(params)
    if (!formEl) return
    await formEl.validate((valid, fields) => {
        if (valid) {
            axios
                .post('/pipeline/create_task/' + props.pipeline_id + '/', qs.stringify(params))
                .then(response => {
                    if (response.status != 200 || response.data.status != 0) {
                        ElMessage.warning("创建任务失败：" + response.data.info)
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

</script>
