// Tipos e helpers puros do módulo de Anúncios de terceiros.
//
// Separado de `actions.ts` (que tem 'use server', onde toda export precisa ser
// uma async Server Action) — mesmo motivo de `app/dashboard/veiculos/public.ts`.
// Nada aqui importa firebase-admin / node:crypto, então pode ser usado tanto no
// servidor quanto no client (lista, filtros, modal de revisão).

import { CAMBIO_VALUES, COMBUSTIVEL_VALUES } from '@/utils/veiculos/opcoes'

export type AnuncioStatus = 'pendente' | 'recusado' | 'publicado' | 'no_estoque'

export interface Anuncio {
  id: string
  // Dono do veículo
  nome: string
  /** SEMPRE mascarado na saída de `getAnuncios` (ex.: 123.***.***-09). Nunca cru. */
  cpf: string
  email: string
  telefone: string
  // Veículo anunciado
  marca: string
  modelo: string
  ano: number
  cor: string
  cambio: string
  combustivel: string
  quilometragem: number
  precoDesejado: number
  observacoes: string
  placa: string | null
  cidade: string
  estado: string
  fotos: string[]
  // Triagem
  status: AnuncioStatus
  motivoRecusa: string | null
  veiculoId: string | null
  created_at: string
  updated_at: string
  decididoPor: string | null
  decididoEm: string | null
}

/**
 * Dados editáveis na tela de revisão antes de aprovar um anúncio. A partir
 * daqui a triagem cria o documento em `veiculos`.
 */
export interface RevisaoVeiculo {
  marca: string
  modelo: string
  ano: number
  cor: string
  cambio: string
  combustivel: string
  quilometragem: number
  /** Preço de venda no estoque (R$). */
  preco: number
  descricao: string
  placa: string | null
  /** 'Jaú/SP' (padrão) ou 'Bauru/SP'. */
  localizacao: string
  /** Subconjunto e ordem das fotos do anúncio a levar pro veículo. */
  fotos: string[]
}

export const ANUNCIO_STATUS_LABEL: Record<AnuncioStatus, string> = {
  pendente: 'Pendente',
  recusado: 'Recusado',
  publicado: 'Publicado no site',
  no_estoque: 'No estoque',
}

export const ANUNCIO_STATUS_TONE: Record<AnuncioStatus, string> = {
  pendente: 'bg-amber-50 text-amber-800 border-amber-200',
  recusado: 'bg-rose-50 text-rose-800 border-rose-200',
  publicado: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  no_estoque: 'bg-sky-50 text-sky-800 border-sky-200',
}

export const LOCALIZACOES_VEICULO = ['Jaú/SP', 'Bauru/SP'] as const

const ANO_MIN = 1900
const anoMax = () => new Date().getFullYear() + 1

/**
 * Valida os dados da revisão antes de aprovar. `fotosDisponiveis` são as URLs
 * do anúncio — a revisão só pode escolher um subconjunto delas.
 * Retorna a primeira mensagem de erro, ou `null` se estiver tudo certo.
 */
export function validarRevisaoVeiculo(
  dados: RevisaoVeiculo,
  fotosDisponiveis: string[],
): string | null {
  if (!dados.marca?.trim()) return 'Informe a marca.'
  if (!dados.modelo?.trim()) return 'Informe o modelo.'
  if (!Number.isInteger(dados.ano) || dados.ano < ANO_MIN || dados.ano > anoMax()) {
    return `Ano deve estar entre ${ANO_MIN} e ${anoMax()}.`
  }
  if (!dados.cor?.trim()) return 'Informe a cor.'
  if (!CAMBIO_VALUES.includes(dados.cambio)) return 'Câmbio inválido.'
  if (!COMBUSTIVEL_VALUES.includes(dados.combustivel)) return 'Combustível inválido.'
  if (!Number.isFinite(dados.quilometragem) || dados.quilometragem < 0) {
    return 'Quilometragem inválida.'
  }
  if (!Number.isFinite(dados.preco) || dados.preco <= 0) return 'Informe um preço de venda válido.'
  if (!dados.descricao?.trim()) return 'A descrição não pode ficar vazia.'
  if (!LOCALIZACOES_VEICULO.includes(dados.localizacao as (typeof LOCALIZACOES_VEICULO)[number])) {
    return 'Localização inválida.'
  }
  if (!Array.isArray(dados.fotos) || dados.fotos.length === 0) {
    return 'Selecione ao menos uma foto para o veículo.'
  }
  if (dados.fotos.some((f) => !fotosDisponiveis.includes(f))) {
    return 'Uma das fotos selecionadas não pertence a este anúncio.'
  }
  return null
}
