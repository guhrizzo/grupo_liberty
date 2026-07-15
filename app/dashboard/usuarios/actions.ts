'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createCookieClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

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

async function assertAdmin() {
  const supabase = await createCookieClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autorizado. Faça login novamente.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Acesso negado. Apenas administradores podem criar usuários.')
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

  const adminClient = createAdminClient()

  // 1. Buscar todos os perfis da tabela profiles (role e data de criação)
  const { data: profiles, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, created_at')

  if (profileError) {
    throw new Error(`Erro ao buscar perfis: ${profileError.message}`)
  }

  // 2. Buscar usuários do Supabase Auth para obter email e metadata (nome)
  const { data: { users }, error: authError } = await adminClient.auth.admin.listUsers()

  if (authError) {
    throw new Error(`Erro ao buscar usuários do Auth: ${authError.message}`)
  }

  // 3. Cruzar dados por ID
  const combined = users.map((u) => {
    const profile = profiles?.find((p) => p.id === u.id)
    return {
      id: u.id,
      email: u.email || '',
      name: u.user_metadata?.name || '',
      role: profile?.role || null,
      created_at: profile?.created_at || u.created_at,
    }
  })

  return combined
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

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)

  if (error) {
    return { error: `Erro ao atualizar perfil: ${error.message}` }
  }

  revalidatePath('/dashboard/usuarios')
  return { success: 'Perfil de acesso atualizado com sucesso!' }
}

/**
 * Exclui um usuário do Supabase Auth (somente admin).
 */
export async function deleteUserAction(userId: string): Promise<{ success?: string; error?: string }> {
  try {
    await assertAdmin()
  } catch (err: any) {
    return { error: err.message }
  }

  const adminClient = createAdminClient()

  const { error } = await adminClient.auth.admin.deleteUser(userId)

  if (error) {
    return { error: `Erro ao deletar usuário: ${error.message}` }
  }

  revalidatePath('/dashboard/usuarios')
  return { success: 'Usuário removido com sucesso!' }
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

  const adminClient = createAdminClient()

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.user) {
    return { error: 'Erro desconhecido ao criar usuário.' }
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ role })
    .eq('id', data.user.id)

  if (profileError) {
    return { error: `Usuário criado, mas houve erro ao definir o perfil: ${profileError.message}` }
  }

  revalidatePath('/dashboard/usuarios')

  return {
    success: `Usuário cadastrado com sucesso com perfil de ${role}!`,
    user: {
      email: data.user.email || email,
      role,
      name,
    },
  }
}