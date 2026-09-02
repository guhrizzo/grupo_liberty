export type ContratoStatus = 'ativo' | 'cancelado'

// ─── Categorias de contrato ─────────────────────────────────────────────────
// Cada contrato anexado a um veículo tem um tipo (categoria). Há 6 categorias
// fixas do sistema (`fixa: true`, não editáveis) semeadas na 1ª leitura, e o
// admin pode criar categorias custom via "Outros". Ver
// app/dashboard/contratos/categorias.actions.ts.

export interface ContratoCategoria {
  id: string
  nome: string
  slug: string
  fixa: boolean
  ordem: number
  criadoPorUid: string | null
  criadoEm: string
}

export const CATEGORIAS_CONTRATO_FIXAS: { slug: string; nome: string; ordem: number }[] = [
  { slug: 'prestacao-de-servico', nome: 'Prestação de Serviço', ordem: 1 },
  { slug: 'venda-de-veiculo-financiado', nome: 'Venda de veículo financiado', ordem: 2 },
  { slug: 'locacao-de-veiculo', nome: 'Locação de veículo', ordem: 3 },
  { slug: 'locacao-com-venda-de-veiculo', nome: 'Locação com venda de veículo', ordem: 4 },
  { slug: 'financiamento-do-cliente', nome: 'Financiamento do cliente', ordem: 5 },
  { slug: 'crlv', nome: 'CRLV', ordem: 6 },
]

export interface Contrato {
  id: string
  veiculoId: string
  veiculoResumo: string
  veiculoMarca: string
  veiculoModelo: string
  veiculoAno: number | null
  veiculoPlaca: string | null
  veiculoChassi: string | null
  veiculoCor: string | null
  veiculoQuilometragem: number | null
  veiculoLocalizacao: string | null
  clienteNome: string
  clienteCpfCnpj: string
  clienteEndereco: string
  clienteEmail: string | null
  clienteTelefone: string | null
  valor: number
  formaPagamento: string
  dataEmissao: string
  clausulasExtras: string
  observacoesInternas: string
  status: ContratoStatus
  categoriaId: string | null
  categoriaNome: string | null
  storagePath: string
  criadoPorUid: string
  criadoPorEmail: string | null
  criadoEm: string
  atualizadoEm: string
}

export interface ContratoInput {
  veiculoId: string
  clienteNome: string
  clienteCpfCnpj: string
  clienteEndereco: string
  clienteEmail?: string | null
  clienteTelefone?: string | null
  valor: number
  formaPagamento: string
  clausulasExtras?: string
  observacoesInternas?: string
}

export type ContratoResponse = {
  success?: string
  error?: string
  contrato?: Contrato
}
