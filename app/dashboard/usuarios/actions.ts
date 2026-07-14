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
 * Server Action para criar um novo usuário (somente admin).
 * Usa a service_role key, então não é afetada pelo bloqueio de signup público.
 */
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