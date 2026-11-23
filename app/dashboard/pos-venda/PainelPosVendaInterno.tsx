'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { Button, Input, Select, Textarea, useToast } from '@/app/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'
import {
  ANDAMENTOS_POS_VENDA, SITUACOES_POS_VENDA, nomeServico, servicosInclusos,
  hojePosVenda, pendentePosVenda, pagoPosVenda,
} from '@/utils/pos-venda/modelo'
import type { carregarPosVendaInterno } from '@/utils/pos-venda/repositorio'
import { acaoFinanceiraPosVenda, prepararPropostaPosVenda, publicarAndamentoPosVenda } from './actions'

type Dados = Awaited<ReturnType<typeof carregarPosVendaInterno>>
type Linha = Dados['contratos'][number]
const card = 'rounded-xl border border-neutral-200 bg-white p-5'
const filtroOpcoes = [
  { value: 'todos', label: 'Todos os contratos e solicitações' },
  { value: 'ativos', label: 'Serviços ativos' },
  { value: 'pendentes', label: 'Mensalidades pendentes' },
  { value: 'vencidos', label: 'Mensalidades vencidas' },
  { value: 'solicitacoes', label: 'Solicitações e propostas' },
]
const financeiro = (status: string) => pagoPosVenda(status) ? 'Pago' : ({
  PENDING: 'Pendente', OVERDUE: 'Vencido', DELETED: 'Cancelado', REFUNDED: 'Estornado',
}[status] ?? 'Em conferência')

