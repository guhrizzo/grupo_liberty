'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { usePathname } from 'next/navigation'

type DashboardTheme = 'light' | 'dark'

/** Ponto de origem do reveal. A assinatura aceita um MouseEvent do React
 *  direto, então o botão pode continuar usando `onClick={toggleTheme}`. */
type ToggleOrigin = {
  clientX?: number
  clientY?: number
  currentTarget?: EventTarget | null
}

/** Duração do reveal. Espelha o fallback em `.theme-switching` (globals.css). */
const SWITCH_MS = 420

const STORAGE_KEY = 'dashboard-theme'

const DashboardThemeContext = createContext<{
  theme: DashboardTheme
  toggleTheme: (origin?: ToggleOrigin) => void
}>({
  theme: 'light',
  toggleTheme: () => {},
})

/** Hook para ler/alternar o tema do dashboard (usado pelo botão na sidebar). */
export function useDashboardTheme() {
  return useContext(DashboardThemeContext)
}

/** `startViewTransition` ainda não está em todas as libs de tipos do TS. */
type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void) => {
    ready: Promise<void>
    finished: Promise<void>
  }
}

/**
 * Descobre de onde o círculo deve crescer: o ponto do clique. Em ativação
 * por teclado (Enter/Espaço) o browser manda clientX/clientY zerados — aí
 * caímos no centro do próprio botão, senão o reveal sairia do canto.
 */
function originFrom(e?: ToggleOrigin): { x: number; y: number } {
  const { clientX = 0, clientY = 0 } = e ?? {}
  if (clientX !== 0 || clientY !== 0) return { x: clientX, y: clientY }

  const target = e?.currentTarget
  if (target instanceof Element) {
    const r = target.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

/**
 * Fica montado na raiz do app (não só no /dashboard) porque alguns
 * componentes compartilhados — como os toasts — renderizam fora da árvore
 * do layout do dashboard (via portal, direto no <body>). Para que eles
 * também respeitem o tema escuro, a classe `.adobe-dark` (paleta estilo
 * Adobe Photoshop/Premiere/After Effects, definida em globals.css) é
 * aplicada direto no `<body>` — só quando a preferência salva é "dark" *e*
 * a rota atual é do dashboard (`/dashboard/**`), pra não vazar pro site
 * público. Não renderiza um wrapper próprio (evitaria mexer no layout
 * flex do `<body>`); a classe é ligada/desligada via `classList` mesmo.
 */
export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [theme, setTheme] = useState<DashboardTheme>('light')

  // Lê a preferência salva assim que monta no cliente.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'dark' || stored === 'light') setTheme(stored)
    } catch {
      // localStorage indisponível (modo privado etc.) — mantém o padrão claro.
    }
  }, [])

  const isDashboardRoute = (pathname ?? '').startsWith('/dashboard')
  const active = theme === 'dark' && isDashboardRoute

  useEffect(() => {
    document.body.classList.toggle('adobe-dark', active)
    return () => {
      document.body.classList.remove('adobe-dark')
    }
  }, [active])

  const fadeTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current)
    },
    [],
  )

  /** Aplica o tema. A classe entra no mesmo tick porque a View Transition
   *  precisa do DOM já no estado novo para tirar o segundo snapshot.
   *
   *  A ordem aqui importa: a classe no <body> é o que realmente pinta a
   *  tela, então ela vem antes de qualquer coisa que possa falhar. O
   *  `flushSync` é só para o React commitar dentro da janela do snapshot —
   *  ele lança se chamado de um contexto proibido, e nesse caso o commit
   *  normal resolve igual. */
  function applyTheme(next: DashboardTheme) {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignora falha ao salvar — o tema ainda funciona nesta sessão
    }
    document.body.classList.toggle('adobe-dark', next === 'dark' && isDashboardRoute)
    try {
      flushSync(() => setTheme(next))
    } catch {
      setTheme(next)
    }
  }

  /** Sem View Transitions: transição de cor global, ligada só durante a troca. */
  function fadeColors() {
    const root = document.documentElement
    root.classList.add('theme-switching')
    if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current)
    fadeTimer.current = window.setTimeout(() => {
      root.classList.remove('theme-switching')
      fadeTimer.current = null
    }, SWITCH_MS)
  }

  function toggleTheme(origin?: ToggleOrigin) {
    // `toggleTheme` é recriada a cada render e o context value também, então
    // o botão sempre chama a versão que enxerga o `theme` atual.
    const next: DashboardTheme = theme === 'dark' ? 'light' : 'dark'

    const doc = document as ViewTransitionDocument
    const root = document.documentElement
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Sem View Transitions: transição de cor elemento a elemento.
    if (typeof doc.startViewTransition !== 'function') {
      fadeColors()
      applyTheme(next)
      return
    }

    // `reduce` pede ausência de movimento, não ausência de transição: o
    // cross-fade nativo (só opacidade) mascara a troca sem varrer a tela.
    const mode = reducedMotion ? 'theme-fade' : 'theme-sweep'
    root.classList.add(mode)

    const { x, y } = originFrom(origin)
    // Raio até o canto mais distante, para o círculo cobrir a tela inteira.
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    // A troca de tema não pode depender da transição dar certo. O navegador
    // pula a transição inteira quando a aba não está sendo renderizada (janela
    // em segundo plano, por exemplo), e nesse caso o callback pode nunca rodar
    // — o toggle ficaria morto. Este guard garante que o tema é aplicado
    // exatamente uma vez, pelo callback ou pela limpeza no fim.
    let aplicado = false
    const aplicarUmaVez = () => {
      if (aplicado) return
      aplicado = true
      applyTheme(next)
    }

    const transition = doc.startViewTransition(aplicarUmaVez)

    if (!reducedMotion) {
      transition.ready
        .then(() => {
          root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${radius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: SWITCH_MS,
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
              pseudoElement: '::view-transition-new(root)',
            },
          )
        })
        .catch(() => {
          // Transição abortada (ex.: troca durante outra) — o tema já mudou.
        })
    }

    // Roda sempre — inclusive quando a transição é pulada. Garante o tema
    // aplicado e tira a classe de modo, senão a próxima troca herdaria o modo
    // errado.
    transition.finished
      .catch(() => {})
      .then(() => {
        aplicarUmaVez()
        root.classList.remove(mode)
      })
  }

  return (
    <DashboardThemeContext.Provider value={{ theme, toggleTheme }}>
      {/* Evita flash de tela clara pra quem já escolheu o tema escuro:
          aplica a classe no <body> antes da hidratação, lendo localStorage
          direto no HTML inicial. Só entra em rotas /dashboard. */}
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('${STORAGE_KEY}')==='dark'&&location.pathname.indexOf('/dashboard')===0){document.body.classList.add('adobe-dark')}}catch(e){}`,
        }}
      />
      {children}
    </DashboardThemeContext.Provider>
  )
}
