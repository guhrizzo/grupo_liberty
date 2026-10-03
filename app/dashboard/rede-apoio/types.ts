// Tipos serializáveis da rede de apoio. Ficam aqui (não em actions.ts) porque
// arquivos 'use server' só podem exportar funções async.

import type { RedeRelacao } from '@/constants/rede-apoio'

export interface ContatoApoio {
  id: string
  nome: string
  relacao: RedeRelacao
  cidade: string
  uf: string
  telefone: string
  /** Pode receber/guardar um veículo na cidade. */
  podeReceber: boolean
  /** Pode ir ver/vistoriar um veículo na região. */
  podeVistoriar: boolean
  observacoes: string
  criadoPorNome: string
  criadoEm: string
  atualizadoEm: string
}

export interface ContatoApoioInput {
  nome: string
  relacao: string
  cidade: string
  uf: string
  telefone: string
  podeReceber: boolean
  podeVistoriar: boolean
  observacoes: string
}

export type ContatoApoioFieldErrors = Partial<Record<'nome' | 'relacao' | 'cidade' | 'uf' | 'telefone' | 'observacoes', string>>

export type ContatoApoioResponse =
  | { success: string; contato: ContatoApoio }
  | { error: string; fieldErrors?: ContatoApoioFieldErrors }
