// Explorer shard endpoints - overwrite this file on each deployment target
// The deploy script generates a server-specific version with real IPs
// For local dev: leave url empty (Vite proxy forwards to 127.0.0.1:30302)
window.__EXPLORER_SHARDS__ = [
  { id: 1, networkId: 2, name: 'Root Shard',   url: '' },
]
