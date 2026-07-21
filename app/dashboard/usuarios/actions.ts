'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { adminAuth, adminDb } from '@/utils/firebase/admin'

export type CreateUserResponse = {
  success?: string
  error?: string
  user?: {
    email: string
    role: string
    name?: string
  }
}

const ROLES_VALIDOS = ['vendedor', 'advogado', 'suporte', 'admin']

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

async function assertAdmin() {
  const user = await getSessionUser()
  if (!user) throw new Error('Não autorizado. Faça login novamente.')

  const profileDoc = await adminDb.collection('profiles').doc(user.uid).get()
  const profile = profileDoc.data()

  if (!profileDoc.exists || profile?.role !== 'admin') {
    throw new Error('Acesso negado. Apenas administradores podem gerenciar usuários.')
  }
}

/**
 * Busca todos os perfis de usuários cadastrados (somente admin).
 */
export async function getAllUsersAction() {
  try {
    await assertAdmin()
  } catch (err: any) {
    throw new Error(err.message)
  }

  // 1. Buscar todos os perfis da coleção profiles
  const profilesSnapshot = await adminDb.collection('profiles').get()
  const profiles: any[] = []
  profilesSnapshot.forEach((doc: any) => {
    profiles.push({ id: doc.id, ...doc.data() })
  })

  // 2. Buscar usuários do Firebase Auth
  const listUsersResult = await adminAuth.listUsers()
  const authUsers = listUsersResult.users

  // 3. Cruzar dados por ID
  const combined = authUsers.map((u: any) => {
    const profile = profiles.find((p: any) => p.id === u.uid)
    return {
      id: u.uid,
      email: u.email || '',
      name: u.displayName || '',
      role: profile?.role || null,
      permissions: profile?.permissions || {},
      created_at: profile?.created_at || u.metadata.creationTime,
    }
  })

  return combined
}

/**
 * Atualiza permissões granulares de um usuário (somente admin).
 */
export async function updateUserPermissionsAction(
  userId: string,
  permissions: Record<string, boolean>,
): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  if (!userId) return { error: 'ID de usuário inválido.' }

  const sanitized: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(permissions || {})) {
    if (typeof value === 'boolean') {
      sanitized[key.slice(0, 50)] = value
    }
  }

  try {
    await adminDb.collection('profiles').doc(userId).update({
      permissions: sanitized,
      updated_at: new Date().toISOString(),
    })
    revalidatePath('/dashboard/usuarios')
    return { success: 'Permissões atualizadas com sucesso!' }
  } catch (error: any) {
    return { error: `Erro ao atualizar permissões: ${error.message}` }
  }
}

/**
 * Atualiza a role de um usuário (somente admin).
 */
export async function updateUserRoleAction(userId: string, newRole: string): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  if (!ROLES_VALIDOS.includes(newRole)) {
    return { error: 'Perfil de acesso inválido.' }
  }

  try {
    await adminDb.collection('profiles').doc(userId).update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })

    revalidatePath('/dashboard/usuarios')
    return { success: 'Perfil de acesso atualizado com sucesso!' }
  } catch (error: any) {
    return { error: `Erro ao atualizar perfil: ${error.message}` }
  }
}

/**
 * Exclui um usuário do Firebase Auth e Firestore (somente admin).
 */
export async function deleteUserAction(userId: string): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  try {
    // 1. Deletar do Auth
    await adminAuth.deleteUser(userId)

    // 2. Deletar do Firestore profiles
    await adminDb.collection('profiles').doc(userId).delete()

    revalidatePath('/dashboard/usuarios')
    return { success: 'Usuário removido com sucesso!' }
  } catch (error: any) {
    return { error: `Erro ao deletar usuário: ${error.message}` }
  }
}
 
export async function createUserAction(formData: FormData): Promise<CreateUserResponse> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const role = formData.get('role') as string
  const name = formData.get('name') as string

  if (!email || !password || !role) {
    return { error: 'Por favor, preencha todos os campos obrigatórios (E-mail, Senha e Perfil).' }
  }

  if (password !== confirmPassword) {
    return { error: 'As senhas não coincidem.' }
  }

  if (password.length < 6) {
    return { error: 'A senha deve ter no mínimo 6 caracteres.' }
  }

  if (!ROLES_VALIDOS.includes(role)) {
    return { error: 'Perfil de acesso inválido.' }
  }

  try {
    // 1. Criar usuário no Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name || undefined,
    })

    // 2. Criar perfil correspondente no Firestore
    const now = new Date().toISOString()
    await adminDb.collection('profiles').doc(userRecord.uid).set({
      role,
      created_at: now,
      updated_at: now,
    })

    revalidatePath('/dashboard/usuarios')

    return {
      success: `Usuário cadastrado com sucesso com perfil de ${role}!`,
      user: {
        email: userRecord.email || email,
        role,
        name,
      },
    }
  } catch (error: any) {
    return { error: error.message || 'Erro desconhecido ao criar usuário.' }
  }
}