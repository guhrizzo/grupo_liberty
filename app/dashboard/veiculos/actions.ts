'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createCookieClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Veiculo {
  id: string
  marca: string
  modelo: string
  ano: number
  cor: string | null
  quilometragem: number | null
  preco: number
  cambio: string
  combustivel: string
  placa: string | null
  descricao: string | null
  fotos: string[]
  created_at: string
  updated_at: string
  created_by: string | null
}

export type VeiculoResponse = {
  success?: string
  error?: string
  veiculo?: Veiculo
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertAdmin() {
  const supabase = await createCookieClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autenticado.')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    throw new Error('Acesso negado.')
  }

  return { supabase, user }
}
// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Busca todos os veículos cadastrados.
 * Usa o cliente admin (service role) para garantir acesso independente de RLS,
 * tanto em produção quanto em desenvolvimento.
 */
export async function getVehicles(): Promise<Veiculo[]> {
  // Usamos o cliente admin para leitura pública — o RLS não interfere
  // e a listagem funciona mesmo sem usuário autenticado.
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar veículos:', error.message)
    return []
  }

  return (data as Veiculo[]) || []
}

/**
 * Faz upload das fotos para o Supabase Storage e retorna as URLs públicas.
 */
export async function uploadVehiclePhotos(formData: FormData): Promise<{ urls?: string[]; error?: string }> {
  const { supabase } = await assertAdmin()

  const files = formData.getAll('photos') as File[]
  if (!files.length) return { urls: [] }

  const uploadedUrls: string[] = []

  for (const file of files) {
    if (!file.size) continue

    // Gerar nome único baseado em timestamp + random
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
    const filePath = `fotos/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('veiculos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Erro no upload:', uploadError.message)
      return { error: `Falha ao enviar foto "${file.name}": ${uploadError.message}` }
    }

    // Gerar URL pública
    const { data: urlData } = supabase.storage
      .from('veiculos')
      .getPublicUrl(filePath)

    uploadedUrls.push(urlData.publicUrl)
  }

  return { urls: uploadedUrls }
}

/**
 * Cria um veículo no banco de dados.
 */
export async function createVehicle(formData: FormData): Promise<VeiculoResponse> {
  const { supabase, user } = await assertAdmin()

  // Extrair campos
  const marca = formData.get('marca') as string
  const modelo = formData.get('modelo') as string
  const ano = parseInt(formData.get('ano') as string, 10)
  const cor = (formData.get('cor') as string) || null
  const quilometragem = formData.get('quilometragem')
    ? parseInt(formData.get('quilometragem') as string, 10)
    : null
  const preco = parseFloat(formData.get('preco') as string)
  const cambio = (formData.get('cambio') as string) || 'manual'
  const combustivel = (formData.get('combustivel') as string) || 'flex'
  const placa = (formData.get('placa') as string) || null
  const descricao = (formData.get('descricao') as string) || null
  const fotosJson = formData.get('fotos') as string
  const fotos: string[] = fotosJson ? JSON.parse(fotosJson) : []

  // Validações básicas
  if (!marca || !modelo || !ano || !preco) {
    return { error: 'Preencha os campos obrigatórios: Marca, Modelo, Ano e Preço.' }
  }

  if (isNaN(ano) || ano < 1900 || ano > new Date().getFullYear() + 1) {
    return { error: 'Ano inválido.' }
  }

  if (isNaN(preco) || preco <= 0) {
    return { error: 'Preço inválido.' }
  }

  // Inserir no banco
  const { data, error } = await supabase
    .from('veiculos')
    .insert({
      marca,
      modelo,
      ano,
      cor,
      quilometragem,
      preco,
      cambio,
      combustivel,
      placa,
      descricao,
      fotos,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: `Erro ao cadastrar veículo: ${error.message}` }
  }

  revalidatePath('/dashboard/veiculos')
  return { success: 'Veículo cadastrado com sucesso!', veiculo: data as Veiculo }
}

/**
 * Remove um veículo e suas fotos do Storage.
 */
export async function deleteVehicle(id: string): Promise<{ success?: string; error?: string }> {
  const { supabase } = await assertAdmin()

  // 1. Buscar veículo para pegar as fotos
  const { data: veiculo, error: fetchError } = await supabase
    .from('veiculos')
    .select('fotos')
    .eq('id', id)
    .single()

  if (fetchError) {
    return { error: `Veículo não encontrado: ${fetchError.message}` }
  }

  // 2. Remover fotos do Storage
  if (veiculo?.fotos?.length) {
    const filePaths = veiculo.fotos.map((url: string) => {
      // Extrair path relativo da URL pública
      const parts = url.split('/storage/v1/object/public/veiculos/')
      return parts[1] || ''
    }).filter(Boolean)

    if (filePaths.length) {
      await supabase.storage.from('veiculos').remove(filePaths)
    }
  }

  // 3. Deletar do banco
  const { error: deleteError } = await supabase
    .from('veiculos')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return { error: `Erro ao deletar veículo: ${deleteError.message}` }
  }

  revalidatePath('/dashboard/veiculos')
  return { success: 'Veículo removido com sucesso!' }
}
