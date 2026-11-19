// Conteúdo do recibo (textos e valores já formatados), usado pelo PDF (ReciboDocument)
// e pela simulação na tela (ReciboPreview): os dois mostram exatamente o mesmo.
// `[campo]` = lacuna ainda não preenchida (a simulação destaca; o PDF só sai validado).

import { maskCPFCNPJ, onlyDigits } from '@/utils/masks'
import { brl, lacuna, reaisPorExtenso } from '../texto'
import { dataIsoValida, numeroDe } from '../types'
import type { ReciboInput } from './types'

export interface ReciboMontado {
  badge: { texto: string; tom: 'parcial' | 'integral' } | null
  pagador: { nome: string; documento: string; endereco: string; contato: string }
  recebedor: { nome: string; documento: string; endereco: string }
  veiculo: { linha: string; docs: string; placa: string }
  referencia: string
  data: string
  forma: string
  valorRecebido: string
  total: string | null
  saldo: string | null
  declaracao: string
  assinatura: { nome: string; detalhe: string }
  emitidoEm: string
}

/** "2026-11-19" → "19/11/2026" (sem passar por Date, que deslocaria o dia em servidor UTC). */
const dataCurta = (iso: string) => iso.split('-').reverse().join('/')

const emitidoEmTexto = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)

export function montarRecibo(input: ReciboInput, agora: Date): ReciboMontado {
  const { pagador: p, veiculo: v, recebedor: r, pagamento: g } = input

  const valor = numeroDe(g.valor)
  const valorOk = valor > 0
  const total = g.valorTotal.trim() ? numeroDe(g.valorTotal) : null
  const totalOk = total !== null && total > 0
  const saldo = totalOk && valorOk ? Math.max(0, Math.round((total - valor) * 100) / 100) : null

  const doc = onlyDigits(p.documento)
  const rotuloDoc = doc.length === 14 ? 'CNPJ' : 'CPF'
  const nome = p.nome.trim() ? p.nome.trim().toUpperCase() : lacuna('nome do pagador')
  const docTexto = doc ? maskCPFCNPJ(doc) : lacuna('CPF ou CNPJ')
  const data = dataIsoValida(g.data) ? dataCurta(g.data) : lacuna('data')
  const forma = g.forma.trim()
  const referencia = g.referencia.trim() || lacuna('referência')
  const valorTexto = valorOk ? brl(valor) : lacuna('valor')
  const valorExtenso = valorOk ? `${brl(valor)} (${reaisPorExtenso(valor)})` : lacuna('valor')

  const marcaModelo = `${v.marca.trim() || lacuna('marca')} ${v.modelo.trim() || lacuna('modelo')}`
  const veiculoLinha = [marcaModelo, v.ano.trim(), v.cor.trim()].filter(Boolean).join(' · ') + ` · Placa ${v.placa.trim() || lacuna('placa')}`
  const veiculoDocs = [v.chassi.trim() && `Chassi ${v.chassi.trim()}`, v.renavam.trim() && `RENAVAM ${v.renavam.trim()}`].filter(Boolean).join(' · ')

  const contato = [p.telefone.trim(), p.email.trim()].filter(Boolean).join(' · ')
  const respCpf = onlyDigits(r.responsavelCpf)

  return {
    badge:
      totalOk && valorOk
        ? saldo === 0
          ? { texto: 'Pagamento integral', tom: 'integral' }
          : { texto: 'Pagamento parcial', tom: 'parcial' }
        : null,
    pagador: { nome, documento: `${rotuloDoc} nº ${docTexto}`, endereco: p.endereco.trim(), contato },
    recebedor: {
      nome: r.nome.trim() || lacuna('quem recebeu'),
      documento: onlyDigits(r.cnpj) ? `CNPJ nº ${maskCPFCNPJ(r.cnpj)}` : '',
      endereco: r.endereco.trim(),
    },
    veiculo: { linha: veiculoLinha, docs: veiculoDocs, placa: v.placa.trim() || lacuna('placa') },
    referencia,
    data,
    forma,
    valorRecebido: valorTexto,
    total: totalOk ? brl(total as number) : null,
    saldo: saldo !== null ? brl(saldo) : null,
    declaracao: `Declaramos ter recebido de ${nome}, ${rotuloDoc} nº ${docTexto}, na data de ${data}, a importância de ${valorExtenso}${forma ? `, por ${forma}` : ''}, referente a ${referencia}. Este recibo dá quitação apenas do valor aqui descrito.`,
    assinatura: {
      nome: r.responsavel.trim() || r.nome.trim() || lacuna('responsável'),
      detalhe: `${respCpf ? `CPF nº ${maskCPFCNPJ(respCpf)} · ` : ''}RECEBEDOR`,
    },
    emitidoEm: emitidoEmTexto(agora),
  }
}
