<template>
    <el-form ref="ruleFormRef" style="max-width: 750px" :model="ruleForm" :rules="rules" label-width="auto"
        label-position="left">
        <el-form-item v-if="showTree" prop="project" label="选择项目" required>
            <el-tree-select v-model="ruleForm.project" lazy :load="load" :props="processor_props" check-strictly
                :render-after-expand="false" style="width: 100%" />
        </el-form-item>

        <el-divider border-style="dashed" />
        <el-form-item>
            <el-button plain v-if="isPrivate == 1" type="primary" @click="submitForm(ruleFormRef)" :icon="Edit">
                共享模板任务
            </el-button>
            <el-button plain v-else type="primary" @click="submitForm(ruleFormRef)" :icon="Edit">
                取消共享
            </el-button>
        </el-form-item>
    </el-form>
</template>

<script lang="ts">
import { ElMessage } from 'element-plus';
import emitter from './EventBus';
import { Edit } from '@element-plus/icons-vue'
import { number } from 'echarts';

export default {
    name: 'App',
    components: {
    },
};

</script>

<script lang="ts" setup>
import { reactive, ref, onMounted, defineProps } from 'vue'

import type { FormInstance, FormRules } from 'element-plus'
import axios from 'axios'
import qs from 'qs';

const props = defineProps({
    processor_id: number,
    old_project_id: number,
    name: String,
    type: number,
    is_private: number
});

interface RuleForm {
    project_id: number
    project: number
}

const rules = reactive<FormRules<RuleForm>>({
    project: [
        { required: true, message: '请选择项目', trigger: 'blur' },
    ],
})

const ruleFormRef = ref<FormInstance>()
const processor_id = ref(-1)
const old_project_id = ref(-1)
const procName = ref('')
const procType = ref(1)
const isPrivate = ref(1)
const showTree = ref(false)
const ruleForm = reactive<RuleForm>({
    project: "公共任务",
})

onMounted(() => {
    processor_id.value = props.processor_id
    old_project_id.value = props.old_project_id
    procName.value = props.name
    procType.value = props.type
    isPrivate.value = props.is_private
    showTree.value = true
    if (isPrivate.value) {
        ruleForm.project = "公共任务"
    } else {
        ruleForm.project = "我创建的"
    }
    console.log("share process mounted: ", isPrivate.value)
});

const submitForm = async (formEl: FormInstance | undefined) => {
    if (!formEl) return
    await formEl.validate((valid, fields) => {
        if (valid) {
            var project_id = -3
            if (ruleForm.project == "我创建的") {
                project_id = -1
            }
            
            if (ruleForm.project != "公共任务" && ruleForm.project != "我创建的") {
                project_id = ruleForm.project
            }

            console.log("publish processor: ", processor_id.value, project_id)
            axios
                .post('/processor/public_processor/', qs.stringify({
                    "id": processor_id.value,
                    "project_id": project_id,
                }))
                .then(response => {
                    if (response.status != 200 || response.data.status != 0) {
                        ElMessage.warning("共享模板任务失败：" + response.data.msg)
                    } else {
                        console.log(response.data)
                        ElMessage.success("共享模板任务成功！")
                        emitter.emit("share_processor_success", {
                            "id": processor_id.value,
                            "project_id": project_id,
                            "old_project_id": old_project_id.value,
                            "name": procName.value,
                            "type": procType.value
                        })
                    }
                })
                .catch(error => {
                    ElMessage.error("共享模板任务失败：" + error)
                    console.log(error)
                })
        } else {
            console.log('error submit!', fields)
        }
    })
}

const load = (node, resolve) => {
    if (node.isLeaf) return resolve([])
    var node_id = node.data.id
    var params;

    console.log("load data: ", node.data.id, node.data.value, node.data.label, isPrivate.value)
    if (node_id && node_id < 0) {
        if (isPrivate.value == 1) {
            node_id = -3
        } else {
            node_id = -1
        }
    }

    if (node_id == undefined) {
        var id = -1
        if (isPrivate.value == 1) {
            id = -3
        }

        params = {
            id: id
        }
    } else {
        params = {
            id: node_id,
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

</script>
