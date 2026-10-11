<template>
    <div class="editor-container" :class="{ 'fullscreen': isFullscreen }">
        <!-- A contract selected from the chain may carry no source. The editor is
             still the place to supply its code: pasting here gives the address an
             ABI to call against, without writing that code back to the chain. -->
        <div v-if="needsSourceCode" class="paste-hint">
            This contract has no source code on chain. Paste its Solidity code below to
            enable Preset GAS and function calls — it is kept for this session only and
            is not written back to the contract.
        </div>
        <div class="editor-wrapper" ref="editorContainer">
            <div ref="editorElement" class="code-editor"></div>
        </div>
    </div>

    <el-dialog v-model="dialogFormVisible" :title=dialogTitle width="500">
        <el-form ref="formRef" :model="form" style="margin-top: 10px;" label-width="0px" class="dynamic-form-container">
            <el-form-item v-if="not_constructer" >
                <el-row :gutter="37">
                    <el-col :span="7" style="padding: 0px; width: 307px; padding-left: 18px;">
                        <el-text class="mx-1" type="info">Select Function</el-text>
                    </el-col>
                    <el-col :span="15" style="padding: 0px;">
                        <el-select v-model="form.function" placeholder="Select Function" @change="changeFunction">
                            <el-option v-for="item in otherFunctions" :key="item.name" :label="item.name"
                                :value="item.name" />
                        </el-select>
                    </el-col>
                </el-row>
            </el-form-item>
            <el-form-item v-if="!not_constructer">
                <el-row :gutter="37">
                    <el-col :span="7" style="padding: 0px; width: 200px; padding-left: 18px;">
                        <el-text class="mx-1" type="info">Preset GAS</el-text>
                    </el-col>
                    <el-col :span="15" style="padding: 0px;">
                        <el-input-number v-model="gas_prefund" :step="1000000" />
                    </el-col>
                </el-row>
            </el-form-item>
            <el-form-item>
                <el-row :gutter="37">
                    <el-col :span="7" style="padding: 0px; width: 200px; padding-left: 18px;">
                        <el-text class="mx-1" type="info">Amount</el-text>
                    </el-col>
                    <el-col :span="15" style="padding: 0px;">
                        <el-input-number v-model="transfer_amount" :step="1000000" />
                    </el-col>
                </el-row>
            </el-form-item>
            <el-form-item v-if="not_constructer">
                <el-row :gutter="37">
                    <el-col :span="7" style="padding: 0px; width: 200px; padding-left: 18px;">
                        <el-text class="mx-1" type="info">Gas Limit</el-text>
                    </el-col>
                    <el-col :span="15" style="padding: 0px;">
                        <el-input-number v-model="gas_limit" :step="1000000000" :min="1" />
                    </el-col>
                </el-row>
            </el-form-item>
            <el-form-item style="margin-top: 10px;" v-for="(item, index) in form.args" :key="index"
                :prop="'items.' + index + '.value'" :rules="{
                    required: false,
                    message: '',
                    trigger: 'blur',
                }">

                <el-row :gutter="37">
                    <el-col :span="4" style="padding: 0px; width: 297px; padding-left: 18px;">
                        <el-text class="mx-1" type="primary">{{ item.type }}</el-text>
                    </el-col >
                    <el-col :span="6" style="padding: 0px; width: 297px; padding-left: 18px;">
                        <el-input v-model="item.key" aria-label="Parameter Name" placeholder="Parameter Name" />
                    </el-col >
                    <el-col :span="1" style="padding: 0px;margin-left:10px;margin-right:-4px"> :
                    </el-col>
                    <el-col :span="12" style="padding: 0px;">
                        <el-input v-model="item.value" aria-label="Parameter Value" placeholder="Parameter Value" />
                    </el-col>
                </el-row>
            </el-form-item>
        </el-form>
        <template #footer>
            <div class="dialog-footer">
                <el-button @click="dialogFormVisible = false">Cancel</el-button>
                <el-button type="primary" @click="confirmDialog" :loading="run_loading">
                  Execute
                </el-button >
            </div>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, reactive, computed } from 'vue'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { history, historyKeymap } from "@codemirror/commands"
import { oneDark } from '@codemirror/theme-one-dark'
import { autocompletion } from '@codemirror/autocomplete'
import { solidity } from '@replit/codemirror-lang-solidity';
import { lineNumbers } from "@codemirror/view";
import emitter from './EventBus'
import { ElMessage } from 'element-plus'
import { useDark } from "@vueuse/core";
import {
    deployContractDirect,
    pollForDeployedContract,
    pollTxResult,
    compileSolidity,
    abiQueryContract,
    callContractWrite,
    explorerGetContract,
    updateContract,
    waitForBalance,
} from '../services/shardora'
import { selectedShard, resolveShardForAccount, knownContractShard, rememberContractShard } from '../services/shardState'
import { getKeypair } from '../services/signing'
import { Prec } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const themes = {
  'one-dark': oneDark,
  'default': EditorView.theme({  // Default pure white: custom simple theme
    '&.cm-editor': { background: '#ffffff', color: '#000000' },
    '.cm-activeLine': { background: '#f0f0f0' },
    '.cm-gutters': { background: '#ffffff', borderRight: '1px solid #eee' }
  })
}

const theme = ref('dark')
const isFullscreen = ref(false)
const currentLine = ref(1)
const currentColumn = ref(1)
const compileResult = ref(null)
const editorContainer = ref(null)
const editorElement = ref(null)
const preivateKey = ref(localStorage.getItem('solidity_private_key') ?? '')
var editorView = ref()
const constructor = ref(null)
const otherFunctions = ref([])
const dialogFormVisible = ref(false)
const formLabelWidth = '140px'
const not_constructer = ref(false)
const dialogTitle = ref('Enter Constructor Parameters')
const contractAddress = ref('')
const gas_prefund = ref(999999)
const transfer_amount = ref(0)
const gas_limit = ref(999999)
const run_loading = ref(false)
const abiJson = ref(null)
const isDark = useDark();
const themeCompartment = new Compartment()
const pipeline_id = ref();
var second_timer = null;
const prev_saved_code = ref('')
const test_url = ref('http://192.168.56.136:7001')

// True when the selected contract lives on chain but carries no source, so the
// editor is being used to supply code for it rather than to edit stored code.
// Code pasted in this state is compiled locally for its ABI and is never written
// back to the contract — the chain's copy stays authoritative.
const needsSourceCode = ref(false)
// Set once the user supplies code for a source-less contract. It keeps the paste
// from being auto-saved over the (empty) on-chain source.
const supplyingSource = ref(false)

