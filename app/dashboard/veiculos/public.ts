// Módulo separado (sem 'use server') para o mapeamento público de veículos.
// `actions.ts` tem 'use server', onde toda função exportada precisa ser
// async (vira Server Action) — um mapeador síncrono como este não pode
// viver lá.
import { VENDIDO_TTL_DIAS } from '@/constants/veiculos'
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
  /**
   * Instante (ISO) em que o veículo foi marcado como vendido, ou `null`.
   * Quando preenchido, o veículo aparece na seção "Vendidos" do site (por até
   * `VENDIDO_TTL_DIAS` dias) em vez do estoque normal.
   */
  vendidoEm: string | null
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

/**
 * Estado do veículo no estoque, do ponto de vista do que o site mostra.
 * Derivado de `publico` + `vendidoEm` — não é um campo persistido.
 * `vendido` vence: um veículo marcado como vendido aparece na vitrine de
 * vendidos mesmo que estivesse privado.
 */
export type EstoqueEstado = 'disponivel' | 'vendido' | 'privado'

export function estoqueEstadoDe(v: {
  publico: boolean
  vendidoEm: string | null
}): EstoqueEstado {
  if (v.vendidoEm) return 'vendido'
  return v.publico ? 'disponivel' : 'privado'
}

/**
 * `true` enquanto um veículo vendido ainda deve aparecer na seção "Vendidos"
 * do site — isto é, foi marcado como vendido há no máximo `VENDIDO_TTL_DIAS`.
 * Depois disso o cron `limpar-vendidos` apaga o registro; este guard cobre a
 * janela entre o vencimento e a próxima execução do cron.
 */
export function vendidoVisivel(
  vendidoEm: string | null | undefined,
  agora: number = Date.now(),
): boolean {
  if (!vendidoEm) return false
  const t = new Date(vendidoEm).getTime()
  return Number.isFinite(t) && agora - t <= VENDIDO_TTL_DIAS * 86_400_000
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
    vendidoEm: v.vendidoEm,
    terceiro: v.terceiro,
    cidadeTerceiro: v.terceiro ? v.terceiroInfo?.cidade || null : null,
    estadoTerceiro: v.terceiro ? v.terceiroInfo?.estado || null : null,
  }
}
