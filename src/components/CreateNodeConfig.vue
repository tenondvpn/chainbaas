<template>
    <el-form ref="formRef" :model="dynamicForm" :rules="rules" label-width="0px" class="dynamic-form-container">
        <el-form-item style="margin-top: 10px;" v-for="(item, index) in dynamicForm.items" :key="index"
            :prop="'items.' + index + '.value'" :rules="{
                required: false,
                message: '',
                trigger: 'blur',
            }">

            <el-row v-if="!show_description" :gutter="37">
                <el-col :span="6" style="padding: 0px; width: 274px; padding-left: 18px;">
                    <el-input v-model="item.key" aria-label="参数名" placeholder="参数名" />
                </el-col>
                <el-col :span="1" style="padding: 0px;margin-left:10px;margin-right:-4px"> :
                </el-col>
                <el-col :span="16" style="padding: 0px;">
                    <el-input v-model="item.value" aria-label="参数值" placeholder="参数值" />
                </el-col>
            </el-row>
            <el-row v-else :gutter="37">
                <el-col :span="6" style="padding: 0px; width: 214px; padding-left: 18px;">
                    <el-input v-model="item.key" aria-label="参数名" placeholder="参数名" />
                </el-col>
                <el-col :span="1" style="padding: 0px;margin-left:10px;margin-right:-4px"> :
                </el-col>
                <el-col :span="6" style="padding: 0px;">
                    <el-input v-model="item.value" aria-label="参数值" placeholder="参数值" />
                </el-col>
                <el-col :span="1" style="padding: 0px;margin-left:10px;margin-right:-4px"> #
                </el-col>
                <el-col :span="8" style="padding: 0px;">
                    <el-input v-model="item.desc" aria-label="参数描述" placeholder="参数描述" />
                </el-col>
            </el-row>
            <el-button size="small" type="primary" style="margin-left: 20px;" :icon="Minus" circle @click.prevent="removeItem(item)" class="remove-btn" />
        </el-form-item>

        <el-form-item  text-align="center">
            <el-button type="primary" @click="addItem" style="margin-top: 20px;">
                <el-icon>
                    <Plus />
                </el-icon>
                新增参数
            </el-button>
        </el-form-item>
    </el-form>
</template>

<script setup>
import { reactive, ref, onMounted, defineProps } from 'vue';
import { Minus, Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { descriptionItemProps } from 'element-plus';

const props = defineProps({
    show_description: Boolean,
});

const formRef = ref(null);
const show_description = ref(false)


onMounted(() => {
    show_description.value = props.show_description
});

const dynamicForm = reactive({
    items: [
        // { pipeline: '' }, // 每个对象代表一个动态项的数据
        // { task: '' }, // 每个对象代表一个动态项的数据
    ],
});

const rules = reactive({
});

const removeItem = (item) => {
    const index = dynamicForm.items.indexOf(item);
    if (index !== -1) {
        dynamicForm.items.splice(index, 1);
    }
};

const addItem = () => {
    dynamicForm.items.push({
        key: '',
        value: '',
        desc: '',
    });
};

const GetConfigs = () => {
    return dynamicForm.items
}

const ResetForm = () => {
    dynamicForm.items = []
}

const AddConfig = (key, value, desc="") => {
    dynamicForm.items.push({
        key: key,
        value: value,
        desc: desc,
    });
}

defineExpose({
    GetConfigs,
    ResetForm,
    AddConfig,
});

</script>

<style scoped>
.dynamic-form-container {
    max-width: 100%;
    /* margin: 50px auto; */
}

.input-item {
    width: 80%;
    margin-right: 10px;
}

.remove-btn {
    vertical-align: top;
}
</style>