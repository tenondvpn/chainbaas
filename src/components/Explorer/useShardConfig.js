import { ref, watch } from 'vue'

const STORAGE_KEY = 'shardora_explorer_shards'

// Runtime shards injected by explorer-config.js (set per deployment environment)
const defaultShards = () => {
  const injected = typeof window !== 'undefined' && window.__EXPLORER_SHARDS__
  if (Array.isArray(injected) && injected.length) return injected
  return [{ id: 1, networkId: 0, name: 'Local Node', url: '' }]
}

// Module-level singleton — all components share the same reactive list
const shards = ref(
  (() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      const parsed = s ? JSON.parse(s) : null
      return Array.isArray(parsed) && parsed.length ? parsed : defaultShards()
    } catch {
      return defaultShards()
    }
  })()
)

watch(shards, val => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)) } catch {}
}, { deep: true })

export function useShardConfig() {
  function addShard(name, url, networkId = 0) {
    const id = Math.max(0, ...shards.value.map(s => s.id)) + 1
    shards.value = [...shards.value, { id, networkId: Number(networkId), name, url: (url || '').replace(/\/$/, '') }]
  }

  function removeShard(id) {
    shards.value = shards.value.filter(s => s.id !== id)
  }

  function updateShard(id, patch) {
    shards.value = shards.value.map(s => s.id === id ? { ...s, ...patch } : s)
  }

  return { shards, addShard, removeShard, updateShard }
}
