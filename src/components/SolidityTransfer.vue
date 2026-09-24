<template>
    <div class="transfer-pane">
        <div class="transfer-inner">
            <el-form :model="transferForm" label-width="110px" class="transfer-form">
                <el-form-item label="发送方 From">
                    <el-input v-model="senderAddr" readonly placeholder="未设置私钥" />
                    <div v-if="senderBalance !== null" class="field-hint">余额: {{ senderBalance }}</div>
                </el-form-item>
                <el-form-item label="接收方 To">
                    <el-input v-model="transferForm.to" placeholder="20字节账户地址（40位hex，可省略0x）" />
                </el-form-item>
                <el-form-item label="金额 Amount">
                    <el-input-number v-model="transferForm.amount" :min="1" :step="1000000" style="width: 220px;" />
                </el-form-item>
                <el-form-item label="Gas Limit">
                    <el-input-number v-model="transferForm.gasLimit" :min="1" :step="1000000" style="width: 220px;" />
                </el-form-item>
            </el-form>
            <div class="transfer-actions">
                <el-button type="primary" :loading="transferWaiting" :disabled="!transferForm.to.trim()"
                    @click="doTransfer">发送</el-button>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import emitter from './EventBus';
import { transfer, pollTxResult, queryAccountOnShard, waitForBalanceAnyShard } from '../services/shardora';
import { resolveShardForAccount } from '../services/shardState';
import { getKeypair } from '../services/signing';

const transferWaiting = ref(false)
const senderBalance = ref<string | null>(null)
const senderAddr = ref('')
const transferForm = ref({ to: '', amount: 1000000, gasLimit: 999999 })

const statusLog = (msg: string) => {
    emitter.emit('solidity_status_log', msg)
}

const refreshSender = async () => {
    const pk = localStorage.getItem('solidity_private_key') ?? ''
    if (!pk || pk.length !== 64) {
        senderAddr.value = ''
        senderBalance.value = null
        return
    }
    try {
        senderAddr.value = getKeypair(pk).accountId.toLowerCase().replace(/^0x/, '')
    } catch (e) {
        ElMessage({ type: 'error', message: '私钥无效: ' + e })
        return
    }
    // The sender's shard is wherever its account lives; a balance read on any
    // other shard would report a different address space entirely.
    const shard = await resolveShardForAccount(pk)
    if (shard === null) {
        senderBalance.value = null
        return
    }
    try {
        const acc = await queryAccountOnShard(senderAddr.value, shard)
        senderBalance.value = acc ? acc.balance : '0'
    } catch (_) {
        senderBalance.value = null
    }
}

onMounted(() => {
    refreshSender()
})