const form = reactive({
    args: [],
    function: '',
})

const getTimestamp = () => {
    return Math.floor(new Date().getTime() / 1000)
}

var prev_save_graph_tm_ms = getTimestamp()

// Compile the code currently in the editor to derive an ABI, when none is
// loaded. This is what lets a source-less contract be called: the user pastes
// the contract's code, and its ABI comes from compiling that code rather than
// from the explorer DB. Returns true when an ABI is available afterwards.
async function ensureAbiFromSource(): Promise<boolean> {
    if (abiJson.value && abiJson.value.length > 0) return true
    if (!codeValue.value.trim()) return false
    try {
        const result = await compileSolidity(0, codeValue.value)
        if (result.status !== 0) {
            console.log('compile for ABI failed:', result.msg)
            return false
        }
        abiJson.value = JSON.parse(result.abi)
        return true
    } catch (e) {
        console.log('compile for ABI failed:', e)
        return false
    }
}

const emitterOn = () => {

emitter.on('update_graph', (payload) => {
    update_graph(payload)
});

emitter.on('update_soldity_height', (height: number | string) => {
    // run_loading.value = false
    const numericHeight = Number(height); // convert to number
    var adjustedHeight = numericHeight - 10; // Subtract tabs height
    if (adjustedHeight < 0) {
        adjustedHeight = 0;
    }
    if (editorContainer.value) {
        editorContainer.value.style.height = adjustedHeight + 'px';
    }
});

emitter.on('set_solidity_private_key', (key: string) => {
    run_loading.value = false
    preivateKey.value = key["prikey"];
    test_url.value = key["url"];
});

emitter.on('transfer_mode_changed', (open: boolean) => {
    transfer_mode.value = !!open
    // Leaving transfer mode must not immediately re-save a stale code value:
    // the timer compares against prev_saved_code, which still holds the last
    // written state, so resync the timestamp instead.
    if (!transfer_mode.value) {
        prev_save_graph_tm_ms = getTimestamp()
    }
});

emitter.on('compile_solidity_code', (code: string) => {
    compileSolidity(0, codeValue.value).then(response => {
        emitter.emit('compile_solidity_code_res', response);
        if (response.status != 0) {
            console.log("Compilation error:", response.msg);
        } else {
            console.log(response.abi)
            console.log(response.bytecode)
        }
    }).catch(error => {
        console.log(error)
    })
});

emitter.on('deploy_solidity_code', (code: string) => {
    // run_loading.value = false
    not_constructer.value = false
    if (!preivateKey.value || preivateKey.value.length == 0) {
        ElMessage({
            type: 'Warning',
            message: 'Please enter private key first!',
        })
        return;
    }

    parseSolidity()
    form.args = []
    if (constructor.value) {
        form.args = constructor.value.parameters.map(param => ({
            type: param.type,
            key: param.name,
            value: ''
        }));
        run_loading.value = false;
        dialogFormVisible.value = true;
    } else {
        deploySolidity();
    }
});

emitter.on('call_function_solidity_code', async (code: string) => {
    run_loading.value = false
    dialogTitle.value = 'Call Contract Function'
    await ensureAbiFromSource()
    parseSolidity()
    form.args = []
    if (otherFunctions.value.length == 0) {
        ElMessage({
            type: 'warning',
            message: 'No callable functions in the contract!',
        })
        return;
    }

    form.function = otherFunctions.value[0].name
    changeFunction()
    run_loading.value = false;
    dialogFormVisible.value = true;
    not_constructer.value = true
});


emitter.on("theme_changed", (data) => {
    if (!useDark().value) {
        switchToDarkTheme()
        console.log("now dark")
    } else {
        switchToLightTheme()
        console.log("now light")
    }
});

}

const emitterOff = () => {
    emitter.off('update_graph', null);
    emitter.off('update_soldity_height', null);
    emitter.off('set_solidity_private_key', null);
    emitter.off('compile_solidity_code', null);
    emitter.off('deploy_solidity_code', null);
    emitter.off('call_function_solidity_code', null);
    emitter.off("theme_changed", null);
    emitter.off('transfer_mode_changed', null);
}

function isValidJSON(str) {
  try {
    JSON.parse(str); 
    return true;  // Parsing successful, return true
  } catch (error) {
    return false; // Parsing failed, return false
  }
}

const base64ToHexLower = (base64Str) => {
  if (!base64Str) return '';
  try {
    // 1. atob 解码 Base64
    const raw = atob(base64Str);
    
    // 2. 转换为字节数组并映射为 16 进制小写
    return Array.from(raw)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase(); // 关键点：统一小写
  } catch (e) {
    console.error("Base64 格式无效:", e);
    return '';
  }
};

