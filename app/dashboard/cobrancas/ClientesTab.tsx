'use client'

import { useMemo, useState } from 'react'
import {
  IconAlertTriangle,
  IconBriefcase,
  IconId,
  IconMail,
  IconMapPin,
  IconPhone,
  IconSearch,
  IconUser,
  IconUsers,
  IconX,
} from '@tabler/icons-react'
import { formatCurrency } from '@/utils/format'
import { maskCPFCNPJ, maskPhone } from '@/utils/masks'
import { chaveCliente, labelEstadoCivil, type ClienteCobranca } from '@/utils/cobrancas/pessoa'
import type { Cobranca } from './actions'

interface ClienteAgrupado {
  chave: string
  nome: string
  email: string | null
  dados: ClienteCobranca | null
  cobrancas: Cobranca[]
}

/** Agrupa as cobranças por cliente (CPF quando há; senão, pelo nome). */
function agruparClientes(cobrancas: Cobranca[]): ClienteAgrupado[] {
  const mapa = new Map<string, ClienteAgrupado>()
  // `cobrancas` vem da mais nova para a mais antiga: a 1ª de cada cliente tem os dados mais recentes.
  for (const c of cobrancas) {
    const chave = chaveCliente(c.clienteNome, c.cliente?.cpf)
    const atual = mapa.get(chave)
    if (!atual) {
      mapa.set(chave, {
        chave,
        nome: c.clienteNome,
        email: c.clienteEmail,
        dados: c.cliente,
        cobrancas: [c],
      })
    } else {
      atual.cobrancas.push(c)
      if (!atual.dados && c.cliente) atual.dados = c.cliente
      if (!atual.email && c.clienteEmail) atual.email = c.clienteEmail
    }
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function Linha({ icon: Icon, children }: { icon: typeof IconUser; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-neutral-700">
      <Icon size={13} stroke={2} className="mt-0.5 shrink-0 text-neutral-400" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

export function ClientesTab({ cobrancas }: { cobrancas: Cobranca[] }) {
  const [busca, setBusca] = useState('')
  const clientes = useMemo(() => agruparClientes(cobrancas), [cobrancas])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return clientes
    const qDigitos = q.replace(/\D/g, '')
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (qDigitos.length >= 3 &&
          ((c.dados?.cpf ?? '').includes(qDigitos) || (c.dados?.telefone ?? '').includes(qDigitos))),
    )
  }, [clientes, busca])

  return (
    <section className="space-y-3">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-neutral-950 md:text-lg">
            Clientes{' '}
            <span className="font-normal text-neutral-400">
              ({filtrados.length}/{clientes.length})
            </span>
          </h2>
          <p className="text-[11px] text-neutral-500">
            Dados cadastrados nas cobranças. Para completar ou corrigir, edite a cobrança do cliente.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <IconSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF ou telefone..."
            className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-8 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
              aria-label="Limpar busca"
            >
              <IconX size={12} stroke={2} />
            </button>
          )}
        </div>
      </header>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
            <IconUsers size={24} stroke={1.5} className="text-neutral-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-700">
            {clientes.length === 0 ? 'Nenhum cliente ainda' : 'Nenhum cliente encontrado'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {filtrados.map((c) => {
            const d = c.dados
            const conjuge = d?.conjuge
            return (
              <li
                key={c.chave}
                className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-liberty/10 text-liberty">
                    <IconUser size={18} stroke={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-neutral-950">{c.nome}</h3>
                    <p className="text-[11px] text-neutral-500">
                      {c.cobrancas.length} cobrança{c.cobrancas.length === 1 ? '' : 's'}
                      {d?.estadoCivil ? ` · ${labelEstadoCivil(d.estadoCivil)}` : ''}
                    </p>
                  </div>
                  {!d && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      <IconAlertTriangle size={11} stroke={2} />
                      Dados incompletos
                    </span>
                  )}
                </div>

                {d && (
                  <div className="space-y-1.5">
                    <Linha icon={IconId}>{maskCPFCNPJ(d.cpf)}</Linha>
                    <Linha icon={IconPhone}>{maskPhone(d.telefone)}</Linha>
                    {c.email && <Linha icon={IconMail}>{c.email}</Linha>}
                    <Linha icon={IconMapPin}>{d.endereco}</Linha>
                    {d.trabalho && <Linha icon={IconBriefcase}>{d.trabalho}</Linha>}
                  </div>
                )}

                {conjuge && (
                  <div className="space-y-1.5 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
                      Cônjuge
                    </p>
                    <Linha icon={IconUser}>{conjuge.nome}</Linha>
                    <Linha icon={IconId}>{maskCPFCNPJ(conjuge.cpf)}</Linha>
                    <Linha icon={IconPhone}>{maskPhone(conjuge.telefone)}</Linha>
                    {conjuge.endereco && <Linha icon={IconMapPin}>{conjuge.endereco}</Linha>}
                    {conjuge.trabalho && <Linha icon={IconBriefcase}>{conjuge.trabalho}</Linha>}
                  </div>
                )}

                <ul className="divide-y divide-neutral-100 border-t border-neutral-100 pt-1">
                  {c.cobrancas.map((cob) => {
                    const atrasada = cob.parcelas.some((p) => p.status === 'atrasado')
                    const quite = cob.parcelas.length > 0 && cob.parcelas.every((p) => p.pago)
                    return (
                      <li key={cob.id} className="flex items-center gap-2 py-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">
                          {cob.veiculoResumo}
                        </span>
                        <span className="shrink-0 text-[11px] text-neutral-500">
                          {cob.numeroParcelas}× · {formatCurrency(cob.valorTotal)}
                        </span>
                        <span
                          className={
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ' +
                            (quite
                              ? 'bg-emerald-50 text-emerald-700'
                              : atrasada
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-neutral-100 text-neutral-600')
                          }
                        >
                          {quite ? 'Quitada' : atrasada ? 'Atrasada' : 'Em dia'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
