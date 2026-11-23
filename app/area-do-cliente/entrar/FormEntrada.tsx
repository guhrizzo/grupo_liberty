'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { getApps, initializeApp } from 'firebase/app'
import { useRouter } from 'next/navigation'
import {
  browserPopupRedirectResolver,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  inMemoryPersistence,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { IconArrowRight, IconEye, IconEyeOff, IconLock, IconMail } from '@tabler/icons-react'
import GoogleIcon from '@/app/components/GoogleIcon'
import { app } from '@/utils/firebase/client'
import { entrarPortal, solicitarRedefinicaoPortal } from '../actions'
import styles from './entrada.module.css'

const appPortal = 'liberty-portal'

function authPortal() {
  const existente = getApps().find(({ name }) => name === appPortal)
  if (existente) return getAuth(existente)
  const auth = initializeAuth(initializeApp(app.options, appPortal), {
    persistence: inMemoryPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  })
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_LIBERTY_PORTAL_EMULATOR === '1') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099')
  }
  return auth
}

type Modo = 'entrar' | 'cadastro'

function mensagemFirebase(erro: unknown) {
  const codigo = (erro as { code?: string } | null)?.code
  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.'
    case 'auth/email-already-in-use':
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta com esse e-mail. Entre pelo método que você usou no cadastro.'
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'A senha não atende aos requisitos de segurança. Escolha uma senha mais forte.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'O login com Google foi cancelado.'
    case 'auth/popup-blocked':
      return 'Permita que o navegador abra a janela do Google e tente novamente.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
    default:
      return 'Não foi possível concluir o acesso. Tente novamente.'
  }
}

