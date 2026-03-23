export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const currentPageTitle = ref('仪表盘')
  const searchQuery = ref('')

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setPageTitle(title: string) {
    currentPageTitle.value = title
  }

  return {
    sidebarCollapsed,
    currentPageTitle,
    searchQuery,
    toggleSidebar,
    setPageTitle,
  }
})
