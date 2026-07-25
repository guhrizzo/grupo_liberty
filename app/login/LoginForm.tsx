'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowRight,
  IconKey,
  IconX,
} from '@tabler/icons-react'
import LoadingBar from '../components/LoadingBar'
import { Button, Input, useToast } from '../components/ui'
import { login, requestPasswordReset } from './actions'

const initialState: { error?: string } = {}

export default function LoginForm({
  message,
  redirect,
}: {
  message?: string
  redirect?: string
}) {
  const [state, formAction, isPending] = useActionState(login, initialState)
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [isResetting, startResetTransition] = useTransition()
  const toast = useToast()

  // Toasts: erro do useActionState; mensagem de sucesso vinda da query string.
  useEffect(() => {
    if (state.error) toast.error(state.error, 'Falha no login')
  }, [state.error, toast])

  useEffect(() => {
    if (message) toast.success(message, 'Tudo certo')
  }, [message, toast])

  function handleOpenResetModal() {
    setResetEmail(email)
    setShowResetModal(true)
  }

  function handleSendReset(e: React.FormEvent) {
    e.preventDefault()
    startResetTransition(async () => {
      const res = await requestPasswordReset(resetEmail)
      if (res.error) {
        toast.error(res.error, 'Erro ao enviar')
      } else if (res.success) {
        toast.success(res.success, 'Verifique sua caixa de entrada e SPAM')
        setShowResetModal(false)
      }
    })
  }

  return (
    <>
      <form
        className="space-y-5"
        action={
          redirect
            ? (fd) => {
                fd.append('redirect', redirect)
                formAction(fd)
              }
            : formAction
        }
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@libertycar.com.br"
          autoComplete="email"
          inputMode="email"
          leftIcon={<IconMail size={16} stroke={2} />}
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-text-hi">Senha</span>
            <button
              type="button"
              onClick={handleOpenResetModal}
              className="text-xs font-semibold text-liberty hover:underline cursor-pointer"
            >
              Esqueceu sua senha?
            </button>
          </div>
          <Input
            name="password"
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
        </div>

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

      {/* Modal de Recuperação de Senha */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <IconX size={18} />
            </button>

            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-liberty/10 border border-liberty/20 text-liberty-deep mx-auto mb-4">
              <IconKey size={22} stroke={2} />
            </div>

            <h2 className="text-xl font-bold text-white text-center">Recuperar Senha</h2>
            <p className="text-xs text-neutral-400 text-center mt-2 leading-relaxed">
              Informe seu e-mail cadastrado. Enviaremos um link seguro para você redefinir sua senha.
            </p>

            <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300 flex items-start gap-2.5">
              <span className="text-base leading-none">⚠️</span>
              <div>
                <p className="font-semibold text-amber-200">Atenção para a caixa de Spam!</p>
                <p className="text-[11px] text-amber-300/80 mt-0.5 leading-normal">
                  O e-mail de redefinição pode ser filtrado e cair na sua pasta de <strong>Spam</strong> ou <strong>Lixo Eletrônico</strong>. Caso não o veja em alguns instantes na Entrada, verifique lá.
                </p>
              </div>
            </div>

            <form onSubmit={handleSendReset} className="mt-6 space-y-4">
              <Input
                type="email"
                label="E-mail cadastrado"
                required
                disabled={isResetting}
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="voce@libertycar.com.br"
                autoComplete="email"
                inputMode="email"
                leftIcon={<IconMail size={16} stroke={2} />}
              />

              {isResetting && <LoadingBar className="h-0.5" />}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  disabled={isResetting}
                  onClick={() => setShowResetModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={isResetting}
                  loadingLabel="Enviando..."
                >
                  Enviar E-mail
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

