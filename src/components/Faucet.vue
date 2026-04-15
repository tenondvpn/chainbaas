<template>
    <div class="faucet-container">
        <el-card class="faucet-card" shadow="always">
            <template #header>
                <div class="card-header">
                    <el-icon size="28" color="var(--el-color-primary)"><Coin /></el-icon>
                    <span class="title">Test Token Faucet</span>
                </div>
            </template>

            <p class="desc">Enter your wallet address to receive test tokens. Each request sends a fixed amount from the faucet account.</p>

            <el-form :model="form" label-position="top" @submit.prevent="requestTokens">
                <el-form-item label="Wallet Address">
                    <el-input
                        v-model="form.address"
                        placeholder="e.g. 1588a76e20628485a854c6e131f278d87b694579"
                        clearable
                        size="large"
                    />
                </el-form-item>

                <el-form-item label="Amount">
                    <el-input-number
                        v-model="form.amount"
                        :min="1"
                        :step="1000000"
                        size="large"
                        style="width: 100%"
                    />
                </el-form-item>

                <el-form-item>
                    <el-button
                        type="primary"
                        size="large"
                        :loading="loading"
                        :disabled="!form.address.trim()"
                        style="width: 100%"
                        @click="requestTokens"
                    >
                        Request Tokens
                    </el-button>
                </el-form-item>
            </el-form>

            <el-alert
                v-if="result"
                :title="result.message"
                :type="result.type"
                :description="result.txid ? 'Tx ID: ' + result.txid : ''"
                show-icon
                closable
                @close="result = null"
            />
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Coin } from '@element-plus/icons-vue'
import axios from 'axios'
import qs from 'qs'

const form = ref({ address: '', amount: 10000000 })
const loading = ref(false)
const result = ref<{ type: 'success' | 'error'; message: string; txid?: string } | null>(null)

const requestTokens = async () => {
    if (!form.value.address.trim()) return
    loading.value = true
    result.value = null
    try {
        const response = await axios.post('/pipeline/faucet/', qs.stringify({
            address: form.value.address.trim(),
            amount: form.value.amount,
        }))
        if (response.data.status === 0) {
            result.value = {
                type: 'success',
                message: 'Tokens sent successfully!',
                txid: response.data.tx_id ?? response.data.txid ?? '',
            }
        } else {
            result.value = { type: 'error', message: 'Failed: ' + (response.data.msg || 'Unknown error') }
        }
    } catch (err) {
        result.value = { type: 'error', message: 'Request failed: ' + err }
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.faucet-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: calc(100vh - 44px);
    padding: 24px;
}

.faucet-card {
    width: 100%;
    max-width: 520px;
}

.card-header {
    display: flex;
    align-items: center;
    gap: 10px;
}

.title {
    font-size: 20px;
    font-weight: 600;
}

.desc {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    margin-bottom: 20px;
    line-height: 1.6;
}
</style>
