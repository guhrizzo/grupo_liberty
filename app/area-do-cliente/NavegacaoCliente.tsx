'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconArrowDown, IconArrowUp, IconArrowsSort, IconBuildingBank, IconCar, IconChevronLeft, IconChevronRight, IconFileDescription,
  IconHome, IconLifebuoy, IconLogout, IconMenu2, IconMoon, IconReceipt, IconSpeakerphone, IconSun, IconUser, IconWorld, IconX,
} from '@tabler/icons-react'
import logoEscuro from '@/app/public/logo-liberty-car-white.png'
import logoClaro from '@/app/public/logo-liberty-car-blue.png'
import PaletaComandos from '@/app/components/PaletaComandos'
import { atalhosPortal, modulosPortal, type ModuloPortal } from '@/utils/portal/modelo'
import { lerTemaPortalNoNavegador, observarTemaPortal, salvarTemaPortal, type TemaPortal } from '@/utils/portal/preferencia-tema'
import { sairPortal, salvarOrdemMenuPortal } from './actions'
import styles from './entrar/entrada.module.css'

const iconesAtalho = { 'inicio-portal': IconHome, 'veiculos-portal': IconCar, 'registros-portal': IconFileDescription, 'anunciar-portal': IconSpeakerphone, 'perfil-portal': IconUser }
const iconesModulo = { quitacao: IconReceipt, posVenda: IconLifebuoy, investimentos: IconBuildingBank }
const rotasAtalho: Partial<Record<string, string>> = {
  'veiculos-portal': '/area-do-cliente/veiculos',
  'registros-portal': '/area-do-cliente/contratos-e-operacoes',
  'anunciar-portal': '/area-do-cliente/anunciar',
  'perfil-portal': '/area-do-cliente/perfil',
  'modulo-quitacao': '/area-do-cliente/quitacao',
  'modulo-posVenda': '/area-do-cliente/pos-venda',
  'modulo-investimentos': '/area-do-cliente/investimentos',
}
const acao = 'flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-[var(--portal-selecao)] focus-visible:outline-2 focus-visible:outline-[var(--portal-foco)]'
const hrefAtalho = (id: string) => rotasAtalho[id] ?? `/area-do-cliente#${id}`

