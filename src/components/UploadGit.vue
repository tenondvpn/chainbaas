<template>
    <el-form label-position="right" label-width="auto" style="max-width: 900px">
        <el-form-item label="版本号">
            <el-input v-model="version" />
        </el-form-item>
        <el-form-item label="git地址">
            <el-input v-model="git_url" />
        </el-form-item>
        <el-form-item label="说明">
            <el-input v-model="description" type="textarea" />
        </el-form-item>

        <el-divider />
        <el-button type="primary" plain :icon="UploadFilled" @click="submitUpload">上传新版本</el-button>
    </el-form>
</template>

<script lang="ts" setup>
import { reactive, ref, defineProps, onMounted } from 'vue'
import { ElMessage } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue'
import axios from 'axios';
import emitter from './EventBus';
import qs from 'qs';

const props = defineProps({
    proc_id: String,
    proc_name: String,
    git_url: String,
    desc: String,
    proc_verion: String,
    now_versions: Set<String>
});

const proc_name = ref()
const proc_id = ref()
const version = ref()
const git_url = ref()
const description = ref('git链接地址')
const nowVersionList = ref<Set<String>>()

const submitUpload = () => {
    if (version.value.trim() == "") {
        ElMessage({
            type: 'error',
            message: '请修改版本号！',
        })

        return
    }

    if (description.value.trim() == "") {
        ElMessage({
            type: 'error',
            message: '请输入版本说明！',
        })

        return
    }

    if (!checkVersionValid(version.value)) {
        ElMessage({
            type: 'error',
            message: '文件版本已经存在，请修改版本号！',
        })

        return
    }

    if (git_url.value === null || git_url.value.trim() == "") {
        ElMessage({
            type: 'error',
            message: '请先选择文件！',
        })
        return
    }

    axios
        .post('/processor/upload_package_with_local/', qs.stringify({
            'proc_id': proc_id.value,
            'version_name': version.value,
            'type': '1',
            'desc': description.value,
            'git_url': git_url.value,
        }))
        .then(response => {
            if (response.data.status != 0) {
                ElMessage.warning("上传git版本失败: " + response.data.msg)
            } else {
                ElMessage.success("上传git版本成功！")
                emitter.emit('success_upload_processor', '')
            }
        })
        .catch(error => {
            ElMessage.error("上传git版本失败: " + error)
        })
}

const checkVersionValid = (ver) => {
    if (props.proc_verion && props.proc_verion != "") {
        return true

    }

    if (nowVersionList.value?.has(ver)) {
        return false
    }

    return true
}

onMounted(() => {
    proc_id.value = props.proc_id
    proc_name.value = props.proc_name
    version.value = "VER.0.0.0"
    git_url.value = props.git_url
    if (props.proc_verion && props.proc_verion != "") {
        version.value = props.proc_verion
    }

    if (props.desc && props.desc != "") {
        description.value = props.desc
    }
    
    if (props.now_versions) {
        nowVersionList.value = props.now_versions
    }
})

</script>
