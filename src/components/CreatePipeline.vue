<template>
    <el-form ref="ruleFormRef" style="max-width: 600px" :model="ruleForm" :rules="rules" label-width="auto"
        label-position="left">
        <el-form-item prop="project" required>
            <el-col :span="24">
                <el-form-item prop="project" label="选择项目" required>
                    <el-tree-select v-model="ruleForm.project" :data="treeData"  check-strictly
                        node-key="id"  />
                </el-form-item>
            </el-col>
        </el-form-item>

        <el-form-item label="流程名称" prop="pipeline_name">
            <el-input v-model="ruleForm.pipeline_name" />
        </el-form-item>

        <el-form-item label="执行周期" prop="ct_time">
            <el-input v-model="ruleForm.ct_time" placeholder="不填写：不自动周期执行" style="margin-top: 0px; width:91%" />
            <el-popover placement="right" :width="520" trigger="hover">
                <template #reference>
                    <el-button style="margin-left: 12px;" :icon="QuestionFilled" circle />
                </template>
                <el-alert type="info" show-icon :closable="false" :style="`border: 1px solid --el-color-primary;`">
                    <p>"执行周期" 是指每隔多少时间自动运行，采用crontab的格式，例如:</p>
                    <el-row>
                        <el-col :span="14">
                            <p style="margin-top: 0px; margin-right: 20px; text-align: left;">每分钟执行一次</p>
                        </el-col>
                        <el-col :span="10">
                            <p style="margin-top: 0px;">* * * * *</p>
                        </el-col>
                    </el-row>
                    <el-row style="margin-top: 0px;">
                        <el-col :span="14">
                            <p style="margin-top: 0px; margin-right: 20px; text-align: left;">每10分钟执行一次</p>
                        </el-col>
                        <el-col :span="10">
                            <p style="margin-top: 0px;">*/10 * * * *</p>
                        </el-col>
                    </el-row>
                    <el-row style="margin-top: 0px;">
                        <el-col :span="14">
                            <p style="margin-top: 0px; margin-right: 20px; text-align: left;">每小时的第10分钟执行一次</p>
                        </el-col>
                        <el-col :span="10">
                            <p style="margin-top: 0px;">10 * * * *</p>
                        </el-col>
                    </el-row>
                    <el-row style="margin-top: 0px;">
                        <el-col :span="14">
                            <p style="margin-top: 0px; margin-right: 20px; text-align: left;">每天12点10分执行一次</p>
                        </el-col>
                        <el-col :span="10">
                            <p style="margin-top: 0px;">10 12 * * *</p>
                        </el-col>
                    </el-row>
                    <el-row style="margin-top: 0px;">
                        <el-col :span="14">
                            <p style="margin-top: 0px; margin-right: 20px; text-align: left;">每月12号12点10分执行一次</p>
                        </el-col>
                        <el-col :span="10">
                            <p style="margin-top: 0px;">10 12 12 * *</p>
                        </el-col>
                    </el-row>
                    <el-row style="margin-top: 0px;">
                        <el-col :span="14">
                            <p style="margin-top: 0px; margin-right: 20px; text-align: left;">每年1月12号12点10分执行一次</p>
                        </el-col>
                        <el-col :span="10">
                            <p style="margin-top: 0px;">10 12 12 1 *</p>
                        </el-col>
                    </el-row>
                    <el-row style="margin-top: 0px;">
                        <el-col :span="14">
                            <p style="margin-top: 0px; margin-right: 20px; text-align: left;">每周一的12点10分执行一次</p>
                        </el-col>
                        <el-col :span="10">
                            <p style="margin-top: 0px;">10 12 * * 1</p>
                        </el-col>
                    </el-row>
                </el-alert>
            </el-popover>
        </el-form-item>

        <el-form-item label="负责人:" prop="users" style="margin-top: 17px">
            <el-select v-model="selectedUsers" multiple clearable filterable placeholder="Select">
                <el-option v-for="item in userOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
        </el-form-item>

        <el-form-item label="报警方式:" prop="priority" style="margin-top: 17px">
            <el-checkbox-group v-model="monitorsGroup" size="large">
                <el-checkbox-button v-for="monitor_way in monitors" :key="monitor_way" :value="monitor_way">
                    {{ monitor_way }}
                </el-checkbox-button>
            </el-checkbox-group>
        </el-form-item>

        <el-form-item label="有效期至" prop="timeout">
            <el-date-picker v-model="ruleForm.timeout" type="date" placeholder="选择过期时间点" :disabled-date="disabledDate"
                value-format="YYYY-MM-DD" :shortcuts="shortcuts" style="width: 100%;" />
        </el-form-item>

        <el-form-item label="描述" prop="desc" required>
            <el-input v-model="ruleForm.desc" type="textarea" placeholder="请输入任务流描述信息" />
        </el-form-item>

        <el-divider border-style="dashed" />
        <el-form-item>
            <el-button v-if="updatePipeline" type="primary" @click="submitForm(ruleFormRef)">
                修改流程
            </el-button>
            <el-button v-else type="primary" @click="submitForm(ruleFormRef)">
                创建流程
            </el-button>
            <el-button @click="resetForm(ruleFormRef)">重置参数</el-button>
        </el-form-item>
    </el-form>