const update_graph = async (data) => {
    contractAddress.value = '';
    currentDraftName.value = ''
    emitter.emit('deploy_solidity_code_res', {"status": 1, "id": ""});
    if (data["data"]["is_project"] == 1) {
        return
    }

    console.log("get code value: ", data)
    pipeline_id.value = data["data"]["pipe_id"]
    if (data["data"]["pipe_usr_graph"]) {
        if (isValidJSON(data["data"]["pipe_usr_graph"])) {
            const obj = JSON.parse(data["data"]["pipe_usr_graph"]);
            codeValue.value = obj["code"]
            contractAddress.value = obj["address"]
            // A contract loaded from the tree with an address but no stored source
            // needs its code supplied here before it can be called. Drafts (no
            // address) and freshly deployed contracts are untouched by this.
            supplyingSource.value = !!(obj["from_chain"] && obj["address"] && !obj["code"])
            needsSourceCode.value = supplyingSource.value
            // A source-less chain contract carries whatever ABI the explorer DB
            // last stored for that address — often a stale one from an unrelated
            // deploy, or an empty string for a row that never had one. Trusting it
            // would list another contract's functions, so drop it and let the ABI
            // be derived from the code the user pastes instead.
            const storedAbi = typeof obj["abi"] === 'string' ? obj["abi"].trim() : ''
            abiJson.value = supplyingSource.value ? [] : (storedAbi && storedAbi !== '[]' ? JSON.parse(storedAbi) : [])
            console.log("test get abi: ", obj["abi"])
            // Verify against the shard the contract was stored with, not the
            // caller's — a lookup on the wrong shard reports a live contract as
            // missing. The saved payload carries the shard when the contract came
            // from the tree; a graph saved before this field existed falls back to
            // whatever was last remembered, then to the account's own shard.
            const detailShard = Number(obj["shard"])
                || knownContractShard(obj["address"])
                || await resolveShardForAccount(preivateKey.value)
            if (!detailShard) {
                if (obj["address"]) {
                    // The address came from the tree's own explorer listing, so it
                    // is already known to exist. Publishing it here is what enables
                    // Preset GAS / Call Function; the detail lookup below only adds
                    // source_code, which a pasted-source contract does not need.
                    emitter.emit('deploy_solidity_code_res', {"status": 0, "id": obj["address"]})
                } else {
                    emitter.emit('deploy_solidity_code_res', {"status": 1, "id": "无法确定合约所在分片"})
                }
                return
            }
            rememberContractShard(obj["address"], detailShard)
            // Publish the address first so the toolbar (Preset GAS / Call
            // Function / Deploy) turns on immediately. The detail request below
            // then enriches the record; a failure there is a cosmetic loss of
            // source_code, not a reason to keep the buttons disabled.
            if (obj["address"]) {
                emitter.emit('deploy_solidity_code_res', {"status": 0, "id": obj["address"]})
            }
            explorerGetContract(detailShard, obj["address"]).then(detail => {
                if (!detail) {
                    console.log('contract detail not found on shard', detailShard)
                }
            }).catch(error => {
                console.log('get contract detail failed: ' + error)
            })
        } else {
            codeValue.value = data["data"]["pipe_usr_graph"]
        }
    
        prev_saved_code.value = codeValue.value
    } else {
        codeValue.value = "// SPDX-License-Identifier: GPL-3.0\npragma solidity >=0.7.0 <0.9.0;"
        prev_saved_code.value = codeValue.value
    }
}

function confirmDialog() {
    run_loading.value = true
    if (not_constructer.value) {
        callFunction()
    } else {
        // Written synchronously on click, before compilation or any network
        // round-trip, so the status box is populated immediately. This is the
        // single funnel for both deploy paths — with and without a constructor
        // dialog — which keeps the line from being emitted twice.
        emitter.emit('deploy_progress',
            '\n------------------------\n'
            + '[Deploy] Creating contract...'
            + '\n  Step:     6 (kContractCreate)'
            + `\n  GasLimit: ${gas_limit.value}`
            + `\n  Prepay:   ${gas_prefund.value}`)
        deploySolidity()
    }
}

// Render a web3-decoded value as readable text. web3 already resolves structs
// to objects and arrays to JS arrays, so the only work here is choosing a shape:
// primitives inline, containers indented one level. bigint must be converted
// before String() — it would otherwise print with a trailing "n" and throw
// inside template interpolation.
function formatDecodedValue(value, indent) {
    if (value === null || value === undefined) return String(value)
    if (typeof value === 'bigint') return value.toString()
    if (typeof value === 'string') return value
    if (typeof value !== 'object') return String(value)

    if (Array.isArray(value)) {
        if (value.length === 0) return '[]'
        const inner = indent + '  '
        const lines = value.map((v, i) => `${inner}[${i}] ${formatDecodedValue(v, inner)}`)
        return '\n' + lines.join('\n') + '\n' + indent
    }

    // Decoded structs/tuples expose both named fields and numeric duplicates of
    // them (plus __length__). Keep one form: the names when present, the indices
    // otherwise — printing both would double every field.
    const keys = Object.keys(value).filter(k => k !== '__length__')
    const named = keys.filter(k => !/^\d+$/.test(k))
    const chosen = named.length > 0
        ? named
        : keys.filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b))
    if (chosen.length === 0) return '{}'
    const inner = indent + '  '
    const lines = chosen.map(k => `${inner}${k}: ${formatDecodedValue(value[k], inner)}`)
    return '\n' + lines.join('\n') + '\n' + indent
}

// Normalize a user-supplied string to a value compatible with web3 ABI encoding.
function normalizeAbiValue(type: string, value: string): any {
    if (type === 'bool') {
        return value === 'true' || value === '1'
    }
    // bytes / bytesN: must be 0x-prefixed hex; convert plain strings automatically
    if (type === 'bytes' || /^bytes\d+$/.test(type)) {
        if (!value.startsWith('0x')) {
            const encoded = new TextEncoder().encode(value)
            return '0x' + Array.from(encoded).map(b => b.toString(16).padStart(2, '0')).join('')
        }
        return value
    }
    // uint[]/int[]/address[]/bytes[]: split comma-separated input into array
    if (/\[\]$/.test(type)) {
        return value.split(',').map(s => s.trim())
    }
    return value
}

