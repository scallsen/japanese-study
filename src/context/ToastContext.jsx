import { createContext, useContext, useState, useCallback } from 'react'
import Toast from '../components/Toast.jsx'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null) // { message, actionLabel, onAction, duration }
  const [open, setOpen] = useState(false)

  // Wrapped in useCallback since it's handed out through context — a stable
  // reference means callers can safely list it in their own effect deps.
  const showToast = useCallback(({ message, actionLabel, onAction, duration }) => {
    setToast({ message, actionLabel, onAction, duration })
    setOpen(true)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          open={open}
          variant="bottom-card"
          message={toast.message}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          duration={toast.duration}
          onDismiss={() => setOpen(false)}
        />
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