export default function NavegacaoCliente({ children, nome, email, foto, ordemInicial, temaInicial, modulos }: {
  children: ReactNode
  nome: string
  email: string
  foto: string | null
  ordemInicial: string[]
  temaInicial: TemaPortal
  modulos: ModuloPortal[]
}) {
  const pathname = usePathname()
  const tema = useSyncExternalStore(observarTemaPortal, lerTemaPortalNoNavegador, () => temaInicial)
  const [recolhido, setRecolhido] = useState(false)
  const [secao, setSecao] = useState('inicio-portal')
  const menu = useRef<HTMLDialogElement>(null)
  const escuro = tema === 'dark'
  const logo = escuro ? logoEscuro : logoClaro
  const [fotoFalhou, setFotoFalhou] = useState(false)
  const [ordem, setOrdem] = useState(ordemInicial)
  const [rascunho, setRascunho] = useState<string[]>([])
  const [erroOrdem, setErroOrdem] = useState('')
  const [salvando, iniciarSalvamento] = useTransition()
  const organizador = useRef<HTMLDialogElement>(null)
  const atalhos = atalhosPortal.map(({ id, nome }) => ({ id: String(id), nome, Icone: iconesAtalho[id], grupo: 'atalhos' }))
  const modulosVisiveis = modulosPortal.filter(({ id }) => modulos.includes(id)).map(({ id, nome }) => ({
    id: `modulo-${id}`, nome, Icone: iconesModulo[id], grupo: 'modulos',
  }))
  const padrao = [...atalhos, ...modulosVisiveis]
  const porId = new Map(padrao.map((item) => [item.id, item]))
  const itensOrdenados = [...new Set([...ordem, ...porId.keys()])].flatMap((id) => {
    const item = porId.get(id)
    return item ? [item] : []
  })
  const itensRascunho = rascunho.flatMap((id) => {
    const item = porId.get(id)
    return item ? [item] : []
  })
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join('') || 'C'

  function abrirOrganizador() {
    menu.current?.close()
    setErroOrdem('')
    setRascunho(['atalhos', 'modulos'].flatMap((grupo) => itensOrdenados.filter((item) => item.grupo === grupo).map(({ id }) => id)))
    organizador.current?.showModal()
  }

  function moverItem(id: string, delta: number) {
    setRascunho((atual) => {
      const i = atual.indexOf(id)
      const destino = i + delta
      if (i < 0 || destino < 0 || destino >= atual.length || porId.get(id)?.grupo !== porId.get(atual[destino])?.grupo) return atual
      const nova = [...atual]
      nova[i] = atual[destino]
      nova[destino] = atual[i]
      return nova
    })
  }

  function salvarOrdem() {
    setErroOrdem('')
    iniciarSalvamento(async () => {
      const resultado = await salvarOrdemMenuPortal(rascunho)
      if (resultado.erro) {
        setErroOrdem(resultado.erro)
        return
      }
      setOrdem(rascunho)
      organizador.current?.close()
    })
  }

  useEffect(() => {
    function atualizar() {
      setSecao(window.location.hash.slice(1) || 'inicio-portal')
    }
    atualizar()
    const desktop = window.matchMedia('(min-width: 768px)')
    const fecharNoDesktop = () => {
      if (desktop.matches) menu.current?.close()
    }
    function liberarPaleta(evento: KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        menu.current?.close()
        if (!organizador.current?.open) return
        if (organizador.current.getAttribute('aria-busy') === 'true') {
          evento.preventDefault()
          evento.stopImmediatePropagation()
        } else organizador.current.close()
      }
    }
    window.addEventListener('hashchange', atualizar)
    window.addEventListener('keydown', liberarPaleta, true)
    desktop.addEventListener('change', fecharNoDesktop)
    return () => {
      window.removeEventListener('hashchange', atualizar)
      window.removeEventListener('keydown', liberarPaleta, true)
      desktop.removeEventListener('change', fecharNoDesktop)
    }
  }, [])

  function alternarTema() {
    salvarTemaPortal(escuro ? 'light' : 'dark')
  }

  function linkSecao(id: string, rotulo: string, Icone: typeof IconHome, compacto: boolean) {
    const rota = rotasAtalho[id]
    const ativo = rota ? pathname === rota || pathname?.startsWith(`${rota}/`) : pathname === '/area-do-cliente' && id === secao
    const href = hrefAtalho(id)
    return (
      <li key={id}>
        <Link href={href} onClick={() => { if (!rota) setSecao(id); menu.current?.close() }} aria-current={ativo ? (rota ? 'page' : 'location') : undefined}
          title={compacto ? rotulo : undefined}
          className={`${acao} ${compacto ? 'justify-center' : ''} ${ativo ? 'bg-[var(--portal-selecao)] text-[var(--portal-link)]' : ''}`}>
          <Icone aria-hidden size={19} className="shrink-0" />
          <span className={compacto ? 'sr-only' : 'min-w-0'}>{rotulo}</span>
        </Link>
      </li>
    )
  }

  function conteudoMenu(mobile: boolean) {
    const compacto = recolhido && !mobile
    const Expandir = compacto ? IconChevronRight : IconChevronLeft
    return (
      <>
        <div className={`flex min-h-24 items-center gap-2 border-b border-[var(--portal-divisor)] px-3 ${compacto ? 'justify-center' : 'justify-between'}`}>
          {!compacto && (
            <Link href="/" className="flex min-w-0 flex-col gap-1.5 px-1">
              <Image src={logo} alt="Liberty Car" className="h-auto w-[116px]" />
              <span className="text-[10px] font-semibold uppercase tracking-[.22em] text-[var(--portal-secundario)]">Área do Cliente</span>
            </Link>
          )}
          {mobile ? (
            <button type="button" className={`${acao} !w-auto shrink-0`} aria-label="Fechar menu" onClick={() => menu.current?.close()}>
              <IconX aria-hidden size={19} />
            </button>
          ) : (
            <button type="button" className={`${acao} !w-auto shrink-0`} aria-label={compacto ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!compacto} onClick={() => setRecolhido(!recolhido)}>
              <Expandir aria-hidden size={19} />
            </button>
          )}
        </div>

        <nav aria-label="Navegação da Área do Cliente" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <Link href="/" onClick={() => menu.current?.close()} title={compacto ? 'Ver site' : undefined} className={`${acao} ${compacto ? 'justify-center' : ''}`}>
            <IconWorld aria-hidden size={19} className="shrink-0" />
            <span className={compacto ? 'sr-only' : ''}>Ver site</span>
          </Link>
          <ul className="mt-2 space-y-1 border-t border-[var(--portal-divisor)] pt-2">
            {itensOrdenados.filter(({ grupo }) => grupo === 'atalhos').map(({ id, nome: rotulo, Icone }) => linkSecao(id, rotulo, Icone, compacto))}
          </ul>
          {modulos.length > 0 && (
            <div className="mt-5 border-t border-[var(--portal-divisor)] pt-3">
              <p className={compacto ? 'sr-only' : 'px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--portal-secundario)]'}>Seus módulos</p>
              <ul className="space-y-1">
                {itensOrdenados.filter(({ grupo }) => grupo === 'modulos').map(({ id, nome: rotulo, Icone }) => linkSecao(id, rotulo, Icone, compacto))}
              </ul>
            </div>
          )}
        </nav>

        <div className="space-y-2 border-t border-[var(--portal-divisor)] p-3">
          <div className={`flex min-w-0 items-center gap-3 px-1 pb-2 ${compacto ? 'justify-center' : ''}`}>
            <span aria-hidden className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[var(--portal-selecao)] text-sm font-bold text-[var(--portal-link)]">
              {foto && !fotoFalhou ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" referrerPolicy="no-referrer" onError={() => setFotoFalhou(true)} className="size-full rounded-full object-cover" />
              ) : iniciais}
              <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-[var(--portal-lateral)] bg-[var(--portal-acao)]" />
            </span>
            <div className={compacto ? 'sr-only' : 'min-w-0'}>
              <p className="truncate text-sm font-semibold" title={nome}>{nome}</p>
              <p className="truncate text-xs text-[var(--portal-secundario)]" title={email}>{email}</p>
              <span className="mt-1 inline-block rounded-full border border-[var(--portal-link)] px-2 py-0.5 text-[10px] leading-none font-bold tracking-wider text-[var(--portal-link)] uppercase">Cliente</span>
            </div>
          </div>
          <button type="button" onClick={abrirOrganizador} title="Organizar menu" className={`${acao} justify-center border border-[var(--portal-divisor)]`}>
            <IconArrowsSort aria-hidden size={17} />
            <span className={compacto ? 'sr-only' : ''}>Organizar menu</span>
          </button>
          <button type="button" onClick={alternarTema} title={escuro ? 'Tema claro' : 'Tema escuro'} className={`${acao} justify-center border border-[var(--portal-divisor)]`}>
            {escuro ? <IconSun aria-hidden size={17} /> : <IconMoon aria-hidden size={17} />}
            <span className={compacto ? 'sr-only' : ''}>{escuro ? 'Tema claro' : 'Tema escuro'}</span>
          </button>
          <form action={sairPortal}>
            <button type="submit" title="Sair da conta" className={`${acao} justify-center border border-[var(--portal-divisor)]`}>
              <IconLogout aria-hidden size={17} />
              <span className={compacto ? 'sr-only' : ''}>Sair da conta</span>
            </button>
          </form>
        </div>
      </>
    )
  }

  const lateral = 'flex flex-col bg-[var(--portal-lateral)] text-[var(--portal-texto)]'

  return (
    <div className={`${styles.paleta} ${styles.painel} min-h-dvh md:flex`} data-tema={tema}>
      <PaletaComandos
        itens={itensOrdenados.map(({ id, nome, Icone }) => ({ href: hrefAtalho(id), label: nome, icone: <Icone size={18} aria-hidden /> }))}
        chaveRecentes="liberty_cliente_paleta_recentes"
        rotulo="Buscar na Área do Cliente"
        mostrarAtalhos
        escuro={escuro}
      />
      <aside aria-label="Menu lateral" className={`${lateral} sticky top-0 hidden h-dvh shrink-0 border-r border-[var(--portal-divisor)] md:flex ${recolhido ? 'w-[70px]' : 'w-64'}`}>
        {conteudoMenu(false)}
      </aside>
      <dialog id="menu-cliente" ref={menu} aria-label="Menu da Área do Cliente"
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) evento.currentTarget.close()
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-64 max-w-[85vw] border-r border-[var(--portal-divisor)] bg-[var(--portal-lateral)] text-[var(--portal-texto)] backdrop:bg-black/55 md:hidden">
        <div className={`${lateral} h-full`}>{conteudoMenu(true)}</div>
      </dialog>
      <dialog ref={organizador} aria-labelledby="titulo-organizar-cliente" aria-busy={salvando} onCancel={(evento) => { if (salvando) evento.preventDefault() }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-xl border border-[var(--portal-divisor)] bg-[var(--portal-lateral)] p-5 text-[var(--portal-texto)] shadow-lg backdrop:bg-black/55">
        <h2 id="titulo-organizar-cliente" className="text-lg font-semibold">Organizar menu</h2>
        <p className="mt-1 text-sm text-[var(--portal-secundario)]">Use as setas para mudar a ordem dos itens dentro de cada grupo.</p>
        <ol className="my-4 space-y-2">
          {itensRascunho.map(({ id, nome: rotulo, grupo, Icone }, i) => (
            <li key={id} className="flex items-center gap-2 rounded-lg border border-[var(--portal-divisor)] px-2 py-1">
              <Icone aria-hidden size={17} className="shrink-0" />
              <span className="min-w-0 flex-1 text-sm">{rotulo}</span>
              <button type="button" aria-label={`Subir ${rotulo}`} disabled={salvando || itensRascunho[i - 1]?.grupo !== grupo}
                onClick={() => moverItem(id, -1)} className="grid size-9 cursor-pointer place-items-center rounded-lg hover:bg-[var(--portal-selecao)] disabled:opacity-35">
                <IconArrowUp aria-hidden size={16} />
              </button>
              <button type="button" aria-label={`Descer ${rotulo}`} disabled={salvando || itensRascunho[i + 1]?.grupo !== grupo}
                onClick={() => moverItem(id, 1)} className="grid size-9 cursor-pointer place-items-center rounded-lg hover:bg-[var(--portal-selecao)] disabled:opacity-35">
                <IconArrowDown aria-hidden size={16} />
              </button>
            </li>
          ))}
        </ol>
        {erroOrdem && <p role="alert" className="mb-3 text-sm text-[var(--portal-erro)]">{erroOrdem}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={salvando} onClick={() => setRascunho(padrao.map(({ id }) => id))} className="mr-auto cursor-pointer rounded-lg px-2 py-2 text-sm text-[var(--portal-link)]">Restaurar padrão</button>
          <button type="button" disabled={salvando} onClick={() => organizador.current?.close()} className="cursor-pointer rounded-lg border border-[var(--portal-divisor)] px-3 py-2 text-sm">Cancelar</button>
          <button type="button" disabled={salvando} onClick={salvarOrdem} className="cursor-pointer rounded-lg bg-[var(--portal-acao)] px-3 py-2 text-sm font-semibold text-[var(--portal-acao-texto)]">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </dialog>
      <div className={`min-w-0 flex-1 ${escuro ? 'adobe-dark' : ''}`} data-tema={tema}>
        <header className="sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b border-[var(--portal-divisor)] bg-[var(--portal-lateral)] px-4 md:hidden">
          <button type="button" aria-label="Abrir menu" aria-haspopup="dialog" aria-controls="menu-cliente" className={`${acao} !w-auto`} onClick={() => menu.current?.showModal()}>
            <IconMenu2 aria-hidden size={20} />
          </button>
          <span className="text-sm font-semibold">Área do Cliente</span>
        </header>
        {children}
      </div>
    </div>
  )
}