async function callFunction() {
    var types = []
    var values = []
    for (let arg of form.args) {
        if (arg.value.trim().length == 0) {
          ElMessage({
                type: 'warning',
                message: 'Please enter parameter: ' + arg.key,
            })

            run_loading.value = false
            return
        }
        types.push(arg.type)
        values.push(arg.value)
    }

    // If ABI not loaded, compile source code in memory to get it. This is the
    // path a source-less contract takes once its code has been pasted in.
    if (!abiJson.value || abiJson.value.length === 0) {
        const gotAbi = await ensureAbiFromSource()
        if (!gotAbi) {
            ElMessage({ type: 'error', message: 'Cannot get ABI: 请在编辑器中粘贴合约源码' })
            run_loading.value = false
            return
        }
        // Rebuild the function list from the ABI just derived, so the selected
        // entry's mutability and types match what the encoder will use.
        parseSolidity()
    }

    var abiFunction = abiJson.value.find((item) => item.type === 'function' && item.name === form.function);
    if (abiFunction) {
        if (abiFunction.inputs.length != types.length) {
            ElMessage({
                type: 'error',
                message: 'Function call failed, parameter count mismatch!',
            })
            run_loading.value = false
            return;
        }
        
        types = []
        for (let input of abiFunction.inputs) {
            types.push(input.type);
        }
    }

    const selectedFunction = otherFunctions.value.find(func => func.name === form.function);
    if (selectedFunction.stateMutability == "view") {
        // ABI-encode the function call via web3
        import('web3').then(async ({ Web3 }) => {
            const w3 = new Web3()
            const funcAbi = abiJson.value.find(i => i.type === 'function' && i.name === form.function)
            let inputHex = ''
            try {
                const processedValues = funcAbi.inputs.map((inp, i) => normalizeAbiValue(inp.type, values[i]))
                inputHex = w3.eth.abi.encodeFunctionCall(funcAbi, processedValues).replace(/^0x/, '')
            } catch(e) {
                run_loading.value = false
                ElMessage({ type: 'error', message: 'ABI encode failed: ' + e })
                return
            }
            const contractHexView = contractAddress.value.toLowerCase().replace(/^0x/, '')
            emitter.emit('deploy_progress',
                `\n[Call: ${form.function}] View query` +
                `\n  Contract: ${contractHexView}` +
                `\n  Input:    ${inputHex.slice(0, 64)}${inputHex.length > 64 ? '...(total ' + Math.floor(inputHex.length / 2) + ' bytes)' : ''}`
            )
            // A view call reads wherever the contract lives, which is not
            // necessarily where the caller's account lives. The contract's own
            // shard is preferred; if it was never learned, the caller's shard is
            // the best available guess.
            const readShard = knownContractShard(contractAddress.value)
                ?? await resolveShardForAccount(preivateKey.value)
            if (readShard === null) {
                run_loading.value = false
                ElMessage({ type: 'error', message: '账户不存在于任何分片，无法查询合约' })
                return
            }
            abiQueryContract(readShard, contractAddress.value, inputHex, preivateKey.value ? undefined : undefined)
                .then(result => {
                    run_loading.value = false
                    if (!result.ok) {
                        // A reverted view call comes back as an ABI-encoded error
                        // string, already decoded into result.msg. Keep the raw
                        // packet in the log too — it is the only record of what
                        // the node actually sent.
                        const raw = result.errorBody ? `\n  Raw: ${result.errorBody}` : ''
                        emitter.emit('deploy_progress', `\n[✗] ${form.function} failed: ${result.msg}${raw}`)
                        emitter.emit('call_function_solidity_code_res', { status: 1, funcName: form.function, msg: result.msg })
                        ElMessage({ type: 'error', message: 'Function call failed: ' + result.msg })
                        return
                    }
                    let res_data = result.outputHex
                    try {
                        const decoded = w3.eth.abi.decodeParameters(funcAbi.outputs, '0x' + result.outputHex)
                        if (funcAbi.outputs.length === 1) {
                            // A single output may still be a struct, tuple or array.
                            // String() collapses those to "[object Object]", so any
                            // non-primitive is rendered structurally instead.
                            res_data = formatDecodedValue(decoded[0], '')
                        } else {
                            // Decoded structs carry both named and numeric keys;
                            // prefer the names and drop the duplicate indices.
                            const named = funcAbi.outputs.map((o, i) => [o.name || `arg${i}`, decoded[i]])
                            res_data = named
                                .map(([k, v]) => `${k}: ${formatDecodedValue(v, '  ')}`)
                                .join('\n')
                        }
                    } catch (err) {
                        console.error("ABI decode failed:", err.message)
                    }
                    emitter.emit('call_function_solidity_code_res', { status: 0, funcName: form.function, return_value: res_data })
                    ElMessage({ type: 'success', message: 'Function call successful' })
                    dialogFormVisible.value = false
                })
                .catch(error => {
                    run_loading.value = false
                    ElMessage({ type: 'error', message: 'Function call failed: ' + error })
                })
        })
    } else {
        // ABI-encode and submit as a write transaction
        import('web3').then(async ({ Web3 }) => {
            const w3 = new Web3()
            const funcAbi = abiJson.value.find(i => i.type === 'function' && i.name === form.function)
            let inputHex = ''
            try {
                const processedValues = funcAbi.inputs.map((inp, i) => normalizeAbiValue(inp.type, values[i]))
                inputHex = w3.eth.abi.encodeFunctionCall(funcAbi, processedValues).replace(/^0x/, '')
            } catch(e) {
                run_loading.value = false
                ElMessage({ type: 'error', message: 'ABI encode failed: ' + e })
                return
            }
            const fromAddrWrite = (() => { try { return getKeypair(preivateKey.value).accountId } catch { return '' } })()

            // A write tx is sent from the caller's shard, so that is the shard it
            // must be addressed to. No fallback: a wrong shard would sign against
            // a state the contract is not in.
            const writeShard = await resolveShardForAccount(preivateKey.value)
            if (writeShard === null) {
                run_loading.value = false
                emitter.emit('deploy_progress', `\n[✗] ${form.function} FAILED: 私钥对应账户在任何分片都不存在，请先领取测试币`)
                ElMessage({ type: 'error', message: '账户不存在，无法调用合约' })
                return
            }

            const contractHexWrite = contractAddress.value.toLowerCase().replace(/^0x/, '')
            emitter.emit('deploy_progress',
                `\n[Call: ${form.function}] Tx submitting` +
                `\n  From:     ${fromAddrWrite}` +
                `\n  Contract: ${contractHexWrite}` +
                `\n  Step:     8 (kContractExecute)` +
                `\n  Amount:   ${transfer_amount.value}` +
                `\n  GasLimit: ${gas_limit.value}` +
                `\n  Input:    ${inputHex.slice(0, 64)}${inputHex.length > 64 ? '...(total ' + Math.floor(inputHex.length / 2) + ' bytes)' : ''}`
            )
            callContractWrite({
                privateKeyHex: preivateKey.value,
                shardId: writeShard,
                contractAddr: contractAddress.value,
                inputHex,
                amount: transfer_amount.value,
                gasLimit: gas_limit.value,
            }).then(result => {
                run_loading.value = false
                if (!result.ok) {
                    const rawStr = result.raw != null ? '\n  Response: ' + JSON.stringify(result.raw) : ''
                    emitter.emit('deploy_progress', `\n[✗] ${form.function} failed: ${result.msg}${rawStr}`)
                    emitter.emit('call_function_solidity_code_res', { status: 1, funcName: form.function, msg: result.msg })
                    ElMessage({ type: 'error', message: 'Function call failed: ' + result.msg })
                    return
                }
                const txHash = result.txHash ?? ''
                emitter.emit('deploy_progress', `  TxHash:   ${txHash}`)
                dialogFormVisible.value = false
                emitter.emit('call_function_solidity_code_res', {
                    status: 2,
                    funcName: form.function,
                    txHash,
                    msg: `Submitted\nTxHash: ${txHash}`,
                })
                // Poll receipt to confirm actual on-chain result
                const funcName = form.function
                pollTxResult(writeShard, txHash, 60000, (attempt, elapsed) => {
                    emitter.emit('deploy_progress', `[${elapsed}s] ${funcName}: waiting for confirmation (attempt ${attempt})`)
                }).then(pollResult => {
                    emitter.emit('call_function_solidity_code_res', {
                        status: pollResult.ok ? 0 : 1,
                        funcName,
                        txHash,
                        msg: pollResult.ok
                            ? `Transaction confirmed!\nTxHash: ${txHash}`
                            : `Transaction failed: ${pollResult.reason}\nTxHash: ${txHash}`,
                    })
                    if (pollResult.ok) {
                        ElMessage({ type: 'success', message: `${funcName}: transaction confirmed` })
                    } else {
                        ElMessage({ type: 'error', message: `${funcName}: transaction failed — ${pollResult.reason}` })
                    }
                })
            }).catch(error => {
                run_loading.value = false
                ElMessage({ type: 'error', message: 'Function call failed: ' + error })
            })
        })
    }


}

