// Explorer shard endpoints - overwrite this file on each deployment target
// The deploy script generates a server-specific version with real IPs
// For local dev: leave url empty (Vite proxy forwards to 127.0.0.1:30302)
window.__EXPLORER_SHARDS__ = [
  { id: 1, networkId: 2, name: 'Root Shard (2)',  url: '/api/shard2' },
  { id: 2, networkId: 3, name: 'Shard 3',         url: '/api/shard3' },
  { id: 3, networkId: 4, name: 'Shard 4',         url: '/api/shard4' },
  { id: 4, networkId: 5, name: 'Shard 5',         url: '/api/shard5' },
  { id: 5, networkId: 6, name: 'Shard 6',         url: '/api/shard6' },
]
