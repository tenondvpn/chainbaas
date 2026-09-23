<template>
    <div style="overflow: hidden;">
        <el-button-group style="margin-top: 5px;">
            <!-- <el-button plain size="small" type="primary" :icon="DataAnalysis" @click="toCompile">编译</el-button> -->
            <el-button plain size="small" type="primary" :icon="Operation" @click="toDeploy">Deploy</el-button>

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

            <el-popover :visible="visible" placement="top" :width="580">
                <p style="margin:0 0 6px;">Set Private Key (hex, 64 chars)</p>
                <el-input v-model="privateKey" style="width: 540px" type="password" placeholder="Enter your 64-char hex private key"
                    show-password />
                <div style="text-align: right; margin-top: 20px">
                    <el-button size="small" text @click="visible = false">Cancel</el-button>
                    <el-button size="small" type="primary" @click="toSetPrivateKey">
                        Confirm
                    </el-button>
                </div>
                <template #reference>
                    <el-button plain size="small" type="warning" :icon="Key" @click="visible = true">私钥</el-button>
                </template>
            </el-popover>
        </el-button-group>

        <!-- <el-button plain @click="visible = true" size="small" :icon="Key" style="margin-top: 5px;float: right;"></el-button> -->
        <el-tag v-if="contract_address" type="success" style="margin-top: 5px;float: right;">{{ contract_address
        }}</el-tag>

        <el-input ref="logArea" id="solidity_editor_status" clearable readonly resize="none" style="border: 0px;"
            v-model="textarea" :rows="4" type="textarea" placeholder="" />
    </div>

</template>


<script setup lang="ts">
import { DataAnalysis, Operation, CaretLeft, Key, Odometer } from '@element-plus/icons-vue'
import emitter from './EventBus';
import { nextTick, ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { setGasPrefund } from '../services/shardora'

const textarea = ref('')
const contract_address = ref('')
const visible = ref(false)
const privateKey = ref(localStorage.getItem('solidity_private_key') ?? '')
const logArea = ref(null)

function scrollToBottom() {
    nextTick(() => {
        setTimeout(() => {
            const ta = logArea.value?.$el?.querySelector('textarea')
            if (ta) ta.scrollTop = ta.scrollHeight
        }, 50)
    })
}
const gas_visible = ref(false)
const gas_prefund = ref(1000000)
const gas_waiting = ref(false)

const toCompile = () => {
    emitter.emit('compile_solidity_code', "");
}

onMounted(() => {
    textarea.value = "";
    emitterOn();
    // Broadcast stored key so SolidityEditor picks it up on load
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

const toSetPrivateKey = () => {
    const key = privateKey.value.trim().replace(/^0x/, '')
    if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
        ElMessage({ type: 'error', message: 'Private key must be 64 hex characters' })
        return
    }
    privateKey.value = key
    localStorage.setItem('solidity_private_key', key)
    visible.value = false
    emitter.emit('set_solidity_private_key', { prikey: key })
    ElMessage({ type: 'success', message: 'Private key saved' })
}

const CallGasPrepayment = () => {
    gas_waiting.value = true
    setGasPrefund(privateKey.value, 3, contract_address.value, gas_prefund.value)
        .then(result => {
            gas_waiting.value = false
            if (!result.ok) {
                ElMessage({ type: 'error', message: 'Preset GAS setting failed:' + result.msg })
                return
            }
            ElMessage({ type: 'success', message: 'Preset GAS set successfully!' })
            gas_visible.value = false
        }).catch(error => {
            gas_waiting.value = false
            ElMessage({ type: 'error', message: 'Preset GAS setting failed:' + error })
        })


}

const emitterOff = () => {
emitter.off('deploy_progress', null);
emitter.off('compile_solidity_code_res', null);
emitter.off('deploy_solidity_code_res', null);
emitter.off('call_function_solidity_code_res', null);
emitter.off('update_soldity_status_height', null);
}

const emitterOn = () => {

emitter.on('deploy_progress', (msg: string) => {
    textarea.value += '\n' + msg
    scrollToBottom()
})

emitter.on('compile_solidity_code_res', (data) => {
    textarea.value += "\n------------------------\n";
    if (data.status != 0) {
        textarea.value += "Compilation Error:\n" + data.msg;
        textarea.value += data.msg
    } else {
        textarea.value += "Compilation Success!\nABI:\n" + data.abi + "\nBytecode:\n" + data.bytecode;
    }
    scrollToBottom()
});

emitter.on('deploy_solidity_code_res', (data) => {
    if (data.id == "") {
        textarea.value = "";
        contract_address.value = "";
        return;
    }

    textarea.value += "\n------------------------\n";
    if (data.status != 0) {
        textarea.value += "\nDeployment Error: " + data.id;
    } else {
        contract_address.value = data.id;
        textarea.value += "\n Deployment Success! \n Contract Address: " + data.id;
    }
    scrollToBottom()
});

emitter.on('update_soldity_status_height', (height: number | string) => {
    const statusContainer = document.getElementById('solidity-status-container');
    const editorContainer = document.getElementById('solidity_editor_status');
    const numericHeight = Number(height); // convert to number
    var adjustedHeight = numericHeight - 40; // 减去 tabs 高度
    if (adjustedHeight < 0) {
        adjustedHeight = 0;
    }
    if (statusContainer) {
        statusContainer.style.height = adjustedHeight + 'px';
    }

    if (editorContainer) {
        adjustedHeight += 2
        editorContainer.style.height = adjustedHeight + 'px';
    }
});

emitter.on('call_function_solidity_code_res', (data) => {
    const sep = "\n------------------------\n"
    const name = data.funcName ?? 'Call'
    if (data.status === 0) {
        if (data.return_value !== undefined) {
            // View function: show decoded return value
            textarea.value += sep + `${name} => ${data.return_value}`
        } else {
            // Write function confirmed
            textarea.value += sep + `${name}: ${data.msg ?? 'OK'}`
        }
    } else if (data.status === 2) {
        // Submitted, pending receipt
        textarea.value += sep + `${name}: ${data.msg}`
    } else {
        // Error
        textarea.value += sep + `${name} FAILED: ${data.msg ?? 'unknown error'}`
    }
    scrollToBottom()
});
}
</script>
