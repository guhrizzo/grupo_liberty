'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { IconFileSpreadsheet, IconFileTypePdf, IconMapPin, IconPencil, IconQrcode } from '@tabler/icons-react'
import { Button, Card, EmptyState, Modal, StatusBadge, useToast } from '@/app/components/ui'
import { BATIDAS, BATIDA_LABEL, type Batida, type RegistroPonto } from '@/constants/ponto'
import { diasDoMes, formatarMinutos, horaSP, minutosTrabalhados, saldoDia } from '@/utils/ponto/calculo'
import { editarBatida, getFolhaMes, salvarJornada, type FolhaMes } from './actions'

const inputCls =
  'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-liberty focus:outline-none focus:ring-4 focus:ring-liberty/15'

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function rotuloDia(data: string) {
  const [a, m, d] = data.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} ${DIAS_SEMANA[new Date(a, m - 1, d).getDay()]}`
}

function ehFimDeSemana(data: string) {
  const [a, m, d] = data.split('-').map(Number)
  const w = new Date(a, m - 1, d).getDay()
  return w === 0 || w === 6
}

function tomSaldo(min: number) {
  return min < 0 ? 'text-rose-600' : min > 0 ? 'text-emerald-700' : 'text-neutral-700'
}

export default function FolhaClient({ hoje, inicial }: { hoje: string; inicial: FolhaMes }) {
  const toast = useToast()
  const [folha, setFolha] = useState(inicial)
  const [mes, setMes] = useState(inicial.mes)
  const [uid, setUid] = useState<string | null>(null)
  const [carregando, carregar] = useTransition()

  const [editando, setEditando] = useState<{ data: string; campo: Batida } | null>(null)
  const [hora, setHora] = useState('')
  const [motivo, setMotivo] = useState('')
  const [salvando, salvar] = useTransition()

  const [jornadaUid, setJornadaUid] = useState<string | null>(null)
  const [jornadaTxt, setJornadaTxt] = useState('08:00')

  function recarregar(novoMes = mes, novoUid = uid) {
    carregar(async () => {
      try {
        setFolha(await getFolhaMes(novoMes, novoUid))
      } catch {
        toast.error('Não foi possível carregar a folha.')
      }
    })
  }

  function trocarMes(valor: string) {
    if (!/^\d{4}-\d{2}$/.test(valor)) return
    setMes(valor)
    recarregar(valor, uid)
  }

  function escolher(u: string) {
    setUid(u)
    recarregar(mes, u)
  }

  const func = folha.funcionarios.find((f) => f.uid === uid) ?? null
  const porData = useMemo(() => new Map(folha.registros.map((r) => [r.data, r])), [folha.registros])
  const totalSel = folha.totais.find((t) => t.uid === uid)

  function abrirEdicao(data: string, campo: Batida) {
    const iso = porData.get(data)?.batidas[campo]
    setHora(iso ? horaSP(iso) : '')
    setMotivo('')
    setEditando({ data, campo })
  }

  function confirmarEdicao() {
    if (!editando || !uid) return
    salvar(async () => {
      const r = await editarBatida({ uid, data: editando.data, campo: editando.campo, hora, motivo })
      if (r.ok) {
        toast.success('Batida atualizada.')
        setEditando(null)
        recarregar()
      } else {
        toast.error(r.erro)
      }
    })
  }

  function confirmarJornada() {
    const m = /^(\d{1,2}):([0-5]\d)$/.exec(jornadaTxt)
    if (!jornadaUid || !m) return toast.error('Informe a jornada no formato HH:mm.')
    salvar(async () => {
      const r = await salvarJornada(jornadaUid, Number(m[1]) * 60 + Number(m[2]))
      if (r.ok) {
        toast.success('Jornada atualizada. Vale a partir dos próximos dias.')
        setJornadaUid(null)
        recarregar()
      } else {
        toast.error(r.erro)
      }
    })
  }

  const registroEditando: RegistroPonto | undefined = editando ? porData.get(editando.data) : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-500">Mês</label>
          <input
            type="month"
            value={mes}
            max={hoje.slice(0, 7)}
            onChange={(e) => trocarMes(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href="/dashboard/ponto/qr">
            <Button variant="secondary" leftIcon={<IconQrcode className="h-4 w-4" />}>Tela do QR</Button>
          </Link>
          <a href={`/api/ponto/xlsx?mes=${mes}`}>
            <Button variant="secondary" leftIcon={<IconFileSpreadsheet className="h-4 w-4" />}>Excel</Button>
          </a>
          {uid && (
            <a href={`/api/ponto/pdf?mes=${mes}&uid=${uid}`} target="_blank" rel="noreferrer">
              <Button variant="secondary" leftIcon={<IconFileTypePdf className="h-4 w-4" />}>PDF</Button>
            </a>
          )}
        </div>
      </div>

      <div className={`overflow-x-auto rounded-xl border border-neutral-200 bg-white ${carregando ? 'opacity-60' : ''}`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-700">
            <tr>
              <th className="px-4 py-3">Funcionário</th>
              <th className="px-4 py-3">Jornada/dia</th>
              <th className="px-4 py-3">Dias</th>
              <th className="px-4 py-3">Horas no mês</th>
              <th className="px-4 py-3">Saldo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {folha.funcionarios.map((f) => {
              const t = folha.totais.find((x) => x.uid === f.uid)
              return (
                <tr
                  key={f.uid}
                  onClick={() => escolher(f.uid)}
                  className={`cursor-pointer hover:bg-neutral-50 ${f.uid === uid ? 'bg-liberty/5' : ''}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-neutral-900">{f.nome}</p>
                    <p className="text-xs text-neutral-500">{f.email}</p>
                  </td>
                  <td className="px-4 py-3 font-mono">{formatarMinutos(f.jornadaMin)}</td>
                  <td className="px-4 py-3">
                    {t?.diasCompletos ?? 0}
                    {!!t?.diasIncompletos && (
                      <StatusBadge tone="warning" className="ml-2">{t.diasIncompletos} incompleto(s)</StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">{formatarMinutos(t?.trabalhadoMin ?? 0)}</td>
                  <td className={`px-4 py-3 font-mono font-semibold ${tomSaldo(t?.saldoMin ?? 0)}`}>
                    {formatarMinutos(t?.saldoMin ?? 0, true)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        setJornadaTxt(formatarMinutos(f.jornadaMin).replace('h', ':').padStart(5, '0'))
                        setJornadaUid(f.uid)
                      }}
                    >
                      Jornada
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {folha.funcionarios.length === 0 && <EmptyState title="Nenhum funcionário encontrado." />}
      </div>

      {func ? (
        <Card className="overflow-hidden">
          <p className="border-b border-neutral-100 px-4 py-2 text-xs text-neutral-500">
            <IconMapPin className="mr-1 inline h-3 w-3 text-sky-600" />
            ponto digital (com localização) · <b className="text-amber-600">M</b> lançado ou corrigido pelo ADM · sem
            marca: QR code
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
            <h2 className="text-lg font-bold text-neutral-900">{func.nome}</h2>
            <p className="text-sm text-neutral-600">
              Total no mês: <b className="font-mono">{formatarMinutos(totalSel?.trabalhadoMin ?? 0)}</b> · Saldo:{' '}
              <b className={`font-mono ${tomSaldo(totalSel?.saldoMin ?? 0)}`}>
                {formatarMinutos(totalSel?.saldoMin ?? 0, true)}
              </b>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wider text-neutral-700">
                <tr>
                  <th className="px-4 py-2">Dia</th>
                  {BATIDAS.map((b) => (
                    <th key={b} className="px-4 py-2">{BATIDA_LABEL[b]}</th>
                  ))}
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {diasDoMes(mes).map((data) => {
                  const r = porData.get(data)
                  const trab = r ? minutosTrabalhados(r.batidas) : null
                  const saldo = r ? saldoDia(r.batidas, r.jornadaMin) : null
                  const algumaBatida = !!r && BATIDAS.some((b) => r.batidas[b])
                  const futuro = data > hoje
                  return (
                    <tr key={data} className={ehFimDeSemana(data) ? 'bg-neutral-50/60' : ''}>
                      <td className="whitespace-nowrap px-4 py-2 font-medium text-neutral-700">{rotuloDia(data)}</td>
                      {BATIDAS.map((b) => {
                        const iso = r?.batidas[b]
                        return (
                          <td key={b} className="px-4 py-2">
                            {futuro ? (
                              <span className="text-neutral-300">—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => abrirEdicao(data, b)}
                                className="group inline-flex min-w-14 cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 font-mono hover:bg-liberty/10"
                                title="Lançar ou corrigir"
                              >
                                {iso ? horaSP(iso) : <span className="text-neutral-300">—</span>}
                                {iso && r?.origens[b] === 'digital' && (
                                  <IconMapPin
                                    className="h-3 w-3 text-sky-600"
                                    aria-label={`Ponto digital, a ${r.distancias[b] ?? '?'} m da empresa`}
                                  />
                                )}
                                {iso && r?.origens[b] === 'manual' && (
                                  <span className="text-[10px] font-bold text-amber-600" title="Lançado/corrigido pelo ADM">M</span>
                                )}
                                <IconPencil className="h-3 w-3 text-neutral-400 opacity-0 group-hover:opacity-100" />
                              </button>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-2 font-mono font-bold">
                        {trab !== null ? formatarMinutos(trab) : algumaBatida ? <StatusBadge tone="warning">Incompleto</StatusBadge> : '—'}
                      </td>
                      <td className={`px-4 py-2 font-mono ${saldo !== null ? tomSaldo(saldo) : ''}`}>
                        {saldo !== null ? formatarMinutos(saldo, true) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <p className="text-sm text-neutral-500">Clique em um funcionário para ver o dia a dia e corrigir batidas.</p>
      )}

      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title={editando ? `${BATIDA_LABEL[editando.campo]} — ${rotuloDia(editando.data)}` : ''}
        description="Deixe o horário vazio para apagar a batida. Toda alteração fica registrada."
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600">Horário (Brasília)</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600">Motivo (obrigatório)</label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={300}
              placeholder="Ex.: esqueceu de bater na saída"
              className={inputCls}
            />
          </div>
          {!!registroEditando?.edicoes.length && (
            <div className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-600">
              <p className="mb-1 font-semibold">Histórico do dia</p>
              <ul className="space-y-1">
                {registroEditando.edicoes.map((e, i) => (
                  <li key={i}>
                    {BATIDA_LABEL[e.campo]}: {e.de ? horaSP(e.de) : '—'} → {e.para ? horaSP(e.para) : 'apagada'} por{' '}
                    {e.porEmail} ({e.motivo})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button variant="liberty" loading={salvando} onClick={confirmarEdicao}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!jornadaUid}
        onClose={() => setJornadaUid(null)}
        title="Jornada diária"
        description="Horas esperadas por dia. Vale para os dias ainda sem registro; dias já registrados mantêm a jornada da época."
        size="sm"
      >
        <div className="space-y-3">
          <input type="time" value={jornadaTxt} onChange={(e) => setJornadaTxt(e.target.value)} className={inputCls} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setJornadaUid(null)}>Cancelar</Button>
            <Button variant="liberty" loading={salvando} onClick={confirmarJornada}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
