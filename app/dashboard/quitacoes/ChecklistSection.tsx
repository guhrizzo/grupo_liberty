'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Modal, Textarea, useToast } from '@/app/components/ui'
import { formatDate } from '@/utils/format'
import { definirChecklistItem } from './actions'
import {
  CHECKLIST_ITENS,
  CHECKLIST_MESES_BANCO,
  CHECKLIST_MOTIVO_MAX,
  somarMeses,
  type ChecklistFicha,
  type ChecklistId,
  type ChecklistReabertura,
} from './types'

function hojeIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Checklist pós-compra: o que fazer no carro depois de comprado e as próximas etapas. */
export function ChecklistSection({
  veiculoId,
  checklist,
  historico,
  dataCompra,
}: {
  veiculoId: string
  checklist: ChecklistFicha
  historico: ChecklistReabertura[]
  dataCompra: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [salvando, setSalvando] = useState<ChecklistId | null>(null)
  const [reabrindo, setReabrindo] = useState<ChecklistId | null>(null)
  const [motivo, setMotivo] = useState('')
  const dataBanco = dataCompra ? somarMeses(dataCompra, CHECKLIST_MESES_BANCO) : ''
  const feitos = CHECKLIST_ITENS.filter((i) => checklist[i.id]).length

  async function alternar(item: ChecklistId, feito: boolean, motivoReabertura = '') {
    setSalvando(item)
    try {
      const res = await definirChecklistItem(veiculoId, item, feito, motivoReabertura)
      if (res.error) return void toast.error(res.error, 'Não foi possível salvar')
      setReabrindo(null)
      setMotivo('')
      router.refresh()
    } finally {
      setSalvando(null)
    }
  }

  const ultimaReabertura = (item: ChecklistId) => [...historico].reverse().find((h) => h.item === item)
  const itemReabrindo = CHECKLIST_ITENS.find((i) => i.id === reabrindo)

  const grupos = [
    { id: 'pos-compra', titulo: 'Depois da compra' },
    { id: 'etapas', titulo: 'Próximas etapas' },
  ] as const

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">Checklist pós-compra</h4>
        <span className="text-xs font-semibold text-neutral-500">
          {feitos} de {CHECKLIST_ITENS.length}
        </span>
      </div>
      {!dataCompra && (
        <p className="mb-2 text-xs text-neutral-500">
          Preencha a data da compra nos dados do cliente para esses itens aparecerem em Demandas.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {grupos.map((g) => (
          <div key={g.id}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">{g.titulo}</p>
            <ul className="space-y-1">
              {CHECKLIST_ITENS.filter((i) => i.grupo === g.id).map((i) => {
                const feito = checklist[i.id]
                return (
                  <li key={i.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50">
                      <input
                        type="checkbox"
                        checked={!!feito}
                        disabled={salvando === i.id}
                        onChange={(e) => (e.target.checked ? alternar(i.id, true) : setReabrindo(i.id))}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-600"
                      />
                      <span className="min-w-0">
                        <span className={feito ? 'text-neutral-400 line-through' : 'font-semibold text-neutral-900'}>
                          {i.rotulo}
                        </span>
                        {feito && (
                          <span className="block text-xs text-neutral-500">
                            {feito.porNome} · {formatDate(feito.em)}
                          </span>
                        )}
                        {!feito && ultimaReabertura(i.id) && (
                          <span className="block text-xs text-amber-700">
                            Voltou em {formatDate(ultimaReabertura(i.id)!.em.slice(0, 10))} por {ultimaReabertura(i.id)!.porNome}:{' '}
                            {ultimaReabertura(i.id)!.motivo}
                          </span>
                        )}
                        {!feito && i.id === 'banco' && dataBanco && (
                          <span className="block text-xs text-neutral-500">
                            {dataBanco <= hojeIso() ? 'Liberado desde' : 'Libera em'} {formatDate(dataBanco)}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      {reabrindo && (
        <Modal
          open
          onClose={() => salvando === null && (setReabrindo(null), setMotivo(''))}
          title="Por que este item voltou?"
        >
          <div className="mt-4 space-y-4">
            <p className="text-sm text-neutral-500">
              Você está desmarcando &quot;{itemReabrindo?.rotulo}&quot;. Explique o motivo para ficar registrado.
            </p>
            <Textarea
              label="Motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={CHECKLIST_MOTIVO_MAX}
              rows={3}
              placeholder="Ex.: o banco devolveu o documento, falta refazer"
              autoFocus
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => (setReabrindo(null), setMotivo(''))}
                disabled={salvando !== null}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="liberty"
                loading={salvando !== null}
                disabled={!motivo.trim()}
                onClick={() => alternar(reabrindo, false, motivo)}
              >
                Reabrir item
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
