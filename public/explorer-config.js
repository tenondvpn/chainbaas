// Explorer shard endpoints - overwrite this file on each deployment target
// The deploy script generates a server-specific version with real IPs
// For local dev: leave url empty (Vite proxy forwards to 127.0.0.1:30302)
window.__EXPLORER_SHARDS__ = [
  { id: 1, networkId: 2, name: 'Root Shard (2)',  url: 'http://192.168.25.129:30302' },
  { id: 2, networkId: 3, name: 'Shard 3',         url: 'http://192.168.25.129:30303' },
  { id: 3, networkId: 4, name: 'Shard 4',         url: 'http://192.168.25.129:30304' },
  { id: 4, networkId: 5, name: 'Shard 5',         url: 'http://192.168.25.129:30305' },
  { id: 5, networkId: 6, name: 'Shard 6',         url: 'http://192.168.25.129:30306' },
]
