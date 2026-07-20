'use client'

import { useState, useTransition } from 'react'
import LoadingBar from '../components/LoadingBar'
import { login } from './actions'

export default function LoginForm({
  error,
  message,
}: {
  error?: string
  message?: string
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <form
      className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      action={(formData) => {
        startTransition(async () => {
          await login(formData)
        })
      }}
    >
      <h1 className="text-2xl font-semibold">Entrar</h1>

      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}
      {message && (
        <p className="rounded bg-green-50 p-2 text-sm text-green-600">
          {message}
        </p>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          disabled={isPending}
          className="mt-1 w-full rounded border px-3 py-2 disabled:opacity-60"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Senha
        </label>
        <div className="relative mt-1">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            disabled={isPending}
            className="w-full rounded border px-3 py-2 pr-12 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-semibold text-neutral-500 hover:text-neutral-800 cursor-pointer"
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      {isPending && <LoadingBar className="h-1" />}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded bg-black py-2 text-white disabled:opacity-60 cursor-pointer"
        >
          {isPending ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </form>
  )
}
