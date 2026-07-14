'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createCookieClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export type CreateUserResponse = {
  success?: string
  error?: string
  user?: {
    email: string
    role: string
    name?: string
  }
}

/**
 * Server Action para tornar o usuário atual um administrador (exclusivo para desenvolvimento/testes).
 */
export async function makeMeAdmin() {
  const supabase = await createCookieClient()
  
  // Atualiza os metadados do usuário logado
  const { error } = await supabase.auth.updateUser({
    data: { role: 'admin' }
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/usuarios')
  return { success: 'Seu usuário agora é Administrador!' }
}

/**
 * Server Action para criar um novo usuário no Supabase sem afetar os cookies da sessão atual do admin.
 */
export async function createUserAction(formData: FormData): Promise<CreateUserResponse> {
  const cookieClient = await createCookieClient()
  
  // 1. Validar se o usuário logado existe e é admin
  const { data: { user: currentUser } } = await cookieClient.auth.getUser()
  if (!currentUser) {
    return { error: 'Não autorizado. Faça login novamente.' }
  }

  const userRole = currentUser.user_metadata?.role
  if (userRole !== 'admin') {
    return { error: 'Acesso negado. Apenas administradores podem criar usuários.' }
  }

  // 2. Extrair e validar dados do formulário
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

  // 3. Criar cliente Supabase sem persistência de sessão (para não sobrescrever a sessão do admin)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  const rawSupabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  // 4. Cadastrar o novo usuário com metadados de perfil
  const { data, error } = await rawSupabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        name: name || undefined
      }
    }
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.user) {
    return { error: 'Erro desconhecido ao criar usuário.' }
  }

  return {
    success: `Usuário cadastrado com sucesso com perfil de ${role}!`,
    user: {
      email: data.user.email || email,
      role,
      name: data.user.user_metadata?.name
    }
  }
}
