/**
 * Toast Notification Service
 * Displays success, error, info, and warning messages to users
 */

export interface ToastOptions {
  duration?: number
  position?: 'top' | 'bottom'
}

// Store toast callbacks
const toastCallbacks: {
  success: Array<(message: string, duration?: number) => void>
  error: Array<(message: string, duration?: number) => void>
  info: Array<(message: string, duration?: number) => void>
  warning: Array<(message: string, duration?: number) => void>
} = {
  success: [],
  error: [],
  info: [],
  warning: [],
}

/**
 * Register toast callback (used by toast component)
 */
export function registerToastCallback(
  type: 'success' | 'error' | 'info' | 'warning',
  callback: (message: string, duration?: number) => void
) {
  toastCallbacks[type].push(callback)
  
  return () => {
    toastCallbacks[type] = toastCallbacks[type].filter(cb => cb !== callback)
  }
}

/**
 * Show success toast
 */
export function showSuccessToast(message: string, duration: number = 3000) {
  // First try to use registered callback
  if (toastCallbacks.success.length > 0) {
    toastCallbacks.success[0](message, duration)
    return
  }

  // Fallback: use browser alert (when no UI component is mounted)
  console.log('✓ Success:', message)
}

/**
 * Show error toast
 */
export function showErrorToast(message: string, duration: number = 5000) {
  // First try to use registered callback
  if (toastCallbacks.error.length > 0) {
    toastCallbacks.error[0](message, duration)
    return
  }

  // Fallback: use browser alert (when no UI component is mounted)
  console.error('✗ Error:', message)
}

/**
 * Show info toast
 */
export function showInfoToast(message: string, duration: number = 3000) {
  // First try to use registered callback
  if (toastCallbacks.info.length > 0) {
    toastCallbacks.info[0](message, duration)
    return
  }

  // Fallback
  console.info('ℹ Info:', message)
}

/**
 * Show warning toast
 */
export function showWarningToast(message: string, duration: number = 4000) {
  // First try to use registered callback
  if (toastCallbacks.warning.length > 0) {
    toastCallbacks.warning[0](message, duration)
    return
  }

  // Fallback
  console.warn('⚠ Warning:', message)
}
