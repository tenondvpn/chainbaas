
<template>
  <div class="dashboard">
    <header>
      <h2>厦门市环境卫生数据可视化</h2>
      <p>2023-03-03 14:30:38</p>
    </header>

    <div class="main-content">
      <!-- 地图区域 -->
      <div class="map-section">
        <div id="map" style="width: 600px; height: 400px;"></div>
        <div class="map-labels">
          <span>同安区</span>
          <span>海沧区</span>
          <span>集美区</span>
          <span>思明区</span>
        </div>
      </div>

      <!-- 左侧统计面板 -->
      <div class="stats-panel">
        <h3>每周每日污水排放量 Weekly water statistics</h3>
        <div class="stat-item">
          <span>1563 吨</span>
          <span>2634 吨</span>
          <span>134 吨</span>
          <span>468 吨</span>
        </div>
        <h3>城市公共卫生 Urban Public health</h3>
        <div class="stat-item">
          <span>1862 人</span>
          <span>264 辆</span>
          <span>162 吨</span>
          <span>326 人</span>
          <span>135 人</span>
          <span>532 人</span>
          <span>61 辆</span>
          <span>52 辆</span>
          <span>26 辆</span>
        </div>
      </div>

      <!-- 右侧图表和数据 -->
      <div class="charts-panel">
        <div class="chart-item">
          <h4>蓄水量与排放 Reserve water and discharge water</h4>
          <div id="pieChart" style="width: 200px; height: 200px;"></div>
        </div>
        <div class="chart-item">
          <h4>今日城市情况 Daily city status</h4>
          <div id="radarChart" style="width: 200px; height: 200px;"></div>
        </div>
        <div class="chart-item">
          <h4>2021年各月份降雨量 The proportion of water</h4>
          <div id="barChart" style="width: 200px; height: 200px;"></div>
        </div>
      </div>
    </div>

    <!-- 底部数据 -->
    <div class="bottom-panel">
      <h3>区域清理人员 Area cleaning at a glance</h3>
      <div class="bottom-stats">
        <span>厦门区: 9/13/22</span>
        <span>同安区: 9/14/22</span>
        <span>海沧区: 9/15/22</span>
        <span>集美区: 9/16/22</span>
        <span>思明区: 9/17/22</span>
      </div>
      <div class="displacement">
        <h4>每日用水量 Daily displacement</h4>
        <div id="displacementChart" style="width: 300px; height: 150px;"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import * as echarts from 'echarts';

// 模拟地图数据（需替换为实际地理数据）
onMounted(() => {
  // 饼图 - 蓄水量与排放
  const pieChart = echarts.init(document.getElementById('pieChart'));
  pieChart.setOption({
    series: [
      {
        type: 'pie',
        data: [
          { value: 15, name: '蓄水量' },
          { value: 15, name: '排放量' },
        ],
      },
    ],
  });

  // 雷达图 - 今日城市情况
  const radarChart = echarts.init(document.getElementById('radarChart'));
  radarChart.setOption({
    radar: {
      indicator: [
        { name: '人口', max: 100 },
        { name: '车辆', max: 100 },
        { name: '水质', max: 100 },
      ],
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [82, 85, 90],
            name: '数据',
          },
        ],
      },
    ],
  });

  // 柱状图 - 2021年降雨量
  const barChart = echarts.init(document.getElementById('barChart'));
  barChart.setOption({
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月'],
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        data: [170, 132, 201, 134, 321],
        type: 'bar',
      },
    ],
  });

  // 折线图 - 每日用水量
  const displacementChart = echarts.init(document.getElementById('displacementChart'));
  displacementChart.setOption({
    xAxis: {
      type: 'category',
      data: ['周一', '周二', '周三', '周四', '周五'],
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        data: [215, 192, 170, 134, 80],
        type: 'line',
      },
    ],
  });
});
</script>

<style scoped>
.dashboard {
  font-family: Arial, sans-serif;
  background: #1a1a2e;
  color: #00d4ff;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 20px;
}

.main-content {
  display: flex;
  gap: 20px;
}

.map-section {
  position: relative;
}

.map-section #map {
  background: #0f0f1a;
  border: 1px solid #00d4ff;
}

.map-labels {
  position: absolute;
  top: 10px;
  left: 10px;
  color: #00d4ff;
}

.stats-panel, .charts-panel {
  flex: 1;
}

.stat-item, .chart-item {
  margin-bottom: 20px;
}

.bottom-panel {
  margin-top: 20px;
}

.bottom-stats, .displacement {
  margin-top: 10px;
}
</style>
