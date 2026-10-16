'use client'

import Image from 'next/image'
import Link from 'next/link'
import { IconCar } from '@tabler/icons-react'
import { Button, Modal } from '@/app/components/ui'
import { formatCurrency, formatDate, formatKm } from '@/utils/format'
import { maskPhone, maskPlate } from '@/utils/masks'
import { SEGURO_STATUS, type ResumoSeguro } from '../seguro/types'
import type { UltimaQuitacao } from '../quitacoes/types'
import type { Veiculo } from './actions'
import type { ResumoVeiculo } from './resumo-types'

const STATUS_PROPOSTA = { pendente: 'Pendente', aceito: 'Aceita', recusado: 'Recusada' } as const

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-0">
      <dt className="text-neutral-500">{rotulo}</dt>
      <dd className="text-right font-semibold text-neutral-900">{children}</dd>
    </div>
  )
}

function Bloco({ titulo, href, children }: { titulo: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-500">{titulo}</h4>
        {href && (
          <Link href={href} className="text-xs font-semibold text-liberty-deep underline">
            Abrir aba
          </Link>
        )}
      </div>
      <dl>{children}</dl>
    </section>
  )
}

/**
 * Detalhes do veículo (somente leitura). O que importa vem no topo — foto, preço
 * e situação; o complementar (outras abas) vem abaixo. "Editar" abre o formulário.
 */
export default function VeiculoDetalhesModal({
  veiculo: v,
  resumo,
  seguro,
  quitacao,
  canEdit,
  onEditar,
  onVerFotos,
  onClose,
}: {
  veiculo: Veiculo
  resumo?: ResumoVeiculo
  seguro?: ResumoSeguro
  quitacao?: UltimaQuitacao
  canEdit: boolean
  onEditar: () => void
  onVerFotos: () => void
  onClose: () => void
}) {
  const tels = (v.telefonesAcessoria ?? []).filter(Boolean).map(maskPhone)
  return (
    <Modal open onClose={onClose} title={`${v.marca} ${v.modelo}`}>
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onVerFotos}
            disabled={!(v.fotos?.length > 0)}
            aria-label="Ampliar fotos"
            className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-neutral-100 cursor-zoom-in disabled:cursor-default"
          >
            {v.fotos?.length > 0 ? (
              <Image src={v.fotos[0]} alt={`${v.marca} ${v.modelo}`} fill className="object-cover" sizes="112px" />
            ) : (
              <IconCar size={28} stroke={1.5} className="absolute inset-0 m-auto text-neutral-300" />
            )}
          </button>
          <div className="min-w-0">
            <p className="text-2xl font-black text-neutral-950">{formatCurrency(v.preco)}</p>
            <p className="text-sm text-neutral-500">
              {[v.ano, v.cor, v.placa ? maskPlate(v.placa) : null, v.localizacao || 'Jaú/SP'].filter(Boolean).join(' · ')}
            </p>
            {v.fotos?.length > 0 && (
              <p className="text-xs text-neutral-400">
                {v.fotos.length} {v.fotos.length === 1 ? 'foto' : 'fotos'}
              </p>
            )}
          </div>
        </div>

        <Bloco titulo="Veículo">
          {v.quilometragem != null && <Linha rotulo="Quilometragem">{formatKm(v.quilometragem)}</Linha>}
          {v.banco && <Linha rotulo="Banco">{v.banco}</Linha>}
          {tels.length > 0 && <Linha rotulo="Acessória">{tels.join(', ')}</Linha>}
        </Bloco>

        <Bloco titulo="Quitação" href={`/dashboard/quitacoes?veiculo=${v.id}`}>
          <Linha rotulo="Última">
            {quitacao ? `${formatCurrency(quitacao.valor)} em ${formatDate(quitacao.data)}` : 'Sem registro'}
          </Linha>
        </Bloco>

        {resumo?.proposta && (
          <Bloco titulo="Negociação" href="/dashboard/propostas">
            <Linha rotulo="Última proposta">
              {STATUS_PROPOSTA[resumo.proposta.status]}
              {resumo.proposta.data && ` · ${formatDate(resumo.proposta.data.slice(0, 10))}`}
            </Linha>
            {resumo.proposta.telefone && <Linha rotulo="Telefone">{resumo.proposta.telefone}</Linha>}
          </Bloco>
        )}

        {resumo?.manutencao && (
          <Bloco titulo="Manutenção" href="/dashboard/manutencao">
            <Linha rotulo="Total com baixa">{formatCurrency(resumo.manutencao.total)}</Linha>
            <Linha rotulo="Registros">{resumo.manutencao.quantidade}</Linha>
          </Bloco>
        )}

        {seguro && (
          <Bloco titulo="Seguro" href="/dashboard/seguro">
            <Linha rotulo="Situação">{SEGURO_STATUS.find((o) => o.value === seguro.status)?.label}</Linha>
            {seguro.status !== 'inexistente' && (
              <Linha rotulo="Reembolso previsto">{formatCurrency(seguro.valorPrevisto)}</Linha>
            )}
            {seguro.status === 'cancelado' && (
              <Linha rotulo="Realmente cancelado">{formatCurrency(seguro.valorCancelado)}</Linha>
            )}
          </Bloco>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          {canEdit && (
            <Button type="button" variant="liberty" onClick={onEditar}>
              Editar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
