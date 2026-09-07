<template>
  <div v-loading="loading">
    <el-page-header @back="router.back()" title="Explorer" :content="`Address: ${shortenAddr(addr)}`" />

    <el-card shadow="never" style="margin-top:16px" v-if="addrInfo">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="Address">
          <span class="mono">{{ addr }}</span>
          <el-button :icon="CopyDocument" link size="small" @click="copyToClipboard(addr)" />
        </el-descriptions-item>
        <el-descriptions-item label="Type">
          <el-tag :type="addrInfo.is_contract ? 'success' : 'primary'" size="small">
            {{ addrInfo.is_contract ? 'Contract' : 'EOA' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Shard / Pool">
          {{ addrInfo.shard_id ?? '—' }} / {{ addrInfo.pool_index ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="Balance">
          <el-text type="info">Query node directly (real-time not implemented)</el-text>
        </el-descriptions-item>
        <el-descriptions-item label="Nonce">
          <el-text type="info">Query node directly (real-time not implemented)</el-text>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <div style="margin-top:20px">
      <div style="font-weight:600;margin-bottom:10px">Transaction History</div>
      <el-table :data="list" v-loading="txLoading" stripe>
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
        <el-table-column label="From" min-width="120">
          <template #default="{ row }">{{ shortenAddr(row.from) }}</template>
        </el-table-column>
        <el-table-column label="To" min-width="120">
          <template #default="{ row }">{{ shortenAddr(row.to) }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="Amount" width="100" />
        <el-table-column label="Time" min-width="145">
          <template #default="{ row }">{{ formatTs(row.timestamp) }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-button :disabled="!hasPrev" @click="prevPage">← Prev</el-button>
        <el-button :disabled="!hasMore" @click="nextPage">Next →</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import { getAddress, getAddressTxs } from '../../../api/modules/explorer'
import { usePagination } from './composables/usePagination'
import { useAddrShorten } from './composables/useAddrShorten'
import { useStepType } from './composables/useStepType'

const route = useRoute()
const router = useRouter()
const { shortenAddr, copyToClipboard } = useAddrShorten()
const stepType = useStepType

const addr = computed(() => route.params.addr)
const endpoint = computed(() => route.query.endpoint || '')
const addrInfo = ref(null)
const loading = ref(false)

function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

function buildParams(cursor) {
  const p = { limit: 20 }
  if (cursor != null) p.before_id = cursor
  return p
}

const { list, loading: txLoading, hasMore, hasPrev, nextPage, prevPage } =
  usePagination((cursor) => getAddressTxs(addr.value, buildParams(cursor), endpoint.value))

function epParam() {
  const ep = endpoint.value ? encodeURIComponent(endpoint.value) : ''
  return ep ? '?endpoint=' + ep : ''
}
function goTx(hash) { router.push(`/explorer/transactions/${hash}${epParam()}`) }

async function fetchAddr() {
  loading.value = true
  try {
    const res = await getAddress(addr.value, endpoint.value)
    if (res?.code === 0) addrInfo.value = res.data
    else ElMessage.error('Address not found')
  } catch {
    ElMessage.error('Failed to load address')
  } finally {
    loading.value = false
  }
}

onMounted(fetchAddr)
</script>

<style scoped>
.mono { font-family: monospace; font-size: 12px; word-break: break-all; }
.pagination-bar { display: flex; gap: 10px; margin-top: 14px; justify-content: flex-end; }
</style>
