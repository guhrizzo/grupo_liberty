'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { IconExternalLink, IconMapPin } from '@tabler/icons-react'
import SelectCliente from '@/app/area-do-cliente/SelectCliente'
import { formatCurrency, formatDate } from '@/utils/format'
import {
  ANDAMENTOS_POS_VENDA, SERVICOS_POS_VENDA, SITUACOES_POS_VENDA, nomeServico,
  pendentePosVenda, pagoPosVenda, servicosInclusos,
} from '@/utils/pos-venda/modelo'
import type { carregarPosVendaCliente } from '@/utils/pos-venda/repositorio'
import type { acompanharServicosAtivos } from '@/utils/pos-venda/servicos'
import { aceitarServicoPosVenda, cancelarServicoPosVenda, solicitarServicoPosVenda } from './actions'

type Dados = Awaited<ReturnType<typeof carregarPosVendaCliente>>
type Acompanhamentos = Record<string, Awaited<ReturnType<typeof acompanharServicosAtivos>>>
const card = 'rounded-xl border border-[var(--portal-divisor)] bg-[var(--portal-campo)] p-5'
const primario = 'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--portal-acao)] px-4 py-2 text-sm font-semibold text-[var(--portal-acao-texto)] hover:bg-[var(--portal-acao-hover)] disabled:cursor-not-allowed disabled:opacity-55'
const secundario = 'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--portal-borda)] px-3 py-2 text-sm font-semibold hover:bg-[var(--portal-selecao)] disabled:opacity-55'
const statusFinanceiro = (status: string) => pagoPosVenda(status) ? 'Pago' : ({
  PENDING: 'Pendente', OVERDUE: 'Vencido', AWAITING_RISK_ANALYSIS: 'Em análise', DELETED: 'Cancelado', REFUNDED: 'Estornado',
}[status] ?? 'Em conferência')
const statusProcesso: Record<string, string> = { em_andamento: 'Em andamento', concluido: 'Concluído', pendente: 'Pendente', arquivado: 'Arquivado' }

