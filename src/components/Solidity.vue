<script lang="ts">
import Tree from './Tree.vue';
import FlowChart from './FlowChart.vue';
import SolidityEditor from './SolidityEditor.vue';
import SolidityStatus from './SolidityStatus.vue';
import { update } from 'lodash';
import emitter from './EventBus';
import { onMounted, onBeforeUnmount } from 'vue';
import { ref } from 'vue';
import { nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import SolidityTree from './SolidityTree.vue';

export default {
    name: 'App',
    components: {
        Tree,
        FlowChart,
    },
};
</script>


<script lang="ts" setup>
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useEventListener } from '@vueuse/core'
import HomeView from './HomeView.vue';

const dynamicTreeHeight = ref(1000)

const solidity_editor = ref();
const solidity_status = ref();

useEventListener(window, 'resize', () => {
    dynamicTreeHeight.value = window.innerHeight - 47
})

const handleResize = (index: number, sizes: number[]) => {
    emitter.emit('update_soldity_height', sizes[0]);
    emitter.emit('update_soldity_status_height', sizes[1]);
}

const winHandleResize = () => {
    emitter.emit('update_soldity_height', solidity_editor.value.$refs.panelEl.offsetHeight);
    emitter.emit('update_soldity_status_height', solidity_status.value.$refs.panelEl.offsetHeight);
    setTimeout(() => {
        winHandleResize();
    }, 300);
}

onMounted(() => {
    dynamicTreeHeight.value = window.innerHeight - 47
    window.addEventListener('resize', winHandleResize);
    // // 初始化时触发一次调整
    nextTick(() => {
        winHandleResize();
    });
    // setTimeout(() => {
    //     winHandleResize();
    // }, 100);

    emitterOn();
    if (props.show_history_graph) {
        choosed_pipeline.value = true
        dynamicMargin.value = 0;
    }
});


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

<style>
.splitpanes--vertical>.splitpanes__splitter {
    min-width: 6px;
    cursor: col-resize;
}

.splitpanes--vertical>.splitpanes__splitter:before {
    margin-left: -2px;
}

.splitpanes--vertical>.splitpanes__splitter:after {
    transform: translateY(-50%);
    width: 1px;
    height: 50px;
    content: "";
    position: absolute;
    top: 40%;
    /* left: 0; */
    background-color: #00000026;
    border: 1px solid #ffffff;
    transition: background-color .3s;
}

.el-main {
    --el-main-padding: 0px;
    box-sizing: border-box;
    display: block;
    flex: 1;
    flex-basis: auto;
    overflow: auto;
    /* padding: var(--el-main-padding); */
    padding-top: 10px;
}

/* .demo-tabs > .el-tabs__content {
  padding: 32px;
  color: #6b778c;
  font-size: 32px;
  font-weight: 600;
} */

.el-tabs--right .el-tabs__content,
.el-tabs--left .el-tabs__content {
    height: 100%;
}
</style>

<template>
    <div class="common-layout">
        <el-container>
            <el-container style="margin-top: 0px;">
                <el-main style="padding: 0px;">
                    <splitpanes horizontal :push-other-panes="true" style="height: 100vh;">
                        <pane>
                            <splitpanes vertical :push-other-panes="true">
                                <pane size="25">
                                    <SolidityTree />
                                </pane>
                                <pane size="75">
                                    <div v-if="!choosed_pipeline">
                                        <HomeView :project_path="project_path_str" :project_id="project_id" :key="project_path_str"/>
                                    </div>
                                    <div :style="`height: ${dynamicTreeHeight}px;box-shadow: var(--el-border-color-light) 0px 0px 10px;margin-top: ${dynamicMargin}px`">
                                        <el-splitter layout="vertical" @resize="handleResize" style="height: 100%;">
                                            <el-splitter-panel size="81%" ref="solidity_editor">
                                                <SolidityEditor />
                                            </el-splitter-panel>
                                            <el-splitter-panel size="29%" ref="solidity_status">
                                                <SolidityStatus />
                                            </el-splitter-panel>
                                        </el-splitter>
                                    </div>
                                </pane>
                            </splitpanes>
                        </pane>
                    </splitpanes>
                </el-main>

            </el-container>
        </el-container>
    </div>

</template>



<style lang="css" scoped>
.demo-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
}
</style>
