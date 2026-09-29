// Ponte entre uma linha da prospecção e o formulário de nova proposta
// (/dashboard/propostas/nova). As checagens espelham os campos obrigatórios
// do validateForm de CadastrarPropostaClient: se algo faltar aqui, a aba
// pede antes de abrir o formulário.

import { validarCPF } from '@/utils/validadorCpf'
import { maskCPFCNPJ, maskPhone, moneyFromNumber, onlyDigits } from '@/utils/masks'
import { sugerirBancoPorNome } from '@/constants/bancos'
import type { ProspeccaoInput } from './types'

/** Campos da prospecção que o formulário da proposta exige. */
export type CampoPendente = 'cpfCnpj' | 'telefone1' | 'email' | 'veiculo'

export const CAMPO_PENDENTE_LABEL: Record<CampoPendente, string> = {
  cpfCnpj: 'CPF',
  telefone1: 'Telefone (com DDD)',
  email: 'E-mail',
  veiculo: 'Veículo (marca e modelo)',
}

export function emailValido(email: string): boolean {
  const e = email.trim()
  return e.includes('@') && e.includes('.')
}

/** Primeiro telefone com DDD entre os três da planilha. */
export function telefoneValido(p: Pick<ProspeccaoInput, 'telefone1' | 'telefone2' | 'telefone3'>): string | null {
  for (const t of [p.telefone1, p.telefone2, p.telefone3]) {
    if (onlyDigits(t).length >= 10) return t
  }
  return null
}

/** "FIAT PALIO ATTRACTIVE 1.4" → marca FIAT, modelo PALIO ATTRACTIVE 1.4. */
export function separarMarcaModelo(veiculo: string): { marca: string; modelo: string } {
  const partes = veiculo.trim().split(/\s+/)
  return { marca: partes[0] ?? '', modelo: partes.slice(1).join(' ') }
}

/** O que falta para abrir a proposta, com o motivo de cada campo. */
export function pendenciasParaProposta(p: ProspeccaoInput): { campo: CampoPendente; motivo: string }[] {
  const out: { campo: CampoPendente; motivo: string }[] = []
  const cpf = onlyDigits(p.cpfCnpj)
  if (!cpf) out.push({ campo: 'cpfCnpj', motivo: 'Não informado.' })
  else if (!validarCPF(cpf)) {
    out.push({
      campo: 'cpfCnpj',
      motivo: cpf.length > 11 ? 'A proposta aceita apenas CPF (não CNPJ).' : 'CPF inválido.',
    })
  }
  if (!telefoneValido(p)) out.push({ campo: 'telefone1', motivo: 'Nenhum telefone com DDD.' })
  if (!p.email) out.push({ campo: 'email', motivo: 'Não informado.' })
  else if (!emailValido(p.email)) out.push({ campo: 'email', motivo: 'E-mail inválido.' })
  const { marca, modelo } = separarMarcaModelo(p.veiculo)
  if (!marca || !modelo) {
    out.push({ campo: 'veiculo', motivo: 'Informe marca e modelo (ex.: FIAT PALIO 1.4).' })
  }
  return out
}

/** Valores iniciais (já mascarados) do formulário de nova proposta. */
export interface PropostaPrefill {
  nome: string
  cpf: string
  telefone: string
  email: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: string
  veiculo_placa: string
  banco: string
  valor_parcela: string
  parcelas_totais: string
  parcelas_pagas: string
}

export function prospeccaoParaProposta(p: ProspeccaoInput): PropostaPrefill {
  const { marca, modelo } = separarMarcaModelo(p.veiculo)
  // "2013/2014" → ano modelo 2014 (último ano de 4 dígitos).
  const anos = p.anoModelo.match(/\d{4}/g)
  return {
    nome: p.nomeExecutado,
    cpf: maskCPFCNPJ(p.cpfCnpj),
    telefone: maskPhone(telefoneValido(p) ?? ''),
    email: p.email,
    veiculo_marca: marca,
    veiculo_modelo: modelo,
    veiculo_ano: anos ? anos[anos.length - 1] : '',
    // Com placa, o formulário da proposta busca marca/modelo/FIPE sozinho.
    veiculo_placa: p.placa,
    banco: sugerirBancoPorNome(p.banco)?.nome ?? p.banco,
    valor_parcela: moneyFromNumber(p.valorParcela),
    parcelas_totais: p.parcelasContrato != null ? String(p.parcelasContrato) : '',
    parcelas_pagas: p.parcelasPagas != null ? String(p.parcelasPagas) : '',
  }
}
