<template>
  <div>
    <div class="filter-bar">
      <el-select v-model="shardType" placeholder="Shard Type" style="width:160px" @change="reload">
        <el-option label="All" value="" />
        <el-option label="Root Shard" value="root" />
        <el-option label="Consensus Shard" value="consensus" />
      </el-select>
      <el-input
        v-model="shardIdFilter"
        placeholder="Shard ID"
        clearable
        style="width:120px"
        @change="reload"
        @clear="reload"
      />
      <el-button @click="reload">Search</el-button>
    </div>

    <el-alert
      v-if="isAll"
      title="Select a specific shard from the left sidebar to browse its blocks."
      type="info"
      :closable="false"
      style="margin-bottom:12px"
    />

    <template v-else>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="Height" prop="height" width="90" />
        <el-table-column label="Shard" prop="shard_id" width="70" />
        <el-table-column label="Pool" prop="pool_index" width="65" />
        <el-table-column label="Hash" min-width="160">
          <template #default="{ row }">
            <el-link type="primary" @click="goBlock(row.hash)">
              {{ shortenAddr(row.hash) }}
            </el-link>
            <el-tag v-if="row.shard_id === 2" type="danger" size="small" style="margin-left:4px">Root</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Timestamp" min-width="155">
          <template #default="{ row }">{{ formatTs(row.timestamp) }}</template>
        </el-table-column>
        <el-table-column label="Txs" prop="tx_count" width="60" />
        <el-table-column label="Gas" prop="all_gas" width="90" />
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
import { getBlocks } from '../../../api/modules/explorer'
import { usePagination } from './composables/usePagination'
import { useAddrShorten } from './composables/useAddrShorten'

const router = useRouter()
const { shortenAddr } = useAddrShorten()

const shard = inject('explorerShard')
const isAll = computed(() => shard.value.id === 0)
const endpoint = computed(() => shard.value.url ?? '')

const shardType = ref('')
const shardIdFilter = ref('')

function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

function buildParams(cursor) {
  const p = { limit: 20 }
  if (cursor != null) p.before_id = cursor
  if (shardType.value === 'root') p.is_root = 1
  if (shardType.value === 'consensus') p.is_root = 0
  if (shardIdFilter.value) p.shard_id = shardIdFilter.value
  return p
}

const { list, loading, hasMore, hasPrev, nextPage, prevPage, reload } =
  usePagination((cursor) => {
    if (isAll.value) return Promise.resolve({ code: 0, data: [], has_more: false })
    return getBlocks(buildParams(cursor), endpoint.value)
  })

function goBlock(hash) {
  const ep = endpoint.value ? encodeURIComponent(endpoint.value) : ''
  router.push(`/explorer/blocks/${hash}${ep ? '?endpoint=' + ep : ''}`)
}
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.pagination-bar { display: flex; gap: 10px; margin-top: 14px; justify-content: flex-end; }
</style>
