'use client'

import { useState, useTransition } from 'react'
import { IconMail, IconLock, IconEye, IconEyeOff, IconArrowRight, IconLoader2 } from '@tabler/icons-react'
import LoadingBar from '../components/LoadingBar'
import { login } from './actions'

export default function LoginForm({
  error,
  message,
  redirect,
}: {
  error?: string
  message?: string
  redirect?: string
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <form
      className="space-y-5"
      action={(formData) => {
        startTransition(async () => {
          await login(formData)
        })
      }}
    >
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Acessar Painel</h1>
        <p className="text-xs text-[var(--color-text-md)] mt-1.5">Entre com suas credenciais corporativas.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/40 p-3 text-xs font-semibold text-[var(--color-danger)]">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/40 p-3 text-xs font-semibold text-[var(--color-success)]">
          {message}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--color-text-lo)] mb-1.5">
          Email
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]">
            <IconMail size={16} stroke={2} />
          </span>
          <input
            id="email"
            name="email"
            type="email"
            required
            disabled={isPending}
            placeholder="voce@libertycar.com.br"
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-2)] pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-[var(--color-text-mute)] focus:border-[var(--color-neon)] transition-all disabled:opacity-60"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--color-text-lo)] mb-1.5">
          Senha
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-lo)]">
            <IconLock size={16} stroke={2} />
          </span>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            disabled={isPending}
            placeholder="••••••••"
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-2)] pl-10 pr-12 py-2.5 text-sm text-white placeholder:text-[var(--color-text-mute)] focus:border-[var(--color-neon)] transition-all disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-text-lo)] hover:text-[var(--color-neon-soft)] cursor-pointer"
          >
            {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
        </div>
      </div>

      {redirect && <input type="hidden" name="redirect" value={redirect} />}

      {isPending && <LoadingBar className="h-1" />}

      <button
        type="submit"
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-neon)] hover:bg-[var(--color-neon-soft)] text-[#001018] font-extrabold py-3 text-sm transition-all shadow-[0_0_22px_-4px_rgba(0,212,255,0.7)] disabled:opacity-60 cursor-pointer"
      >
        {isPending ? (
          <>
            <IconLoader2 size={16} className="animate-spin" />
            Entrando...
          </>
        ) : (
          <>
            Entrar
            <IconArrowRight size={16} stroke={2.5} />
          </>
        )}
      </button>
    </form>
  )
}