export default function PainelPosVendaCliente({ veiculos, contratos, acompanhamentos }: {
  veiculos: Omit<Dados['veiculos'][number], 'vinculo'>[]
  contratos: Dados['contratos']
  acompanhamentos: Acompanhamentos
}) {
  const [veiculoId, setVeiculoId] = useState(veiculos[0]?.id ?? '')
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean }>()
  const [pendente, iniciar] = useTransition()
  const veiculo = veiculos.find((v) => v.id === veiculoId)
  const doVeiculo = contratos.filter((c) => c.veiculoId === veiculoId)
  const ocupados = new Set(doVeiculo.filter((c) => c.situacao !== 'cancelado').flatMap((c) => [...servicosInclusos(c.servico)]))
  const andamento = acompanhamentos[veiculoId]

  function executar(acao: () => Promise<{ erro?: string; mensagem?: string }>, sucesso: string) {
    setMensagem(undefined)
    iniciar(async () => {
      try {
        const resultado = await acao()
        setMensagem({ texto: resultado.erro ?? resultado.mensagem ?? sucesso, erro: !!resultado.erro })
      } catch {
        setMensagem({ texto: 'Não foi possível concluir. Confira a situação e tente novamente.', erro: true })
      }
    })
  }

  if (!veiculo) return <p className={card}>Nenhum veículo comprado da Liberty está vinculado à sua conta.</p>

  return (
    <div className="space-y-7">
      <div className="max-w-md">
        <SelectCliente label="Veículo comprado" value={veiculoId} onChange={(evento) => {
          setVeiculoId(evento.target.value)
          setMensagem(undefined)
        }} options={veiculos.map(({ id, nome, placa }) => ({ value: id, label: placa ? `${nome} · ${placa}` : nome }))} />
      </div>
      {mensagem && <p role={mensagem.erro ? 'alert' : 'status'} className={`text-sm ${mensagem.erro ? 'text-[var(--portal-erro)]' : 'text-[var(--portal-link)]'}`}>{mensagem.texto}</p>}
      <section aria-labelledby="servicos-disponiveis">
        <h2 id="servicos-disponiveis" className="mb-3 text-xl font-semibold">Serviços disponíveis</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SERVICOS_POS_VENDA.map(({ id, nome, descricao }) => {
            const indisponivel = servicosInclusos(id).some((servico) => ocupados.has(servico))
            return (
              <li className={`${card} flex flex-col items-start`} key={id}>
                <h3 className="font-semibold">{nome}</h3>
                <p className="mt-2 grow text-sm text-[var(--portal-secundario)]">{descricao}</p>
                <button type="button" disabled={pendente || indisponivel} className={`${secundario} mt-4`}
                  onClick={() => executar(() => solicitarServicoPosVenda(veiculoId, id), 'Solicitação registrada. A Liberty enviará a proposta pelo portal.')}>
                  {indisponivel ? 'Já incluído em uma solicitação' : 'Solicitar proposta'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      {doVeiculo.length > 0 && (
        <section aria-labelledby="meus-servicos" className="space-y-3">
          <h2 id="meus-servicos" className="text-xl font-semibold">Minhas solicitações e contratos</h2>
          {doVeiculo.map((contrato) => {
            const proposta = contrato.proposta
            const rastreamento = servicosInclusos(contrato.servico).includes('rastreamento')
            return (
              <article key={contrato.id} className={`${card} space-y-4`}>
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-semibold">{nomeServico(contrato.servico)}</h3>
                  <span className="text-sm font-medium text-[var(--portal-link)]">{SITUACOES_POS_VENDA[contrato.situacao]}</span>
                </div>
                {proposta && (
                  <div className="space-y-2 text-sm">
                    <p><strong>{formatCurrency(proposta.valorCentavos / 100)}</strong> por mês via Pix · Primeiro vencimento {formatDate(proposta.vencimento)}</p>
                    <details open={contrato.situacao === 'proposta' ? true : undefined}>
                      <summary className="cursor-pointer font-medium">Condições da contratação</summary>
                      <p className="mt-2 whitespace-pre-wrap break-words text-[var(--portal-secundario)]">{proposta.termos}</p>
                      {proposta.honorarios20 && <p className="mt-2 font-medium">Honorários de 20% quando aplicáveis, conforme as condições desta proposta.</p>}
                    </details>
                  </div>
                )}
                {contrato.situacao === 'proposta' && proposta && (
                  <form method="post" className="space-y-3" onSubmit={(evento) => {
                    evento.preventDefault()
                    const dados = new FormData(evento.currentTarget)
                    executar(() => aceitarServicoPosVenda(contrato.id, proposta.id, dados.has('termos'), dados.has('rastreamento')), 'Aceite registrado.')
                  }}>
                    <label className="flex items-center gap-2 text-sm"><input required type="checkbox" name="termos" /> Li as condições e aceito a mensalidade indicada.</label>
                    {rastreamento && <label className="flex items-center gap-2 text-sm"><input required type="checkbox" name="rastreamento" /> Autorizo o monitoramento deste veículo conforme as condições da contratação.</label>}
                    <button type="submit" disabled={pendente} className={primario}>Aceitar proposta</button>
                  </form>
                )}
                {contrato.cobrancas.length > 0 && (
                  <details open={contrato.cobrancas.some((c) => pendentePosVenda(c.status)) ? true : undefined}>
                    <summary className="cursor-pointer text-sm font-semibold">Mensalidades</summary>
                    <ul className="mt-2 divide-y divide-[var(--portal-divisor)]">
                      {contrato.cobrancas.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                          <span>{formatDate(c.vencimento)} · {formatCurrency(c.valor)} · {statusFinanceiro(c.status)}</span>
                          {c.url && pendentePosVenda(c.status) && (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--portal-link)] hover:underline">
                              Abrir cobrança <IconExternalLink aria-hidden size={14} />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="flex flex-wrap gap-2">
                  {rastreamento && contrato.situacao === 'ativo' && (
                    <Link href={`/area-do-cliente/pos-venda/rastreamento/${contrato.id}`} className={secundario} prefetch={false}>
                      <IconMapPin aria-hidden size={17} /> Ver rastreamento
                    </Link>
                  )}
                  {!['cancelado', 'ativando'].includes(contrato.situacao) && (
                    <button type="button" disabled={pendente} className={secundario} onClick={() => {
                      const confirmacao = contrato.situacao === 'ativo' || contrato.situacao === 'cancelando'
                        ? 'Cancelar o serviço? Isso interrompe novas mensalidades. Cobranças já emitidas seguem as condições contratadas.'
                        : 'Cancelar esta solicitação?'
                      if (window.confirm(confirmacao)) executar(() => cancelarServicoPosVenda(contrato.id), 'Cancelamento concluído.')
                    }}>{contrato.situacao === 'cancelando' ? 'Verificar cancelamento' : contrato.situacao === 'ativo' ? 'Cancelar serviço' : 'Cancelar solicitação'}</button>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}
      {andamento && (
        <section className={`${card} space-y-4`} aria-label="Acompanhamento dos serviços">
          <h2 className="text-lg font-semibold">Acompanhamento dos serviços</h2>
          {andamento.processos.length > 0 && (
            <ul className="space-y-2 text-sm">
              {andamento.processos.map((p) => (
                <li key={p.id}><strong>{p.numero || 'Processo vinculado'}</strong> · {statusProcesso[p.status] ?? 'Em conferência'}{p.responsavel && ` · Responsável: ${p.responsavel}`}</li>
              ))}
            </ul>
          )}
          {andamento.andamentos.length ? (
            <ol className="space-y-3">
              {andamento.andamentos.map((item) => (
                <li key={item.id} className="border-t border-[var(--portal-divisor)] pt-3 text-sm">
                  <strong>{ANDAMENTOS_POS_VENDA.find((a) => a.id === item.tipo)?.nome ?? 'Atualização'}</strong>
                  <p className="mt-1 whitespace-pre-wrap break-words">{item.texto}</p>
                  <p className="mt-1 text-xs text-[var(--portal-secundario)]">{formatDate(item.em)}{item.responsavel && ` · ${item.responsavel}`}</p>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-[var(--portal-secundario)]">Nenhuma atualização publicada pela equipe.</p>}
        </section>
      )}
    </div>
  )
}
