<template>
  <div>
    <div class="filter-bar">
      <el-switch v-model="libraryOnly" active-text="Library only" @change="reload" />
      <el-switch v-model="cloneOnly" active-text="Clone only" @change="reload" />
    </div>

    <el-alert
      v-if="isAll"
      title="Select a specific shard from the left sidebar to browse its contracts."
      type="info"
      :closable="false"
      style="margin-bottom:12px"
    />

    <template v-else>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column label="Address" min-width="150">
          <template #default="{ row }">
            <el-link type="primary" @click="goContract(row.address)">
              {{ shortenAddr(row.address) }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="Type" width="110">
          <template #default="{ row }">
            <el-tag
              :type="row.is_library ? 'success' : row.is_clone ? 'warning' : 'primary'"
              size="small"
            >
              {{ row.is_library ? 'Library' : row.is_clone ? 'Clone' : 'Contract' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Creator" min-width="120">
          <template #default="{ row }">
            <el-link type="primary" @click="goAddress(row.creator)">
              {{ shortenAddr(row.creator) }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="Create Height" width="120">
          <template #default="{ row }">
            <el-link type="primary" @click="goBlock(row.create_block_hash)">
              {{ row.create_height }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="Shard" prop="shard_id" width="70" />
        <el-table-column label="Created" min-width="145">
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
import { getContracts } from '../../../api/modules/explorer'
import { usePagination } from './composables/usePagination'
import { useAddrShorten } from './composables/useAddrShorten'

const router = useRouter()
const { shortenAddr } = useAddrShorten()

const shard = inject('explorerShard')
const isAll = computed(() => shard.value.id === 0)
const endpoint = computed(() => shard.value.url ?? '')

const libraryOnly = ref(false)
const cloneOnly = ref(false)

function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

function buildParams(cursor) {
  const p = { limit: 20 }
  if (cursor != null) p.before_id = cursor
  if (libraryOnly.value) p.is_library = 1
  if (cloneOnly.value) p.is_clone = 1
  return p
}

const { list, loading, hasMore, hasPrev, nextPage, prevPage, reload } =
  usePagination((cursor) => {
    if (isAll.value) return Promise.resolve({ code: 0, data: [], has_more: false })
    return getContracts(buildParams(cursor), endpoint.value)
  })

function epParam() {
  const ep = endpoint.value ? encodeURIComponent(endpoint.value) : ''
  return ep ? '?endpoint=' + ep : ''
}
function goContract(addr) { router.push(`/explorer/contracts/${addr}${epParam()}`) }
function goAddress(addr)  { router.push(`/explorer/address/${addr}${epParam()}`) }
function goBlock(hash)    { router.push(`/explorer/blocks/${hash}${epParam()}`) }
</script>

<style scoped>
.filter-bar { display: flex; gap: 16px; align-items: center; margin-bottom: 14px; }
.pagination-bar { display: flex; gap: 10px; margin-top: 14px; justify-content: flex-end; }
</style>
