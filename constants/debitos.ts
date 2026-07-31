// Débitos principais que um veículo financiado pode ter.
// Cada chave é usada como id canônico no Firestore (`debitosItens[].chave`).
// A ordem definida aqui é respeitada no PDF e na UI.

export interface DebitoItemDefinicao {
  chave: string
  label: string
  /** Texto curto exibido no PDF (linha única). */
  labelPdf: string
  descricao?: string
}

export const DEBITOS: DebitoItemDefinicao[] = [
  {
    chave: 'ipva',
    label: 'IPVA atrasado',
    labelPdf: 'IPVA atrasado',
    descricao: 'Imposto sobre a Propriedade de Veículos Automotores.',
  },
  {
    chave: 'licenciamento',
    label: 'Licenciamento',
    labelPdf: 'Licenciamento',
    descricao: 'Taxa anual obrigatória de licenciamento do veículo.',
  },
  {
    chave: 'multas',
    label: 'Multas',
    labelPdf: 'Multas de trânsito',
    descricao: 'Somatório das multas pendentes vinculadas ao veículo.',
  },
  {
    chave: 'dpvat',
    label: 'DPVAT',
    labelPdf: 'DPVAT',
    descricao: 'Seguro obrigatório de danos pessoais.',
  },
  {
    chave: 'ipva_parcelado',
    label: 'IPVA parcelado',
    labelPdf: 'IPVA parcelado',
    descricao: 'Parcelas pendentes do IPVA do exercício atual.',
  },
  {
    chave: 'arranstamento',
    label: 'Arrastamento / Guincho',
    labelPdf: 'Arrastamento / Guincho',
    descricao: 'Custódia / diárias do pátio após remoção.',
  },
  {
    chave: 'custodia_patio',
    label: 'Custódia em pátio',
    labelPdf: 'Custódia em pátio',
    descricao: 'Diárias acumuladas em pátio.',
  },
  {
    chave: 'debito_renavam',
    label: 'Débitos no RENAVAM',
    labelPdf: 'Débitos no RENAVAM',
    descricao: 'Pendências administrativas junto ao DETRAN.',
  },
  {
    chave: 'outros',
    label: 'Outros débitos',
    labelPdf: 'Outros débitos',
    descricao: 'Outros valores não classificados acima.',
  },
]

export type DebitoValorMap = Record<string, number>

export function getDebitoDefinicao(chave: string): DebitoItemDefinicao | null {
  return DEBITOS.find((d) => d.chave === chave) ?? null
}
