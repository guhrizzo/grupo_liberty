import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconArrowRight } from '@tabler/icons-react'
import { formatDate } from '@/utils/format'
import { formatarCentavosInvestimento } from '@/utils/investimentos/modelo'
import { carregarInvestimentosCliente } from '@/utils/investimentos/repositorio'

const card = 'rounded-xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5'

export default async function InvestimentosClientePage() {
  const dados = await carregarInvestimentosCliente()
  if (!dados) notFound()
  const ativas = dados.posicoes.filter(({ situacao }) => situacao === 'ativa')
  const saldo = ativas.reduce((total, posicao) => total + BigInt(posicao.totais.saldo), BigInt(0))

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-9 sm:px-8 sm:py-14">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Investimentos Liberty</h1>
        <p className="mt-2 text-[var(--portal-secundario)]">Consulte as opções disponíveis e acompanhe os valores registrados nas suas posições.</p>
      </header>
      <section className="space-y-3" aria-labelledby="meus-investimentos">
        <h2 id="meus-investimentos" className="text-xl font-semibold">Meus investimentos</h2>
        {dados.posicoes.length > 0 ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className={card}>
                <dt className="text-sm text-[var(--portal-secundario)]">Saldo registrado nas posições ativas</dt>
                <dd className="mt-1 text-2xl font-bold">{formatarCentavosInvestimento(saldo)}</dd>
              </div>
              <div className={card}>
                <dt className="text-sm text-[var(--portal-secundario)]">Posições ativas</dt>
                <dd className="mt-1 text-2xl font-bold">{ativas.length}</dd>
              </div>
            </dl>
            <ul className="space-y-2">
              {dados.posicoes.map((posicao) => (
                <li key={posicao.id}>
                  <Link href={`/area-do-cliente/investimentos/${posicao.id}`} className={`${card} flex flex-wrap items-center justify-between gap-3 hover:border-[var(--portal-link)] focus-visible:outline-2 focus-visible:outline-[var(--portal-foco)]`}>
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold">{posicao.opcaoNome}</h3>
                      <p className="text-sm text-[var(--portal-secundario)]">{posicao.referencia} · {posicao.situacao === 'ativa' ? 'Ativa' : 'Encerrada'}</p>
                      <p className="mt-1 text-xs text-[var(--portal-secundario)]">Data-base {formatDate(posicao.dataBase)}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--portal-link)]">
                      {formatarCentavosInvestimento(posicao.totais.saldo)} <IconArrowRight aria-hidden size={17} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : <p className={card}>Nenhum investimento vinculado ao seu cadastro.</p>}
      </section>
      <section className="space-y-3" aria-labelledby="opcoes-investimentos">
        <h2 id="opcoes-investimentos" className="text-xl font-semibold">Opções disponíveis</h2>
        {dados.opcoes.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {dados.opcoes.map((opcao) => (
              <li key={opcao.id} className={`${card} space-y-3`}>
                <div>
                  <p className="text-xs font-medium text-[var(--portal-link)]">{opcao.categoria}</p>
                  <h3 className="mt-1 break-words font-semibold">{opcao.nome}</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--portal-secundario)]">{opcao.descricao}</p>
                </div>
                <dl className="space-y-2 text-sm">
                  <div><dt className="font-medium">Prazo</dt><dd className="break-words text-[var(--portal-secundario)]">{opcao.prazo}</dd></div>
                  <div><dt className="font-medium">Liquidez</dt><dd className="break-words text-[var(--portal-secundario)]">{opcao.liquidez}</dd></div>
                </dl>
                <details className="border-t border-[var(--portal-divisor)] pt-3 text-sm">
                  <summary className="cursor-pointer font-medium">Riscos e condições</summary>
                  <p className="mt-2 whitespace-pre-wrap break-words text-[var(--portal-secundario)]">{opcao.riscos}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-[var(--portal-secundario)]">{opcao.condicoes}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className={card}>Nenhuma opção publicada no momento.</p>}
      </section>
    </main>
  )
}
