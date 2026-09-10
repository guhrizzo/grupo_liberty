// Módulo separado (sem 'use server') para o mapeamento público de veículos.
// `actions.ts` tem 'use server', onde toda função exportada precisa ser
// async (vira Server Action) — um mapeador síncrono como este não pode
// viver lá.
import type { Veiculo } from './actions'

/**
 * Subconjunto de `Veiculo` seguro para exibição pública (site, visitante
 * anônimo). Exclui CPF, dados do vendedor, financiamento e débitos — campos
 * internos que não devem ser serializados no payload de páginas públicas.
 */
export interface PublicVeiculo {
  id: string
  marca: string
  modelo: string
  ano: number
  cor: string | null
  quilometragem: number | null
  preco: number | null
  precoComDesconto: number | null
  tabelaFipe: number | null
  cambio: string
  combustivel: string
  descricao: string | null
  fotos: string[]
  localizacao: string
  created_at: string
  /** Veículo anunciado por terceiro (dono do carro), não é do estoque próprio da Liberty. */
  terceiro: boolean
  /**
   * Cidade/estado onde o veículo de terceiro realmente está (informados no
   * anúncio) — só quando `terceiro === true`. Nunca inclui o resto de
   * `terceiroInfo` (nome/telefone/e-mail do dono), que é estritamente interno.
   */
  cidadeTerceiro: string | null
  estadoTerceiro: string | null
}

export function toPublicVeiculo(v: Veiculo): PublicVeiculo {
  return {
    id: v.id,
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    cor: v.cor,
    quilometragem: v.quilometragem,
    preco: v.preco,
    precoComDesconto: v.precoComDesconto,
    tabelaFipe: v.tabelaFipe,
    cambio: v.cambio,
    combustivel: v.combustivel,
    descricao: v.descricao,
    fotos: v.fotos,
    localizacao: v.localizacao,
    created_at: v.created_at,
    terceiro: v.terceiro,
    cidadeTerceiro: v.terceiro ? v.terceiroInfo?.cidade || null : null,
    estadoTerceiro: v.terceiro ? v.terceiroInfo?.estado || null : null,
  }
}
