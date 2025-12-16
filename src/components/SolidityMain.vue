<template>
    <div v-if="!choosed_pipeline">
        <HomeView :project_path="project_path_str" :project_id="project_id" :key="project_path_str"/>
    </div>

    <div :style="{ marginTop: dynamicMargin + 'px' }">
        <Solidity />
    </div>
</template>

<script lang="ts">
import HomeView from './HomeView.vue';
import Solidity from './Solidity.vue';

export default {
    name: 'App',
    components: {
        Solidity,
        HomeView,
    },
};


</script>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import emitter from './EventBus';

const project_path_str = ref('我的任务')
const project_id = ref("46")
const choosed_pipeline = ref(false)
const choosed_pipeline_id = ref('')
const dynamicMargin = ref(10000)
const props = defineProps({
    show_history_graph: Boolean,
    task_info: Map,
});

const emitterOn = () => {
    // 正确接收事件
    emitter.on('show_update_graph', (payload) => {
        update_graph(payload)
    });


    emitter.on('success_delete_pipeline', (payload) => {
        if (payload == choosed_pipeline_id.value) {
            choosed_pipeline.value = false;
            dynamicMargin.value = 10000;
        }
    });

    emitter.on("success_create_pipeline", (payload) => {
        choosed_pipeline.value = true;
        dynamicMargin.value = 0;
        choosed_pipeline_id.value = payload["id"]
        console.log("create pipeline: ", choosed_pipeline_id.value)
    });
}

const emitterOff = () => {
    emitter.off('show_update_graph', null);
    emitter.off('success_delete_pipeline', null);
    emitter.off('success_create_pipeline', null);
}

onMounted(() => {
    emitterOn();
    if (props.show_history_graph) {
        choosed_pipeline.value = true
        dynamicMargin.value = 0;
    }
});

onBeforeUnmount(() => {
    emitterOff();
})


const update_graph = (data) => {
    if (data["tag"] == "-1") {
        choosed_pipeline.value = false;
        dynamicMargin.value = 10000;
        project_path_str.value = data["project_path"]
        project_id.value = data["project_id"]
        choosed_pipeline_id.value = ''
        console.log("0 update_graph: ", project_path_str.value, project_id.value, choosed_pipeline_id.value, data)
        return;
    }

    choosed_pipeline.value = true;
    dynamicMargin.value = 0;
    project_path_str.value = data["project_path"]
    project_id.value = data["project_id"]
    choosed_pipeline_id.value = data["pipe_id"]
    console.log("1 update_graph: ", project_id.value, choosed_pipeline_id.value, data)
}


</script>
