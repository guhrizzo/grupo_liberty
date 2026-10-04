// Tipos e regras dos modelos de contrato (arquivos em branco para preencher).
// Ficam aqui (não em actions.ts) porque arquivos 'use server' só podem
// exportar funções async — e o client também usa as regras.

export interface ModeloContrato {
  id: string
  nome: string
  fileName: string
  contentType: string
  extensao: string
  size: number
  storagePath: string
  uploadedByUid: string
  uploadedByEmail: string | null
  uploadedAt: string
}

export const MODELO_NOME_MAX = 120
export const MODELO_TAMANHO_MAX = 20 * 1024 * 1024 // 20MB

/** Extensão → content-type aceito. Word para preencher; PDF para consulta. */
export const MODELO_TIPOS: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
}

export const MODELO_ACCEPT = Object.keys(MODELO_TIPOS)
  .map((e) => `.${e}`)
  .join(',')

export function extensaoDoArquivo(nome: string): string | null {
  const m = nome.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m && MODELO_TIPOS[m[1]] ? m[1] : null
}

export type ModeloResponse = { success: string; modelo: ModeloContrato } | { error: string }
