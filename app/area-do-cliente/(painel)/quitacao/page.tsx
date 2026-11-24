import { notFound } from 'next/navigation'
import { IconCheck, IconDownload, IconMessageCircle } from '@tabler/icons-react'
import { listarQuitacoesCliente } from '@/utils/quitacoes/portal'
import { ETAPAS_QUITACAO } from '@/utils/quitacoes/etapas'
import AtualizarQuitacaoAberta from './AtualizarQuitacaoAberta'

const dataFormatada = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' })
function formatarData(valor: string) {
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00-03:00` : valor)
  return Number.isNaN(data.getTime()) ? 'Data não informada' : dataFormatada.format(data)
}

export default async function QuitacaoClientePage() {
  const compras = await listarQuitacoesCliente()
  if (!compras) notFound()
  const whatsapp = process.env.QUITACAO_WHATSAPP?.replace(/\D/g, '') || '5514998659046'
  compras.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-9 sm:px-8 sm:py-14">
      <AtualizarQuitacaoAberta />
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Acompanhe sua Quitação</h1>
        <p className="mt-2 text-[var(--portal-secundario)]">Veja o andamento da quitação dos veículos vendidos à Liberty.</p>
      </header>
      {compras.length === 0 && (
        <p className="rounded-xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5 text-[var(--portal-secundario)]">
          Nenhuma compra vinculada ao seu cadastro.
        </p>
      )}
      {compras.map((compra) => {
        const atual = ETAPAS_QUITACAO.findIndex(({ id }) => id === compra.etapa)
        const datas = new Map(compra.historico.map(({ etapa, em }) => [etapa, em]))
        const mensagem = encodeURIComponent('Olá! Preciso de ajuda com uma quitação na Área do Cliente Liberty.')
        return (
          <article key={compra.id} className="space-y-5 rounded-2xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5 sm:p-7">
            <header>
              <h2 className="text-2xl font-semibold">{compra.titulo}</h2>
              {compra.placa && <p className="mt-1 text-sm text-[var(--portal-secundario)]">Placa {compra.placa}</p>}
              <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--portal-secundario)]">Operação realizada em</dt>
                  <dd className="font-medium">{formatarData(compra.dataOperacao)}</dd>
                </div>
                {compra.banco && (
                  <div>
                    <dt className="text-[var(--portal-secundario)]">Instituição financeira</dt>
                    <dd className="font-medium">{compra.banco}</dd>
                  </div>
                )}
                {compra.previsao && (
                  <div>
                    <dt className="text-[var(--portal-secundario)]">Previsão de conclusão</dt>
                    <dd className="font-medium">{formatarData(compra.previsao)}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-2 font-semibold text-[var(--portal-link)]">{ETAPAS_QUITACAO[atual]?.nome}</p>
              <p className="mt-1 text-sm text-[var(--portal-secundario)]">Última atualização em {formatarData(compra.atualizadoEm)}</p>
            </header>
            <div className="grid gap-6 lg:grid-cols-2">
              <section aria-label="Linha do tempo da quitação">
                <h3 className="mb-3 font-semibold">Linha do tempo</h3>
                <ol className="space-y-3">
                  {ETAPAS_QUITACAO.map(({ id, nome }, i) => {
                    const data = datas.get(id)
                    return (
                      <li key={id} aria-current={i === atual ? 'step' : undefined} className="flex gap-3">
                        <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs ${i === atual ? 'border-[var(--portal-link)] text-[var(--portal-link)]' : 'border-[var(--portal-divisor)] text-[var(--portal-secundario)]'}`}>
                          {data && i < atual ? <IconCheck size={15} /> : i + 1}
                        </span>
                        <div>
                          <p className={i === atual ? 'font-semibold text-[var(--portal-link)]' : 'text-sm'}>{nome}</p>
                          {data && <p className="text-xs text-[var(--portal-secundario)]">{formatarData(data)}</p>}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section>
              <div className="space-y-5">
                <section aria-label="Documentos da quitação">
                  <h3 className="mb-2 font-semibold">Documentos disponibilizados</h3>
                  {compra.documentos.length === 0 ? (
                    <p className="text-sm text-[var(--portal-secundario)]">Ainda não há documentos compartilhados.</p>
                  ) : (
                    <ul className="space-y-2">
                      {compra.documentos.map(({ tipo, nome, data }) => (
                        <li key={tipo}>
                          <a className="inline-flex items-center gap-2 text-sm text-[var(--portal-link)] hover:underline" href={`/area-do-cliente/quitacao/documentos/${compra.id}/${tipo}`}>
                            <IconDownload size={16} aria-hidden /> {nome}<span className="text-xs text-[var(--portal-secundario)]">{formatarData(data)}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <details>
                  <summary className="cursor-pointer font-semibold">Histórico de atualizações</summary>
                  <ol className="mt-2 space-y-2 text-sm text-[var(--portal-secundario)]">
                    {compra.historico.slice().reverse().map(({ etapa, em }, i) => (
                      <li key={`${em}-${i}`}>{formatarData(em)} · {ETAPAS_QUITACAO.find(({ id }) => id === etapa)?.nome}</li>
                    ))}
                  </ol>
                </details>
                <a href={`https://wa.me/${whatsapp}?text=${mensagem}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[var(--portal-borda)] px-3 py-2 text-sm font-semibold hover:bg-[var(--portal-selecao)]">
                  <IconMessageCircle size={17} aria-hidden /> Falar com a equipe
                </a>
              </div>
            </div>
          </article>
        )
      })}
    </main>
  )
}