async function deploySolidity() {
    dialogTitle.value = 'Enter Constructor Parameters'
    not_constructer.value = false
    var types = []
    var values = []
    for (let arg of form.args) {
        if (arg.value.trim().length == 0) {
            ElMessage({
                type: 'warning',
                message: 'Please enter parameter: ' + arg.key,
            })
            run_loading.value = false
            return
        }
        types.push(arg.type)
        values.push(arg.value)
    }

    // Resolved before compiling: if the account is unknown there is no shard to
    // deploy to, and discovering that after a compile would only be slower.
    const deployShard = await resolveShardForAccount(preivateKey.value)
    if (deployShard === null) {
        run_loading.value = false
        emitter.emit('deploy_progress', '\n[✗] Deploy FAILED: 私钥对应账户在任何分片都不存在，请先领取测试币')
        ElMessage({ type: 'error', message: '账户不存在于任何分片，无法部署合约' })
        return
    }

    compileSolidity(0, codeValue.value)
        .then(data => {
            emitter.emit('compile_solidity_code_res', data);
            if (data.status != 0) {
                ElMessage({
                    type: 'error',
                    message: 'Contract deployment failed, compilation error: ' + data.msg,
                })
                run_loading.value = false
                return;
            }

            abiJson.value = JSON.parse(data.abi);
            var abiConstructor = abiJson.value.find((item) => item.type === 'constructor');
            if (abiConstructor) {
                if (abiConstructor.inputs.length != types.length) {
                    ElMessage({
                        type: 'error',
                        message: 'Contract deployment failed, constructor parameter count mismatch!',
                    })
                    run_loading.value = false
                    return;
                }

                types = []
                for (let input of abiConstructor.inputs) {
                    types.push(input.type);
                }
            }

            // Deploy directly to blockchain node with source code embedded
            deployContractDirect({
                privateKeyHex: preivateKey.value,
                shardId: deployShard,
                bytecode: data.bytecode,
                abiJson: data.abi,
                sourceCode: codeValue.value,
                constructorTypes: types,
                constructorArgs: values,
                amount: transfer_amount.value,
                prepay: gas_prefund.value,
            }).then(async result => {
                dialogFormVisible.value = false
                run_loading.value = false
                if (!result.ok) {
                    const rawStr = result.raw != null ? '\n  Response: ' + JSON.stringify(result.raw) : ''
                    emitter.emit('deploy_progress', `\n[✗] Deploy failed: ${result.msg}${rawStr}`)
                    emitter.emit('deploy_solidity_code_res', { status: 1, id: '', msg: result.msg })
                    ElMessage({ type: 'error', message: 'Contract deployment failed: ' + result.msg })
                    return
                }

                // Tx submitted — start 120s polling with live status updates
                const computedAddr = result.contractAddress ?? ''
                const txHash = result.txHash ?? ''
                const fromAddr = result.fromAddr ?? ''
                emitter.emit('deploy_progress',
                    `[Deploy] Tx submitted` +
                    `\n  From:     ${fromAddr}` +
                    `\n  Contract: ${computedAddr}` +
                    `\n  Step:     6 (kContractCreate)` +
                    `\n  Amount:   ${transfer_amount.value}` +
                    `\n  Prepay:   ${gas_prefund.value}` +
                    (txHash ? `\n  TxHash:   ${txHash}` : '')
                )
                ElMessage({ type: 'info', message: 'Deployment tx submitted, checking...' })

                const polled = await pollForDeployedContract(deployShard, computedAddr, txHash, 120000, (attempt, elapsed, phase) => {
                    if (phase === 'tx') {
                        emitter.emit('deploy_progress', `[${elapsed}s] Waiting for tx confirmation... (attempt ${attempt})`)
                    } else {
                        emitter.emit('deploy_progress', `[${elapsed}s] Tx confirmed! Verifying contract address...`)
                    }
                })

                if (polled.found) {
                    const addr = polled.addr
                    contractAddress.value = addr
                    emitter.emit('deploy_solidity_code_res', { status: 0, id: addr })
                    emitter.emit('deploy_progress', `[✓] Contract deployed successfully!\nAddress: ${addr}`)

                    // The contract address exists as soon as the deploy tx lands,
                    // but its account row can lag the receipt. A deploy carries no
                    // value, so only existence is being waited on here.
                    const acc = await waitForBalance(addr, deployShard, 60000, 15000,
                        (attempt, elapsed, bal) => {
                            emitter.emit('deploy_progress',
                                `[${elapsed}s] Contract account: attempt ${attempt}` +
                                (bal === null ? ' — not visible yet' : ` — balance ${bal}`))
                        }, 0n)
                    emitter.emit('deploy_progress',
                        acc ? `[✓] Contract account confirmed\n  Balance: ${acc.balance}`
                            : '[!] Contract address not queryable yet (may need a moment)')

                    ElMessage({ type: 'success', message: 'Contract deployed: ' + addr })
                    // Save source code and ABI to node's SQLite (separate from deploy tx)
                    const abiStr = abiJson.value ? JSON.stringify(abiJson.value) : '[]'
                    rememberContractShard(addr, deployShard)
                    updateContract(deployShard, addr, codeValue.value, abiStr, '')
                        .catch(err => console.warn('updateContract after deploy failed:', err))
                    prev_save_graph_tm_ms = 0
                    prev_saved_code.value = ''
                    TimeToSaveGraph()
                    setTimeout(() => emitter.emit('refresh_contract_list'), 2000)
                } else if (polled.failReason) {
                    emitter.emit('deploy_progress', `[✗] Deployment failed: ${polled.failReason}`)
                    ElMessage({ type: 'error', message: 'Deployment failed: ' + polled.failReason })
                } else {
                    emitter.emit('deploy_progress', '[✗] Timeout (120s): contract not confirmed. It may still be processing — refresh the contract list later.')
                    ElMessage({ type: 'warning', message: 'Deployment timeout. Contract may still be processing.' })
                }
            }).catch(error => {
                run_loading.value = false
                ElMessage({
                    type: 'error',
                    message: 'Contract deployment failed: ' + error,
                })
            })
        })
        .catch(error => {
            run_loading.value = false
            ElMessage({
                type: 'error',
                message: 'Contract deployment failed: ' + error,
            })
        })
}


