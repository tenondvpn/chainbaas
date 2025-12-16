<script lang="ts">
import Header from './components/Header.vue';
import Tree from './components/TreeV5.vue';
import FlowChart from './components/FlowChart.vue';
import Pipeline from './components/Pipeline.vue';
import Carousel from './components/Carousel.vue';

export default {
    name: 'App',
    components: {
        Header,
        Tree,
        FlowChart,
        Pipeline,
        Carousel,
    },
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
            <el-header>
                <Header />
            </el-header>
            <el-container style="margin-top: -27px;">
                <el-main>
                    <splitpanes horizontal :push-other-panes="true" style="height: 88vh;">
                        <pane>
                            <splitpanes :push-other-panes="false">
                                <pane size="25">
                                    <Tree />
                                </pane>
                                <pane size="75">
                                    <FlowChart />
                                </pane>
                            </splitpanes>
                        </pane>
                    </splitpanes>
                </el-main>
                <el-footer>
                    <el-row :gutter="20">
                        <el-col :span="10" :offset="2">
                            <div class="grid-content ep-bg-purple" />
                            <el-text class="mx-1" ><strong>Copyright © Shardora+ 2025</strong> All rights reserved.</el-text>
                        </el-col>
                        <el-col :span="4" :offset="8">
                            <div class="grid-content ep-bg-purple" />
                            <el-text class="mx-1" ><b>Version</b> 1.0.0</el-text>
                            
                        </el-col>
                    </el-row>
                </el-footer>
            </el-container>
        </el-container>
    </div>



</template>
