'use client'

import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { lerTemaPortalNoNavegador, observarTemaPortal } from '@/utils/portal/preferencia-tema'
import styles from './entrar/entrada.module.css'

const bloco = 'rounded-lg bg-[var(--portal-selecao)] motion-safe:animate-pulse'
function Espaco({ largura }: { largura: string }) {
  return <div className={`${bloco} ${largura}`} />
}

function SkeletonFormulario({ campos }: { campos: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {Array.from({ length: campos }, (_, i) => (
        <div key={i} className="space-y-2">
          <Espaco largura="h-3 w-24 max-w-full" />
          <Espaco largura="h-11 w-full" />
        </div>
      ))}
    </div>
  )
}

function SkeletonConteudo({ pathname }: { pathname: string }) {
  const formulario = pathname.startsWith('/area-do-cliente/perfil') || pathname.startsWith('/area-do-cliente/anunciar')
  const listaVinculos = pathname === '/area-do-cliente/veiculos' || pathname === '/area-do-cliente/contratos-e-operacoes'
  const interno = pathname !== '/area-do-cliente'
  return (
    <div className={`mx-auto w-full space-y-6 px-5 py-9 sm:px-8 sm:py-14 ${formulario ? 'max-w-4xl' : interno ? 'max-w-5xl' : 'max-w-6xl'}`} aria-hidden="true">
      <div className="space-y-3">
        <Espaco largura="h-9 w-72 max-w-full" />
        <Espaco largura="h-4 w-96 max-w-full" />
      </div>

      {formulario ? (
        <div className="space-y-6 rounded-2xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5 sm:p-7">
          <SkeletonFormulario campos={pathname.includes('/anunciar') ? 8 : 6} />
          <Espaco largura="h-10 w-36 max-w-full" />
        </div>
      ) : listaVinculos ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((item) => (
            <div key={item} className="flex gap-4 rounded-2xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5">
              <Espaco largura="size-[22px] shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Espaco largura="h-4 w-40 max-w-full" />
                <Espaco largura="h-3 w-32 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <Espaco largura="h-5 w-44 max-w-full" />
          <div className={`grid gap-4 sm:grid-cols-2 ${interno ? '' : 'lg:grid-cols-3'}`}>
            {Array.from({ length: interno ? 2 : 3 }, (_, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5">
                {!interno && <Espaco largura="mb-4 size-11 rounded-xl" />}
                <Espaco largura="h-4 w-32 max-w-full" />
                <Espaco largura="h-3 w-full" />
                <Espaco largura="h-3 w-4/5" />
                <div className={interno ? '' : 'mt-5 border-t border-[var(--portal-divisor)] pt-3'}>
                  <Espaco largura="h-4 w-32 max-w-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Espaco largura="h-28 w-full rounded-xl" />
            <Espaco largura="h-28 w-full rounded-xl" />
          </div>
        </>
      )}
    </div>
  )
}

export function SkeletonPortal({ somenteConteudo = false }: { somenteConteudo?: boolean }) {
  const pathname = usePathname() ?? '/area-do-cliente'
  const tema = useSyncExternalStore(observarTemaPortal, lerTemaPortalNoNavegador, () => 'dark')
  const login = pathname.startsWith('/area-do-cliente/entrar')

  if (login) {
    return (
      <main className={`${styles.paleta} ${styles.shell}`} data-tema={tema} aria-busy="true" aria-label="Carregando acesso">
        <div className={styles.apresentacao} aria-hidden="true">
          <div className={styles.marca}><Espaco largura="h-12 w-24 opacity-65" /></div>
        </div>
        <section className={styles.acesso} aria-hidden="true">
          <div className={`${styles.conteudo} space-y-4`}>
            <Espaco largura="h-8 w-80 max-w-full" />
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--portal-divisor)] p-1">
              <Espaco largura="h-10 w-full" /><Espaco largura="h-10 w-full" />
            </div>
            <Espaco largura="h-4 w-4/5" />
            <Espaco largura="h-12 w-full" />
            <Espaco largura="h-px w-full" />
            <Espaco largura="h-3 w-14" /><Espaco largura="h-12 w-full" />
            <Espaco largura="h-3 w-14" /><Espaco largura="h-12 w-full" />
            <Espaco largura="h-4 w-32" /><Espaco largura="h-12 w-full" />
          </div>
        </section>
      </main>
    )
  }

  if (somenteConteudo) {
    return <div aria-busy="true" aria-label="Carregando Área do Cliente"><SkeletonConteudo pathname={pathname} /></div>
  }

  return (
    <div className={`${styles.paleta} ${styles.painel} min-h-dvh md:flex`} data-tema={tema} aria-busy="true" aria-label="Carregando Área do Cliente">
      <aside aria-hidden="true" className="hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--portal-divisor)] bg-[var(--portal-lateral)] md:flex">
        <div className="flex min-h-24 items-center border-b border-[var(--portal-divisor)] px-4"><Espaco largura="h-14 w-32" /></div>
        <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-3 py-4">
          {Array.from({ length: 8 }, (_, i) => <Espaco key={i} largura="h-10 w-full" />)}
        </div>
        <div className="space-y-2 border-t border-[var(--portal-divisor)] p-3">
          <Espaco largura="h-12 w-full" />
          <Espaco largura="h-10 w-full" />
          <Espaco largura="h-10 w-full" />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div aria-hidden="true" className="flex min-h-14 items-center gap-3 border-b border-[var(--portal-divisor)] bg-[var(--portal-lateral)] px-4 md:hidden">
          <Espaco largura="size-9" /><Espaco largura="h-4 w-28" />
        </div>
        <SkeletonConteudo pathname={pathname} />
      </div>
    </div>
  )
}
