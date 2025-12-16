<template>
    <div style="overflow: hidden;">
        <el-button-group style="margin-top: 5px;">
            <!-- <el-button plain size="small" type="primary" :icon="DataAnalysis" @click="toCompile">编译</el-button> -->
            <el-button plain size="small" type="primary" :icon="Operation" @click="toDeploy">部署</el-button>

            <el-popover :visible="gas_visible" placement="top" :width="220" style="margin-top: 5px;float: right;">
                <p>预置GAS</p>
                <el-input-number v-model="gas_prepayment" :step="1000000" />
                <div style="text-align: right; margin-top: 20px">
                    <el-button size="small" text @click="gas_visible = false">取消</el-button>
                    <el-button size="small" type="primary" :loading="gas_waiting"  @click="CallGasPrepayment">
                        确认
                    </el-button>
                </div>
                <template #reference>
                    <el-button plain :disabled="contract_address == ''"  size="small" type="primary" :icon="Odometer"
                        @click="gas_visible = true; gas_waiting = false">预置GAS</el-button>
                </template>
            </el-popover>
            <el-button plain size="small" type="primary" :disabled="contract_address == ''" :icon="CaretLeft" @click="toCallFunction">调用函数</el-button>
        </el-button-group>

        <el-popover :visible="visible" placement="top" :width="580" style="margin-top: 5px;float: right;">
            <p>设置合约执行url</p>
            <el-input v-model="test_url" style="width: 540px"  />
            <p>设置私钥</p>
            <el-input v-model="privateKey" style="width: 540px" type="password" placeholder="Please input password"
                show-password />
            <div style="text-align: right; margin-top: 20px">
                <el-button size="small" text @click="visible = false">取消</el-button>
                <el-button size="small" type="primary" @click="toSetPrivateKey">
                    确认
                </el-button>
            </div>
            <template #reference>
                <!-- <el-button @click="visible = true">Delete</el-button> -->
                <el-button plain @click="visible = true" size="small" :icon="Key"
                    style="margin-top: 5px;float: right;"></el-button>
            </template>
        </el-popover>

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
import axios from 'axios';
import qs from 'qs';

const textarea = ref('')
const contract_address = ref('')
const visible = ref(false)
const privateKey = ref('cefc2c33064ea7691aee3e5e4f7842935d26f3ad790d81cf015e79b78958e848')
const test_url = ref('http://192.168.56.136:7001')
const logArea = ref(null);
const gas_visible = ref(false)
const gas_prepayment = ref(1000000)
const gas_waiting = ref(false)

const toCompile = () => {
    emitter.emit('compile_solidity_code', "");
}

onMounted(() => {
    axios.defaults.baseURL = test_url.value;
    emitterOn();
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
    axios.defaults.baseURL = test_url.value;
    visible.value = false
    emitter.emit('set_solidity_private_key', privateKey.value);
    ElMessage({
        type: 'success',
        message: '运行环境设置成功！',
    })
}

const CallGasPrepayment = () => {
    gas_waiting.value = true
    axios.post('/pipeline/set_gas_prepayment/', qs.stringify({
        "gas_prepayment": gas_prepayment.value,
        "private_key": privateKey.value,
        "address": contract_address.value,
    })).then((response) => {
        gas_waiting.value = true
        if (response.data.status != 0) {
            ElMessage({
                type: 'error',
                message: '预置GAS设置失败:' + response.data.msg,
            })
            return;
        }

        ElMessage({
            type: 'success',
            message: '预置GAS设置成功！',
        })
        gas_visible.value = false
    }).catch((error) => {
        gas_waiting.value = true
        ElMessage({
            type: 'error',
            message: '预置GAS设置失败:' + error,
        })
        return;
    });


}

const emitterOff = () => {
emitter.off('compile_solidity_code_res', null);
emitter.off('deploy_solidity_code_res', null);
emitter.off('update_soldity_status_height', null);
emitter.off('compile_solidity_code_res', null);
}

const emitterOn = () => {

emitter.on('compile_solidity_code_res', (data) => {
    textarea.value += "\n------------------------\n";
    if (data.status != 0) {
        textarea.value += "编译错误:\n" + data.msg;
        textarea.value += data.msg
    } else {
        textarea.value += "编译成功!\nABI:\n" + data.abi + "\nBytecode:\n" + data.bytecode;
    }


    nextTick(() => {
        setTimeout(() => {
            logArea.value.focus();
            logArea.value.scrollTop = logArea.value.scrollHeight;
        }, 100)
    })
});

emitter.on('deploy_solidity_code_res', (data) => {
    if (data.id == "") {
        textarea.value = "";
        contract_address.value = "";
        return;
    }

    textarea.value += "\n------------------------\n";
    if (data.status != 0) {
        textarea.value += "\n部署错误:\n" + data.msg;
    } else {
        contract_address.value = data.id;
        textarea.value += "\n部署成功!\n合约地址:\n" + data.id;
    }

    nextTick(() => {
        setTimeout(() => {
            logArea.value.focus();
            logArea.value.scrollTop = logArea.value.scrollHeight;
        }, 100)
    })

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
}
</script>