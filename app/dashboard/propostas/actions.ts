'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

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

async function assertAuthorized() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autenticado.')

  const profileDoc = await adminDb.collection('profiles').doc(user.uid).get()
  const profile = profileDoc.data()

  if (!profileDoc.exists || !profile || !['admin', 'vendedor'].includes(profile.role)) {
    throw new Error('Acesso negado. Apenas administradores e vendedores podem acessar.')
  }

  return { user, role: profile.role }
}

/**
 * Busca todas as propostas enviadas.
 */
export async function getPropostas(): Promise<Proposta[]> {
  try {
    await assertAuthorized()

    // 1. Buscar todas as propostas
    const propostasSnapshot = await adminDb.collection('propostas')
      .orderBy('created_at', 'desc')
      .get()

    const propostasList: any[] = []
    propostasSnapshot.forEach((doc: any) => {
      propostasList.push({ id: doc.id, ...doc.data() })
    })

    if (propostasList.length === 0) return []

    // 2. Buscar todos os veículos para mapeamento (evita consultas N+1)
    const veiculosSnapshot = await adminDb.collection('veiculos').get()
    const veiculosMap: Record<string, { marca: string; modelo: string; preco: number }> = {}
    veiculosSnapshot.forEach((doc: any) => {
      const data = doc.data()
      veiculosMap[doc.id] = {
        marca: data.marca,
        modelo: data.modelo,
        preco: data.preco,
      }
    })

    // 3. Buscar usuários do Auth para obter e-mail e nome
    const listUsersResult = await adminAuth.listUsers()
    const authUsers = listUsersResult.users

    // 4. Cruzar dados das propostas, veículos e usuários
    return propostasList.map((p: any) => {
      const authUser = authUsers.find((u: any) => u.uid === p.user_id)
      const veiculoInfo = veiculosMap[p.veiculo_id] || null

      return {
        id: p.id,
        veiculo_id: p.veiculo_id,
        user_id: p.user_id,
        valor: p.valor,
        mensagem: p.mensagem,
        status: p.status,
        created_at: p.created_at,
        veiculos: veiculoInfo,
        user_email: authUser?.email || 'N/A',
        user_name: authUser?.displayName || 'Cliente',
      }
    })
  } catch (err) {
    console.error('Erro ao buscar propostas:', err)
    return []
  }
}

/**
 * Atualiza o status de uma proposta.
 */
export async function updatePropostaStatus(id: string, newStatus: 'pendente' | 'aceito' | 'recusado'): Promise<{ success?: string; error?: string }> {
  try {
    await assertAuthorized()

    await adminDb.collection('propostas').doc(id).update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })

    revalidatePath('/dashboard/propostas')
    return { success: 'Status da proposta atualizado com sucesso!' }
  } catch (err: any) {
    return { error: err.message || 'Erro de autorização.' }
  }
}