export default function FormEntrada() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>('entrar')
  const [recuperando, setRecuperando] = useState(false)
  const [email, setEmail] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null)
  const [pendente, iniciar] = useTransition()
  const cadastro = modo === 'cadastro'

  function trocarModo(novoModo: Modo) {
    if (modo === novoModo) return
    setModo(novoModo)
    setMostrarSenha(false)
    setMensagem(null)
  }

  function autenticar(dados?: FormData) {
    setMensagem(null)
    iniciar(async () => {
      const auth = authPortal()

      try {
        const email = String(dados?.get('email') ?? '').trim()
        const senha = String(dados?.get('senha') ?? '')
        if (dados && cadastro && senha !== dados.get('confirmacao')) {
          setMensagem({ erro: true, texto: 'As senhas precisam ser iguais.' })
          return
        }

        const credencial = dados
          ? cadastro
            ? await createUserWithEmailAndPassword(auth, email, senha)
            : await signInWithEmailAndPassword(auth, email, senha)
          : await signInWithPopup(auth, new GoogleAuthProvider())

        if (!credencial.user.emailVerified) {
          if (cadastro || dados?.get('reenviar') === '1') {
            await sendEmailVerification(credencial.user)
            trocarModo('entrar')
            setMensagem({ erro: false, texto: 'Enviamos um link de confirmação. Confirme seu e-mail e volte para entrar.' })
          } else {
            setMensagem({ erro: true, texto: 'Confirme seu e-mail antes de entrar ou solicite um novo link abaixo.' })
          }
          return
        }

        const resultado = await entrarPortal(await credencial.user.getIdToken())
        if (resultado.erro) {
          setMensagem({ erro: true, texto: resultado.erro })
          return
        }
        router.replace('/area-do-cliente')
      } catch (erro) {
        setMensagem({ erro: true, texto: mensagemFirebase(erro) })
      } finally {
        await signOut(auth).catch(() => {})
      }
    })
  }

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    autenticar(new FormData(event.currentTarget, submitter))
  }

  function enviarRedefinicao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMensagem(null)
    iniciar(async () => {
      const resultado = await solicitarRedefinicaoPortal(email)
      if (resultado.erro) {
        setMensagem({ erro: true, texto: resultado.erro })
        return
      }
      setMensagem({ erro: false, texto: 'Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Confira também a pasta de spam.' })
    })
  }

  if (recuperando) {
    return (
      <>
        <p className={styles.instrucao}>Informe o e-mail da sua conta para solicitar a redefinição da senha.</p>
        <form method="post" onSubmit={enviarRedefinicao} className={`${styles.formulario} ${styles.formularioRecuperacao}`}>
          <label className={styles.rotulo}>
            E-mail
            <input type="email" name="email" required autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" className={styles.campo} />
          </label>
          {mensagem && <p role={mensagem.erro ? 'alert' : 'status'} className={mensagem.erro ? styles.erro : styles.instrucao}>{mensagem.texto}</p>}
          <button type="submit" className={styles.botao} disabled={pendente}>
            {pendente ? 'Enviando…' : 'Enviar link de redefinição'}
            <IconArrowRight aria-hidden size={19} />
          </button>
          <button type="button" className={styles.reenviar} disabled={pendente} onClick={() => {
            setRecuperando(false)
            setMensagem(null)
          }}>Voltar para entrar</button>
        </form>
      </>
    )
  }

  return (
    <>
      <div className={styles.abas} role="group" aria-label="Opções de acesso">
        <button type="button" disabled={pendente} aria-pressed={!cadastro} onClick={() => trocarModo('entrar')}>Entrar</button>
        <button type="button" disabled={pendente} aria-pressed={cadastro} onClick={() => trocarModo('cadastro')}>Cadastro</button>
      </div>
      <p className={styles.instrucao}>
        {cadastro ? 'Use o mesmo e-mail informado à Liberty para vincular seu cadastro.' : 'Entre com seu e-mail e senha ou com sua conta Google.'}
      </p>
      <button className={styles.google} type="button" disabled={pendente} onClick={() => autenticar()}>
        <GoogleIcon size={19} />
        {cadastro ? 'Cadastrar com Google' : 'Entrar com Google'}
      </button>
      <div className={styles.divisor}>ou</div>
      <form key={modo} method="post" onSubmit={enviar} className={styles.formulario}>
        <label className={styles.rotulo}>
          E-mail
          <span className={styles.campoEmail}>
            <IconMail aria-hidden size={20} stroke={1.7} />
            <input name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} placeholder="voce@exemplo.com" className={styles.campo} />
          </span>
        </label>
        <label className={styles.rotulo} htmlFor="senha-portal">Senha</label>
        <div className={`${styles.campoEmail} ${styles.campoSenha}`}>
          <IconLock aria-hidden size={20} stroke={1.7} />
          <input id="senha-portal" name="senha" type={mostrarSenha ? 'text' : 'password'} required minLength={cadastro ? 6 : undefined} autoComplete={cadastro ? 'new-password' : 'current-password'} placeholder={cadastro ? 'Crie uma senha' : 'Digite sua senha'} className={styles.campo} />
          <button type="button" className={styles.mostrarSenha} onClick={() => setMostrarSenha(!mostrarSenha)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
            {mostrarSenha ? <IconEyeOff aria-hidden size={19} /> : <IconEye aria-hidden size={19} />}
          </button>
        </div>
        {!cadastro && (
          <button type="button" className={styles.reenviar} disabled={pendente} onClick={() => {
            setRecuperando(true)
            setMostrarSenha(false)
            setMensagem(null)
          }}>Esqueci minha senha</button>
        )}
        {cadastro && (
          <label className={styles.rotulo}>
            Confirmar senha
            <input name="confirmacao" type="password" required minLength={6} autoComplete="new-password" placeholder="Digite a senha novamente" className={styles.campo} />
          </label>
        )}
        {mensagem && <p role={mensagem.erro ? 'alert' : 'status'} className={mensagem.erro ? styles.erro : styles.instrucao}>{mensagem.texto}</p>}
        <button type="submit" disabled={pendente} className={styles.botao}>
          {pendente ? 'Aguarde…' : cadastro ? 'Criar conta' : 'Entrar'}
          {cadastro && <IconArrowRight aria-hidden size={19} />}
        </button>
        {!cadastro && mensagem?.erro && mensagem.texto.startsWith('Confirme seu e-mail') && (
          <button className={styles.reenviar} type="submit" name="reenviar" value="1" disabled={pendente}>Reenviar link de confirmação</button>
        )}
      </form>
    </>
  )
}
