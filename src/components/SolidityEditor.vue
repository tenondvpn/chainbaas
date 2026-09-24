<template>
    <div class="editor-container" :class="{ 'fullscreen': isFullscreen }">
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
import { ref, onMounted, onUnmounted, watch, nextTick, reactive } from 'vue'
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

const form = reactive({
    args: [],
    function: '',
})

const getTimestamp = () => {
    return Math.floor(new Date().getTime() / 1000)
}

var prev_save_graph_tm_ms = getTimestamp()

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

emitter.on('call_function_solidity_code', (code: string) => {
    run_loading.value = false
    dialogTitle.value = 'Call Contract Function'
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
            abiJson.value = JSON.parse(obj["abi"])
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
                emitter.emit('deploy_solidity_code_res', {"status": 1, "id": "无法确定合约所在分片"})
                return
            }
            rememberContractShard(obj["address"], detailShard)
            explorerGetContract(detailShard, obj["address"]).then(detail => {
                if (detail) {
                    emitter.emit('deploy_solidity_code_res', {"status": 0, "id": detail.addr ?? obj["address"]});
                } else {
                    emitter.emit('deploy_solidity_code_res', {"status": 1, "id": "contract not found on chain"});
                }
            }).catch(error => {
                ElMessage({ type: 'error', message: 'get contract failed: ' + error })
                emitter.emit('deploy_solidity_code_res', {"status": 1, "id": 'get contract failed: ' + error});
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

function decodeOutput(abi, functionName, outputHex) {
    const funcAbi = abi.find(item => 
        item.type === "function" && item.name === functionName
    );

    if (!funcAbi || !funcAbi.outputs) return "No outputs";

    const cleanHex = outputHex.startsWith('0x') ? outputHex.slice(2) : outputHex;
    const resultObj = {};

    funcAbi.outputs.forEach((output, index) => {
        const key = output.name || `arg${index}`;
        // 获取当前位置的 32 字节块
        const currentChunk = cleanHex.slice(index * 64, (index + 1) * 64);
        resultObj[key] = complexDecode(output, currentChunk, cleanHex);
    });

    return JSON.stringify(resultObj, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value, 2
    );
}

function complexDecode(output, chunk, fullHex) {
    const type = output.type;

    // 1. 处理动态数组 (如 DataSummary[])
    if (type.endsWith('[]')) {
        const offset = parseInt(chunk, 16) * 2; 
        const length = parseInt(fullHex.slice(offset, offset + 64), 16);
        const baseType = type.replace('[]', '');
        const items = [];
        
        const arrayContentStart = offset + 64;

        for (let i = 0; i < length; i++) {
            if (baseType === 'tuple') {
                // 关键点：结构体数组中，每个元素通常是一个指向具体内容的偏移量
                const itemOffsetInArray = parseInt(fullHex.slice(arrayContentStart + (i * 64), arrayContentStart + (i + 1) * 64), 16) * 2;
                const absoluteStructStart = arrayContentStart + itemOffsetInArray;
                
                // 传入该结构体相对于 fullHex 的起始位置进行解析
                items.push(decodeTuple(output.components, fullHex.slice(absoluteStructStart), fullHex));
            } else {
                const itemHex = fullHex.slice(arrayContentStart + (i * 64), arrayContentStart + (i + 1) * 64);
                items.push(simpleItemDecode(baseType, itemHex));
            }
        }
        return items;
    }

    // 2. 处理独立字符串
    if (type === 'string') {
        const offset = parseInt(chunk, 16) * 2;
        const length = parseInt(fullHex.slice(offset, offset + 64), 16) * 2;
        return hexToUtf8(fullHex.slice(offset + 64, offset + 64 + length));
    }

    return simpleItemDecode(type, chunk);
}

function decodeTuple(components, structHex, fullContextHex) {
    const structData = {};
    
    components.forEach((comp, j) => {
        // 获取当前字段在结构体 Head 中的 32 字节块
        const fieldChunk = structHex.slice(j * 64, (j + 1) * 64);
        
        if (comp.type === 'string' || comp.type.endsWith('[]') || comp.type === 'tuple') {
            // 处理动态类型的二次偏移
            const internalOffset = parseInt(fieldChunk, 16) * 2;
            // 注意：结构体内部的偏移是相对于结构体起始位置的
            const dynamicDataStart = internalOffset; 
            
            if (comp.type === 'string') {
                const strData = structHex.slice(dynamicDataStart);
                const len = parseInt(strData.slice(0, 64), 16) * 2;
                structData[comp.name] = hexToUtf8(strData.slice(64, 64 + len));
            } else {
                // 递归处理嵌套数组或元组
                structData[comp.name] = complexDecode(comp, fieldChunk, structHex);
            }
        } else {
            // 静态类型（bytes32, address, uint256）直接解码
            structData[comp.name] = simpleItemDecode(comp.type, fieldChunk);
        }
    });
    return structData;
}

function simpleItemDecode(type, hex) {
    if (!hex) return null;
    if (type === 'address') return '0x' + hex.slice(24).toLowerCase();
    if (type === 'uint256') return BigInt('0x' + hex);
    if (type === 'bytes32') return '0x' + hex;
    return hex;
}

function hexToUtf8(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        const charCode = parseInt(hex.substr(i, 2), 16);
        if (charCode === 0) continue;
        str += String.fromCharCode(charCode);
    }
    return decodeURIComponent(escape(str));
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

    // If ABI not loaded, compile source code in memory to get it
    if (!abiJson.value || abiJson.value.length === 0) {
        try {
            const compileResult = await compileSolidity(0, codeValue.value)
            if (compileResult.status !== 0) {
                ElMessage({ type: 'error', message: 'Cannot get ABI (compile failed): ' + compileResult.msg })
                run_loading.value = false
                return
            }
            abiJson.value = JSON.parse(compileResult.abi)
        } catch (e) {
            ElMessage({ type: 'error', message: 'Cannot get ABI: ' + e })
            run_loading.value = false
            return
        }
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
                            res_data = String(decoded[0])
                        } else {
                            res_data = JSON.stringify(
                                Object.fromEntries(funcAbi.outputs.map((o, i) => [o.name || `arg${i}`, decoded[i]])),
                                (k, v) => typeof v === 'bigint' ? v.toString() : v,
                                2
                            )
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
// Main parsing function
function parseSolidity() {
    try {
        // Reset results
        constructor.value = null;
        otherFunctions.value = [];

        // Parse all functions
        parseAllFunctions();

        console.log('Constructor:', constructor.value);
        console.log('Other Functions:', otherFunctions.value);

    } catch (error) {
        console.error('Parse error:', error);
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
