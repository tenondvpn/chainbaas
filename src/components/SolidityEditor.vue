<template>
    <div class="editor-container" :class="{ 'fullscreen': isFullscreen }">
        <div class="editor-wrapper" ref="editorContainer">
            <div ref="editorElement" class="code-editor"></div>
        </div>
    </div>

    <el-dialog v-model="dialogFormVisible" :title=dialogTitle width="500">
        <el-form ref="formRef" :model="form" style="margin-top: 10px;" label-width="0px" class="dynamic-form-container">
            <el-form-item v-if="not_constructer">
                <el-row :gutter="37">
                    <el-col :span="7" style="padding: 0px; width: 307px; padding-left: 18px;">
                        <el-text class="mx-1" type="info">选择函数</el-text>
                    </el-col>
                    <el-col :span="15" style="padding: 0px;">
                        <el-select v-model="form.function" placeholder="选择函数" @change="changeFunction">
                            <el-option v-for="item in otherFunctions" :key="item.name" :label="item.name"
                                :value="item.name" />
                        </el-select>
                    </el-col>
                </el-row>
            </el-form-item>
            <el-form-item v-if="!not_constructer">
                <el-row :gutter="37">
                    <el-col :span="7" style="padding: 0px; width: 200px; padding-left: 18px;">
                        <el-text class="mx-1" type="info">预置GAS</el-text>
                    </el-col>
                    <el-col :span="15" style="padding: 0px;">
                        <el-input-number v-model="gas_prepayment" :step="1000000" />
                    </el-col>
                </el-row>
            </el-form-item>
            <el-form-item>
                <el-row :gutter="37">
                    <el-col :span="7" style="padding: 0px; width: 200px; padding-left: 18px;">
                        <el-text class="mx-1" type="info">金额</el-text>
                    </el-col>
                    <el-col :span="15" style="padding: 0px;">
                        <el-input-number v-model="transfer_amount" :step="1000000" />
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
                    </el-col>
                    <el-col :span="6" style="padding: 0px; width: 297px; padding-left: 18px;">
                        <el-input v-model="item.key" aria-label="参数名" placeholder="参数名" />
                    </el-col>
                    <el-col :span="1" style="padding: 0px;margin-left:10px;margin-right:-4px"> :
                    </el-col>
                    <el-col :span="12" style="padding: 0px;">
                        <el-input v-model="item.value" aria-label="参数值" placeholder="参数值" />
                    </el-col>
                </el-row>
            </el-form-item>
        </el-form>
        <template #footer>
            <div class="dialog-footer">
                <el-button @click="dialogFormVisible = false">取消</el-button>
                <el-button type="primary" @click="confirmDialog" :loading="run_loading">
                    执行
                </el-button>
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
import axios from 'axios'
import qs from 'qs'
import { ElMessage } from 'element-plus'
import { useDark } from "@vueuse/core";
import { Prec } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const themes = {
  'one-dark': oneDark,
  'default': EditorView.theme({  // 默认纯白：自定义简单主题
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
const preivateKey = ref('cefc2c33064ea7691aee3e5e4f7842935d26f3ad790d81cf015e79b78958e848')
var editorView = ref()
const constructor = ref(null)
const otherFunctions = ref([])
const dialogFormVisible = ref(false)
const formLabelWidth = '140px'
const not_constructer = ref(false)
const dialogTitle = ref('填写构造函数参数')
const contractAddress = ref('')
const gas_prepayment = ref(0)
const transfer_amount = ref(0)
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
    var adjustedHeight = numericHeight - 10; // 减去 tabs 高度
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

emitter.on('compile_solidity_code', (code: string) => {
    // run_loading.value = false
    axios
        .post(test_url.value + '/pipeline/compile_solidity/', qs.stringify({
            'source_code': codeValue.value,
        }))
        .then(response => {
            emitter.emit('compile_solidity_code_res', response.data);
            if (response.data.status != 0) {
                console.log("Compilation error:", response.data.msg);
                return;
            }

            console.log(response.data.abi)
            console.log(response.data.bytecode)
        })
        .catch(error => {
            console.log(error)
        })
});

emitter.on('deploy_solidity_code', (code: string) => {
    // run_loading.value = false
    not_constructer.value = false
    if (!preivateKey.value || preivateKey.value.length == 0) {
        ElMessage({
            type: 'warning',
            message: '请先输入私钥！',
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
        dialogFormVisible.value = true;
    } else {
        deploySolidity();
    }
});

emitter.on('call_function_solidity_code', (code: string) => {
    run_loading.value = false
    dialogTitle.value = '调用合约函数'
    parseSolidity()
    form.args = []
    if (otherFunctions.value.length == 0) {
        ElMessage({
            type: 'warning',
            message: '合约中没有可调用的函数！',
        })
        return;
    }

    form.function = otherFunctions.value[0].name
    changeFunction()
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
}

function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;  // 解析成功，返回 true
  } catch (error) {
    return false; // 解析失败，返回 false
  }
}

const update_graph = (data) => {
    emitter.emit('deploy_solidity_code_res', {"status": 0, "id": ""});
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
            console.log("get abi: ", obj["abi"])
            emitter.emit('deploy_solidity_code_res', {"status": 0, "id": obj["address"]});
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
        deploySolidity()
    }
}

function decodeOutput(abi, functionName, outputHex) {
    // 找到对应的函数 ABI 项
    const funcAbi = abi.find(item => 
        item.type === "function" && 
        item.name === functionName &&
        item.outputs && item.outputs.length > 0
    );

    if (!funcAbi) {
        throw new Error(`Function ${functionName} not found in ABI`);
    }

    // 只支持单个返回值的情况（大多数 view 函数如此）
    if (funcAbi.outputs.length !== 1) {
        console.warn("Warning: Multiple outputs detected, only returning the first one.");
    }

    const outputType = funcAbi.outputs[0].type;
    const cleanHex = outputHex.startsWith('0x') ? outputHex.slice(2) : outputHex;

    return abiDecode(outputType, cleanHex);
}

// 简易 ABI 解码器（支持 uint、bool、address、string、bytes）
function abiDecode(type, hexData) {
    const data = hexData.toLowerCase();

    if (type === "string") {
        // 动态类型：先读偏移 → 读长度 → 读数据
        const offset = parseInt(data.slice(0, 64), 16);           // 0x20 = 32 bytes
        const length = parseInt(data.slice(offset * 2, offset * 2 + 64), 16);
        const stringDataHex = data.slice(offset * 2 + 64, offset * 2 + 64 + length * 2);
        
        // 每两个字符转成字节，再转 UTF-8 字符串
        let str = '';
        for (let i = 0; i < stringDataHex.length; i += 2) {
            str += String.fromCharCode(parseInt(stringDataHex.substr(i, 2), 16));
        }
        return str;

    } else if (type.startsWith("uint") || type.startsWith("int")) {
        // 静态数值类型：最后 64 位是值
        const valueHex = data.slice(-64);
        return BigInt('0x' + valueHex).toString();

    } else if (type === "bool") {
        const valueHex = data.slice(-64);
        return parseInt(valueHex, 16) !== 0;

    } else if (type === "address") {
        const addr = data.slice(-64).padStart(64, '0');
        return '0x' + addr.slice(-40);

    } else if (type === "bytes") {
        const offset = parseInt(data.slice(0, 64), 16);
        const length = parseInt(data.slice(offset * 2, offset * 2 + 64), 16);
        return '0x' + data.slice(offset * 2 + 64, offset * 2 + 64 + length * 2);

    } else {
        return `[Unsupported type: ${type}] Raw: 0x${data}`;
    }
}

function callFunction() {
    var types = []
    var values = []
    for (let arg of form.args) {
        if (arg.value.trim().length == 0) {
            ElMessage({
                type: 'warning',
                message: '请填写参数：' + arg.key,
            })

            run_loading.value = false
            return
        }
        types.push(arg.type)
        values.push(arg.value)
    }

    var abiFunction = abiJson.value.find((item) => item.type === 'function' && item.name === form.function);
    if (abiFunction) {
        if (abiFunction.inputs.length != types.length) {
            ElMessage({
                type: 'error',
                message: '函数调用失败，函数参数数量不匹配！',
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
        axios
            .post(test_url.value + '/pipeline/query_function_solidity/', qs.stringify({
                'address': contractAddress.value,
                'function_name': form.function,
                'function_types': types.join(','),
                'function_args': values.join(','),
                'private_key': preivateKey.value,
            }))
            .then(response => {
                run_loading.value = false
                emitter.emit('call_function_solidity_code_res', response.data);
                if (response.data.status != 0) {
                    ElMessage({
                        type: 'error',
                        message: '函数调用失败：' + response.data.msg,
                    })
                    return;
                }

                var res_data = response.data.return_value;
                try {
                    res_data = decodeOutput(abiJson.value, form.function,  response.data.return_value);
                    // 输出：Function name() 返回值: test
                } catch (err) {
                    console.error("解析失败:", err.message);
                }

                ElMessage({
                    type: 'success',
                    message: '函数调用成功，返回值：' + res_data,
                })
                dialogFormVisible.value = false
            })
            .catch(error => {
                run_loading.value = false
                ElMessage({
                    type: 'error',
                    message: '函数调用失败：' + error,
                })
            })
    } else {
        axios
            .post(test_url.value + '/pipeline/call_function_solidity/', qs.stringify({
                'address': contractAddress.value,
                'function_name': form.function,
                'function_types': types.join(','),
                'function_args': values.join(','),
                'private_key': preivateKey.value,
                'amount': transfer_amount.value,
            }))
            .then(response => {
                run_loading.value = false
                emitter.emit('call_function_solidity_code_res', response.data);
                if (response.data.status != 0) {
                    ElMessage({
                        type: 'error',
                        message: '函数调用失败：' + response.data.msg,
                    })
                    return;
                }

                ElMessage({
                    type: 'success',
                    message: '函数调用成功，返回值：' + response.data.return_value,
                })
                dialogFormVisible.value = false
            })
            .catch(error => {
                run_loading.value = false
                ElMessage({
                    type: 'error',
                    message: '函数调用失败：' + error,
                })
            })
    }

    
}

function deploySolidity() {
    dialogTitle.value = '填写构造函数参数'
    not_constructer.value = false
    var types = []
    var values = []
    for (let arg of form.args) {
        if (arg.value.trim().length == 0) {
            ElMessage({
                type: 'warning',
                message: '请填写参数：' + arg.key,
            })
            run_loading.value = false
            return
        }
        types.push(arg.type)
        values.push(arg.value)
    }

    axios
        .post(test_url.value + '/pipeline/compile_solidity/', qs.stringify({
            'source_code': codeValue.value,
        }))
        .then(response => {
            emitter.emit('compile_solidity_code_res', response.data);
            if (response.data.status != 0) {
                ElMessage({
                    type: 'error',
                    message: '合约部署失败，编译错误：' + response.data.msg,
                })
                run_loading.value = false
                return;
            }

            abiJson.value = JSON.parse(response.data.abi);
            var abiConstructor = abiJson.value.find((item) => item.type === 'constructor');
            if (abiConstructor) {
                if (abiConstructor.inputs.length != types.length) {
                    ElMessage({
                        type: 'error',
                        message: '合约部署失败，构造函数参数数量不匹配！',
                    })
                    run_loading.value = false
                    return;
                }
                
                types = []
                for (let input of abiConstructor.inputs) {
                    types.push(input.type);
                }
            }

            axios
                .post(test_url.value + '/pipeline/deploy_solidity/', qs.stringify({
                    'bytecode': response.data.bytecode,
                    'private_key': preivateKey.value,
                    'code_type': 0,
                    'function_types': types.join(','),
                    'function_args': values.join(','),
                    'amount': transfer_amount.value,
                    'gas_prepayment': gas_prepayment.value,
                }))
                .then(response => {
                    emitter.emit('deploy_solidity_code_res', response.data);
                    if (response.data.status != 0) {
                        ElMessage({
                            type: 'error',
                            message: '合约部署失败：' + response.data.msg,
                        })
                        return;
                    }

                    ElMessage({
                        type: 'success',
                        message: '合约部署成功，合约地址：' + response.data.id,
                    })
                    dialogFormVisible.value = false
                    contractAddress.value = response.data.id;
                    prev_save_graph_tm_ms = 0;
                    prev_saved_code.value = "";
                    TimeToSaveGraph();
                })
                .catch(error => {
                    ElMessage({
                        type: 'error',
                        message: '合约部署失败：' + error,
                    })
                })
        })
        .catch(error => {
            run_loading.value = false
            ElMessage({
                type: 'error',
                message: '合约部署失败：' + error,
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
// 主解析函数
function parseSolidity() {
    try {
        // 重置结果
        constructor.value = null;
        otherFunctions.value = [];

        // 解析所有函数
        parseAllFunctions();

        console.log('Constructor:', constructor.value);
        console.log('Other Functions:', otherFunctions.value);

    } catch (error) {
        console.error('解析错误:', error);
    }
}

// 核心解析函数
function parseAllFunctions() {
    // 正则匹配 constructor 和 function 声明
    // 支持：修饰符顺序随意、空格、payable、returns (...) 等
    // 匹配 constructor 或 function，支持修饰符顺序随意、多余空格、returns 等
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

        // 解析参数（支持 memory/storage/calldata）
        const parameters = parseParameters(paramsStr);

        // 解析可见性
        const visibility = parseVisibility(fullMatch);

        // 解析状态可变性（view / pure / payable / nonpayable）
        const stateMutability = parseStateMutability(fullMatch);

        // 解析返回类型
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

// 解析参数（支持类型 修饰符 名称，如 uint256[] memory ids）
function parseParameters(paramsStr) {
    if (!paramsStr) return [];

    return paramsStr.split(',').map(param => {
        const trimmed = param.trim();
        if (!trimmed) return null;

        // 按空格分割
        const parts = trimmed.split(/\s+/).filter(p => p);

        if (parts.length === 0) return null;

        const dataLocationModifiers = ['memory', 'storage', 'calldata'];
        let modifiers = [];
        let typeEndIndex = 0;

        // 从后往前找数据位置修饰符（通常在类型后、名称前）
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

// 解析返回类型
function parseReturnType(returnsStr) {
    if (!returnsStr) return '';

    // 支持多个返回参数，如 uint256 balance, bool success
    const types = returnsStr.split(',').map(t => t.trim());
    return types.map(t => {
        const parts = t.split(/\s+/);
        return parts.slice(0, parts.length - 1).join(' ') || t; // 去掉可能的变量名
    }).join(', ');
}

// 解析可见性
function parseVisibility(codeSnippet) {
    const lower = codeSnippet.toLowerCase();
    if (lower.includes('public')) return 'public';
    if (lower.includes('private')) return 'private';
    if (lower.includes('internal')) return 'internal';
    if (lower.includes('external')) return 'external';
    return 'internal'; // 默认
}

// 解析状态可变性（关键：支持 view）
function parseStateMutability(codeSnippet) {
    const lower = codeSnippet.toLowerCase();

    if (lower.includes('pure')) return 'pure';
    if (lower.includes('view')) return 'view';
    if (lower.includes('payable')) return 'payable';
    return 'nonpayable'; // 默认可修改状态
}

// Solidity关键字和代码片段
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
        detail: '创建新合约'
    },
    {
        label: 'function',
        type: 'function',
        apply: `function \${1:functionName}() public \${2|view,pure|} returns (\${3}) {\n    \${0}\n}`,
        detail: '函数定义'
    },
    {
        label: 'event',
        type: 'keyword',
        apply: `event \${1:EventName}(\${2});`,
        detail: '事件定义'
    },
    {
        label: 'modifier',
        type: 'keyword',
        apply: `modifier \${1:modifierName} {\n    \${0}\n    _;\n}`,
        detail: '修饰器定义'
    }
]

// 自动完成器
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

    // 可选：自定义 light mode 下的语法高亮（更清晰的颜色）
const lightHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: "#d73a49", fontWeight: "bold" },        // 关键字红色加粗
    { tag: tags.function(tags.variableName), color: "#6f42c1" },       // 函数名紫色
    { tag: tags.string, color: "#032f62" },                            // 字符串深蓝
    { tag: tags.number, color: "#005cc5" },                            // 数字蓝色
    { tag: tags.comment, color: "#6a737d", fontStyle: "italic" },      // 注释灰色斜体
    { tag: tags.variableName, color: "#24292e" },
    { tag: tags.operator, color: "#d73a49" },
    { tag: tags.typeName, color: "#22863a" },                          // 类型绿色
    { tag: tags.propertyName, color: "#e36209" }
]);

// Light Theme 配置
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



// 初始化编辑器
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
        //         backgroundColor: "#ffffff",  // 纯白背景
        //         color: "#24292e"             // 深灰文字（类似 GitHub）
        //     },
        //     ".cm-content": {
        //         fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        //         fontSize: "12px",
        //         color: "#24292e",
        //         caretColor: "#0366d6"        // 蓝色光标，更醒目
        //     },
        //     ".cm-gutter": {
        //         fontFamily: "inherit",
        //         fontSize: "inherit",
        //         backgroundColor: "#f6f8fa",  // 浅灰 gutter 背景
        //         color: "#6a737d"             // 灰色行号
        //     },
        //     ".cm-gutters": {
        //         backgroundColor: "#f6f8fa",
        //         borderRight: "1px solid #e1e4e8"
        //     },
        //     ".cm-activeLine": {
        //         backgroundColor: "#ffd33d1a" // 浅黄高亮当前行
        //     },
        //     ".cm-activeLineGutter": {
        //         backgroundColor: "#f6f8fa"
        //     },
        //     ".cm-selectionBackground, ::selection": {
        //         backgroundColor: "#0366d699" // 半透明蓝色选中背景
        //     },
        //     "&.cm-focused .cm-selectionBackground": {
        //         backgroundColor: "#0366d699"
        //     },
        //     ".cm-cursor, .cm-dropCursor": {
        //         borderLeftColor: "#0366d6"   // 蓝色光标
        //     },
        //     ".cm-matchingBracket, .cm-nonmatchingBracket": {
        //         backgroundColor: "#0366d633",
        //         outline: "1px solid #0366d666"
        //     }
        // }, { dark: true }),
        // 新增：绑定 Ctrl+S（Windows/Linux） / Cmd+S（Mac） 保存事件
        Prec.highest(  // 使用最高优先级，确保不会被其他 keymap 覆盖
            keymap.of([
                {
                    key: 'Ctrl-s',      // Windows/Linux
                    mac: 'Cmd-s',       // Mac
                    run: (view) => {
                        prev_save_graph_tm_ms = 0;
                        TimeToSaveGraph()
                        return true;  // 返回 true 表示事件已处理
                    },
                    preventDefault: true  // 防止触发浏览器默认保存对话框
                }
            ])
        )
    ]

    // 添加主题
    console.log("default is isDark: ", isDark.value)
    if (isDark.value) {
        extensions.push(themeCompartment.of(oneDark))
    } else {
        extensions.push(themeCompartment.of([
            lightTheme,
            syntaxHighlighting(lightHighlightStyle)  // 同时切换高亮风格
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

    // 监听光标位置变化
    editorView.dom.addEventListener('mousemove', updateCursorFromEvent)
    editorView.dom.addEventListener('keydown', updateCursorFromEvent)
}

// 切换到白色主题的函数（随时调用）
function switchToLightTheme() {
    editorView.dispatch({
        effects: themeCompartment.reconfigure([
            lightTheme,
            syntaxHighlighting(lightHighlightStyle)  // 同时切换高亮风格
        ])
    });
}

// 切换回暗色主题的函数（可选）
function switchToDarkTheme() {
    editorView.dispatch({
        effects: themeCompartment.reconfigure(oneDark)
    });
}

// 更新光标位置
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

// 生命周期
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

const TimeToSaveGraph = () => {
    var now_tm_ms = getTimestamp();
    if (prev_saved_code.value != codeValue.value && (prev_save_graph_tm_ms + 10 < now_tm_ms)) {
        var json_data = {
            "code": codeValue.value,
            "address": contractAddress.value,
            "abi": JSON.stringify(abiJson.value)
        }
        axios
            .post('/pipeline/update_pipline_graph/' + pipeline_id.value + "/", qs.stringify({
                'graph': JSON.stringify(json_data),
            }))
            .then(response => {
                console.log("save pipeline: %d", pipeline_id.value);
            })
            .catch(error => console.log(error))
        prev_save_graph_tm_ms = now_tm_ms;
        prev_saved_code.value = codeValue.value
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

// 监听代码变化
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

/* 深色主题适配 */
:deep(.cm-editor) {
    height: 100%;
}

:deep(.cm-scroller) {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    line-height: 1.5;
}

/* 响应式设计 */
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
