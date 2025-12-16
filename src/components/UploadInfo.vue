<template>
    <el-form label-position="right" label-width="auto" style="max-width: 900px">
        <el-text v-if="uploaded" type="default" class="mx-1"> {{ upload_info }}pass=</el-text>
        <el-text v-if="uploaded" type="danger" class="mx-1">${password}</el-text>
        <el-text v-if="uploaded" type="default" class="mx-1">" -F "proc_name={{ proc_name }}" -F "package=@</el-text>
        <el-text v-if="uploaded" type="danger" class="mx-1">${package}</el-text>
        <el-text v-if="uploaded" type="default" class="mx-1">" -F "version_name=</el-text>
        <el-text v-if="uploaded" type="danger" class="mx-1">${version_name}</el-text>
        <el-text v-if="uploaded" type="default" class="mx-1">" -F "description=</el-text>
        <el-text v-if="uploaded" type="danger" class="mx-1">${description}</el-text>
        <el-text v-if="uploaded" type="default" class="mx-1">"</el-text>
        <el-divider />
        <el-button plain :icon="CopyDocument" style="margin-top: 30px;" type="primary"
            @click="copy_command">点击复制</el-button>
        <el-divider />
        <el-alert type="info" show-icon :closable="false">
            <p>命令参数说明:</p>
            <p>命令中所有标红的部分需要手动修改：</p>
            <p>1.${password} 系统的登陆密码，上传是进行权限效验</p>
            <p>2.${package_name} 开发机本地绝对路径或者相对路径比如: /root/test/test.tar.gz</p>
            <p>3.${version_name} 算子版本名，如果是已有的版本，则直接覆盖；输入新版本名，则新建一个版本</p>
            <p>4.${description} 本次上传包的描述信息，记录操作历史方便管理，可以为空</p>
        </el-alert>
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

const props = defineProps({
    proc_name: String,
});

const proc_name = ref()
const upload_info = ref()
const full_upload_info = ref()
const uploaded = ref(false)
const itemLabelPosition = ref<FormItemProps['labelPosition']>('')
const { toClipboard } = useClipboard();

const copy_command = () => {
    try {
        toClipboard(full_upload_info.value);
        ElMessage({
            type: 'success',
            message: '复制成功！',
        })
    } catch (e) {
        console.error('复制失败', e);
        ElMessage({
            type: 'error',
            message: '复制失败' + e,
        })
    }
}

const get_upload_cmd = () => {
    axios
        .post('/processor/get_upload_cmd/', qs.stringify({
            "proc_name": proc_name.value
        }))
        .then(response => {
            if (response.status != 200) {
            } else {
                full_upload_info.value = response.data.cmd.replaceAll("<font color=red>", "").replaceAll("</font>", "");
                upload_info.value = response.data.cmd.split('pass=')[0]
                console.log("upload_info", upload_info.value)
                uploaded.value = true
            }
        })
        .catch(error => {
            console.log(error)
        })
}
onMounted(() => {
    proc_name.value = props.proc_name
    get_upload_cmd()
})

</script>
