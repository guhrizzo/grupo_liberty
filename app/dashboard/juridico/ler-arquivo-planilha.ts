// Leitura do arquivo da planilha no navegador (.xlsx, .xls e .xml do Excel —
// "Planilha XML 2003"). O SheetJS só é carregado quando o usuário escolhe um
// arquivo, para não pesar no carregamento da página.

import { celulaParaTexto } from './prospeccao-importacao'

export interface AbaPlanilha {
  nome: string
  linhas: string[][]
}

export const EXTENSOES_PLANILHA = '.xlsx,.xls,.xml'

export async function lerArquivoPlanilha(file: File): Promise<AbaPlanilha[]> {
  const erro = new Error('Não foi possível ler o arquivo. Use .xlsx, .xls ou .xml do Excel.')
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
    const abas = wb.SheetNames.map((nome) => {
      const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], {
        header: 1,
        raw: true,
        defval: '',
        blankrows: false,
      })
      return { nome, linhas: linhas.map((l) => l.map(celulaParaTexto)) }
    })
    if (abas.length === 0) throw erro
    return abas
  } catch {
    throw erro
  }
}
