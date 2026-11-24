'use client'

import { useState, useTransition } from 'react'
import { Button, Input, Select, Textarea, useToast } from '@/app/components/ui'
import { parseMoney } from '@/utils/masks'
import { PERIODICIDADES, type PlanoCatalogo } from '@/utils/pos-venda/catalogo-modelo'
import { salvarCatalogoPosVenda } from './actions'

const cartao = 'rounded-xl border border-neutral-200 bg-white p-5 shadow-xs'
const opcoesPeriodicidade = Object.entries(PERIODICIDADES).map(([value, { rotulo }]) => ({ value, label: rotulo }))
const paraTexto = (centavos: number | null) => (centavos ? (centavos / 100).toFixed(2).replace('.', ',') : '')

type Rascunho = PlanoCatalogo & { valorTexto: string }

export default function CatalogoClient({ planosIniciais }: { planosIniciais: PlanoCatalogo[] }) {
  const [planos, setPlanos] = useState<Rascunho[]>(planosIniciais.map((p) => ({ ...p, valorTexto: paraTexto(p.valorCentavos) })))
  const [pendente, iniciar] = useTransition()
  const toast = useToast()

  const alterar = (servico: string, mudanca: Partial<Rascunho>) =>
    setPlanos((lista) => lista.map((p) => (p.servico === servico ? { ...p, ...mudanca } : p)))

  function salvar() {
    iniciar(async () => {
      const envio: PlanoCatalogo[] = planos.map(({ valorTexto, ...plano }) => ({
        ...plano,
        valorCentavos: valorTexto.trim() ? Math.round(parseMoney(valorTexto) * 100) : null,
      }))
      const resposta = await salvarCatalogoPosVenda(envio)
      if (resposta.error) toast.error(resposta.error)
      else toast.success(resposta.success ?? 'Catálogo salvo.')
    })
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Preços e planos do Pós-venda</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          O que for definido aqui aparece para o cliente na Área do Cliente e pré-preenche as propostas (valor, periodicidade, vencimento e condições).
          Propostas já publicadas não mudam. Sem valor, o cliente vê &quot;Valor informado na proposta&quot;.
        </p>
      </header>

      <ul className="space-y-4">
        {planos.map((p) => {
          const comJuridico = p.servico === 'juridico' || p.servico === 'pacote'
          return (
            <li key={p.servico} className={`${cartao} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">{p.servico === 'pacote' ? 'Pacote completo' : `Serviço: ${p.nome}`}</h2>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={p.disponivel} disabled={pendente} onChange={(e) => alterar(p.servico, { disponivel: e.target.checked })} />
                  Disponível para contratação
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Nome exibido ao cliente" value={p.nome} maxLength={80} disabled={pendente} placeholder="Ex.: Acompanhamento jurídico" onChange={(e) => alterar(p.servico, { nome: e.target.value })} />
                <Input label="Valor da cobrança (R$)" value={p.valorTexto} inputMode="decimal" disabled={pendente} placeholder="Ex.: 99,90 (vazio = sob consulta)" onChange={(e) => alterar(p.servico, { valorTexto: e.target.value })} />
                <Select label="Periodicidade" value={p.periodicidade} options={opcoesPeriodicidade} disabled={pendente} onChange={(e) => alterar(p.servico, { periodicidade: e.target.value as PlanoCatalogo['periodicidade'] })} />
                <Input label="Primeiro vencimento em (dias)" type="number" min={1} max={60} value={p.diasAteVencimento} disabled={pendente} placeholder="Ex.: 5" hint="Regra de cobrança: a proposta sugere hoje + esse número de dias." onChange={(e) => alterar(p.servico, { diasAteVencimento: Number(e.target.value) })} />
              </div>
              <Textarea label="Descrição exibida ao cliente" value={p.descricao} rows={2} maxLength={400} disabled={pendente} placeholder="Ex.: Acompanhe processos e alertas do seu veículo." onChange={(e) => alterar(p.servico, { descricao: e.target.value })} />
              <Textarea label="Condições padrão da proposta" value={p.termos} rows={4} maxLength={8000} disabled={pendente} placeholder="Ex.: O que está incluído, condições de cancelamento e, se aplicável, as condições da defesa e dos honorários." onChange={(e) => alterar(p.servico, { termos: e.target.value })} />
              {comJuridico && (
                <label className="flex items-start gap-2 text-sm">
                  <input className="mt-1" type="checkbox" checked={p.honorarios20} disabled={pendente} onChange={(e) => alterar(p.servico, { honorarios20: e.target.checked })} />
                  <span>Honorários de 20% previstos nas condições (conforme o acordo com o advogado)</span>
                </label>
              )}
            </li>
          )
        })}
      </ul>

      <Button type="button" loading={pendente} onClick={salvar}>Salvar catálogo</Button>
    </div>
  )
}
