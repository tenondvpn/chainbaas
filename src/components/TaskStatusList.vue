<template>
  <!-- <el-skeleton v-if="isLoading" :rows="10" animated /> -->
  <el-table
    v-loading="isLoading"
    ref="multipleTableRef"
    border
    :data="tableData"
    row-key="id"
    :style="`width: 100%; margin-top: ${table_margin_top}px padding:0px`"
    style="width: 100%"
    table-layout="auto"
    :max-height="`${dynamicListHeight}px`"
    element-loading-text="数据加载中"
    element-loading-spinner="el-icon-loading"
    @header-click="handleHeaderClick"
    @sort-change="handleSortChange"
    element-loading-background="rgba(0,0,0,0.3)"
    @selection-change="handleSelectionChange"
    :default-sort="{ prop: 'start_time', order: 'descending' }"
  >
    <template #overlay>
      <div
        class="el-loading-mask"
        style="display: flex; align-items: center; justify-content: center"
      >
        <el-icon class="is-loading" color="var(--el-color-primary)" :size="26">
          <loading-icon />
        </el-icon>
      </div>
    </template>
    <el-table-column type="selection" width="35" align="center" />

    <el-table-column
      label="执行时间"
      column-key="run_time"
      min-width="10%"
      sortable="custom"
      header-align="center"
    >
      <template #header>
        <span style="color: var(--el-color-primary)">执行时间</span>
        <el-input
          clearable
          v-model="run_time_search"
          size="small"
          style="float: right; margin-top: 10px"
          placeholder="搜索"
          :prefix-icon="Search"
          @change="changeRunTime"
        />
      </template>
      <template #default="scope">{{ scope.row.run_time }}</template>
    </el-table-column>

    <el-table-column
      label="流程名"
      column-key="pl_name"
      min-width="20%"
      sortable
      header-align="center"
    >
      <template #header>
        <span style="color: var(--el-color-primary)">流程组</span>
        <el-input
          clearable
          v-model="pl_name_search"
          size="small"
          style="float: right; margin-top: 10px"
          placeholder="搜索"
          :prefix-icon="Search"
          @change="changePipelineName"
        />
      </template>
      <template #default="scope">
        <el-link type="primary" @click="click_pipeline(scope.row)">{{
          scope.row.pl_name
        }}</el-link>
      </template>
    </el-table-column>

    <el-table-column
      label="任务名"
      column-key="task_name"
      min-width="20%"
      sortable
      header-align="center"
    >
      <template #header>
        <span style="color: var(--el-color-primary)">任务名</span>
        <el-input
          clearable
          v-model="task_name_search"
          size="small"
          style="float: right; margin-top: 10px"
          placeholder="搜索"
          :prefix-icon="Search"
          @change="changeTaskName"
        />
      </template>
      <template #default="scope">
        <el-link type="primary" @click="click_task(scope.row)">{{
          scope.row.task_name
        }}</el-link>
      </template>
    </el-table-column>

    <el-table-column
      label="状态"
      column-key="status"
      min-width="10%"
      sortable
      header-align="center"
      align="center"
    >
      <template #header>
        <span style="color: var(--el-color-primary)">状态</span>
        <el-select
          size="small"
          v-model="status_value"
          clearable
          multiple
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="1"
          placeholder="选择状态"
          style="width: 100%; float: right; margin-top: 10px"
        >
          <template #header>
            <el-checkbox
              v-model="checkAll"
              :indeterminate="indeterminate"
              @change="handleCheckAll"
            >
              所有状态
            </el-checkbox>
          </template>
          <el-option
            v-for="item in status_options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </template>
      <template #default="scope">
        <el-tag v-if="scope.row.status == 0" type="warning">等待中</el-tag>
        <el-tag v-if="scope.row.status == 1" type="primary">正在执行</el-tag>
        <el-tag v-if="scope.row.status == 2" type="success">执行成功</el-tag>
        <el-tag v-if="scope.row.status == 3" type="danger">执行失败</el-tag>
        <el-tag v-if="scope.row.status == 4" type="danger">运行超时</el-tag>
        <el-tag v-if="scope.row.status == 5" type="warning">等待调度</el-tag>
        <el-tag v-if="scope.row.status == 6" type="danger">停止</el-tag>
        <el-tag v-if="scope.row.status == 7" type="danger">上游失败</el-tag>
      </template>
    </el-table-column>

    <el-table-column
      prop="start_time"
      sortable
      column-key="start_time"
      label="开始时间"
      min-width="10%"
      header-align="center"
    >
      <template #header>
        <span style="color: var(--el-color-primary)">开始时间</span>
        <el-row
          style="float: right; margin-top: 10px; width: 100%; margin-right: 0px"
        >
          <el-col :span="6">
            <el-select
              size="small"
              v-model="start_time_select"
              style="width: 100%"
              placeholder="="
              @change="changeStartTimeOper"
            >
              <el-option key=">" label=">" value=">" />
              <el-option key=">=" label=">=" value=">=" />
              <el-option key="=" label="=" value="=" />
              <el-option key="<=" label="<=" value="<=" />
              <el-option key="<" label="<" value="<" />
              <el-option key="!=" label="!=" value="1=" />
            </el-select>
          </el-col>
          <el-col :span="18">
            <el-date-picker
              size="small"
              style="width: 100%"
              v-model="start_time_begin"
              type="datetime"
              placeholder="选择时间"
              format="YYYY-MM-DD hh:mm"
              value-format="YYYY-MM-DD hh:mm:ss"
              @change="changeStartTime"
            />
          </el-col>
        </el-row>
      </template>
      <template #default="scope">{{ scope.row.start_time }}</template>
    </el-table-column>
    <el-table-column
      sortable
      column-key="use_time"
      label="耗时"
      min-width="10%"
      header-align="center"
      align="center"
    >
      <template #header>
        <span style="color: var(--el-color-primary)">耗时</span>
        <el-row
          style="float: right; margin-top: 10px; width: 100%; margin-right: 0px"
        >
          <el-col :span="8">
            <el-select
              size="small"
              v-model="use_time_select"
              style="width: 100%"
              placeholder="="
              @change="useTimeSecondOprChange"
            >
              <el-option key=">" label=">" value=">" />
              <el-option key=">=" label=">=" value=">=" />
              <el-option key="=" label="=" value="=" />
              <el-option key="<=" label="<=" value="<=" />
              <el-option key="<" label="<" value="<" />
              <el-option key="!=" label="!=" value="1=" />
            </el-select>
          </el-col>
          <el-col :span="16">
            <el-input-number
              size="small"
              v-model="use_time_seconds"
              style="width: 100%"
              :min="0"
              :max="100000000"
              @change="useTimeSecondChange"
            >
              <template #suffix>
                <span>秒</span>
              </template>
            </el-input-number>
          </el-col>
        </el-row>
      </template>
      <template #default="scope">
        <el-tag type="warning">{{ getUseTime(scope.row.use_time) }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column
      label="执行操作"
      min-width="10%"
      header-align="center"
      align="center"
    >
      <template #header>
        <span style="color: var(--el-color-primary)">执行操作</span>
      </template>
      <template #default="scope">
        <el-button
          plain
          size="small"
          type="danger"
          @click="stopTask(scope.row)"
          v-if="
            scope.row.status == 0 ||
            scope.row.status == 5 ||
            scope.row.status == 1
          "
        >
          停止运行
        </el-button>
        <el-dropdown
          v-else-if="scope.row.status == 2"
          plain
          split-button
          size="small"
          type="primary"
          v-model="command_items[scope.$index]"
          style="width: 110px"
          @click="runSingleTask(scope.$index, scope.row)"
        >
          重跑任务
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click.native="runAll(scope.$index, scope.row)"
                >完全重跑</el-dropdown-item
              >
              <el-dropdown-item
                @click.native="runAllNext(scope.$index, scope.row)"
                >重跑当前及后续</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown
          v-else
          plain
          split-button
          size="small"
          type="primary"
          v-model="command_items[scope.$index]"
          style="width: 110px"
          @click="runSingleTask(scope.$index, scope.row)"
        >
          重新运行
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click.native="runAll(scope.$index, scope.row)"
                >完全重跑</el-dropdown-item
              >
              <el-dropdown-item
                @click.native="runAllNext(scope.$index, scope.row)"
                >重跑当前及后续</el-dropdown-item
              >
              <el-dropdown-item
                @click.native="setSuccess(scope.$index, scope.row)"
                >设为成功</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </el-table-column>
    <el-table-column
      label="任务管理"
      header-align="center"
      align="center"
      min-width="20%"
    >
      <template #header>
        <span style="color: var(--el-color-primary)">任务管理</span>
      </template>
      <template #default="scope" style="text-align: center">
        <el-button-group style="text-align: center">
          <el-button plain size="small" type="primary" @click="clickShowGraph(scope.row)">
                        状态追踪
                    </el-button>
          <el-button
            v-if="
              scope.row.status == 2 ||
              scope.row.status == 3 ||
              scope.row.status == 1
            "
            plain
            size="small"
            type="primary"
            @click="clickShowLog(scope.row)"
          >
            查看日志
          </el-button>
        </el-button-group>
      </template>
    </el-table-column>

    <template #empty>
      <div v-if="!isLoading" class="flex items-center justify-center h-100%">
        <el-empty />
      </div>
    </template>
  </el-table>

  <el-drawer
    v-model="createPipeline"
    :direction="drawer_direction"
    size="50%"
    :destroy-on-close="true"
    :append-to-body="true"
  >
    <template #header>
      <h4>更新流程信息</h4>
    </template>
    <template #default>
      <CreatePipelineVue :pipeline_info="pipeline_info" />
    </template>
  </el-drawer>

  <el-drawer
    v-model="show_task_vue"
    :direction="drawer_direction"
    size="50%"
    :destroy-on-close="true"
    :append-to-body="true"
  >
    <template #header>
      <h4 style="width: 100px">更新任务配置</h4>
    </template>
    <template #default>
      <CreateNode
        :pipeline_id="pipeline_id"
        :task_info="clicked_task_info"
        :task_type="taskType"
        :update_task="true"
      />
    </template>
  </el-drawer>

  <el-drawer
    v-model="show_history_graph"
    :direction="drawer_direction"
    size="100%"
    :destroy-on-close="true"
    :append-to-body="true"
  >
    <template #header>
      <h4 style="width: 100px">状态追踪</h4>
    </template>
    <template #default>
      <HistoryGraph :graph_info="history_graph_info" />
    </template>
  </el-drawer>

  <el-drawer
    v-model="show_log_info"
    :direction="drawer_direction"
    size="80%"
    :destroy-on-close="true"
    :append-to-body="true"
  >
    <template #header>
      <h4 style="width: 100px"></h4>
    </template>
    <template #default>
      <LogInfo :schedule_id="clicked_schedule_id" />
    </template>
  </el-drawer>

  <el-dialog v-model="history_graph_show" fullscreen title="全流程状态追踪">
    <div class="iframe-container" style="border: 0px">
      <iframe
        :src="history_graph_url"
        width="100%"
        height="100%"
        frameborder="0"
        sandbox="allow-scripts allow-same-origin allow-popups"
      ></iframe>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import {
  ref,
  watch,
  onMounted,
  onUnmounted,
  onDeactivated,
  onBeforeUnmount,
} from "vue";
import type { TableInstance, CheckboxValueType } from "element-plus";
import { Search } from "@element-plus/icons-vue";
import axios from "axios";
import { defineProps } from "vue";
import qs from "qs";
import emitter from "./EventBus";
import { ElMessageBox } from "element-plus";
import { ElMention } from "element-plus";
import { ElMessage } from "element-plus";
import { DrawerProps } from "element-plus";
import { useEventListener } from "@vueuse/core";

interface HistoryInfo {
  id: number;
  task_id: number;
  run_time: string;
  pl_id: number;
  start_time: string;
  status: number;
  schedule_id: number;
  pl_name: string;
  task_name: string;
  use_time: number;
  cpu: number;
  mem: number;
  operation: string;
}

const props = defineProps({
  pipeline_name: String,
  task_name: String,
  page_size: Number,
  auto_refresh: Boolean,
  table_margin_top: Number,
  is_graph_task_list: Boolean,
});

// const multipleTableRef = ref<TableInstance>()
const dynamicListHeight = ref(1000);
const project_path = ref("我的流程");
const project_id = ref("1");
const show_task_vue = ref(false);
const drawer_direction = ref<DrawerProps["direction"]>("rtl");
const multipleSelection = ref<HistoryInfo[]>([]);
const run_time_search = ref("");
const pl_name_search = ref("");
const task_name_search = ref("");
const command_items = ref([]);
const auto_refresh = ref(false);

const checkAll = ref(true);
const indeterminate = ref(false);
const status_value = ref<CheckboxValueType[]>([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
]);
const start_time_begin = ref("");
const start_time_select = ref(">=");
const use_time_select = ref(">");
const use_time_seconds = ref(0);
const curPage = ref(1);
const curPageSize = ref(50);
const intervalId = ref(null);
const order_name = ref("start_time");
const order_type = ref("desc");
const isLoading = ref(true);
const pipeline_id = ref(-1);
const clicked_task_info = ref({});
const taskType = ref(0);
const createPipeline = ref(false);
const pipeline_info = ref({});
const show_history_graph = ref(false);
const history_graph_info = ref({});
const history_graph_show = ref(false);
const history_graph_url = ref("");
const show_log_info = ref(false);
const clicked_schedule_id = ref(0);
const table_margin_top = ref(0);
const search_owner_type = ref(0);
const is_graph_task_list_ref = ref(false);

watch(status_value, (val) => {
  if (val.length === 0) {
    checkAll.value = false;
    indeterminate.value = false;
  } else if (val.length === status_options.value.length) {
    checkAll.value = true;
    indeterminate.value = false;
  } else {
    indeterminate.value = true;
  }

  load_data((curPage.value - 1) * curPageSize.value);
});

const getUseTime = (use_time) => {
  if (use_time <= 60) {
    return use_time + "秒";
  } else if (use_time > 60 && use_time < 3600) {
    var mm = parseInt(use_time / 60);
    var hh = use_time - mm * 60;
    return mm + "分" + hh + "秒";
  } else if (use_time >= 3600) {
    var h = parseInt(use_time / 3600);
    var lm = use_time - h * 3600;
    var m = parseInt(lm / 60);
    var sec = lm - m * 60;
    return h + "小时" + m + "分" + sec + "秒";
  }
};

const clickShowLog = (task_info) => {
  show_log_info.value = true;
  clicked_schedule_id.value = task_info.schedule_id;
};

const clickShowGraph = (task_info) => {
  const resolved = router.resolve(
    "/historyGraph/?pl_id=" +
      task_info.pl_id +
      "&run_time=" +
      task_info.run_time
  );
  history_graph_url.value = resolved.href;
  history_graph_show.value = true;
  // window.open(resolved.href, '_blank')
};

const click_pipeline = (task_info) => {
  axios
    .post(
      "/pipeline/get_pipeline_detail/",
      qs.stringify({
        pipe_id: task_info.pl_id,
      })
    )
    .then((response) => {
      pipeline_info.value = response.data;
      if (response.data.email_to != "") {
        pipeline_info.value.monitor_way |= 1;
      }

      if (response.data.sms_to != "") {
        pipeline_info.value.monitor_way |= 2;
      }

      project_id.value = pipeline_info.value.project_id;
      project_path.value = pipeline_info.value.project_name;
      createPipeline.value = true;
    })
    .catch((error) => {
      console.log(error);
      emitter.emit("update_graph", "-1");
    });
};

const click_task = (task_info) => {
  axios
    .get("/pipeline/get_task_detail/" + task_info.task_id + "/", {
      params: {},
    })
    .then((response) => {
      pipeline_id.value = task_info.pl_id;
      clicked_task_info.value = response.data;
      show_task_vue.value = true;
      taskType.value = response.data.processor.type;
      console.log(response.data);
    })
    .catch((error) => console.log(error));
};

const handleCheckAll = (val: CheckboxValueType) => {
  indeterminate.value = false;
  if (val) {
    status_value.value = status_options.value.map((_) => _.value);
  } else {
    status_value.value = [];
  }
};

const stopTask = (task_info) => {
  ElMessageBox.confirm("确定要终止任务执行吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  })
    .then(() => {
      axios
        .post(
          "/pipeline/stop_task/",
          qs.stringify({
            task_id: "" + task_info.task_id,
            run_time: task_info.run_time,
          })
        )
        .then((response) => {
          ElMessage.success("重跑任务成功！");
          load_data((curPage.value - 1) * curPageSize.value);
        })
        .catch((error) => {
          ElMessage.success("重跑任务失败：" + error);
        });
    })
    .catch((error) => {});
};

const runSingleTask = (index, task_info) => {
  ElMessageBox.confirm("确定要重新执行任务吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  })
    .then(() => {
      axios
        .post(
          "/pipeline/run_one_task/",
          qs.stringify({
            task_id_list: "" + task_info.task_id,
            run_time: task_info.run_time,
          })
        )
        .then((response) => {
          ElMessage.success("重跑任务成功！");
          load_data((curPage.value - 1) * curPageSize.value);
        })
        .catch((error) => {
          ElMessage.success("重跑任务失败：" + error);
        });
    })
    .catch((error) => {});
};

const runAll = (index, task_info) => {
  ElMessageBox.confirm("确定要重新执行整个流程吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  })
    .then(() => {
      axios
        .post(
          "/pipeline/run_one_pipeline/",
          qs.stringify({
            pl_id_list: "" + task_info.pl_id,
            run_time: task_info.run_time,
          })
        )
        .then((response) => {
          ElMessage.success("重跑流程成功！");
          load_data((curPage.value - 1) * curPageSize.value);
        })
        .catch((error) => {
          ElMessage.success("重跑流程失败：" + error);
        });
    })
    .catch((error) => {});
};

const runAllNext = (index, task_info) => {
    ElMessageBox.confirm("确定要重新执行任务以及其后续任务吗？", "提示", {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
    })
    .then(() => {
      axios
        .post(
          "/pipeline/run_task_with_all_successors/",
          qs.stringify({
            task_id_list: "" + task_info.task_id,
            run_time: task_info.run_time,
          })
        )
        .then((response) => {
          ElMessage.success("重跑任务成功！");
          load_data((curPage.value - 1) * curPageSize.value);
        })
        .catch((error) => {
          ElMessage.success("重跑任务失败：" + error);
        });
    })
    .catch((error) => {});
};

const setSuccess = (index, task_info) => {
  ElMessageBox.confirm("确定要将任务设置为成功吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  })
    .then(() => {
      axios
        .post(
          "/pipeline/history/set_task_success/",
          qs.stringify({
            task_id: "" + task_info.task_id,
            run_time: task_info.run_time,
          })
        )
        .then((response) => {
          ElMessage.success("设置任务成功！");
          load_data((curPage.value - 1) * curPageSize.value);
        })
        .catch((error) => {
          ElMessage.success("设置任务失败：" + error);
        });
    })
    .catch((error) => {});
};
const handleSelectionChange = (val: HistoryInfo[]) => {
  multipleSelection.value = val;
  emitter.emit("table_selected_changed", multipleSelection.value.length);
};

const handleChange = (index: number, row: HistoryInfo) => {
  console.log(index, row);
};

const handleEdit = (index: number, row: HistoryInfo) => {
  console.log(index, row);
};

const handleDelete = (index: number, row: HistoryInfo) => {
  console.log(index, row);
};

const status_options = ref([
  {
    value: "0",
    label: "等待中",
  },
  {
    value: "1",
    label: "正在执行",
  },
  {
    value: "2",
    label: "执行通过",
  },
  {
    value: "3",
    label: "执行失败",
  },
  {
    value: "4",
    label: "执行超时",
  },
  {
    value: "5",
    label: "等待调度",
  },
  {
    value: "6",
    label: "用户终止执行",
  },
  {
    value: "7",
    label: "上游失败",
  },
]);

const options = [
  {
    value: "0",
    label: "重跑操作",
  },
  {
    value: "1",
    label: "完全重跑",
  },
  {
    value: "2",
    label: "重跑任务",
  },
  {
    value: "3",
    label: "单跑任务和后续",
  },
  {
    value: "4",
    label: "设为成功",
  },
];

const tableData = ref<HistoryInfo[]>([]);

for (var i = 0; i < tableData.value.length; ++i) {
  command_items.value.push("0");
}

const load_data = async (start) => {
  isLoading.value = true;
  var status_str = "";
  if (status_value.value.length != status_options.value.length) {
    status_str = status_value.value.toString();
  }

  var start_time = "";
  if (start_time_begin.value != "") {
    start_time = start_time_select.value + start_time_begin.value;
  }

  var use_time = "";
  if (use_time_seconds.value > 0) {
    use_time = use_time_select.value + use_time_seconds.value;
  }

  if (pl_name_search.value == "=") {
    pl_name_search.value = "";
  }

  await axios
    .post(
      "/pipeline/run_history/",
      qs.stringify({
        draw: 2,
        start: start,
        length: curPageSize.value,
        search_run_time: run_time_search.value,
        search_pl_name: pl_name_search.value,
        search_task_name: task_name_search.value,
        search_status: status_str,
        search_start_time: start_time,
        search_use_time: use_time,
        order_name: order_name.value,
        order_type: order_type.value,
        just_owner: search_owner_type.value,
      })
    )
    .then((response) => {
      console.log(response.data);
      tableData.value = response.data.data;
      isLoading.value = false;
      emitter.emit("success_load_task_table_data", response.data);
    })
    .catch((error) => {
      console.log(error);
    });
};

const changeRunTime = () => {
  load_data((curPage.value - 1) * curPageSize.value);
};

const changePipelineName = () => {
  load_data((curPage.value - 1) * curPageSize.value);
};

const changeTaskName = () => {
  load_data((curPage.value - 1) * curPageSize.value);
};

const changeStartTime = () => {
  load_data((curPage.value - 1) * curPageSize.value);
};

const changeStartTimeOper = () => {
  if (start_time_begin.value == "") {
    return;
  }

  load_data((curPage.value - 1) * curPageSize.value);
};

const useTimeSecondOprChange = () => {
  if (use_time_seconds.value <= 0) {
    return;
  }

  load_data((curPage.value - 1) * curPageSize.value);
};

const useTimeSecondChange = () => {
  load_data((curPage.value - 1) * curPageSize.value);
};

useEventListener(window, "resize", () => {
  if (is_graph_task_list_ref.value) {
    dynamicListHeight.value = window.innerHeight - 100;
  } else {
    dynamicListHeight.value = window.innerHeight - 300;
  }
});

onMounted(() => {
  is_graph_task_list_ref.value = props.is_graph_task_list;
  if (is_graph_task_list_ref.value) {
    dynamicListHeight.value = window.innerHeight - 100;
  } else {
    dynamicListHeight.value = window.innerHeight - 300;
  }
  emitterOn();
  curPage.value = 1;
  curPageSize.value = props.page_size;
  pl_name_search.value = "=" + props.pipeline_name;
  load_data(0);
  table_margin_top.value = props.table_margin_top;
});

onUnmounted(() => {
  emitterOff();
});

const emitterOn = () => {
  emitter.on("reload_task_table_data_with_page", (page) => {
    curPage.value = page;
    load_data((curPage.value - 1) * curPageSize.value);
  });

  emitter.on("reload_task_table_data_with_page_size", (pageSize) => {
    curPageSize.value = pageSize;
    load_data((curPage.value - 1) * curPageSize.value);
  });

  emitter.on("auto_refresh_task_table_data", (auto) => {
    load_data((curPage.value - 1) * curPageSize.value);
  });

  emitter.on("table_order_changed", (data) => {
    order_name.value = data.order_name;
    order_type.value = data.order_type;
    load_data((curPage.value - 1) * curPageSize.value);
  });

  emitter.on("user_refresh_table_data", (data) => {
    console.log("user_refresh_table_data coming.");
    load_data((curPage.value - 1) * curPageSize.value);
  });

  emitter.on("batch_run_table_tasks", (data) => {
    var task_id_list = "";
    var runt_time_list = "";
    for (const task of multipleSelection.value) {
      task_id_list += task.task_id + ",";
      runt_time_list += task.run_time + ",";
    }

    task_id_list = task_id_list.slice(0, -1);
    runt_time_list = runt_time_list.slice(0, -1);
    ElMessageBox.confirm("确定要重新执行选中的所有任务吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    })
      .then(() => {
        axios
          .post(
            "/pipeline/run_some_task/",
            qs.stringify({
              tasklist: task_id_list,
              runtimelist: runt_time_list,
            })
          )
          .then((response) => {
            ElMessage.success("重跑任务成功！");
            load_data((curPage.value - 1) * curPageSize.value);
          })
          .catch((error) => {
            ElMessage.success("重跑任务失败：" + error);
          });
      })
      .catch((error) => {});
  });

  emitter.on("batch_stop_table_tasks", (data) => {
    ElMessageBox.confirm("确定要停止选中的所有任务吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    })
      .then(() => {
        for (const task of multipleSelection.value) {
          axios
            .post(
              "/pipeline/stop_task/",
              qs.stringify({
                task_id: task.task_id,
                run_time: task.run_time,
              })
            )
            .then((response) => {
              load_data((curPage.value - 1) * curPageSize.value);
            })
            .catch((error) => {
              ElMessage.success("停止任务失败：" + error);
            });
        }

        ElMessage.success("停止所有任务成功！");
      })
      .catch((error) => {});
  });

  emitter.on("success_update_pipeline", (data) => {
    createPipeline.value = false;
  });

  emitter.on("update_task_success", (data) => {
    show_task_vue.value = false;
  });

  emitter.on("change_search_status", (data) => {
    status_value.value = data;
    search_owner_type.value = 0;
  });

  emitter.on("change_search_owner", (data) => {
    search_owner_type.value = data;
    status_value.value = [0, 1, 2, 3, 4, 5, 6, 7];
  });
};

const emitterOff = () => {
  emitter.off("reload_task_table_data_with_page", null);
  emitter.off("reload_task_table_data_with_page_size", null);
  emitter.off("auto_refresh_task_table_data", null);
  emitter.off("table_order_changed", null);
  emitter.off("user_refresh_table_data", null);
  emitter.off("batch_run_table_tasks", null);
  emitter.off("batch_stop_table_tasks", null);
  emitter.off("success_update_pipeline", null);
  emitter.off("update_task_success", null);
  emitter.off("change_search_status", null);
};
</script>

<script lang="ts">
import CreateNode from "./CreateNode.vue";
import CreatePipelineVue from "./CreatePipeline.vue";
import logInfo from "./logInfo.vue";
import router from "../router";
import { roleTypes } from "element-plus";
import LogInfo from "./logInfo.vue";
const multipleTableRef = ref<TableInstance>();
const header_clicked = ref(false);

export default {
  components: {
    CreateNode,
    CreatePipelineVue,
    logInfo,
  },
  methods: {
    handleHeaderClick(column, event) {
      const isSortIcon = event.target.classList.contains("el-table__sort-icon");
      // console.log('0 触发排序:', column, column.order, order_name.value, order_type.value);
      if (!isSortIcon) {
        column.order = null;
        event.stopPropagation();
        multipleTableRef.value.clearSort();
        header_clicked.value = true;
      }
    },

    async handleSortChange(column) {
      await this.$nextTick();
      if (header_clicked.value) {
        console.log("header clicked");
        header_clicked.value = false;
        return;
      }

      if (!column.order) {
        return;
      }

      var order_type = "desc";
      if (column.order == "ascending") {
        order_type = "asc";
      }
      var order_data = {
        order_name: column.column.columnKey,
        order_type: order_type,
      };

      emitter.emit("table_order_changed", order_data);
      header_clicked.value = false;
    },
  },
};
</script>

<style scoped>
.iframe-container {
  width: 99%;
  height: 100vh;
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
}
</style>
