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

        <el-form-item label="合约名称" prop="pipeline_name">
            <el-input v-model="ruleForm.pipeline_name" />
        </el-form-item>

        <el-form-item label="负责人:" prop="users" style="margin-top: 17px">
            <el-select v-model="selectedUsers" multiple clearable filterable placeholder="Select">
                <el-option v-for="item in userOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
        </el-form-item>
        <el-form-item label="描述" prop="desc" required>
            <el-input v-model="ruleForm.desc" type="textarea" placeholder="请输入合约描述信息" />
        </el-form-item>

        <el-divider border-style="dashed" />
        <el-form-item>
            <el-button v-if="updatePipeline" type="primary" @click="submitForm(ruleFormRef)">
                修改合约
            </el-button>
            <el-button v-else type="primary" @click="submitForm(ruleFormRef)">
                创建合约
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

const selectedUsers = ref();
const updatePipeline = ref(false);
const solidity_str = ref("// SPDX-License-Identifier: GPL-3.0 \npragma solidity >=0.7.0 <0.9.0;")

const props = defineProps({
    pipeline_info: Map
});

const treeData = ref([
]);

interface RuleForm {
    pipeline_id: String
    project: Number
    pipeline_name: String
    users: String
    monitor_way: Number
    tags: String
    desc: String
}

const ruleFormRef = ref<FormInstance>()
const ruleForm = reactive<RuleForm>({
    pipeline_id: '',
    project: 0,
    pipeline_name: '',
    users: '',
    monitor_way: 0,
    tags: "",
    desc: "",
})

const rules = reactive<FormRules<RuleForm>>({
    project: [
        { required: true, message: '请选择合约所在项目', trigger: 'blur' },
    ],
    pipeline_name: [
        { required: true, message: '请输入合约名称', trigger: 'blur' },
        { min: 1, max: 64, message: '长度不超过64个字符。', trigger: 'blur' },
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
            message: '请输入合约描述',
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

    var params = {
        "name": ruleForm.pipeline_name,
        "ct_time": "0 12 1 * *",
        "principal": ruleForm.users,
        "monitor_way": 0,
        "life_cycle": 0,
        "description": ruleForm.desc,
        "project_id": project_id,
        "tags": ruleForm.tags.toString(),
        "type": 4,
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
                            ElMessage.warning("修改合约失败: " + response.data.msg)
                        } else {
                            var project_id = ruleForm.project
                            ElMessage.success("修改合约成功！")
                            emitter.emit("success_update_pipeline", '')
                        }
                    })
                    .catch(error => {
                        ElMessage.error("修改合约失败: " + error)
                    })
            } else {
                axios
                    .post('/pipeline/create/', qs.stringify(params))
                    .then(response => {
                        if (response.data.status != 0) {
                            ElMessage.error("创建合约失败: " + response.data.msg)
                        } else {
                            var project_id = ruleForm.project
                            ElMessage.success("创建合约成功！")
                            params["pid"] = project_id
                            params["text"] = ruleForm.pipeline_name
                            params["is_project"] = false
                            params["id"] = project_id + "-" + response.data.pipeline_id
                            params["pipe_id"] = response.data.pipeline_id
                            emitter.emit("success_create_pipeline", params)
                        }
                    })
                    .catch(error => {
                        ElMessage.error("创建合约失败: " + error)
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

const getProjectTree = async () => {
    await axios
        .get('/pipeline/get_project_tree/', {
            params: {
                type: 4
            }
        })
        .then(response => {
            treeData.value = response.data
        })
        .catch(error => {
            ElMessage.error("创建合约失败: " + error)
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
        ruleForm.desc = props.pipeline_info.description
       
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

</script>
