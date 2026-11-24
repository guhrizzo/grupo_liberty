'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { adminStorage } from '@/utils/firebase/admin'
import { ANEXO_TAMANHO_MAX, ANEXO_TIPOS, extensaoAnexo } from '@/app/dashboard/quitacoes/types'
import { getSessionUser, hasPageAccess } from '@/utils/permissions'
import { normalizarConfig, type ConfigIndicacoes } from '@/utils/indicacoes/modelo'
import { gravarConfigIndicacoes, mudarRecompensa, revisarIndicacao } from '@/utils/indicacoes/servidor'

type Resultado = { success?: string; error?: string }

/** As regras de recompensa só mudam com o administrador; a revisão de indicações vale para quem tem acesso à área. */
async function usuario() {
  const user = await getSessionUser()
  return user && hasPageAccess(user, 'indicacoes') ? user : null
}

export async function salvarConfigIndicacoes(entrada: ConfigIndicacoes): Promise<Resultado> {
  const user = await usuario()
  if (!user || user.role !== 'admin') return { error: 'Apenas administradores podem alterar as regras.' }
  const config = normalizarConfig(entrada)
  if (!config) {
    return { error: 'Confira as faixas: começam na 1ª indicação, não podem ter lacunas e a última fica sem limite. Valores não podem ser negativos.' }
  }
  try {
    await gravarConfigIndicacoes(config, user.uid)
  } catch {
    return { error: 'Não foi possível salvar. Tente novamente.' }
  }
  revalidatePath('/dashboard/indicacoes')
  revalidatePath('/area-do-cliente/indicacoes')
  return { success: 'Regras salvas. Valem para as próximas conversões.' }
}

export async function decidirIndicacao(id: string, decisao: 'aprovar' | 'recusar'): Promise<Resultado> {
  const user = await usuario()
  if (!user) return { error: 'Acesso negado.' }
  if (typeof id !== 'string' || !/^cpf_[a-f0-9]{64}$/.test(id) || (decisao !== 'aprovar' && decisao !== 'recusar')) {
    return { error: 'Indicação inválida.' }
  }
  try {
    const status = await revisarIndicacao(id, decisao, user.uid)
    if (!status) return { error: 'Esta indicação não está mais em revisão.' }
  } catch {
    return { error: 'Não foi possível registrar a decisão. Tente novamente.' }
  }
  revalidatePath('/dashboard/indicacoes')
  return { success: decisao === 'aprovar' ? 'Indicação aprovada e convertida.' : 'Indicação recusada.' }
}

// ─── Financeiro das recompensas ────────────────────────────────────────────
// Comprovante: upload direto do navegador para o Storage (limite de corpo da Vercel):
//   1. iniciarUploadComprovante abre uma sessão resumível;
//   2. o navegador faz PUT do arquivo na URL;
//   3. registrarPagamento confere o arquivo, marca a recompensa como paga e guarda o caminho.

const ID_RECOMPENSA = /^cpf_[a-f0-9]{64}$/
const caminhoComprovante = (recompensaId: string, uploadId: string, ext: string) => `indicacoes/comprovantes/${recompensaId}-${uploadId}.${ext}`

function revalidarFinanceiro() {
  revalidatePath('/dashboard/indicacoes')
  revalidatePath('/area-do-cliente/indicacoes')
}

export async function liberarOuCancelarRecompensa(id: string, acao: 'liberar' | 'cancelar', motivo = ''): Promise<Resultado> {
  const user = await usuario()
  if (!user) return { error: 'Acesso negado.' }
  if (!ID_RECOMPENSA.test(String(id)) || (acao !== 'liberar' && acao !== 'cancelar')) return { error: 'Recompensa inválida.' }
  const motivoLimpo = String(motivo ?? '').trim().slice(0, 200)
  if (acao === 'cancelar' && !motivoLimpo) return { error: 'Informe o motivo do cancelamento.' }

  try {
    const resultado = await mudarRecompensa(id, acao, user.uid, { motivo: motivoLimpo })
    if ('erro' in resultado) return { error: resultado.erro }
  } catch {
    return { error: 'Não foi possível atualizar a recompensa. Tente novamente.' }
  }
  revalidarFinanceiro()
  return { success: acao === 'liberar' ? 'Recompensa liberada para pagamento.' : 'Recompensa cancelada.' }
}

