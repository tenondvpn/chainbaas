/**
 * 分片首节点注册表。
 *
 * 用户可以配置多套"节点集"（NetworkProfile），每套里按顺序填若干首节点：
 *   index 0 → 分片 2 (root congress)
 *   index 1 → 分片 3
 *   index 2 → 分片 4
 *   …
 *
 * 激活某套配置后，shardora.ts 的 shardUrl() 会优先用这里返回的直连 URL，
 * 否则退回默认的 nginx 代理路径 /api/shardN/。
 */
import { ref, watch, computed } from 'vue'

export interface ShardNode {
    host: string    // IP 或主机名
    port: number    // HTTP 端口
}

export interface NetworkProfile {
    id: string          // 唯一 ID
    name: string        // 展示名称，如 "Local Test Net"
    nodes: ShardNode[]  // 按分片顺序排列，nodes[0] = 分片2，nodes[1] = 分片3 …
}

const STORAGE_KEY = 'shardora_node_profiles'
const ACTIVE_KEY  = 'shardora_active_profile'

// ── 初始化 ────────────────────────────────────────────────────────────────────

function loadProfiles(): NetworkProfile[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function loadActiveId(): string {
    try { return localStorage.getItem(ACTIVE_KEY) ?? '' } catch { return '' }
}

// 模块级单例 —— 所有组件共享同一份响应式状态
const profiles   = ref<NetworkProfile[]>(loadProfiles())
const activeId   = ref<string>(loadActiveId())

// 自动持久化
watch(profiles,  val => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)) } catch {} }, { deep: true })
watch(activeId,  val => { try { localStorage.setItem(ACTIVE_KEY, val) } catch {} })

// ── 计算属性 ──────────────────────────────────────────────────────────────────

export const activeProfile = computed<NetworkProfile | null>(
    () => profiles.value.find(p => p.id === activeId.value) ?? null
)

/**
 * 激活配置中有节点的分片 ID 列表（从分片2开始）。
 * 若无激活配置，返回空数组（调用方退回硬编码默认值）。
 */
export function activeShardIds(): number[] {
    const p = activeProfile.value
    if (!p || p.nodes.length === 0) return []
    return p.nodes.map((_, i) => i + 2)
}

/**
 * 激活配置中属于共识分片（分片号 ≥ 3）的 ID 列表，用于账户探测 / 交易发送。
 * 若无激活配置，返回空数组。
 */
export function activeConsensusShardIds(): number[] {
    return activeShardIds().filter(id => id >= 3)
}

/**
 * 给定分片 ID，返回直连 URL（如 "http://1.2.3.4:23001"），
 * 若该分片在激活配置中没有对应节点，返回 null（由 shardora.ts 退回 nginx 代理）。
 */
export function nodeUrlForShard(shardId: number): string | null {
    const p = activeProfile.value
    if (!p) return null
    const idx = shardId - 2          // 分片2 = index 0，分片3 = index 1 …
    const node = p.nodes[idx]
    if (!node?.host || !node?.port) return null
    return `http://${node.host}:${node.port}`
}

// ── 操作 API ─────────────────────────────────────────────────────────────────

function uuid(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function useNodeRegistry() {
    function addProfile(name: string): NetworkProfile {
        const p: NetworkProfile = { id: uuid(), name: name.trim() || 'New Profile', nodes: [] }
        profiles.value = [...profiles.value, p]
        return p
    }

    function removeProfile(id: string) {
        profiles.value = profiles.value.filter(p => p.id !== id)
        if (activeId.value === id) activeId.value = ''
    }

    function renameProfile(id: string, name: string) {
        profiles.value = profiles.value.map(p => p.id === id ? { ...p, name } : p)
    }

    function setActive(id: string) {
        activeId.value = id
    }

    function clearActive() {
        activeId.value = ''
    }

    function addNode(profileId: string) {
        profiles.value = profiles.value.map(p =>
            p.id === profileId
                ? { ...p, nodes: [...p.nodes, { host: '', port: 0 }] }
                : p
        )
    }

    function removeNode(profileId: string, idx: number) {
        profiles.value = profiles.value.map(p =>
            p.id === profileId
                ? { ...p, nodes: p.nodes.filter((_, i) => i !== idx) }
                : p
        )
    }

    function updateNode(profileId: string, idx: number, patch: Partial<ShardNode>) {
        profiles.value = profiles.value.map(p => {
            if (p.id !== profileId) return p
            const nodes = p.nodes.map((n, i) => i === idx ? { ...n, ...patch } : n)
            return { ...p, nodes }
        })
    }

    return {
        profiles,
        activeId,
        activeProfile,
        addProfile,
        removeProfile,
        renameProfile,
        setActive,
        clearActive,
        addNode,
        removeNode,
        updateNode,
    }
}
