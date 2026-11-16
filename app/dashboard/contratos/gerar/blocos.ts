// Modelo de documento dos contratos gerados: uma lista de blocos que a prévia
// (HTML em folhas A4) e o PDF desenham da mesma forma.
//
// `**texto**` marca negrito; `[campo]` marca lacuna ainda não preenchida.

export type BlocoContrato =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'secao'; texto: string }
  /** `rotulo` (ex.: "7.4.1.") vira coluna à esquerda, com o texto recuado. */
  | { tipo: 'p'; texto: string; rotulo?: string }
  | { tipo: 'alineas'; itens: string[] }
  | { tipo: 'tabela'; linhas: [string, string][] }
  | { tipo: 'assinaturas'; itens: { nome: string; documento: string; papel: string }[] }

export interface ContratoBlocos {
  titulo: string
  blocos: BlocoContrato[]
}

