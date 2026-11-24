'use client'

import { formatCurrency, formatDate } from '@/utils/format'
import { ANDAMENTOS_POS_VENDA, nomeServico } from '@/utils/pos-venda/modelo'
import type { Oportunidade, resumoGestao, atendimentosRecentes } from '@/utils/pos-venda/gestao'

type Resumo = ReturnType<typeof resumoGestao>
type Atendimentos = ReturnType<typeof atendimentosRecentes>

const card = 'rounded-xl border border-neutral-200 bg-white p-5'
const vazio = (texto: string) => <p className="mt-2 text-sm text-neutral-600">{texto}</p>

/** Seções de acompanhamento do painel de gestão. Só apresentação: os números vêm de utils/pos-venda/gestao. */
export function ReceitaRecorrente({ resumo }: { resumo: Resumo }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={card} aria-labelledby="receita-servico">
        <h2 id="receita-servico" className="font-semibold">Receita recorrente por serviço</h2>
        <p className="text-xs text-neutral-500">Valor mensal equivalente dos contratos ativos e inadimplentes.</p>
        {resumo.receitaPorServico.length === 0 ? vazio('Nenhum contrato ativo ainda.') : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {resumo.receitaPorServico.map((s) => (
              <li key={s.servico} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{s.nome} <span className="text-neutral-500">· {s.contratos} contrato{s.contratos === 1 ? '' : 's'}</span></span>
                <strong>{formatCurrency(s.receita)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={card} aria-labelledby="receita-cliente">
        <h2 id="receita-cliente" className="font-semibold">Receita recorrente por cliente</h2>
        {resumo.receitaPorCliente.length === 0 ? vazio('Nenhum contrato ativo ainda.') : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {resumo.receitaPorCliente.slice(0, 30).map((c) => (
              <li key={c.chave} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{c.nome} <span className="text-neutral-500">· {c.contratos} contrato{c.contratos === 1 ? '' : 's'}</span></span>
                <strong>{formatCurrency(c.receita)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export function VencimentosERenovacoes({ resumo }: { resumo: Resumo }) {
  const lista = (itens: Resumo['vencimentos'], id: string, titulo: string, nota: string, texto: string) => (
    <section className={card} aria-labelledby={id}>
      <h2 id={id} className="font-semibold">{titulo}</h2>
      <p className="text-xs text-neutral-500">{nota}</p>
      {itens.length === 0 ? vazio(texto) : (
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {itens.map((v, i) => (
            <li key={`${v.contratoId}-${v.vencimento}-${i}`} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <strong>{v.comprador}</strong> <span className="text-neutral-500">· {v.veiculo} · {nomeServico(v.servico)}</span>
              </span>
              <span className={v.vencida ? 'font-semibold text-red-700' : 'font-medium'}>
                {formatDate(v.vencimento)} · {formatCurrency(v.valor)}{v.vencida && ' · vencida'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {lista(resumo.vencimentos, 'vencimentos', 'Vencimentos e cobranças pendentes', 'Cobranças vencidas e as que vencem nos próximos 30 dias.', 'Nenhuma cobrança pendente.')}
      {lista(resumo.renovacoes, 'renovacoes', 'Renovações próximas', 'Planos trimestrais, semestrais e anuais com cobrança nos próximos 60 dias.', 'Nenhuma renovação próxima.')}
    </div>
  )
}

export function AtendimentosRecentes({ itens }: { itens: Atendimentos }) {
  return (
    <section className={card} aria-labelledby="atendimentos">
      <h2 id="atendimentos" className="font-semibold">Histórico de atendimentos</h2>
      <p className="text-xs text-neutral-500">Atualizações publicadas aos clientes, de todos os contratos.</p>
      {itens.length === 0 ? vazio('Nenhum atendimento registrado.') : (
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {itens.map((a) => (
            <li key={`${a.contratoId}-${a.id}`} className="space-y-0.5 py-2">
              <p>
                <strong>{ANDAMENTOS_POS_VENDA.find((t) => t.id === a.tipo)?.nome ?? 'Atualização'}</strong>
                <span className="text-neutral-500"> · {a.comprador} · {a.veiculo} · {formatDate(a.em.slice(0, 10))}</span>
              </p>
              <p className="text-neutral-700">{a.texto}</p>
              {a.responsavel && <p className="text-xs text-neutral-500">Responsável: {a.responsavel}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const ROTULO_OPORTUNIDADE: Record<Oportunidade['tipo'], string> = {
  sem_servico: 'Nunca contratou', complementar: 'Serviços adicionais', reativar: 'Reativação',
}

export function Oportunidades({ itens }: { itens: Oportunidade[] }) {
  return (
    <section className={card} aria-labelledby="oportunidades">
      <h2 id="oportunidades" className="font-semibold">Oportunidades de venda</h2>
      <p className="text-xs text-neutral-500">Quem ainda não contratou, quem tem só parte dos serviços e quem cancelou.</p>
      {itens.length === 0 ? vazio('Nenhuma oportunidade no momento.') : (
        <ul className="mt-3 divide-y divide-neutral-100 text-sm">
          {itens.map((o) => (
            <li key={`${o.tipo}-${o.veiculoId}`} className="flex flex-wrap justify-between gap-2 py-2">
              <span><strong>{o.comprador}</strong> <span className="text-neutral-500">· {o.veiculo}</span></span>
              <span><span className="font-medium">{ROTULO_OPORTUNIDADE[o.tipo]}</span> <span className="text-neutral-500">· {o.sugestao}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
