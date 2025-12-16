<template>
    <el-form ref="formRef" :model="dynamicForm" :rules="rules" label-width="0px" class="dynamic-form-container">
        <el-form-item style="margin-top: 10px;" v-for="(item, index) in dynamicForm.items" :key="index"
            :prop="'items.' + index + '.value'" :rules="{
                required: false,
                message: '',
                trigger: 'blur',
            }">
            <el-row :gutter="37">
                <el-select filterable v-model="item.pipeline" value-key="id" placeholder="请选择流程"
                    @change="(val) => handleChange(val, index)" style="width: 220px;margin-left: 18.5px; ">
                    <el-option v-for="titem in pipeline_options" :key="titem.id" :label="titem.name" :value="titem" />
                </el-select>
                <el-select filterable v-model="item.task" value-key="id" placeholder="请选择任务"
                    style="width: 220px;margin-left: 2px;margin-right: 13px;">
                    <el-option v-for="titem in task_options[index]" :key="titem.id" :label="titem.name"
                        :value="titem" />
                </el-select>
            </el-row>
            <!-- <el-input v-model="item.value" placeholder="请输入内容" class="input-item" /> -->
            <el-button size="small" type="primary" style="margin-left: 20px;" :icon="Minus" circle
                @click.prevent="removeItem(item)" class="remove-btn" />
        </el-form-item>
        <el-form-item text-align="center">
            <el-button type="primary" @click="addItem" style="margin-top: 20px;">
                <el-icon>
                    <Plus />
                </el-icon>
                新增依赖
            </el-button>
        </el-form-item>
    </el-form>
</template>

<script lang="ts" setup>
import { reactive, ref, onMounted } from 'vue';
import { Minus, Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import qs from 'qs';

const formRef = ref(null);
// 表单数据，使用 reactive 确保响应式
const dynamicForm = reactive({
    items: [
        // { pipeline: '' },
        // { task: '' },
    ],
});

// 表单校验规则（可选）
const rules = reactive({
    // 这里可以定义其他静态表单项的规则
});

// 移除表单项
const removeItem = (item) => {
    const index = dynamicForm.items.indexOf(item);
    if (index !== -1) {
        dynamicForm.items.splice(index, 1);
    }
};

// 增加表单项
const addItem = () => {
    dynamicForm.items.push({
        pipeline_id: 0,
        task_id: 0,
        pipeline: '',
        task: '',
    });
};

onMounted(() => {
    UpdatePipelines();
});

const UpdatePipelines = () => {
    axios
        .post('/pipeline/get_pipelines/', {
        })
        .then(response => {
            pipeline_options.value = []
            for (const item of response.data["pipeline_list"]) {
                const new_item = {
                    id: item["id"],
                    name: item["name"],
                    desc: item["name"],
                }
                pipeline_options.value.push(new_item)
            }
        })
        .catch(error => console.log(error))
}

type PipelineOption = {
    id: number
    name: string
    desc: string
}

const pipeline_options = ref<PipelineOption[]>([])

type TaskOption = {
    id: number
    name: string
    desc: string
}

const task_options = ref({});

for (let i = 0; i < 100; i++) {
    const tmp_option = ref<TaskOption[]>([])
    task_options.value[i] = tmp_option
}

const handleChange = (val, val1) => {
    console.log(val, val1)
    dynamicForm.items[val1].task = ""
    axios
        .post('/pipeline/get_tasks/', qs.stringify({
            'pipeline_id': val.id,
        }))
        .then(response => {
            task_options.value[val1] = []
            for (const item of response.data["task_list"]) {
                const new_item = {
                    id: item["id"],
                    name: item["name"],
                    desc: item["name"],
                }
                task_options.value[val1].push(new_item)
            }
        })
        .catch(error => console.log(error))
}

const GetPrevTasks = () => {
    return dynamicForm.items
}

const ResetForm = () => {
    dynamicForm.items = []
}

const AddPrevTasks = (prev_tasks) => {
    var idx = 0
    for (const key in prev_tasks) {
        console.log("prev task: ", key, prev_tasks[key])
        dynamicForm.items.push({
            pipeline_id: prev_tasks[key].pl_id,
            task_id: prev_tasks[key].id,
            pipeline: prev_tasks[key].pipeline_name,
            task: prev_tasks[key].id,
        });
        handleChange({id: prev_tasks[key].pl_id}, idx)
        dynamicForm.items[idx].task = prev_tasks[key].name
        ++idx
    }
}

defineExpose({
    GetPrevTasks,
    ResetForm,
    AddPrevTasks,
});

</script>

<style scoped>
.dynamic-form-container {
    min-width: 450px;
    margin-top: 20px auto;
}

.input-item {
    width: 80%;
    margin-right: 10px;
}

.remove-btn {
    vertical-align: top;
}
</style>