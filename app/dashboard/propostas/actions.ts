'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { sendPropostaStatusEmail } from '@/utils/email/send-proposta-email'
import { decrypt } from '@/utils/crypto'
import { maskCPFCNPJ } from '@/utils/masks'

export interface Proposta {
  id: string
  veiculo_id: string
  user_id: string | null
  nome?: string
  cpf?: string
  telefone?: string
  email?: string
  valor: number | null
  proposta_comercial?: number | null
  condicoes?: string | null
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
  user_phone?: string
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

    // 3. Buscar usuários do Auth para obter e-mail e nome (fallback)
    let authUsers: any[] = []
    try {
      const listUsersResult = await adminAuth.listUsers()
      authUsers = listUsersResult.users
    } catch {
      // Caso não consiga listar usuários do Auth
    }

    // 4. Cruzar dados das propostas, veículos e dados de contato
    return propostasList.map((p: any) => {
      const authUser = authUsers.find((u: any) => u.uid === p.user_id)
      const veiculoInfo = veiculosMap[p.veiculo_id] || null

      const clienteNome = p.nome || authUser?.displayName || 'Visitante'
      const clienteEmail = p.email || authUser?.email || 'Sem e-mail'
      const clienteTelefone = p.telefone || 'Sem telefone'

      let decryptedCpf = ''
      if (p.cpf) {
        const raw = decrypt(p.cpf)
        if (raw) {
          decryptedCpf = maskCPFCNPJ(raw)
        }
      }

      return {
        id: p.id,
        veiculo_id: p.veiculo_id,
        user_id: p.user_id ?? null,
        nome: clienteNome,
        cpf: decryptedCpf || undefined,
        telefone: clienteTelefone,
        email: clienteEmail,
        valor: p.valor,
        proposta_comercial: p.proposta_comercial ?? null,
        condicoes: p.condicoes ?? null,
        mensagem: p.mensagem,
        status: p.status,
        created_at: p.created_at,
        veiculos: veiculoInfo,
        user_email: clienteEmail,
        user_name: clienteNome,
        user_phone: clienteTelefone,
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
export async function updatePropostaStatus(id: string, newStatus: 'pendente' | 'aceito' | 'recusado'): Promise<{ success?: string; error?: string; emailSent?: boolean }> {
  try {
    await assertAuthorized()

    await adminDb.collection('propostas').doc(id).update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })

    revalidatePath('/dashboard/propostas')

    // Disparar e-mail de notificação para aceito ou recusado (não bloqueia o retorno)
    let emailSent = false
    if (newStatus === 'aceito' || newStatus === 'recusado') {
      try {
        const propostaDoc = await adminDb.collection('propostas').doc(id).get()
        const proposta = propostaDoc.data()

        if (proposta) {
          // Resolver nome e e-mail do cliente
          let clienteNome = proposta.nome || 'Cliente'
          let clienteEmail = proposta.email || ''

          if (proposta.user_id && !clienteEmail) {
            try {
              const authUser = await adminAuth.getUser(proposta.user_id)
              clienteEmail = authUser.email || ''
              clienteNome = proposta.nome || authUser.displayName || 'Cliente'
            } catch {
              // Usuário não encontrado no Auth, continua com dados da proposta
            }
          }

          // Resolver dados do veículo
          let veiculoMarca = 'Veículo'
          let veiculoModelo = ''
          if (proposta.veiculo_id) {
            try {
              const veiculoDoc = await adminDb.collection('veiculos').doc(proposta.veiculo_id).get()
              const veiculo = veiculoDoc.data()
              if (veiculo) {
                veiculoMarca = veiculo.marca || 'Veículo'
                veiculoModelo = veiculo.modelo || ''
              }
            } catch {
              // Veículo removido ou não encontrado
            }
          }

          emailSent = await sendPropostaStatusEmail({
            clienteNome,
            clienteEmail,
            veiculoMarca,
            veiculoModelo,
            valorOfertado: proposta.valor ?? null,
            status: newStatus,
          })
        }
      } catch (emailErr) {
        // Erros de e-mail não devem bloquear a atualização do status
        console.error('[Email] Falha ao enviar notificação de proposta:', emailErr)
      }
    }

    return { success: 'Status da proposta atualizado com sucesso!', emailSent }
  } catch (err: any) {
    return { error: err.message || 'Erro de autorização.' }
  }
}

/**
 * Exclui permanentemente uma proposta com status 'aceito' ou 'recusado'.
 */
export async function deleteProposta(id: string): Promise<{ success?: string; error?: string }> {
  try {
    await assertAuthorized()

    const propostaRef = adminDb.collection('propostas').doc(id)
    const propostaDoc = await propostaRef.get()

    if (!propostaDoc.exists) {
      return { error: 'Proposta não encontrada.' }
    }

    const data = propostaDoc.data()
    if (!data || !['aceito', 'recusado'].includes(data.status)) {
      return { error: 'Apenas propostas aceitas ou recusadas podem ser excluídas.' }
    }

    await propostaRef.delete()

    revalidatePath('/dashboard/propostas')
    return { success: 'Proposta excluída com sucesso.' }
  } catch (err: any) {
    return { error: err.message || 'Erro ao excluir proposta.' }
  }
}

/**
 * Atualiza a "Proposta Comercial" e/ou "Condições" de uma proposta sem
 * alterar seu status. Usado pelo modal "Gerador de proposta" quando o
 * vendedor quer gravar os ajustes antes (ou sem) gerar o PDF.
 */
export async function updatePropostaComercial(
  id: string,
  propostaComercial: number | null,
  condicoes: string | null,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAuthorized()

    if (!id) {
      return { error: 'ID da proposta inválido.' }
    }

    const propostaRef = adminDb.collection('propostas').doc(id)
    const propostaDoc = await propostaRef.get()
    if (!propostaDoc.exists) {
      return { error: 'Proposta não encontrada.' }
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (propostaComercial !== null) {
      if (typeof propostaComercial !== 'number' || Number.isNaN(propostaComercial) || propostaComercial < 0) {
        return { error: 'Proposta comercial inválida.' }
      }
      update.proposta_comercial = propostaComercial
    }

    if (condicoes !== null) {
      update.condicoes = String(condicoes)
    }

    await propostaRef.update(update)
    revalidatePath('/dashboard/propostas')

    return { success: 'Proposta atualizada com sucesso.' }
  } catch (err: any) {
    return { error: err.message || 'Erro ao atualizar proposta.' }
  }
}
