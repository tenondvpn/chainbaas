<template>
    <div class="kpi-dashboard">
    <el-row :gutter="24">
      <el-col
        v-for="card in cards"
        :key="card.title"
        :xs="24" :sm="12" :md="12" :lg="4" :xl="4"
      >
        <div
          class="kpi-card"
          :class="{ clickable: !!card.onClick }"
          @click="handleClick(card)"
        >

          <!-- 背景光晕（纯 CSS 实现） -->
          <div class="glow" :style="{ background: card.glowColor }" />

          <div class="content">
            <!-- 左侧图标区 -->
            <div class="icon-wrapper" :style="{ background: card.iconBg }">
              <el-icon :size="28" ><component :is="card.icon" /></el-icon>
            </div>

            <!-- 右侧数据区 -->
            <div class="info">
              <div class="title">{{ card.title }}</div>
              <div class="value">
                <span class="unit" :key="refreshSt">{{ card.value }}</span>
                <span v-if="card.unit" class="unit">{{ card.unit }}</span>
              </div>
              <!-- <div class="trend" :class="card.trend > 0 ? 'up' : 'down'">
                <el-icon size="14">
                  <ArrowUp v-if="card.trend > 0" />
                  <ArrowDown v-else />
                </el-icon>
                {{ Math.abs(card.trend) }}%
              </div> -->
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
    <el-card v-model="show_task_status" :direction="drawer_direction" size="100%" :destroy-on-close="true" body-class="my-card-body">
        <template #footer >
            <el-row justify="end" >
                <el-col :span="6" style="float: left;">
                    <el-tooltip class="box-item" effect="dark" content="手动刷新数据列表！" style="text-align: left;"
                        placement="top-start">
                        <el-button @click="userRefreshData" style="margin-left: 20px;" type="default" size="default"
                            :icon="Refresh" circle />
                    </el-tooltip>
                    <el-tooltip class="box-item" effect="dark" content="自动刷新数据列表！" style="text-align: left;"
                        placement="top-start">
                        <el-switch style="margin-left: 20px;height: 40px;" size="large" v-model="auto_refresh_task"
                            :active-action-icon="Select" :inactive-action-icon="CloseBold" />
                    </el-tooltip>
                    <el-button-group style="margin-left:20px;">
                    <el-button type="primary" :disabled="!choosed_task" @click="batchRun">批量重跑</el-button>
                    <el-button type="primary" :disabled="!choosed_task" @click="batchStop">批量停止</el-button>
                    </el-button-group>

                </el-col>

                <el-col :span="18">


                        <el-pagination style="margin-left: 196px;float:right" v-model:current-page="currentPage2"
                            v-model:page-size="pageSize2" :page-sizes="[10, 50, 100, 200]" background
                            layout="sizes, prev, pager, next" :total="currentTotalSize" />

                </el-col>
            </el-row>

        </template>
        <template #default >
            <TaskStatusList :table_margin_top="-25" :pipeline_name="pipeline_name" :task_name="task_name" 
                :page_size="pageSize2" />
        </template>
    </el-card>
</template>


<script lang="ts">
import CreateNode from './CreateNode.vue';
import RunPipeline from './RunPipeline.vue';
import TaskStatusList from './TaskStatusList.vue';
import ExportGraph from './ExportGraph.vue'
import { ElMessageBox } from 'element-plus';
import { ElMessage } from 'element-plus';

export default {
    name: 'App',


};

</script>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, h, onUnmounted } from 'vue';
import {
    Select,
    CloseBold,
} from '@element-plus/icons-vue'
import emitter from './EventBus';
import type { DrawerProps } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