export default function PainelPosVendaInterno({ dados, habilitado, podeFinanceiro, podeJuridico, podeNegociar, podeRastrear }: {
  dados: Dados
  habilitado: boolean
  podeFinanceiro: boolean
  podeJuridico: boolean
  podeNegociar: boolean
  podeRastrear: boolean
}) {
  const [filtro, setFiltro] = useState('todos')
  const ativos = dados.contratos.filter((c) => c.situacao === 'ativo')
  const pendentes = dados.contratos.filter((c) => c.cobrancas.some((m) => pendentePosVenda(m.status)))
  const vencidos = pendentes.filter((c) => c.cobrancas.some((m) => m.status === 'OVERDUE'))
  const solicitacoes = dados.contratos.filter((c) => ['solicitado', 'proposta', 'aceito', 'ativando'].includes(c.situacao))
  const exibidos = ({ ativos, pendentes, vencidos, solicitacoes })[filtro as 'ativos' | 'pendentes' | 'vencidos' | 'solicitacoes'] ?? dados.contratos

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Serviços ativos', ativos.length],
          ['Solicitações e propostas', solicitacoes.length],
          ['Contratos com mensalidades vencidas', vencidos.length],
          ['Compras sem serviço ativo', dados.semContrato.length],
        ].map(([rotulo, total]) => (
          <div key={rotulo} className={card}>
            <p className="text-sm text-neutral-600">{rotulo}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{total}</p>
          </div>
        ))}
      </div>
      {!habilitado && <p className="rounded-xl border border-amber-300 p-3 text-sm">Cobrança automática indisponível neste ambiente. Ainda é possível preparar e registrar aceites de propostas.</p>}
      <section className="space-y-3" aria-labelledby="lista-pos-venda">
        <h2 id="lista-pos-venda" className="text-xl font-semibold">Contratos e solicitações</h2>
        <div className="max-w-sm">
          <Select label="Exibir" options={filtroOpcoes} value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        </div>
        {exibidos.length === 0 && <p className={card}>Nenhum registro neste filtro.</p>}
        {exibidos.map((contrato) => (
          <Registro key={contrato.id} contrato={contrato} podeFinanceiro={podeFinanceiro} podeJuridico={podeJuridico} podeNegociar={podeNegociar} podeRastrear={podeRastrear} />
        ))}
      </section>
      <section className={card} aria-labelledby="sem-pos-venda">
        <h2 id="sem-pos-venda" className="font-semibold">Compras sem serviço ativo</h2>
        {dados.semContrato.length ? (
          <ul className="mt-2 divide-y divide-neutral-200">
            {dados.semContrato.map(({ id, comprador, nome }) => (
              <li key={id} className="py-2 text-sm"><strong>{comprador}</strong> · {nome}</li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-neutral-600">Nenhuma compra elegível sem serviço ativo.</p>}
      </section>
    </div>
  )
}

function Registro({ contrato, podeFinanceiro, podeJuridico, podeNegociar, podeRastrear }: {
  contrato: Linha
  podeFinanceiro: boolean
  podeJuridico: boolean
  podeNegociar: boolean
  podeRastrear: boolean
}) {
  const [pendente, iniciar] = useTransition()
  const toast = useToast()
  const [tipo, setTipo] = useState('')
  const inclusos = servicosInclusos(contrato.servico)
  const etapas = ANDAMENTOS_POS_VENDA.filter((a) => inclusos.includes(a.servico) && (a.servico === 'juridico' ? podeJuridico : podeNegociar))
  const proposta = contrato.proposta
  const podePropor = podeFinanceiro && contrato.atual && (
    ['solicitado', 'proposta'].includes(contrato.situacao) ||
    (contrato.situacao === 'aceito' && proposta && proposta.vencimento < hojePosVenda())
  )

  function executar(acao: () => Promise<{ erro?: string; aviso?: string }>, mensagem: string) {
    iniciar(async () => {
      try {
        const resposta = await acao()
        if (resposta.erro) toast.error(resposta.erro)
        else if (resposta.aviso) toast.error(resposta.aviso)
        else toast.success(mensagem)
      } catch {
        toast.error('Não foi possível concluir. Confira o registro e tente novamente.')
      }
    })
  }

  function propor(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    executar(() => prepararPropostaPosVenda(contrato.id, dados), 'Proposta disponibilizada ao cliente.')
  }

  return (
    <article className={`${card} space-y-4`}>
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h3 className="font-semibold text-neutral-900">{contrato.comprador} · {contrato.veiculo}</h3>
          <p className="text-sm text-neutral-600">{nomeServico(contrato.servico)}</p>
        </div>
        <span className="text-sm font-semibold text-liberty-deep">{SITUACOES_POS_VENDA[contrato.situacao]}</span>
      </div>
      {proposta && <p className="text-sm">{formatCurrency(proposta.valorCentavos / 100)} por mês · Primeiro vencimento {formatDate(proposta.vencimento)}</p>}
      {podePropor && (
        <details>
          <summary className="cursor-pointer font-medium">{proposta ? 'Editar proposta' : 'Preparar proposta'}</summary>
          <form method="post" onSubmit={propor} className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="valor" label="Mensalidade (R$)" required inputMode="decimal" placeholder="Ex.: 99,90"
                defaultValue={proposta ? (proposta.valorCentavos / 100).toFixed(2).replace('.', ',') : ''} />
              <Input name="vencimento" label="Primeiro vencimento" type="date" required min={hojePosVenda()} defaultValue={proposta?.vencimento} />
            </div>
            <Textarea name="termos" label="Condições da contratação" required rows={4} maxLength={8000}
              placeholder="Informe o que está incluído, as condições de cancelamento e, se aplicável, as condições da defesa judicial e dos honorários."
              defaultValue={proposta?.termos} />
            {inclusos.includes('juridico') && (
              <label className="flex items-center gap-2 text-sm"><input name="honorarios20" type="checkbox" defaultChecked={proposta?.honorarios20} /> Honorários de 20% previstos nas condições desta proposta</label>
            )}
            {inclusos.includes('rastreamento') && (
              <Input name="rastreador" label="Identificador do rastreador no Autocarsat" required maxLength={128}
                placeholder="Ex.: identificador do dispositivo vinculado à placa" defaultValue={proposta?.rastreador ?? ''} />
            )}
            <Button type="submit" size="sm" loading={pendente}>Publicar proposta</Button>
          </form>
        </details>
      )}
      {contrato.situacao === 'ativo' && contrato.atual && etapas.length > 0 && (
        <details>
          <summary className="cursor-pointer font-medium">Publicar andamento ou alerta</summary>
          <form method="post" className="mt-3 space-y-3" onSubmit={(evento) => {
            evento.preventDefault()
            const dados = new FormData(evento.currentTarget)
            dados.set('tipo', tipo)
            executar(() => publicarAndamentoPosVenda(contrato.id, dados), 'Atualização publicada.')
          }}>
            <Select label="Tipo de atualização" value={tipo} onChange={(e) => setTipo(e.target.value)}
              options={[{ value: '', label: 'Selecione o tipo' }, ...etapas.map(({ id, nome }) => ({ value: id, label: nome }))]} />
            <Textarea name="mensagem" label="Resumo visível ao cliente" required maxLength={600} placeholder="Ex.: O banco recebeu o pedido de negociação e a equipe aguarda retorno." />
            <Input name="responsavel" label="Responsável (opcional)" maxLength={120} placeholder="Ex.: Nome do advogado responsável" />
            <Button type="submit" size="sm" loading={pendente} disabled={!tipo}>Publicar atualização</Button>
          </form>
        </details>
      )}
      {contrato.cobrancas.length > 0 && (
        <details>
          <summary className="cursor-pointer font-medium">Mensalidades</summary>
          <ul className="mt-2 divide-y divide-neutral-200">
            {contrato.cobrancas.map((c) => <li key={c.id} className="py-2 text-sm">{formatDate(c.vencimento)} · {formatCurrency(c.valor)} · {financeiro(c.status)}</li>)}
          </ul>
        </details>
      )}
      {podeRastrear && contrato.atual && contrato.situacao === 'ativo' && inclusos.includes('rastreamento') && (
        <Link href={`/dashboard/pos-venda/rastreamento/${contrato.id}`} prefetch={false} className="inline-flex rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold hover:bg-neutral-100">
          Consultar rastreamento autorizado
        </Link>
      )}
      {podeFinanceiro && (
        <div className="flex flex-wrap gap-2">
          {['aceito', 'ativando'].includes(contrato.situacao) && (
            <Button type="button" size="sm" variant="secondary" disabled={pendente} onClick={() => executar(() => acaoFinanceiraPosVenda(contrato.id, 'ativar'), 'Ativação confirmada.')}>Conferir ativação</Button>
          )}
          {contrato.temAssinatura && (
            <Button type="button" size="sm" variant="secondary" disabled={pendente} onClick={() => executar(() => acaoFinanceiraPosVenda(contrato.id, 'sincronizar'), 'Mensalidades atualizadas.')}>Sincronizar mensalidades</Button>
          )}
          {!['cancelado', 'ativando'].includes(contrato.situacao) && (
            <Button type="button" size="sm" variant="secondary" disabled={pendente} onClick={() => {
              if (window.confirm('Cancelar este contrato ou solicitação? As mensalidades já emitidas serão preservadas para conferência.')) {
                executar(() => acaoFinanceiraPosVenda(contrato.id, 'cancelar'), 'Cancelamento confirmado.')
              }
            }}>Cancelar</Button>
          )}
        </div>
      )}
    </article>
  )
}