const changeFunction = () => {
    const selectedFunction = otherFunctions.value.find(func => func.name === form.function);
    if (selectedFunction) {
        form.args = selectedFunction.parameters.map(param => ({
            type: param.type,
            key: param.name,
            value: ''
        }));
    } else {
        form.args = [];
    }
}


// 响应式数据
const codeValue = ref(`// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

`)
// Main parsing function. The ABI is authoritative when one is loaded — it is
// what the encoder will use, so the dropdown must be built from the same source
// or a name can appear that the ABI cannot encode. The regex scan below is only
// a fallback for when no ABI could be derived.
function parseSolidity() {
    try {
        // Reset results
        constructor.value = null;
        otherFunctions.value = [];

        if (abiJson.value && abiJson.value.length > 0) {
            parseFromAbi();
        } else {
            parseAllFunctions();
        }

        console.log('Constructor:', constructor.value);
        console.log('Other Functions:', otherFunctions.value);

    } catch (error) {
        console.error('Parse error:', error);
    }
}

// Build the constructor/callable lists from a parsed ABI. Parameter and return
// types come straight from the ABI, so structs and arrays display correctly
// where the regex scan can only capture a bracketed substring.
function parseFromAbi() {
    for (const item of abiJson.value) {
        if (item.type === 'constructor') {
            constructor.value = {
                name: 'constructor',
                parameters: (item.inputs ?? []).map(i => ({
                    type: i.type,
                    name: i.name || '',
                })),
                visibility: 'public',
                stateMutability: item.stateMutability ?? 'nonpayable',
                returns: '',
            };
            continue;
        }
        if (item.type !== 'function') continue
        otherFunctions.value.push({
            name: item.name,
            parameters: (item.inputs ?? []).map(i => ({
                type: i.type,
                name: i.name || '',
            })),
            visibility: 'external',
            stateMutability: item.stateMutability ?? 'nonpayable',
            returns: (item.outputs ?? []).map(o => o.type).join(', '),
        })
    }
}

// Core parsing function
function parseAllFunctions() {
    // Regex match constructor and function declarations
    // Supports: arbitrary modifier order, spaces, payable, returns (...), etc.
    // Match constructor or function, supports arbitrary modifier order, extra spaces, returns, etc.
    const functionRegex = /(constructor|function)\s*(\w*)\s*\(\s*([^)]*?)\s*\)\s*(public|private|internal|external)?\s*(payable|view|pure)?\s*(returns\s*\(\s*([^)]*?)\s*\))?/gi;
    let match;

    while ((match = functionRegex.exec(codeValue.value)) !== null) {
        const fullMatch = match[0];
        const isConstructor = match[1] === 'constructor' || !match[2];
        const funcName = isConstructor ? 'constructor' : match[2];
        const paramsStr = (match[3] || '').trim();
        const visibilityRaw = match[4] || '';
        const mutabilityRaw = match[5] || '';
        const returnsStr = (match[6] || '').trim();

        // Parse parameters (supports memory/storage/calldata)
        const parameters = parseParameters(paramsStr);

        // Parse visibility
        const visibility = parseVisibility(fullMatch);

        // Parse state mutability (view / pure / payable / nonpayable)
        const stateMutability = parseStateMutability(fullMatch);

        // Parse return type
        const returns = parseReturnType(returnsStr);

        const funcData = {
            name: funcName,
            parameters,
            visibility,
            stateMutability,
            returns
        };

        if (isConstructor) {
            constructor.value = funcData;
        } else {
            otherFunctions.value.push(funcData);
        }
    }
}

// Parse parameters (supports type modifier name, e.g., uint256[] memory ids)
function parseParameters(paramsStr) {
    if (!paramsStr) return [];

    return paramsStr.split(',').map(param => {
        const trimmed = param.trim();
        if (!trimmed) return null;

        // Split by space
        const parts = trimmed.split(/\s+/).filter(p => p);

        if (parts.length === 0) return null;

        const dataLocationModifiers = ['memory', 'storage', 'calldata'];
        let modifiers = [];
        let typeEndIndex = 0;

        // Find data location modifier from back to front (usually after type, before name)
        for (let i = parts.length - 2; i >= 0; i--) {
            if (dataLocationModifiers.includes(parts[i])) {
                modifiers.unshift(parts[i]);
                typeEndIndex = i;
            } else {
                break;
            }
        }

        const type = parts.slice(0, typeEndIndex || parts.length - 1).join(' ');
        const name = parts[parts.length - 1];

        return {
            type,
            name,
            modifiers
        };
    }).filter(param => param !== null);
}

// Parse return type
function parseReturnType(returnsStr) {
    if (!returnsStr) return '';

    // Supports multiple return parameters, e.g., uint256 balance, bool success
    const types = returnsStr.split(',').map(t => t.trim());
    return types.map(t => {
        const parts = t.split(/\s+/);
        return parts.slice(0, parts.length - 1).join(' ') || t; // Remove possible variable names
    }).join(', ');
}

// Parse visibility
function parseVisibility(codeSnippet) {
    const lower = codeSnippet.toLowerCase();
    if (lower.includes('public')) return 'public';
    if (lower.includes('private')) return 'private';
    if (lower.includes('internal')) return 'internal';
    if (lower.includes('external')) return 'external';
    return 'internal'; // Default
}

