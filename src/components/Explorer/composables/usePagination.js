import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export function usePagination(fetchFn) {
  const list = ref([])
  const loading = ref(false)
  const hasMore = ref(false)
  const hasPrev = ref(false)

  // cursorStack[i] = the cursor to load page i (null = first page)
  const cursorStack = ref([null])
  const currentPage = ref(0)
  // nextCursor returned by the current page's response
  const pendingNextCursor = ref(null)

  async function load(cursor) {
    loading.value = true
    try {
      const res = await fetchFn(cursor)
      if (res && res.code === 0) {
        list.value = res.data || []
        hasMore.value = !!res.has_more
        pendingNextCursor.value = res.next_cursor ?? null
      } else {
        ElMessage.error('Failed to load data')
        list.value = []
        hasMore.value = false
      }
    } catch {
      ElMessage.error('Failed to load data')
      list.value = []
      hasMore.value = false
    } finally {
      loading.value = false
    }
  }

  async function reload() {
    cursorStack.value = [null]
    currentPage.value = 0
    hasPrev.value = false
    await load(null)
  }

  async function nextPage() {
    if (!hasMore.value) return
    const nextCursor = pendingNextCursor.value
    currentPage.value += 1
    // Trim stack and push next cursor for this page
    cursorStack.value = [...cursorStack.value.slice(0, currentPage.value), nextCursor]
    hasPrev.value = true
    await load(nextCursor)
  }

  async function prevPage() {
    if (!hasPrev.value) return
    currentPage.value -= 1
    hasPrev.value = currentPage.value > 0
    await load(cursorStack.value[currentPage.value])
  }

  load(null)

  return { list, loading, hasMore, hasPrev, nextPage, prevPage, reload }
}
