'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import Toast from '@/components/ui/Toast'

type Variant = 'info' | 'success' | 'warning' | 'error'

interface ToastEntry { id: number; variant: Variant; message: string }

interface ToastContextValue {
  toast: (message: string, variant?: Variant) => void
}

const Ctx = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const toast = useCallback((message: string, variant: Variant = 'info') => {
    const id = Date.now()
    setToasts((p) => [...p.slice(-4), { id, variant, message }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000)
  }, [])

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            message={t.message}
            onClose={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() { return useContext(Ctx) }
