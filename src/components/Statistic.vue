<template>
    <el-row justify="center">
        <el-col :span="22">

                <!-- <el-card style="max-width: 100%"> -->
                <HeaderStatistic />
                <!-- </el-card> -->
        </el-col>
    </el-row>
    <el-row :gutter="24" class="row-bg" justify="center">
        <el-col :span="12">
            <Klines />
        </el-col>
        <el-col :span="12">
            <ThirtyDayUsers />
        </el-col>
    </el-row>
</template>

<script lang="ts">
import HeaderStatistic from './HeaderStatistic.vue';
import ThirtyDayUsers from './ThirtyDayUsers.vue';
import Klines from './Klines.vue';

export default {
    name: 'App',
    components: {
        HeaderStatistic,
        ThirtyDayUsers,
        Klines,
    },
};


</script>
