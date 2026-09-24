<template>
    <div class="solidity-status-root" style="overflow: hidden;">
        <!-- These act on the contract in the editor, which is not on screen while
             the transfer form has the pane. The log area below stays, so transfer
             progress still has somewhere to print. -->
        <el-button-group v-if="!transfer_mode" style="margin-top: 5px;">
            <!-- <el-button plain size="small" type="primary" :icon="DataAnalysis" @click="toCompile">编译</el-button> -->
            <el-button plain size="small" type="primary" :icon="Operation" :disabled="contract_address != ''" @click="toDeploy">Deploy</el-button>

            <el-popover :visible="gas_visible" placement="top" :width="220">
                <p>Preset GAS</p>
                <el-input-number v-model="gas_prefund" :step="1000000" />
                <div style="text-align: right; margin-top: 20px">
                    <el-button size="small" text @click="gas_visible = false">Cancel</el-button>
                    <el-button size="small" type="primary" :loading="gas_waiting"  @click="CallGasPrepayment">
                        Confirm
                    </el-button>
                </div>
              <template #reference>
                    <el-button plain :disabled="contract_address == ''"  size="small" type="primary" :icon="Odometer"
                        @click="gas_visible = true; gas_waiting = false">Preset GAS</el-button>
                </template>
            </el-popover>
            <el-button plain size="small" type="primary" :disabled="contract_address == ''" :icon="CaretLeft" @click="toCallFunction">Call Function</el-button>

        </el-button-group>

        <el-tag v-if="transfer_mode" type="warning" style="margin-top: 5px;">转账模式</el-tag>

        <el-tag v-if="contract_address && !transfer_mode" type="success" style="margin-top: 5px;float: right;">{{ contract_address }}</el-tag>

        <pre ref="logArea" id="solidity_editor_status" class="log-area" v-html="textarea"></pre>
    </div>
</template>


