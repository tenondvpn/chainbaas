<template>
  <div>
    <!-- Per-shard cards when "All Shards" is selected -->
    <template v-if="isAll">
      <el-row :gutter="12" style="margin-bottom:16px">
        <el-col :span="24">
          <div style="font-size:13px;color:var(--el-text-color-secondary);margin-bottom:8px">
            Aggregated across {{ shardResults.length }} configured shard(s)
          </div>
        </el-col>
        <el-col :span="8">
          <el-card shadow="never">
            <div class="stat-label">Total Blocks (all shards)</div>
            <div class="stat-value">{{ aggregate.total_blocks ?? '—' }}</div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="never">
            <div class="stat-label">Total Transactions (all shards)</div>
            <div class="stat-value">{{ aggregate.total_txs ?? '—' }}</div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="never">
            <div class="stat-label">Active Shards</div>
            <div class="stat-value">{{ aggregate.active_shards }}</div>
          </el-card>
        </el-col>
      </el-row>

      <!-- Per-shard breakdown -->
      <el-table
        :data="shardResults"
        v-loading="loading"
        stripe
        style="margin-bottom:20px"
      >
        <el-table-column label="Shard" min-width="120" prop="name" />
        <el-table-column label="Network ID" width="110" prop="networkId" />
        <el-table-column label="Blocks" width="100" prop="total_blocks" />
        <el-table-column label="Transactions" width="120" prop="total_txs" />
        <el-table-column label="Synced Height" width="120" prop="synced_height" />
        <el-table-column label="Status" width="90">
          <template #default="{ row }">
            <el-tag :type="row.ok ? 'success' : 'danger'" size="small">
              {{ row.ok ? 'Online' : 'Offline' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </template>

    <!-- Single shard view -->
    <template v-else>
      <el-row :gutter="16" class="stat-row">
        <el-col :span="8">
          <el-card shadow="never" v-loading="loading">
            <div class="stat-label">Total Blocks</div>
            <div class="stat-value">{{ chainInfo.total_blocks ?? '—' }}</div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="never" v-loading="loading">
            <div class="stat-label">Total Transactions</div>
            <div class="stat-value">{{ chainInfo.total_txs ?? '—' }}</div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="never" v-loading="loading">
            <div class="stat-label">Synced Height</div>
            <div class="stat-value">{{ chainInfo.synced_height ?? '—' }}</div>
          </el-card>
        </el-col>
      </el-row>
    </template>

    <!-- Recent blocks / txs (single shard only) -->
    <template v-if="!isAll">
      <el-row :gutter="16" class="table-row">
        <el-col :span="12">
          <el-card shadow="never">
            <template #header>Latest Blocks</template>
            <el-table :data="latestBlocks" size="small" v-loading="loadingBlocks">
              <el-table-column label="Hash" min-width="120">
                <template #default="{ row }">
                  <el-link type="primary" @click="goBlock(row.hash)">
                    {{ shortenAddr(row.hash) }}
                  </el-link>
                </template>
              </el-table-column>
              <el-table-column prop="shard_id" label="Net" width="50" />
              <el-table-column prop="height" label="Height" width="70" />
              <el-table-column label="Time" min-width="130">
                <template #default="{ row }">{{ formatTs(row.timestamp) }}</template>
              </el-table-column>
              <el-table-column prop="tx_count" label="Txs" width="50" />
            </el-table>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="never">
            <template #header>Latest Transactions</template>
            <el-table :data="latestTxs" size="small" v-loading="loadingTxs">
              <el-table-column label="Hash" min-width="120">
                <template #default="{ row }">
                  <el-link type="primary" @click="goTx(row.tx_hash)">
                    {{ shortenAddr(row.tx_hash) }}
                  </el-link>
                </template>
              </el-table-column>
              <el-table-column label="Type" width="110">
                <template #default="{ row }">
                  <el-tag :type="stepType(row.step_type).tagType" size="small">
                    {{ stepType(row.step_type).label }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="Time" min-width="130">
                <template #default="{ row }">{{ formatTs(row.timestamp) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getChainInfo, getBlocks, getTransactions } from '../../../api/modules/explorer'
import { useAddrShorten } from './composables/useAddrShorten'
import { useStepType } from './composables/useStepType'

const router = useRouter()
const { shortenAddr } = useAddrShorten()
const stepType = useStepType

// Injected from ExplorerLayout
const shard = inject('explorerShard')          // computed ref → { id, name, url }
const allShards = inject('explorerAllShards')  // ref to shard array

const isAll = computed(() => shard.value.id === 0)
const endpoint = computed(() => shard.value.url ?? '')

function ep() { return endpoint.value }

// ── Single-shard state ──────────────────────────────────
const chainInfo = ref({})
const latestBlocks = ref([])
const latestTxs = ref([])
const loading = ref(false)
const loadingBlocks = ref(false)
const loadingTxs = ref(false)

function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

const epStr = computed(() => encodeURIComponent(ep()))

function goBlock(hash) {
  router.push(`/explorer/blocks/${hash}${ep() ? '?endpoint=' + epStr.value : ''}`)
}
function goTx(hash) {
  router.push(`/explorer/transactions/${hash}${ep() ? '?endpoint=' + epStr.value : ''}`)
}

async function fetchSingle() {
  loading.value = true
  loadingBlocks.value = true
  loadingTxs.value = true
  try {
    const url = ep()
    const [info, blks, txs] = await Promise.all([
      getChainInfo(url),
      getBlocks({ limit: 8 }, url),
      getTransactions({ limit: 8 }, url),
    ])
    if (info?.code === 0) chainInfo.value = info.data || {}
    if (blks?.code === 0) latestBlocks.value = blks.data || []
    if (txs?.code === 0) latestTxs.value = txs.data || []
  } finally {
    loading.value = false
    loadingBlocks.value = false
    loadingTxs.value = false
  }
}

// ── All-shards aggregation ───────────────────────────────
const shardResults = ref([])

const aggregate = computed(() => {
  const ok = shardResults.value.filter(r => r.ok)
  return {
    total_blocks: ok.reduce((s, r) => s + (r.total_blocks || 0), 0) || null,
    total_txs: ok.reduce((s, r) => s + (r.total_txs || 0), 0) || null,
    active_shards: ok.length,
  }
})

async function fetchAll() {
  loading.value = true
  shardResults.value = []
  const list = allShards.value
  if (!list.length) { loading.value = false; return }

  const results = await Promise.allSettled(
    list.map(s => getChainInfo(s.url || '').then(res => ({
      name: s.name,
      networkId: s.networkId,
      ok: res?.code === 0,
      total_blocks: res?.data?.total_blocks ?? null,
      total_txs: res?.data?.total_txs ?? null,
      synced_height: res?.data?.synced_height ?? null,
    })).catch(() => ({ name: s.name, networkId: s.networkId, ok: false, total_blocks: null, total_txs: null, synced_height: null })))
  )
  shardResults.value = results.map(r => r.status === 'fulfilled' ? r.value : { ok: false })
  loading.value = false
}

function refresh() {
  if (isAll.value) fetchAll()
  else fetchSingle()
}

watch([shard, allShards], refresh, { deep: true })
onMounted(refresh)

// Auto-refresh every 15 s
let timer
onMounted(() => { timer = setInterval(refresh, 15000) })
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.stat-row { margin-bottom: 16px; }
.table-row { margin-top: 8px; }
.stat-label { font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.stat-value { font-size: 28px; font-weight: 700; }
</style>
