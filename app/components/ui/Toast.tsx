'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react'
import {
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconInfoCircle,
} from '@tabler/icons-react'
import { cn } from '@/utils/cn'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastInput {
  type: ToastTone
  title?: string
  description?: string
  duration?: number
}

interface ToastItem extends Required<Omit<ToastInput, 'description'>> {
  id: string
  description?: string
}

interface ToastContextValue {
  show: (toast: ToastInput) => string
  success: (description: string, title?: string) => string
  error: (description: string, title?: string) => string
  info: (description: string, title?: string) => string
  warning: (description: string, title?: string) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Em SSR ou antes do Provider montar, retorna no-op silencioso.
    return {
      show: () => '',
      success: () => '',
      error: () => '',
      info: () => '',
      warning: () => '',
      dismiss: () => {},
    } as ToastContextValue
  }
  return ctx
}

const MAX_TOASTS = 4

const tones: Record<
  ToastTone,
  { ring: string; bg: string; icon: ReactNode; defaultTitle: string }
> = {
  success: {
    ring: 'border-emerald-200/80',
    bg: 'bg-emerald-50/95 neon-theme:bg-emerald-950/80',
    icon: <IconCheck size={18} className="text-emerald-600 neon-theme:text-emerald-400" />,
    defaultTitle: 'Sucesso',
  },
  error: {
    ring: 'border-rose-200/80',
    bg: 'bg-rose-50/95 neon-theme:bg-rose-950/80',
    icon: <IconAlertTriangle size={18} className="text-rose-600 neon-theme:text-rose-400" />,
    defaultTitle: 'Erro',
  },
  info: {
    ring: 'border-sky-200/80',
    bg: 'bg-sky-50/95 neon-theme:bg-sky-950/80',
    icon: <IconInfoCircle size={18} className="text-sky-600 neon-theme:text-sky-400" />,
    defaultTitle: 'Informação',
  },
  warning: {
    ring: 'border-amber-200/80',
    bg: 'bg-amber-50/95 neon-theme:bg-amber-950/80',
    icon: <IconAlertTriangle size={18} className="text-amber-600 neon-theme:text-amber-400" />,
    defaultTitle: 'Atenção',
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (toast: ToastInput) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const duration = toast.duration ?? 4500
      const item: ToastItem = {
        id,
        type: toast.type,
        title: toast.title ?? tones[toast.type].defaultTitle,
        description: toast.description,
        duration,
      }
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), item])
      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
      return id
    },
    [dismiss],
  )

  // Limpa timers ao desmontar.
  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((t) => clearTimeout(t))
      map.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (description, title) => show({ type: 'success', description, title }),
      error: (description, title) => show({ type: 'error', description, title }),
      info: (description, title) => show({ type: 'info', description, title }),
      warning: (description, title) => show({ type: 'warning', description, title }),
      dismiss,
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div
      role="region"
      aria-label="Notificações"
      aria-live="polite"
      className="fixed top-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-md animate-slide-in-right',
            tones[t.type].ring,
            tones[t.type].bg,
          )}
        >
          <div className="mt-0.5 shrink-0">{tones[t.type].icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-neutral-900 neon-theme:text-white">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-xs text-neutral-700 neon-theme:text-text-md">{t.description}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Fechar notificação"
            onClick={() => onDismiss(t.id)}
            className="rounded-md p-1 text-neutral-500 hover:bg-black/5 neon-theme:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
