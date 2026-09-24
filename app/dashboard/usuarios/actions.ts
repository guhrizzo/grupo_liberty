'use server'

import { revalidatePath } from 'next/cache'
import { adminAuth, adminDb } from '@/utils/firebase/admin'
import { assertPageAccess, type SessionUser } from '@/utils/permissions'

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

/** Quem tem acesso à aba `usuarios` pode fazer o CRUD dela. */
async function assertAcesso(): Promise<SessionUser> {
  return assertPageAccess('usuarios')
}

/**
 * Trava contra escalada de privilégio: quem não é admin (mas recebeu a aba de
 * usuários) não cria/promove administradores nem altera/exclui contas de admin.
 */
function assertPodeAtribuirRole(actor: SessionUser, role: string) {
  if (role === 'admin' && actor.role !== 'admin') {
    throw new Error('Apenas administradores podem atribuir o perfil de administrador.')
  }
}

async function assertPodeAlterarUsuario(actor: SessionUser, userId: string) {
  if (actor.role === 'admin') return
  const alvo = await adminDb.collection('profiles').doc(userId).get()
  if (alvo.data()?.role === 'admin') {
    throw new Error('Apenas administradores podem alterar contas de administrador.')
  }
}

/**
 * Busca todos os perfis de usuários cadastrados (quem tem acesso à aba de usuários).
 */
export async function getAllUsersAction() {
  try {
    await assertAcesso()
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
 * Atualiza permissões granulares de um usuário (quem tem acesso à aba de usuários).
 */
export async function updateUserPermissionsAction(
  userId: string,
  permissions: Record<string, boolean>,
): Promise<{ success?: string; error?: string }> {
  if (!userId) return { error: 'ID de usuário inválido.' }

  try {
    const actor = await assertAcesso()
    await assertPodeAlterarUsuario(actor, userId)
  } catch (err: any) {
    return { error: err.message }
  }

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
 * Atualiza a role de um usuário (quem tem acesso à aba de usuários).
 */
export async function updateUserRoleAction(userId: string, newRole: string): Promise<{ success?: string; error?: string }> {
  if (!ROLES_VALIDOS.includes(newRole)) {
    return { error: 'Perfil de acesso inválido.' }
  }

  try {
    const actor = await assertAcesso()
    assertPodeAtribuirRole(actor, newRole)
    await assertPodeAlterarUsuario(actor, userId)
  } catch (err: any) {
    return { error: err.message }
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
 * Exclui um usuário do Firebase Auth e Firestore (quem tem acesso à aba de usuários).
 */
export async function deleteUserAction(userId: string): Promise<{ success?: string; error?: string }> {
  try {
    const actor = await assertAcesso()
    await assertPodeAlterarUsuario(actor, userId)
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
  let actor: SessionUser
  try {
    actor = await assertAcesso()
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
    assertPodeAtribuirRole(actor, role)
  } catch (err: any) {
    return { error: err.message }
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