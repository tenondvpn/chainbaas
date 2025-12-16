<script lang="ts">
import Tree from './Tree.vue';
import FlowChart from './FlowChart.vue';
import emitter from './EventBus'

const task_info = ref(null)

export default {
    name: 'App',
    components: {
        Tree,
        FlowChart,
    },

    beforeMount() {
        emitter.emit('show_menu', false)
        task_info.value = {
            "pl_id": this.$route.query.pl_id,
            "run_time": this.$route.query.run_time,
        }
    }
};

</script>


<script lang="ts" setup>
import { ref, version as vueVersion } from 'vue'
import { version as EpVersion } from 'element-plus'
import { ElementPlus } from '@element-plus/icons-vue'
import { ElButton } from 'element-plus'
import type { RenderContentContext, RenderContentFunction } from 'element-plus'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import type { TabsInstance } from 'element-plus'

const tabPosition = ref<TabsInstance['tabPosition']>('left')
const hidePane2 = ref(false)

const msg = ref('Hello World!')
const isCollapse = ref(true)
const handleOpen = (key, keyPath) => {
    console.log(key, keyPath)
}
const handleClose = (key, keyPath) => {
    console.log(key, keyPath)
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
                    <FlowChart :show_history_graph="true" :task_info="task_info" />
                </el-main>
            </el-container>
        </el-container>
    </div>



</template>
