import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'liberty'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Texto exibido enquanto `loading` for true. Se ausente, mantém o children. */
  loadingLabel?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-liberty/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white adobe-dark:focus-visible:ring-offset-[var(--color-adobe-bg-1)] transition-[background-color,box-shadow,border-color,color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] hover:-translate-y-0.5 will-change-transform'

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm',
}

const variants: Record<Variant, string> = {
  // No site público (neon-theme) — botão neon primário.
  primary:
    'bg-[var(--color-neon)] hover:bg-[var(--color-neon-soft)] text-[#001018] shadow-[0_0_18px_-4px_rgba(0,212,255,0.6)] hover:shadow-[0_0_24px_0_rgba(0,212,255,0.85)]',
  // Dashboard (claro) — usa o azul Liberty. No dark mode (Adobe) usa o azul de destaque.
  liberty:
    'bg-liberty hover:bg-liberty-deep text-white shadow-sm hover:shadow-lg hover:shadow-liberty/25 adobe-dark:bg-[var(--color-adobe-accent)] adobe-dark:text-[#0a1720] adobe-dark:hover:bg-[var(--color-adobe-accent-deep)] adobe-dark:hover:shadow-[var(--color-adobe-accent-glow)]',
  // Dashboard (claro) — outline neutro.
  secondary:
    'bg-white border border-neutral-200 text-neutral-800 hover:bg-neutral-50 hover:border-neutral-300 hover:shadow-sm adobe-dark:bg-[var(--color-adobe-bg-2)] adobe-dark:border-[var(--color-adobe-line)] adobe-dark:text-[var(--color-adobe-text-hi)] adobe-dark:hover:bg-[var(--color-adobe-bg-3)] adobe-dark:hover:border-[var(--color-adobe-bg-4)]',
  // Dashboard (claro) — sem borda, hover sutil.
  ghost:
    'bg-transparent text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 adobe-dark:text-[var(--color-adobe-text-md)] adobe-dark:hover:bg-[var(--color-adobe-bg-3)] adobe-dark:hover:text-[var(--color-adobe-text-hi)]',
  // Ação destrutiva.
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white shadow-sm hover:shadow-rose-500/20 adobe-dark:bg-[var(--color-adobe-danger)] adobe-dark:hover:bg-[#ff7a7a]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'liberty',
    size = 'md',
    loading = false,
    loadingLabel,
    leftIcon,
    rightIcon,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        base,
        sizes[size],
        variants[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <>
          <IconLoader2 size={size === 'sm' ? 12 : 14} className="animate-spin" />
          {loadingLabel ?? children}
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  )
})
