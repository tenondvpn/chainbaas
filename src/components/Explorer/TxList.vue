<template>
  <div>
    <div class="filter-bar">
      <el-switch v-model="showSystem" active-text="Show system txs" @change="reload" />
      <el-select v-model="stepTypeFilter" placeholder="Step Type" clearable style="width:160px" @change="reload">
        <el-option label="All" value="" />
        <el-option
          v-for="(info, key) in STEP_TYPE_MAP"
          :key="key"
          :label="info.label"
          :value="key"
        />
      </el-select>
    </div>

    <el-alert
      v-if="isAll"
      title="Select a specific shard from the left sidebar to browse its transactions."
      type="info"
      :closable="false"
      style="margin-bottom:12px"
    />

    <template v-else>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="Tx Hash" min-width="140">
          <template #default="{ row }">
            <el-link type="primary" @click="goTx(row.tx_hash)">
              {{ shortenAddr(row.tx_hash) }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="Type" width="130">
          <template #default="{ row }">
            <el-tag :type="stepType(row.step_type).tagType" size="small">
              {{ stepType(row.step_type).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Shard" prop="shard_id" width="70" />
        <el-table-column label="From" min-width="120">
          <template #default="{ row }">{{ shortenAddr(row.from) }}</template>
        </el-table-column>
        <el-table-column label="To" min-width="120">
          <template #default="{ row }">{{ shortenAddr(row.to) }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="Amount" width="100" />
        <el-table-column label="Status" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small">
              {{ row.status || '—' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Time" min-width="145">
          <template #default="{ row }">{{ formatTs(row.timestamp) }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-button :disabled="!hasPrev" @click="prevPage">← Prev</el-button>
        <el-button :disabled="!hasMore" @click="nextPage">Next →</el-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { getTransactions } from '../../../api/modules/explorer'
import { usePagination } from './composables/usePagination'
import { useAddrShorten } from './composables/useAddrShorten'
import { useStepType, STEP_TYPE_MAP } from './composables/useStepType'

const router = useRouter()
const { shortenAddr } = useAddrShorten()
const stepType = useStepType

const shard = inject('explorerShard')
const isAll = computed(() => shard.value.id === 0)
const endpoint = computed(() => shard.value.url ?? '')

const showSystem = ref(false)
const stepTypeFilter = ref('')

function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

function buildParams(cursor) {
  const p = { limit: 20 }
  if (cursor != null) p.before_id = cursor
  if (!showSystem.value) p.hide_system = 1
  if (stepTypeFilter.value !== '') p.step_type = stepTypeFilter.value
  return p
}

const { list, loading, hasMore, hasPrev, nextPage, prevPage, reload } =
  usePagination((cursor) => {
    if (isAll.value) return Promise.resolve({ code: 0, data: [], has_more: false })
    return getTransactions(buildParams(cursor), endpoint.value)
  })

function goTx(hash) {
  const ep = endpoint.value ? encodeURIComponent(endpoint.value) : ''
  router.push(`/explorer/transactions/${hash}${ep ? '?endpoint=' + ep : ''}`)
}
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.pagination-bar { display: flex; gap: 10px; margin-top: 14px; justify-content: flex-end; }
</style>
