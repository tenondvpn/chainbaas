
<template>
    <el-form label-position="right" label-width="auto" :model="formLabelAlign" :rules="rules" style="max-width: 600px">
        <el-alert type="info" show-icon :closable="false">
            <p>当前选中的目录：{{ current_folder }}</p>
        </el-alert>

        <el-form-item label="新的目录名称" :label-position="itemLabelPosition" required>
            <el-input v-model="folder_name" />
        </el-form-item>

        <el-button plain :icon="Plus" style="margin-top: 30px;" type="primary" @click="updateFolder">修改项目</el-button>
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

const itemLabelPosition = ref<FormItemProps['labelPosition']>('')
const folder_name = ref('')
const current_folder = ref('')
const current_folder_id = ref(1)

interface RuleForm {
    name: string
}

const rules = reactive<FormRules<RuleForm>>({
    name: [
        { required: true, message: '请输入项目名', trigger: 'blur' },
    ],
})

const updateFolder = () => {
    emitter.emit('update_folder', {
        "cur_id": current_folder_id.value,
        'name': folder_name.value,
    })
}

onMounted(() => {
    console.log("props.current_folder_info: ", props.current_folder_info)
    current_folder.value = props.current_folder_info["path"]
    current_folder_id.value = props.current_folder_info["id"]
})

</script>