// A transfer is not a contract, so no draft is written for it: nothing here
// touches localStorage or the contract auto-save path in SolidityEditor.
const doTransfer = async () => {
    const pk = localStorage.getItem('solidity_private_key') ?? ''
    if (!pk || pk.length !== 64) {
        ElMessage({ type: 'error', message: '请先设置私钥' })
        return
    }

    const to = transferForm.value.to.trim().toLowerCase().replace(/^0x/, '')
    if (!/^[0-9a-f]{40}$/.test(to)) {
        ElMessage({ type: 'error', message: '接收方地址必须是 40 位 hex（20 字节）' })
        return
    }

    // Nothing above this line awaits, so the status box is already populated by
    // the time the first network round-trip starts.
    transferWaiting.value = true
    const sep = '\n------------------------\n'
    const amount = transferForm.value.amount

    // A transfer originates from the sender's shard, so that is the shard it is
    // addressed to. Fatal when unresolved: there is no default to fall back on.
    const shard = await resolveShardForAccount(pk)
    if (shard === null) {
        transferWaiting.value = false
        statusLog(sep + `[Transfer] FAILED: 私钥对应账户在任何分片都不存在，请先领取测试币`)
        ElMessage({ type: 'error', message: '账户不存在于任何分片，无法转账' })
        return
    }

    statusLog(sep +
        `[Transfer] Submitting transfer tx...` +
        `\n  From:   ${senderAddr.value}` +
        `\n  To:     ${to}` +
        `\n  Amount: ${amount}` +
        `\n  GasLimit: ${transferForm.value.gasLimit}` +
        `\n  Shard:  ${shard}  Step: 0 (kTransfer)`)

    // ── Stage 1: submit the signed tx to the node ──
    let result: { ok: boolean; msg: string; txHash?: string }
    try {
        result = await transfer({
            privateKeyHex: pk,
            to,
            amount,
            shardId: shard,
            step: 0,
            gasLimit: transferForm.value.gasLimit,
        })
    } catch (e) {
        transferWaiting.value = false
        statusLog(`\n[Transfer] Submit error: ${e}`)
        ElMessage({ type: 'error', message: '转账提交失败: ' + e })
        return
    }

    if (!result.ok) {
        transferWaiting.value = false
        statusLog(`\n[Transfer] Submit FAILED: ${result.msg}`)
        ElMessage({ type: 'error', message: '转账提交失败: ' + result.msg })
        return
    }

    const txHash = result.txHash ?? ''
    statusLog(`\n[Transfer] Submit accepted ✓\n  TxHash: ${txHash}`)
    ElMessage({ type: 'info', message: '转账已提交，等待确认...' })

    // ── Stage 2: poll the receipt until it is final ──
    const pollResult = await pollTxResult(shard, txHash, 60000, (attempt, elapsed) => {
        statusLog(`\n[${elapsed}s] Transfer: waiting (attempt ${attempt})`)
    })

    if (!pollResult.ok) {
        transferWaiting.value = false
        statusLog(`\n[Transfer] Tx FAILED: ${pollResult.reason ?? 'unknown'}`)
        ElMessage({ type: 'error', message: '转账失败: ' + (pollResult.reason ?? 'unknown') })
        return
    }

    statusLog(`\n[Transfer] Tx confirmed! ✓`)

    // ── Stage 3: read both balances back ──
    // The sender is read once, straight after confirmation — nothing runs before
    // it, so its result is the balance as of the tx landing. Its shard is known:
    // the tx was sent from it.
    //
    // The recipient is polled instead, and across every shard. A recipient's shard
    // is independent of the sender's — polling only the sender's shard reports
    // "not found" for a transfer that in fact succeeded, because the account lives
    // elsewhere. Each attempt fans out over all consensus shards concurrently.
    //
    // Five attempts, 5s apart. stopWhenCredited=false keeps all five running even
    // once a balance shows up, so every attempt is printed rather than the sweep
    // stopping at the first hit. A probe that throws counts as a miss.
    const sep2 = '\n------------------------\n'
    let fromBal = '查询失败'
    try {
        const fromAcc = await queryAccountOnShard(senderAddr.value, shard)
        fromBal = fromAcc ? fromAcc.balance : '0'
        statusLog(sep2 +
            `[Transfer] Sender balance` +
            `\n  Address: ${senderAddr.value}` +
            `\n  Shard:   ${shard}` +
            `\n  Balance: ${fromBal}`)
    } catch (e) {
        statusLog(sep2 + `[Transfer] Sender balance query error: ${e}`)
    }

    statusLog(`\n[Transfer] Querying receiver balance across shards (5 attempts, every 5s)...`)
    const toAcc = await waitForBalanceAnyShard(to, 60000, 5000,
        (attempt, elapsed, bal, atShard) => {
            statusLog(`\n[${elapsed}s] Receiver balance: attempt ${attempt}/5` +
                (bal === null ? ' — 所有分片均未出现' : ` — shard ${atShard} — ${bal}`))
        }, 1n, 5, false)
    const toBal = toAcc ? toAcc.balance : '账户不存在（5 次跨分片查询均未命中）'

    senderBalance.value = fromBal
    const toShardLabel = toAcc ? `shard ${toAcc.shard}` : '未找到'
    statusLog(`\n[Transfer] Balances after transfer` +
        `\n  Sender   ${senderAddr.value}  (shard ${shard})` +
        `\n  Balance: ${fromBal}` +
        `\n  Receiver ${to}  (${toShardLabel})` +
        `\n  Balance: ${toBal}`)
    ElMessage({ type: 'success', message: `转账成功！接收方余额: ${toBal}` })
    transferWaiting.value = false
}
</script>

<style scoped>
.transfer-pane {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    /* Block sits a little above true centre: the extra bottom space pulls it up,
       which keeps the buttons near eye level in a tall pane. */
    padding: 28px 18px 96px;
    overflow-y: auto;
    /* Element Plus theme tokens, so this follows the app's light/dark switch
       instead of being pinned to white. */
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
}

.transfer-inner {
    width: 100%;
    max-width: 620px;
    margin: auto 0;
}

.transfer-actions {
    display: flex;
    justify-content: center;
    margin-top: 16px;
}

.field-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
    margin-top: 2px;
}
</style>
