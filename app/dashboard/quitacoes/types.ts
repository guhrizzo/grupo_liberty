/** Uma quitação negociada com o banco para um veículo (histórico completo na coleção `quitacoes`). */
export interface Quitacao {
  id: string
  veiculoId: string
  /** Valor negociado para quitar, em reais. */
  valor: number
  /** Data da negociação (YYYY-MM-DD). */
  data: string
  observacao: string
  criadoPorNome: string
  criadoEm: string
}

/** Resumo do veículo para o seletor e a lista. */
export interface VeiculoQuitacaoOpcao {
  id: string
  marca: string
  modelo: string
  ano: number
  placa: string | null
  /** Foto de capa (primeira foto), se houver. */
  foto: string | null
  /** Veículo de fora (cliente que contratou o serviço), cadastrado só para negociar a quitação. */
  terceiro: boolean
  /** Quando entrou no sistema (ISO) — ordena a lista, o mais novo em cima. */
  criadoEm: string
  /** Dados já cadastrados no veículo, usados como sugestão ao preencher a ficha. */
  sugestao: {
    nome: string | null
    cpf: string | null
    endereco: string | null
    banco: string | null
    valorParcela: number | null
  }
}

/** Itens do checklist pós-compra de cada veículo (guardados na ficha, em `checklist`). */
export const CHECKLIST_ITENS = [
  { id: 'rastreador', rotulo: 'Retirar rastreador', grupo: 'pos-compra' },
  { id: 'condutor', rotulo: 'Transferir principal condutor', grupo: 'pos-compra' },
  { id: 'seguro', rotulo: 'Remover seguro prestamista/mista', grupo: 'pos-compra' },
  { id: 'anunciar', rotulo: 'Anunciar no grupo e no site', grupo: 'etapas' },
  { id: 'banco', rotulo: 'Negociar com o banco (após 6 meses em atraso)', grupo: 'etapas' },
  { id: 'quitacao', rotulo: 'Quitação', grupo: 'etapas' },
] as const

export type ChecklistId = (typeof CHECKLIST_ITENS)[number]['id']

/** Meses depois da compra para liberar a negociação com o banco. */
export const CHECKLIST_MESES_BANCO = 6

export interface ChecklistFeito {
  /** YYYY-MM-DD */
  em: string
  porNome: string
}

export type ChecklistFicha = Partial<Record<ChecklistId, ChecklistFeito>>

/** Registro de um item que foi desmarcado, com o motivo de ter voltado um passo. */
export interface ChecklistReabertura {
  item: ChecklistId
  motivo: string
  /** ISO */
  em: string
  porNome: string
}

export const CHECKLIST_MOTIVO_MAX = 300

/** Soma meses a uma data YYYY-MM-DD (devolve YYYY-MM-DD). */
export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.split('-').map(Number)
  const dt = new Date(a, m - 1 + meses, d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Dados do cliente e do financiamento para ligar ao banco. Um por veículo (coleção `quitacao_fichas`). */
export interface FichaQuitacao {
  veiculoId: string
  /** O veículo já foi quitado com o banco. */
  quitado: boolean
  /** YYYY-MM-DD */
  quitadoEm: string | null
  nome: string
  nomePai: string
  nomeMae: string
  cpf: string
  endereco: string
  /** YYYY-MM-DD — a idade é calculada a partir dela. */
  dataNascimento: string
  banco: string
  numeroContrato: string
  /** Data do próximo vencimento da parcela (YYYY-MM-DD). */
  vencimentoParcela: string
  valorParcela: number
  /** Data da compra do veículo (YYYY-MM-DD). */
  dataCompra: string
  /** O que já foi feito do checklist pós-compra. */
  checklist: ChecklistFicha
  /** Itens desmarcados e por quê (mais antigo primeiro). */
  checklistHistorico: ChecklistReabertura[]
}

export type FichaInput = Omit<FichaQuitacao, 'quitado' | 'quitadoEm' | 'checklist' | 'checklistHistorico'>

export interface VeiculoTerceiroInput {
  marca: string
  modelo: string
  ano: number
  placa: string
}

export interface QuitacaoInput {
  veiculoId: string
  /** Valor em reais (já convertido). */
  valor: number
  /** YYYY-MM-DD */
  data: string
  observacao?: string
}

/** Atualização semanal: um novo valor por veículo, todos com a mesma data. */
export interface QuitacaoLoteInput {
  /** YYYY-MM-DD */
  data: string
  itens: { veiculoId: string; valor: number }[]
}

export interface UltimaQuitacao {
  valor: number
  data: string
}

/** Os dois contratos que ficam anexados ao veículo na aba Quitações. */
export type TipoAnexo = 'cliente' | 'servicos'

export const TIPOS_ANEXO: { id: TipoAnexo; label: string }[] = [
  { id: 'cliente', label: 'Contrato do cliente' },
  { id: 'servicos', label: 'Documentos' },
]

export interface AnexoQuitacao {
  veiculoId: string
  tipo: TipoAnexo
  fileName: string
  size: number
  uploadedAt: string
}

export type AnexosPorVeiculo = Record<string, Partial<Record<TipoAnexo, AnexoQuitacao>>>

/** Extensões aceitas → content-type. */
export const ANEXO_TIPOS: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export const ANEXO_TAMANHO_MAX = 10 * 1024 * 1024

export function extensaoAnexo(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return ext in ANEXO_TIPOS ? ext : null
}

export const QUITACAO_OBS_MAX = 300

export const FICHA_TEXTO_MAX = 200
