export interface ToastItem {
  id: number
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration: number
}

const toasts = ref<ToastItem[]>([])
let nextId = 0

export function useToast() {
  function add(type: ToastItem['type'], message: string, duration = 3000) {
    const id = nextId++
    toasts.value.push({ id, type, message, duration })
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
    return id
  }

  function remove(id: number) {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  function success(message: string, duration?: number) {
    return add('success', message, duration)
  }

  function error(message: string, duration?: number) {
    return add('error', message, duration ?? 5000)
  }

  function info(message: string, duration?: number) {
    return add('info', message, duration)
  }

  function warning(message: string, duration?: number) {
    return add('warning', message, duration ?? 4000)
  }

  return {
    toasts: readonly(toasts),
    add,
    remove,
    success,
    error,
    info,
    warning,
  }
}
