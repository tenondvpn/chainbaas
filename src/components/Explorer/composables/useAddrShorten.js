import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export function useAddrShorten() {
  function shortenAddr(addr) {
    if (!addr || addr.length <= 10) return addr
    return addr.slice(0, 6) + '...' + addr.slice(-4)
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // fallback for HTTP (non-secure) context
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      ElMessage.success('Copied to clipboard')
    } catch {
      ElMessage.error('Failed to copy')
    }
  }

  return { shortenAddr, copyToClipboard }
}
