// Outros custos do veículo que entram no "Custo efetivo total", além do preço de
// aquisição, dos débitos e das manutenções. Cada `chave` é o campo gravado no
// documento do veículo (number | null).

export const CUSTOS_EXTRAS = [
  { chave: 'custoCartorio', label: 'Cartório' },
  { chave: 'custoDocumentacao', label: 'Documentação' },
  { chave: 'custoSeguro', label: 'Seguro' },
  { chave: 'custoOutros', label: 'Outros custos' },
] as const

export type CustoExtraChave = (typeof CUSTOS_EXTRAS)[number]['chave']
