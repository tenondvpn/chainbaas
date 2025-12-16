<template>
    <el-form ref="ruleFormRef" :rules="rules" label-position="right" label-width="auto" style="max-width: 900px">
        <el-form-item prop="version" label="版本号" >
            <el-input  v-model="ruleForm.version" />
        </el-form-item>
        <el-form-item prop="description" label="说明" >
            <el-input  v-model="ruleForm.description" type="textarea" />
        </el-form-item>
        <el-upload  ref="uploadRef" class="upload-demo" drag :on-change="handlePreview" :http-request="customUpload"
            :auto-upload="false" :limit="1" :on-exceed="handleExceed" action="">
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
                将文件拖拽到这儿 或者 <em>点击选择文件</em>
            </div>
            <template #tip>
                <div class="el-upload__tip">
                    <el-alert type="info" show-icon :closable="false">
                        <el-text type="default">上传的文件需要打包为</el-text>
                        <el-text type="danger">ZIP</el-text>
                        <el-text type="default">，且在文件列表内打包所有文件，</el-text>
                        <el-text type="danger">不要建立外层文件夹！</el-text>
                    </el-alert>
                </div>
            </template>
        </el-upload>
        <el-divider />
        <el-progress v-if="progressVisible" :percentage="progressPercent" :status="uploadStatus" />
        <el-button type="primary" plain :icon="UploadFilled" @click="submitUpload">上传新版本</el-button>
    </el-form>
</template>

<script lang="ts" setup>
import { reactive, ref, defineProps, onMounted } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import type { FormItemProps, FormProps } from 'element-plus'
import emitter from './EventBus';
import { FormRules } from 'element-plus';
import axios from 'axios';
import qs from 'qs';
import useClipboard from 'vue-clipboard3';
import { ElMessage } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue'
import { genFileId } from 'element-plus'

import type { UploadInstance, UploadProps, UploadRawFile } from 'element-plus'
import { FormInstance } from 'element-plus';

const props = defineProps({
    proc_id: String,
    proc_name: String,
    proc_verion: String,
    now_versions: Set<String>,
    desc: String,
});

const proc_name = ref()
const proc_id = ref()
const uploadRef = ref<UploadInstance>()
const fileData = ref(null)
const progressVisible = ref(false)
const progressPercent = ref(0)
const uploadStatus = ref('')
const nowVersionList = ref<Set<String>>()

const handleExceed: UploadProps['onExceed'] = (files) => {
    uploadRef.value!.clearFiles()
    const file = files[0] as UploadRawFile
    file.uid = genFileId()
    uploadRef.value!.handleStart(file)
}

const handlePreview = (file) => {
    console.log(file)
    if (!file.name.endsWith('.zip')) {
        fileData.value = null
        uploadRef.value!.clearFiles()
        ElMessage({
            type: 'error',
            message: '文件类型错误！需要打包为zip！',
        })

        return false
    }

    fileData.value = file
    console.log("fileData.value: ", fileData.value)
    return true
}

interface RuleForm {
    version: string
    description: string
    file: string
}

const ruleForm = reactive<RuleForm>({
    version: "",
    description: '',
    file:''
})
const ruleFormRef = ref<FormInstance>()

const rules = reactive<FormRules<RuleForm>>({
    version: [
        { required: false, message: '请输入版本号', trigger: 'blur' },
    ],
    description: [
        { required: false, message: '请输入描述', trigger: 'blur' },
    ],
    file: [
        { required: false, message: '请输入描述', trigger: 'blur' },
    ],
})

const formatTime = (date, format) => {
    const pad = num => num.toString().padStart(2, '0')
    const replacements = {
        'YYYY': date.getFullYear(),
        'MM': pad(date.getMonth() + 1),
        'DD': pad(date.getDate()),
        'HH': pad(date.getHours()),
        'mm': pad(date.getMinutes()),
        'ss': pad(date.getSeconds())
    }
    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => replacements[match])
}

const customUpload = (options) => {
    if (!options.file) {
        ElMessage({
            type: 'error',
            message: '请选择文件！',
        })
        return
    }
    const formData = new FormData()
    formData.append('file', options.file)
    formData.append('proc_id', proc_id.value)
    formData.append('version_name', ruleForm.version)
    formData.append('type', '0')
    formData.append('desc', ruleForm.description)

    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', e => {
        progressPercent.value = Math.round((e.loaded / e.total) * 100)
    })

    xhr.open('POST', axios.defaults.baseURL + '/processor/upload_package_with_local/', true)
    const token = localStorage.getItem('access_token');
    xhr.setRequestHeader('Authorization', 'Bearer ' + token)

    xhr.onload = () => {
        if (xhr.status === 200) {
            uploadStatus.value = 'success'
            options.onSuccess(xhr.response)
            ElMessage({
                type: 'success',
                message: '文件上传成功',
            })
            emitter.emit("success_upload_processor", "")
        } else {
            uploadStatus.value = 'exception'
            options.onError(new Error('上传失败'))
        }
    }
    xhr.onerror = () => {
        uploadStatus.value = 'exception'
        options.onError(new Error('网络错误'))
    }
    xhr.send(formData)
}

const submitUpload = () => {
    if (!checkVersionValid(ruleForm.version)) {
        ElMessage({
            type: 'error',
            message: '文件版本已经存在，请修改版本号！',
        })
        
        return
    }

    if (fileData.value === null) {
        ElMessage({
            type: 'error',
            message: '请先选择文件！',
        })
        return
    }
    progressVisible.value = true
    uploadRef.value!.submit()
}

const checkVersionValid = (ver) => {
    if (props.proc_verion && props.proc_verion != "") {
        return true
        
    }

    console.log(ver, nowVersionList.value)
    if (nowVersionList.value?.has(ver)) {
        return false
    }

    return true
}

onMounted(() => {
    proc_id.value = props.proc_id
    proc_name.value = props.proc_name
    ruleForm.version = "VER.0.0.0"
    ruleForm.description = '本地上传文件！'
    if (props.desc && props.desc != "") {
        ruleForm.description = props.desc
    }
    
    if (props.proc_verion && props.proc_verion != "") {
        ruleForm.version = props.proc_verion 
    }

    if (props.now_versions) {
        nowVersionList.value = props.now_versions
    }
})

</script>