// Parse state mutability (Key: supports view)
function parseStateMutability(codeSnippet) {
    const lower = codeSnippet.toLowerCase();

    if (lower.includes('pure')) return 'pure';
    if (lower.includes('view')) return 'view';
    if (lower.includes('payable')) return 'payable';
    return 'nonpayable'; // Default state modifiable
}

// Solidity keywords and snippets
const solidityKeywords = [
    'pragma', 'solidity', 'contract', 'function', 'returns', 'public',
    'private', 'internal', 'external', 'view', 'pure', 'payable',
    'memory', 'storage', 'calldata', 'emit', 'event',
    'uint256', 'uint', 'int', 'bool', 'address', 'string',
    'mapping', 'struct', 'enum', 'modifier', 'constructor',
    'if', 'else', 'for', 'while', 'return', 'require'
]

const soliditySnippets = [
    {
        label: 'contract',
        type: 'keyword',
        apply: `contract \${1:ContractName} {\n    \${0}\n}`,
        detail: 'Create new contract'
    },
    {
        label: 'function',
        type: 'function',
        apply: `function \${1:functionName}() public \${2|view,pure|} returns (\${3}) {\n    \${0}\n}`,
        detail: 'Function definition'
    },
    {
        label: 'event',
        type: 'keyword',
        apply: `event \${1:EventName}(\${2});`,
        detail: 'Event definition'
    },
    {
        label: 'modifier',
        type: 'keyword',
        apply: `modifier \${1:modifierName} {\n    \${0}\n    _;\n}`,
        detail: 'Modifier definition'
    }
]

// Autocompleter
function solidityCompleter(context) {
    const word = context.matchBefore(/\w*/)
    if (word.from === word.to && !context.explicit) return null

    return {
        from: word.from,
        options: [
            ...solidityKeywords.map(keyword => ({
                label: keyword,
                type: 'keyword'
            })),
            ...soliditySnippets
        ]
    }
}

    // Optional: Custom syntax highlighting for light mode (clearer colors)
const lightHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: "#d73a49", fontWeight: "bold" },        // Keywords red bold
    { tag: tags.function(tags.variableName), color: "#6f42c1" },       // Function names purple
    { tag: tags.string, color: "#032f62" },                            // Strings dark blue
    { tag: tags.number, color: "#005cc5" },                            // Numbers blue
    { tag: tags.comment, color: "#6a737d", fontStyle: "italic" },      // Comments gray italic
    { tag: tags.variableName, color: "#24292e" },
    { tag: tags.operator, color: "#d73a49" },
    { tag: tags.typeName, color: "#22863a" },                          // Types green
    { tag: tags.propertyName, color: "#e36209" }
]);

// Light Theme Configuration
const lightTheme = EditorView.theme({
    "&": {
        fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
        fontSize: "13px",
        lineHeight: "1.5",
        backgroundColor: "#ffffff",
        color: "#24292e"
    },
    ".cm-content": {
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        fontSize: "12px",
        color: "#24292e",
        caretColor: "#0366d6"
    },
    ".cm-gutter, .cm-gutters": {
        backgroundColor: "#f6f8fa",
        color: "#6a737d",
        borderRight: "1px solid #e1e4e8"
    },
    ".cm-activeLine": {
        backgroundColor: "#ffd33d1a"
    },
    ".cm-selectionBackground, ::selection": {
        backgroundColor: "#0366d699"
    },
    ".cm-cursor": {
        borderLeftColor: "#0366d6"
    }
}, { dark: false });



// Initialize editor
const initEditor = () => {
    if (!editorElement.value) return

    const extensions = [
        lineNumbers(),
        history(),
        keymap.of([...historyKeymap, indentWithTab]),
        solidity,
        autocompletion({
            override: [solidityCompleter]
        }),
        EditorView.updateListener.of(update => {
            if (update.docChanged) {
                codeValue.value = update.state.doc.toString()
                updateCursorPosition(update.state)
                return true
            }
        }),
        // EditorView.theme({
        //     "&": {
        //         fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
        //         fontSize: "13px",
        //         lineHeight: "1.5",
        //         backgroundColor: "#ffffff",  // Pure white background
        //         color: "#24292e"             // Dark gray text (similar to GitHub)
        //     },
        //     ".cm-content": {
        //         fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        //         fontSize: "12px",
        //         color: "#24292e",
        //         caretColor: "#0366d6"        // Blue cursor, more visible
        //     },
        //     ".cm-gutter": {
        //         fontFamily: "inherit",
        //         fontSize: "inherit",
        //         backgroundColor: "#f6f8fa",  // Light gray gutter background
        //         color: "#6a737d"             // Gray line numbers
        //     },
        //     ".cm-gutters": {
        //         backgroundColor: "#f6f8fa",
        //         borderRight: "1px solid #e1e4e8"
        //     },
        //     ".cm-activeLine": {
        //         backgroundColor: "#ffd33d1a" // Light yellow highlight current line
        //     },
        //     ".cm-activeLineGutter": {
        //         backgroundColor: "#f6f8fa"
        //     },
        //     ".cm-selectionBackground, ::selection": {
        //         backgroundColor: "#0366d699" // Semi-transparent blue selection background
        //     },
        //     "&.cm-focused .cm-selectionBackground": {
        //         backgroundColor: "#0366d699"
        //     },
        //     ".cm-cursor, .cm-dropCursor": {
        //         borderLeftColor: "#0366d6"   // Blue cursor
        //     },
        //     ".cm-matchingBracket, .cm-nonmatchingBracket": {
        //         backgroundColor: "#0366d633",
        //         outline: "1px solid #0366d666"
        //     }
        // }, { dark: true }),
        // Added: Bind Ctrl+S (Windows/Linux) / Cmd+S (Mac) save event
        Prec.highest(  // Use highest priority to ensure not covered by other keymaps
            keymap.of([
                {
                    key: 'Ctrl-s',      // Windows/Linux
                    mac: 'Cmd-s',       // Mac
                    run: (view) => {
                        prev_save_graph_tm_ms = 0;
                        TimeToSaveGraph()
                        return true;  // Return true indicating event handled
                    },
                    preventDefault: true  // Prevent triggering browser default save dialog
                }
            ])
        )
    ]

    // Add theme
    console.log("default is isDark: ", isDark.value)
    if (isDark.value) {
        extensions.push(themeCompartment.of(oneDark))
    } else {
        extensions.push(themeCompartment.of([
            lightTheme,
            syntaxHighlighting(lightHighlightStyle)  // Switch highlight style simultaneously
        ]))
    }

    const state = EditorState.create({
        doc: codeValue.value,
        extensions
    })

    editorView = new EditorView({
        state,
        parent: editorElement.value
    })

    // Listen for cursor position changes
    editorView.dom.addEventListener('mousemove', updateCursorFromEvent)
    editorView.dom.addEventListener('keydown', updateCursorFromEvent)
}