import { User, ShoppingCart, Files,Crop,VideoPlay,Wallet,WarnTriangleFilled, Promotion, TrendCharts,SuccessFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import axios from 'axios'
const auto_refresh_task = ref(false)

const drawer_direction = ref<DrawerProps['direction']>('rtl')
const popoverVisible = ref(false);
const pipeline_name = ref('');
const task_name = ref('');
const show_task_status = ref(false)
const choosed_task = ref(false)
const pageSize2 = ref(50)
const currentPage2 = ref(1)
const currentTotalSize = ref(0)
const intervalId = ref(null)
const statisticIntervalId = ref(null)

const st_all_failes_count = ref(0)
const st_all_count = ref(0)
const st_my_create_count = ref(0)
const st_all_my_count = ref(0)
const st_runing_count = ref(0)
const st_handled_count = ref(0)
const refreshSt = ref(0)

import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'

const cards = ref([
{
    title: '失败任务数',
    value: st_all_failes_count,
    unit: '个',
    trend: 18.9,
    icon: WarnTriangleFilled,
    iconBg: 'rgba(249, 0, 0, 0.15)',
    glowColor: 'rgba(252, 0, 0, 0.25)',
    onClick: () =>  {
        emitter.emit('change_search_status', [3])
    }
  },
  {
    title: '总计运行流程',
    value: st_all_count,
    unit: '个',
    trend: 18.9,
    icon: Files,
    iconBg: 'rgba(102, 126, 234, 0.15)',
    glowColor: 'rgba(102, 126, 234, 0.25)',
    onClick: () => {
        emitter.emit('change_search_status', [0, 1, 2, 3, 4, 5, 6, 7])
    }
  },
  {
    title: '我负责的流程',
    value: st_all_my_count,
    unit: '个',
    trend: 12.5,
    icon: User,
    iconBg: 'rgba(56, 217, 169, 0.15)',
    glowColor: 'rgba(56, 217, 169, 0.25)',
    onClick: () => {
        emitter.emit('change_search_owner', 1)
    }
  },
  {
    title: '我创建的流程',
    unit: '个',
    value: st_my_create_count,
    trend: -2.3,
    icon: Crop,
    iconBg: 'rgba(250, 173, 20, 0.15)',
    glowColor: 'rgba(250, 173, 20, 0.25)',
    onClick: () => {
        emitter.emit('change_search_owner', 2)
    }
  },
  {
    title: '运行中的任务',
    value: st_runing_count,
    unit: '个',
    trend: 8.1,
    icon: VideoPlay,
    iconBg: 'rgba(152, 253, 134, 0.25)',
    glowColor: 'rgba(152, 253, 134, 0.25)',
    onClick: () => {
        emitter.emit('change_search_status', [0, 1, 5])
    }
  },
  {
    title: '成功任务数',
    value: st_handled_count,
    unit: '个',
    trend: 12.5,
    icon: SuccessFilled,
    iconBg: 'rgba(56, 217, 169, 0.15)',
    glowColor: 'rgba(210, 222, 219, 0.25)',
    onClick: () => {
        emitter.emit('change_search_status', [2])
    }
  }
])

const getStatistics = () => {
    axios
        .get('/pipeline/get_statistics/', {
            params: {
                "type": 0
            }
        })
        .then(response => {
            console.log(response.data)
            st_all_failes_count.value = response.data['all_failes_count']
            st_all_count.value = response.data['all_count']
            st_all_my_count.value = response.data['all_my_count']
            st_my_create_count.value = response.data['my_create_count']
            st_runing_count.value = response.data['runing_count']
            st_handled_count.value = response.data['handled_count']
            refreshSt.val += 1
        })
        .catch(error => console.log(error))
}

const handleClick = (card) => {
  card.onClick?.()
}

const handleDocumentClick = (e) => {
    const popperEl = document.querySelector('.context-menu-popover');
    if (popperEl && !popperEl.contains(e.target) && popoverVisible.value) {
        popoverVisible.value = false;
    }
};

const emitterOn = () => {
    emitter.on('success_load_task_table_data', (tasks_info) => {
        currentTotalSize.value = tasks_info.recordsTotal
    });

    emitter.on('table_selected_changed', (checked_length) => {
        if (checked_length > 0) {
            choosed_task.value = true
        } else {
            choosed_task.value = false
        }
    })
}

const emitterOff = () => {
    emitter.off('success_load_task_table_data', null);
    emitter.off('success_load_task_table_data', null);
}


const batchRun = () => {
    emitter.emit('batch_run_table_tasks', '');
}

const batchStop = () => {
    emitter.emit('batch_stop_table_tasks', '');
}

watch(currentPage2, (newVal) => {
    emitter.emit('reload_task_table_data_with_page', newVal)
})

watch(pageSize2, (newVal) => {
    emitter.emit('reload_task_table_data_with_page_size', newVal)
})

watch(auto_refresh_task, (newVal) => {
    if (newVal) {
        intervalId.value = window.setInterval(() => {
            emitter.emit('user_refresh_table_data', '')
        }, 5000)
    } else {
        clearInterval(intervalId.value)
    }
})

const userRefreshData = () => {
    emitter.emit('user_refresh_table_data', '')
}

// Initialize on mount
onMounted(() => {
    emitterOn()
    getStatistics()
    show_task_status.value = true
    document.addEventListener('click', handleDocumentClick);
    clearInterval(intervalId.value)
    if (auto_refresh_task.value) {
        intervalId.value = window.setInterval(() => {
            emitter.emit('user_refresh_table_data', '')
        }, 5000)
    }

    statisticIntervalId.value = window.setInterval(() => {
        getStatistics()
    }, 3000)
});

onBeforeUnmount(() => {
    emitterOff()
    window.clearInterval(intervalId.value)
    clearInterval(statisticIntervalId.value)
})

onUnmounted(() => {
    window.clearInterval(intervalId.value)
})

</script>

<style scoped>
:global(.custom-dragging-style.is-dragging) {
    border: 2px dashed var(--el-color-primary);
    opacity: 0.65;
}

.affix-container {
    text-align: center;
    z-index: 1000;
    height: 400px;
    border-radius: 4px;
    background: var(--el-color-primary-light-9);
}

.fixed-right {
    position: fixed;
    right: 9px;
    top: -100px;
}

.containerDark {
    display: flex;
    border: 1px solid #4c4d4f;
}

.containerLight {
    display: flex;
    border: 1px solid #dddfe6;
}

.x6-container {
    width: 100%;
    height: 500px;
    border: 1px solid #ccc;
}

.menu-list {
    padding: 0;
}

.menu-item {
    padding: 8px 12px;
    cursor: pointer;
    white-space: nowrap;
}

.menu-item:hover {
    background-color: #f5f5f5;
}

/* 1. 自定义紫色按钮 */
:deep(.is-purple) {
    --el-button-bg-color: #7a36f8;
    --el-button-border-color: #7a36f8;
    --el-button-text-color: #fff;
    --el-button-hover-bg-color: #8c57fc;
    --el-button-hover-border-color: #8c57fc;
    --el-button-active-bg-color: #6a2ad1;
    --el-button-active-border-color: #6a2ad1;
}

/* 2. 自定义粉色按钮 */
:deep(.is-pink) {
    --el-button-bg-color: #ff69b4;
    --el-button-border-color: #ff69b4;
    --el-button-text-color: #fff;
    --el-button-hover-bg-color: #ff85c2;
    --el-button-hover-border-color: #ff85c2;
    --el-button-active-bg-color: #e55ba0;
    --el-button-active-border-color: #e55ba0;
}

::v-deep .my-icon-kucun {
    background: '/images/shell.png';
    font-size: 12px;
    background-size: cover;
}


.custom-icon {
    width: 20px;
    height: 20px;
    vertical-align: -0.125em;
    /* 对齐文本 */
}


.custom-drawer :deep(.el-drawer__header) {
    margin-bottom: 0 !important;
    /* 移除默认32px间距 */
    padding: 16px;
    /* 自定义内边距 */
    border-bottom: 1px solid #eee;
    /* 添加底部边框 */
}


</style>

<style>

.my-card-body {
  padding: 0px!important;
}
/* 关键样式: 在非作用域样式中，使用变量和 !important 覆盖默认行为 */
.context-menu-popover {
    position: fixed !important;
    left: var(--popover-x) !important;
    top: var(--popover-y) !important;
    transform: none !important;
}

.el-drawer__header {
    margin-bottom: 0px !important;
    border-bottom: 1px solid var(--el-color-info);
}
.kpi-dashboard {
  padding: 8px 0;
}

.kpi-card {
  position: relative;
  height: 86px;
  margin: 12px 0;
  border-radius: 16px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color);
  overflow: hidden;
  cursor: default;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.kpi-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.kpi-card.clickable {
  cursor: pointer;
}

/* 背景光晕 */
.glow {
  position: absolute;
  inset: 0;
  filter: blur(40px);
  opacity: 0.6;
  transform: translateY(30px);
}

/* 内容区 */
.content {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 20px;
}

.icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-primary);
}

.info {
  flex: 1;
}

.title {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.value {
  font-size: 28px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.unit {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.trend {
  margin-top: 6px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.trend.up { color: #38d9a9; }
.trend.down { color: #eb5757; }

/* 暗黑模式自动适配 */
html.dark .kpi-card {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}
</style>