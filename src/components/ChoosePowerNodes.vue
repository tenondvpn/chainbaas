<template>
    <el-select filterable v-model="power_value" value-key="id" placeholder="请选择算力集群标签"
        style="width: 223px;margin-right:6px;">
        <el-option v-for="item in power_options" :key="item.id" :label="item.name" :value="item" />
    </el-select>
</template>

<script lang="ts" setup>
import axios from 'axios'
import { ref } from 'vue'

type PowerOption = {
    id: string
    name: string
    desc: string
}

const power_value = ref<PowerOption>()
const power_options = ref([])

const ChangcePowerNodes = (type) => {
    axios
        .get('/pipeline/get_power_nodes/', {
            params: {
                "type": type
            }
        })
        .then(response => {
            for (const key in response.data.tags) {
                power_options.value.push({
                    "id": key,
                    "name": key,
                })
            }
            console.log(response.data)
        })
        .catch(error => console.log(error))
}

defineExpose({
    ChangcePowerNodes,
});
</script>
