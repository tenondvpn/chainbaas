<template>
    <el-form label-position="right" label-width="auto" :model="formLabelAlign" :rules="rules" style="max-width: 600px">
        <el-alert type="info" show-icon :closable="false">
            <p>当前选中的目录：{{ current_folder }}</p>
        </el-alert>

        <el-form-item label="目录类型" label-position="right" style="margin-top: 30px;" required>
            <el-radio-group v-model="folder_type" aria-label="选择创建的目录类型">
                <el-radio-button value='子目录'>子目录</el-radio-button>
                <el-radio-button :disabled="current_folder=='我创建的' || current_folder=='共享给我的' || current_folder=='公共任务'" value='平级目录'>平级目录</el-radio-button>
            </el-radio-group>
        </el-form-item>

        <el-form-item label="目录名称" :label-position="itemLabelPosition" required>
            <el-input v-model="folder_name" />
        </el-form-item>

        <el-button :icon="Plus" style="margin-top: 30px;" type="primary" @click="createFolder">创建项目</el-button>
    </el-form>
</template>

<script lang="ts" setup>
import { reactive, ref, defineProps, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import type { FormItemProps, FormProps } from 'element-plus'
import emitter from './EventBus';
import { FormRules } from 'element-plus';

const props = defineProps({
    current_folder_info: Map,
});

const folder_type = ref('子目录')
const itemLabelPosition = ref<FormItemProps['labelPosition']>('')
const folder_name = ref('')
const current_folder = ref('')
const current_folder_id = ref(1)
const current_folder_parent_id = ref(0)

interface RuleForm {
    type: string
    name: string
}

const rules = reactive<FormRules<RuleForm>>({
    type: [
        { required: true, message: '请选择创建的项目类型', trigger: 'blur' },
    ],
    name: [
        { required: true, message: '请输入项目名', trigger: 'blur' },
    ],
})

const createFolder = () => {
    var id = current_folder_id.value
    var type = 0
    if (folder_type.value == '平级目录') {
        id = current_folder_parent_id.value
        type = 1
    }

    emitter.emit('create_folder', {
        "cur_id": id,
        'name': folder_name.value,
        'type': type,
        'selected_id': current_folder_id.value
    })
}

onMounted(() => {
    console.log("props.current_folder_info: ", props.current_folder_info)
    current_folder.value = props.current_folder_info["path"]
    current_folder_id.value = props.current_folder_info["id"]
    current_folder_parent_id.value = props.current_folder_info["parent_id"]
})

</script>
