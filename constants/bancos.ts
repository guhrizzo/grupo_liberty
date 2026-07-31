// Tabela de Bancos — Quitação, Desconto e CNPJ
// Fonte: PDF de referência "Bancos QUITAÇÃO - DESCONTO" do projeto.
// Quando um banco não possui algum dado, o campo fica `null` e a UI mostra "—".

export interface BancoInfo {
  /** Código único interno (sem espaços). */
  codigo: string
  /** Nome exibido na UI. */
  nome: string
  /** Percentual de quitação (0-100). */
  quitacaoPercent: number | null
  /** Percentual de desconto (0-100). */
  descontoPercent: number | null
  /** Lista de CNPJs (alguns bancos têm mais de um). */
  cnpjs: string[]
}

export const BANCOS: BancoInfo[] = [
  { codigo: 'alfa', nome: 'Alfa', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['17.167.412/0001-13'] },
  { codigo: 'aymore', nome: 'Aymore', quitacaoPercent: 70, descontoPercent: 80, cnpjs: ['07.707.650/0001-10'] },
  { codigo: 'bb', nome: 'Banco do Brasil (BB)', quitacaoPercent: 50, descontoPercent: 60, cnpjs: ['00.000.000/0001-91'] },
  { codigo: 'bmw', nome: 'BMW', quitacaoPercent: 50, descontoPercent: 60, cnpjs: ['04.452.473/0001-80'] },
  { codigo: 'bradesco', nome: 'Bradesco', quitacaoPercent: 70, descontoPercent: 80, cnpjs: ['07.207.996/0001-50'] },
  { codigo: 'bradesco-sa', nome: 'Bradesco S/A', quitacaoPercent: 70, descontoPercent: 80, cnpjs: [] },
  { codigo: 'bv', nome: 'BV Financeira', quitacaoPercent: 70, descontoPercent: 80, cnpjs: ['01.149.953/0001-89'] },
  { codigo: 'caixa', nome: 'Caixa Econômica Federal', quitacaoPercent: 50, descontoPercent: 60, cnpjs: ['00.360.305/0001-04'] },
  { codigo: 'cnh', nome: 'CNH Industrial Capital', quitacaoPercent: null, descontoPercent: null, cnpjs: [] },
  { codigo: 'creditas', nome: 'Creditas', quitacaoPercent: null, descontoPercent: null, cnpjs: [] },

  { codigo: 'c6', nome: 'Banco C6', quitacaoPercent: 40, descontoPercent: 50, cnpjs: [] },
  { codigo: 'hyundai', nome: 'Banco Hyundai', quitacaoPercent: 40, descontoPercent: 50, cnpjs: [] },
  { codigo: 'daycoval', nome: 'Daycoval', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['62.232.889/0001-90'] },
  { codigo: 'digi', nome: 'Digi+', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['92.874.270/0001-40'] },
  { codigo: 'fiat', nome: 'Fiat', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['61.190.658/0001-06'] },
  { codigo: 'finamax', nome: 'Finamax', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['00.411.939/0001-49'] },
  { codigo: 'gm', nome: 'GM / Chevrolet', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['59.274.605/0001-13'] },
  { codigo: 'honda', nome: 'Honda', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['36.342.200/0001-65'] },
  { codigo: 'honda-consorcio', nome: 'Honda Consórcio', quitacaoPercent: 50, descontoPercent: null, cnpjs: [] },
  { codigo: 'hsbc', nome: 'HSBC / Bradesco', quitacaoPercent: 70, descontoPercent: 80, cnpjs: ['01.701.201/0001-89'] },
  { codigo: 'itau', nome: 'Itaú', quitacaoPercent: 70, descontoPercent: 80, cnpjs: ['60.701.190/0001-04'] },
  { codigo: 'itaucard', nome: 'Itaúcard', quitacaoPercent: 70, descontoPercent: 60, cnpjs: ['17.192.451/0001-70'] },
  { codigo: 'mercantil', nome: 'Mercantil', quitacaoPercent: 50, descontoPercent: 60, cnpjs: ['17.184.037/0001-10'] },
  { codigo: 'mercedes', nome: 'Mercedes Bens', quitacaoPercent: 50, descontoPercent: 60, cnpjs: ['60.814.191/0001-57'] },
  { codigo: 'omni', nome: 'Omni', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['92.228.410/0001-02'] },
  { codigo: 'pan', nome: 'Pan', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['59.285.411/0001-13'] },
  { codigo: 'porto-seguro-fin', nome: 'Porto Seguro Financeira', quitacaoPercent: 50, descontoPercent: 60, cnpjs: ['04.862.600/0001-10'] },
  { codigo: 'porto-seguro-cartoes', nome: 'Porto Seguro Cartões', quitacaoPercent: 50, descontoPercent: 60, cnpjs: [] },
  { codigo: 'psa', nome: 'PSA', quitacaoPercent: 70, descontoPercent: 80, cnpjs: ['03.502.961/0001-92'] },
  { codigo: 'rci', nome: 'RCI Brasil / Renault', quitacaoPercent: 70, descontoPercent: 80, cnpjs: ['62.307.848/0001-15'] },
  { codigo: 'renner', nome: 'Renner', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['92.874.270/0001-40'] },
  { codigo: 'safra', nome: 'J. Safra', quitacaoPercent: 50, descontoPercent: 60, cnpjs: ['58.160.789/0001-28', '03.017.677/0001-20'] },
  { codigo: 'santander', nome: 'Santander', quitacaoPercent: 70, descontoPercent: 80, cnpjs: ['90.400.888/0001-42'] },
  { codigo: 'santander-consorcio', nome: 'Santander Consórcio', quitacaoPercent: null, descontoPercent: null, cnpjs: [] },
  { codigo: 'sicredi', nome: 'Sicredi', quitacaoPercent: 50, descontoPercent: 50, cnpjs: ['03.795.072/0001-50'] },
  { codigo: 'sorocred', nome: 'Sorocred', quitacaoPercent: 50, descontoPercent: 60, cnpjs: ['04.814.563/0001-74'] },
  { codigo: 'toyota', nome: 'Toyota', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['03.215.790/0001-10', '02.977.348/0001-69'] },
  { codigo: 'volkswagen', nome: 'Volkswagen', quitacaoPercent: 50, descontoPercent: 60, cnpjs: ['59.109.165/0001-49'] },
  { codigo: 'votorantim-bv', nome: 'Votorantim / BV', quitacaoPercent: 70, descontoPercent: 80, cnpjs: [] },
  { codigo: 'yamaha', nome: 'Yamaha', quitacaoPercent: 60, descontoPercent: 70, cnpjs: ['10.371.492/0001-85'] },
]

const BANCOS_BY_CODIGO: Record<string, BancoInfo> = (() => {
  const map: Record<string, BancoInfo> = {}
  for (const b of BANCOS) {
    if (b && typeof b === 'object' && 'codigo' in b && typeof b.codigo === 'string') {
      map[b.codigo] = b
    }
  }
  return map
})()

export function getBancoByCodigo(codigo: string | null | undefined): BancoInfo | null {
  if (!codigo) return null
  return BANCOS_BY_CODIGO[codigo] ?? null
}

/** Monta a opção de label que vai no dropdown de seleção. */
export function bancoOptionLabel(info: BancoInfo): string {
  const q = info.quitacaoPercent != null ? `${info.quitacaoPercent}%` : '—'
  const d = info.descontoPercent != null ? `${info.descontoPercent}%` : '—'
  return `${info.nome} · Quitação ${q} · Desconto ${d}`
}
