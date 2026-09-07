<template>
  <div>
    <div style="font-weight:600;font-size:16px;margin-bottom:14px">Gas Presets</div>
    <el-table :data="presets" v-loading="loading" stripe>
      <el-table-column prop="name" label="Name" min-width="160" />
      <el-table-column label="Step Type" width="140">
        <template #default="{ row }">
          <template v-if="row.step_type != null">
            <el-tag :type="stepType(row.step_type).tagType" size="small">
              {{ stepType(row.step_type).label }}
            </el-tag>
          </template>
          <span v-else>N/A</span>
        </template>
      </el-table-column>
      <el-table-column prop="gas_amount" label="Gas Amount" width="130" />
      <el-table-column prop="description" label="Description" min-width="200" />
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getGasPresets } from '../../../api/modules/explorer'
import { useStepType } from './composables/useStepType'

const stepType = useStepType
const presets = ref([])
const loading = ref(false)

const shard = inject('explorerShard')
const endpoint = computed(() => shard?.value?.url ?? '')

async function fetchPresets() {
  loading.value = true
  try {
    const res = await getGasPresets(endpoint.value)
    if (res?.code === 0) presets.value = res.data || []
    else ElMessage.error('Failed to load gas presets')
  } catch {
    ElMessage.error('Failed to load gas presets')
  } finally {
    loading.value = false
  }
}

watch(shard, fetchPresets, { deep: true })
onMounted(fetchPresets)
</script>
