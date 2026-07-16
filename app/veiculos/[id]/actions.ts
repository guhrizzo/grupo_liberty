'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

async function getSessionUser() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (!session) return null

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(session, true)
    return decodedClaims
  } catch (error) {
    return null
  }
}

export async function enviarPropostaAction(formData: FormData) {
  const user = await getSessionUser()

  if (!user) {
    return { error: 'Você precisa estar logado para enviar uma proposta.' }
  }

  const veiculoId = formData.get('veiculo_id') as string
  const valorStr = formData.get('valor') as string
  const mensagem = formData.get('mensagem') as string

  if (!veiculoId) {
    return { error: 'Veículo não especificado.' }
  }

  if (!mensagem || mensagem.trim() === '') {
    return { error: 'A mensagem de interesse é obrigatória.' }
  }

  const valor = valorStr ? parseFloat(valorStr.replace(',', '.')) : null

  if (valor !== null && (isNaN(valor) || valor <= 0)) {
    return { error: 'Valor da proposta inválido.' }
  }

  try {
    const docRef = adminDb.collection('propostas').doc()
    await docRef.set({
      veiculo_id: veiculoId,
      user_id: user.uid,
      valor,
      mensagem,
      status: 'pendente',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    revalidatePath(`/veiculos/${veiculoId}`)
    return { success: 'Proposta enviada com sucesso! Nossa equipe entrará em contato.' }
  } catch (error: any) {
    console.error('Erro ao enviar proposta:', error)
    return { error: `Erro ao enviar proposta: ${error.message}` }
  }
}
