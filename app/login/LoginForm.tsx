'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowRight,
} from '@tabler/icons-react'
import LoadingBar from '../components/LoadingBar'
import { Button, Input, useToast } from '../components/ui'
import { login } from './actions'

const initialState: { error?: string } = {}

export default function LoginForm({
  message,
  redirect,
}: {
  message?: string
  redirect?: string
}) {
  const [state, formAction, isPending] = useActionState(login, initialState)
  const [showPassword, setShowPassword] = useState(false)
  const toast = useToast()

  // Toasts: erro do useActionState; mensagem de sucesso vinda da query string.
  useEffect(() => {
    if (state.error) toast.error(state.error, 'Falha no login')
  }, [state.error, toast])

  useEffect(() => {
    if (message) toast.success(message, 'Tudo certo')
  }, [message, toast])

  return (
    <form
      className="space-y-5"
      action={redirect ? (fd) => {
        fd.append('redirect', redirect)
        formAction(fd)
      } : formAction}
    >
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Acessar Painel</h1>
        <p className="text-xs text-text-md mt-1.5">Entre com suas credenciais corporativas.</p>
      </div>

      <Input
        type="email"
        name="email"
        label="Email"
        required
        disabled={isPending}
        placeholder="voce@libertycar.com.br"
        autoComplete="email"
        inputMode="email"
        leftIcon={<IconMail size={16} stroke={2} />}
      />

      <Input
        name="password"
        label="Senha"
        required
        minLength={6}
        disabled={isPending}
        placeholder="••••••••"
        autoComplete="current-password"
        type={showPassword ? 'text' : 'password'}
        leftIcon={<IconLock size={16} stroke={2} />}
        rightAdornment={
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={showPassword}
            className="flex items-center px-2 text-text-lo hover:text-neon-soft cursor-pointer"
          >
            {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
        }
      />

      {isPending && <LoadingBar className="h-1" />}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isPending}
        fullWidth
        rightIcon={<IconArrowRight size={16} stroke={2.5} />}
      >
        Entrar
      </Button>
    </form>
  )
}
