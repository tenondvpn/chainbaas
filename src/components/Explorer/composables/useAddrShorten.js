import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export function useAddrShorten() {
  function shortenAddr(addr) {
    if (!addr || addr.length <= 10) return addr
    return addr.slice(0, 6) + '...' + addr.slice(-4)
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success('Copied to clipboard')
    } catch {
      ElMessage.error('Failed to copy')
    }
  }

  return { shortenAddr, copyToClipboard }
}