export async function iniciarUploadComprovante(input: { recompensaId: string; fileName: string; size: number }):
  Promise<{ error: string } | { uploadId: string; uploadUrl: string; contentType: string }> {
  const user = await usuario()
  if (!user) return { error: 'Acesso negado.' }
  const ext = extensaoAnexo(String(input?.fileName ?? ''))
  const size = Number(input?.size)
  if (!ID_RECOMPENSA.test(String(input?.recompensaId))) return { error: 'Recompensa inválida.' }
  if (!ext) return { error: 'Envie um PDF ou uma imagem (JPG, PNG ou WebP).' }
  if (!Number.isFinite(size) || size <= 0) return { error: 'Arquivo vazio.' }
  if (size > ANEXO_TAMANHO_MAX) return { error: 'Arquivo excede o limite de 10MB.' }

  try {
    const uploadId = crypto.randomUUID().replace(/-/g, '')
    const contentType = ANEXO_TIPOS[ext]
    const origin = (await headers()).get('origin') ?? undefined
    const [uploadUrl] = await adminStorage.bucket().file(caminhoComprovante(input.recompensaId, uploadId, ext)).createResumableUpload({
      origin,
      metadata: { contentType, metadata: { recompensaId: input.recompensaId, uploadedBy: user.uid } },
    })
    return { uploadId, uploadUrl, contentType }
  } catch {
    return { error: 'Não foi possível preparar o envio do comprovante.' }
  }
}

export async function registrarPagamento(input: { recompensaId: string; pagaEm: string; uploadId?: string; fileName?: string }): Promise<Resultado> {
  const user = await usuario()
  if (!user) return { error: 'Acesso negado.' }
  const id = String(input?.recompensaId ?? '')
  const pagaEm = String(input?.pagaEm ?? '')
  if (!ID_RECOMPENSA.test(id)) return { error: 'Recompensa inválida.' }
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pagaEm) || Number.isNaN(Date.parse(`${pagaEm}T12:00:00Z`)) || pagaEm > hoje) {
    return { error: 'Informe a data do pagamento (não pode ser futura).' }
  }

  let comprovantePath: string | null = null
  if (input.uploadId) {
    const ext = extensaoAnexo(String(input.fileName ?? ''))
    if (!ext || !/^[A-Za-z0-9]+$/.test(String(input.uploadId))) return { error: 'Comprovante inválido.' }
    const arquivo = adminStorage.bucket().file(caminhoComprovante(id, String(input.uploadId), ext))
    try {
      if (!(await arquivo.exists())[0]) return { error: 'O comprovante não chegou ao servidor. Tente de novo.' }
      const [meta] = await arquivo.getMetadata()
      const tamanho = Number(meta.size)
      if (meta.metadata?.uploadedBy !== user.uid || meta.metadata?.recompensaId !== id) return { error: 'Acesso negado.' }
      if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > ANEXO_TAMANHO_MAX) {
        await arquivo.delete().catch(() => {})
        return { error: 'Arquivo excede o limite de 10MB.' }
      }
      comprovantePath = arquivo.name
    } catch {
      return { error: 'Não foi possível conferir o comprovante. Tente novamente.' }
    }
  }

  try {
    const resultado = await mudarRecompensa(id, 'pagar', user.uid, { pagamento: { pagaEm, comprovantePath } })
    if ('erro' in resultado) {
      if (comprovantePath) await adminStorage.bucket().file(comprovantePath).delete().catch(() => {})
      return { error: resultado.erro }
    }
  } catch {
    return { error: 'Não foi possível registrar o pagamento. Tente novamente.' }
  }
  revalidarFinanceiro()
  return { success: 'Pagamento registrado.' }
}
