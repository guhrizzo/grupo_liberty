'use client'

import { useState, useTransition } from 'react'
import { IconArrowDown, IconArrowUp, IconPlus } from '@tabler/icons-react'
import { Button, Input, useToast } from '@/app/components/ui'
import { ETAPA_INICIAL, MAX_ETAPAS, type EtapaConfig } from '@/utils/quitacoes/etapas'
import { salvarEtapasQuitacao } from './actions'

const novoId = () => `etapa_${Math.random().toString(36).slice(2, 10)}`

export default function EtapasClient({ etapasIniciais }: { etapasIniciais: EtapaConfig[] }) {
  const [etapas, setEtapas] = useState(etapasIniciais)
  const [pendente, iniciar] = useTransition()
  const toast = useToast()
  const existentes = new Set(etapasIniciais.map((e) => e.id))

  const alterar = (id: string, mudanca: Partial<EtapaConfig>) =>
    setEtapas((lista) => lista.map((e) => (e.id === id ? { ...e, ...mudanca } : e)))

  const mover = (indice: number, passo: -1 | 1) =>
    setEtapas((lista) => {
      const destino = indice + passo
      if (destino < 0 || destino >= lista.length) return lista
      const copia = [...lista]
      const [item] = copia.splice(indice, 1)
      copia.splice(destino, 0, item)
      return copia
    })

  const salvar = () =>
    iniciar(async () => {
      const resposta = await salvarEtapasQuitacao(etapas)
      if (resposta.error) toast.error(resposta.error)
      else toast.success(resposta.success ?? 'Etapas salvas.')
    })

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950">Etapas da quitação</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          Esta lista vale para todas as operações e define a linha do tempo que o cliente vê em &quot;Acompanhe sua Quitação&quot;.
          Etapas já existentes não podem ser apagadas, apenas desativadas. Para pular uma etapa em uma operação específica,
          use &quot;Etapas que não se aplicam&quot; na ficha do veículo.
        </p>
      </header>

      <ol className="space-y-3">
        {etapas.map((etapa, i) => (
          <li key={etapa.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="mt-2 grid size-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">{i + 1}</span>
              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
                <Input
                  label="Nome da etapa"
                  placeholder="Ex.: Documentação recebida"
                  value={etapa.nome}
                  maxLength={80}
                  disabled={pendente}
                  onChange={(e) => alterar(etapa.id, { nome: e.target.value })}
                />
                <Input
                  label="Descrição para o cliente"
                  placeholder="Ex.: Documentos necessários recebidos."
                  value={etapa.descricao}
                  maxLength={200}
                  disabled={pendente}
                  onChange={(e) => alterar(etapa.id, { descricao: e.target.value })}
                />
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={etapa.ativa}
                      disabled={pendente || etapa.id === ETAPA_INICIAL}
                      onChange={(e) => alterar(etapa.id, { ativa: e.target.checked })}
                    />
                    Ativa{etapa.id === ETAPA_INICIAL && ' (etapa inicial)'}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={etapa.avisar} disabled={pendente} onChange={(e) => alterar(etapa.id, { avisar: e.target.checked })} />
                    Avisar o cliente por e-mail
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={etapa.quitacao} disabled={pendente} onChange={(e) => alterar(etapa.id, { quitacao: e.target.checked })} />
                    Conta como quitado
                  </label>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" aria-label={`Subir ${etapa.nome || 'etapa'}`} disabled={pendente || i === 0} onClick={() => mover(i, -1)} className="rounded-md border border-neutral-200 p-1.5 hover:bg-neutral-100 disabled:opacity-40">
                  <IconArrowUp size={16} />
                </button>
                <button type="button" aria-label={`Descer ${etapa.nome || 'etapa'}`} disabled={pendente || i === etapas.length - 1} onClick={() => mover(i, 1)} className="rounded-md border border-neutral-200 p-1.5 hover:bg-neutral-100 disabled:opacity-40">
                  <IconArrowDown size={16} />
                </button>
              </div>
            </div>
            {!existentes.has(etapa.id) && <p className="mt-2 pl-10 text-xs text-neutral-500">Nova etapa, ainda não salva.</p>}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          leftIcon={<IconPlus size={16} />}
          disabled={pendente || etapas.length >= MAX_ETAPAS}
          onClick={() => setEtapas((lista) => [...lista, { id: novoId(), nome: '', descricao: '', ativa: true, avisar: false, quitacao: false }])}
        >
          Adicionar etapa
        </Button>
        <Button type="button" loading={pendente} onClick={salvar}>Salvar etapas</Button>
      </div>
    </div>
  )
}