// Function to switch to light theme (call anytime)
function switchToLightTheme() {
    editorView.dispatch({
        effects: themeCompartment.reconfigure([
            lightTheme,
            syntaxHighlighting(lightHighlightStyle)  // Switch highlight style simultaneously
        ])
    });
}

// Function to switch back to dark theme (optional)
function switchToDarkTheme() {
    editorView.dispatch({
        effects: themeCompartment.reconfigure(oneDark)
    });
}

// Update cursor position
const updateCursorPosition = (state) => {
    const selection = state.selection.main
    const line = state.doc.lineAt(selection.from)
    currentLine.value = line.number
    currentColumn.value = selection.from - line.from + 1
}

const updateCursorFromEvent = () => {
    if (editorView) {
        updateCursorPosition(editorView.state)
    }
}

// Lifecycle
onMounted(() => {
    emitterOn()
    console.log('SolidityEditor mounted.')
    nextTick(() => {
        console.log('Calling initEditor...')
        initEditor()
        console.log('Editor initialized.')
    })

    second_timer = setInterval(() => {
        TimeToSaveGraph();
    }, 1000);
    
})

const currentDraftName = ref('')

// Set while the transfer form has replaced this editor in the pane. A transfer
// is not a contract, so nothing may be written to localStorage or to a deployed
// contract while it is open.
const transfer_mode = ref(false)

const TimeToSaveGraph = () => {
    var now_tm_ms = getTimestamp();
    if (transfer_mode.value) {
        return;
    }
    if (prev_saved_code.value != codeValue.value && (prev_save_graph_tm_ms + 10 < now_tm_ms)) {
        prev_save_graph_tm_ms = now_tm_ms;
        prev_saved_code.value = codeValue.value
        if (contractAddress.value) {
            // Code pasted to stand in for a contract that has none on chain is a
            // local aid, not the contract's stored source. Writing it back would
            // replace the authoritative (empty) record with a guess.
            if (supplyingSource.value) {
                console.log('auto-save skipped: code supplied locally for source-less contract')
                return
            }
            const abiStr = abiJson.value ? JSON.stringify(abiJson.value) : ''
            // Editing a contract this session did not deploy: its shard came from
            // the tree (remembered on open) or is unknown. Writing without a known
            // shard would save against the wrong chain's copy, so it is skipped
            // rather than guessed — the code is still in the editor either way.
            const saveShard = knownContractShard(contractAddress.value)
            if (saveShard === null) {
                console.log('auto-save skipped: shard unknown for contract', contractAddress.value)
                return
            }
            updateContract(saveShard, contractAddress.value, codeValue.value, abiStr, '')
                .catch(error => console.log('auto-save contract failed:', error))
        } else {
            // No deployed address yet — save as local draft keyed by contract name
            const name = codeValue.value.match(/\bcontract\s+(\w+)/)?.[1] ?? ''
            if (name) {
                const isNew = currentDraftName.value !== name
                currentDraftName.value = name
                localStorage.setItem(`solidity_draft_${name}`, JSON.stringify({
                    name,
                    code: codeValue.value,
                    updatedAt: now_tm_ms,
                }))
                if (isNew) {
                    // Only notify tree when a NEW contract name appears
                    emitter.emit('refresh_draft_list')
                }
            }
        }
    }
}

onUnmounted(() => {
    emitterOff()
    if (editorView) {
        editorView.destroy()
    }

    if (second_timer) {
        clearInterval(second_timer);
    }
})

// Listen for code changes
watch(codeValue, (newValue) => {
    if (editorView && newValue !== editorView.state.doc.toString()) {
        const transaction = editorView.state.update({
            changes: {
                from: 0,
                to: editorView.state.doc.length,
                insert: newValue
            }
        })

        editorView.dispatch(transaction)
        console.log("solidity code updated: ", newValue)
    }
})


</script>

<style scoped>
.editor-container {
    border: 1px solid #4c4d4f;
    border-radius: 4px;
    overflow: hidden;
    background: white;
    transition: all 0.3s ease;
}

.editor-container.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1000;
    border-radius: 0;
}

.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #f8f9fa;
    border-bottom: 1px solid #e1e5e9;
}

.toolbar-left {
    display: flex;
    gap: 8px;
}

.toolbar-btn {
    padding: 6px 12px;
    border: 1px solid #d1d9e0;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
    color: #495057;
}

.toolbar-btn:hover:not(:disabled) {
    background: #e9ecef;
    border-color: #adb5bd;
}

.toolbar-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.file-info {
    font-size: 12px;
    color: #6c757d;
    padding: 4px 8px;
    background: #e9ecef;
    border-radius: 4px;
}

.editor-wrapper {
    position: relative;
    height: 70vh;
    overflow: hidden;
}

.paste-hint {
    padding: 6px 12px;
    font-size: 12px;
    line-height: 1.5;
    color: #8a6d00;
    background: #fff8e1;
    border-bottom: 1px solid #f0d891;
}


.code-editor {
    height: 100%;
    width: 100%;
}

.status-bar {
    display: flex;
    gap: 16px;
    padding: 4px 16px;
    background: #f8f9fa;
    border-top: 1px solid #e1e5e9;
    font-size: 11px;
    color: #6c757d;
}

.status-item {
    display: flex;
    align-items: center;
}

.compile-panel {
    border-top: 1px solid #e1e5e9;
    background: #d4edda;
} 

.compile-panel.error {
    background: #f8d7da;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
}

.panel-header h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
}

.close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #6c757d;
}

.panel-content {
    padding: 12px 16px;
}

.panel-content pre {
    margin: 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-wrap;
}

/* Dark theme adaptation */
:deep(.cm-editor) {
    height: 100%;
}

:deep(.cm-scroller) {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    line-height: 1.5;
}

/* Responsive design */
@media (max-width: 768px) {
    .toolbar {
        flex-direction: column;
        gap: 8px;
        align-items: flex-start;
    }

    .toolbar-right {
        align-self: flex-end;
    }

    .status-bar {
        flex-wrap: wrap;
        gap: 8px;
    }
}
</style>
