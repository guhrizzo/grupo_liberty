import {
  iniciarUploadContratoVeiculoAction,
  concluirUploadContratoVeiculoAction,
  type VeiculoContratoResponse,
} from './actions'

interface AnexarContratoParams {
  veiculoId: string
  file: File
  categoriaId: string
  descricao?: string | null
  enviarJuridico?: boolean
}

/**
 * Anexa um PDF de contrato ao veículo enviando o arquivo direto para o
 * Storage (sem passar pela Vercel, que limita o corpo a ~4,5MB). Roda no
 * navegador — ver o fluxo completo em ./actions.ts.
 */
export async function anexarContratoVeiculo({
  veiculoId,
  file,
  categoriaId,
  descricao,
  enviarJuridico,
}: AnexarContratoParams): Promise<VeiculoContratoResponse> {
  const inicio = await iniciarUploadContratoVeiculoAction({
    veiculoId,
    categoriaId,
    fileName: file.name,
    fileType: file.type,
    size: file.size,
  })
  if (inicio.error || !inicio.uploadUrl || !inicio.contratoId) {
    return { error: inicio.error || 'Erro ao preparar o envio do contrato.' }
  }

  try {
    const res = await fetch(inicio.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: file,
    })
    if (!res.ok) {
      return { error: `Falha ao enviar o arquivo (HTTP ${res.status}). Tente novamente.` }
    }
  } catch {
    return { error: 'Falha de conexão ao enviar o arquivo. Tente novamente.' }
  }

  return concluirUploadContratoVeiculoAction({
    veiculoId,
    contratoId: inicio.contratoId,
    categoriaId,
    fileName: file.name,
    descricao: descricao ?? null,
    enviarJuridico: enviarJuridico ?? false,
  })
}
