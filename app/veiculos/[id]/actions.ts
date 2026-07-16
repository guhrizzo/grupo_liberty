'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function enviarPropostaAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  const { error } = await supabase
    .from('propostas')
    .insert({
      veiculo_id: veiculoId,
      user_id: user.id,
      valor,
      mensagem,
      status: 'pendente'
    })

  if (error) {
    console.error('Erro ao enviar proposta:', error.message)
    return { error: `Erro ao enviar proposta: ${error.message}` }
  }

  revalidatePath(`/veiculos/${veiculoId}`)
  return { success: 'Proposta enviada com sucesso! Nossa equipe entrará em contato.' }
}
