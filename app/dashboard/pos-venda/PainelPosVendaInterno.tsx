'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { Button, Input, Select, Textarea, useToast } from '@/app/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'
import {
  ANDAMENTOS_POS_VENDA, SERVICOS_POS_VENDA, SITUACOES_POS_VENDA, nomeServico, servicosInclusos,
  hojePosVenda, pendentePosVenda, pagoPosVenda,
} from '@/utils/pos-venda/modelo'
import { PERIODICIDADES, planoDoServico, vencimentoSugerido, type PlanoCatalogo } from '@/utils/pos-venda/catalogo-modelo'
import type { carregarPosVendaInterno } from '@/utils/pos-venda/repositorio'
import {
  ROTULO_STATUS_GESTAO, atendimentosRecentes, filtrarContratos, oportunidades, resumoGestao,
  type FiltrosGestao, type StatusGestao,
} from '@/utils/pos-venda/gestao'
import { AtendimentosRecentes, Oportunidades, ReceitaRecorrente, VencimentosERenovacoes } from './GestaoPosVenda'
import { acaoFinanceiraPosVenda, prepararPropostaPosVenda, publicarAndamentoPosVenda } from './actions'

type Dados = Awaited<ReturnType<typeof carregarPosVendaInterno>>
type Linha = Dados['contratos'][number]
const card = 'rounded-xl border border-neutral-200 bg-white p-5'
const financeiro = (status: string) => pagoPosVenda(status) ? 'Pago' : ({
  PENDING: 'Pendente', OVERDUE: 'Vencido', DELETED: 'Cancelado', REFUNDED: 'Estornado',
}[status] ?? 'Em conferência')

const abas = [
  { id: 'contratos', nome: 'Contratos' },
  { id: 'receita', nome: 'Receita recorrente' },
  { id: 'vencimentos', nome: 'Vencimentos e renovações' },
  { id: 'atendimentos', nome: 'Atendimentos' },
  { id: 'oportunidades', nome: 'Oportunidades' },
] as const
type Aba = (typeof abas)[number]['id']

const opcoesServico = [{ value: '', label: 'Todos os serviços' }, ...SERVICOS_POS_VENDA.map(({ id, nome }) => ({ value: id, label: nome }))]
const opcoesStatus = [
  { value: '', label: 'Todos os status' },
  ...(Object.entries(ROTULO_STATUS_GESTAO) as [StatusGestao, string][]).map(([value, label]) => ({ value, label })),
]

