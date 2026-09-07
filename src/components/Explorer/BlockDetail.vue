<template>
  <div v-loading="loading">
    <el-page-header @back="router.back()" title="Blocks" :content="`Block: ${shortenAddr(hash)}`" />

    <el-card shadow="never" style="margin-top:16px" v-if="block">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="Hash">
          <span class="mono">{{ block.hash }}</span>
          <el-button :icon="CopyDocument" link size="small" @click="copyToClipboard(block.hash)" />
        </el-descriptions-item>
        <el-descriptions-item label="Height">{{ block.height }}</el-descriptions-item>
        <el-descriptions-item label="Shard Type">
          <el-tag :type="block.shard_id === 2 ? 'danger' : 'primary'" size="small">
            {{ block.shard_id === 2 ? 'Root Shard' : 'Consensus Shard' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Shard ID">{{ block.shard_id }}</el-descriptions-item>
        <el-descriptions-item label="Pool Index">{{ block.pool_index }}</el-descriptions-item>
        <el-descriptions-item label="Parent Hash">
          <el-link type="primary" @click="goBlock(block.parent_hash)">
            {{ shortenAddr(block.parent_hash) }}
          </el-link>
        </el-descriptions-item>
        <el-descriptions-item label="Timestamp">{{ formatTs(block.timestamp) }}</el-descriptions-item>
        <el-descriptions-item label="Tx Count">{{ block.tx_count }}</el-descriptions-item>
        <el-descriptions-item label="Gas Used">{{ block.all_gas }}</el-descriptions-item>
      </el-descriptions>

      <div style="margin-top:20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="font-weight:600">Transactions</span>
          <el-switch v-model="showSystem" active-text="Show system txs" />
        </div>
        <el-table :data="filteredTxs" size="small" stripe>
          <el-table-column label="Hash" min-width="140">
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
        </el-table>
      </div>
    </el-card>

    <el-empty v-else-if="!loading" description="Block not found" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import { getBlock } from '../../../api/modules/explorer'
import { useAddrShorten } from './composables/useAddrShorten'
import { useStepType } from './composables/useStepType'

const route = useRoute()
const router = useRouter()
const { shortenAddr, copyToClipboard } = useAddrShorten()
const stepType = useStepType

const hash = computed(() => route.params.hash)
const endpoint = computed(() => route.query.endpoint || '')
const block = ref(null)
const loading = ref(false)
const showSystem = ref(false)

function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

const filteredTxs = computed(() => {
  const txs = block.value?.txs || []
  if (showSystem.value) return txs
  return txs.filter(tx => !stepType(tx.step_type).isSystem)
})

function epParam() {
  const ep = endpoint.value ? encodeURIComponent(endpoint.value) : ''
  return ep ? '?endpoint=' + ep : ''
}
function goBlock(hash) { router.push(`/explorer/blocks/${hash}${epParam()}`) }
function goTx(hash)    { router.push(`/explorer/transactions/${hash}${epParam()}`) }

async function fetchBlock() {
  loading.value = true
  try {
    const res = await getBlock(hash.value, endpoint.value)
    if (res?.code === 0) block.value = res.data
    else ElMessage.error('Block not found')
  } catch {
    ElMessage.error('Failed to load block')
  } finally {
    loading.value = false
  }
}

onMounted(fetchBlock)
</script>

<style scoped>
.mono { font-family: monospace; font-size: 12px; word-break: break-all; }
</style>
