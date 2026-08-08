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
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  linkWithCredential,
  type AuthCredential,
  type AuthError,
} from 'firebase/auth'
import { auth } from '@/utils/firebase/client'
import LoadingBar from '../components/LoadingBar'
import { Button, Input, useToast, ZoomIn } from '../components/ui'
import { login, loginWithGoogle, requestPasswordReset } from './actions'

const initialState: { error?: string } = {}

/** Conta com o mesmo e-mail já existe, mas com senha — precisamos da senha
 *  atual para vincular o Google a essa mesma conta (nunca criamos uma nova). */
interface LinkPrompt {
  email: string
  credential: AuthCredential
}

/** Logo oficial colorido do Google ("G" multicolor), embutido como SVG puro
 *  para o botão de login — mais reconhecível que a versão mono do Tabler. */
function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  )
}

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
  const [isGoogleLoading, startGoogleTransition] = useTransition()
  const [linkPrompt, setLinkPrompt] = useState<LinkPrompt | null>(null)
  const [linkPassword, setLinkPassword] = useState('')
  const [showLinkPassword, setShowLinkPassword] = useState(false)
  const [isLinking, startLinkTransition] = useTransition()
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

  // ─── Login com Google ───────────────────────────────────────────────────
  // Importante: a chamada a `loginWithGoogle` (que redireciona no sucesso)
  // fica FORA do try/catch — se ficasse dentro, o redirect() do Next.js
  // (que funciona lançando uma exceção especial) seria capturado aqui como
  // se fosse um erro comum e o redirecionamento nunca aconteceria.

  function handleGoogleLogin() {
    startGoogleTransition(async () => {
      let idToken: string
      try {
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })
        const result = await signInWithPopup(auth, provider)
        idToken = await result.user.getIdToken()
      } catch (err) {
        handleGoogleAuthError(err)
        return
      }

      const res = await loginWithGoogle(idToken)
      if (res?.error) toast.error(res.error, 'Falha no login')
    })
  }

  function handleGoogleAuthError(err: unknown) {
    const fbErr = err as AuthError
    if (fbErr?.code === 'auth/popup-closed-by-user' || fbErr?.code === 'auth/cancelled-popup-request') {
      return // usuário fechou o popup — sem toast de erro
    }
    if (fbErr?.code === 'auth/account-exists-with-different-credential') {
      // Já existe uma conta com esse e-mail cadastrada com senha (o único
      // outro método de login deste app). Em vez de criar um usuário novo,
      // pedimos a senha atual para vincular o Google à MESMA conta.
      const credential = GoogleAuthProvider.credentialFromError(fbErr)
      const linkEmail = (fbErr.customData as { email?: string } | undefined)?.email
      if (credential && linkEmail) {
        setLinkPassword('')
        setLinkPrompt({ email: linkEmail, credential })
        return
      }
    }
    console.error('Erro no login com Google:', err)
    toast.error('Não foi possível entrar com o Google. Tente novamente.', 'Erro')
  }

  function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!linkPrompt) return
    const { email: linkEmail, credential } = linkPrompt

    startLinkTransition(async () => {
      let idToken: string
      try {
        const userCred = await signInWithEmailAndPassword(auth, linkEmail, linkPassword)
        await linkWithCredential(userCred.user, credential)
        idToken = await userCred.user.getIdToken()
      } catch (err) {
        const fbErr = err as AuthError
        const msg =
          fbErr?.code === 'auth/wrong-password' || fbErr?.code === 'auth/invalid-credential'
            ? 'Senha incorreta.'
            : 'Não foi possível vincular a conta. Tente novamente.'
        toast.error(msg, 'Erro ao vincular')
        return
      }

      setLinkPrompt(null)
      setLinkPassword('')
      const res = await loginWithGoogle(idToken)
      if (res?.error) toast.error(res.error, 'Falha no login')
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

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-800" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-lo">ou</span>
          <div className="h-px flex-1 bg-neutral-800" />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          loading={isGoogleLoading}
          loadingLabel="Conectando..."
          disabled={isPending}
          onClick={handleGoogleLogin}
          leftIcon={<GoogleIcon size={16} />}
        >
          Continuar com Google
        </Button>
      </form>

      {/* Modal de Vinculação de Conta Google — quando o e-mail já existe com senha */}
      {linkPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <ZoomIn className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => {
                if (!isLinking) setLinkPrompt(null)
              }}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg transition-ui-fast cursor-pointer"
              aria-label="Fechar"
            >
              <IconX size={18} />
            </button>

            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-liberty/10 border border-liberty/20 text-liberty-deep mx-auto mb-4">
              <GoogleIcon size={22} />
            </div>

            <h2 className="text-xl font-bold text-white text-center">Vincular Conta Google</h2>
            <p className="text-xs text-neutral-400 text-center mt-2 leading-relaxed">
              Já existe uma conta com o e-mail <strong className="text-neutral-200">{linkPrompt.email}</strong>{' '}
              cadastrada com senha. Confirme sua senha atual para vincular o Google a essa mesma
              conta — nenhum cadastro novo será criado.
            </p>

            <form onSubmit={handleLinkSubmit} className="mt-6 space-y-4">
              <Input
                type={showLinkPassword ? 'text' : 'password'}
                label="Senha atual"
                required
                disabled={isLinking}
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                autoFocus
                leftIcon={<IconLock size={16} stroke={2} />}
                rightAdornment={
                  <button
                    type="button"
                    onClick={() => setShowLinkPassword((v) => !v)}
                    aria-label={showLinkPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="flex items-center px-2 text-text-lo hover:text-neon-soft cursor-pointer"
                  >
                    {showLinkPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                }
              />

              {isLinking && <LoadingBar className="h-0.5" />}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  disabled={isLinking}
                  onClick={() => setLinkPrompt(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" fullWidth loading={isLinking} loadingLabel="Vinculando...">
                  Vincular e Entrar
                </Button>
              </div>
            </form>
          </ZoomIn>
        </div>
      )}

      {/* Modal de Recuperação de Senha */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <ZoomIn className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg transition-ui-fast cursor-pointer"
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
          </ZoomIn>
        </div>
      )}
    </>
  )
}

