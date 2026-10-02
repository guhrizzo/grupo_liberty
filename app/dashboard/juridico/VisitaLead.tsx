'use client'

import { useState } from 'react'
import { IconCheck, IconTrash } from '@tabler/icons-react'
import { Button, Input, Modal, Textarea, useToast } from '@/app/components/ui'
import { formatDate, formatDateTime } from '@/utils/format'
import { excluirVisita, registrarVisita } from './prospeccao-actions'
import {
  OBSERVACAO_MAX,
  RESULTADOS_VISITA,
  hojeLocal,
  rotuloResultado,
  tomResultado,
} from './prospeccao-visita'
import type { Prospeccao, ResultadoVisita, VisitaLead } from './types'

/** Selo colorido com o resultado da visita. */
export function SeloVisita({ resultado }: { resultado: ResultadoVisita }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tomResultado(resultado)}`}
    >
      {rotuloResultado(resultado)}
    </span>
  )
}

/** Data de retorno; vencida ou hoje fica em destaque. */
export function DataRetorno({ data }: { data: string }) {
  const hoje = hojeLocal()
  const vencido = data < hoje
  const ehHoje = data === hoje
  return (
    <span
      className={
        vencido || ehHoje
          ? 'font-semibold text-amber-700 adobe-dark:text-amber-300'
          : 'text-neutral-700 adobe-dark:text-adobe-text-md'
      }
      title={vencido ? 'Retorno atrasado' : ehHoje ? 'Retornar hoje' : undefined}
    >
      {formatDate(data)}
      {vencido ? ' · atrasado' : ehHoje ? ' · hoje' : ''}
    </span>
  )
}

/** Resumo da última visita (tabela e cartão). */
export function UltimaVisita({ p }: { p: Prospeccao }) {
  const v = p.visitas[0]
  if (!v) return <span className="text-neutral-400">Sem visita</span>
  return (
    <div className="flex flex-col items-start gap-0.5">
      <SeloVisita resultado={v.resultado} />
      <span className="text-[11px] text-neutral-500">
        {formatDate(v.data)}
        {v.vendedorNome ? ` · ${v.vendedorNome}` : ''}
        {p.visitas.length > 1 ? ` · ${p.visitas.length} visitas` : ''}
      </span>
    </div>
  )
}

/**
 * Modal do lead: checklist para registrar o resultado da visita e o histórico.
 */
export function VisitasModal({
  lead,
  onClose,
  onAtualizado,
  usuarioUid,
  podeExcluirTodas,
}: {
  lead: Prospeccao | null
  onClose: () => void
  onAtualizado: (p: Prospeccao) => void
  usuarioUid: string
  /** ADM supremo exclui visita de qualquer vendedor. */
  podeExcluirTodas: boolean
}) {
  const toast = useToast()
  const [resultado, setResultado] = useState<ResultadoVisita | null>(null)
  const [data, setData] = useState(hojeLocal)
  const [retornoEm, setRetornoEm] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null)

  function limpar() {
    setResultado(null)
    setData(hojeLocal())
    setRetornoEm('')
    setObservacao('')
    setConfirmarExclusao(null)
  }

  function fechar() {
    limpar()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!lead) return
    if (!resultado) {
      toast.error('Escolha o resultado da visita.')
      return
    }
    setSalvando(true)
    try {
      const res = await registrarVisita(lead.id, { resultado, data, retornoEm, observacao })
      if (res.error || !res.prospeccao) {
        toast.error(res.error || 'Não foi possível registrar a visita.')
        return
      }
      toast.success(res.success || 'Visita registrada.')
      onAtualizado(res.prospeccao)
      limpar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleExcluir(v: VisitaLead) {
    if (!lead) return
    setSalvando(true)
    try {
      const res = await excluirVisita(lead.id, v.id)
      if (res.error || !res.prospeccao) {
        toast.error(res.error || 'Não foi possível excluir a visita.')
        return
      }
      toast.success(res.success || 'Visita excluída.')
      onAtualizado(res.prospeccao)
      setConfirmarExclusao(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={!!lead}
      onClose={fechar}
      title={lead ? `Visitas · ${lead.nomeExecutado}` : 'Visitas'}
      size="lg"
      className="max-h-[90vh] overflow-y-auto"
    >
      {lead && (
        <div className="space-y-5 pt-1">
          {lead.endereco && (
            <p className="text-xs text-neutral-500">
              <span className="font-semibold text-neutral-700 adobe-dark:text-adobe-text-md">Endereço: </span>
              {lead.endereco}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500 adobe-dark:text-adobe-text-lo">
                Resultado da visita *
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {RESULTADOS_VISITA.map((r) => {
                  const marcado = resultado === r.value
                  return (
                    <label
                      key={r.value}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        marcado
                          ? 'border-liberty-deep bg-liberty/10 font-semibold text-neutral-900 adobe-dark:text-adobe-text-hi'
                          : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 adobe-dark:border-adobe-line adobe-dark:text-adobe-text-md adobe-dark:hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resultado-visita"
                        value={r.value}
                        checked={marcado}
                        onChange={() => setResultado(r.value)}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          marcado
                            ? 'border-liberty-deep bg-liberty-deep text-white'
                            : 'border-neutral-300 bg-white adobe-dark:border-adobe-line adobe-dark:bg-adobe-bg-1'
                        }`}
                      >
                        {marcado && <IconCheck size={14} stroke={3} />}
                      </span>
                      {r.label}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Data da visita"
                type="date"
                value={data}
                max={hojeLocal()}
                onChange={(e) => setData(e.target.value)}
                required
              />
              {resultado === 'retornar' && (
                <Input
                  label="Retornar em"
                  type="date"
                  value={retornoEm}
                  min={data}
                  onChange={(e) => setRetornoEm(e.target.value)}
                  required
                />
              )}
            </div>

            <Textarea
              label="Observação"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value.slice(0, OBSERVACAO_MAX))}
              placeholder="Ex.: falou com a esposa, voltar no sábado de manhã."
              rows={3}
            />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={fechar} disabled={salvando}>
                Fechar
              </Button>
              <Button type="submit" variant="liberty" disabled={salvando || !resultado}>
                {salvando ? 'Salvando...' : 'Registrar visita'}
              </Button>
            </div>
          </form>

          <section className="border-t border-neutral-200 pt-4 adobe-dark:border-adobe-line">
            <h3 className="mb-2 text-sm font-bold text-neutral-900 adobe-dark:text-adobe-text-hi">
              Histórico de visitas{lead.visitas.length > 0 ? ` (${lead.visitas.length})` : ''}
            </h3>
            {lead.visitas.length === 0 ? (
              <p className="text-xs text-neutral-500">Nenhuma visita registrada ainda.</p>
            ) : (
              <ul className="space-y-2">
                {lead.visitas.map((v) => {
                  const podeExcluir = podeExcluirTodas || v.vendedorUid === usuarioUid
                  return (
                    <li
                      key={v.id}
                      className="rounded-lg border border-neutral-200 px-3 py-2.5 text-xs adobe-dark:border-adobe-line"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <SeloVisita resultado={v.resultado} />
                        <span className="font-semibold text-neutral-800 adobe-dark:text-adobe-text-hi">
                          {formatDate(v.data)}
                        </span>
                        <span className="text-neutral-500">· {v.vendedorNome || 'Usuário'}</span>
                        {podeExcluir &&
                          (confirmarExclusao === v.id ? (
                            <span className="ml-auto inline-flex items-center gap-2">
                              <span className="text-neutral-600">Excluir?</span>
                              <button
                                type="button"
                                onClick={() => handleExcluir(v)}
                                disabled={salvando}
                                className="cursor-pointer font-semibold text-rose-600 hover:underline"
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmarExclusao(null)}
                                className="cursor-pointer font-semibold text-neutral-500 hover:underline"
                              >
                                Não
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmarExclusao(v.id)}
                              aria-label="Excluir visita"
                              title="Excluir visita"
                              className="ml-auto cursor-pointer rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <IconTrash size={13} />
                            </button>
                          ))}
                      </div>
                      {v.retornoEm && (
                        <p className="mt-1 text-neutral-600 adobe-dark:text-adobe-text-md">
                          Retornar em: {formatDate(v.retornoEm)}
                        </p>
                      )}
                      {v.observacao && (
                        <p className="mt-1 whitespace-pre-line break-words text-neutral-700 adobe-dark:text-adobe-text-md">
                          {v.observacao}
                        </p>
                      )}
                      {v.criadoEm && (
                        <p className="mt-1 text-[10px] text-neutral-400">
                          Registrada em {formatDateTime(v.criadoEm)}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
