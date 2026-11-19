'use client'

import { useEffect, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconFileDownload, IconTrash } from '@tabler/icons-react'
import { Button, ConfirmDialog, Input, useToast } from '@/app/components/ui'
import { maskCPFCNPJ } from '@/utils/masks'
import { baixarPdf } from '../baixar-pdf'
import { baixarReciboAction, excluirReciboAction, listarRecibosAction } from './actions'
import type { ReciboRegistro } from './types'

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
/** "2026-11-19" → "19/11/2026" */
const dataCurta = (iso: string) => iso.split('-').reverse().join('/')

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
function rotuloMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return a && m ? `${MESES[m - 1]} de ${a}` : ''
}
function deslocar(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Histórico de recibos gerados, por mês de pagamento. `recarregar` muda quando um novo recibo é gerado. */
export default function HistoricoRecibos({ recarregar, podeExcluir }: { recarregar: number; podeExcluir: boolean }) {
  const toast = useToast()
  const [mes, setMes] = useState('')
  const [recibos, setRecibos] = useState<ReciboRegistro[] | null>(null)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<ReciboRegistro | null>(null)
  const [apagando, setApagando] = useState(false)
  const [versao, setVersao] = useState(0)

  // Mês inicial = o atual (fuso do navegador), depois da montagem para não divergir na hidratação.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const d = new Date()
      setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!mes) return
    let vivo = true
    listarRecibosAction(mes).then((res) => {
      if (!vivo) return
      if ('error' in res) {
        toast.error(res.error, 'Histórico')
        setRecibos([])
      } else {
        setRecibos(res.recibos)
      }
    })
    return () => {
      vivo = false
    }
  }, [mes, recarregar, versao, toast])

  async function baixar(id: string) {
    setBaixando(id)
    const res = await baixarReciboAction(id)
    setBaixando(null)
    if ('error' in res) {
      toast.error(res.error, 'Não foi possível baixar')
      return
    }
    baixarPdf(res.pdfBase64, res.fileName)
  }

  async function excluir() {
    if (!excluindo) return
    setApagando(true)
    const res = await excluirReciboAction(excluindo.id)
    setApagando(false)
    if ('error' in res) {
      toast.error(res.error, 'Não foi possível excluir')
      return
    }
    toast.success(res.success)
    setExcluindo(null)
    setVersao((n) => n + 1)
  }

  const total = (recibos ?? []).reduce((s, r) => s + r.valor, 0)

  return (
    <section aria-label="Histórico de recibos" className="space-y-3 rounded-xl border border-neutral-200 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">Histórico de recibos</p>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" aria-label="Mês anterior" disabled={!mes} onClick={() => mes && setMes(deslocar(mes, -1))}>
            <IconChevronLeft size={16} />
          </Button>
          <Input id="rc-hist-mes" aria-label="Mês do histórico" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
          <Button variant="ghost" aria-label="Próximo mês" disabled={!mes} onClick={() => mes && setMes(deslocar(mes, 1))}>
            <IconChevronRight size={16} />
          </Button>
        </div>
      </div>

      {recibos === null ? (
        <p className="text-sm text-neutral-500">Carregando…</p>
      ) : recibos.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum recibo em {rotuloMes(mes)}.</p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            {recibos.length} {recibos.length === 1 ? 'recibo' : 'recibos'} em {rotuloMes(mes)} · total recebido{' '}
            <span className="font-bold text-neutral-900">{reais(total)}</span>
          </p>
          <ul className="divide-y divide-neutral-100">
            {recibos.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-900">{r.pagadorNome}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {dataCurta(r.data)} · {r.veiculoResumo} {r.placa && `(${r.placa})`}
                    {r.forma ? ` · ${r.forma}` : ''}
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    {maskCPFCNPJ(r.pagadorDocumento)}
                    {r.valorTotal !== null ? (r.valorTotal > r.valor ? ` · parcial de ${reais(r.valorTotal)}` : ' · integral') : ''}
                    {r.geradoPor ? ` · por ${r.geradoPor}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold text-neutral-900">{reais(r.valor)}</span>
                  <Button variant="ghost" leftIcon={<IconFileDownload size={14} />} loading={baixando === r.id} loadingLabel="Gerando..." onClick={() => baixar(r.id)}>
                    PDF
                  </Button>
                  {podeExcluir && (
                    <Button variant="ghost" aria-label={`Excluir recibo de ${r.pagadorNome}`} title="Excluir recibo" onClick={() => setExcluindo(r)}>
                      <IconTrash size={16} />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={!!excluindo}
        onClose={() => !apagando && setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir recibo?"
        tone="danger"
        confirmLabel="Excluir"
        loading={apagando}
        description={
          excluindo && (
            <>
              Recibo de <strong>{excluindo.pagadorNome}</strong> de {reais(excluindo.valor)} ({dataCurta(excluindo.data)}) será removido do
              histórico. Não dá para desfazer. Se ele foi guardado nos documentos do veículo, essa cópia continua lá.
            </>
          )
        }
      />
    </section>
  )
}
