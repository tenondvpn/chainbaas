<template>
  <div v-loading="loading">
    <el-page-header @back="router.back()" title="Transactions" :content="`TX: ${shortenAddr(txHash)}`" />

    <el-card shadow="never" style="margin-top:16px" v-if="tx">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="TX Hash">
          <span class="mono">{{ tx.tx_hash }}</span>
          <el-button :icon="CopyDocument" link size="small" @click="copyToClipboard(tx.tx_hash)" />
        </el-descriptions-item>
        <el-descriptions-item label="Type">
          <el-tag :type="stepType(tx.step_type).tagType" size="small">
            {{ stepType(tx.step_type).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Status">
          <el-tag :type="tx.status === 'success' ? 'success' : 'danger'" size="small">
            {{ tx.status || '—' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Block">
          <el-link type="primary" @click="goBlock(tx.block_hash)">
            {{ shortenAddr(tx.block_hash) }}
          </el-link>
        </el-descriptions-item>
        <el-descriptions-item label="Shard / Pool">{{ tx.shard_id }} / {{ tx.pool_index }}</el-descriptions-item>
        <el-descriptions-item label="Time">{{ formatTs(tx.timestamp) }}</el-descriptions-item>
        <el-descriptions-item label="From">
          <el-link type="primary" @click="goAddress(tx.from)">{{ tx.from }}</el-link>
          <el-button :icon="CopyDocument" link size="small" @click="copyToClipboard(tx.from)" />
        </el-descriptions-item>
        <el-descriptions-item label="To">
          <el-link type="primary" @click="goAddress(tx.to)">{{ tx.to }}</el-link>
          <el-button :icon="CopyDocument" link size="small" @click="copyToClipboard(tx.to)" />
        </el-descriptions-item>
        <el-descriptions-item label="Amount">{{ tx.amount }}</el-descriptions-item>
        <el-descriptions-item label="Gas Limit / Used">{{ tx.gas_limit }} / {{ tx.gas_used }}</el-descriptions-item>
        <el-descriptions-item label="Nonce">{{ tx.nonce }}</el-descriptions-item>
      </el-descriptions>

      <div v-if="tx.contract_input" style="margin-top:16px">
        <div style="font-weight:600;margin-bottom:8px">Input Data</div>
        <el-input type="textarea" :value="tx.contract_input" readonly :rows="4" class="mono-area" />
      </div>

      <div v-if="tx.logs && tx.logs.length" style="margin-top:16px">
        <div style="font-weight:600;margin-bottom:8px">EVM Logs</div>
        <el-collapse>
          <el-collapse-item
            v-for="(log, i) in tx.logs"
            :key="i"
            :title="`Log ${i + 1}: ${shortenAddr(log.address)}`"
            :name="i"
          >
            <div class="log-item">
              <div><strong>Address:</strong> {{ log.address }}</div>
              <div v-if="log.topics?.length">
                <strong>Topics:</strong>
                <div v-for="(t, ti) in log.topics" :key="ti" class="mono small">{{ t }}</div>
              </div>
              <div><strong>Data:</strong> <span class="mono small">{{ log.data }}</span></div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-card>

    <el-empty v-else-if="!loading" description="Transaction not found" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import { getTransaction } from '../../../api/modules/explorer'
import { useAddrShorten } from './composables/useAddrShorten'
import { useStepType } from './composables/useStepType'

const route = useRoute()
const router = useRouter()
const { shortenAddr, copyToClipboard } = useAddrShorten()
const stepType = useStepType

// router path: 'transactions/:hash'  (was wrongly using route.params.txHash)
const txHash = computed(() => route.params.hash)
const endpoint = computed(() => route.query.endpoint || '')
const tx = ref(null)
const loading = ref(false)

function formatTs(ts) {
  if (!ts) return '—'
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts)
  return d.toISOString().replace('T', ' ').slice(0, 19)
}

function epParam() {
  const ep = endpoint.value ? encodeURIComponent(endpoint.value) : ''
  return ep ? '?endpoint=' + ep : ''
}
function goBlock(hash)    { router.push(`/explorer/blocks/${hash}${epParam()}`) }
function goAddress(addr)  { router.push(`/explorer/address/${addr}${epParam()}`) }

async function fetchTx() {
  loading.value = true
  try {
    const res = await getTransaction(txHash.value, endpoint.value)
    if (res?.code === 0) tx.value = res.data
    else ElMessage.error('Transaction not found')
  } catch {
    ElMessage.error('Failed to load transaction')
  } finally {
    loading.value = false
  }
}

onMounted(fetchTx)
</script>

<style scoped>
.mono { font-family: monospace; font-size: 12px; word-break: break-all; }
.mono-area :deep(textarea) { font-family: monospace; font-size: 12px; }
.small { font-size: 12px; }
.log-item { padding: 4px 0; display: flex; flex-direction: column; gap: 4px; }
</style>
