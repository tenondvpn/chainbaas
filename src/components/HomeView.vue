<template>
  <el-empty style="margin-top: 100px;">
    <el-text class="mx-1" type="primary">当前项目路径：{{ project_path }}</el-text>
    <el-divider border-style="dashed" />
    <el-button v-if="is_processor" size="large" type="primary" :icon="Plus" @click="crate_pipeline">创建模板任务</el-button>
    <el-button v-else size="large" type="primary" :icon="Plus" @click="crate_pipeline">创建流程</el-button>
  </el-empty>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import emitter from './EventBus';
import { onMounted, ref, onBeforeUnmount } from 'vue';

const props = defineProps({
    project_path: String,
    project_id: String,
    is_processor: Boolean,
});

const is_processor = ref(false)
const project_id = ref(-1)
const project_path = ref('')

const crate_pipeline = () => {
    if (!is_processor.value) {
        console.log("props.project_id: ", props.project_id)
        emitter.emit("home_view_click_create_pipeline", project_id.value)
    } else {
        emitter.emit("home_view_click_create_processor", {
            "processor": {
                "project_id": project_id.value,
                "name": project_path.value,
            }
        })
    }
}

const emitterOn = () => {
    // emitter.on('upate_processor_to_show_detail', (payload) => {
    //     console.log("00001 upate_processor_to_show_detail coming.")
    //     project_id.value = Number(payload['project_id'])
    //     project_path.value = payload['project_path']
    // });
}

const emitterOff = () => {
    // emitter.off('upate_processor_to_show_detail', null);
}

onMounted(() => {
    emitterOn()
    is_processor.value = props.is_processor
    project_id.value = Number(props.project_id)
    project_path.value = props.project_path
    console.log("home view coming: ", props.project_id, props.project_path)
});

onBeforeUnmount(() => {
    emitterOff()
})

</script>