<script setup lang="ts">
import { DataAnalysis, Operation, CaretLeft, Odometer } from '@element-plus/icons-vue'
import emitter from './EventBus';
import { nextTick, ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { setGasPrefund, pollTxResult, queryAccountOnShard } from '../services/shardora'
import { getKeypair } from '../services/signing'

const textarea = ref('')
const contract_address = ref('')
const privateKey = ref(localStorage.getItem('solidity_private_key') ?? '')
const logArea = ref<HTMLElement | null>(null)

function scrollToBottom() {
    nextTick(() => {
        setTimeout(() => {
            const el = logArea.value
            if (el) el.scrollTop = el.scrollHeight
        }, 50)
    })
}

// Convert plain text log lines to styled HTML
function styledLog(text: string): string {
    const esc = (s: string) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

    return text.split('\n').map(line => {
        const e = esc(line)

        // Separator lines
        if (/^-{5,}/.test(line.trim()))
            return `<span class="ls-sep">${e}</span>`

        // Success tick [✓]
        if (/^\[✓\]/.test(line))
            return `<span class="ls-ok ls-big">${e}</span>`

        // Error cross [✗]
        if (/^\[✗\]/.test(line))
            return `<span class="ls-err ls-bold">${e}</span>`

        // Deploy header
        if (/^\[Deploy\]/.test(line))
            return `<span class="ls-deploy ls-bold">${e}</span>`

        // Preset GAS header
        if (/^\[Preset GAS\]/.test(line))
            return `<span class="ls-gas ls-bold">${e}</span>`

        // Transfer header
        if (/^\[Transfer\]/.test(line))
            return `<span class="ls-transfer ls-bold">${e}</span>`

        // Call header
        if (/^\[Call:/.test(line))
            return `<span class="ls-call ls-bold">${e}</span>`

        // Polling lines [Ns]
        if (/^\[\d+s\]/.test(line))
            return `<span class="ls-poll">${e}</span>`

        // TxHash indented
        if (/^\s+TxHash:/.test(line))
            return `<span class="ls-txhash">${e}</span>`

        // Raw response (error body)
        if (/^\s+Response:/.test(line))
            return `<span class="ls-response">${e}</span>`

        // Deployment success / confirmed
        if (/Deployment Success|Tx confirmed|confirmed!/.test(line))
            return `<span class="ls-ok ls-bold">${e}</span>`

        // Deployment error / transfer failure
        if (/Deployment Error|Compilation Error|FAILED:|Tx FAILED|Balance query error|Transfer FAILED/.test(line))
            return `<span class="ls-err ls-bold">${e}</span>`

        // Balance lines
        if (/\bBalance:/.test(line))
            return `<span class="ls-balance">${e}</span>`

        // Contract address
        if (/Contract Address:/.test(line))
            return `<span class="ls-addr">${e}</span>`

        // View result: funcName => value
        if (/ => /.test(line))
            return `<span class="ls-result ls-bold">${e}</span>`

        // Other indented detail lines
        if (/^\s{2,}\S/.test(line))
            return `<span class="ls-detail">${e}</span>`

        return `<span class="ls-default">${e}</span>`
    }).join('<br>')
}

function appendLog(text: string) {
    textarea.value += styledLog(text)
    scrollToBottom()
}

const gas_visible = ref(false)
const gas_prefund = ref(1000000)
const gas_waiting = ref(false)

// Set while the transfer form occupies the editor pane. The toolbar above acts on
// the contract, so it is hidden rather than left to operate on something that is
// no longer on screen.
const transfer_mode = ref(false)

const toCompile = () => {
    emitter.emit('compile_solidity_code', "");
}

onMounted(() => {
    textarea.value = "";
    emitterOn();
    if (privateKey.value) {
        emitter.emit('set_solidity_private_key', { prikey: privateKey.value })
    }
});

onUnmounted(() => {
    emitterOff();
});

const toDeploy = () => {
    emitter.emit('deploy_solidity_code', "");
}

const toCallFunction = () => {
    emitter.emit('call_function_solidity_code', "");
}

const CallGasPrepayment = async () => {
    if (!privateKey.value || privateKey.value.length !== 64) {
        ElMessage({ type: 'error', message: 'Please set private key first' })
        return
    }
    gas_waiting.value = true
    gas_visible.value = false

    const sep = '\n------------------------\n'
    const contractAddr = contract_address.value.toLowerCase().replace(/^0x/, '')

    let userAddr: string
    try {
        userAddr = getKeypair(privateKey.value).accountId.toLowerCase().replace(/^0x/, '')
    } catch (e) {
        gas_waiting.value = false
        ElMessage({ type: 'error', message: 'Invalid private key: ' + e })
        return
    }

    appendLog(sep +
        `[Preset GAS] Submitting prefund tx...` +
        `\n  From:         ${userAddr}` +
        `\n  Contract:     ${contractAddr}` +
        `\n  Prefund addr: ${contractAddr.padStart(40, '0') + userAddr.padStart(40, '0')}` +
        `\n  Step:         7 (kContractGasPrefund)` +
        `\n  Amount:       ${gas_prefund.value}`)

    let result: { ok: boolean; msg: string; txHash?: string }
    try {
        result = await setGasPrefund(privateKey.value, 3, contractAddr, gas_prefund.value)
    } catch (e) {
        gas_waiting.value = false
        ElMessage({ type: 'error', message: 'Preset GAS failed: ' + e })
        appendLog(`\n[Preset GAS] Error: ${e}`)
        return
    }

    if (!result.ok) {
        gas_waiting.value = false
        ElMessage({ type: 'error', message: 'Preset GAS failed: ' + result.msg })
        appendLog(`\n[Preset GAS] Tx FAILED: ${result.msg}`)
        return
    }

    const txHash = result.txHash ?? ''
    appendLog(`\n[Preset GAS] Tx submitted\n  TxHash: ${txHash}`)
    ElMessage({ type: 'info', message: 'Preset GAS tx submitted, waiting for confirmation...' })

    const pollResult = await pollTxResult(3, txHash, 60000, (attempt, elapsed) => {
        appendLog(`\n[${elapsed}s] Preset GAS: waiting (attempt ${attempt})`)
    })

    if (!pollResult.ok) {
        gas_waiting.value = false
        ElMessage({ type: 'error', message: 'Preset GAS tx failed: ' + (pollResult.reason ?? 'unknown') })
        appendLog(`\n[Preset GAS] Tx FAILED: ${pollResult.reason ?? 'unknown'}`)
        return
    }

    appendLog(`\n[Preset GAS] Tx confirmed! ✓`)

    const prefundAddr = contractAddr.padStart(40, '0') + userAddr.padStart(40, '0')
    try {
        const accInfo = await queryAccountOnShard(prefundAddr, 3)
        if (accInfo) {
            appendLog(`\n[Preset GAS] Prefund balance verified\n  Prefund addr: ${prefundAddr}\n  Balance: ${accInfo.balance}`)
            ElMessage({ type: 'success', message: `Preset GAS success! Prefund balance: ${accInfo.balance}` })
        } else {
            appendLog(`\n[Preset GAS] Prefund addr ${prefundAddr} not found yet (may take a moment)`)
            ElMessage({ type: 'success', message: 'Preset GAS set successfully!' })
        }
    } catch (e) {
        appendLog(`\n[Preset GAS] Balance query error: ${e}`)
        ElMessage({ type: 'success', message: 'Preset GAS set (balance query failed)' })
    }
    gas_waiting.value = false
}

const emitterOff = () => {
emitter.off('deploy_progress', null);
emitter.off('compile_solidity_code_res', null);
emitter.off('deploy_solidity_code_res', null);
emitter.off('call_function_solidity_code_res', null);
emitter.off('solidity_status_log', null);
emitter.off('update_soldity_status_height', null);
emitter.off('transfer_mode_changed', null);
}

const emitterOn = () => {

emitter.on('deploy_progress', (msg: string) => {
    appendLog('\n' + msg)
})

// Other panels (contract tree, transfer dialog) write into this log area.
// Payload is preformatted text; prefix '\n' is added by the caller when needed.
emitter.on('solidity_status_log', (msg: string) => {
    if (typeof msg === 'string' && msg.length > 0) appendLog(msg)
})

emitter.on('compile_solidity_code_res', (data) => {
    const sep = '\n------------------------\n'
    if (data.status != 0) {
        appendLog(sep + 'Compilation Error:\n' + data.msg)
    } else {
        appendLog(sep + 'Compilation Success!\nABI:\n' + data.abi + '\nBytecode:\n' + data.bytecode)
    }
});

emitter.on('deploy_solidity_code_res', (data) => {
    if (data.id == "") {
        textarea.value = "";
        contract_address.value = "";
        return;
    }
    const sep = '\n------------------------\n'
    if (data.status != 0) {
        appendLog(sep + 'Deployment Error: ' + data.id)
    } else {
        contract_address.value = data.id;
        appendLog(sep + 'Deployment Success!\nContract Address: ' + data.id)
    }
});

// Raised by Solidity.vue whenever the editor pane swaps between the code editor
// and the transfer form. The log below is shared by both, so only the toolbar
// reacts.
emitter.on('transfer_mode_changed', (open: boolean) => {
    transfer_mode.value = !!open
})

emitter.on('update_soldity_status_height', (height: number | string) => {
    const statusContainer = document.getElementById('solidity-status-container');
    const editorContainer = document.getElementById('solidity_editor_status');
    const numericHeight = Number(height);
    var adjustedHeight = numericHeight - 40;
    if (adjustedHeight < 0) adjustedHeight = 0;
    if (statusContainer) statusContainer.style.height = adjustedHeight + 'px';
    if (editorContainer) {
        adjustedHeight += 2;
        editorContainer.style.height = adjustedHeight + 'px';
    }
});

emitter.on('call_function_solidity_code_res', (data) => {
    const sep = '\n------------------------\n'
    const name = data.funcName ?? 'Call'
    if (data.status === 0) {
        if (data.return_value !== undefined) {
            appendLog(sep + `${name} => ${data.return_value}`)
        } else {
            appendLog(sep + `[✓] ${name}: ${data.msg ?? 'OK'}`)
        }
    } else if (data.status === 2) {
        appendLog(sep + `[${name}] ${data.msg}`)
    } else {
        appendLog(sep + `${name} FAILED: ${data.msg ?? 'unknown error'}`)
    }
});
}
</script>

<style scoped>
.log-area {
    width: 100%;
    box-sizing: border-box;
    background: var(--log-bg);
    color: var(--log-default);
    font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    padding: 8px 10px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
    border: 1px solid var(--log-border);
    border-radius: 4px;
    margin-top: 6px;
    min-height: 80px;
}
</style>

<style>
/* Log syntax colours, declared as variables on the component root so the same
   rule block serves both themes. The v-html spans are generated outside this
   component's scope, hence a global block. */
.solidity-status-root {
    /* light */
    --log-bg: #f6f8fa;
    --log-border: #d0d7de;
    --log-default: #24292f;
    --log-sep: #b9c0c8;
    --log-poll: #8b949e;
    --log-detail: #6e7781;
    --log-ok: #1a7f37;
    --log-err: #cf222e;
    --log-deploy: #0969da;
    --log-gas: #9a6700;
    --log-transfer: #0d7d8c;
    --log-balance: #4a7c1f;
    --log-call: #8250df;
    --log-txhash: #8a6a00;
    --log-response: #a40e26;
    --log-addr: #116b62;
    --log-result: #0b6f7d;
}

html.dark .solidity-status-root {
    --log-bg: #1a1a2e;
    --log-border: #333;
    --log-default: #ccc;
    --log-sep: #444;
    --log-poll: #555;
    --log-detail: #888;
    --log-ok: #66bb6a;
    --log-err: #ef5350;
    --log-deploy: #64b5f6;
    --log-gas: #ffa726;
    --log-transfer: #26c6da;
    --log-balance: #aed581;
    --log-call: #ce93d8;
    --log-txhash: #ffd54f;
    --log-response: #ef9a9a;
    --log-addr: #80cbc4;
    --log-result: #4dd0e1;
}

.ls-sep    { color: var(--log-sep); font-size: 11px; }
.ls-ok     { color: var(--log-ok); }
.ls-err    { color: var(--log-err); }
.ls-deploy { color: var(--log-deploy); }
.ls-gas    { color: var(--log-gas); }
.ls-transfer { color: var(--log-transfer); }
.ls-balance { color: var(--log-balance); font-family: monospace; }
.ls-call   { color: var(--log-call); }
.ls-poll   { color: var(--log-poll); font-size: 11px; font-style: italic; }
.ls-txhash { color: var(--log-txhash); font-family: monospace; font-size: 11px; }
.ls-response { color: var(--log-response); font-family: monospace; font-size: 11px; }
.ls-addr   { color: var(--log-addr); font-family: monospace; }
.ls-result { color: var(--log-result); }
.ls-detail { color: var(--log-detail); font-size: 11px; }
.ls-default { color: var(--log-default); }
.ls-bold   { font-weight: bold; }
.ls-big    { font-size: 13px; }
</style>
