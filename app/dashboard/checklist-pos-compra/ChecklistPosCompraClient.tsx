'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { IconCar, IconChecklist, IconChevronDown } from '@tabler/icons-react'
import { EmptyState, Input, SegmentedControl } from '@/app/components/ui'
import { casaBusca } from '@/utils/busca'
import { ChecklistSection } from '../quitacoes/ChecklistSection'
import { CHECKLIST_ITENS, type FichaQuitacao, type VeiculoQuitacaoOpcao } from '../quitacoes/types'

interface Props {
  veiculos: VeiculoQuitacaoOpcao[]
  fichas: Record<string, FichaQuitacao>
}

type Situacao = 'pendentes' | 'concluidos' | 'todos'

const TOTAL = CHECKLIST_ITENS.length

function nomeVeiculo(v: VeiculoQuitacaoOpcao) {
  return `${v.marca} ${v.modelo} ${v.ano}${v.placa ? ` · ${v.placa}` : ''}`
}

function feitosDe(ficha: FichaQuitacao | undefined) {
  return CHECKLIST_ITENS.filter((i) => ficha?.checklist?.[i.id]).length
}

export default function ChecklistPosCompraClient({ veiculos, fichas }: Props) {
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<Situacao>('pendentes')
  const [abertos, setAbertos] = useState<Set<string>>(new Set())

  // Veículos já quitados com o banco não têm mais o que fazer aqui.
  const ativos = useMemo(() => veiculos.filter((v) => !fichas[v.id]?.quitado), [veiculos, fichas])

  const contagem = useMemo(() => {
    const concluidos = ativos.filter((v) => feitosDe(fichas[v.id]) === TOTAL).length
    return { todos: ativos.length, concluidos, pendentes: ativos.length - concluidos }
  }, [ativos, fichas])

  const lista = useMemo(
    () =>
      ativos.filter((v) => {
        const completo = feitosDe(fichas[v.id]) === TOTAL
        if (situacao === 'pendentes' && completo) return false
        if (situacao === 'concluidos' && !completo) return false
        return casaBusca(busca, [v.marca, v.modelo, String(v.ano), v.placa ?? '', fichas[v.id]?.nome ?? ''])
      }),
    [ativos, fichas, busca, situacao],
  )

  function alternar(id: string) {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-950 md:text-3xl">Checklist pós-compra</h1>
        <p className="mt-1 text-xs text-neutral-500 md:text-sm">
          O que falta fazer em cada veículo depois da compra. Os mesmos itens aparecem dentro do veículo em Quitações.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          aria-label="Buscar veículo"
          placeholder="Buscar modelo, placa ou cliente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          containerClassName="w-full sm:w-80"
        />
        <SegmentedControl
          ariaLabel="Situação do checklist"
          value={situacao}
          onChange={setSituacao}
          options={[
            { value: 'pendentes', label: `Pendentes (${contagem.pendentes})` },
            { value: 'concluidos', label: `Concluídos (${contagem.concluidos})` },
            { value: 'todos', label: `Todos (${contagem.todos})` },
          ]}
        />
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<IconChecklist size={24} stroke={1.5} />}
          title="Nenhum veículo encontrado"
          description="Ajuste a busca ou o filtro. Veículos já quitados com o banco não aparecem aqui."
        />
      ) : (
        <ul className="space-y-3">
          {lista.map((v) => {
            const ficha = fichas[v.id]
            const feitos = feitosDe(ficha)
            const aberto = abertos.has(v.id)
            return (
              <li key={v.id} className="rounded-xl border border-neutral-200 bg-white shadow-xs">
                <button
                  type="button"
                  onClick={() => alternar(v.id)}
                  aria-expanded={aberto}
                  className="flex w-full items-center gap-3 p-4 text-left cursor-pointer"
                >
                  <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    {v.foto ? (
                      <Image src={v.foto} alt={nomeVeiculo(v)} fill className="object-cover" sizes="64px" />
                    ) : (
                      <IconCar size={20} stroke={1.5} className="absolute inset-0 m-auto text-neutral-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-neutral-900">{nomeVeiculo(v)}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ' +
                          (feitos === TOTAL ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800')
                        }
                      >
                        {feitos} de {TOTAL}
                      </span>
                      {ficha?.nome && <span>{ficha.nome}</span>}
                    </p>
                  </div>
                  <IconChevronDown
                    size={16}
                    className={'shrink-0 text-neutral-400 transition-transform ' + (aberto ? 'rotate-180' : '')}
                  />
                </button>
                {aberto && (
                  <div className="border-t border-neutral-100 p-4">
                    <ChecklistSection
                      veiculoId={v.id}
                      checklist={ficha?.checklist ?? {}}
                      historico={ficha?.checklistHistorico ?? []}
                      dataCompra={ficha?.dataCompra ?? ''}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