export default function PainelPosVendaInterno({ dados, catalogo, habilitado, podeFinanceiro, podeJuridico, podeNegociar, podeRastrear }: {
  dados: Dados
  catalogo: PlanoCatalogo[]
  habilitado: boolean
  podeFinanceiro: boolean
  podeJuridico: boolean
  podeNegociar: boolean
  podeRastrear: boolean
}) {
  const [aba, setAba] = useState<Aba>('contratos')
  const [filtros, setFiltros] = useState<FiltrosGestao>({ busca: '', servico: '', status: '', responsavel: '' })
  const resumo = useMemo(() => resumoGestao(dados.contratos, hojePosVenda()), [dados.contratos])
  const exibidos = useMemo(() => filtrarContratos(dados.contratos, filtros), [dados.contratos, filtros])
  const atendimentos = useMemo(() => atendimentosRecentes(dados.contratos), [dados.contratos])
  const chances = useMemo(() => oportunidades(dados.contratos, dados.semContrato), [dados.contratos, dados.semContrato])
  const responsaveis = useMemo(
    () => [...new Set(dados.contratos.map((c) => c.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [dados.contratos],
  )
  const filtrando = Object.values(filtros).some(Boolean)

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          ['Receita recorrente mensal', formatCurrency(resumo.receitaMensal)],
          ['Serviços ativos', resumo.contagem.ativos + resumo.contagem.inadimplentes],
          ['Inadimplentes', resumo.contagem.inadimplentes],
          ['Solicitações e propostas', resumo.contagem.solicitacoes],
          ['Cobranças a vencer ou vencidas', resumo.vencimentos.length],
          ['Oportunidades', chances.length],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className={card}>
            <p className="text-sm text-neutral-600">{rotulo}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{valor}</p>
          </div>
        ))}
      </div>
      {!habilitado && <p className="rounded-xl border border-amber-300 p-3 text-sm">Cobrança automática indisponível neste ambiente. Ainda é possível preparar e registrar aceites de propostas.</p>}

      <div role="tablist" aria-label="Seções da gestão do pós-venda" className="flex flex-wrap gap-1 border-b border-neutral-200">
        {abas.map(({ id, nome }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`aba-${id}`}
            aria-selected={aba === id}
            aria-controls={`painel-${id}`}
            onClick={() => setAba(id)}
            className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-semibold ${aba === id ? 'border-liberty-deep text-liberty-deep' : 'border-transparent text-neutral-600 hover:text-neutral-900'}`}
          >
            {nome}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} className="space-y-4">
        {aba === 'contratos' && (
          <section className="space-y-3" aria-labelledby="lista-pos-venda">
            <h2 id="lista-pos-venda" className="text-xl font-semibold">Contratos e solicitações</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Buscar por cliente ou veículo" value={filtros.busca} placeholder="Ex.: Maria ou Argo"
                onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))} />
              <Select label="Serviço" options={opcoesServico} value={filtros.servico} onChange={(e) => setFiltros((f) => ({ ...f, servico: e.target.value }))} />
              <Select label="Status" options={opcoesStatus} value={filtros.status} onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))} />
              <Select label="Responsável" value={filtros.responsavel} onChange={(e) => setFiltros((f) => ({ ...f, responsavel: e.target.value }))}
                options={[{ value: '', label: 'Todos os responsáveis' }, ...responsaveis.map((r) => ({ value: r, label: r }))]} />
            </div>
            <p className="text-sm text-neutral-600">
              {exibidos.length} de {dados.contratos.length} registro{dados.contratos.length === 1 ? '' : 's'}
              {filtrando && (
                <button type="button" className="ml-3 cursor-pointer font-semibold text-liberty-deep hover:underline"
                  onClick={() => setFiltros({ busca: '', servico: '', status: '', responsavel: '' })}>Limpar filtros</button>
              )}
            </p>
            {exibidos.length === 0 && <p className={card}>Nenhum registro com estes filtros.</p>}
            {exibidos.map((contrato) => (
              <Registro key={contrato.id} contrato={contrato} plano={planoDoServico(catalogo, contrato.servico)} podeFinanceiro={podeFinanceiro} podeJuridico={podeJuridico} podeNegociar={podeNegociar} podeRastrear={podeRastrear} />
            ))}
          </section>
        )}
        {aba === 'receita' && <ReceitaRecorrente resumo={resumo} />}
        {aba === 'vencimentos' && <VencimentosERenovacoes resumo={resumo} />}
        {aba === 'atendimentos' && <AtendimentosRecentes itens={atendimentos} />}
        {aba === 'oportunidades' && <Oportunidades itens={chances} />}
      </div>
    </div>
  )
}

function Registro({ contrato, plano, podeFinanceiro, podeJuridico, podeNegociar, podeRastrear }: {
  contrato: Linha
  plano?: PlanoCatalogo
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
      {proposta && <p className="text-sm">{formatCurrency(proposta.valorCentavos / 100)} {PERIODICIDADES[proposta.periodicidade ?? 'mensal'].por} · Primeiro vencimento {formatDate(proposta.vencimento)}</p>}
      {podePropor && (
        <details>
          <summary className="cursor-pointer font-medium">{proposta ? 'Editar proposta' : 'Preparar proposta'}</summary>
          <form method="post" onSubmit={propor} className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="valor" label="Valor da cobrança (R$)" required inputMode="decimal" placeholder="Ex.: 99,90"
                defaultValue={proposta ? (proposta.valorCentavos / 100).toFixed(2).replace('.', ',') : plano?.valorCentavos ? (plano.valorCentavos / 100).toFixed(2).replace('.', ',') : ''} />
              <Input name="vencimento" label="Primeiro vencimento" type="date" required min={hojePosVenda()}
                defaultValue={proposta && proposta.vencimento >= hojePosVenda() ? proposta.vencimento : vencimentoSugerido(hojePosVenda(), plano?.diasAteVencimento ?? 5)} />
              <Select name="periodicidade" label="Periodicidade" defaultValue={proposta?.periodicidade ?? plano?.periodicidade ?? 'mensal'}
                options={Object.entries(PERIODICIDADES).map(([value, { rotulo }]) => ({ value, label: rotulo }))} />
            </div>
            <Textarea name="termos" label="Condições da contratação" required rows={4} maxLength={8000}
              placeholder="Informe o que está incluído, as condições de cancelamento e, se aplicável, as condições da defesa judicial e dos honorários."
              defaultValue={proposta?.termos ?? plano?.termos} />
            {inclusos.includes('juridico') && (
              <label className="flex items-center gap-2 text-sm"><input name="honorarios20" type="checkbox" defaultChecked={proposta?.honorarios20 ?? plano?.honorarios20} /> Honorários de 20% previstos nas condições desta proposta</label>
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
