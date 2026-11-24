'use client'

import { useState, useTransition } from 'react'
import { Button, Input, useToast } from '@/app/components/ui'
import { ANEXO_TAMANHO_MAX, extensaoAnexo } from '@/app/dashboard/quitacoes/types'
import { ROTULO_STATUS_RECOMPENSA, resumoFinanceiro, type LinhaRecompensa } from '@/utils/indicacoes/modelo'
import { iniciarUploadComprovante, liberarOuCancelarRecompensa, registrarPagamento } from './actions'

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' })
const dia = (valor: string | null) => {
  if (!valor) return '—'
  return formatoData.format(new Date(valor.length === 10 ? `${valor}T12:00:00-03:00` : valor))
}
const cartao = 'rounded-xl border border-neutral-200 bg-white p-5 shadow-xs'
const hojeLocal = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

export default function FinanceiroRecompensas({ recompensas }: { recompensas: LinhaRecompensa[] }) {
  const resumo = resumoFinanceiro(recompensas)
  const [pagando, setPagando] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [dataPagamento, setDataPagamento] = useState(hojeLocal())
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [motivo, setMotivo] = useState('')
  const [pendente, iniciar] = useTransition()
  const toast = useToast()

  const fechar = () => {
    setPagando(null)
    setCancelando(null)
    setArquivo(null)
    setMotivo('')
    setDataPagamento(hojeLocal())
  }

  function liberar(id: string) {
    iniciar(async () => {
      const r = await liberarOuCancelarRecompensa(id, 'liberar')
      if (r.error) toast.error(r.error)
      else toast.success(r.success ?? 'Feito.')
    })
  }

  function cancelar(id: string) {
    iniciar(async () => {
      const r = await liberarOuCancelarRecompensa(id, 'cancelar', motivo)
      if (r.error) return void toast.error(r.error)
      toast.success(r.success ?? 'Feito.')
      fechar()
    })
  }

  function pagar(id: string) {
    iniciar(async () => {
      let envio: { uploadId: string; fileName: string } | undefined
      if (arquivo) {
        if (!extensaoAnexo(arquivo.name)) return void toast.error('Envie um PDF ou uma imagem (JPG, PNG ou WebP).')
        if (arquivo.size > ANEXO_TAMANHO_MAX) return void toast.error('Arquivo excede o limite de 10MB.')
        const inicio = await iniciarUploadComprovante({ recompensaId: id, fileName: arquivo.name, size: arquivo.size })
        if ('error' in inicio) return void toast.error(inicio.error)
        try {
          const res = await fetch(inicio.uploadUrl, { method: 'PUT', headers: { 'Content-Type': inicio.contentType }, body: arquivo })
          if (!res.ok) return void toast.error(`Falha ao enviar o comprovante (HTTP ${res.status}).`)
        } catch {
          return void toast.error('Falha de conexão ao enviar o comprovante. Tente novamente.')
        }
        envio = { uploadId: inicio.uploadId, fileName: arquivo.name }
      }
      const r = await registrarPagamento({ recompensaId: id, pagaEm: dataPagamento, ...envio })
      if (r.error) return void toast.error(r.error)
      toast.success(r.success ?? 'Pagamento registrado.')
      fechar()
    })
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totais das recompensas">
        {[
          ['Total gerado', resumo.gerado],
          ['Pendente de liberação', resumo.pendente],
          ['Liberado para pagamento', resumo.liberado],
          ['Já pago', resumo.pago],
        ].map(([rotulo, valor]) => (
          <div key={String(rotulo)} className={cartao}>
            <p className="text-sm text-neutral-500">{rotulo}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-950">{moeda.format(Number(valor))}</p>
          </div>
        ))}
      </section>

      <section className={cartao} aria-labelledby="recompensas">
        <h2 id="recompensas" className="font-semibold">Recompensas</h2>
        {recompensas.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Nenhuma recompensa gerada ainda. Elas aparecem quando uma indicação converte.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {recompensas.map((r) => (
              <li key={r.id} className="space-y-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {moeda.format(r.valor)} <span className="font-normal text-neutral-500">· {r.indicadorNome} · {r.ordem}ª indicação ({r.indicadoNome})</span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      {ROTULO_STATUS_RECOMPENSA[r.status]} · gerada em {dia(r.criadoEm)}
                      {r.liberadaEm && ` · liberada em ${dia(r.liberadaEm)}`}
                      {r.pagaEm && ` · paga em ${dia(r.pagaEm)}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.temComprovante && (
                      <a href={`/api/indicacoes/recompensas/${r.id}/comprovante`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50">
                        Ver comprovante
                      </a>
                    )}
                    {r.status === 'pendente' && <Button type="button" size="sm" disabled={pendente} onClick={() => liberar(r.id)}>Liberar para pagamento</Button>}
                    {r.status === 'liberada' && <Button type="button" size="sm" disabled={pendente} onClick={() => { fechar(); setPagando(r.id) }}>Marcar como paga</Button>}
                    {(r.status === 'pendente' || r.status === 'liberada') && (
                      <Button type="button" size="sm" variant="secondary" disabled={pendente} onClick={() => { fechar(); setCancelando(r.id) }}>Cancelar</Button>
                    )}
                  </div>
                </div>

                {pagando === r.id && (
                  <div className="grid gap-3 rounded-lg bg-neutral-50 p-3 sm:grid-cols-2">
                    <Input label="Data do pagamento" type="date" value={dataPagamento} max={hojeLocal()} disabled={pendente} placeholder="AAAA-MM-DD" onChange={(e) => setDataPagamento(e.target.value)} />
                    <label className="block text-sm font-medium">
                      Comprovante (opcional)
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        disabled={pendente}
                        onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                        className="mt-1 block w-full text-sm"
                      />
                      <span className="mt-1 block text-xs font-normal text-neutral-500">PDF, JPG, PNG ou WebP, até 10MB.</span>
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="button" size="sm" loading={pendente} onClick={() => pagar(r.id)}>Confirmar pagamento</Button>
                      <Button type="button" size="sm" variant="secondary" disabled={pendente} onClick={fechar}>Voltar</Button>
                    </div>
                  </div>
                )}

                {cancelando === r.id && (
                  <div className="space-y-3 rounded-lg bg-neutral-50 p-3">
                    <Input label="Motivo do cancelamento" value={motivo} maxLength={200} disabled={pendente} placeholder="Ex.: indicação fraudulenta" onChange={(e) => setMotivo(e.target.value)} />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" loading={pendente} onClick={() => cancelar(r.id)}>Confirmar cancelamento</Button>
                      <Button type="button" size="sm" variant="secondary" disabled={pendente} onClick={fechar}>Voltar</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cartao} aria-labelledby="por-indicador">
          <h2 id="por-indicador" className="font-semibold">Recompensas por cliente indicador</h2>
          {resumo.porIndicador.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Sem dados ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100 text-sm">
              {resumo.porIndicador.map((p) => (
                <li key={p.documento} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{p.nome} <span className="text-neutral-500">· {p.quantidade} recompensa{p.quantidade === 1 ? '' : 's'}</span></span>
                  <span className="font-medium">{moeda.format(p.total)} <span className="font-normal text-neutral-500">({moeda.format(p.pago)} pagos)</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cartao} aria-labelledby="historico-pagamentos">
          <h2 id="historico-pagamentos" className="font-semibold">Histórico de pagamentos</h2>
          {resumo.pagamentos.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Nenhum pagamento registrado.</p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100 text-sm">
              {resumo.pagamentos.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{dia(p.pagaEm)} · {p.indicadorNome}</span>
                  <span className="font-medium">{moeda.format(p.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
