<template>
  <div class="explorer-layout">
    <!-- Sidebar -->
    <aside class="explorer-sidebar">
      <!-- Shard selector -->
      <div class="shard-bar">
        <el-select
          v-model="currentShardId"
          size="small"
          style="flex:1;min-width:0"
          placeholder="Select Shard"
        >
          <el-option :value="0" label="All Shards" />
          <el-option
            v-for="s in shards"
            :key="s.id"
            :value="s.id"
            :label="s.name"
          />
        </el-select>
        <el-tooltip content="Manage shard endpoints">
          <el-button :icon="Setting" size="small" circle @click="settingsOpen = true" style="flex-shrink:0" />
        </el-tooltip>
      </div>

      <el-menu :default-active="route.path" mode="vertical" router class="sidebar-menu">
        <el-menu-item index="/explorer/overview">
          <el-icon><DataAnalysis /></el-icon>
          <span>Overview</span>
        </el-menu-item>
        <el-menu-item index="/explorer/blocks">
          <el-icon><Grid /></el-icon>
          <span>Blocks</span>
        </el-menu-item>
        <el-menu-item index="/explorer/transactions">
          <el-icon><Connection /></el-icon>
          <span>Transactions</span>
        </el-menu-item>
        <el-menu-item index="/explorer/contracts">
          <el-icon><Document /></el-icon>
          <span>Contracts</span>
        </el-menu-item>
        <el-menu-item index="/explorer/gas-presets">
          <el-icon><Odometer /></el-icon>
          <span>Gas Presets</span>
        </el-menu-item>
      </el-menu>
    </aside>

    <!-- Main content -->
    <main class="explorer-content">
      <div class="search-bar">
        <el-input
          v-model="searchInput"
          placeholder="Search: block hash (66 chars) · tx hash (64) · address (42)"
          clearable
          @keyup.enter="handleSearch"
        >
          <template #prepend>
            <el-tag v-if="currentShard.id !== 0" size="small" style="border:none">
              {{ currentShard.name }}
            </el-tag>
            <el-tag v-else size="small" type="warning" style="border:none">All Shards</el-tag>
          </template>
          <template #append>
            <el-button :icon="Search" @click="handleSearch" />
          </template>
        </el-input>
      </div>

      <div class="content-body">
        <router-view />
      </div>
    </main>
  </div>

  <!-- Shard endpoints dialog -->
  <el-dialog v-model="settingsOpen" title="Shard Endpoints" width="540px" destroy-on-close>
    <div style="margin-bottom:16px">
      <el-table :data="shards" size="small" stripe>
        <el-table-column label="Name" prop="name" min-width="100" />
        <el-table-column label="Network ID" prop="networkId" width="100" />
        <el-table-column label="HTTP URL" prop="url" min-width="180">
          <template #default="{ row }">
            <span class="mono-sm">{{ row.url || '(local proxy)' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="" width="60">
          <template #default="{ row }">
            <el-button
              type="danger"
              :icon="Delete"
              size="small"
              link
              @click="removeShard(row.id)"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-divider>Add Shard</el-divider>
    <el-form :model="newShard" label-width="100px" size="small" @submit.prevent="doAddShard">
      <el-form-item label="Name">
        <el-input v-model="newShard.name" placeholder="e.g. Root Shard" />
      </el-form-item>
      <el-form-item label="Network ID">
        <el-input-number v-model="newShard.networkId" :min="0" :max="1023" style="width:100%" />
      </el-form-item>
      <el-form-item label="HTTP URL">
        <el-input v-model="newShard.url" placeholder="http://1.2.3.4:30301 (empty = local proxy)" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit">Add</el-button>
        <el-button @click="settingsOpen = false">Close</el-button>
      </el-form-item>
    </el-form>
  </el-dialog>
</template>

<script setup>
import { ref, computed, provide, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DataAnalysis, Connection, Document, Search, Grid, Odometer, Setting, Delete } from '@element-plus/icons-vue'
import { useShardConfig } from './useShardConfig'

const route = useRoute()
const router = useRouter()
const { shards, addShard, removeShard } = useShardConfig()

// "All Shards" sentinel id = 0
const currentShardId = ref(0)

const currentShard = computed(() =>
  currentShardId.value === 0
    ? { id: 0, networkId: -1, name: 'All Shards', url: null }
    : (shards.value.find(s => s.id === currentShardId.value) ?? shards.value[0] ?? { id: 0, networkId: -1, name: 'All Shards', url: null })
)

// Provide to all child route-view components
provide('explorerShard', currentShard)   // computed ref → inject gets the ref itself
provide('explorerAllShards', shards)     // ref to array

// Search
const searchInput = ref('')

function handleSearch() {
  const val = searchInput.value.trim()
  if (!val) return
  const ep = currentShard.value.url != null ? encodeURIComponent(currentShard.value.url) : ''
  if (val.length === 66) {
    router.push(`/explorer/blocks/${val}${ep ? '?endpoint=' + ep : ''}`)
  } else if (val.length === 64) {
    router.push(`/explorer/transactions/${val}${ep ? '?endpoint=' + ep : ''}`)
  } else if (val.length === 42) {
    router.push(`/explorer/address/${val}${ep ? '?endpoint=' + ep : ''}`)
  } else {
    ElMessage.warning('Input must be a block hash (66 chars), tx hash (64 chars), or address (42 chars)')
  }
}

// Settings dialog
const settingsOpen = ref(false)
const newShard = reactive({ name: '', networkId: 3, url: '' })

function doAddShard() {
  if (!newShard.name.trim()) { ElMessage.warning('Name is required'); return }
  addShard(newShard.name.trim(), newShard.url.trim(), newShard.networkId)
  newShard.name = ''
  newShard.url = ''
  newShard.networkId = 3
  ElMessage.success('Shard added')
}
</script>

<style scoped>
.explorer-layout {
  display: flex;
  height: calc(100vh - 44px);
  overflow: hidden;
}

.explorer-sidebar {
  width: 210px;
  flex-shrink: 0;
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.shard-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color);
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}

.explorer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-bar {
  padding: 10px 16px;
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.content-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.mono-sm {
  font-family: monospace;
  font-size: 12px;
}
</style>
