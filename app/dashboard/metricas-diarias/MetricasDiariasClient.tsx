'use client'

import { useMemo, useState, useTransition } from 'react'
import { IconCalendar, IconChartBar, IconDeviceFloppy } from '@tabler/icons-react'
import { Button, EmptyState, Select, useToast } from '@/app/components/ui'
import {
  METRICA_CAMPOS,
  METRICA_VALOR_MAX,
  mediaMetricas,
  metricaVazia,
  somarMetricas,
  type MetricaCampo,
  type MetricaValores,
} from '@/constants/metricas-diarias'
import { getMetricasDoMes, salvarMetricaDiaria } from './actions'
import type { MetricaDiaria, MetricasDoMes } from './types'

const inputCls =
  'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-liberty focus:outline-none focus:ring-4 focus:ring-liberty/15'

function formatarDia(data: string) {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

function formatarMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  const nome = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

function formatarNumero(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function valoresDe(r: MetricaDiaria | undefined): MetricaValores {
  if (!r) return metricaVazia()
  const v = metricaVazia()
  for (const { key } of METRICA_CAMPOS) v[key] = r[key]
  return v
}

interface Resumo {
  uid: string
  nome: string
  dias: number
  total: MetricaValores
  media: MetricaValores
}

function resumir(registros: MetricaDiaria[]): Resumo[] {
  const porPessoa = new Map<string, MetricaDiaria[]>()
  for (const r of registros) porPessoa.set(r.uid, [...(porPessoa.get(r.uid) ?? []), r])
  return [...porPessoa.entries()]
    .map(([uid, lista]) => {
      const total = somarMetricas(lista)
      return { uid, nome: lista[0].nome, dias: lista.length, total, media: mediaMetricas(total, lista.length) }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export default function MetricasDiariasClient({
  hoje,
  inicial,
  usuarioUid,
  veTodos,
}: {
  hoje: string
  inicial: MetricasDoMes
  usuarioUid: string
  veTodos: boolean
}) {
  const toast = useToast()
  const [dados, setDados] = useState(inicial)
  const [carregando, startCarregar] = useTransition()
  const [salvando, startSalvar] = useTransition()
  const [dia, setDia] = useState(hoje)
  const [form, setForm] = useState<Record<MetricaCampo, string>>(() => paraForm(meuRegistro(inicial.registros, hoje)))
  const [pessoa, setPessoa] = useState('')

  function meuRegistro(registros: MetricaDiaria[], data: string) {
    return registros.find((r) => r.uid === usuarioUid && r.data === data)
  }

  function paraForm(r: MetricaDiaria | undefined): Record<MetricaCampo, string> {
    const v = valoresDe(r)
    return Object.fromEntries(METRICA_CAMPOS.map(({ key }) => [key, r ? String(v[key]) : ''])) as Record<
      MetricaCampo,
      string
    >
  }

  function carregarMes(mes: string, diaForm?: string) {
    startCarregar(async () => {
      const novo = await getMetricasDoMes(mes)
      setDados(novo)
      if (diaForm) setForm(paraForm(meuRegistro(novo.registros, diaForm)))
    })
  }

  function trocarDia(novoDia: string) {
    if (!novoDia || novoDia > hoje) return
    setDia(novoDia)
    if (novoDia.slice(0, 7) !== dados.mes) carregarMes(novoDia.slice(0, 7), novoDia)
    else setForm(paraForm(meuRegistro(dados.registros, novoDia)))
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    const valores = metricaVazia()
    for (const { key } of METRICA_CAMPOS) valores[key] = Number(form[key] || 0)
    startSalvar(async () => {
      const res = await salvarMetricaDiaria(dia, valores)
      if ('error' in res) {
        toast.error(res.error, 'Não foi possível salvar')
        return
      }
      toast.success(res.success, formatarDia(dia))
      if (res.registro.mes === dados.mes) {
        setDados((d) => ({
          ...d,
          registros: [...d.registros.filter((r) => r.id !== res.registro.id), res.registro].sort(
            (a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome, 'pt-BR'),
          ),
        }))
      }
    })
  }

  const resumos = useMemo(() => resumir(dados.registros), [dados.registros])
  const historico = useMemo(
    () => dados.registros.filter((r) => !pessoa || r.uid === pessoa),
    [dados.registros, pessoa],
  )
  const equipe = useMemo(() => {
    const total = somarMetricas(dados.registros)
    return { total, media: mediaMetricas(total, dados.registros.length) }
  }, [dados.registros])
  const meu = resumos.find((r) => r.uid === usuarioUid)
  const jaPreenchido = !!meuRegistro(dados.registros, dia)

  return (
    <div className="space-y-6">
      {/* Preencher o dia */}
      <form onSubmit={salvar} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs md:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-neutral-700">Meus números do dia</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {jaPreenchido ? 'Esse dia já foi preenchido. Salvar substitui os números.' : 'Ainda não preenchido.'}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-neutral-600">
            <IconCalendar size={16} className="text-neutral-400" />
            <input
              type="date"
              value={dia}
              max={hoje}
              onChange={(e) => trocarDia(e.target.value)}
              className={`${inputCls} w-auto py-2`}
              aria-label="Dia"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {METRICA_CAMPOS.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
                {label}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={METRICA_VALOR_MAX}
                step={1}
                placeholder="0"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className={`${inputCls} text-lg font-bold`}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" variant="liberty" loading={salvando} leftIcon={<IconDeviceFloppy size={16} />}>
            Salvar dia
          </Button>
        </div>
      </form>

      {/* Mês */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-neutral-700">
          {formatarMes(dados.mes)}
          {carregando && <span className="ml-2 text-xs font-semibold normal-case text-neutral-400">carregando...</span>}
        </h2>
        <input
          type="month"
          value={dados.mes}
          max={hoje.slice(0, 7)}
          onChange={(e) => e.target.value && carregarMes(e.target.value)}
          className={`${inputCls} w-auto py-2`}
          aria-label="Mês"
        />
      </div>

      {dados.registros.length === 0 ? (
        <EmptyState
          icon={<IconChartBar size={28} />}
          title="Nada preenchido neste mês"
          description={
            veTodos
              ? 'Quando os vendedores preencherem os números do dia, o resumo de cada um aparece aqui.'
              : 'Preencha seus números do dia acima. A média por dia aparece aqui.'
          }
        />
      ) : (
        <>
          {/* Média por dia */}
          {veTodos ? (
            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-100 bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  <tr>
                    <th className="px-4 py-3">Vendedor</th>
                    <th className="px-4 py-3 text-center">Dias</th>
                    {METRICA_CAMPOS.map(({ key, label }) => (
                      <th key={key} className="px-4 py-3 text-center">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {resumos.map((r) => (
                    <tr key={r.uid}>
                      <td className="px-4 py-3 font-bold text-neutral-900">{r.nome}</td>
                      <td className="px-4 py-3 text-center text-neutral-600">{r.dias}</td>
                      {METRICA_CAMPOS.map(({ key }) => (
                        <td key={key} className="px-4 py-3 text-center">
                          <span className="block font-bold text-liberty-deep">{formatarNumero(r.media[key])}/dia</span>
                          <span className="block text-[11px] text-neutral-400">{r.total[key]} no mês</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {resumos.length > 1 && (
                    <tr className="bg-neutral-50">
                      <td className="px-4 py-3 font-extrabold text-neutral-900">Equipe</td>
                      <td className="px-4 py-3 text-center text-neutral-600">{dados.registros.length}</td>
                      {METRICA_CAMPOS.map(({ key }) => (
                        <td key={key} className="px-4 py-3 text-center">
                          <span className="block font-bold text-neutral-900">{formatarNumero(equipe.media[key])}/dia</span>
                          <span className="block text-[11px] text-neutral-400">{equipe.total[key]} no mês</span>
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            meu && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {METRICA_CAMPOS.map(({ key, label }) => (
                  <div key={key} className="rounded-xl border border-liberty/30 bg-liberty/10 p-4">
                    <span className="block text-[9px] font-bold uppercase tracking-widest text-liberty-deep/70">
                      {label} por dia
                    </span>
                    <p className="mt-1.5 text-2xl font-black text-liberty-deep">{formatarNumero(meu.media[key])}</p>
                    <p className="text-[11px] text-neutral-500">
                      {meu.total[key]} em {meu.dias} dia{meu.dias === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Histórico dia a dia */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">Dia a dia</h3>
              {veTodos && resumos.length > 1 && (
                <div className="w-56">
                  <Select
                    value={pessoa}
                    onChange={(e) => setPessoa(e.target.value)}
                    options={[{ value: '', label: 'Todos os vendedores' }, ...resumos.map((r) => ({ value: r.uid, label: r.nome }))]}
                  />
                </div>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-100 bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  <tr>
                    <th className="px-4 py-3">Dia</th>
                    {veTodos && <th className="px-4 py-3">Vendedor</th>}
                    {METRICA_CAMPOS.map(({ key, label }) => (
                      <th key={key} className="px-4 py-3 text-center">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {historico.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-neutral-700">
                        {r.uid === usuarioUid ? (
                          <button
                            type="button"
                            onClick={() => trocarDia(r.data)}
                            className="text-liberty hover:underline cursor-pointer"
                            title="Editar este dia"
                          >
                            {formatarDia(r.data)}
                          </button>
                        ) : (
                          formatarDia(r.data)
                        )}
                      </td>
                      {veTodos && <td className="whitespace-nowrap px-4 py-3 text-neutral-700">{r.nome}</td>}
                      {METRICA_CAMPOS.map(({ key }) => (
                        <td key={key} className="px-4 py-3 text-center font-semibold text-neutral-900">
                          {r[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