</template>

<script lang="ts" setup>
import { reactive, ref, onMounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import axios from 'axios'
import qs from 'qs';
import { defineProps } from 'vue';
import { ElMessage } from 'element-plus';
import emitter from './EventBus';
import { QuestionFilled } from '@element-plus/icons-vue'
import { number } from 'echarts';

const monitors = ['邮件', '短信', '钉钉', '微信']
const monitorsGroup = ref(['邮件', '短信'])
const selectedUsers = ref();
const updatePipeline = ref(false);

const props = defineProps({
    pipeline_info: Map
});

const treeData = ref([
]);

interface RuleForm {
    pipeline_id: String
    project: Number
    pipeline_name: String
    ct_time: String
    users: String
    monitor_way: Number
    timeout: String
    tags: String
    desc: String
}

const ruleFormRef = ref<FormInstance>()
const ruleForm = reactive<RuleForm>({
    pipeline_id: '',
    project: 0,
    pipeline_name: '',
    ct_time: '',
    users: '',
    monitor_way: 0,
    timeout: '',
    tags: "",
    desc: "",
})

const rules = reactive<FormRules<RuleForm>>({
    project: [
        { required: true, message: '请选择流程所在项目', trigger: 'blur' },
    ],
    pipeline_name: [
        { required: true, message: '请输入流程名称', trigger: 'blur' },
        { min: 1, max: 64, message: '长度不超过64个字符。', trigger: 'blur' },
    ],
    ct_time: [
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
    monitor_way: [
        {
            required: false,
            message: '',
            trigger: 'change',
        },
    ],
    timeout: [
        {
            required: true,
            message: '请设置流程删除超时时间',
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
    desc: [
        {
            required: true,
            message: '请输入流程描述',
            trigger: 'change',
        },
    ],
})

const submitForm = async (formEl: FormInstance | undefined) => {
    console.log(ruleForm)
    var project_id = ruleForm.project
    ruleForm.users = ""
    for (const id of selectedUsers.value) {
        ruleForm.users += id + ","
    }

    var monitor_way = 0
    console.log(monitorsGroup.value)
    if (monitorsGroup.value.indexOf('邮件') >= 0) {
        monitor_way |= 1
        console.log("monitor: ", 1)
    }

    if (monitorsGroup.value.indexOf('短信') >= 0) {
        monitor_way |= 2
        console.log("monitor: ", 2)
    }

    if (monitorsGroup.value.indexOf('钉钉') >= 0) {
        monitor_way |= 4
        console.log("monitor: ", 4)
    }

    if (monitorsGroup.value.indexOf('微信') >= 0) {
        monitor_way |= 8
        console.log("monitor: ", 8)
    }

    var params = {
        "name": ruleForm.pipeline_name,
        "ct_time": ruleForm.ct_time,
        "principal": ruleForm.users,
        "monitor_way": monitor_way,
        "life_cycle": ruleForm.timeout,
        "description": ruleForm.desc,
        "project_id": project_id,
        "tags": ruleForm.tags.toString(),
        "type": 0,
    }
    console.log(params)
    if (!formEl) return
    await formEl.validate((valid, fields) => {
        if (valid) {
            if (ruleForm.pipeline_id) {
                axios
                    .post('/pipeline/update/' + ruleForm.pipeline_id + "/", qs.stringify(params))
                    .then(response => {
                        if (response.data.status != 0) {
                            ElMessage.warning("修改流程失败: " + response.data.msg)
                        } else {
                            var project_id = ruleForm.project
                            ElMessage.success("修改流程成功！")
                            emitter.emit("success_update_pipeline", '')
                        }
                    })
                    .catch(error => {
                        ElMessage.error("修改流程失败: " + error)
                    })
            } else {
                axios
                    .post('/pipeline/create/', qs.stringify(params))
                    .then(response => {
                        if (response.data.status != 0) {
                            ElMessage.error("创建流程失败: " + response.data.msg)
                        } else {
                            var project_id = ruleForm.project
                            ElMessage.success("创建流程成功！")
                            params["pid"] = project_id
                            params["text"] = ruleForm.pipeline_name
                            params["is_project"] = false
                            params["id"] = project_id + "-" + response.data.pipeline_id
                            params["pipe_id"] = response.data.pipeline_id
                            emitter.emit("success_create_pipeline", params)
                        }
                    })
                    .catch(error => {
                        ElMessage.error("创建流程失败: " + error)
                    })
            }
        } else {
            console.log('error submit!', fields)
            ElMessage.error("提交失败！ " + fields)
        }
    })
}

const resetForm = (formEl: FormInstance | undefined) => {
    if (!formEl) return
    formEl.resetFields()
    if (props.pipeline_info) {
        ruleForm.project = props.pipeline_info.project_id;
    }
}

// const processor_value = ref()
const processor_props = {
    id: 'id',
    value: 'value',
    label: 'label',
    children: 'children',
    isLeaf: 'isLeaf',
}

const getProjectTree = async () => {
    await axios
        .get('/pipeline/get_project_tree/', {
            params: {
            }
        })
        .then(response => {
            treeData.value = response.data
        })
        .catch(error => {
            ElMessage.error("创建流程失败: " + error)
        })
}

onMounted(() => {
    getProjectTree()
    get_user_list()
    ruleForm.project = props.pipeline_info.project_id
    if (props.pipeline_info) {
        if (props.pipeline_info.id > 0 && props.pipeline_info.name != '') {
            updatePipeline.value = true
        }

        ruleForm.pipeline_id = props.pipeline_info.id
        ruleForm.pipeline_name = props.pipeline_info.name
        ruleForm.ct_time = props.pipeline_info.ct_time
        ruleForm.desc = props.pipeline_info.description
        monitorsGroup.value = []
        if (props.pipeline_info.monitor_way & 1) {
            monitorsGroup.value.push(monitors[0])
        }

        if (props.pipeline_info.monitor_way & 2) {
            monitorsGroup.value.push(monitors[1])
        }

        if (props.pipeline_info.monitor_way & 4) {
            monitorsGroup.value.push(monitors[2])
        }

        if (props.pipeline_info.monitor_way & 8) {
            monitorsGroup.value.push(monitors[3])
        }

        ruleForm.monitor_way = props.pipeline_info.monitor_way!
        ruleForm.timeout = props.pipeline_info.life_cycle!
        ruleForm.users = props.pipeline_info.principal_id_list!
        var id_list = []
        for (const id of props.pipeline_info.principal_id_list!.split(',')) {
            if (id != "")
            id_list.push(parseInt(id))
        }
        selectedUsers.value = id_list
        ruleForm.users = props.pipeline_info.principal_id_list!
        console.log("init update pipeline:", id_list, ruleForm.users, userOptions.value)
    }
});

const load = (node, resolve) => {
    if (node.isLeaf) return resolve([])
    console.log(node.data.id, node.data.value, node.data.label)
    var node_id = node.data.id
    var params;

    if (node_id == undefined) {
        params = {
            type: 1,
            get_pipe: 0,
        }
    } else {
        params = {
            id: node_id,
            type: 0,
            get_pipe: 0,
        }
    }

    axios
        .get('/pipeline/get_project_tree_async/', {
            params: params
        })
        .then(response => {
            // var json_obj = JSON.parse(response)
            var get_processor_data = [];
            for (const item of response.data) {
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
            console.log("create pipeline: ", props.pipeline_info)
            userOptions.value = user_list
        })
        .catch(error => console.log(error))
}

const shortcuts = [
    {
        text: '今天',
        value: new Date(),
    },
    {
        text: '3天后',
        value: () => {
            const date = new Date()
            date.setTime(date.getTime() + 3 * 3600 * 1000 * 24)
            return date
        },
    },
    {
        text: '一个星期后',
        value: () => {
            const date = new Date()
            date.setTime(date.getTime() + 7 * 3600 * 1000 * 24 * 7)
            return date
        },
    },

    {
        text: '一个月后',
        value: () => {
            const date = new Date()
            date.setTime(date.getTime() + 30 * 3600 * 1000 * 24 * 7)
            return date
        },
    },

    {
        text: '一年后',
        value: () => {
            const date = new Date()
            date.setTime(date.getTime() + 365 * 3600 * 1000 * 24 * 7)
            return date
        },
    },

    {
        text: '三年后',
        value: () => {
            const date = new Date()
            date.setTime(date.getTime() + 3 * 365 * 3600 * 1000 * 24 * 7)
            return date
        },
    },
]

const disabledDate = (time: Date) => {
    return time.getTime() < Date.now()
}

</script>
