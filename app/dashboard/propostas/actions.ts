'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createCookieClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export interface Proposta {
  id: string
  veiculo_id: string
  user_id: string
  valor: number | null
  mensagem: string
  status: 'pendente' | 'aceito' | 'recusado'
  created_at: string
  veiculos: {
    marca: string
    modelo: string
    preco: number
  } | null
  user_email?: string
  user_name?: string
}

async function assertAuthorized() {
  const supabase = await createCookieClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autenticado.')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !['admin', 'vendedor'].includes(profile.role)) {
    throw new Error('Acesso negado. Apenas administradores e vendedores podem acessar.')
  }

  return { supabase, user, role: profile.role }
}

/**
 * Busca todas as propostas enviadas.
 */
export async function getPropostas(): Promise<Proposta[]> {
  try {
    const { supabase } = await assertAuthorized()

    const { data, error } = await supabase
      .from('propostas')
      .select('*, veiculos(marca, modelo, preco)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar propostas:', error.message)
      return []
    }

    const propostas = (data as any[]) || []
    if (propostas.length === 0) return []

    // Cruzar com informações dos usuários (email / nome)
    const adminClient = createAdminClient()
    const { data: { users }, error: authError } = await adminClient.auth.admin.listUsers()

    if (authError) {
      console.error('Erro ao buscar lista de usuários para mapeamento:', authError.message)
      return propostas as Proposta[]
    }

    return propostas.map((p) => {
      const authUser = users.find((u) => u.id === p.user_id)
      return {
        ...p,
        user_email: authUser?.email || 'N/A',
        user_name: authUser?.user_metadata?.name || 'Cliente',
      }
    })
  } catch (err) {
    console.error(err)
    return []
  }
}

/**
 * Atualiza o status de uma proposta.
 */
export async function updatePropostaStatus(id: string, newStatus: 'pendente' | 'aceito' | 'recusado'): Promise<{ success?: string; error?: string }> {
  try {
    const { supabase } = await assertAuthorized()

    const { error } = await supabase
      .from('propostas')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      return { error: `Erro ao atualizar proposta: ${error.message}` }
    }

    revalidatePath('/dashboard/propostas')
    return { success: 'Status da proposta atualizado com sucesso!' }
  } catch (err: any) {
    return { error: err.message || 'Erro de autorização.' }
  }
}
