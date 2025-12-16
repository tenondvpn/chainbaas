<template>
    <div aria-label="A complete example of page header">
        <el-page-header @back="onBack">
            <template #breadcrumb>
                <el-breadcrumb separator="/">
                    <el-breadcrumb-item v-for="button in file_path">
                        <a href='#'>
                            {{ button }}
                        </a>
                    </el-breadcrumb-item>
                </el-breadcrumb>
            </template>
            <template #content>

            </template>
            <!-- <template #extra>
                <div class="flex items-right">
                    <el-text style="margin-right: 10px;">自动增量获取日志：</el-text>
                    <el-switch v-model="auto_refresh" inline-prompt active-text="是" inactive-text="否" />
                </div>
            </template> -->
            <div v-if="pathList.length > 0" class="button-row" style="margin-top: 10px;">
                <div v-for="button in pathList">
                    <el-link style="margin-left:15px" v-if="button.is_folder" :key="button.text" :type="button.type" 
                        @click="getFileList(button.text)">
                        {{ button.text }}
                    </el-link>
                </div>
            </div>

            <el-divider v-if="pathList.length > 0" border-style="dotted" />
            <div class="button-row" style="margin-top: 10px;">
                <div v-for="button in fileList">
                    <el-link style="margin-left:5px" type="info" v-if="!button.is_folder" :key="button.text" :type="button.type" @click="getFileContent(button.text)">
                        {{ button.text }}
                    </el-link>
                    <el-button plain type="primary" v-if="!button.is_folder" :icon="Download" size="default" circle style="border: 0px;background-color: rgba(0,0,0,0);margin-left: -6px;" @click="download_log(button.text)" />
                </div>
            </div>

        </el-page-header>
        <el-divider style="width: 100%;margin-top: 10px;" />
        <el-input v-model="textarea2" style="width: 100%;margin-top: -25px;" :autosize="{ minRows: 20, maxRows: 40000 }"
            type="textarea" placeholder="没有数据" />
    </div>
</template>

<script setup lang="ts">
import { ElNotification as notify } from 'element-plus'
import {
    Download
} from '@element-plus/icons-vue'

import { ref, onMounted } from 'vue'
import axios from 'axios'
import qs from 'qs'
import { ElMessage } from 'element-plus'

const textarea2 = ref('')
const auto_refresh = ref(false)
const file_path = ref(['根目录'])

const onBack = () => {
    if (file_path.value.length <= 0) {
        return
    }
    file_path.value.pop()
    getFileList("")
}

const fileList = ref([])
const pathList = ref([])

const props = defineProps({
    processor_id: Number,
    upload_id: Number,
});

const download_log = (file_name) => {
    var pre_path = ''
    for (const path of file_path.value) {
        console.log(path)
        if (path == "根目录" || path == "") {
            continue
        }

        pre_path = path + ";" + pre_path
    }


    var url = axios.defaults.baseURL + '/pipeline/download_package/' + props.processor_id + '&' + props.upload_id + '&' + pre_path + file_name + '/'
    window.open(url);

}
const getFileContent = (file_name) => {
    textarea2.value = ""
    var pre_path = ''
    for (const path of file_path.value) {
        console.log(path)
        if (path == "根目录" || path == "") {
            continue
        }

        pre_path = path + "/" + pre_path
    }

    var tmp_file_path = file_name
    if (pre_path != '') {
        tmp_file_path = pre_path + '/' + file_name
    }

    axios
        .post('/pipeline/get_package_content/', qs.stringify({
            'processor_id': props.processor_id,
            'upload_id': props.upload_id,
            'subpath': tmp_file_path,
        }))
        .then(response => {
            console.log(response.data)
            textarea2.value = response.data.file_content
        })
        .catch(error => {
            ElMessage.success("获取文件内容失败：" + error);
        })
}

const getFileList = (parent_path) => {
    textarea2.value = ""
    var sub_path = parent_path
    console.log("0", sub_path, file_path.value.length)
    var pre_path = ''
    for (const path of file_path.value) {
        console.log(path)
        if (path == "根目录" || path == "") {
            continue
        }

        pre_path = path + "/" + pre_path
    }

    if (pre_path != "") {
        sub_path = pre_path + sub_path
    }

    console.log("1", sub_path)
    axios
        .post('/pipeline/get_package_list/', qs.stringify({
            'processor_id': props.processor_id,
            'upload_id': props.upload_id,
            'subpath': sub_path,
        }))
        .then(response => {
            if (response.data.list.length <= 0 || response.data.list[0] == "") {
                ElMessage.success("没有文件！");
                return;
            }

            parent_path = parent_path.slice(0, -1)
            if (parent_path == "") {
                file_path.value = ["根目录"]
            } else {
                file_path.value.push(parent_path)
            }

            console.log(file_path.value.length, file_path.value)
            fileList.value = []
            pathList.value = []
            console.log(response.data)
            for (const item of response.data.list) {
                if (item[item.length - 1] == '/') {
                    pathList.value.push({ type: 'primary', text: item, 'is_folder': true })
                }
            }

            for (const item of response.data.list) {
                if (item[item.length - 1] == '/') {
                } else {
                    fileList.value.push({ type: 'default', text: item, 'is_folder': false })
                }
            }
        })
        .catch(error => {
            ElMessage.success("获取文件失败：" + error);
        })
}

onMounted(() => {
    getFileList("")
});

</script>

<style scoped>
.button-example {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0rem;
    align-items: center;
}

.button-row>* {
    margin: 0;
}
</style>